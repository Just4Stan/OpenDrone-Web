import {useOptimisticCart} from '@shopify/hydrogen';
import {useMemo} from 'react';
import {Link, useFetchers} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {DonationUpsell, type DonationProduct} from './DonationUpsell';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
  donationProduct?: DonationProduct | null;
};

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};
/** Returns a map of all line items and their children. */
function getLineItemChildrenMap(lines: CartLine[]): LineItemChildrenMap {
  const children: LineItemChildrenMap = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line) {
      const nested = getLineItemChildrenMap(line.lineComponents);
      for (const [parentId, childIds] of Object.entries(nested)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}
/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({
  layout,
  cart: originalCart,
  donationProduct,
}: CartMainProps) {
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const childrenMap = getLineItemChildrenMap(cart?.lines?.nodes ?? []);

  return (
    <section
      className={className}
      aria-label={layout === 'page' ? 'Cart page' : 'Cart drawer'}
    >
      <CartActionNotice />
      <CartEmpty hidden={linesCount} layout={layout} />
      <div className="cart-details">
        <p id="cart-lines" className="sr-only">
          Line items
        </p>
        <div className="cart-lines-scroll">
          <ul aria-labelledby="cart-lines">
            {(cart?.lines?.nodes ?? []).map((line) => {
              // we do not render non-parent lines at the root of the cart
              if (
                'parentRelationship' in line &&
                line.parentRelationship?.parent
              ) {
                return null;
              }
              return (
                <CartLineItem
                  key={line.id}
                  line={line}
                  layout={layout}
                  childrenMap={childrenMap}
                />
              );
            })}
          </ul>
        </div>
        {cartHasItems && donationProduct ? (
          <DonationUpsell
            product={donationProduct}
            cartLines={cart?.lines?.nodes ?? []}
          />
        ) : null}
        {cartHasItems && <CartSummary cart={cart} layout={layout} />}
      </div>
    </section>
  );
}

type CartActionData = {
  errors?: Array<{message?: string} | string> | null;
  warnings?: Array<{message?: string} | string> | null;
};

/**
 * Surfaces cart-action errors + warnings (out-of-stock, quantity caps,
 * unknown variant, etc.). Without this, Shopify's responses are returned
 * by the action but never read by the UI — failures vanish silently.
 *
 * We watch every fetcher targeting the /cart action across the whole app
 * (the cart aside lives in PageLayout, so cart mutations from anywhere
 * land here) and render the latest non-empty errors/warnings list.
 */
function CartActionNotice() {
  const fetchers = useFetchers();
  const messages = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const f of fetchers) {
      const matches =
        f.formAction === '/cart' || f.formAction?.startsWith('/cart?');
      if (!matches || f.state !== 'idle' || !f.data) continue;
      const data = f.data as CartActionData;
      for (const e of data.errors ?? []) {
        const m = typeof e === 'string' ? e : e?.message;
        if (m) errors.push(m);
      }
      for (const w of data.warnings ?? []) {
        const m = typeof w === 'string' ? w : w?.message;
        if (m) warnings.push(m);
      }
    }
    return {errors, warnings};
  }, [fetchers]);

  if (!messages.errors.length && !messages.warnings.length) return null;
  return (
    <div className="cart-notice" role="status" aria-live="polite">
      {messages.errors.map((m, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <p key={`err-${i}`} className="cart-notice-error">
          {m}
        </p>
      ))}
      {messages.warnings.map((m, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <p key={`warn-${i}`} className="cart-notice-warning">
          {m}
        </p>
      ))}
    </div>
  );
}

function CartEmpty({
  hidden = false,
}: {
  hidden: boolean;
  layout?: CartMainProps['layout'];
}) {
  const {close} = useAside();
  return (
    <div hidden={hidden} className="cart-empty">
      <div className="cart-empty-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      </div>
      <h2 className="cart-empty-title">Your cart is empty</h2>
      <p className="cart-empty-body">
        Start with the full catalog — open-source hardware ready to fly.
      </p>
      <Link
        to="/collections/all"
        onClick={close}
        prefetch="viewport"
        className="hero-cta-primary"
      >
        Shop all
      </Link>
    </div>
  );
}
