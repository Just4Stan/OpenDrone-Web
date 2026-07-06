import {useEffect, useRef} from 'react';
import {useFetcher, type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {flyToCart} from '~/lib/fly-to-cart';
import {trackEvent} from '~/lib/growth/plausible';
import {
  attributionSource,
  getAttribution,
  markAttributionSent,
  wasAttributionSent,
} from '~/lib/growth/attribution';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  flyImage,
  className = 'btn-primary',
  ariaLabel,
  dataTip,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  /** Product/variant image that flies into the cart icon on add. */
  flyImage?: string | null;
  /** Button class — defaults to the primary CTA; stack/quick-add surfaces
   *  pass their own compact pill styles. */
  className?: string;
  ariaLabel?: string;
  /** Attr-driven CSS tooltip content (see .pod-buy-stack[data-tip]). */
  dataTip?: string;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => {
        const pending = fetcher.state !== 'idle';
        return (
          <>
            <input
              name="analytics"
              type="hidden"
              value={JSON.stringify(analytics)}
            />
            <AddToCartTracking fetcher={fetcher} lines={lines} />
            <button
              type="submit"
              onClick={(e) => {
                if (!(disabled || pending)) {
                  flyToCart(
                    e.currentTarget.getBoundingClientRect(),
                    flyImage,
                  );
                }
                // Drop focus after the click so :focus-within doesn't pin
                // hover-revealed quick-add UI open once the pointer leaves.
                e.currentTarget.blur();
                onClick?.();
              }}
              disabled={disabled || pending}
              aria-label={ariaLabel}
              data-tip={dataTip}
              aria-busy={pending || undefined}
              data-pending={pending || undefined}
              className={className}
            >
              <span className="btn-label">{pending ? 'Adding…' : children}</span>
              {pending ? <span className="btn-spinner" aria-hidden="true" /> : null}
            </button>
          </>
        );
      }}
    </CartForm>
  );
}

/** Low-cardinality product identifier for event props. */
function lineProduct(lines: Array<OptimisticCartLineInput>): string {
  const variant = lines[0]?.selectedVariant as
    | {sku?: string | null; product?: {handle?: string | null} | null}
    | null
    | undefined;
  return variant?.product?.handle ?? variant?.sku ?? 'unknown';
}

/**
 * Invisible side-channel on the LinesAdd fetcher. On each completed,
 * successful add it (a) fires the `Add to Cart` funnel event and (b) on
 * the FIRST add of the session promotes the first-touch attribution into
 * cart attributes via the allowlisted AttributesUpdate action — the
 * sessionStorage latch makes it once-per-session, so later adds and
 * re-renders never re-submit.
 */
function AddToCartTracking({
  fetcher,
  lines,
}: {
  fetcher: FetcherWithComponents<any>;
  lines: Array<OptimisticCartLineInput>;
}) {
  const attributesFetcher = useFetcher();
  const prevState = useRef(fetcher.state);
  // Snapshot lines in a ref so the transition effect doesn't need them in
  // its dependency list (their identity changes every render).
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    const was = prevState.current;
    prevState.current = fetcher.state;
    // Only act on the submit → idle transition of a successful add.
    if (fetcher.state !== 'idle' || was === 'idle') return;
    if (!fetcher.data?.cart?.id) return;

    trackEvent('Add to Cart', {
      props: {
        product: lineProduct(linesRef.current),
        source: attributionSource(),
      },
    });

    const attribution = getAttribution();
    if (!attribution || wasAttributionSent()) return;
    markAttributionSent();
    // Underscore prefix: Shopify hides `_`-prefixed cart attributes from
    // the customer at checkout/order confirmation while still copying them
    // into order note_attributes for the webhook join.
    const attributes = [
      {key: '_utm_source', value: attribution.source},
      ...(attribution.medium
        ? [{key: '_utm_medium', value: attribution.medium}]
        : []),
      ...(attribution.campaign
        ? [{key: '_utm_campaign', value: attribution.campaign}]
        : []),
      {key: '_landing', value: attribution.landing},
    ];
    void attributesFetcher.submit(
      {
        [CartForm.INPUT_NAME]: JSON.stringify({
          action: CartForm.ACTIONS.AttributesUpdateInput,
          inputs: {attributes},
        }),
      },
      {method: 'post', action: '/cart'},
    );
  }, [fetcher.state, fetcher.data, attributesFetcher]);

  return null;
}
