import {CartForm, Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {CartLine} from '~/components/CartLineItem';

/**
 * Optional donation flow that appears above the cart summary.
 *
 * How it works:
 *   1. The cart loader queries a Shopify product with handle
 *      `firmware-donation` (variants = donation tiers: €1, €3, €5, €10).
 *   2. Each tier button adds that variant to the cart as a normal line
 *      item, so it flows through standard Shopify checkout and payout.
 *   3. If a tier is already in the cart we render a "thanks + remove"
 *      state instead of duplicating the line.
 *
 * To enable the block, create the `firmware-donation` product in
 * Shopify admin with one variant per donation amount. Until then the
 * loader returns null and this component doesn't render.
 */
export type DonationVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Pick<MoneyV2, 'amount' | 'currencyCode'>;
};

export type DonationProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  variants: {nodes: DonationVariant[]};
};

export function DonationUpsell({
  product,
  cartLines,
}: {
  product: DonationProduct;
  cartLines: CartLine[];
}) {
  const variants = product.variants.nodes.filter((v) => v.availableForSale);
  if (variants.length === 0) return null;

  // Map active donation variant → its cart line (for the remove flow).
  const donationLinesByVariantId = new Map<string, CartLine>();
  for (const line of cartLines) {
    const merchandise = (line as unknown as {merchandise?: {id?: string}})
      .merchandise;
    if (merchandise?.id) {
      donationLinesByVariantId.set(merchandise.id, line);
    }
  }

  return (
    <section className="donation-upsell" aria-label="Optional donation">
      <p className="donation-eyebrow">Optional · top up the firmware split</p>
      <h3 className="donation-title">
        Add a thank-you to the firmware maintainers.
      </h3>
      <p className="donation-body">
        100% forwarded on top of the baked-in €1 — we don&apos;t keep any of it.
        Betaflight, AM32, ExpressLRS. Pick a tier or skip.
      </p>
      <div className="donation-tiers">
        {variants.map((variant) => {
          const existingLine = donationLinesByVariantId.get(variant.id);
          if (existingLine) {
            return (
              <CartForm
                key={variant.id}
                route="/cart"
                action={CartForm.ACTIONS.LinesRemove}
                inputs={{lineIds: [existingLine.id]}}
              >
                <button
                  type="submit"
                  className="donation-tier donation-tier-active"
                  aria-pressed="true"
                >
                  <span className="donation-tier-label">{variant.title}</span>
                  <span className="donation-tier-price">
                    <Money data={variant.price} />
                  </span>
                  <span className="donation-tier-remove">Remove</span>
                </button>
              </CartForm>
            );
          }
          return (
            <CartForm
              key={variant.id}
              route="/cart"
              action={CartForm.ACTIONS.LinesAdd}
              inputs={{
                lines: [{merchandiseId: variant.id, quantity: 1}],
              }}
            >
              <button type="submit" className="donation-tier">
                <span className="donation-tier-label">{variant.title}</span>
                <span className="donation-tier-price">
                  <Money data={variant.price} />
                </span>
              </button>
            </CartForm>
          );
        })}
      </div>
    </section>
  );
}
