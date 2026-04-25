import {Link} from 'react-router';
import type {Route} from './+types/_index';
import {useEffect, useRef, useState, useCallback} from 'react';

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
  labelRefs,
}: {
  onReady?: () => void;
  labelRefs?: LabelRefs;
}) {
  const [Scene, setScene] = useState<React.ComponentType<{
    onReady?: () => void;
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
  return <Scene onReady={onReady} labelRefs={labelRefs} />;
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
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
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

  useEffect(() => {
    if (sceneReady && minWaitElapsed) setSplashSettled(true);
  }, [sceneReady, minWaitElapsed]);

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
      if (window.scrollY > 8) {
        setSplashSettled(true);
      }
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
              scroll-based fade once the hero starts scrolling away. */}
          <h1
            className={`hero-wordmark${splashSettled ? ' is-settled' : ''}`}
            style={{opacity: splashSettled ? heroTextOpacity : 1}}
            aria-label="OpenDrone"
          >
            {/* sizes accounts for the 1.5–1.7× splash-state transform,
                so the browser picks an asset with enough pixels for the
                largest displayed width, not just the settled size. */}
            <img
              src="/opendrone-wordmark-1200.png"
              srcSet="/opendrone-wordmark-1200.png 1200w, /opendrone-wordmark-2400.png 2400w"
              sizes="(min-width: 768px) 900px, 500px"
              alt=""
              width={1200}
              height={216}
              decoding="async"
              fetchPriority="high"
            />
          </h1>

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
              href="https://github.com/Just4Stan"
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
            labels track the geometry even as the assembly rotates.
            Parent container controls visibility/push-up; children set
            their own position. */}
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
              href="https://github.com/Just4Stan"
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
