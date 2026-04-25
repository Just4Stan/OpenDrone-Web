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
    await Promise.all([
      postToThread(
        env,
        ticket.tid,
        `_${ticket.name} ended the web-support session._`,
      ).catch(() => null),
      closeTicket(env, ticket.tid).catch((err) =>
        console.warn('[support/close] index update failed', err),
      ),
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
