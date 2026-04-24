import {
  data as remixData,
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import type {Route} from './+types/account.welcome';
import type {CustomerFragment} from 'customer-accountapi.generated';
import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {buildSeoMeta} from '~/lib/seo';

// First-login onboarding. When a visitor signs in via Shopify Customer
// Accounts for the first time, `firstName` is empty on the customer
// record; /account/_index redirects them here so we can capture a name
// and give the flight-school opening instead of dropping them into an
// empty orders table. Subsequent visits skip this route entirely.

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Welcome',
    description: 'Finish setting up your OpenDrone account.',
    robots: 'noindex,nofollow',
  });

export async function loader({context}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();
  return {};
}

type ActionResult = {error: string | null};

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;
  if (request.method !== 'POST') {
    return remixData<ActionResult>({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();
  const firstName = String(form.get('firstName') ?? '').trim().slice(0, 80);
  const lastName = String(form.get('lastName') ?? '').trim().slice(0, 80);

  if (!firstName) {
    return remixData<ActionResult>(
      {error: "Let's start with your first name."},
      {status: 400},
    );
  }

  try {
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer: {
            firstName,
            ...(lastName ? {lastName} : {}),
          },
          language: customerAccount.i18n.language,
        },
      },
    );
    if (errors?.length) throw new Error(errors[0].message);
    if (!data?.customerUpdate?.customer) {
      throw new Error('Customer update failed.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed.';
    return remixData<ActionResult>({error: message}, {status: 400});
  }

  return redirect('/account?welcome=1');
}

export default function AccountWelcome() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {state} = useNavigation();
  const action = useActionData<ActionResult>();
  const busy = state !== 'idle';
  const email = customer.emailAddress?.emailAddress ?? '';

  return (
    <div className="account-welcome">
      <div className="account-welcome-hero">
        <p className="account-welcome-eyebrow">Pre-flight checks</p>
        <h2 className="account-welcome-title">
          Welcome to OpenDrone<span>.</span>
        </h2>
        <p className="account-welcome-lede">
          You&rsquo;re signed in as <strong>{email}</strong>. Give us a name
          to put on your orders and we&rsquo;re done — no password to
          remember, no account to manage.
        </p>
      </div>

      <Form method="POST" className="account-form account-welcome-form">
        <fieldset className="account-form-grid">
          <legend>Your name</legend>
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            minLength={1}
            maxLength={80}
            placeholder="Stan"
            disabled={busy}
          />
          <label htmlFor="lastName">Last name (optional)</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            maxLength={80}
            placeholder="Coene"
            disabled={busy}
          />
        </fieldset>

        {action?.error ? (
          <p className="account-welcome-error" role="alert">
            {action.error}
          </p>
        ) : null}

        <div className="account-welcome-actions">
          <button
            className="account-button"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save & continue'}
          </button>
        </div>
      </Form>

      <aside className="account-welcome-aside">
        <p className="account-welcome-eyebrow">While you&rsquo;re here</p>
        <p className="account-welcome-aside-lede">
          The build logs, flight tests, and release threads all happen on
          Discord. That&rsquo;s where the community is.
        </p>
        <a
          className="account-welcome-cta"
          href="https://discord.gg/ABajnacUsS"
          target="_blank"
          rel="noreferrer noopener"
        >
          Join the Discord →
        </a>
        <Link className="account-welcome-link" to="/collections/all">
          Browse the catalog →
        </Link>
      </aside>
    </div>
  );
}
