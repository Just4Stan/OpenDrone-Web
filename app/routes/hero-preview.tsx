/**
 * Prototype of the scroll-driven hero, on its own route so it can be reviewed
 * beside the live homepage without touching it. Once approved, <HeroStage> is
 * what moves into _index.tsx.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {HeroDroneScene, type HeroBeat} from '~/components/HeroDroneScene';

export default function HeroPreview() {
  // three.js touches window at module scope, so the scene only mounts client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
        {mounted ? (
          <HeroDroneScene
            onBeat={onBeat}
            onBeats={onBeats}
            onProgress={onProgress}
            onReady={onReady}
          />
        ) : null}

        {!ready ? <div className="hp-loading">loading</div> : null}

        <nav className="hp-rail" aria-label="Hero sections">
          <div className="hp-rail-fill" ref={fillRef} />
          {beats.map((b, i) => (
            <span
              key={b.id}
              className={`hp-dot${i === active ? ' on' : ''}${i < active ? ' done' : ''}`}
              style={{top: `${(i / Math.max(1, beats.length - 1)) * 100}%`}}
              title={b.title}
            />
          ))}
        </nav>

        {/* The spotlight cuts as a part leaves; that is the cue for this. */}
        <div className="hp-copy" key={beat?.id}>
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

        <div className="hp-hint" aria-hidden="true">scroll</div>
      </section>

      <section className="hp-after">
        <p>Page continues here. The hero releases the scroll once the sequence ends.</p>
      </section>
    </main>
  );
}
