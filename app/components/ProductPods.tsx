import {useState} from 'react';
import {Link} from 'react-router';
import {Money} from '@shopify/hydrogen';
import {AddToCartButton} from './AddToCartButton';

/** A companion offer cascaded from a pod row ("also add an ESC?"): one
 *  candidate partner board, size-matched, with BOTH cart lines prebuilt. */
export type PodCompanionOption = {
  key: string;
  title: string;
  price?: {amount: string; currencyCode: string} | null;
  pct?: number;
  lines: Array<{merchandiseId: string; quantity: number}>;
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
  /** When set, hovering the row reveals an "Add to cart?" action (and, with
   *  companions, an "also add an X ▸" cascade) instead of being link-only.
   *  Hosts without it (the hero showcase) render exactly as before. */
  buy?: {
    lines: Array<{merchandiseId: string; quantity: number}>;
    available: boolean;
    flyImage?: string | null;
    companions?: {
      /** Cascade trigger text, e.g. "also add an ESC". */
      label: string;
      options: PodCompanionOption[];
    };
  };
};

type MoneyData = React.ComponentProps<typeof Money>['data'];

/**
 * A row/grid of product thumbnails — the SHARED content behind both the hero
 * product showcase and the header family dropdowns (one component, two mounts).
 * Each pod links to its PDP and emits its key on hover/focus so a host (the
 * hero) can spotlight the matching 3D model. Hover cue is brightness/opacity —
 * no underlines.
 *
 * Rows with `buy` grow a hover action strip: "Add to cart?" plus an optional
 * companion cascade that opens a nested panel to pick the paired board (both
 * lines added in one click; the stack discount applies at checkout).
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
  // Which row's companion cascade is open. Hover-driven with a click
  // fallback; leaving the row closes it (the panel lives inside the row
  // wrapper, so moving the pointer into the panel keeps it open).
  const [companionFor, setCompanionFor] = useState<string | null>(null);

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

        const companions = it.buy.companions;
        const cascadeOpen = companionFor === it.key;
        return (
          <div
            key={it.key}
            className={`product-pod-wrap${cascadeOpen ? ' is-cascade-open' : ''}`}
            onMouseEnter={() => onHover?.(it.key)}
            onMouseLeave={() => {
              onHover?.(null);
              setCompanionFor(null);
            }}
            onFocus={() => onHover?.(it.key)}
            onBlur={() => onHover?.(null)}
          >
            {link}
            {/* Actions fly out HORIZONTALLY to the right of the row (submenu
                style) so sibling rows never get pushed apart; the companion
                panel chains further right off the actions strip. */}
            <div className="product-pod-actions">
              <AddToCartButton
                className="product-pod-add"
                lines={it.buy.lines}
                disabled={!it.buy.available}
                flyImage={it.buy.flyImage}
                onClick={onAdd}
              >
                Add to cart?
              </AddToCartButton>
              {companions && companions.options.length > 0 ? (
                <button
                  type="button"
                  className="product-pod-cascade-toggle"
                  aria-expanded={cascadeOpen}
                  onMouseEnter={() => setCompanionFor(it.key)}
                  onClick={() => setCompanionFor(cascadeOpen ? null : it.key)}
                >
                  {companions.label} <span aria-hidden="true">▸</span>
                </button>
              ) : null}
              {cascadeOpen && companions ? (
                <div className="product-pod-companions" role="menu">
                  <p className="product-pod-companions-head">
                    Stack it · one order
                    {companions.options[0]?.pct
                      ? ` · −${companions.options[0].pct}% at checkout`
                      : ''}
                  </p>
                  {companions.options.map((o) => (
                    <AddToCartButton
                      key={o.key}
                      className="product-pod-companion"
                      lines={o.lines}
                      disabled={!o.available}
                      flyImage={o.imageUrl ?? it.buy?.flyImage}
                      onClick={() => {
                        setCompanionFor(null);
                        onAdd?.();
                      }}
                    >
                      {o.imageUrl ? (
                        <img
                          src={o.imageUrl}
                          alt=""
                          width={52}
                          height={52}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <span className="product-pod-companion-title">
                        {o.title}
                      </span>
                      {o.price ? (
                        <span className="product-pod-companion-price">
                          +<Money data={o.price as MoneyData} />
                        </span>
                      ) : null}
                      {o.pct ? (
                        <span className="product-pod-companion-pct">
                          −{o.pct}%
                        </span>
                      ) : null}
                    </AddToCartButton>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
