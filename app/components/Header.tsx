import {Suspense, useEffect, useRef, useState} from 'react';
import {Await, useAsyncValue, useLocation} from 'react-router';
import {NavLink} from '~/components/nav';
import {AnimatePresence} from 'motion/react';
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
import {IncutecWordmark} from '~/components/IncutecWordmark';
import {Pod} from '~/components/Pod';
import {SearchForm} from '~/components/SearchForm';
import {ProductPods, type ProductPodItem} from '~/components/ProductPods';
import {INCUTEC_HINT_SEEN_KEY} from '~/lib/incutec-hint';

/** Retire the hero "Who's incutec?" hint: persist the dismissal and pull the
 *  class so it can't flash on a same-session SPA return to the homepage. */
function dismissIncutecHint() {
  try {
    localStorage.setItem(INCUTEC_HINT_SEEN_KEY, '1');
  } catch {
    /* storage blocked (private mode) — the nudge just isn't persisted */
  }
  document.documentElement.classList.remove('hero-incutec-hint');
}

/** Thin shape of a product as read by HEADER_PRODUCTS_QUERY. */
export type HeaderFamilyVariant = {
  id: string;
  title: string;
  availableForSale?: boolean;
  image?: {url: string; altText?: string | null} | null;
  price?: {amount: string; currencyCode: string} | null;
  selectedOptions?: Array<{name: string; value: string}>;
};

export type HeaderFamilyProduct = {
  id: string;
  handle: string;
  title: string;
  productType?: string | null;
  featuredImage?: {url: string; altText?: string | null} | null;
  priceRange?: {
    minVariantPrice?: {amount: string; currencyCode: string} | null;
  } | null;
  variants?: {nodes: HeaderFamilyVariant[]} | null;
};

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  familyProducts?: Promise<HeaderFamilyProduct[]>;
}

type Viewport = 'desktop' | 'mobile';

// Category links jump straight to the current PDP for each family.
// Accessories no longer get a dedicated link here — they live (with
// everything else) on the aggregated All Products page, reachable via the
// "All Products" CTA on the right, filterable by category there.
// Each family chip links to its representative PDP and, on hover, drops a Pod
// listing every SKU of that Shopify `productType`.
const CATEGORY_LINKS: Array<{label: string; to: string; type: string}> = [
  {label: 'FC', to: '/products/openfc-lite', type: 'Flight Controller'},
  {label: 'ESC', to: '/products/openesc', type: 'ESC'},
  {label: 'RX', to: '/products/openrx', type: 'Receiver'},
  {label: 'Frame', to: '/products/openframe', type: 'Frame'},
];

/** Fuller family names for the mobile drawer (the desktop FamilyNav chips use
 *  the terse FC/ESC/… labels; the drawer has room to spell them out). */
const MOBILE_FAMILY_LABEL: Record<string, string> = {
  'Flight Controller': 'Flight Controllers',
  ESC: 'ESCs',
  Receiver: 'Receivers',
  Frame: 'Frames',
};

/** Stack companions per family: hovering a family-pod row offers "also add
 *  an X" with these partner products, size-matched by the Model option. A
 *  future OpenFC Pro is one more handle in the ESC list. Mirrors `stack` in
 *  product-content.ts without pulling that whole module into the header;
 *  the percent is the Shopify automatic BXGY (display only). */
const STACK_COMPANIONS: Record<string, {label: string; handles: string[]}> = {
  'Flight Controller': {label: 'also add an ESC', handles: ['openesc']},
  ESC: {label: 'also add an FC', handles: ['openfc-lite']},
};
const STACK_DISCOUNT_PCT = 10;

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
  familyProducts,
}: HeaderProps) {
  const {menu} = header;
  // Dynamic-Island logo slot. On the hero ("/") the OpenDrone wordmark already
  // lives bottom-left in the 3D scene, so the bar instead credits the parent
  // company — the Incutec mark linking to incutec.eu (OpenDrone is an Incutec
  // product brand). On every other route the slot is the OpenDrone wordmark
  // home link. The slot is a fixed width so the nav chips never shift between
  // routes; view-transition-name animates the swap across navigations.
  const {pathname} = useLocation();
  const isHero = pathname === '/';
  return (
    <header className="site-header">
      <div className="site-header-main">
        {/* Left: brand slot — OpenDrone home link, or Incutec credit on the hero.
            On the hero the mark links to the in-site Incutec company page, and a
            "Who's incutec?" hint drops out from under it a beat after the header
            lands (gated on `html.hero-incutec-hint`, set by the homepage). */}
        {isHero ? (
          <span className="site-header-incutec-slot">
            <NavLink
              prefetch="intent"
              to="/incutec"
              className="site-header-logo site-header-logo--incutec"
              aria-label="Incutec, the company behind OpenDrone"
              style={{viewTransitionName: 'site-logo'}}
              onClick={dismissIncutecHint}
            >
              <IncutecWordmark className="site-header-incutec" />
            </NavLink>
            <NavLink
              prefetch="intent"
              to="/incutec"
              className="incutec-hint"
              tabIndex={-1}
              aria-hidden="true"
              onClick={dismissIncutecHint}
            >
              Who&apos;s incutec?
            </NavLink>
          </span>
        ) : (
          <NavLink
            prefetch="viewport"
            to="/"
            end
            className="site-header-logo"
            aria-label="OpenDrone"
            style={{viewTransitionName: 'site-logo'}}
          >
            <SiteWordmark className="site-header-wordmark" />
          </NavLink>
        )}

        {/* Center: primary nav + gold category links on the same row */}
        <HeaderMenu
          menu={menu}
          viewport="desktop"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
        {/* Category families in segmented bubbles: FC and ESC share one
            (their rows sell the stack), while RX and Frame are standalone
            families so each gets its own bubble; All Products follows in its
            own accented bubble as the route into the full catalogue. No
            dividers — the bubbles do the grouping. */}
        <FamilyNav familyProducts={familyProducts} />

        {/* Right: actions */}
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
      </div>
    </header>
  );
}

