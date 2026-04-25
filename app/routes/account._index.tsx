import {
  Link,
  redirect,
  useLoaderData,
  useOutletContext,
  useSearchParams,
  type HeadersFunction,
} from 'react-router';
import type {Route} from './+types/account._index';

// Account dashboard PII — block intermediate + bfcache.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'private, no-store',
});
import type {
  CustomerFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {buildSeoMeta} from '~/lib/seo';
import {countOpenForCustomer} from '~/lib/support/ticket-index';
import {Money, flattenConnection} from '@shopify/hydrogen';

// Dashboard that greets the signed-in customer with a time-aware hello,
// a quick preview of their last couple of orders, and the next actions
// that matter (join Discord, browse the catalog). Replaces the stock
// Hydrogen redirect-to-orders so the landing doesn't feel like an empty
// admin panel.

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Account',
    description: 'Your OpenDrone dashboard — orders, addresses, profile.',
    robots: 'noindex,nofollow',
  });

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  await customerAccount.handleAuthStatus();

  // First-login bounce: when the customer signed in for the first time
  // Shopify returns firstName=null. Send them to /account/welcome to
  // capture a name once, then let them land on this dashboard on every
  // subsequent visit. The `?welcome=1` flag on return lets us flash a
  // confirmation banner without re-prompting.
  const url = new URL(request.url);
  const justOnboarded = url.searchParams.get('welcome') === '1';
  if (!justOnboarded) {
    const details = await customerAccount
      .query(CUSTOMER_DETAILS_QUERY, {
        variables: {language: customerAccount.i18n.language},
      })
      .catch(() => null);
    const firstName = details?.data?.customer?.firstName?.trim();
    if (!firstName) {
      throw redirect('/account/welcome');
    }
  }

  const recentOrders = await customerAccount
    .query(CUSTOMER_ORDERS_QUERY, {
      variables: {
        first: 3,
        language: customerAccount.i18n.language,
      },
    })
    .catch(() => null);

  const orders = recentOrders?.data?.customer?.orders?.nodes ?? [];

  // Open ticket count for the support tile. Customer ID lookup is a
  // second cheap GraphQL roundtrip but we already fetched details
  // above; reuse-by-extra-query keeps this isolated and avoids
  // touching the existing CUSTOMER_DETAILS_QUERY shape.
  let openTicketCount = 0;
  try {
    const {data: prefill} = await customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    const cid = prefill?.customer?.id;
    if (cid) openTicketCount = await countOpenForCustomer(context.env, cid);
  } catch {
    /* fail open — tile renders the no-tickets variant */
  }

  return {orders, justOnboarded, openTicketCount};
}

export default function AccountIndex() {
  const {orders, justOnboarded, openTicketCount} = useLoaderData<typeof loader>();
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const [searchParams, setSearchParams] = useSearchParams();
  const firstName = customer.firstName?.trim();
  const email = customer.emailAddress?.emailAddress ?? '';
  const displayName = firstName || email.split('@')[0] || 'there';
  const showWelcome = justOnboarded && searchParams.get('welcome') === '1';

  return (
    <div className="account-dashboard">
      {showWelcome ? (
        <div className="account-dashboard-nudge" role="status">
          <div>
            <p className="account-dashboard-eyebrow-mono">You&rsquo;re all set</p>
            <p>
              Account created. Orders, addresses, and build notes show up
              here as you go.
            </p>
          </div>
          <button
            type="button"
            className="account-dashboard-card-link"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('welcome');
              setSearchParams(next, {replace: true});
            }}
          >
            Dismiss ×
          </button>
        </div>
      ) : null}

      <header className="account-dashboard-hero">
        <p className="account-dashboard-eyebrow">{timeOfDayGreeting()}</p>
        <h2 className="account-dashboard-title">
          {displayName}
          <span>.</span>
        </h2>
        <p className="account-dashboard-lede">
          Good to have you back. Pick up where you left off, or start
          something new.
        </p>
      </header>

      <div className="account-dashboard-grid">
        <OrdersCard orders={orders} />
        <AddressCard customer={customer} />
        <SupportCard openCount={openTicketCount} />
        <CommunityCard />
        <BuildCard />
      </div>
    </div>
  );
}

