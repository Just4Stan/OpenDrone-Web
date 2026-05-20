import {Link} from 'react-router';
import type {Route} from './+types/_index';
import {useEffect, useRef, useState, useCallback} from 'react';
import {HeroWordmark} from '~/components/HeroWordmark';

// Kick off the HeroScene chunk download at module eval so it races with
// hydration instead of waiting for useEffect — only on desktop and only
// when the user hasn't asked for reduced motion. Keeps the 14 MB of GLBs
// and the r3f runtime off the wire for mobile visitors who won't see
// the scene anyway.
const heroScenePromise =
  typeof window !== 'undefined' && shouldLoadHero()
    ? import('~/components/HeroScene')
    : null;

function shouldLoadHero(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia('(max-width: 768px)').matches) return false;
  return true;
}

type LabelRefs = {
  fc: React.RefObject<HTMLDivElement | null>;
  frame: React.RefObject<HTMLDivElement | null>;
  esc: React.RefObject<HTMLDivElement | null>;
};

function ClientHeroScene({
  onReady,
  onProgress,
  labelRefs,
}: {
  onReady?: () => void;
  onProgress?: (progress: number) => void;
  labelRefs?: LabelRefs;
}) {
  const [Scene, setScene] = useState<React.ComponentType<{
    onReady?: () => void;
    onProgress?: (progress: number) => void;
    labelRefs?: LabelRefs;
  }> | null>(null);
  useEffect(() => {
    if (!shouldLoadHero()) {
      // Release the splash so the UI isn't stuck behind the dim layer
      // on devices that skipped the scene entirely.
      onReady?.();
      return;
    }
    void (heroScenePromise ?? import('~/components/HeroScene')).then((m) => {
      setScene(() => m.HeroScene);
    });
  }, [onReady]);
  if (!Scene) return null;
  return <Scene onReady={onReady} onProgress={onProgress} labelRefs={labelRefs} />;
}

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'OpenDrone — Open Source Drone Parts'},
    {name: 'description', content: 'Open source flight controllers and ESCs. Designed in Belgium.'},
  ];
};

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

function linearstep(edge0: number, edge1: number, x: number) {
  return Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
}

// Hero scroll budget — the 3D scene + phased UI stays pinned for this many
// screen heights. Mobile gets a much shorter spacer since thumb-scrolling
// 8 screens to reach the footer is brutal.
const HERO_SPACER_VH_DESKTOP = 800;
const HERO_SPACER_VH_MOBILE = 400;
// Scroll denominator for 0..1 progress — mobile finishes phases earlier
// so the release-to-footer buffer still fits in a couple swipes.
const HERO_PROGRESS_VH_DESKTOP = 4;
const HERO_PROGRESS_VH_MOBILE = 2.5;

// Module-scoped flag that survives across remounts of the homepage during
// a single browser session. Hard refresh tears down the JS module and
// resets this back to false → splash plays again. Client-side nav back
// into "/" preserves it → splash + header-hide are skipped so the header
// doesn't blink out and back in.
let splashHasPlayedThisSession = false;

