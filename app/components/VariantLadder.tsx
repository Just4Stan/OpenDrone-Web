import {useRef} from 'react';
import {useNavigate} from 'react-router';
import {AnimatePresence, motion} from 'motion/react';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {VariantContent} from '~/lib/product-content';
import {EASE, DURATION} from '~/lib/motion';

/**
 * Comparison slider — the variant selector for a product *line*
 * (OpenRX: Lite/Lite-UFL/Mono/Gemini; OpenESC: 20×20/30×30; OpenFrame: 5″/3″).
 *
 * It reads as one physical control: a segmented toggle whose gold thumb
 * *slides* between options (Motion `layoutId`), and a single spec panel below
 * it that the chosen variant's details get *pulled into frame* from the side
 * you tapped (direction-aware `AnimatePresence`). Picking a tier updates the
 * on-page preview (`onSelect`) and, when a matching Shopify variant exists,
 * navigates to select it so price/stock/cart follow.
 *
 * Editorial (`variants`, keyed by option value) is the source of truth for
 * which tiers exist. Shopify wiring is matched in by name: the option whose
 * name equals `axis`, then the option value whose name equals the editorial
 * key (both case-insensitive, trimmed). Reduced-motion is honoured globally
 * via <MotionConfig reducedMotion="user">, which collapses the slide to a fade.
 */
export function VariantLadder({
  axis,
  variants,
  productOptions,
  activeValue,
  onSelect,
}: {
  axis: string;
  variants: Record<string, VariantContent>;
  productOptions: MappedProductOptions[];
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  const navigate = useNavigate();

  const norm = (s: string) => s.trim().toLowerCase();
  const shopifyOption = productOptions.find((o) => norm(o.name) === norm(axis));

  const tiers = Object.entries(variants).map(([value, content]) => {
    const optionValue = shopifyOption?.optionValues.find(
      (v) => norm(v.name) === norm(value),
    );
    const comingSoon = Boolean(content.comingSoon);
    const soldOut = Boolean(
      optionValue && optionValue.exists && !optionValue.available,
    );
    return {value, content, optionValue, comingSoon, soldOut, disabled: comingSoon || soldOut};
  });

  const activeIndex = Math.max(
    0,
    tiers.findIndex((t) => norm(t.value) === norm(activeValue)),
  );
  const active = tiers[activeIndex] ?? tiers[0];
  // Slide direction: +1 if the new pick sits to the right of the old one,
  // −1 to the left. Drives which edge the spec panel is pulled in from.
  const dir = useRef(0);

  function pick(idx: number) {
    const t = tiers[idx];
    if (!t || t.disabled || idx === activeIndex) return;
    dir.current = idx > activeIndex ? 1 : -1;
    onSelect(t.value);
    if (t.optionValue?.variantUriQuery && !t.optionValue.selected) {
      void navigate(`?${t.optionValue.variantUriQuery}`, {
        replace: true,
        preventScrollReset: true,
      });
    }
  }

  // Arrow-key navigation across enabled segments (proper radiogroup behaviour).
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    let i = activeIndex;
    for (let n = 0; n < tiers.length; n++) {
      i = (i + step + tiers.length) % tiers.length;
      if (!tiers[i].disabled) {
        pick(i);
        break;
      }
    }
  }

  return (
    <div className="variant-ladder">
      <p className="variant-ladder-axis">
        {axis}
        <span className="variant-ladder-axis-hint">· pick your build</span>
      </p>

      <div
        className="variant-toggle"
        role="radiogroup"
        aria-label={`${axis} options`}
      >
        {tiers.map((t, idx) => {
          const selected = idx === activeIndex;
          return (
            <button
              type="button"
              key={t.value}
              role="radio"
              aria-checked={selected}
              aria-disabled={t.disabled}
              disabled={t.disabled}
              tabIndex={selected ? 0 : -1}
              className={`variant-toggle-seg${selected ? ' is-selected' : ''}${
                t.comingSoon ? ' is-comingsoon' : t.soldOut ? ' is-soldout' : ''
              }`}
              onClick={() => pick(idx)}
              onKeyDown={onKeyDown}
            >
              {selected ? (
                <motion.span
                  className="variant-toggle-thumb"
                  layoutId="variant-toggle-thumb"
                  aria-hidden="true"
                  transition={{type: 'spring', stiffness: 420, damping: 34}}
                />
              ) : null}
              <span className="variant-toggle-label">
                {t.content.label ?? t.value}
              </span>
              {t.comingSoon ? (
                <span className="variant-toggle-flag">soon</span>
              ) : t.soldOut ? (
                <span className="variant-toggle-flag">sold out</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="variant-panel">
        <AnimatePresence mode="popLayout" custom={dir.current} initial={false}>
          <motion.div
            key={active.value}
            className="variant-panel-inner"
            custom={dir.current}
            variants={PANEL_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{duration: DURATION.base, ease: [...EASE.out]}}
          >
            {active.content.tagline ? (
              <p className="variant-panel-tagline">{active.content.tagline}</p>
            ) : null}
            <div className="variant-panel-cells">
              {active.content.highlights.map(([k, v]) => (
                <div className="variant-panel-cell" key={k}>
                  <span className="variant-panel-cell-k">{k}</span>
                  <span className="variant-panel-cell-v">{v}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * The incoming panel is pulled in from the side the user moved toward; the
 * outgoing one leaves the opposite way. Travel is small (40px) — a pull, not
 * a fling.
 */
const PANEL_VARIANTS = {
  enter: (d: number) => ({opacity: 0, x: d >= 0 ? 40 : -40}),
  center: {opacity: 1, x: 0},
  exit: (d: number) => ({opacity: 0, x: d >= 0 ? -40 : 40}),
};
