/**
 * <PerfTierProvider> + usePerfTier() — the React surface over `perf-tier.ts`.
 *
 * The base tier is already on `<html data-perf-tier>` (set pre-paint by
 * PERF_INIT_SCRIPT). This provider takes that base and applies the two *dynamic*
 * downgrade reasons that can only be known after mount:
 *   - battery: unplugged + low → minimal (clears when plugged back in)
 *   - fps:     sustained measured jank → minimal (latched, never clears)
 *
 * Effective tier = the worst of {base, battery?, fps?}. It's written back onto
 * `<html data-perf-tier>` so CSS keeps reacting, and exposed via context so
 * components can branch (mount WebGL vs poster, etc.).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PERF_GLOBAL,
  PERF_TIER_ATTR,
  type PerfForce,
  type PerfSignals,
  type PerfTier,
  detectBaseTier,
  readForce,
  readSignals,
  worstTier,
  writeForce,
} from './perf-tier';

/** Flip to false to hide the corner debug readout. */
export const SHOW_PERF_HUD = true;

interface PerfState {
  /** Effective tier after dynamic downgrades — what surfaces should obey. */
  tier: PerfTier;
  /** Base tier in effect (= forced override, else detected), before battery/fps. */
  base: PerfTier;
  /** What auto-detection alone produced, ignoring any override. */
  detected: PerfTier;
  /** Active manual override (debug), or null when auto. */
  force: PerfForce;
  signals: PerfSignals;
  reasons: {battery: boolean; fps: boolean};
}

const DEFAULT_SIGNALS: PerfSignals = {
  cores: null,
  memory: null,
  reducedMotion: false,
  reducedData: false,
  effectiveType: null,
  webgl: true,
  renderer: null,
  software: false,
};

const FULL_DEFAULT: PerfState = {
  tier: 'full',
  base: 'full',
  detected: 'full',
  force: null,
  signals: DEFAULT_SIGNALS,
  reasons: {battery: false, fps: false},
};

const PerfContext = createContext<PerfState>(FULL_DEFAULT);

export function usePerfTier(): PerfState {
  return useContext(PerfContext);
}

/**
 * Force a tier (debug) or clear with null, then reload — the cleanest way to see
 * a fallback authentically, since `shouldLoadHero()` decides at module eval and
 * the WebGL chunk is requested before React mounts. A live attribute flip would
 * re-gate the CSS but not re-run that load path.
 */
export function forceTierAndReload(force: PerfForce): void {
  writeForce(force);
  if (typeof location !== 'undefined') location.reload();
}

/** Read what the init script stashed; recompute if it didn't run (tests/SSR). */
function readInitial(): {
  base: PerfTier;
  detected: PerfTier;
  force: PerfForce;
  signals: PerfSignals;
} {
  if (typeof window !== 'undefined') {
    const g = (window as unknown as Record<string, unknown>)[PERF_GLOBAL] as
      | {base?: PerfTier; detected?: PerfTier; force?: PerfForce; signals?: PerfSignals}
      | undefined;
    if (g?.base && g.signals) {
      return {
        base: g.base,
        detected: g.detected ?? g.base,
        force: g.force ?? null,
        signals: g.signals,
      };
    }
    const signals = readSignals();
    const detected = detectBaseTier(signals);
    const force = readForce();
    return {base: force ?? detected, detected, force, signals};
  }
  return {base: 'full', detected: 'full', force: null, signals: DEFAULT_SIGNALS};
}