export default function Homepage() {
  const scrollRef = useRef(0);
  const rafId = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  // Splash starts centered and large. It settles when the 3D scene has
  // finished loading AND a minimum wait has elapsed (so the wordmark
  // always gets a readable beat), or when a max timeout fires as a
  // safety net, or when the user starts scrolling.
  const [splashSettled, setSplashSettled] = useState(splashHasPlayedThisSession);
  const [sceneReady, setSceneReady] = useState(splashHasPlayedThisSession);
  const [minWaitElapsed, setMinWaitElapsed] = useState(splashHasPlayedThisSession);
  const [isMobile, setIsMobile] = useState(false);
  // Hero-wordmark fill progress, 0..1. Driven by real GLTFLoader byte
  // progress when Content-Length is available, otherwise by the synthetic
  // ramp effect below. Starts at 1 on repeat visits (splash already
  // played) so the wordmark renders fully filled with no animation.
  const [progress, setProgress] = useState(splashHasPlayedThisSession ? 1 : 0);
  // Wireframe phase gate — keep the fill mask fully closed until the
  // stroke-draw animation has had time to play. Without this, fast
  // loads (cached GLBs, dev) snap progress to 1 immediately and the
  // user never sees the wireframe form. Matches the longest letter
  // animation: stagger 8 * 55ms + 700ms draw = 1140ms, rounded up.
  const DRAW_PHASE_MS = 1200;
  const [drawPhaseDone, setDrawPhaseDone] = useState(
    splashHasPlayedThisSession,
  );
  // Visually displayed progress — JS-lerped toward `progress` so the
  // fill sweeps even when actual load progress jumps from 0 to 1
  // instantly (cached/dev). 0.1 lerp factor → ~95% in ~250ms.
  const [displayedProgress, setDisplayedProgress] = useState(
    splashHasPlayedThisSession ? 1 : 0,
  );
  // Overflow UI — only shown if scene isn't ready within
  // EXPECTED_LOAD_BUDGET_MS. Hidden again as soon as it lands.
  const [showOverflow, setShowOverflow] = useState(false);
  // Tracks whether at least one real (non-synthetic) progress event has
  // come back from GLTFLoader. If not, the time-based ramp drives the
  // wordmark fill so a cached/Content-Length-less load still animates.
  const hasRealProgress = useRef(false);
  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    setProgress(1);
  }, []);
  const handleSceneProgress = useCallback((p: number) => {
    // -1 = lengthComputable false on all 3 GLBs (cached, no
    //      Content-Length). The synthetic ramp keeps moving.
    if (p < 0) return;
    hasRealProgress.current = true;
    // Reserve the last 5% for the sceneReady signal so the fill doesn't
    // hit 100% before the models are actually parsed.
    setProgress((prev) => Math.max(prev, Math.min(p, 0.95)));
  }, []);
  const fcLabelRef = useRef<HTMLDivElement>(null);
  const frameLabelRef = useRef<HTMLDivElement>(null);
  const escLabelRef = useRef<HTMLDivElement>(null);
  const tick = useCallback(() => {
    setScrollProgress(scrollRef.current);
    rafId.current = 0;
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    // Minimum splash duration — wordmark always gets this long to read.
    const minT = window.setTimeout(() => setMinWaitElapsed(true), 600);
    // Safety cap — if the 3D scene never reports ready (failed fetch,
    // slow device, etc.), release the splash anyway so the UI isn't
    // stuck behind a dim layer forever.
    const maxT = window.setTimeout(() => setSplashSettled(true), 3500);
    return () => {
      window.clearTimeout(minT);
      window.clearTimeout(maxT);
    };
  }, []);

  // Splash settles only when the entire intro is visually complete:
  // - sceneReady (3D models actually present)
  // - minWaitElapsed (legacy floor)
  // - drawPhaseDone (wireframe has finished drawing)
  // - displayedProgress >= 0.99 (fill has visually swept to the end)
  // This prevents the wordmark from sliding to bottom-left while still
  // animating in the centered splash position.
  useEffect(() => {
    if (
      sceneReady &&
      minWaitElapsed &&
      drawPhaseDone &&
      displayedProgress >= 0.99
    ) {
      setSplashSettled(true);
    }
  }, [sceneReady, minWaitElapsed, drawPhaseDone, displayedProgress]);

  useEffect(() => {
    if (splashHasPlayedThisSession) return;
    const t = window.setTimeout(() => setDrawPhaseDone(true), DRAW_PHASE_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Lerp displayedProgress toward target. Lerp speed adapts to load
  // state so the animation feels responsive in both cases:
  //   - Cached/just-loaded (sceneReady=true): fast lerp ~0.18 so the
  //     fill completes in roughly 400ms after Phase A finishes.
  //   - Still loading (sceneReady=false): slow lerp ~0.07 so the fill
  //     visibly tracks the byte progress instead of running ahead of
  //     the actual download.
  useEffect(() => {
    if (splashHasPlayedThisSession) return;
    let raf = 0;
    const tick = () => {
      setDisplayedProgress((prev) => {
        const target = drawPhaseDone ? progress : 0;
        // Lower factor = slower sweep. Tuned so the gradient wave is
        // visible (~1s end-to-end) rather than snapping in one frame
        // when cached loads jump progress straight to 1.
        const factor = sceneReady ? 0.09 : 0.04;
        const next = prev + (target - prev) * factor;
        const done = Math.abs(target - next) < 0.001;
        if (!done) raf = requestAnimationFrame(tick);
        return done ? target : next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, drawPhaseDone, sceneReady]);

  // Expected total budget for the intro animation. Models that finish
  // before this stay snappy; anything past it gets the overflow UI.
  const EXPECTED_LOAD_BUDGET_MS = 2000;

  // Synthetic time-based ramp — only effective until a real progress
  // event arrives. Ramps to 0.95 over EXPECTED_LOAD_BUDGET_MS so the
  // wordmark always has something to fill against even on cached loads
  // where Content-Length is missing.
  useEffect(() => {
    if (splashHasPlayedThisSession || sceneReady) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (hasRealProgress.current) return;
      const elapsed = now - start;
      const synth = Math.min(0.95, elapsed / EXPECTED_LOAD_BUDGET_MS);
      setProgress((prev) => Math.max(prev, synth));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sceneReady]);

  // Show "loading models…" + Skip button if the scene takes longer than
  // the expected budget. Hides immediately when sceneReady fires.
  useEffect(() => {
    if (splashHasPlayedThisSession || sceneReady) {
      setShowOverflow(false);
      return;
    }
    const t = window.setTimeout(
      () => setShowOverflow(true),
      EXPECTED_LOAD_BUDGET_MS,
    );
    return () => window.clearTimeout(t);
  }, [sceneReady]);

  // Drive the site-header drop-in animation from splash state. The
  // header lives outside this component (PageLayout in root.tsx), so
  // we signal via a class on <html> that the header CSS can key off.
  // Class is only meaningful inside `.homepage-layout`, so other pages
  // are unaffected.
  //
  // No cleanup on unmount: once the splash has played in this browser
  // session, the class stays on <html>. Removing it on navigation away
  // caused the header to briefly re-hide when the user came back to "/"
  // via client-side nav (e.g. clicking the wordmark). The class only
  // matters inside `.homepage-layout`, so leaving it set has no effect
  // on other routes.
  useEffect(() => {
    if (!splashSettled) return;
    splashHasPlayedThisSession = true;
    document.documentElement.classList.add('splash-settled');
  }, [splashSettled]);

  const heroSpacerVh = isMobile ? HERO_SPACER_VH_MOBILE : HERO_SPACER_VH_DESKTOP;
  const heroProgressVh = isMobile
    ? HERO_PROGRESS_VH_MOBILE
    : HERO_PROGRESS_VH_DESKTOP;

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const onScroll = () => {
      scrollRef.current = Math.min(
        1,
        Math.max(0, window.scrollY / (window.innerHeight * heroProgressVh)),
      );
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(tick);
      }
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [tick, heroProgressVh]);

  // Lock page scroll until the intro animation has fully settled. Without
  // this, a flick-scroll mid-animation jumps the splash → settled
  // transform on the wordmark, which looks broken (the wordmark warps
  // mid-stroke). Once the splash has played in this session the lock
  // never re-engages.
  useEffect(() => {
    if (splashHasPlayedThisSession) return;
    if (splashSettled) {
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
      return;
    }
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
    };
  }, [splashSettled]);

  const heroTextOpacity = Math.max(0, 1 - scrollProgress * 4);
  const labelOpacity = linearstep(0.65, 0.75, scrollProgress);
  const ctaRise = linearstep(0.7, 0.85, scrollProgress);
  const pushUp = ctaRise * 12; // vh units — how far scene/labels shift up

  return (
    <div className="homepage">

      {/*
        Scroll spacer — gives us HERO_SPACER_VH of scroll to drive the
        phased animation. The sticky child below pins the 3D scene + UI to
        the viewport while the user scrolls through the spacer. Once the
        user scrolls past the bottom of the spacer the sticky releases and
        the legal footer (in normal document flow below) comes into view.
      */}
      <div className="relative" style={{height: `${heroSpacerVh}vh`}}>
        <div className="sticky top-0 h-screen overflow-hidden pointer-events-none">
          {/* Full-screen 3D — pinned behind everything via sticky parent */}
          <div
            className="absolute inset-0 z-0"
            style={{
              transform: `translateY(-${pushUp}vh)`,
              transition: 'none',
              // Let the browser own vertical panning (page scroll) while
              // horizontal drags still reach the r3f pointer handlers for
              // model rotation. Without this, touch-action defaults to
              // "auto" and the browser cancels the pointer stream as soon
              // as it decides the gesture is a scroll — so on mobile the
              // drag-to-rotate stops working entirely.
              touchAction: 'pan-y',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 45%, rgba(80, 65, 20, 0.3) 0%, transparent 60%)',
              }}
            />
            <ClientHeroScene
              onReady={handleSceneReady}
              onProgress={handleSceneProgress}
              labelRefs={{
                fc: fcLabelRef,
                frame: frameLabelRef,
                esc: escLabelRef,
              }}
            />
            {/* Dim overlay — only covers the 3D scene, not the wordmark.
                Fades out once the scene is ready AND the minimum splash
                beat has elapsed. */}
            <div
              className={`scene-dim${splashSettled ? ' is-hidden' : ''}`}
              aria-hidden="true"
            />
          </div>

          {/* Single wordmark — starts centered + large, animates to
              bottom-left at settled size. Inline opacity drives the
              scroll-based fade once the hero starts scrolling away.
              The SVG inside owns the per-letter draw + fill animation;
              progress maps to the GLB load progress (or a synthetic
              ramp when Content-Length is missing). */}
          <h1
            className={`hero-wordmark${splashSettled ? ' is-settled' : ''}`}
            style={{opacity: splashSettled ? heroTextOpacity : 1}}
            aria-label="OpenDrone"
          >
            <HeroWordmark
              progress={displayedProgress}
              className={displayedProgress >= 0.99 ? 'is-filled' : ''}
            />
          </h1>

          {/* Overflow UI — only renders when the scene takes longer than
              the expected animation budget. Gives the user a way out so
              they aren't trapped behind the dim layer on slow networks. */}
          {showOverflow && !sceneReady ? (
            <div
              className={`hero-load-overflow${splashSettled ? ' is-hidden' : ''}`}
              role="status"
              aria-live="polite"
            >
              <span className="hero-load-overflow__text">loading models…</span>
              <Link
                to="/collections/all"
                className="hero-load-overflow__skip"
                onClick={() => setSplashSettled(true)}
              >
                Skip to catalogue
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          ) : null}

          {/* CTAs bottom-right */}
          <div
            className={`hero-actions${splashSettled ? ' is-visible' : ''}`}
            style={{opacity: splashSettled ? heroTextOpacity : 0}}
          >
            <Link to="/collections/all" className="hero-action-primary">
              Shop
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a
              href="https://github.com/incutec-hw"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-action-secondary"
              aria-label="GitHub"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
          style={{opacity: Math.max(0, 0.4 - scrollProgress * 3)}}
        >
          <div className="w-px h-5 bg-gradient-to-b from-[var(--color-text-muted)] to-transparent animate-pulse" />
        </div>

        {/* Phase 2: Component labels — each div sits below its 3D model.
            HeroScene writes `transform: translate(x, y)` imperatively
            every frame based on the model's world-space bounding box so
            labels track the geometry even as the assembly rotates. */}
        <div
          className="hero-component-labels"
          style={{opacity: labelOpacity, transform: `translateY(-${pushUp}vh)`}}
        >
          <div ref={fcLabelRef} className="hero-component-label">
            <Link to="/products/openfc">
              Open<span>FC</span>
            </Link>
          </div>
          <div ref={frameLabelRef} className="hero-component-label">
            <Link to="/products/openframe">
              Open<span>Frame</span>
            </Link>
          </div>
          <div ref={escLabelRef} className="hero-component-label">
            <Link to="/products/openesc">
              Open<span>ESC</span>
            </Link>
          </div>
        </div>

        {/* Phase 3: CTA panel — rises from bottom, pushes scene up */}
        <div
          className="absolute left-0 right-0 z-20"
          style={{
            bottom: '82px',
            transform: `translateY(${(1 - ctaRise) * 100}%)`,
            opacity: ctaRise,
          }}
        >
          <div
            className="flex items-center justify-center gap-5 px-6 pb-10 pt-4"
            style={{
              background: 'linear-gradient(to top, rgba(13,13,16,0.95) 60%, rgba(13,13,16,0) 100%)',
            }}
          >
            <Link
              to="/collections/all"
              className="inline-flex items-center gap-3 px-10 py-4 bg-[var(--color-gold)] text-[var(--color-bg)] font-mono font-bold uppercase tracking-wider rounded shadow-[0_0_24px_rgba(184,146,46,0.45)] hover:shadow-[0_0_36px_rgba(184,146,46,0.65)] hover:bg-[var(--color-gold-hover)] transition-all duration-300 pointer-events-auto"
              style={{fontSize: 'clamp(0.9rem, 1vw, 1.05rem)'}}
            >
              Shop Now
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a
              href="https://github.com/incutec-hw"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-[52px] h-[52px] border border-[var(--color-text-muted)]/30 text-[var(--color-text)] rounded hover:border-[var(--color-gold)]/50 hover:shadow-[0_0_16px_rgba(184,146,46,0.25)] transition-all duration-300 pointer-events-auto"
              aria-label="View source on GitHub"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
