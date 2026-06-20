import {Await, useLocation} from 'react-router';
import {Suspense} from 'react';
import {MotionConfig} from 'motion/react';
import type {
  CartApiQueryFragment,
  HeaderQuery,
} from 'storefrontapi.generated';
import type {CompanyIdentity} from '~/lib/company';
import {Aside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu, type HeaderFamilyProduct} from '~/components/Header';
import {LangToggle} from '~/components/LangToggle';
import {CartMain} from '~/components/CartMain';
import {PlaceholderBanner} from '~/components/PlaceholderBanner';
import {RouteProgress} from '~/components/RouteProgress';

/** Resolved marketing-consent state for the signed-in customer (null = guest). */
export type NewsletterAccount = {email: string; subscribed: boolean} | null;

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  company: CompanyIdentity;
  turnstileSiteKey?: string | null;
  prelaunch?: boolean;
  familyProducts?: Promise<HeaderFamilyProduct[]>;
  newsletterAccount?: Promise<NewsletterAccount>;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  header,
  isLoggedIn,
  publicStoreDomain,
  company,
  turnstileSiteKey,
  prelaunch = true,
  familyProducts,
  newsletterAccount,
}: PageLayoutProps) {
  const {pathname} = useLocation();
  const isHomepage = pathname === '/';

  return (
    <MotionConfig reducedMotion="user">
      <Aside.Provider>
        <CartAside cart={cart} />
        <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
        <div className={isHomepage ? 'homepage-layout' : ''}>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          <RouteProgress />
          {prelaunch && <PlaceholderBanner />}
          {header && (
            <Header
              header={header}
              cart={cart}
              isLoggedIn={isLoggedIn}
              publicStoreDomain={publicStoreDomain}
              familyProducts={familyProducts}
            />
          )}
          <main id="main-content" className="site-main">
            {children}
          </main>
          {!isHomepage && (
            <Footer
              header={header}
              publicStoreDomain={publicStoreDomain}
              company={company}
              turnstileSiteKey={turnstileSiteKey ?? null}
              newsletterAccount={newsletterAccount}
            />
          )}
        </div>
      </Aside.Provider>
    </MotionConfig>
  );
}

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  return (
    <Aside type="cart" heading="CART">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  publicStoreDomain,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
}) {
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="MENU">
        <HeaderMenu
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
        {/* Language switch lives in the drawer on phones — it's hidden from the
            top bar there to keep the header row inside a 320px viewport.
            LangToggle self-hides on non-legal routes. */}
        <LangToggle className="mobile-menu-lang" />
      </Aside>
    )
  );
}
