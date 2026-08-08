import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/account';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {buildSeoMeta} from '~/lib/seo';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('account.meta_title') ?? 'Account',
    description:
      copyText('account.meta_description') ??
      'Manage your OpenDrone customer account, orders, profile, and addresses.',
    robots: 'noindex,nofollow',
  });

export function shouldRevalidate() {
  return true;
}

export async function loader({context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  await customerAccount.handleAuthStatus();

  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Response('Customer not found', {status: 404});
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  return (
    <div className="account page-shell">
      <AccountMenu />
      <section className="account-panel">
        <Outlet context={{customer}} />
      </section>
    </div>
  );
}

function AccountMenu() {
  function isActiveStyle({
    isActive,
    isPending,
  }: {
    isActive: boolean;
    isPending: boolean;
  }) {
    return {
      fontWeight: isActive ? 'bold' : undefined,
      color: isPending ? 'var(--color-text-muted)' : 'var(--color-text)',
    };
  }

  return (
    <nav
      className="account-nav"
      role="navigation"
      aria-label={copyText('account.nav.aria') ?? 'Account'}
    >
      <NavLink prefetch="viewport" className="account-nav-link" to="/account/orders" style={isActiveStyle}>
        <Txt id="account.nav.orders" />
      </NavLink>
      <NavLink prefetch="viewport" className="account-nav-link" to="/account/profile" style={isActiveStyle}>
        <Txt id="account.nav.profile" />
      </NavLink>
      <NavLink prefetch="viewport" className="account-nav-link" to="/account/addresses" style={isActiveStyle}>
        <Txt id="account.nav.addresses" />
      </NavLink>
      <NavLink prefetch="viewport" className="account-nav-link" to="/account/support" style={isActiveStyle}>
        <Txt id="account.nav.support" />
      </NavLink>
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <button className="account-button account-button-secondary" type="submit">
        <Txt id="account.nav.signout" />
      </button>
    </Form>
  );
}