function SupportCard({openCount}: {openCount: number}) {
  const isActive = openCount > 0;
  return (
    <section
      className={`account-dashboard-card account-dash-support${
        isActive ? ' is-active' : ''
      }`}
    >
      <p className="account-dashboard-eyebrow-mono">
        {isActive ? '→ SUPPORT · ACTIVE' : '→ SUPPORT'}
      </p>
      <h3 className="account-dashboard-card-title">Support</h3>
      {isActive ? (
        <span className="od-count">
          {openCount}
          <span className="od-count-label">
            {openCount === 1 ? 'OPEN TICKET' : 'OPEN TICKETS'}
          </span>
        </span>
      ) : (
        <p className="account-dashboard-card-lede">
          No open tickets — need help?
        </p>
      )}
      <Link
        to={isActive ? '/account/support' : '/support'}
        className="od-tile-link"
      >
        {isActive ? 'Continue thread →' : 'Open a ticket →'}
      </Link>
    </section>
  );
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil,';
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function OrdersCard({orders}: {orders: OrderItemFragment[]}) {
  return (
    <section className="account-dashboard-card">
      <header className="account-dashboard-card-head">
        <p className="account-dashboard-eyebrow-mono">Orders</p>
        <Link to="/account/orders" className="account-dashboard-card-link">
          View all →
        </Link>
      </header>
      {orders.length ? (
        <ul className="account-dashboard-orders">
          {orders.slice(0, 3).map((order) => {
            const fulfillment =
              flattenConnection(order.fulfillments)[0]?.status ?? null;
            return (
              <li key={order.id} className="account-dashboard-order">
                <Link to={`/account/orders/${btoa(order.id)}`}>
                  <div className="account-dashboard-order-head">
                    <span className="account-dashboard-order-number">
                      #{order.number}
                    </span>
                    <Money data={order.totalPrice} />
                  </div>
                  <div className="account-dashboard-order-meta">
                    <time dateTime={order.processedAt}>
                      {new Date(order.processedAt).toLocaleDateString(
                        'en-GB',
                        {day: '2-digit', month: 'short', year: 'numeric'},
                      )}
                    </time>
                    {fulfillment ? <span>· {fulfillment.toLowerCase()}</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="account-dashboard-empty">
          <p>No orders yet.</p>
          <Link to="/collections/all" className="account-dashboard-cta">
            Browse the catalog →
          </Link>
        </div>
      )}
    </section>
  );
}

function AddressCard({customer}: {customer: CustomerFragment}) {
  const addr = customer.defaultAddress;
  return (
    <section className="account-dashboard-card">
      <header className="account-dashboard-card-head">
        <p className="account-dashboard-eyebrow-mono">Default address</p>
        <Link to="/account/addresses" className="account-dashboard-card-link">
          Manage →
        </Link>
      </header>
      {addr ? (
        <address className="account-dashboard-address">
          {addr.formatted?.map((line, i) => (
            <span key={`${line}-${i}`}>{line}</span>
          ))}
        </address>
      ) : (
        <div className="account-dashboard-empty">
          <p>No shipping address yet.</p>
          <Link to="/account/addresses" className="account-dashboard-cta">
            Add an address →
          </Link>
        </div>
      )}
    </section>
  );
}

function CommunityCard() {
  return (
    <section className="account-dashboard-card account-dashboard-card-accent">
      <p className="account-dashboard-eyebrow-mono">Community</p>
      <h3 className="account-dashboard-card-title">
        The work happens on Discord.
      </h3>
      <p className="account-dashboard-card-lede">
        Firmware help, build logs, release threads. Same engineers who
        designed the boards answer there.
      </p>
      <a
        href="https://discord.gg/ABajnacUsS"
        target="_blank"
        rel="noreferrer noopener"
        className="account-dashboard-cta"
      >
        Open Discord →
      </a>
    </section>
  );
}

function BuildCard() {
  return (
    <section className="account-dashboard-card">
      <p className="account-dashboard-eyebrow-mono">Open source</p>
      <h3 className="account-dashboard-card-title">Every board, on GitHub.</h3>
      <p className="account-dashboard-card-lede">
        Schematics, firmware, Gerbers. Fork your own, submit a PR, or just
        read along to understand what&rsquo;s flying in your drone.
      </p>
      <a
        href="https://github.com/Just4Stan"
        target="_blank"
        rel="noreferrer noopener"
        className="account-dashboard-cta"
      >
        Browse the repos →
      </a>
    </section>
  );
}


