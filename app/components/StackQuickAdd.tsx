import {Money} from '@shopify/hydrogen';
import type {OptimisticCartLineInput} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';

/**
 * One "buy it as a stack" offer: the paired board resolved to the size that
 * matches what the visitor is looking at, with BOTH cart lines prebuilt so a
 * single click orders the pair. The advertised percent is the Shopify
 * automatic Buy-X-Get-Y discount; checkout applies it, and it is off ONE
 * board only (the BXGY's "get Y" side, today the OpenESC), never the pair.
 * Callers say which side that is: when the discounted board is the partner
 * being added, pass its derived discounted `price` plus the full price as
 * `compareAtPrice`; when it's the board the visitor is already buying, pass
 * its name as `discountedLabel` so the badge reads "OpenESC −10%".
 */
export type StackOffer = {
  key: string;
  /** Partner board name, e.g. "OpenFC Lite". */
  label: string;
  /** Matched size value, e.g. "20×20". */
  size?: string;
  /** Partner's displayed price (shown as "+€40,50"). When the partner is
   *  the discounted board this is the discounted price: what checkout
   *  actually charges for it once the pair is in the cart. */
  price?: MoneyV2 | null;
  /** Partner's full price, struck through next to a discounted `price`. */
  compareAtPrice?: MoneyV2 | null;
  pct?: number;
  /** Name of the discounted board when it is NOT the partner (e.g. the
   *  OpenESC the visitor is looking at); badges as "OpenESC −10%". */
  discountedLabel?: string;
  lines: OptimisticCartLineInput[];
  available: boolean;
};

/**
 * Wraps a primary add-to-cart control with a hover/focus flyout of stack
 * offers — the "one click more" upsell. Desktop reveals on hover of the CTA;
 * touch devices (no hover) render the offers as a slim row under it. With no
 * offers it renders the CTA untouched.
 */
export function StackQuickAdd({
  children,
  offers,
  flyImage,
  onAdd,
}: {
  /** The primary CTA (usually an AddToCartButton). */
  children: React.ReactNode;
  offers: StackOffer[];
  flyImage?: string | null;
  onAdd?: () => void;
}) {
  if (!offers.length) return <>{children}</>;
  return (
    <div className="cta-stack-group">
      {children}
      <div className="cta-stack-flyout" aria-label="Buy as a stack">
        {offers.map((o) => (
          <AddToCartButton
            key={o.key}
            className="cta-stack-offer"
            lines={o.lines}
            disabled={!o.available}
            flyImage={flyImage}
            onClick={onAdd}
          >
            <span className="cta-stack-offer-plus" aria-hidden="true">
              +
            </span>
            <span className="cta-stack-offer-label">
              {o.label}
              {o.size ? ` · ${o.size}` : ''}
            </span>
            {o.price ? (
              <span className="cta-stack-offer-price">
                {o.compareAtPrice ? (
                  <s className="cta-stack-offer-was">
                    <Money data={o.compareAtPrice} />
                  </s>
                ) : null}
                <Money data={o.price} />
              </span>
            ) : null}
            {/* The pct is off ONE board, never the pair: next to a struck
                partner price it reads as that line's cut; otherwise it must
                name the discounted board ("OpenESC −10%"). No side known →
                no claim. */}
            {o.pct && (o.discountedLabel || o.compareAtPrice) ? (
              <span className="cta-stack-offer-pct">
                {o.discountedLabel ? `${o.discountedLabel} ` : ''}−{o.pct}%
              </span>
            ) : null}
          </AddToCartButton>
        ))}
      </div>
    </div>
  );
}
