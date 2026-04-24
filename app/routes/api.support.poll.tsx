import {data} from 'react-router';
import type {Route} from './+types/api.support.poll';
import {fetchThreadMessages} from '~/lib/support/discord';
import {
  buildSupportSetCookie,
  readSupportCookie,
  signTicket,
  verifyTicket,
} from '~/lib/support/session';
import {checkRateLimit} from '~/lib/rate-limit';
import {
  extractFirstName,
  scrubForPublic,
  type PublicMessage,
} from '~/lib/support/scrubber';
import {filterByApproval} from '~/lib/support/moderation';

// Trust boundary between Discord and the customer's browser.
//
// Every Discord message passes through scrubForPublic() before it lands
// in the response. The browser only sees:
//   - a first name (safe because Discord display names are public),
//   - a role flag (helper | ai),
//   - scrubbed content,
//   - attachments already filtered at upload time.
//
// Everything else in the raw Discord payload (author.id, avatar hash,
// discriminator, global_name, guild_id, roles, embeds, components, …)
// is dropped here and never reaches JSON.stringify.

type PollResult =
  | {ok: true; messages: PublicMessage[]; closed: boolean}
  | {ok: false; message: string; code?: 'no-ticket' | 'thread-gone'};

export async function loader({request, context}: Route.LoaderArgs) {
  const env = context.env;
  const cookie = readSupportCookie(request);
  const ticket = await verifyTicket(env, cookie);

  if (!ticket) {
    return data<PollResult>(
      {ok: false, message: 'No active ticket.', code: 'no-ticket'},
      {status: 401},
    );
  }

  // Per-ticket poll cap. Widget polls every 4s active / 15s hidden, so
  // 30/min leaves a large margin; anything more is automation.
  const limit = checkRateLimit(`support-poll:${ticket.uid}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return data<PollResult>(
      {ok: false, message: 'Polling too fast.'},
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.resetInSeconds),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const url = new URL(request.url);
  // `?initial=1` ignores the cookie cursor so a returning/refreshed user
  // gets the recent thread history instead of just messages newer than
  // whatever the previous session last delivered.
  //
  // We intentionally do NOT honour an `?after=` query param: the cookie
  // cursor is the only authoritative forward-only position. Accepting a
  // client-supplied cursor would let a ticket holder rewind to re-read
  // older messages (e.g. contents they hoped were ephemeral) and replay
  // staff replies, so the cursor stays server-side.
  const initial = url.searchParams.get('initial') === '1';
  const after = initial ? undefined : ticket.lastCursor || undefined;

  const {messages, thread} = await fetchThreadMessages(env, ticket.tid, {
    afterId: after,
    limit: 50,
  });

  if (!thread) {
    return data<PollResult>(
      {ok: false, message: 'Ticket thread not found.', code: 'thread-gone'},
      {status: 410},
    );
  }

  // Moderation gate (Stage 2). Filter to approved messages before we
  // project into the public shape. Dropped messages are logged (reason
  // only, never content) so staff can watch the gate when tuning it.
  // The bot's own initial forum-post body is also filtered here so the
  // downstream projection loop doesn't have to special-case it.
  const candidates = messages.filter((m) => !m.author.bot);
  const filtered = await filterByApproval(env, candidates, ticket.tid);
  if (filtered.dropped.length > 0) {
    console.warn(
      '[support] moderation',
      filtered.mode,
      'dropped',
      filtered.dropped.length,
      filtered.dropped.map((d) => `${d.message.id}:${d.reason}`).join(','),
    );
  }

  // Project each raw Discord message into the public shape. A projection
  // that returns null (blocked by the scrubber, or empty after redaction)
  // is dropped from the response but still advances the cursor — otherwise
  // a single always-blocked message would loop forever.
  const projected: PublicMessage[] = [];
  for (const m of filtered.approved) {
    if (m.author.bot) continue; // defence-in-depth; filter already did this
    const scrubbed = scrubForPublic(m.content);
    if (scrubbed.blocked) {
      // Log the redaction reasons at warn level so staff can see the
      // Stage-2 moderation UI (once built) surface "this draft was
      // blocked by the scrubber" cleanly. Never log the raw content.
      console.warn(
        '[support] scrubber blocked message',
        m.id,
        scrubbed.reasons.join(','),
      );
      continue;
    }
    if (!scrubbed.content && !m.attachments.length) continue;
    projected.push({
      id: m.id,
      role: 'helper',
      firstName: extractFirstName([m.author.globalName, m.author.username]),
      content: scrubbed.content,
      createdAt: m.createdAt,
      attachments: m.attachments.map((a) => ({
        url: a.url,
        filename: a.filename,
      })),
    });
  }

  const newestId = messages.length ? messages[messages.length - 1].id : null;

  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
  };

  // Roll the cursor forward into the signed cookie so the next poll asks
  // only for what's newer than what we just delivered.
  if (newestId && newestId !== ticket.lastCursor) {
    const rolled = {...ticket, lastCursor: newestId};
    headers['Set-Cookie'] = buildSupportSetCookie(await signTicket(env, rolled));
  }

  return data<PollResult>(
    {ok: true, messages: projected, closed: thread.archived || thread.locked},
    {headers},
  );
}
