import {Link, PrefetchPageLinks, useLoaderData} from 'react-router';
import type {Route} from './+types/_index';
import {useEffect, useRef, useState, useCallback, useMemo, memo} from 'react';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {HeroWordmark} from '~/components/HeroWordmark';
import {HeroSizeSlider} from '~/components/HeroSizeSlider';
import {MobileHome} from '~/components/MobileHome';
import {SceneErrorBoundary} from '~/components/SceneErrorBoundary';

// Kick off the HeroScene chunk download at module eval so it races with
// hydration instead of waiting for useEffect — only on desktop and only
// when the user hasn't asked for reduced motion. Keeps the GLBs (~6.3 MB
// across both sizes; ~3.2 MB for the visible trio) and the r3f runtime off
// the wire for mobile visitors who won't see the scene anyway.
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

// Memoised so scroll-driven re-renders of the home route (setScrollProgress
// fires every scroll frame) don't reconcile the whole <Canvas>/r3f tree. The
// 3D scene animates itself off its own scroll listener + invalidate(), so it
// needs nothing from those renders — and reconciling it each frame was starving
// the WebGL render of the main thread, which is what made scrolling choppy.
// Props are referentially stable (callbacks are useCallback, labelRefs is
// useMemo'd, the rest are primitives), so memo bails out every scroll frame.
const ClientHeroScene = memo(function ClientHeroScene({
  onReady,
  onProgress,
  labelRefs,
  loadDelayMs,
  size,
  scrubRef,
}: {
  onReady?: () => void;
  onProgress?: (progress: number) => void;
  labelRefs?: LabelRefs;
  loadDelayMs?: number;
  size?: '5' | '3';
  scrubRef?: React.RefObject<number | null>;
}) {
  const [Scene, setScene] = useState<React.ComponentType<{
    onReady?: () => void;
    onProgress?: (progress: number) => void;
    labelRefs?: LabelRefs;
    loadDelayMs?: number;
    size?: '5' | '3';
    scrubRef?: React.RefObject<number | null>;
  }> | null>(null);
  useEffect(() => {
    if (!shouldLoadHero()) {
      // Release the splash so the UI isn't stuck behind the dim layer
      // on devices that skipped the scene entirely.
      onReady?.();
      return;
    }
    void (heroScenePromise ?? import('~/components/HeroScene'))
      .then((m) => {
        setScene(() => m.HeroScene);
      })
      .catch((err) => {
        // Chunk failed to load (offline, CDN hiccup). Release the splash now
        // rather than waiting out the safety timeout — the page stays usable
        // without the 3D scene.
        console.error('[hero] failed to load 3D scene chunk:', err);
        onReady?.();
      });
  }, [onReady]);
  if (!Scene) return null;
  return (
    <Scene
      onReady={onReady}
      onProgress={onProgress}
      labelRefs={labelRefs}
      loadDelayMs={loadDelayMs}
      size={size}
      scrubRef={scrubRef}
    />
  );
});

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'OpenDrone · Open Source Drone Parts'},
    {name: 'description', content: 'Open source flight controllers and ESCs. Designed in Belgium.'},
  ];
};

export async function loader({request, context}: Route.LoaderArgs) {
  // UA hint picks the SSR layout so a phone gets the static MobileHome on
  // first paint instead of rendering the desktop 3D tree (and its
  // scroll-lock) for a frame before matchMedia corrects it client-side.
  const ua = request.headers.get('user-agent') || '';
  const isMobileHint = /Mobi|Android|iPhone|iPod|Windows Phone|BlackBerry/i.test(
    ua,
  );

  // Flagship line for the mobile showcase. Deferred, not awaited: desktop
  // never renders these cards, and on mobile they sit below the hero — so
  // streaming them keeps TTFB off the Shopify round-trip entirely. Cache
  // long since the catalogue changes rarely. Catch resolves to [] so a
  // storefront hiccup just drops the cards instead of blanking the page.
  const featured: Promise<CollectionItemFragment[]> = context.storefront
    .query(HOME_FEATURED_QUERY, {cache: context.storefront.CacheLong()})
    .then((data) => {
      const d = data as {
        frame: CollectionItemFragment | null;
        stack: CollectionItemFragment | null;
        rx: CollectionItemFragment | null;
      };
      return [d.frame, d.stack, d.rx].filter(
        (p): p is CollectionItemFragment => Boolean(p),
      );
    })
    .catch(() => [] as CollectionItemFragment[]);

  return {isMobileHint, featured};
}

