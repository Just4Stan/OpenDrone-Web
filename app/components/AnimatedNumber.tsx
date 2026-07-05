import {useEffect, useRef, useState} from 'react';
import {useInView, useReducedMotion} from 'motion/react';

/**
 * Count-up for spec strings: every numeric run in the value sweeps 0 → final
 * the first time it scrolls into view, non-numeric text stays put. Handles
 * mixed values ("20×20 mm", "3–6S", "3,3 V") — each number animates, decimal
 * places and comma-vs-dot separators are preserved. Values with no digits
 * render as-is.
 *
 * This is the site's React Bits "Count Up" equivalent — reuse it, don't copy
 * another one in.
 *
 * Runs once per mount; later value changes (variant spec deltas) swap the
 * text without re-counting — a settled table shouldn't spin on every click.
 * The server renders the final value, so SEO/no-JS never see zeros. Pair
 * with `tabular-nums` on the container (spec-table already has it) so digits
 * don't wobble mid-count. Hand-rolled RAF, so reduced-motion is checked here
 * rather than relying on the global MotionConfig.
 */
type Seg = {text: string; num?: number; decimals?: number; comma?: boolean};

function parse(value: string): Seg[] {
  const segs: Seg[] = [];
  const re = /\d+(?:[.,]\d+)?/g;
  let last = 0;
  for (const m of value.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) segs.push({text: value.slice(last, at)});
    const raw = m[0];
    const comma = raw.includes(',');
    const norm = raw.replace(',', '.');
    const dot = norm.indexOf('.');
    segs.push({
      text: raw,
      num: parseFloat(norm),
      decimals: dot === -1 ? 0 : norm.length - dot - 1,
      comma,
    });
    last = at + raw.length;
  }
  if (last < value.length) segs.push({text: value.slice(last)});
  return segs;
}

function formatSeg(n: number, seg: Seg): string {
  let out = n.toFixed(seg.decimals ?? 0);
  if (seg.comma) out = out.replace('.', ',');
  return out;
}

export function AnimatedNumber({
  value,
  className,
  duration = 800,
}: {
  value: string;
  className?: string;
  /** Count duration in ms. */
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, {once: true, margin: '0px 0px -8% 0px'});
  const [display, setDisplay] = useState(value);
  const played = useRef(false);

  // Variant switches merge new spec deltas over the table — swap the text
  // silently instead of re-counting.
  useEffect(() => {
    if (played.current) setDisplay(value);
  }, [value]);

  useEffect(() => {
    if (!inView || reduceMotion || played.current) return;
    played.current = true;
    const segs = parse(value);
    if (!segs.some((s) => s.num !== undefined)) return;
    let raf = 0;
    let start: number | null = null;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
    const frame = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        setDisplay(value);
        return;
      }
      const p = easeOut(t);
      setDisplay(
        segs
          .map((s) => (s.num === undefined ? s.text : formatSeg(s.num * p, s)))
          .join(''),
      );
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduceMotion, value, duration]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
