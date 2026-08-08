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
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';

// First-login onboarding. When a visitor signs in via Shopify Customer
// Accounts for the first time, `firstName` is empty on the customer
// record; /account/_index redirects them here so we can capture a name
// and give the flight-school opening instead of dropping them into an
// empty orders table. Subsequent visits skip this route entirely.

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('account.welcome.meta_title') ?? 'Welcome',
    description:
      copyText('account.welcome.meta_description') ??
      'Finish setting up your OpenDrone account.',
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
    return remixData<ActionResult>(
      {error: copyText('account.welcome.error_method') ?? 'Method not allowed'},
      {status: 405},
    );
  }

  const form = await request.formData();
  const firstName = String(form.get('firstName') ?? '').trim().slice(0, 80);
  const lastName = String(form.get('lastName') ?? '').trim().slice(0, 80);

  if (!firstName) {
    return remixData<ActionResult>(
      {
        error:
          copyText('account.welcome.error_first_name') ??
          "Let's start with your first name.",
      },
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
      throw new Error(
        copyText('account.welcome.error_update') ?? 'Customer update failed.',
      );
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : (copyText('account.welcome.error_generic') ?? 'Update failed.');
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
        <Txt
          id="account.welcome.eyebrow"
          as="p"
          className="account-welcome-eyebrow"
        />
        <h2 className="account-welcome-title">
          <Txt id="account.welcome.title" />
          <span>.</span>
        </h2>
        <p className="account-welcome-lede">
          <Txt id="account.welcome.lede_before" /> <strong>{email}</strong>.{' '}
          <Txt id="account.welcome.lede_after" />
        </p>
      </div>

      <Form method="POST" className="account-form account-welcome-form">
        <fieldset className="account-form-grid">
          <Txt id="account.welcome.legend" as="legend" />
          <Txt id="account.welcome.first_name_label" as="label" htmlFor="firstName" />
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            minLength={1}
            maxLength={80}
            placeholder={copyText('account.welcome.first_name_placeholder')}
            disabled={busy}
          />
          <Txt id="account.welcome.last_name_label" as="label" htmlFor="lastName" />
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            maxLength={80}
            placeholder={copyText('account.welcome.last_name_placeholder')}
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
            <Txt
              id={
                busy
                  ? 'account.welcome.submit_busy'
                  : 'account.welcome.submit'
              }
            />
          </button>
        </div>
      </Form>

      <aside className="account-welcome-aside">
        <Txt
          id="account.welcome.aside_eyebrow"
          as="p"
          className="account-welcome-eyebrow"
        />
        <Txt
          id="account.welcome.aside_lede"
          as="p"
          className="account-welcome-aside-lede"
        />
        <a
          className="account-welcome-cta"
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Txt id="account.welcome.aside_cta" />
        </a>
        <Link prefetch="viewport" className="account-welcome-link" to="/collections/all">
          <Txt id="account.welcome.aside_link" />
        </Link>
      </aside>
    </div>
  );
}