/**
 * The gold family chips (FC/ESC/Stack/RX/Frame) — segmented bubbles that, on
 * hover/focus, drop a Pod listing every SKU of that productType (thumbnail +
 * title + price). The chip itself still links to the family's PDP. Deferred
 * product data is resolved once on first hover so the chips render instantly.
 * Desktop-only (the nav is hidden below 900px). Same Pod material + popOpen
 * motion as the hero showcase.
 */
function FamilyNav({
  familyProducts,
}: {
  familyProducts?: Promise<HeaderFamilyProduct[]>;
}) {
  const [products, setProducts] = useState<HeaderFamilyProduct[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const location = useLocation();
  // Cart drawer opener for the Stack chip's add buttons (named to avoid the
  // `open` dropdown-state collision above).
  const {open: openCartAside} = useAside();

  // Close the hover dropdown on any navigation — otherwise clicking a SKU drops
  // you on the page with the menu still stuck open (mouseleave never fires when
  // the pointer is over the navigating link).
  useEffect(() => {
    clearTimeout(closeTimer.current);
    setOpen(null);
  }, [location.pathname, location.search]);

  function ensureProducts() {
    if (products || !familyProducts) return;
    familyProducts.then((p) => setProducts(p)).catch(() => setProducts([]));
  }
  function openFamily(label: string) {
    ensureProducts();
    clearTimeout(closeTimer.current);
    setOpen(label);
  }
  function scheduleClose() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  }

  // Backstop for the hover dropdown: onMouseLeave/onBlur are not reliable — a
  // fast pointer move, a scroll, or the pod re-rendering under the cursor can
  // swallow the leave event, leaving the menu stuck open (no longer hovered).
  // While something is open, watch the pointer and scroll globally: any pointer
  // that isn't over a `.header-cat` (the chip OR its pod, which lives inside it)
  // schedules the close; scrolling closes immediately.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.('.header-cat')) scheduleClose();
    };
    const onScroll = () => {
      clearTimeout(closeTimer.current);
      setOpen(null);
    };
    document.addEventListener('pointermove', onPointer);
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      document.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open]);

  // "also add an X" cascade for an FC/ESC row: each companion product's
  // variant at the same Model size, with both cart lines prebuilt.
  function companionsFor(
    type: string,
    v: HeaderFamilyVariant,
  ): NonNullable<ProductPodItem['buy']>['companions'] {
    const cfg = STACK_COMPANIONS[type];
    if (!cfg) return undefined;
    const size = v.selectedOptions?.find(
      (o) => o.name.trim().toLowerCase() === 'model',
    )?.value;
    if (!size) return undefined;
    const options = cfg.handles.flatMap((h) => {
      const partner = (products ?? []).find((p) => p.handle === h);
      const pv = partner?.variants?.nodes?.find((pvv) =>
        pvv.selectedOptions?.some(
          (o) =>
            o.name.trim().toLowerCase() === 'model' &&
            o.value.trim().toLowerCase() === size.trim().toLowerCase(),
        ),
      );
      if (!partner || !pv) return [];
      return [
        {
          key: h,
          title: `${partner.title} · ${size}`,
          price: pv.price ?? null,
          pct: STACK_DISCOUNT_PCT,
          available: Boolean(pv.availableForSale && v.availableForSale),
          imageUrl: pv.image?.url ?? partner.featuredImage?.url ?? null,
          lines: [
            {merchandiseId: v.id, quantity: 1},
            {merchandiseId: pv.id, quantity: 1},
          ],
        },
      ];
    });
    return options.length ? {label: cfg.label, options} : undefined;
  }

  function itemsFor(type: string): ProductPodItem[] {
    return (products ?? [])
      .filter((p) => (p.productType || '') === type)
      .flatMap((p) => {
        // Real, distinguishable variants (drop the single "Default Title").
        const variants = (p.variants?.nodes ?? []).filter(
          (v) => v.title && v.title !== 'Default Title',
        );
        // Single-variant product → one row for the product itself.
        if (variants.length <= 1) {
          const only = p.variants?.nodes?.[0];
          return [
            {
              key: p.handle,
              to: `/products/${p.handle}`,
              title: p.title,
              subtitle: p.productType ?? undefined,
              imageUrl: p.featuredImage?.url ?? null,
              imageAlt: p.featuredImage?.altText ?? null,
              price: p.priceRange?.minVariantPrice ?? null,
              buy: only
                ? {
                    lines: [{merchandiseId: only.id, quantity: 1}],
                    available: Boolean(only.availableForSale),
                    flyImage:
                      only.image?.url ?? p.featuredImage?.url ?? null,
                  }
                : undefined,
            },
          ];
        }
        // Multi-variant → a row per SKU, deep-linking the variant on the PDP.
        return variants.map((v) => {
          const params = new URLSearchParams();
          (v.selectedOptions ?? []).forEach((o) => params.set(o.name, o.value));
          const qs = params.toString();
          return {
            key: v.id,
            to: `/products/${p.handle}${qs ? `?${qs}` : ''}`,
            // SKU/variant name is the headline (gold); the family line is the
            // dim context beneath it.
            title: v.title,
            subtitle: p.title,
            imageUrl: v.image?.url ?? p.featuredImage?.url ?? null,
            imageAlt: v.image?.altText ?? p.featuredImage?.altText ?? null,
            price: v.price ?? p.priceRange?.minVariantPrice ?? null,
            buy: {
              lines: [{merchandiseId: v.id, quantity: 1}],
              available: Boolean(v.availableForSale),
              flyImage: v.image?.url ?? p.featuredImage?.url ?? null,
              companions: companionsFor(type, v),
            },
          };
        });
      });
  }

  function chip(cat: (typeof CATEGORY_LINKS)[number]) {
    const items = itemsFor(cat.type);
    return (
      <span
        className="header-cat"
        key={cat.label}
        onMouseEnter={() => openFamily(cat.label)}
        onMouseLeave={scheduleClose}
        onFocus={() => openFamily(cat.label)}
        onBlur={scheduleClose}
      >
        <NavLink prefetch="viewport" to={cat.to}>
          {cat.label}
        </NavLink>
        <span className="header-cat-pod-wrap">
          <AnimatePresence>
            {open === cat.label && items.length > 0 ? (
              <Pod
                animate
                origin="top center"
                className="header-cat-pod"
                role="menu"
                ariaLabel={`${cat.label} products`}
              >
                <ProductPods
                  items={items}
                  layout="row"
                  onAdd={() => {
                    setOpen(null);
                    openCartAside('cart');
                  }}
                />
              </Pod>
            ) : null}
          </AnimatePresence>
        </span>
      </span>
    );
  }

  return (
    <nav className="site-header-categories" aria-label="Product categories">
      {/* FC and ESC share one bubble (a stack is bought from their rows);
          RX and Frame are standalone families with their own bubbles. */}
      <span className="site-header-cat-group">
        {CATEGORY_LINKS.slice(0, 2).map(chip)}
      </span>
      {CATEGORY_LINKS.slice(2).map((cat) => (
        <span className="site-header-cat-group" key={cat.label}>
          {chip(cat)}
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
          ? 'site-mobile-nav flex flex-col gap-1 px-1'
          : 'hidden md:flex items-center gap-8 ml-10'
      }
      role="navigation"
    >
      {/* Mobile drawer only: surface Search + the product families + Home up
          top. The desktop header carries these in its own bar / FamilyNav,
          which is hidden on phones — without this the drawer was four links in
          a sea of empty panel and the whole product taxonomy vanished. */}
      {isMobile && (
        <>
          <SearchForm
            action="/search"
            className="site-mobile-nav-search"
            onSubmit={() => close()}
          >
            {({inputRef}) => (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  type="search"
                  name="q"
                  placeholder="Search products"
                  aria-label="Search products"
                  enterKeyHint="search"
                />
              </>
            )}
          </SearchForm>
          <p className="site-mobile-nav-label">Shop</p>
          {CATEGORY_LINKS.map((c) => (
            <NavLink
              key={c.to}
              onClick={close}
              prefetch="viewport"
              to={c.to}
              className="text-sm font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {MOBILE_FAMILY_LABEL[c.type] ?? c.label}
            </NavLink>
          ))}
          <NavLink
            onClick={close}
            prefetch="viewport"
            to="/collections/all"
            className="text-sm font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            All products
          </NavLink>
          <p className="site-mobile-nav-label">More</p>
          <NavLink
            end
            onClick={close}
            prefetch="viewport"
            to="/"
            className="text-sm font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Home
          </NavLink>
        </>
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
        if (!isMobile && (url === '/collections/all' || url === '/support')) return null;
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
      {isMobile ? (
        <>
          <p className="site-mobile-nav-label">Account</p>
          <NavLink
            onClick={close}
            prefetch="intent"
            to="/account"
            className="text-sm font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Account / Sign in
          </NavLink>
        </>
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
        to="/support"
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
      <CartToggle cart={cart} />
      <HeaderMenuMobileToggle />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="site-header-icon site-header-menu-toggle text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
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

function CartBadge({count}: {count: number}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      href="/cart"
      data-cart-target=""
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
  '/pages/contact': '/support',
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
