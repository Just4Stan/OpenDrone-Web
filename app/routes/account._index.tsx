import {
  Link,
  redirect,
  useFetcher,
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
import {CUSTOMER_NEWSLETTER_STATE_QUERY} from '~/graphql/customer-account/NewsletterStateQuery';
import {
  CUSTOMER_EMAIL_MARKETING_SUBSCRIBE_MUTATION,
  CUSTOMER_EMAIL_MARKETING_UNSUBSCRIBE_MUTATION,
} from '~/graphql/customer-account/NewsletterMutations';
import {buildSeoMeta} from '~/lib/seo';
import {countOpenForCustomer} from '~/lib/support/ticket-index';
import {Money, flattenConnection} from '@shopify/hydrogen';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';

// Dashboard that greets the signed-in customer with a time-aware hello,
// a quick preview of their last couple of orders, and the next actions
// that matter (join Discord, browse the catalog). Replaces the stock
// Hydrogen redirect-to-orders so the landing doesn't feel like an empty
// admin panel.

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('account.dash.meta_title') ?? 'Account',
    description:
      copyText('account.dash.meta_description') ??
      'Your OpenDrone dashboard: orders, addresses, profile.',
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

  // Recent orders, the support-prefill lookup, and newsletter consent are
  // independent; run them in parallel so the dashboard waits one
  // customerAccount round-trip, not three.
  const [recentOrders, prefillResult, newsletterResult] = await Promise.all([
    customerAccount
      .query(CUSTOMER_ORDERS_QUERY, {
        variables: {
          first: 3,
          language: customerAccount.i18n.language,
        },
      })
      .catch(() => null),
    customerAccount.query(SUPPORT_CUSTOMER_PREFILL_QUERY).catch(() => null),
    customerAccount.query(CUSTOMER_NEWSLETTER_STATE_QUERY).catch(() => null),
  ]);

  const orders = recentOrders?.data?.customer?.orders?.nodes ?? [];
  const newsletterSubscribed =
    newsletterResult?.data?.customer?.emailAddress?.marketingState ===
    'SUBSCRIBED';

  // Open ticket count for the support tile — needs the customer id from the
  // prefill query above, so this Redis read runs after. Fail open.
  let openTicketCount = 0;
  try {
    const cid = prefillResult?.data?.customer?.id;
    if (cid) openTicketCount = await countOpenForCustomer(context.env, cid);
  } catch {
    /* fail open — tile renders the no-tickets variant */
  }

  return {orders, justOnboarded, openTicketCount, newsletterSubscribed};
}

// Toggle the signed-in customer's email-marketing consent from the dashboard's
// newsletter card. Honours the footer's "manage it anytime in your account".
export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;
  await customerAccount.handleAuthStatus();

  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent !== 'subscribe' && intent !== 'unsubscribe') {
    return {
      ok: false,
      subscribed: null,
      error: copyText('account.dash.newsletter_error_unknown') ?? 'Unknown action.',
    };
  }

  // Our own fallback wording. The Customer Account API's own `userErrors`
  // messages come back from Shopify and are passed through untouched.
  const failed =
    copyText('account.dash.newsletter_error_failed') ?? 'Update failed.';

  try {
    if (intent === 'unsubscribe') {
      const {data, errors} = await customerAccount.mutate(
        CUSTOMER_EMAIL_MARKETING_UNSUBSCRIBE_MUTATION,
      );
      const payload = data?.customerEmailMarketingUnsubscribe;
      if (errors?.length || payload?.userErrors?.length) {
        throw new Error(
          payload?.userErrors?.[0]?.message ?? errors?.[0]?.message ?? failed,
        );
      }
      return {
        ok: true,
        subscribed:
          payload?.emailAddress?.marketingState === 'SUBSCRIBED',
        error: null,
      };
    }
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_EMAIL_MARKETING_SUBSCRIBE_MUTATION,
    );
    const payload = data?.customerEmailMarketingSubscribe;
    if (errors?.length || payload?.userErrors?.length) {
      throw new Error(
        payload?.userErrors?.[0]?.message ?? errors?.[0]?.message ?? failed,
      );
    }
    return {
      ok: true,
      subscribed: payload?.emailAddress?.marketingState === 'SUBSCRIBED',
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      subscribed: null,
      error: error instanceof Error ? error.message : failed,
    };
  }
}

