import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {Link} from 'react-router';
import {animate, motion, useMotionValue, useReducedMotion} from 'motion/react';
import {SPRING} from '~/lib/motion';

/**
 * SegmentedControl — the TITLE-BLOCK flick switch / sheet-tab primitive.
 *
 * Generalizes the drag + snap + ink-flip physics of HeroSizeSlider: real
 * buttons (or nav Links) sit UNDER a sled thumb that carries the active label
 * in strong ink. The two labels are always real, focusable controls, so the
 * whole thing works by click + keyboard with no pointer drag — the drag is a
 * pure enhancement for the 2-position case (the hero size tabs), gated behind
 * `enableDrag`.
 *
 * Motion vocabulary (app/lib/motion.ts):
 *  - discrete click / value-change transitions settle with SPRING.detent
 *    (stiff, ≤1px overshoot — reads as a mechanical click, not a bounce);
 *  - a drag release glides home with the looser SPRING.sled.
 * Reduced motion (global MotionConfig reducedMotion="user") is respected
 * explicitly: the imperative `animate()` calls don't auto-degrade, so we snap
 * the sled to position instead (mirrors HeroSizeSlider).
 *
 * Skin: track may use --r-pill (the sanctioned moving-part radius exception);
 * everything else is hairline + tokens, both themes. Consumers retune via the
 * `--seg-*` custom properties.
 */

const PAD = 4; // px — must match --seg-pad below.

const useIsoLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;

export type SegmentDef<T extends string> = {
  value: T;
  /** Rendered on the resting button AND on the sled when this segment is
   *  active. Text or an icon — never authored prose beyond existing copy. */
  label: ReactNode;
  /** Per-control accessible name (the group itself is labelled via ariaLabel). */
  ariaLabel?: string;
  /** When set the segment renders as a navigation <Link> (e.g. the locale
   *  switch) instead of a <button>; onChange is not called for these. */
  href?: string;
  /** Side effect fired on activation (cookie write, etc.). */
  onSelect?: () => void;
};

export type SegmentedControlProps<T extends string> = {
  segments: ReadonlyArray<SegmentDef<T>>;
  value: T;
  /** Fired when a button segment is chosen. Omitted for pure-nav (href) sets. */
  onChange?: (value: T, event?: ReactMouseEvent) => void;
  /** Accessible name for the whole group. */
  ariaLabel: string;
  className?: string;
  /** Compact icon switch (theme toggle). */
  compact?: boolean;
  /** Enable the 1:1 drag scrub. Only honoured for exactly two segments. */
  enableDrag?: boolean;
  /** Hero graft: commit the target on drag-start (so a cross-slide can set up),
   *  reverting on release short of the midpoint. Off ⇒ commit only on release. */
  commitOnDragStart?: boolean;
  /** Hero graft: the live drag fraction (0→1) is written here every frame. */
  scrubRef?: RefObject<number | null>;
};

