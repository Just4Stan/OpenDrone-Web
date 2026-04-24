/**
 * Thin wrapper around the Discord REST API used by the web-support bridge.
 * Everything here is bot-authenticated (no gateway connection), because
 * Cloudflare Workers can't hold a WebSocket and support volume is tiny
 * enough that polling from the Worker is fine.
 *
 * Staff reply flow: staff types in a forum thread -> Worker polls the
 * thread on the next /poll request -> new messages returned to the
 * browser widget.
 */

const DISCORD_API = 'https://discord.com/api/v10';

// Every outbound Discord call goes through this so a hanging Discord
// incident can't tie up a Worker's CPU/wall budget indefinitely. 5 s is
// generous — healthy Discord calls return in ~50–200 ms.
const DISCORD_TIMEOUT_MS = 5000;

function discordFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(DISCORD_TIMEOUT_MS),
  });
}

type DiscordEnv = {
  DISCORD_BOT_TOKEN?: string;
  DISCORD_SUPPORT_CHANNEL_ID?: string;
  DISCORD_GUILD_ID?: string;
};

export type DiscordMessage = {
  id: string;
  author: {
    id: string;
    username: string;
    globalName: string | null;
    bot: boolean;
  };
  content: string;
  createdAt: string;
  attachments: Array<{id: string; url: string; filename: string}>;
  // Reactions as Discord returns them in the message payload. `count` is
  // the total reactor count for that emoji, `me` is whether the bot
  // itself reacted. We use this in the Stage 2 moderation gate to decide
  // whether a reactor fetch is worth making (no count = no reaction yet,
  // skip the round trip).
  reactions: Array<{emoji: string; count: number; me: boolean}>;
};

export type DiscordThread = {
  id: string;
  name: string;
  archived: boolean;
  locked: boolean;
};

