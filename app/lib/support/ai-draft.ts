// Stage 4 of the moderated support bridge: AI first-responder.
//
// When a new ticket lands, we ask Claude to draft a reply and post the
// draft *to the Discord thread only* (never directly to the customer).
// The moderation gate (Stage 2) then decides whether it ships: a mod
// reacts ✅ → the customer sees it as role='ai'. No reaction → silence.
//
// The AI never talks to customers autonomously. It saves staff typing.
//
// Fail-safe: every failure path (missing API key, upstream error, bad
// JSON, rate limit, invalid env) returns null and logs a warning. The
// ticket flow continues without an AI draft; staff reply manually as
// before.
//
// Raw fetch to Anthropic's API — no new npm dep. We do not import
// `@anthropic-ai/sdk` because it isn't in package.json and adding a
// transitive Workers-unfriendly dep isn't worth it for a single POST.

// Prefix that marks a bot-authored AI draft in Discord. The poll route
// uses this to tell an AI draft (which may surface, after approval)
// apart from the bot's own thread-starter / system messages (which
// must never surface).
export const AI_DRAFT_PREFIX = '🤖 **AI draft:**';

// Stage 5: bot-authored summary of a long thread. Same moderation
// gate as AI_DRAFT_PREFIX — the customer only sees the summary if a
// moderator ✅'s it. The trailing `up to msg_id=<id>` marker lets the
// poll route tell whether a summary is stale (newer messages have
// arrived since) without hitting the AI again needlessly.
export const AI_SUMMARY_PREFIX = '🤖 **Recap so far';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 700;
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 15_000;

// The system prompt is split so the big static chunk can be
// prompt-cached. Anthropic's prompt cache needs ~1 KB minimum to be
// worth caching; we'll get above that as we extend the context with
// product docs later.
const SYSTEM_PROMPT_STATIC = [
  'You are the OpenDrone support assistant — first-pass triage for customer tickets.',
  '',
  'OpenDrone makes open-source FPV drone hardware designed and manufactured in Europe. Products:',
  '- OpenFC: flight controller (RP2350-based, runs Betaflight-compatible firmware)',
  '- OpenESC: 4-in-1 ESC (AM32 firmware)',
  '- OpenFrame: carbon-fibre FPV frames',
  '- OpenRx: ExpressLRS receiver',
  '- OpenStack: pre-built bundle of the above',
  '',
  'Every hardware design is published at github.com/Just4Stan under CERN-OHL-S-2.0.',
  '',
  'How you reply:',
  '- Concise. Technical. No marketing fluff.',
  '- Assume the user knows FPV basics but is new to our hardware specifically.',
  '- When you don\'t know, say so — staff will take over.',
  '- Never promise a timeline, a refund, a warranty decision, a firmware fix, or stock availability. Flag those to human staff explicitly ("I\'ll flag this to the team — they\'ll confirm").',
  '- Never invent a part number, spec, or URL. If you aren\'t sure, don\'t make one up.',
  '- Reply in the user\'s language (English / Dutch / French). Default English if unclear.',
  '',
  'Format: plain text, 1-3 short paragraphs, no Markdown headings. Keep under 200 words.',
  '',
  'You are drafting a reply for a human moderator to review. They will ✅ if the draft is shippable, edit it, or ignore it. Do not apologise for being an AI or include disclaimers; the moderator handles presentation.',
].join('\n');

// Minimal shape required from the env. Oxygen's Env interface has many
// more keys; TypeScript will accept the wider type here as long as
// these three fields match. All optional so tests can pass in a stub.
export type AiDraftEnv = {
  readonly ANTHROPIC_API_KEY?: string;
  readonly SUPPORT_AI_DRAFTS_ENABLED?: string;
  readonly SUPPORT_AI_MODEL?: string;
};

export function aiDraftsEnabled(env: AiDraftEnv): boolean {
  return env.SUPPORT_AI_DRAFTS_ENABLED === '1' && !!env.ANTHROPIC_API_KEY;
}

export type DraftInput = {
  subject: string;
  message: string;
  customerFirstName: string;
};

export type DraftResult =
  | {ok: true; text: string; modelUsed: string}
  | {ok: false; reason: string};

// Calls Anthropic's Messages API with prompt caching on the system
// prompt. Returns the drafted reply text ready to post to Discord.
export async function generateDraft(
  env: AiDraftEnv,
  input: DraftInput,
): Promise<DraftResult> {
  if (!aiDraftsEnabled(env)) {
    return {ok: false, reason: 'disabled'};
  }
  const apiKey = env.ANTHROPIC_API_KEY as string;
  const model = env.SUPPORT_AI_MODEL?.trim() || DEFAULT_MODEL;

  // Bound the user-controlled portion so a pathological input can't run
  // away with tokens. The scrubber has already stripped credentials and
  // control chars before this function is called.
  const userBlock = [
    `Customer first name: ${input.customerFirstName.slice(0, 80)}`,
    `Ticket subject: ${input.subject.slice(0, 240)}`,
    '',
    'Ticket message:',
    input.message.slice(0, 3000),
    '',
    'Draft a reply the moderator can ✅ as-is.',
  ].join('\n');

  const body = {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT_STATIC,
        cache_control: {type: 'ephemeral'},
      },
    ],
    messages: [{role: 'user', content: userBlock}],
  };

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        '[support] anthropic API error',
        res.status,
        text.slice(0, 160),
      );
      return {ok: false, reason: `anthropic-${res.status}`};
    }
    const json = (await res.json()) as {
      content?: Array<{type: string; text?: string}>;
      stop_reason?: string;
      model?: string;
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text as string)
      .join('\n')
      .trim();
    if (!text) {
      return {ok: false, reason: 'empty-response'};
    }
    return {ok: true, text, modelUsed: json.model ?? model};
  } catch (err) {
    console.warn(
      '[support] anthropic call failed',
      err instanceof Error ? err.name : 'unknown',
    );
    return {ok: false, reason: 'network-exception'};
  }
}