export function PerfTierProvider({children}: {children: React.ReactNode}) {
  const [base, setBase] = useState<PerfTier>('full');
  const [detected, setDetected] = useState<PerfTier>('full');
  const [force, setForce] = useState<PerfForce>(null);
  const [signals, setSignals] = useState<PerfSignals>(DEFAULT_SIGNALS);
  const [reasons, setReasons] = useState({battery: false, fps: false});

  // Hydrate from the pre-paint detection on mount (keeps SSR === first render).
  useEffect(() => {
    const init = readInitial();
    setBase(init.base);
    setDetected(init.detected);
    setForce(init.force);
    setSignals(init.signals);
    // Console API for quick poking: __odPerfForce('minimal') etc.
    (window as unknown as Record<string, unknown>).__odPerfForce = forceTierAndReload;
  }, []);

  const tier = worstTier(
    base,
    reasons.battery ? 'minimal' : 'full',
    reasons.fps ? 'minimal' : 'full',
  );

  // Mirror the effective tier back onto <html> so CSS gates track dynamic
  // downgrades too (the init script only wrote the base).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(PERF_TIER_ATTR, tier);
  }, [tier]);

  // Battery: downgrade while unplugged + low; restore on plug-in. Chromium-only;
  // absent elsewhere (the .catch / missing API just leaves battery reason false).
  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        charging: boolean;
        level: number;
        addEventListener: (t: string, l: () => void) => void;
        removeEventListener: (t: string, l: () => void) => void;
      }>;
    };
    if (typeof nav.getBattery !== 'function') return;
    let battery: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;
    let cancelled = false;
    const evaluate = () => {
      if (!battery) return;
      const low = !battery.charging && battery.level < 0.2;
      setReasons((r) => (r.battery === low ? r : {...r, battery: low}));
    };
    nav.getBattery!()
      .then((b) => {
        if (cancelled) return;
        battery = b;
        b.addEventListener('levelchange', evaluate);
        b.addEventListener('chargingchange', evaluate);
        evaluate();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener('levelchange', evaluate);
        battery.removeEventListener('chargingchange', evaluate);
      }
    };
  }, []);

  // Runtime FPS probe — the only correction path (no user override). Runs only
  // while the tier is still 'full' (nothing to gain once degraded). Measures
  // frame deltas, ignoring idle gaps (>100ms — demand-loop scenes idle at 0 cost
  // and a tab switch leaves a huge delta). If a window is mostly janky for a few
  // windows in a row, latch down to 'minimal' and stop measuring.
  const probeStop = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (tier !== 'full' || reasons.fps) return;
    if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) return;

    const WINDOW = 60; // frames per evaluation window
    const JANK_MS = 22; // ~< 45fps
    const IDLE_MS = 100; // above this, treat as idle gap and skip the frame
    const BAD_FRAC = 0.5; // window is "bad" if this fraction of frames janked
    const BAD_WINDOWS = 3; // consecutive bad windows before downgrading

    let raf = 0;
    let last = 0;
    let counted = 0;
    let jank = 0;
    let badRun = 0;
    let stopped = false;

    const tick = (t: number) => {
      if (stopped) return;
      if (last && document.hasFocus() && !document.hidden) {
        const dt = t - last;
        if (dt <= IDLE_MS) {
          counted++;
          if (dt > JANK_MS) jank++;
          if (counted >= WINDOW) {
            const bad = jank / counted >= BAD_FRAC;
            badRun = bad ? badRun + 1 : 0;
            counted = 0;
            jank = 0;
            if (badRun >= BAD_WINDOWS) {
              setReasons((r) => ({...r, fps: true}));
              return; // latched; effect re-runs, sees reasons.fps, bails
            }
          }
        } else {
          // idle gap — reset the partial window so it doesn't count stale frames
          counted = 0;
          jank = 0;
        }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    probeStop.current = () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [tier, reasons.fps]);

  const value = useMemo<PerfState>(
    () => ({tier, base, detected, force, signals, reasons}),
    [tier, base, detected, force, signals, reasons],
  );

  return (
    <PerfContext.Provider value={value}>
      {children}
      {SHOW_PERF_HUD ? <PerfTierDebug /> : null}
    </PerfContext.Provider>
  );
}

const TIER_COLOR: Record<PerfTier, string> = {
  full: '#39d353',
  minimal: '#e3b341',
  static: '#f85149',
};

