import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import type {Route} from './+types/account.profile';
import type {HeadersFunction} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

// Customer PII rendered into HTML — never let an intermediate cache or
// bfcache hold this. React Router v7 only honours leaf-route headers on
// data requests during navigation, so each authenticated leaf must
// declare its own Cache-Control even if the parent already does.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'private, no-store',
});

export type ActionResponse = {
  error: string | null;
  customer: CustomerFragment | null;
};

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('account.profile.meta_title') ?? 'Profile',
    description:
      copyText('account.profile.meta_description') ??
      'Update your OpenDrone account profile details.',
    robots: 'noindex,nofollow',
  });

export async function loader({context}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data(
      {error: copyText('account.profile.error_method') ?? 'Method not allowed'},
      {status: 405},
    );
  }

  const form = await request.formData();

  try {
    const customer: CustomerUpdateInput = {};
    const validInputKeys = ['firstName', 'lastName'] as const;
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key as any)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customer[key as (typeof validInputKeys)[number]] = value;
      }
    }

    // update customer and possibly password
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (!data?.customerUpdate?.customer) {
      throw new Error(
        copyText('account.profile.error_update') ??
          'Customer profile update failed.',
      );
    }

    return {
      error: null,
      customer: data?.customerUpdate?.customer,
    };
  } catch (error: any) {
    return data(
      {error: error.message, customer: null},
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext<{customer: CustomerFragment}>();
  const {state} = useNavigation();
  const action = useActionData<ActionResponse>();
  const customer = action?.customer ?? account?.customer;

  return (
    <div className="account-profile">
      <header className="account-section-header">
        <Txt id="account.profile.title" as="h2" />
        <Txt id="account.profile.lede" as="p" />
      </header>
      <Form className="account-form" method="PUT">
        <fieldset className="account-form-grid">
          <Txt id="account.profile.legend" as="legend" />
          <Txt
            id="account.profile.first_name_label"
            as="label"
            htmlFor="firstName"
          />
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder={copyText('account.profile.first_name_placeholder')}
            aria-label={copyText('account.profile.first_name_aria')}
            defaultValue={customer.firstName ?? ''}
            minLength={2}
          />
          <Txt
            id="account.profile.last_name_label"
            as="label"
            htmlFor="lastName"
          />
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder={copyText('account.profile.last_name_placeholder')}
            aria-label={copyText('account.profile.last_name_aria')}
            defaultValue={customer.lastName ?? ''}
            minLength={2}
          />
        </fieldset>
        {action?.error ? (
          <p>
            <mark>
              <small>{action.error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        <button className="account-button" type="submit" disabled={state !== 'idle'}>
          <Txt
            id={
              state !== 'idle'
                ? 'account.profile.submit_busy'
                : 'account.profile.submit'
            }
          />
        </button>
      </Form>
    </div>
  );
}