// Formats the drafted reply for posting to Discord. Keeps the
// AI_DRAFT_PREFIX so the poll route can identify bot-authored drafts
// that are eligible to surface (after approval) vs the bot's own
// thread-starter body which must never surface.
export function formatDraftForDiscord(text: string): string {
  // Discord has a 2000-char cap per message.
  const body = text.length > 1800 ? text.slice(0, 1800) + '…' : text;
  return `${AI_DRAFT_PREFIX}\n${body}`;
}

// ---------- Stage 5: thread summariser -------------------------------

export type SummaryInput = {
  subject: string;
  // Messages in chronological order. Each includes an author label (first
  // name or "OpenDrone"), whether it's from the customer, and the body.
  messages: Array<{
    author: string;
    isCustomer: boolean;
    content: string;
  }>;
  customerFirstName: string;
};

const SUMMARY_SYSTEM_PROMPT = [
  'You are summarising an OpenDrone support thread so the customer can read one clean recap instead of scrolling the full back-and-forth.',
  '',
  'Write the recap AS the support team, second-person to the customer. Example opening: "Here\'s where we are on your ticket:". No meta commentary, no "the assistant says" narration.',
  '',
  'What to keep:',
  '- The customer\'s original issue in one line.',
  '- Every resolution / workaround proposed so far.',
  '- Open questions they still need to answer.',
  '- Any firmware versions, SKUs, part numbers, RMA ids that came up.',
  '',
  'What to drop: pleasantries, typing indicators, duplicate questions, off-topic side chats.',
  '',
  'Format: 2-5 short paragraphs or a tight bullet list. Under 300 words. Plain text, no Markdown headings.',
  '',
  'If there is nothing substantive to summarise yet (e.g. the customer just opened the ticket and nobody has replied), say so in one sentence and stop.',
].join('\n');

// Builds a single-message recap of a long thread and returns it ready
// to post to Discord. Fails-safe the same way generateDraft does: any
// upstream or config failure returns a reason-tagged result and the
// poll loop simply doesn't post a summary this cycle.
export async function generateSummary(
  env: AiDraftEnv,
  input: SummaryInput,
): Promise<DraftResult> {
  if (!aiDraftsEnabled(env)) return {ok: false, reason: 'disabled'};
  const apiKey = env.ANTHROPIC_API_KEY as string;
  const model = env.SUPPORT_AI_MODEL?.trim() || DEFAULT_MODEL;

  // Flatten the thread for the prompt. Keep each line bounded so a
  // runaway message doesn't eat the context window.
  const flat = input.messages
    .map((m) => {
      const who = m.isCustomer ? `Customer (${m.author})` : m.author;
      const body = m.content.replace(/\s+/g, ' ').slice(0, 800);
      return `[${who}] ${body}`;
    })
    .join('\n')
    .slice(0, 14_000);

  const userBlock = [
    `Subject: ${input.subject.slice(0, 240)}`,
    `Customer first name: ${input.customerFirstName.slice(0, 80)}`,
    '',
    'Thread so far:',
    flat,
    '',
    'Write the recap.',
  ].join('\n');

  const body = {
    model,
    max_tokens: 800,
    system: [
      {
        type: 'text',
        text: SUMMARY_SYSTEM_PROMPT,
        cache_control: {type: 'ephemeral'},
      },
    ],
    messages: [{role: 'user', content: userBlock}],
  };

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        '[support] anthropic summary error',
        res.status,
        text.slice(0, 160),
      );
      return {ok: false, reason: `anthropic-${res.status}`};
    }
    const json = (await res.json()) as {
      content?: Array<{type: string; text?: string}>;
      model?: string;
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text as string)
      .join('\n')
      .trim();
    if (!text) return {ok: false, reason: 'empty-response'};
    return {ok: true, text, modelUsed: json.model ?? model};
  } catch (err) {
    console.warn(
      '[support] anthropic summary crashed',
      err instanceof Error ? err.name : 'unknown',
    );
    return {ok: false, reason: 'network-exception'};
  }
}

// Formats a summary for posting to Discord. The "up to msg_id=<id>"
// marker in the header is a structured cursor: on the next poll, the
// Worker reads it to decide whether the summary is stale (newer
// non-bot messages exist) without needing any external state.
export function formatSummaryForDiscord(
  text: string,
  upToMessageId: string,
): string {
  const body = text.length > 1700 ? text.slice(0, 1700) + '…' : text;
  return `${AI_SUMMARY_PREFIX} up to msg_id=${upToMessageId}:**\n${body}`;
}

// Reads the "up to msg_id=<id>" cursor out of a summary message body.
// Returns null if the input isn't a summary or the marker is missing.
export function parseSummaryCursor(content: string): string | null {
  if (!content.startsWith(AI_SUMMARY_PREFIX)) return null;
  const m = content.match(/up to msg_id=([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}
