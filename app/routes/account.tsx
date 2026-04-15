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

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Account',
    description: 'Manage your OpenDrone customer account, orders, profile, and addresses.',
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

  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <div className="account page-shell">
      <header className="page-header">
        <p className="page-eyebrow">Customer account</p>
        <h1 className="page-title">{heading}</h1>
      </header>
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
    <nav className="account-nav" role="navigation" aria-label="Account">
      <NavLink className="account-nav-link" to="/account/orders" style={isActiveStyle}>
        Orders
      </NavLink>
      <NavLink className="account-nav-link" to="/account/profile" style={isActiveStyle}>
        Profile
      </NavLink>
      <NavLink className="account-nav-link" to="/account/addresses" style={isActiveStyle}>
        Addresses
      </NavLink>
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <button className="account-button account-button-secondary" type="submit">
        Sign out
      </button>
    </Form>
  );
}