const SEGMENTED_STYLE = `
.segmented{
  --seg-pad:${PAD}px;
  --seg-radius:var(--r-pill);
  --seg-sled-bg:var(--color-bg-elevated);
  position:relative;
  display:inline-flex;
  align-items:stretch;
  padding:var(--seg-pad);
  border:1px solid var(--color-border);
  border-radius:var(--seg-radius);
  background:var(--color-bg-card);
  user-select:none;
  -webkit-user-select:none;
}
.segmented--draggable{touch-action:none;}
.segmented__sled{
  position:absolute;
  z-index:2;
  top:var(--seg-pad);
  bottom:var(--seg-pad);
  left:var(--seg-pad);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:calc(var(--seg-radius) - 1px);
  background:var(--seg-sled-bg);
  box-shadow:0 0 0 1px var(--color-border-strong);
  pointer-events:none;
}
.segmented--draggable .segmented__sled{pointer-events:auto;cursor:grab;}
.segmented--draggable .segmented__sled:active{cursor:grabbing;}
.segmented__sled-label{
  display:inline-flex;align-items:center;justify-content:center;
  color:var(--color-text);
  font-family:var(--font-mono);
  font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;
  font-variant-numeric:tabular-nums slashed-zero;
  pointer-events:none;white-space:nowrap;
}
.segmented__opt{
  position:relative;z-index:1;
  flex:1 1 0;
  display:inline-flex;align-items:center;justify-content:center;
  min-height:32px;
  padding:0.4rem 0.9rem;
  border:0;background:transparent;
  color:var(--color-text-muted);
  font-family:var(--font-mono);
  font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;
  font-variant-numeric:tabular-nums slashed-zero;
  text-decoration:none;white-space:nowrap;cursor:pointer;
  transition:color .15s ease;
}
.segmented__opt:hover{color:var(--color-text);}
.segmented__opt.is-active{color:var(--color-text);}
.segmented__opt:focus-visible{outline:2px solid var(--color-gold);outline-offset:3px;border-radius:2px;}
.segmented--compact .segmented__opt{min-width:40px;padding:0.3rem 0.5rem;}
.segmented--compact .segmented__opt svg{display:block;}
.segmented--compact .segmented__sled-label svg{display:block;}
@media (max-width:768px){
  .segmented__opt{min-height:44px;}
  .segmented--compact .segmented__opt{min-width:44px;}
}
`;

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
  className,
  compact = false,
  enableDrag = false,
  commitOnDragStart = false,
  scrubRef,
}: SegmentedControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  const didMount = useRef(false);
  const skipPark = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<T | null>(null);

  const n = segments.length;
  const draggable = enableDrag && n === 2;

  const indexOf = (v: T) => {
    const i = segments.findIndex((s) => s.value === v);
    return i < 0 ? 0 : i;
  };
  // Per-segment travel in px, measured from the laid-out track (mirrors
  // HeroSizeSlider's `travel`).
  const segW = () => {
    const el = trackRef.current;
    if (!el) return 0;
    return (el.clientWidth - PAD * 2) / n;
  };
  const slotX = (v: T) => indexOf(v) * segW();

  // Drag bookkeeping (2-position only).
  const other = (v: T): T => segments.find((s) => s.value !== v)?.value ?? v;
  const fromRef = useRef<T>(value);
  const targetRef = useRef<T>(other(value));

  // Park the sled on the committed value when it changes outside a drag. First
  // mount (or reduced motion) snaps; subsequent changes settle with the crisp
  // detent. A just-ended drag sets skipPark so its own sled glide isn't
  // overridden here.
  useIsoLayoutEffect(() => {
    if (dragging) return;
    if (skipPark.current) {
      skipPark.current = false;
      return;
    }
    const dest = slotX(value);
    if (reduce || !didMount.current) {
      x.set(dest);
      didMount.current = true;
      return;
    }
    const controls = animate(x, dest, SPRING.detent);
    return () => controls.stop();
  }, [value, dragging, reduce, n]);

  // Keep the sled aligned across container resizes (px offsets go stale).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (!dragging) x.set(slotX(value));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dragging, n]);

  function onDragStart() {
    const from = value;
    fromRef.current = from;
    targetRef.current = other(from);
    setDragging(true);
    setPreview(from);
    if (scrubRef) scrubRef.current = 0;
    if (commitOnDragStart) onChange?.(targetRef.current);
  }

  function onDrag() {
    const w = segW();
    if (w <= 0) return;
    const frac = Math.min(
      1,
      Math.max(0, Math.abs(x.get() - slotX(fromRef.current)) / w),
    );
    if (scrubRef) scrubRef.current = frac;
    const side = frac > 0.5 ? targetRef.current : fromRef.current;
    setPreview((p) => (p === side ? p : side));
  }

  function onDragEnd() {
    const w = segW();
    const frac =
      w > 0 ? Math.abs(x.get() - slotX(fromRef.current)) / w : 0;
    const final = frac > 0.5 ? targetRef.current : fromRef.current;
    if (scrubRef) scrubRef.current = null;
    skipPark.current = true;
    setDragging(false);
    setPreview(null);
    if (reduce) x.set(slotX(final));
    else animate(x, slotX(final), SPRING.sled);
    onChange?.(final);
  }

  const active = preview ?? value;
  const activeSeg =
    segments.find((s) => s.value === active) ?? segments[indexOf(value)];
  const sledWidth = `calc((100% - ${PAD * 2}px) / ${n})`;

  return (
    <div
      ref={trackRef}
      className={`segmented${compact ? ' segmented--compact' : ''}${
        draggable ? ' segmented--draggable' : ''
      }${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      <motion.div
        className="segmented__sled"
        aria-hidden="true"
        style={{x, width: sledWidth}}
        {...(draggable
          ? {
              drag: 'x' as const,
              dragConstraints: trackRef,
              dragElastic: 0.04,
              dragMomentum: false,
              onDragStart,
              onDrag,
              onDragEnd,
              whileTap: {scale: 0.97},
            }
          : {})}
      >
        <span className="segmented__sled-label">{activeSeg?.label}</span>
      </motion.div>

      {segments.map((s) => {
        const isActive = s.value === active;
        const optClass = `segmented__opt${isActive ? ' is-active' : ''}`;
        if (s.href) {
          return (
            <Link
              key={s.value}
              to={s.href}
              className={optClass}
              aria-label={s.ariaLabel}
              aria-pressed={isActive}
              data-active={isActive ? 'true' : undefined}
              preventScrollReset
              prefetch="viewport"
              onClick={() => s.onSelect?.()}
            >
              {s.label}
            </Link>
          );
        }
        return (
          <button
            key={s.value}
            type="button"
            className={optClass}
            aria-label={s.ariaLabel}
            aria-pressed={isActive}
            onClick={(e) => {
              s.onSelect?.();
              onChange?.(s.value, e);
            }}
          >
            {s.label}
          </button>
        );
      })}

      <style>{SEGMENTED_STYLE}</style>
    </div>
  );
}
