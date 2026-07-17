/**
 * Checkout Click, both halves in one place: the Plausible funnel event
 * (cart or express-item value as revenue) and the sendBeacon to
 * /api/track/checkout that bumps the ledger's `chk:<day>` counter, the
 * buy-rate denominator (app/lib/growth/ledger.ts).
 *
 * One helper so every checkout entry point counts the same way. The
 * cart CTA (CartSummary) and the PDP ShopPay express button
 * (ProductForm, added in #304, which bypasses the cart entirely) both
 * call this; a checkout path that skips it silently vanishes from the
 * buy-rate denominator while its orders still land in the numerator.
 *
 * Fire-and-forget: never blocks and never breaks the checkout
 * navigation. sendBeacon survives the navigation to Shopify's checkout;
 * keepalive fetch is the fallback.
 */
import {trackEvent} from '~/lib/growth/plausible';
import {attributionSource} from '~/lib/growth/attribution';

export function trackCheckoutClick(
  revenue?: {currency: string; amount: number} | null,
): void {
  trackEvent('Checkout Click', {
    props: {source: attributionSource()},
    ...(revenue && Number.isFinite(revenue.amount) ? {revenue} : {}),
  });
  try {
    if (!navigator.sendBeacon?.('/api/track/checkout')) {
      void fetch('/api/track/checkout', {
        method: 'POST',
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must not take down checkout.
  }
}
