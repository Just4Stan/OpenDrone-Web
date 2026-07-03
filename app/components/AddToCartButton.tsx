import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {flyToCart} from '~/lib/fly-to-cart';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  flyImage,
  className = 'btn-primary',
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