function authHeaders(env: DiscordEnv) {
  if (!env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN not set');
  return {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'opendrone-support (https://opendrone.be, 0.1)',
  };
}

function authHeadersMultipart(env: DiscordEnv) {
  if (!env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN not set');
  // No Content-Type — fetch sets the multipart boundary automatically.
  return {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    'User-Agent': 'opendrone-support (https://opendrone.be, 0.1)',
  };
}

export type OutboundFile = {
  name: string;
  type: string;
  data: ArrayBuffer | Uint8Array | Blob;
};

export async function createSupportThread(
  env: DiscordEnv,
  opts: {
    title: string;
    userName: string;
    userEmail: string;
    firstMessage: string;
    tags?: string[];
    userAgent?: string;
    ipHint?: string;
    files?: OutboundFile[];
    customerId?: string;
  },
): Promise<DiscordThread> {
  if (!env.DISCORD_SUPPORT_CHANNEL_ID) {
    throw new Error('DISCORD_SUPPORT_CHANNEL_ID not set');
  }
  const body = {
    name: opts.title.slice(0, 96),
    auto_archive_duration: 1440, // 24h
    message: {
      content: [
        `**New web-support ticket**`,
        `From: **${opts.userName}** <${opts.userEmail}>`,
        opts.customerId
          ? `Shopify customer: \`${opts.customerId}\``
          : null,
        opts.ipHint ? `Hint: ${opts.ipHint}` : null,
        opts.userAgent ? `UA: \`${opts.userAgent.slice(0, 180)}\`` : null,
        '',
        opts.firstMessage.slice(0, 1800),
      ]
        .filter(Boolean)
        .join('\n'),
      // No @everyone / role pings from user content.
      allowed_mentions: {parse: []},
    },
  };

  const files = opts.files ?? [];
  let res: Response;
  if (!files.length) {
    res = await discordFetch(
      `${DISCORD_API}/channels/${env.DISCORD_SUPPORT_CHANNEL_ID}/threads`,
      {
        method: 'POST',
        headers: authHeaders(env),
        body: JSON.stringify(body),
      },
    );
  } else {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(body));
    files.forEach((f, i) => {
      const blob =
        f.data instanceof Blob
          ? f.data
          : new Blob([f.data as ArrayBuffer], {type: f.type || 'application/octet-stream'});
      form.append(`files[${i}]`, blob, sanitizeFilename(f.name));
    });
    res = await discordFetch(
      `${DISCORD_API}/channels/${env.DISCORD_SUPPORT_CHANNEL_ID}/threads`,
      {
        method: 'POST',
        headers: authHeadersMultipart(env),
        body: form,
      },
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`discord createThread ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    id: string;
    name: string;
    thread_metadata?: {archived: boolean; locked: boolean};
  };
  return {
    id: json.id,
    name: json.name,
    archived: !!json.thread_metadata?.archived,
    locked: !!json.thread_metadata?.locked,
  };
}

export async function postToThread(
  env: DiscordEnv,
  threadId: string,
  content: string,
  files: OutboundFile[] = [],
): Promise<DiscordMessage | null> {
  const payload = {
    content: sanitizeMessageContent(content).slice(0, 1900),
    allowed_mentions: {parse: []},
  };

  let res: Response;
  if (!files.length) {
    res = await discordFetch(`${DISCORD_API}/channels/${threadId}/messages`, {
      method: 'POST',
      headers: authHeaders(env),
      body: JSON.stringify(payload),
    });
  } else {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    files.forEach((f, i) => {
      const blob =
        f.data instanceof Blob
          ? f.data
          : new Blob([f.data as ArrayBuffer], {type: f.type || 'application/octet-stream'});
      form.append(`files[${i}]`, blob, sanitizeFilename(f.name));
    });
    res = await discordFetch(`${DISCORD_API}/channels/${threadId}/messages`, {
      method: 'POST',
      headers: authHeadersMultipart(env),
      body: form,
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[support] postToThread', res.status, text.slice(0, 160));
    return null;
  }
  return normalizeMessage(await res.json());
}

function sanitizeMessageContent(content: string): string {
  // Strip Unicode bidi overrides (U+202A-U+202E, U+2066-U+2069) from
  // user-supplied message content before it reaches Discord. A staff
  // member viewing a ticket should not have their rendered line order
  // silently reversed by RLO/LRO/PDI/LRI chars — the same class of
  // trick that landed CVE-2021-42574 ("Trojan Source"). Also strip C0/C1
  // control chars except tab/newline so log-injection via CR doesn't
  // spoof Discord command output.
  return content
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');
}

function sanitizeFilename(name: string): string {
  // Strip path traversal + control chars + Unicode bidi overrides; cap
  // length. The bidi chars (U+202A-E, U+2066-9) are the classic
  // "doc.pdf<RLO>exe" RTL-override trick that renders `exe.fdp.cod`.
  // Discord enforces its own limits but we keep things tidy on the wire.
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\\/]/g, '_')
    .slice(0, 100);
  return cleaned || 'file';
}

export async function fetchThreadMessages(
  env: DiscordEnv,
  threadId: string,
  opts: {afterId?: string; limit?: number} = {},
): Promise<{messages: DiscordMessage[]; thread: DiscordThread | null}> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const params = new URLSearchParams({limit: String(limit)});
  if (opts.afterId) params.set('after', opts.afterId);
  const [msgRes, threadRes] = await Promise.all([
    discordFetch(
      `${DISCORD_API}/channels/${threadId}/messages?${params.toString()}`,
      {headers: authHeaders(env)},
    ),
    discordFetch(`${DISCORD_API}/channels/${threadId}`, {
      headers: authHeaders(env),
    }),
  ]);
  if (!msgRes.ok) {
    const text = await msgRes.text().catch(() => '');
    console.warn('[support] fetchMessages', msgRes.status, text.slice(0, 160));
    return {messages: [], thread: null};
  }
  const raw = (await msgRes.json()) as unknown[];
  const messages = Array.isArray(raw) ? raw.map(normalizeMessage) : [];
  // Discord returns newest-first; the widget wants oldest-first.
  messages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  let thread: DiscordThread | null = null;
  if (threadRes.ok) {
    const tj = (await threadRes.json()) as {
      id: string;
      name: string;
      thread_metadata?: {archived: boolean; locked: boolean};
    };
    thread = {
      id: tj.id,
      name: tj.name,
      archived: !!tj.thread_metadata?.archived,
      locked: !!tj.thread_metadata?.locked,
    };
  }
  return {messages, thread};
}

export type SupportThreadMatch = {
  id: string;
  name: string;
  archived: boolean;
  locked: boolean;
  createdAt: string;
};

/**
 * Find threads in the support forum whose first message contains the
 * given email address. Used by /api/support/lookup to recover tickets
 * for a returning visitor without any server-side database.
 *
 * Strategy:
 *  1. List active threads in the guild (one call) and filter by parent.
 *  2. List one page of recent archived public threads in the channel.
 *  3. Fetch the first message of each candidate (forum-thread starter
 *     has the same id as the thread itself).
 *  4. Match the email substring case-insensitively.
 *
 * The cap (`maxCandidates`) keeps the call bounded — at low volume we
 * cover everything; at higher volume we walk the most recent N threads
 * and miss older ones, which is acceptable for a "resume by email" UX.
 */
export async function findThreadsByEmail(
  env: DiscordEnv,
  email: string,
  opts: {maxCandidates?: number} = {},
): Promise<SupportThreadMatch[]> {
  if (!env.DISCORD_SUPPORT_CHANNEL_ID) return [];
  const target = email.trim().toLowerCase();
  if (!target) return [];
  const cap = Math.max(10, Math.min(opts.maxCandidates ?? 60, 200));

  const candidates = await listForumThreads(env, cap);
  if (!candidates.length) return [];

  // Fetch first messages in parallel — Discord's global limit (50/s) is
  // well above what 60 parallel GETs incur in a single burst.
  const firstMessages = await Promise.all(
    candidates.map((t) => fetchFirstMessage(env, t.id).catch(() => null)),
  );

  const matches: SupportThreadMatch[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const m = firstMessages[i];
    if (!m) continue;
    if (m.content.toLowerCase().includes(target)) {
      matches.push(candidates[i]);
    }
  }
  return matches;
}

type ForumThread = SupportThreadMatch & {parentId?: string};

async function listForumThreads(
  env: DiscordEnv,
  cap: number,
): Promise<ForumThread[]> {
  const channel = env.DISCORD_SUPPORT_CHANNEL_ID!;
  const calls: Promise<ForumThread[]>[] = [];

  if (env.DISCORD_GUILD_ID) {
    calls.push(listActiveGuildThreads(env, channel));
  }
  calls.push(listArchivedChannelThreads(env, channel));

  const groups = await Promise.all(calls);
  const seen = new Map<string, ForumThread>();
  for (const g of groups) {
    for (const t of g) {
      if (!seen.has(t.id)) seen.set(t.id, t);
    }
  }
  // Most recent first by id (snowflake).
  const all = Array.from(seen.values()).sort((a, b) =>
    a.id < b.id ? 1 : a.id > b.id ? -1 : 0,
  );
  return all.slice(0, cap);
}

async function listActiveGuildThreads(
  env: DiscordEnv,
  channelId: string,
): Promise<ForumThread[]> {
  if (!env.DISCORD_GUILD_ID) return [];
  const res = await discordFetch(
    `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/threads/active`,
    {headers: authHeaders(env)},
  );
  if (!res.ok) {
    console.warn(
      '[support] listActiveGuildThreads',
      res.status,
      (await res.text().catch(() => '')).slice(0, 160),
    );
    return [];
  }
  const json = (await res.json()) as {
    threads?: Array<{
      id: string;
      name: string;
      parent_id?: string;
      thread_metadata?: {archived: boolean; locked: boolean; create_timestamp?: string};
    }>;
  };
  return (json.threads ?? [])
    .filter((t) => t.parent_id === channelId)
    .map((t) => ({
      id: t.id,
      name: t.name,
      archived: !!t.thread_metadata?.archived,
      locked: !!t.thread_metadata?.locked,
      createdAt: t.thread_metadata?.create_timestamp ?? '',
      parentId: t.parent_id,
    }));
}

async function listArchivedChannelThreads(
  env: DiscordEnv,
  channelId: string,
): Promise<ForumThread[]> {
  // One page (≤100 threads). Older history is intentionally out of scope
  // for the resume flow — at OpenDrone's volume one page covers months.
  const res = await discordFetch(
    `${DISCORD_API}/channels/${channelId}/threads/archived/public?limit=100`,
    {headers: authHeaders(env)},
  );
  if (!res.ok) {
    console.warn(
      '[support] listArchivedChannelThreads',
      res.status,
      (await res.text().catch(() => '')).slice(0, 160),
    );
    return [];
  }
  const json = (await res.json()) as {
    threads?: Array<{
      id: string;
      name: string;
      parent_id?: string;
      thread_metadata?: {archived: boolean; locked: boolean; create_timestamp?: string};
    }>;
  };
  return (json.threads ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    archived: !!t.thread_metadata?.archived,
    locked: !!t.thread_metadata?.locked,
    createdAt: t.thread_metadata?.create_timestamp ?? '',
    parentId: t.parent_id,
  }));
}

async function fetchFirstMessage(
  env: DiscordEnv,
  threadId: string,
): Promise<DiscordMessage | null> {
  // The forum-thread starter message has the same snowflake id as the
  // thread. GET /channels/{thread}/messages/{thread} returns it directly.
  const res = await discordFetch(
    `${DISCORD_API}/channels/${threadId}/messages/${threadId}`,
    {headers: authHeaders(env)},
  );
  if (!res.ok) return null;
  return normalizeMessage(await res.json());
}

function normalizeMessage(raw: unknown): DiscordMessage {
  const m = raw as {
    id: string;
    content: string;
    timestamp: string;
    author: {
      id: string;
      username: string;
      global_name?: string | null;
      bot?: boolean;
    };
    attachments?: Array<{id: string; url: string; filename: string}>;
    reactions?: Array<{
      emoji?: {name?: string | null; id?: string | null};
      count?: number;
      me?: boolean;
    }>;
  };
  return {
    id: m.id,
    content: m.content ?? '',
    createdAt: m.timestamp,
    author: {
      id: m.author.id,
      username: m.author.username,
      globalName: m.author.global_name ?? null,
      bot: !!m.author.bot,
    },
    attachments: (m.attachments ?? []).map((a) => ({
      id: a.id,
      url: a.url,
      filename: a.filename,
    })),
    reactions: (m.reactions ?? [])
      .map((r) => ({
        emoji: r.emoji?.name ?? '',
        count: r.count ?? 0,
        me: !!r.me,
      }))
      .filter((r) => r.emoji.length > 0),
  };
}

// Fetches the user IDs that reacted with a given emoji to a specific
// message. Used by the moderation gate to check whether an allowlisted
// moderator has approved a message for publishing to the customer.
//
// The `emoji` argument for unicode emoji is the character itself
// (URL-encoded). For custom server emoji Discord expects `name:id`.
// We only use unicode in Stage 2.
export async function fetchReactors(
  env: DiscordEnv,
  channelId: string,
  messageId: string,
  emoji: string,
  opts: {limit?: number} = {},
): Promise<string[]> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const res = await discordFetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?limit=${limit}`,
    {headers: authHeaders(env)},
  );
  if (!res.ok) {
    // 404 means no reactions (or wrong emoji) — treat as empty.
    if (res.status === 404) return [];
    console.warn(
      '[support] fetchReactors failed',
      res.status,
      messageId,
      emoji,
    );
    return [];
  }
  const raw = (await res.json()) as Array<{id?: string}>;
  return Array.isArray(raw)
    ? raw.map((u) => u.id ?? '').filter((id) => id.length > 0)
    : [];
}

// Fetches guild members that carry a specific role. Used to build the
// moderator allowlist cache. One call per cache refresh (not per poll).
// We page through members up to a reasonable cap — if the server ever
// has >1000 members, the cache becomes slightly lossy for role holders
// past position 1000, which is a problem for a later stage.
export async function fetchGuildRoleMembers(
  env: DiscordEnv & {DISCORD_GUILD_ID?: string},
  roleId: string,
): Promise<string[]> {
  if (!env.DISCORD_GUILD_ID) {
    console.warn('[support] DISCORD_GUILD_ID unset — cannot resolve mod role');
    return [];
  }
  const ids: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url =
      `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members?limit=100` +
      (after ? `&after=${after}` : '');
    const res = await discordFetch(url, {headers: authHeaders(env)});
    if (!res.ok) {
      console.warn('[support] fetchGuildRoleMembers failed', res.status);
      break;
    }
    const raw = (await res.json()) as Array<{
      user?: {id?: string};
      roles?: string[];
    }>;
    if (!Array.isArray(raw) || raw.length === 0) break;
    for (const m of raw) {
      if (m.user?.id && m.roles?.includes(roleId)) ids.push(m.user.id);
    }
    if (raw.length < 100) break;
    after = raw[raw.length - 1]?.user?.id;
    if (!after) break;
  }
  return ids;
}
