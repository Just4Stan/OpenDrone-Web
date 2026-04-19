import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import favicon from '~/assets/favicon.svg';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import {PageLayout} from './components/PageLayout';
import {getCompanyIdentity} from '~/lib/company';
import {localeFromPathname} from '~/lib/i18n';
import {buildOrgJsonLd} from '~/lib/seo';

export type RootLoader = typeof loader;

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {rel: 'preconnect', href: 'https://cdn.shopify.com'},
    {rel: 'preconnect', href: 'https://shop.app'},
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  const company = getCompanyIdentity(env as unknown as Record<string, string | undefined>);

  // Derive locale from the URL path so /nl/* actually renders <html lang="nl">.
  // Hydrogen's storefront.i18n is pinned to EN/US in app/lib/context.ts and
  // doesn't follow the URL; using it would force every page to en_US.
  const urlLocale = localeFromPathname(new URL(args.request.url).pathname);
  const locale = urlLocale === 'nl' ? 'nl_BE' : 'en_US';

  return {
    ...deferredData,
    ...criticalData,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    company,
    locale,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      // checkoutDomain is required by Hydrogen Analytics. Fall back to the
      // store domain when the dedicated checkout subdomain isn't configured.
      checkoutDomain:
        env.PUBLIC_CHECKOUT_DOMAIN || env.PUBLIC_STORE_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      // No cookie banner at launch: Plausible-only analytics, Shopify analytics
      // not shipped. Consent is default-denied. Banner will return when marketing
      // cookies are introduced.
      withPrivacyBanner: false,
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {header};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>('root');
  const htmlLang = (data?.locale || 'en_US').split('_')[0] || 'en';
  const orgJsonLd = data?.company ? buildOrgJsonLd(data.company) : null;

  return (
    <html lang={htmlLang} className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#0d0d10" />
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <Meta />
        <Links />
        {/* Plausible — cookieless analytics, no consent required.
            suppressHydrationWarning: nonce is per-request and only meaningful
            server-side; the client-side value is empty, which React would
            otherwise flag as a hydration mismatch. */}
        <script
          defer
          data-domain="opendrone.be"
          src="https://plausible.io/js/script.js"
          nonce={nonce}
          suppressHydrationWarning
        />
        {orgJsonLd ? (
          <script
            type="application/ld+json"
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{__html: JSON.stringify(orgJsonLd)}}
          />
        ) : null}
      </head>
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] min-h-screen flex flex-col">
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');

  if (!data) {
    return <Outlet />;
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = '';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage =
      typeof error.data === 'string' ? error.data : (error.data?.message ?? '');
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const isNotFound = errorStatus === 404;
  const title = isNotFound ? 'Page not found' : 'Something went wrong';
  const description = isNotFound
    ? 'The page you were looking for has moved or never existed. Try the catalog or head home.'
    : 'An unexpected error occurred. Try again, or head back to the catalog.';

  return (
    <div className="route-error page-shell">
      <p className="route-error-status">{errorStatus}</p>
      <h1 className="route-error-title">{title}</h1>
      <p className="route-error-body">{description}</p>
      {errorMessage ? (
        <details className="route-error-details">
          <summary>Technical details</summary>
          <pre>{errorMessage}</pre>
        </details>
      ) : null}
      <div className="route-error-actions">
        <a href="/" className="hero-cta-primary">
          Home
        </a>
        <a href="/collections/all" className="hero-cta-secondary">
          Shop
        </a>
      </div>
    </div>
  );
}
