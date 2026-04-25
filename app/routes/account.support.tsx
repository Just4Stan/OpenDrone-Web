import {useEffect, useMemo, useState} from 'react';
import {Link, useLoaderData, type HeadersFunction} from 'react-router';
import type {Route} from './+types/account.support';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {readSupportCookie, verifyTicket} from '~/lib/support/session';
import {listByCustomer, type TicketIndexEntry} from '~/lib/support/ticket-index';
import {SupportThread, type ThreadMessage} from '~/components/SupportThread';
import {buildSeoMeta} from '~/lib/seo';

export const headers: HeadersFunction = () => ({
  'Cache-Control': 'private, no-store',
});

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Support tickets',
    description: 'Your OpenDrone support history.',
    robots: 'noindex,nofollow',
  });

export async function loader({request, context}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();
  const env = context.env;

  let customerId: string | null = null;
  let customerName = 'You';
  try {
    const {data} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    const c = data?.customer;
    customerId = c?.id ?? null;
    if (c) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      if (name) customerName = name;
    }
  } catch {
    /* not signed in — handleAuthStatus will have redirected */
  }

  const cookie = readSupportCookie(request);
  const cookieTicket = await verifyTicket(env, cookie);
  const activeCookieTid = cookieTicket?.tid ?? null;
  const activeCookiePid = cookieTicket?.pid ?? null;

  const indexed: TicketIndexEntry[] = customerId
    ? await listByCustomer(env, customerId, {status: 'all', limit: 100})
    : [];

  // Without TICKETS_KV bound the customer index is empty even when a
  // live ticket exists in the cookie. Synthesise a single entry from
  // the cookie so the page reflects reality and the live thread is
  // reachable from the list.
  const tickets: TicketIndexEntry[] =
    indexed.length === 0 && cookieTicket
      ? [
          {
            tid: cookieTicket.tid,
            pid: cookieTicket.pid ?? '',
            subject: 'Support ticket',
            openedAt: cookieTicket.createdAt,
            closedAt: null,
            lastActivityAt: cookieTicket.createdAt,
            status: 'open' as const,
          },
        ]
      : indexed;

  return {
    tickets,
    customerName,
    activeCookieTid,
    activeCookiePid,
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function AccountSupportRoute() {
  const {tickets, customerName, activeCookiePid} =
    useLoaderData<typeof loader>() as LoaderData;

  const open = useMemo(
    () => tickets.filter((t) => t.status === 'open'),
    [tickets],
  );
  const resolved = useMemo(
    () => tickets.filter((t) => t.status === 'closed'),
    [tickets],
  );

  const initialPid =
    activeCookiePid ?? open[0]?.pid ?? resolved[0]?.pid ?? null;
  const [activePid, setActivePid] = useState<string | null>(initialPid);

  return (
    <div className="od-page-frame od-page-wide">
      <header className="od-page-head">
        <p className="od-eyebrow">ACCOUNT · SUPPORT</p>
        <h1>
          Your <em>support tickets</em>.
        </h1>
        <p>
          Open threads pinned at the top. Closed ones are kept for reference.
        </p>
      </header>

      {tickets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="account-support">
          <aside
            className="account-support-list"
            aria-label="Tickets"
          >
            <div className="account-support-list-head">
              <h3>Tickets</h3>
              <Link
                to="/support"
                className="od-btn od-btn-secondary od-btn-sm"
              >
                + New
              </Link>
            </div>

            {open.length > 0 ? (
              <div className="account-support-list-section">
                Open · {open.length}
              </div>
            ) : null}
            {open.map((t) => (
              <TicketRow
                key={t.tid}
                ticket={t}
                isActive={t.pid === activePid}
                onSelect={() => setActivePid(t.pid)}
              />
            ))}

            {resolved.length > 0 ? (
              <div className="account-support-list-section">
                Resolved · {resolved.length}
              </div>
            ) : null}
            {resolved.map((t) => (
              <TicketRow
                key={t.tid}
                ticket={t}
                isActive={t.pid === activePid}
                onSelect={() => setActivePid(t.pid)}
              />
            ))}
          </aside>

          <main className="account-support-detail">
            <DetailPane
              pid={activePid}
              ticket={tickets.find((t) => t.pid === activePid) ?? null}
              isCookieActive={activePid !== null && activePid === activeCookiePid}
              customerName={customerName}
            />
          </main>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="od-tile" style={{textAlign: 'center', padding: 48}}>
      <p className="od-tile-eyebrow" style={{color: 'var(--od-pcb-gold-2)'}}>
        → NO TICKETS YET
      </p>
      <h3>You haven&rsquo;t opened any tickets.</h3>
      <p>Need help? Open one and we&rsquo;ll thread it back to you here.</p>
      <Link to="/support" className="od-btn od-btn-primary">
        Open a ticket →
      </Link>
    </div>
  );
}

function TicketRow({
  ticket,
  isActive,
  onSelect,
}: {
  ticket: TicketIndexEntry;
  isActive: boolean;
  onSelect: () => void;
}) {
  const last = useMemo(
    () => relativeTime(ticket.lastActivityAt || ticket.openedAt),
    [ticket.lastActivityAt, ticket.openedAt],
  );
  const status = mapStatus(ticket);
  return (
    <button
      type="button"
      className={`account-ticket-row${isActive ? ' is-active' : ''}`}
      aria-label={`Open ticket ${ticket.subject}`}
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
    >
      <div className="od-row-top">
        <span className="od-subj">{ticket.subject || 'Untitled ticket'}</span>
        <span className="od-time">{last}</span>
      </div>
      <div className="od-row-bot">
        <StatusPill status={status} />
        <span className="od-pid">#{ticket.pid}</span>
      </div>
    </button>
  );
}

function StatusPill({
  status,
}: {
  status: 'open' | 'awaiting' | 'progress' | 'resolved';
}) {
  const map = {
    open: 'is-open',
    awaiting: 'is-awaiting',
    progress: 'is-progress',
    resolved: 'is-resolved',
  } as const;
  const label = {
    open: 'Open',
    awaiting: 'Awaiting',
    progress: 'In progress',
    resolved: 'Resolved',
  } as const;
  return (
    <span className={`od-status ${map[status]}`} role="status">
      {label[status]}
    </span>
  );
}

function DetailPane({
  pid,
  ticket,
  isCookieActive,
  customerName,
}: {
  pid: string | null;
  ticket: TicketIndexEntry | null;
  isCookieActive: boolean;
  customerName: string;
}) {
  if (!pid || !ticket) {
    return (
      <div className="account-support-empty">Pick a ticket on the left.</div>
    );
  }
  // The cookie-bound ticket (= the one currently in the live cookie)
  // gets the live <SupportThread mode="live">. Any other ticket gets a
  // read-only fetch via /api/support/thread/:pid.
  if (isCookieActive) {
    return (
      <SupportThread
        mode="live"
        embedded
        ticket={{
          pid: ticket.pid,
          subject: ticket.subject || 'Support ticket',
          status: mapStatus(ticket),
          customerName,
        }}
      />
    );
  }
  return <ReadOnlyThread pid={pid} customerName={customerName} ticket={ticket} />;
}

function ReadOnlyThread({
  pid,
  customerName,
  ticket,
}: {
  pid: string;
  customerName: string;
  ticket: TicketIndexEntry;
}) {
  const [state, setState] = useState<
    | {phase: 'loading'}
    | {phase: 'error'; message: string}
    | {phase: 'ready'; messages: ThreadMessage[]}
  >({phase: 'loading'});

  useEffect(() => {
    let cancelled = false;
    setState({phase: 'loading'});
    void (async () => {
      try {
        const res = await fetch(`/api/support/thread/${pid}`, {
          credentials: 'same-origin',
        });
        const json = (await res.json()) as
          | {ok: true; messages: ThreadMessage[]}
          | {ok: false; message: string};
        if (cancelled) return;
        if (!json.ok) {
          setState({phase: 'error', message: json.message});
          return;
        }
        setState({phase: 'ready', messages: json.messages});
      } catch (err) {
        if (cancelled) return;
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Could not load thread.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid]);

  if (state.phase === 'loading') {
    return <div className="account-support-empty">Loading thread…</div>;
  }
  if (state.phase === 'error') {
    return (
      <div className="account-support-empty">
        Could not load this thread. {state.message}
      </div>
    );
  }
  return (
    <SupportThread
      mode="readonly"
      embedded
      ticket={{
        pid: ticket.pid,
        subject: ticket.subject || 'Support ticket',
        status: mapStatus(ticket),
        customerName,
      }}
      initialMessages={state.messages}
    />
  );
}

function mapStatus(
  t: TicketIndexEntry,
): 'open' | 'awaiting' | 'progress' | 'resolved' {
  if (t.status === 'closed') return 'resolved';
  // No fine-grained "awaiting/progress" tracking yet — index has open|closed.
  // Treat all open tickets as plain "open" for now.
  return 'open';
}

function relativeTime(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 14) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
