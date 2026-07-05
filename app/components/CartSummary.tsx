import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {Money, type OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useId, useRef, useState} from 'react';
import {Link} from 'react-router';
import {useAside} from '~/components/Aside';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

// Discount + gift card entry is handled by Shopify's checkout page, so
// the cart summary only shows totals and sends the user onward. Keeps
// the aside compact and lets lines breathe.
export function CartSummary({cart, layout}: CartSummaryProps) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';
  const summaryId = useId();
  const {close} = useAside();

  return (
    <div aria-labelledby={summaryId} className={className}>
      <dl role="group" className="cart-subtotal">
        <dt>Subtotal</dt>
        <dd>
          {cart?.cost?.subtotalAmount?.amount ? (
            <Money data={cart?.cost?.subtotalAmount} />
          ) : (
            '-'
          )}
        </dd>
      </dl>
      <CartCheckoutActions checkoutUrl={cart?.checkoutUrl} />
      {/* Quiet secondary actions under the CTA: an escape hatch back to the
          catalog so a populated cart isn't a dead end, and (page only) a
          share-this-cart link builder. */}
      <div className="cart-secondary-actions">
        <Link
          to="/collections/all"
          prefetch="viewport"
          className="cart-keep-shopping"
          onClick={layout === 'aside' ? close : undefined}
        >
          Keep shopping →
        </Link>
        {layout === 'page' ? <ShareCartButton cart={cart} /> : null}
      </div>
      <p className="cart-summary-note">
        Prices include VAT. Shipping and any discount or gift-card codes
        are applied on the next page.
      </p>
      <p className="cart-summary-note">
        By completing this order you accept the Incutec{' '}
        <Link prefetch="viewport" to="/end-use">End-Use Policy</Link> and the{' '}
        <Link prefetch="viewport" to="/algemene-voorwaarden">General Terms and Conditions</Link>.
      </p>
    </div>
  );
}

/**
 * Copies a /cart/<variant>:<qty>,…?view=1 link reproducing the current cart,
 * including any applied discount codes (`&discount=CODE[,CODE]`). The
 * recipient lands on their own /cart for review (see cart.$lines.tsx),
 * not straight in checkout. The firmware-donation line is excluded — a
 * donation is the sender's choice, not something to forward — as are child
 * bundle components (Shopify re-expands those from the parent line).
 */
function ShareCartButton({cart}: {cart: CartSummaryProps['cart']}) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Don't let the 2s confirmation-reset timer fire into an unmounted
  // component (navigating away right after copying).
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const shareable = (cart?.lines?.nodes ?? []).filter((line) => {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      return false;
    }
    return line.merchandise?.product?.handle !== 'firmware-donation';
  });
  if (!shareable.length) return null;

  // Carry the sender's applied discount codes so the recipient's cart
  // prices out the same. Applicable codes only — a dead code would just
  // error on the recipient's side.
  const discountCodes = (cart?.discountCodes ?? [])
    .filter((c) => c.applicable && c.code)
    .map((c) => c.code);
  const discountParam = discountCodes.length
    ? `&discount=${encodeURIComponent(discountCodes.join(','))}`
    : '';

  const path = `/cart/${shareable
    .map(
      (line) =>
        `${line.merchandise.id.split('/').pop()}:${line.quantity ?? 1}`,
    )
    .join(',')}?view=1${discountParam}`;

  function copy() {
    const url = `${window.location.origin}${path}`;
    // No Clipboard API at all (http, ancient browser): the call below would
    // throw a *synchronous* TypeError that bypasses the rejection handler —
    // guard it and fall back to the prompt directly.
    if (!navigator.clipboard?.writeText) {
      window.prompt('Copy this cart link', url);
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard blocked (permissions / non-secure context) — hand the
        // link over the old way.
        window.prompt('Copy this cart link', url);
      },
    );
  }

  return (
    <button
      type="button"
      className="cart-share-btn"
      data-copied={copied || undefined}
      onClick={copy}
    >
      {copied ? 'Link copied ✓' : 'Share this cart'}
      {/* The visible label swap isn't announced by screen readers on its
          own — mirror the confirmation into a polite live region. */}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Cart link copied to clipboard' : ''}
      </span>
    </button>
  );
}

function CartCheckoutActions({checkoutUrl}: {checkoutUrl?: string}) {
  if (!checkoutUrl) return null;

  return (
    <a
      href={checkoutUrl}
      target="_self"
      className="cart-checkout-cta"
    >
      Checkout
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </a>
  );
}
