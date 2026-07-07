import {Money} from '@shopify/hydrogen';
import type {OptimisticCartLineInput} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {trackEvent} from '~/lib/growth/plausible';
import {attributionSource} from '~/lib/growth/attribution';

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
  /** Partner's displayed price. When the partner is the discounted board
   *  this is the derived discounted price: what checkout actually charges
   *  for it once the pair is in the cart. */
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
  expanded = false,
}: {
  /** The primary CTA (usually an AddToCartButton). */
  children: React.ReactNode;
  offers: StackOffer[];
  flyImage?: string | null;
  onAdd?: () => void;
  /** Desktop PDP promotes the offers from a hover flyout to a visible ruled
   *  sheet under the CTA. The compact hover flyout is still rendered for the
   *  pinned buy bar (CSS shows one or the other per context). */
  expanded?: boolean;
}) {
  if (!offers.length) return <>{children}</>;
  // Low-cardinality product handle for the Stack Toggle event: the first
  // line is always the board the visitor is looking at.
  const offerProduct = (o: StackOffer): string => {
    const v = o.lines[0]?.selectedVariant as
      | {product?: {handle?: string | null} | null}
      | null
      | undefined;
    return v?.product?.handle ?? 'unknown';
  };
  const renderOffer = (o: StackOffer) => (
    <AddToCartButton
      key={o.key}
      className="cta-stack-offer keycap"
      lines={o.lines}
      disabled={!o.available}
      flyImage={flyImage}
      onClick={() => {
        // Stack-builder engagement, distinct from the generic Add to
        // Cart that also fires: which pairings sell, from where.
        trackEvent('Stack Toggle', {
          props: {
            product: offerProduct(o),
            partner: o.key,
            surface: 'pdp',
            source: attributionSource(),
          },
        });
        onAdd?.();
      }}
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
  );
  return (
    <div className="cta-stack-group">
      {children}
      {/* Visible ruled sheet — desktop PDP. Hidden in the pinned bar (CSS),
          which falls back to the hover flyout below. */}
      {expanded ? (
        <div className="cta-stack-sheet" aria-label="Buy as a stack">
          {offers.map(renderOffer)}
        </div>
      ) : null}
      <div className="cta-stack-flyout" aria-label="Buy as a stack">
        {offers.map(renderOffer)}
      </div>
    </div>
  );
}
