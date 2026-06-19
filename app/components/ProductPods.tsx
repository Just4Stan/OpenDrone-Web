import {Link} from 'react-router';
import {Money} from '@shopify/hydrogen';

export type ProductPodItem = {
  /** Stable key — a PDP handle, or a hero family id ('fc'/'esc'/'frame') the
   *  3D viewer uses to spotlight the matching mesh on hover. */
  key: string;
  to: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  price?: {amount: string; currencyCode: string} | null;
};

type MoneyData = React.ComponentProps<typeof Money>['data'];

/**
 * A row/grid of product thumbnails — the SHARED content behind both the hero
 * product showcase and the header family dropdowns (one component, two mounts).
 * Each pod links to its PDP and emits its key on hover/focus so a host (the
 * hero) can spotlight the matching 3D model. Hover cue is brightness/opacity —
 * no underlines.
 */
export function ProductPods({
  items,
  onHover,
  layout = 'row',
}: {
  items: ProductPodItem[];
  /** Fired with the item key on hover/focus, and null on leave/blur. */
  onHover?: (key: string | null) => void;
  layout?: 'row' | 'grid';
}) {
  return (
    <div className={`product-pods product-pods--${layout}`}>
      {items.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className="product-pod"
          prefetch="intent"
          viewTransition
          preventScrollReset
          onMouseEnter={() => onHover?.(it.key)}
          onMouseLeave={() => onHover?.(null)}
          onFocus={() => onHover?.(it.key)}
          onBlur={() => onHover?.(null)}
        >
          <span className="product-pod-media">
            {it.imageUrl ? (
              <img
                src={it.imageUrl}
                alt={it.imageAlt ?? ''}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="product-pod-media-ph" aria-hidden="true" />
            )}
          </span>
          <span className="product-pod-text">
            <span className="product-pod-title">{it.title}</span>
            {it.subtitle ? (
              <span className="product-pod-subtitle">{it.subtitle}</span>
            ) : null}
          </span>
          {it.price ? (
            <span className="product-pod-price">
              <Money data={it.price as MoneyData} />
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
