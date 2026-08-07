/**
 * The scroll-driven hero section: 3D stage, progress rail, copy panel, and a
 * DOM fallback carrying every beat's copy.
 *
 * Rendering rules live here rather than in the scene: the 3D is skipped under
 * 768px or `prefers-reduced-motion`, matching the policy the rest of the
 * homepage already uses, and in that case the fallback list becomes the actual
 * content instead of being visually hidden.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {HeroDroneScene, type HeroBeat} from '~/components/HeroDroneScene';

function shouldLoad3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 768) return false;
  return true;
}

export function HeroDroneStage({model = 'od3'}: {model?: string}) {
  const [mounted, setMounted] = useState(false);
  const [use3D, setUse3D] = useState(false);
  useEffect(() => {
    setMounted(true);
    setUse3D(shouldLoad3D());
  }, []);

  const [beats, setBeats] = useState<HeroBeat[]>([]);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const seek = useRef<((i: number) => void) | null>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  const onBeat = useCallback((_b: HeroBeat, i: number) => setActive(i), []);
  const onBeats = useCallback((b: HeroBeat[]) => setBeats(b), []);
  const onReady = useCallback(() => setReady(true), []);
  const onSeeker = useCallback((fn: (i: number) => void) => {
    seek.current = fn;
  }, []);
  // Fires every frame, so it writes straight to the DOM rather than to state.
  const onProgress = useCallback((f: number) => {
    if (fillRef.current) fillRef.current.style.height = `${Math.max(0, Math.min(1, f)) * 100}%`;
  }, []);

  const beat = beats[active];

  return (
    <section className="hp-stage">
      {mounted && use3D ? (
        <HeroDroneScene
          model={model}
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

      {use3D ? (
        <nav className="hp-rail" aria-label="Drone parts">
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
      ) : null}

      {/* The spotlight cuts as a part leaves; that is the cue for this. */}
      {use3D ? (
        <div className="hp-copy" key={beat?.id} aria-live="polite">
          {beat ? (
            <>
              <p className="hp-step">
                {String(active + 1).padStart(2, '0')}{' '}
                <span>/ {String(beats.length).padStart(2, '0')}</span>
              </p>
              <h2 className="hp-title">{beat.title}</h2>
              <p className="hp-note">{beat.note}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {use3D ? (
        <div className="hp-hint" aria-hidden="true">
          scroll
        </div>
      ) : null}

      {/* Every beat's copy in the DOM, always. Without this most of the text
          exists only in JS state: invisible to crawlers, to screen readers, and
          to anyone whose device never loads the scene. */}
      <ul className="hp-fallback">
        {beats.map((b) => (
          <li key={b.id}>
            <h3>{b.title}</h3>
            <p>{b.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
