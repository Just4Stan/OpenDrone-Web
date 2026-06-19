import {useEffect, useRef, useState} from 'react';
import {animate, motion, useMotionValue, useReducedMotion} from 'motion/react';

const SIZES = ['5', '3'] as const;
type Size = (typeof SIZES)[number];

const PAD = 4; // px — must match .hero-size-slider padding in app.css

/**
 * Airframe size control for the hero. Reads as a physical sled: a gold thumb
 * you drag between 5″ and 3″. Crossing the midpoint *commits* the size, which
 * is what fires HeroScene's cross-slide — so the thumb and the airframe's
 * fly-out/fly-in move together, as if you pulled the new size into frame.
 *
 * The two labels are real buttons underneath the thumb, so the control works
 * by click + keyboard with no drag at all (the drag is a pointer enhancement).
 * Reduced-motion snaps instead of springing.
 */
export function HeroSizeSlider({
  value,
  onChange,
}: {
  value: Size;
  onChange: (v: Size) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const reduce = useReducedMotion();

  // Distance the thumb travels from the 5″ slot to the 3″ slot. The thumb is
  // exactly half the inner width, so travel === innerWidth / 2.
  const travel = () => {
    const el = trackRef.current;
    if (!el) return 0;
    return (el.clientWidth - PAD * 2) / 2;
  };
  const targetX = (v: Size) => (v === '5' ? 0 : travel());

  // Park the thumb on the committed side whenever the value changes from the
  // outside (click, keyboard, or a drag commit) — but never while dragging,
  // so the finger stays in control.
  useEffect(() => {
    if (dragging) return;
    const dest = targetX(value);
    if (reduce) {
      x.set(dest);
      return;
    }
    const controls = animate(x, dest, {
      type: 'spring',
      stiffness: 360,
      damping: 34,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dragging, reduce]);

  // While dragging, commit as soon as the thumb crosses the midpoint (with a
  // little hysteresis so it doesn't flicker right at 50%). Committing mid-drag
  // is what makes the airframe start flying while your finger is still moving.
  function onDrag() {
    const t = travel();
    if (t <= 0) return;
    const frac = x.get() / t;
    const next: Size = frac > 0.55 ? '3' : frac < 0.45 ? '5' : value;
    if (next !== value) onChange(next);
  }

  return (
    <div
      className="hero-size-slider"
      role="group"
      aria-label="Airframe size"
      ref={trackRef}
    >
      <motion.div
        className="hero-size-slider__thumb"
        aria-hidden="true"
        style={{x}}
        drag="x"
        dragConstraints={trackRef}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={() => setDragging(true)}
        onDrag={onDrag}
        onDragEnd={() => setDragging(false)}
        whileTap={{scale: 0.97}}
      />
      {SIZES.map((s) => (
        <button
          key={s}
          type="button"
          className={`hero-size-slider__opt${value === s ? ' is-active' : ''}`}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
        >
          {s}
          <span aria-hidden="true">&Prime;</span>
        </button>
      ))}
    </div>
  );
}
