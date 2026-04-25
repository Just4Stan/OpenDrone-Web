import {data} from 'react-router';
import type {Route} from './+types/api.support.close';
import {postToThread} from '~/lib/support/discord';
import {
  buildSupportSetCookie,
  readSupportCookie,
  verifyTicket,
} from '~/lib/support/session';
import {closeTicket} from '~/lib/support/ticket-index';

type CloseResult = {ok: true} | {ok: false; message: string};

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<CloseResult>(
      {ok: false, message: 'Method not allowed.'},
      {status: 405},
    );
  }
  const env = context.env;
  const cookie = readSupportCookie(request);
  const ticket = await verifyTicket(env, cookie);
  if (ticket) {
    // Mark closed + post a staff-visible close marker. The Discord
    // thread itself is left in place for a 1-day grace period so the
    // customer can re-open from /account/support if they had buyer's
    // remorse on hitting END TICKET. The daily cleanup cron
    // (/api/support/cleanup) deletes closed threads after 24 h.
    await Promise.all([
      closeTicket(env, ticket.tid).catch((err) =>
        console.warn('[support/close] index update failed', err),
      ),
      postToThread(
        env,
        ticket.tid,
        `_${ticket.name} ended the web-support session._`,
      ).catch(() => null),
    ]);
  }
  return data<CloseResult>(
    {ok: true},
    {headers: {'Set-Cookie': buildSupportSetCookie('', {clear: true})}},
  );
}

export function loader() {
  return new Response(null, {status: 404});
}
