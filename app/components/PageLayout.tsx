import {Await, useLocation} from 'react-router';
import {Suspense} from 'react';
import {MotionConfig} from 'motion/react';
import {PerfTierProvider} from '~/lib/perf-tier-context';
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
    <PerfTierProvider>
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
          {/* The desktop homepage is the scroll-pinned WebGL hero and owns its
              own ending, so it ships no footer. The mobile homepage (MobileHome)
              is an ordinary scrolling page — without a footer it ends in a void
              with no nav/legal/newsletter. Render the footer there too, hidden
              above the mobile breakpoint so the desktop hero is untouched. */}
          {!isHomepage ? (
            <Footer
              header={header}
              publicStoreDomain={publicStoreDomain}
              company={company}
              turnstileSiteKey={turnstileSiteKey ?? null}
              newsletterAccount={newsletterAccount}
            />
          ) : (
            <div className="home-mobile-footer">
              <Footer
                header={header}
                publicStoreDomain={publicStoreDomain}
                company={company}
                turnstileSiteKey={turnstileSiteKey ?? null}
                newsletterAccount={newsletterAccount}
              />
            </div>
          )}
        </div>
      </Aside.Provider>
    </MotionConfig>
    </PerfTierProvider>
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