function linearstep(edge0: number, edge1: number, x: number) {
  return Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
}

// Hero scroll budget — the 3D scene + phased UI stays pinned for this many
// screen heights. Pinned budget (spacer − 100, for the h-screen child) is a
// touch larger than HERO_PROGRESS_VH so progress comfortably reaches 1 and
// the finished state holds for a brief beat before the sticky releases.
// 205 (not the old 220): progress finishes at 100vh and the CTA rise ends at
// p=0.96, so a 5vh settle beat is enough — the extra 15vh was pinned scroll
// where nothing on screen changed, reading as a stuck page.
const HERO_SPACER_VH_DESKTOP = 205;
const HERO_SPACER_VH_MOBILE = 205;
// Scroll denominator for 0..1 progress — how many viewport heights of
// scroll drive the phased animation from start to finish. One viewport
// height means the whole sequence plays out in a single continuous scroll
// gesture, instead of needing several wheel/trackpad flicks to get through.
const HERO_PROGRESS_VH_DESKTOP = 1;
const HERO_PROGRESS_VH_MOBILE = 1;

// Module-scoped flag that survives across remounts of the homepage during
// a single browser session. Hard refresh tears down the JS module and
// resets this back to false → splash plays again. Client-side nav back
// into "/" preserves it → splash + header-hide are skipped so the header
// doesn't blink out and back in.
let splashHasPlayedThisSession = false;

/**
 * Route entry. Picks the static phone layout or the WebGL desktop hero.
 * `isMobileHint` seeds the choice at SSR (UA-based); matchMedia then owns
 * it on the client so a resize across the 768px line swaps layouts. The
 * two trees are separate components so the desktop scroll/RAF/scroll-lock
 * hooks never mount on a phone.
 */
export default function Homepage() {
  const {isMobileHint, featured} = useLoaderData<typeof loader>();
  const [isMobile, setIsMobile] = useState(isMobileHint);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (isMobile) return <MobileHome featured={featured} />;
  return <DesktopHome />;
}

