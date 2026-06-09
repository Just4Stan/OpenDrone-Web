import {Suspense} from 'react';
import {Await, NavLink, useAsyncValue} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {LangToggle} from '~/components/LangToggle';
import {ThemeToggle} from '~/components/ThemeToggle';
import {SiteWordmark} from '~/components/SiteWordmark';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

// Category links jump straight to the current PDP for each family.
// Accessories no longer get a dedicated link here — they live (with
// everything else) on the aggregated All Products page, reachable via the
// "All Products" CTA on the right, filterable by category there.
const CATEGORY_LINKS: Array<{label: string; to: string}> = [
  {label: 'FC', to: '/products/openfc-lite'},
  {label: 'ESC', to: '/products/openesc'},
  {label: 'Stack', to: '/products/openstack'},
  {label: 'RX', to: '/products/openrx'},
  {label: 'Frame', to: '/products/openframe'},
];

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {menu} = header;
  return (
    <header className="site-header">
      <div className="site-header-main">
        {/* Left: wordmark — "Open" neutral, "Drone" in gold, matches splash */}
        <NavLink
          prefetch="viewport"
          to="/"
          end
          className="site-header-logo"
          aria-label="OpenDrone"
        >
          <SiteWordmark className="site-header-wordmark" />
        </NavLink>

        {/* Center: primary nav + gold category links on the same row */}
        <HeaderMenu
          menu={menu}
          viewport="desktop"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
        {/* Category families in segmented bubbles: FC/ESC/Stack share one (a
            Stack is just an FC + ESC), while RX and Frame are standalone
            families so each gets its own bubble; All Products follows in its
            own accented bubble as the route into the full catalogue. No
            dividers — the bubbles do the grouping. CATEGORY_LINKS is ordered
            [FC, ESC, Stack, RX, Frame]. */}
        <nav className="site-header-categories" aria-label="Product categories">
          <span className="site-header-cat-group">
            {CATEGORY_LINKS.slice(0, 3).map((cat) => (
              <NavLink key={cat.label} prefetch="viewport" to={cat.to}>
                {cat.label}
              </NavLink>
            ))}
          </span>
          {CATEGORY_LINKS.slice(3).map((cat) => (
            <span className="site-header-cat-group" key={cat.label}>
              <NavLink prefetch="viewport" to={cat.to}>
                {cat.label}
              </NavLink>
            </span>
          ))}
          <NavLink
            prefetch="viewport"
            to="/collections/all"
            className="site-header-cat-all"
          >
            All Products
          </NavLink>
        </nav>

        {/* Right: actions */}
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
      </div>
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const {close} = useAside();
  const isMobile = viewport === 'mobile';

  return (
    <nav
      className={
        isMobile
          ? 'flex flex-col gap-5 px-1'
          : 'hidden md:flex items-center gap-8 ml-10'
      }
      role="navigation"
    >
      {isMobile && (
        <NavLink
          end
          onClick={close}
          prefetch="viewport"
          to="/"
          className="text-sm font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Home
        </NavLink>
      )}
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;
        let url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        // Rewrite Shopify Pages handles to our local routes when one
        // exists. Shopify's main menu defaults Contact to /pages/contact
        // even though we own a local /contact route with the support
        // widget; without this rewrite the menu link lands on an empty
        // Shopify Page.
        url = LOCAL_PAGE_REWRITES[url] ?? url;
        // Drop any menu item that resolves to "/" — the wordmark logo
        // on the left already links there, so a separate "Home" entry
        // is duplicated chrome. This skips it in code so we don't have
        // to keep the Shopify admin menu in sync.
        if (url === '/' || url === '') return null;
        // Catalog + Contact render in the right-side CTA group; skip
        // them here to avoid duplicate links in the center menu.
        if (!isMobile && (url === '/collections/all' || url === '/contact')) return null;
        const className = isMobile
          ? 'text-sm font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors'
          : 'font-mono text-[12px] uppercase tracking-[0.15em] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]';

        if (!url.startsWith('/')) {
          return (
            <a
              className={className}
              href={url}
              key={item.id}
              onClick={close}
              rel="noopener noreferrer"
              target="_blank"
            >
              {item.title}
            </a>
          );
        }

        return (
          <NavLink
            end
            key={item.id}
            onClick={close}
            prefetch="viewport"
            to={url}
            className={({isActive}) =>
              `${isMobile ? 'text-sm tracking-wider' : 'text-[12px] tracking-[0.15em]'} font-mono uppercase transition-colors ${
                isActive
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`
            }
          >
            {item.title}
          </NavLink>
        );
      })}
      {/* Mobile aside only: a Newsletter link in the slide-out menu. On
          desktop Newsletter lives in the right-side CTA group (left of
          Catalog), so it's omitted here to avoid duplicating it. Skipped if
          the Shopify menu already links to /newsletter. */}
      {isMobile &&
      !(menu || FALLBACK_HEADER_MENU).items.some((it) =>
        it.url?.includes('/newsletter'),
      ) ? (
        <NavLink
          end
          onClick={close}
          prefetch="viewport"
          to="/newsletter"
          className={({isActive}) =>
            `${isMobile ? 'text-sm tracking-wider' : 'text-[12px] tracking-[0.15em]'} font-mono uppercase transition-colors ${
              isActive
                ? 'text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`
          }
        >
          Newsletter
        </NavLink>
      ) : null}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  return (
    <nav className="flex items-center gap-2 md:gap-5 ml-auto" role="navigation">
      {/* Hidden in the top bar on phones (it would overflow a 320px row on
          legal pages); MobileMenuAside renders it inside the drawer instead. */}
      <LangToggle className="header-lang-toggle" />
      <NavLink
        prefetch="viewport"
        to="/newsletter"
        className={({isActive}) =>
          `font-mono text-[12px] uppercase tracking-[0.15em] transition-colors hidden md:block ${
            isActive
              ? 'text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`
        }
      >
        Newsletter
      </NavLink>
      <NavLink
        prefetch="viewport"
        to="/contact"
        className={({isActive}) =>
          `font-mono text-[12px] uppercase tracking-[0.15em] transition-colors hidden md:block ${
            isActive
              ? 'text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`
        }
      >
        Contact
      </NavLink>
      <NavLink
        prefetch="viewport"
        to="/account"
        className="font-mono text-[12px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors hidden md:block"
      >
        <Suspense fallback="Sign in">
          <Await resolve={isLoggedIn} errorElement="Sign in">
            {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
          </Await>
        </Suspense>
      </NavLink>
      <ThemeToggle className="site-header-icon" />
      <SearchToggle />
      <CartToggle cart={cart} />
      <HeaderMenuMobileToggle />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="site-header-icon md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      onClick={() => open('mobile')}
      aria-label="Menu"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      className="site-header-icon text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      onClick={() => open('search')}
      aria-label="Search"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  );
}

function CartBadge({count}: {count: number}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      href="/cart"
      className="site-header-icon text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      {/* Inner relative wrapper keeps the count badge pinned to the icon, not
          to the enlarged 44px tap area the anchor gets on mobile. */}
      <span className="relative inline-flex">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1.5 bg-[var(--color-gold)] text-[var(--color-on-accent)] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {count}
          </span>
        )}
      </span>
    </a>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

const LOCAL_PAGE_REWRITES: Record<string, string> = {
  '/pages/contact': '/contact',
};

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Catalog',
      type: 'HTTP',
      url: '/collections/all',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566265',
      resourceId: null,
      tags: [],
      title: 'Newsletter',
      type: 'HTTP',
      url: '/newsletter',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Open Source',
      type: 'HTTP',
      url: 'https://github.com/incutec-hw',
      items: [],
    },
  ],
};
