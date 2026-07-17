import {useNavigate} from 'react-router';
import {motion} from 'motion/react';
import {Check} from 'lucide-react';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {VariantContent} from '~/lib/product-content';

/**
 * Comparison ladder — the variant selector for a product *line*
 * (OpenRX: Lite/Lite-UFL/Mono/Gemini; OpenESC: 20×20/30×30). Each tier
 * is a card showing the cells that differ between variants; clicking a
 * card both updates the on-page preview (`onSelect`) and, when a matching
 * Shopify variant exists, navigates to select it so price/stock/cart
 * follow.
 *
 * Editorial (`variants`, keyed by option value) is the source of truth
 * for which tiers exist. Shopify wiring is matched in by name: we find
 * the option whose name equals `axis`, then the option value whose name
 * equals the editorial key (both case-insensitive, trimmed). Until those
 * Shopify variants exist the ladder still renders for preview and the
 * cart uses the product's single default variant.
 */
export function VariantLadder({
  axis,
  variants,
  productOptions,
  activeValue,
  onSelect,
  compact = false,
}: {
  axis: string;
  variants: Record<string, VariantContent>;
  productOptions: MappedProductOptions[];
  activeValue: string;
  onSelect: (value: string) => void;
  /** Compact mode: a single horizontal row of name-only pills (no axis label,
   *  tagline or spec cells) — for the pinned mobile buy bar where space is tight
   *  but variant switching still needs to be reachable. */
  compact?: boolean;
}) {
  const navigate = useNavigate();

  const norm = (s: string) => s.trim().toLowerCase();
  const shopifyOption = productOptions.find((o) => norm(o.name) === norm(axis));

  const tiers = Object.entries(variants).map(([value, content]) => {
    const optionValue = shopifyOption?.optionValues.find(
      (v) => norm(v.name) === norm(value),
    );
    return {value, content, optionValue};
  });

  return (
    <div
      className={`variant-ladder${compact ? ' variant-ladder--compact' : ''}`}
      role="radiogroup"
      aria-label={`${axis} options`}
    >
      {compact ? null : (
        <p className="variant-ladder-axis">
          {axis}
          <span className="variant-ladder-axis-hint">· pick your build</span>
        </p>
      )}
      <div className="variant-ladder-track">
        {tiers.map(({value, content, optionValue}) => {
          const selected = norm(value) === norm(activeValue);
          // Coming-soon: a designed model with no purchasable variant yet.
          // Editorial-only — greyed and non-selectable regardless of Shopify.
          const comingSoon = Boolean(content.comingSoon);
          // Sold-out only when Shopify actually has the variant and marks
          // it unavailable. Pre-setup (no matching option) stays selectable
          // for preview.
          const soldOut = Boolean(
            optionValue && optionValue.exists && !optionValue.available,
          );
          const disabled = comingSoon || soldOut;
          return (
            <button
              type="button"
              key={value}
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled}
              disabled={disabled}
              className={`variant-tier${selected ? ' is-selected' : ''}${
                comingSoon ? ' is-comingsoon' : soldOut ? ' is-soldout' : ''
              }`}
              onClick={() => {
                if (comingSoon) return;
                onSelect(value);
                if (optionValue?.variantUriQuery && !optionValue.selected) {
                  void navigate(`?${optionValue.variantUriQuery}`, {
                    replace: true,
                    preventScrollReset: true,
                  });
                }
              }}
            >
              {selected ? (
                <motion.span
                  className="variant-tier-glow"
                  layoutId="variant-tier-glow"
                  transition={{type: 'spring', stiffness: 380, damping: 34}}
                  aria-hidden="true"
                />
              ) : null}
              <span className="variant-tier-head">
                <span className="variant-tier-name">{content.label ?? value}</span>
                {comingSoon ? (
                  <span className="variant-tier-flag">Coming soon</span>
                ) : soldOut ? (
                  <span className="variant-tier-flag">Sold out</span>
                ) : selected ? (
                  <span className="variant-tier-flag is-selected" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              {compact ? null : content.tagline ? (
                <span className="variant-tier-tagline">{content.tagline}</span>
              ) : null}
              {/* Spec cells only on the selected tier: four cards each
                  carrying a full mono table read as a wall ("too busy"
                  feedback, 2026-07-17). The tagline keeps unselected tiers
                  comparable in prose; the full matrix lives in the Datasheet
                  chapter. */}
              {compact || !selected ? null : (
                <span className="variant-tier-cells">
                  {content.highlights.map(([k, v]) => (
                    <span className="variant-tier-cell" key={k}>
                      <span className="variant-tier-cell-k">{k}</span>
                      <span className="variant-tier-cell-v">{v}</span>
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
