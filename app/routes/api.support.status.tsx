import {data} from 'react-router';
import type {Route} from './+types/api.support.status';
import {readSupportCookie, verifyTicket} from '~/lib/support/session';

type StatusResult =
  | {ok: true; active: false}
  | {
      ok: true;
      active: true;
      name: string;
      email: string;
      createdAt: number;
      pid?: string;
    };

export async function loader({request, context}: Route.LoaderArgs) {
  const cookie = readSupportCookie(request);
  const ticket = await verifyTicket(context.env, cookie);
  if (!ticket) {
    return data<StatusResult>(
      {ok: true, active: false},
      {headers: {'Cache-Control': 'no-store'}},
    );
  }
  return data<StatusResult>(
    {
      ok: true,
      active: true,
      name: ticket.name,
      email: ticket.email,
      createdAt: ticket.createdAt,
      pid: ticket.pid,
    },
    {headers: {'Cache-Control': 'no-store'}},
  );
}
