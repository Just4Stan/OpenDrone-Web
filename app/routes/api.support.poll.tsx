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

export type PollMessage = {
  id: string;
  author: string;
  isStaff: boolean;
  content: string;
  createdAt: string;
  attachments: Array<{url: string; filename: string}>;
};

type PollResult =
  | {
      ok: true;
      messages: PollMessage[];
      closed: boolean;
    }
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

  // Hide the bot's own initial forum-post body (the "new web-support ticket"
  // block). Staff replies in a forum thread are regular messages; the first
  // post is surfaced as the thread starter with author = the bot. We filter
  // by bot flag and by "from the bot" identity.
  const filtered = messages.filter((m) => !m.author.bot);

  const normalized: PollMessage[] = filtered.map((m) => ({
    id: m.id,
    author: m.author.globalName || m.author.username,
    isStaff: true,
    content: m.content,
    createdAt: m.createdAt,
    attachments: m.attachments.map((a) => ({url: a.url, filename: a.filename})),
  }));

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
    {ok: true, messages: normalized, closed: thread.archived || thread.locked},
    {headers},
  );
}