export default function AccountIndex() {
  const {orders, justOnboarded, openTicketCount, newsletterSubscribed} =
    useLoaderData<typeof loader>();
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const [searchParams, setSearchParams] = useSearchParams();
  const firstName = customer.firstName?.trim();
  const email = customer.emailAddress?.emailAddress ?? '';
  const displayName =
    firstName ||
    email.split('@')[0] ||
    (copyText('account.dash.name_fallback') ?? 'there');
  const showWelcome = justOnboarded && searchParams.get('welcome') === '1';

  return (
    <div className="account-dashboard">
      {showWelcome ? (
        <div className="account-dashboard-nudge" role="status">
          <div>
            <Txt
              id="account.dash.nudge_eyebrow"
              as="p"
              className="account-dashboard-eyebrow-mono"
            />
            <Txt id="account.dash.nudge_body" as="p" />
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
            <Txt id="account.dash.nudge_dismiss" />
          </button>
        </div>
      ) : null}

      <header className="account-dashboard-hero">
        <Txt
          id={timeOfDayGreetingId()}
          as="p"
          className="account-dashboard-eyebrow"
        />
        <h2 className="account-dashboard-title">
          {displayName}
          <span>.</span>
        </h2>
      </header>

      <div className="account-dashboard-grid">
        <OrdersCard orders={orders} />
        <AddressCard customer={customer} />
        <NewsletterCard subscribed={newsletterSubscribed} />
        <SupportCard openCount={openTicketCount} />
        <CommunityCard />
        <BuildCard />
      </div>
    </div>
  );
}

function NewsletterCard({subscribed}: {subscribed: boolean}) {
  const fetcher = useFetcher<typeof action>();
  const pending = fetcher.state !== 'idle';
  // Reflect the optimistic/just-returned state, falling back to the loader.
  const isSubscribed =
    fetcher.data && fetcher.data.ok && fetcher.data.subscribed !== null
      ? fetcher.data.subscribed
      : subscribed;
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <section
      className={`account-dashboard-card account-dash-support${
        isSubscribed ? ' is-active' : ''
      }`}
    >
      <Txt
        id="account.dash.newsletter_eyebrow"
        as="p"
        className="account-dashboard-eyebrow-mono"
      />
      <Txt
        id="account.dash.newsletter_title"
        as="h3"
        className="account-dashboard-card-title"
      />
      <Txt
        id={
          isSubscribed
            ? 'account.dash.newsletter_lede_subscribed'
            : 'account.dash.newsletter_lede'
        }
        as="p"
        className="account-dashboard-card-lede"
      />
      <fetcher.Form method="post">
        <input
          type="hidden"
          name="intent"
          value={isSubscribed ? 'unsubscribe' : 'subscribe'}
        />
        <button
          type="submit"
          className="od-tile-link"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          <Txt
            id={
              pending
                ? 'account.dash.newsletter_saving'
                : isSubscribed
                  ? 'account.dash.newsletter_unsubscribe'
                  : 'account.dash.newsletter_subscribe'
            }
          />
        </button>
      </fetcher.Form>
      {error ? (
        <p
          role="alert"
          className="account-dashboard-card-lede"
          style={{color: 'var(--color-text)', marginTop: '0.5rem'}}
        >
          {error}
        </p>
      ) : null}
    </section>
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
      <Txt
        id={
          isActive
            ? 'account.dash.support_eyebrow_active'
            : 'account.dash.support_eyebrow'
        }
        as="p"
        className="account-dashboard-eyebrow-mono"
      />
      <Txt
        id="account.dash.support_title"
        as="h3"
        className="account-dashboard-card-title"
      />
      {isActive ? (
        <span className="od-count">
          {openCount}
          <Txt
            id={
              openCount === 1
                ? 'account.dash.support_count_one'
                : 'account.dash.support_count_many'
            }
            className="od-count-label"
          />
        </span>
      ) : (
        <Txt
          id="account.dash.support_empty"
          as="p"
          className="account-dashboard-card-lede"
        />
      )}
      <div className="account-dashboard-card-actions">
        <Link prefetch="viewport" to="/support" className="account-dashboard-cta">
          <Txt id="account.dash.support_cta" />
        </Link>
        <Link
          prefetch="viewport"
          to="/account/support"
          className="account-dashboard-card-link"
        >
          <Txt id="account.dash.support_history" />
        </Link>
      </div>
    </section>
  );
}

