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
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  /** Product/variant image that flies into the cart icon on add. */
  flyImage?: string | null;
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
                if (!(disabled ?? pending)) {
                  flyToCart(
                    e.currentTarget.getBoundingClientRect(),
                    flyImage,
                  );
                }
                onClick?.();
              }}
              disabled={disabled ?? pending}
              aria-busy={pending || undefined}
              data-pending={pending || undefined}
              className="btn-primary"
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
