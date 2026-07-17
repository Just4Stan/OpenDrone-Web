/**
 * Stack-deal display math, shared by every surface that advertises the
 * FC + ESC stack (PDP CTA flyout, catalog cards, header pod rows).
 *
 * REALITY (Stan, 2026-07-17): the Shopify automatic discount is 10% off the
 * OpenESC when it's bought together with an OpenFC Lite. It is NOT 10% off
 * the whole pair. Copy must name the discounted board (e.g. "OpenESC −10%"),
 * and any discounted price shown must be derived from the live price with
 * {@link stackDiscountedPrice} so it matches what checkout actually charges.
 * Never hardcode computed prices in code or copy, comments included: they
 * rot the moment a price changes in Shopify.
 */

/** The advertised percent of the Shopify automatic BXGY. Display only:
 *  the discount itself is configured in Shopify and applied by checkout. */
export const STACK_DISCOUNT_PCT = 10;

/** A money-ish price ({amount, currencyCode}) with `pct` percent off,
 *  rounded to cents. */
export function stackDiscountedPrice<
  T extends {amount: string; currencyCode: string},
>(price: T, pct: number): T {
  return {
    ...price,
    amount: ((Number(price.amount) * (100 - pct)) / 100).toFixed(2),
  };
}
