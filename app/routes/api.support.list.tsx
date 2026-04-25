import {data} from 'react-router';
import type {Route} from './+types/api.support.list';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {
  countOpenForCustomer,
  listByCustomer,
  type TicketIndexEntry,
  type TicketStatus,
} from '~/lib/support/ticket-index';

type ListResult =
  | {
      ok: true;
      tickets: TicketIndexEntry[];
      openCount: number;
    }
  | {ok: false; message: string; code?: 'signin-required'};

// Lists tickets for the currently signed-in customer. KV-fast: one
// indexed read per call. Falls back to an empty list when the Upstash
// store is unbound (tickets still exist in Discord; staff can find
// them via the forum, the customer-facing /account/support view just
// won't list them until storage is provisioned).
export async function loader({request, context}: Route.LoaderArgs) {
  const env = context.env;

  let customerId: string | null = null;
  try {
    const {data: prefill} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    customerId = prefill?.customer?.id ?? null;
  } catch {
    // not signed in
  }
  if (!customerId) {
    return data<ListResult>(
      {ok: false, message: 'Sign in to view tickets.', code: 'signin-required'},
      {status: 401, headers: {'Cache-Control': 'no-store'}},
    );
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') as
    | TicketStatus
    | 'all'
    | null;
  const status: TicketStatus | 'all' =
    statusParam === 'open' || statusParam === 'closed' || statusParam === 'all'
      ? statusParam
      : 'all';

  const [tickets, openCount] = await Promise.all([
    listByCustomer(env, customerId, {status, limit: 50}),
    countOpenForCustomer(env, customerId),
  ]);

  return data<ListResult>(
    {ok: true, tickets, openCount},
    {headers: {'Cache-Control': 'private, no-store'}},
  );
}
