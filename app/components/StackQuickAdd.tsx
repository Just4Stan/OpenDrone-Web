import {Money} from '@shopify/hydrogen';
import type {OptimisticCartLineInput} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';

/**
 * One "buy it as a stack" offer: the paired board resolved to the size that
 * matches what the visitor is looking at, with BOTH cart lines prebuilt so a
 * single click orders the pair. The advertised percent is the Shopify
 * automatic Buy-X-Get-Y discount; checkout applies it.
 */
export type StackOffer = {
  key: string;
  /** Partner board name, e.g. "OpenFC Lite". */
  label: string;
  /** Matched size value, e.g. "20×20". */
  size?: string;
  /** Partner's own price (shown as "+€45"). */
  price?: MoneyV2 | null;
  pct?: number;
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
                <Money data={o.price} />
              </span>
            ) : null}
            {o.pct ? (
              <span className="cta-stack-offer-pct">stack −{o.pct}%</span>
            ) : null}
          </AddToCartButton>
        ))}
      </div>
    </div>
  );
}