function DesktopHome() {
  const scrollRef = useRef(0);
  const rafId = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  // Which airframe the hero shows — 5-inch or 3-inch. Toggling swaps the
  // GLB trio loaded by HeroScene.
  const [heroSize, setHeroSize] = useState<'5' | '3'>('5');
  // Live drag fraction (0→1) while the size slider is dragged, else null. A ref
  // (not state) so dragging it 60×/s doesn't re-render the page — the render
  // loop reads it each frame. The slider writes it; HeroScene reads it.
  const heroScrubRef = useRef<number | null>(null);
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
  // stroke-draw animation has played out. Tuned against the CSS:
  // 9 letters × 65ms stagger + 500ms per-letter draw = 1020ms end.
  // Fires a touch before so fill chases the wireframe with no gap.
  const DRAW_PHASE_MS = 950;
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
  // Stable object so <ClientHeroScene>'s memo isn't defeated by a fresh literal
  // every (scroll-driven) render. The refs themselves never change identity.
  const labelRefs = useMemo(
    () => ({fc: fcLabelRef, frame: frameLabelRef, esc: escLabelRef}),
    [],
  );
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

  // Splash starts moving to the bottom-left corner as soon as the
  // wireframe phase ends — overlaps with the fill cascade (which runs
  // ~400ms now that the lerp factor was dialled back). The splash
  // transition itself takes ~650ms, so fill and movement share their
  // first ~400ms before the splash continues alone to the corner.
  useEffect(() => {
    if (sceneReady && minWaitElapsed && drawPhaseDone) {
      setSplashSettled(true);
    }
  }, [sceneReady, minWaitElapsed, drawPhaseDone]);

  // Guarantee the wordmark ends fully filled. The displayed-progress lerp
  // is asymptotic and lives in the RAF below, which self-terminates the
  // instant `splashHasPlayedThisSession` flips true. On a fast/cached load
  // the settle can fire in the same commit that opens the fill, killing the
  // loop while displayedProgress is only partway up — freezing letters as
  // half-drawn outlines. Snapping to 1 on settle makes the end state
  // deterministic; on slow loads the RAF has already swept it to ~1 by then,
  // so this is a no-op and the cascade stays visible.
  useEffect(() => {
    if (splashSettled) setDisplayedProgress(1);
  }, [splashSettled]);

  useEffect(() => {
    if (splashHasPlayedThisSession) return;
    const t = window.setTimeout(() => setDrawPhaseDone(true), DRAW_PHASE_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Expected total budget for the intro animation. Models that finish
  // before this stay snappy; anything past it gets the overflow UI.
  const EXPECTED_LOAD_BUDGET_MS = 2000;

  // Unified RAF loop driving BOTH the synthetic time-based progress
  // ramp (used when Content-Length isn't available) AND the displayed
  // progress lerp. Previously these lived in two separate RAFs that
  // competed for scheduler slots during the wireframe phase — merging
  // them halves the scheduler overhead during the critical first
  // 1.5s of page load.
  useEffect(() => {
    if (splashHasPlayedThisSession) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // Self-terminate once the splash has settled — the closure can
      // outlive the splash phase if the effect dep array doesn't change.
      if (splashHasPlayedThisSession) return;
      // Synthetic ramp — only contributes until a real GLB byte
      // progress event lands. Bumps `progress` toward 0.95 over the
      // load budget so the fill mask has something to chase even when
      // Content-Length is missing.
      if (!hasRealProgress.current) {
        const elapsed = now - start;
        const synth = Math.min(0.95, elapsed / EXPECTED_LOAD_BUDGET_MS);
        setProgress((prev) => (synth > prev ? synth : prev));
      }
      // Displayed-progress lerp. Snappy (factor 0.45) once the
      // wireframe phase ends so the fill is visibly readable during
      // the splash-to-corner transition. Decoupled from byte progress
      // — the fill is a visual beat, not a load indicator.
      setDisplayedProgress((prev) => {
        const target = drawPhaseDone ? 1 : 0;
        const factor = drawPhaseDone ? 0.45 : 0.08;
        return prev + (target - prev) * factor;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, drawPhaseDone, sceneReady]);

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
  // Phase timing (single 0..1 progress shared with the 3D scene). The model
  // finishes exploding at p≈0.65 (flyOut smoothstep ends there), so labels
  // and the CTA are sequenced AFTER that so the names don't pop in while the
  // parts are still flying apart. Everything lands by ~0.95, leaving the tail
  // of the scroll as a brief settled-state hold before the page ends.
  const labelOpacity = linearstep(0.72, 0.84, scrollProgress);
  const ctaRise = linearstep(0.84, 0.96, scrollProgress);

  return (
    <div className="homepage">
      {/*
        Warm the three flagship PDPs (the live handles the 3D part hotspots
        navigate to) so clicking a part is an instant SPA transition with its
        loader data already in cache. The FC hotspot targets openfc-lite —
        the live product; the old `openfc` handle is archived in Shopify.
      */}
      <PrefetchPageLinks page="/products/openfc-lite" />
      <PrefetchPageLinks page="/products/openesc" />
      <PrefetchPageLinks page="/products/openframe" />

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
            {/* If the WebGL scene crashes (no GPU, lost context, …) the
                boundary releases the splash so the visitor isn't trapped behind
                the dim/scroll-lock — the wordmark + CTAs below stay usable. */}
            <SceneErrorBoundary onError={handleSceneReady} fallback={null}>
              <ClientHeroScene
                onReady={handleSceneReady}
                onProgress={handleSceneProgress}
                labelRefs={labelRefs}
                // Hold the GLB fetch + parse + processing for the first
                // ~750ms so the wireframe wordmark animation gets a
                // clean main thread. Skipped entirely on return visits
                // where the splash was already played in this session.
                loadDelayMs={splashHasPlayedThisSession ? 0 : 750}
                size={heroSize}
                scrubRef={heroScrubRef}
              />
            </SceneErrorBoundary>
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
              ramp when Content-Length is missing).

              While the splash is active we drive `transform` inline
              with a per-frame scale that lerps from 1.95 (during the
              wireframe) down to 1.7 (the CSS-rule splash size). This
              gives a subtle "zoom out as the letters fill in" feel.
              `transition: none` overrides the CSS-rule transition so
              the per-frame scrub stays smooth. Once the splash settles,
              both inline overrides are removed and the CSS rule's
              0.65s transition takes over to slide the wordmark to its
              bottom-left settled position. */}
          {(() => {
            const splashScale = 1.95 - displayedProgress * 0.25;
            return (
              <h1
                className={`hero-wordmark${splashSettled ? ' is-settled' : ''}`}
                style={{
                  opacity: splashSettled ? heroTextOpacity : 1,
                  ...(splashSettled
                    ? {}
                    : {
                        transform: `translate(calc(50vw - 2.5rem - 50%), calc(-50vh + 2.5rem + 50%)) scale(${splashScale.toFixed(3)})`,
                        transition: 'none',
                      }),
                }}
                aria-label="OpenDrone"
              >
                <HeroWordmark
                  progress={displayedProgress}
                  className={displayedProgress >= 0.99 ? 'is-filled' : ''}
                />
              </h1>
            );
          })()}

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
              <Link prefetch="viewport"
                to="/collections/all"
                className="hero-load-overflow__skip"
                onClick={() => setSplashSettled(true)}
              >
                Skip to catalog
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
            <Link prefetch="viewport" to="/collections/all" className="hero-action-primary">
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

        {/* Airframe size toggle — swaps the 5" / 3" GLB trio in the hero.
            Fades in with the rest of the hero UI once the splash settles and
            fades back out as the user scrolls into the explode phases. */}
        <div
          className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
          style={{
            opacity: splashSettled ? heroTextOpacity : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          <HeroSizeSlider
            value={heroSize}
            onChange={setHeroSize}
            scrubRef={heroScrubRef}
          />
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
          style={{opacity: labelOpacity}}
        >
          <div ref={fcLabelRef} className="hero-component-label">
            <Link to="/products/openfc-lite" prefetch="render">
              Open<span>FC</span>
            </Link>
          </div>
          <div ref={frameLabelRef} className="hero-component-label">
            <Link to="/products/openframe" prefetch="render">
              Open<span>Frame</span>
            </Link>
          </div>
          <div ref={escLabelRef} className="hero-component-label">
            <Link to="/products/openesc" prefetch="render">
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
              // Fade the page background up behind the CTA. Theme-aware: uses
              // the bg token (dark or light) instead of a hardcoded dark, so it
              // doesn't show as a grey band in light mode.
              background:
                'linear-gradient(to top, color-mix(in srgb, var(--color-bg) 95%, transparent) 60%, transparent 100%)',
            }}
          >
            <Link prefetch="viewport"
              to="/collections/all"
              className="inline-flex items-center gap-3 px-10 py-4 bg-[var(--color-gold)] text-[var(--color-on-accent)] font-mono font-bold uppercase tracking-wider rounded shadow-[0_0_24px_rgba(184,146,46,0.45)] hover:shadow-[0_0_36px_rgba(184,146,46,0.65)] hover:bg-[var(--color-gold-hover)] transition-all duration-300 pointer-events-auto"
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

// Three flagship products for the mobile showcase, fetched by handle:
// OpenFrame / OpenStack / OpenRX.
const HOME_FEATURED_QUERY = `#graphql
  fragment HomeMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment HomeProductCard on Product {
    id
    handle
    title
    productType
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...HomeMoney
      }
      maxVariantPrice {
        ...HomeMoney
      }
    }
  }
  query HomeFeatured($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    frame: product(handle: "openframe") {
      ...HomeProductCard
    }
    stack: product(handle: "openstack") {
      ...HomeProductCard
    }
    rx: product(handle: "openrx") {
      ...HomeProductCard
    }
  }
` as const;