/**
 * Fixed-corner debug panel: live tier + the raw signals, a force-tier switch
 * (Auto/Full/Min/Static — reloads to exercise the real load path), and a live
 * FPS / frame-time readout so you can watch the runtime probe while throttling.
 */
function PerfTierDebug() {
  const {tier, base, detected, force, signals, reasons} = usePerfTier();
  const [open, setOpen] = useState(false);
  const fps = useFps(open); // only sample while expanded — no idle cost
  const color = TIER_COLOR[tier];

  const forceBtn = (label: string, value: PerfForce) => {
    const activeForce = value === force; // null === null → Auto active
    return (
      <button
        key={label}
        onClick={(e) => {
          e.stopPropagation();
          forceTierAndReload(value);
        }}
        style={{
          font: 'inherit',
          color: activeForce ? '#0d1117' : '#e6edf3',
          background: activeForce ? (value ? TIER_COLOR[value] : '#8b949e') : 'transparent',
          border: '1px solid #30363d',
          borderRadius: 4,
          padding: '2px 6px',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setOpen((o) => !o);
      }}
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 2147483647,
        font: '11px/1.45 ui-monospace, monospace',
        color: '#e6edf3',
        background: 'rgba(13,17,23,0.9)',
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: open ? '8px 10px' : '3px 8px',
        cursor: 'pointer',
        userSelect: 'none',
        maxWidth: 300,
        backdropFilter: 'blur(4px)',
      }}
      title="perf tier (click to expand)"
    >
      <span style={{color}}>●</span> perf: <b>{tier}</b>
      {force ? <span style={{opacity: 0.6}}> (forced)</span> : null}
      {!force && tier !== base ? (
        <span style={{opacity: 0.6}}> (base {base})</span>
      ) : null}
      {open ? (
        <div style={{marginTop: 6}}>
          <div style={{display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap'}}>
            {forceBtn('Auto', null)}
            {forceBtn('Full', 'full')}
            {forceBtn('Min', 'minimal')}
            {forceBtn('Static', 'static')}
          </div>
          <div style={{opacity: 0.85, whiteSpace: 'pre-wrap'}}>
            {`fps ${fps.fps}  frame ${fps.ms}ms${fps.worst > 0 ? `  worst ${fps.worst}ms` : ''}
detected ${detected}${force ? `  forced ${force}` : ''}
cores ${signals.cores ?? '?'}  mem ${signals.memory ?? '?'}GB
reduced-motion ${signals.reducedMotion}  reduced-data ${signals.reducedData}
net ${signals.effectiveType ?? '?'}  webgl ${signals.webgl}${signals.software ? ' (software!)' : ''}
gpu ${signals.renderer ? trim(signals.renderer) : '?'}
downgrades: ${[reasons.battery && 'battery', reasons.fps && 'fps'].filter(Boolean).join(', ') || 'none'}`}
          </div>
          <div style={{opacity: 0.5, marginTop: 4}}>
            console: __odPerfForce(&apos;minimal&apos;)
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Display-only FPS sampler (1s rolling) for the HUD. Active only when `on`. */
function useFps(on: boolean): {fps: number; ms: number; worst: number} {
  const [v, setV] = useState({fps: 0, ms: 0, worst: 0});
  useEffect(() => {
    if (!on || typeof window === 'undefined') return;
    let raf = 0;
    let last = 0;
    let frames = 0;
    let acc = 0;
    let worst = 0;
    let since = 0;
    const tick = (t: number) => {
      if (last) {
        const dt = t - last;
        frames++;
        acc += dt;
        if (dt < 200 && dt > worst) worst = dt; // ignore tab-switch gaps
        since += dt;
        if (since >= 500) {
          setV({
            fps: Math.round((frames / acc) * 1000),
            ms: Math.round((acc / frames) * 10) / 10,
            worst: Math.round(worst),
          });
          frames = 0;
          acc = 0;
          worst = 0;
          since = 0;
        }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return v;
}

function trim(s: string): string {
  return s.length > 38 ? s.slice(0, 37) + '…' : s;
}
