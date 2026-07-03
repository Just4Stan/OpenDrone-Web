import {Link} from 'react-router';
import {Money, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {AddToCartButton} from './AddToCartButton';

/** A stack companion for a pod row: one candidate partner board, size-matched,
 *  with BOTH cart lines prebuilt so a single click orders the pair. */
export type PodCompanionOption = {
  key: string;
  /** Full name for tooltips/aria, e.g. "OpenESC · 20×20". */
  title: string;
  /** Chip label, e.g. "ESC" (renders as "+ESC"). */
  short: string;
  price?: {amount: string; currencyCode: string} | null;
  pct?: number;
  lines: OptimisticCartLineInput[];
  available: boolean;
  imageUrl?: string | null;
};

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
  /** When set, the row carries an always-visible buy cell: an ADD chip and,
   *  per companion, a "+ESC −10%" stack chip (both lines, one click). Hosts
   *  without it (the hero showcase) render exactly as before. */
  buy?: {
    lines: OptimisticCartLineInput[];
    available: boolean;
    flyImage?: string | null;
    companions?: PodCompanionOption[];
  };
};

type MoneyData = React.ComponentProps<typeof Money>['data'];

const fmt = (p?: {amount: string; currencyCode: string} | null) =>
  p
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: p.currencyCode,
      }).format(Number(p.amount))
    : '';

/**
 * A row/grid of product thumbnails — the SHARED content behind both the hero
 * product showcase and the header family dropdowns (one component, two mounts).
 * Each pod links to its PDP and emits its key on hover/focus so a host (the
 * hero) can spotlight the matching 3D model. Hover cue is brightness/opacity —
 * no underlines.
 *
 * Buyable rows (header dropdowns) render a fixed-width buy cell that exists
 * BEFORE any pointer event: an ADD chip and a stack chip with an overlapped
 * two-board glyph. Nothing appears, moves, or resizes on hover — the only
 * hover effect is color. Deal detail lives in an attr-driven tooltip.
 */
export function ProductPods({
  items,
  onHover,
  onAdd,
  layout = 'row',
}: {
  items: ProductPodItem[];
  /** Fired with the item key on hover/focus, and null on leave/blur. */
  onHover?: (key: string | null) => void;
  /** Fired after any add-to-cart in the pod (hosts close the menu + open
   *  the cart drawer). */
  onAdd?: () => void;
  layout?: 'row' | 'grid';
}) {
  return (
    <div className={`product-pods product-pods--${layout}`}>
      {items.map((it) => {
        const link = (
          <Link
            key={it.key}
            to={it.to}
            className="product-pod"
            prefetch="intent"
            viewTransition
            preventScrollReset
            onMouseEnter={it.buy ? undefined : () => onHover?.(it.key)}
            onMouseLeave={it.buy ? undefined : () => onHover?.(null)}
            onFocus={it.buy ? undefined : () => onHover?.(it.key)}
            onBlur={it.buy ? undefined : () => onHover?.(null)}
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
        );

        if (!it.buy) return link;

        return (
          <div
            key={it.key}
            className="product-pod-wrap"
            onMouseEnter={() => onHover?.(it.key)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(it.key)}
            onBlur={() => onHover?.(null)}
          >
            {link}
            <div
              className="product-pod-buy"
              role="group"
              aria-label={`Buy ${it.title}`}
            >
              <AddToCartButton
                className="pod-buy-add"
                lines={it.buy.lines}
                disabled={!it.buy.available}
                flyImage={it.buy.flyImage}
                onClick={onAdd}
                ariaLabel={`Add ${it.title} to cart`}
              >
                Add
              </AddToCartButton>
              {(it.buy.companions ?? []).map((o) => (
                <AddToCartButton
                  key={o.key}
                  className="pod-buy-stack"
                  lines={o.lines}
                  disabled={!o.available}
                  flyImage={o.imageUrl ?? it.buy?.flyImage}
                  onClick={onAdd}
                  ariaLabel={`Add ${it.title} and ${o.title} as a stack, ${
                    o.pct ?? 10
                  }% off at checkout`}
                  dataTip={
                    o.available
                      ? `${o.title} · +${fmt(o.price)} · −${o.pct ?? 10}% at checkout`
                      : 'Out of stock'
                  }
                >
                  {it.imageUrl && o.imageUrl ? (
                    <span className="pod-stack-glyph" aria-hidden="true">
                      <img
                        src={it.imageUrl}
                        alt=""
                        width={18}
                        height={18}
                        loading="lazy"
                      />
                      <img
                        src={o.imageUrl}
                        alt=""
                        width={18}
                        height={18}
                        loading="lazy"
                      />
                    </span>
                  ) : null}
                  <span className="pod-buy-stack-label">+{o.short}</span>
                  {o.pct ? (
                    <span className="pod-buy-stack-pct">−{o.pct}%</span>
                  ) : null}
                </AddToCartButton>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