/** Which of the three greetings the clock calls for. Wording is copy. */
function timeOfDayGreetingId(): string {
  const h = new Date().getHours();
  if (h < 12) return 'account.dash.greeting_morning';
  if (h < 18) return 'account.dash.greeting_afternoon';
  return 'account.dash.greeting_evening';
}

function OrdersCard({orders}: {orders: OrderItemFragment[]}) {
  return (
    <section className="account-dashboard-card">
      <header className="account-dashboard-card-head">
        <Txt
          id="account.dash.orders_eyebrow"
          as="p"
          className="account-dashboard-eyebrow-mono"
        />
        <Link prefetch="viewport" to="/account/orders" className="account-dashboard-card-link">
          <Txt id="account.dash.orders_view_all" />
        </Link>
      </header>
      {orders.length ? (
        <ul className="account-dashboard-orders">
          {orders.slice(0, 3).map((order) => {
            const fulfillment =
              flattenConnection(order.fulfillments)[0]?.status ?? null;
            return (
              <li key={order.id} className="account-dashboard-order">
                <Link prefetch="viewport" to={`/account/orders/${btoa(order.id)}`}>
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
          <Txt id="account.dash.orders_empty" as="p" />
          <Link prefetch="viewport" to="/collections/all" className="account-dashboard-cta">
            <Txt id="account.dash.orders_empty_cta" />
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
        <Txt
          id="account.dash.address_eyebrow"
          as="p"
          className="account-dashboard-eyebrow-mono"
        />
        <Link prefetch="viewport" to="/account/addresses" className="account-dashboard-card-link">
          <Txt id="account.dash.address_manage" />
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
          <Txt id="account.dash.address_empty" as="p" />
          <Link prefetch="viewport" to="/account/addresses" className="account-dashboard-cta">
            <Txt id="account.dash.address_empty_cta" />
          </Link>
        </div>
      )}
    </section>
  );
}

function CommunityCard() {
  return (
    <section className="account-dashboard-card account-dashboard-card-accent">
      <Txt
        id="account.dash.community_eyebrow"
        as="p"
        className="account-dashboard-eyebrow-mono"
      />
      <Txt
        id="account.dash.community_title"
        as="h3"
        className="account-dashboard-card-title"
      />
      <Txt
        id="account.dash.community_lede"
        as="p"
        className="account-dashboard-card-lede"
      />
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="account-dashboard-cta"
      >
        <Txt id="account.dash.community_cta" />
      </a>
    </section>
  );
}

function BuildCard() {
  return (
    <section className="account-dashboard-card">
      <Txt
        id="account.dash.build_eyebrow"
        as="p"
        className="account-dashboard-eyebrow-mono"
      />
      <Txt
        id="account.dash.build_title"
        as="h3"
        className="account-dashboard-card-title"
      />
      <Txt
        id="account.dash.build_lede"
        as="p"
        className="account-dashboard-card-lede"
      />
      <a
        href="https://github.com/OpenDrone-hw"
        target="_blank"
        rel="noreferrer noopener"
        className="account-dashboard-cta"
      >
        <Txt id="account.dash.build_cta" />
      </a>
    </section>
  );
}


