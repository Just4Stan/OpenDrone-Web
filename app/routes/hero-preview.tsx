/**
 * Prototype of the scroll-driven hero, on its own route so it can be reviewed
 * beside the live homepage without touching it. Once approved, <HeroStage> is
 * what moves into _index.tsx.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {HeroDroneScene, type HeroBeat} from '~/components/HeroDroneScene';

/* The repo's existing hero refuses to load under 768px or under reduced motion
 * (_index.tsx shouldLoadHero). Match that: a 6 MB GLB with no touch handling is
 * pure cost on a phone, and a scroll-jacking auto-orbiting scene is close to
 * the worst case for vestibular disorders. */
function shouldLoad3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 768) return false;
  return true;
}

export default function HeroPreview() {
  // three.js touches window at module scope, so the scene only mounts client-side.
  const [mounted, setMounted] = useState(false);
  const [use3D, setUse3D] = useState(false);
  useEffect(() => {
    setMounted(true);
    setUse3D(shouldLoad3D());
  }, []);
  const seek = useRef<((i: number) => void) | null>(null);
  const onSeeker = useCallback((fn: (i: number) => void) => {
    seek.current = fn;
  }, []);

  const [beats, setBeats] = useState<HeroBeat[]>([]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const onBeat = useCallback((_b: HeroBeat, i: number) => setActive(i), []);
  const onBeats = useCallback((b: HeroBeat[]) => setBeats(b), []);
  const onReady = useCallback(() => setReady(true), []);
  // Progress fires every frame; keep it off React state to avoid a re-render
  // per frame, and write it straight to the DOM instead.
  const fillRef = useRef<HTMLDivElement>(null);
  const onProgress = useCallback((f: number) => {
    if (fillRef.current) fillRef.current.style.height = `${Math.max(0, Math.min(1, f)) * 100}%`;
  }, []);
  const beat = beats[active];

  return (
    <main className="hp">
      <section className="hp-stage">
        {mounted && use3D ? (
          <HeroDroneScene
            onBeat={onBeat}
            onBeats={onBeats}
            onProgress={onProgress}
            onReady={onReady}
            onSeeker={onSeeker}
          />
        ) : null}

        {mounted && use3D && !ready ? (
          <div className="hp-loading" role="status">
            loading
          </div>
        ) : null}

        <nav className="hp-rail" aria-label="Hero sections">
          <div className="hp-rail-fill" ref={fillRef} />
          {beats.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={`hp-dot${i === active ? ' on' : ''}${i < active ? ' done' : ''}`}
              style={{top: `${(i / Math.max(1, beats.length - 1)) * 100}%`}}
              aria-label={b.title}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => seek.current?.(i)}
            />
          ))}
        </nav>

        {/* The spotlight cuts as a part leaves; that is the cue for this.
            aria-live so a beat change is announced rather than silent. */}
        <div className="hp-copy" key={beat?.id} aria-live="polite">
          {beat ? (
            <>
              <p className="hp-step">
                {String(active + 1).padStart(2, '0')} <span>/ {String(beats.length).padStart(2, '0')}</span>
              </p>
              <h2 className="hp-title">{beat.title}</h2>
              <p className="hp-note">{beat.note}</p>
            </>
          ) : null}
        </div>

        {use3D ? <div className="hp-hint" aria-hidden="true">scroll</div> : null}

        {/* Every beat's copy in the DOM, always. Without this five products'
            worth of text exists only in JS state: invisible to crawlers, to
            screen readers, and to anyone who never triggers the animation. */}
        <ul className="hp-fallback">
          {beats.map((b) => (
            <li key={b.id}>
              <h3>{b.title}</h3>
              <p>{b.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="hp-after">
        <p>Page continues here. The hero releases the scroll once the sequence ends.</p>
      </section>
    </main>
  );
}
