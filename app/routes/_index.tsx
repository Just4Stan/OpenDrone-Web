import {Link} from 'react-router';
import type {Route} from './+types/_index';
import {useEffect, useRef, useState, useCallback} from 'react';

// Kick off the HeroScene chunk download at module eval so it races with
// hydration instead of waiting for useEffect. The same promise is reused
// from inside the component below.
const heroScenePromise =
  typeof window !== 'undefined'
    ? import('~/components/HeroScene')
    : null;

function ClientHeroScene() {
  const [Scene, setScene] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    (heroScenePromise ?? import('~/components/HeroScene')).then((m) => {
      setScene(() => m.HeroScene);
    });
  }, []);
  if (!Scene) return null;
  return <Scene />;
}

export const links: Route.LinksFunction = () => [
  // Preload the 3D assets so they download in parallel with JS/CSS
  // instead of waiting for HeroScene to mount post-hydration. Without
  // these the GLBs only start fetching once the splash fades and the
  // scene boots, adding ~1-2s of blank hero.
  {rel: 'preload', as: 'fetch', href: '/models/frame.glb'},
  {rel: 'preload', as: 'fetch', href: '/models/esc.glb'},
  {rel: 'preload', as: 'fetch', href: '/models/fc.glb'},
];

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

export default function Homepage() {
  const scrollRef = useRef(0);
  const rafId = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [splashHidden, setSplashHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
      if (window.scrollY > window.innerHeight * 0.15) {
        setSplashHidden(true);
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
      {/* Splash overlay — fades after 1.5s OR on scroll, whichever is first */}
      <div className={`splash-overlay${splashHidden ? ' splash-hidden' : ''}`}>
        <h1
          className="font-display font-bold tracking-tight"
          style={{fontSize: 'clamp(3rem, 10vw, 8rem)'}}
        >
          Open<span className="text-[var(--color-gold)]">Drone</span>
        </h1>
      </div>

      {/*
        Scroll spacer — gives us HERO_SPACER_VH of scroll to drive the
        phased animation. The sticky child below pins the 3D scene + UI to
        the viewport while the user scrolls through the spacer. Once the
        user scrolls past the bottom of the spacer the sticky releases and
        the legal footer (in normal document flow below) comes into view.
        No fade, no dead zone.
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
            <ClientHeroScene />
          </div>

        {/* Phase 1: OpenDrone wordmark */}
        <div
          className="absolute bottom-12 left-0 right-0 z-10 px-6 md:px-10"
          style={{opacity: heroTextOpacity}}
        >
          <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-none">
                Open<span className="text-[var(--color-gold)]">Drone</span>
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                Open Source Drone Parts
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3 pointer-events-auto">
              <Link to="/collections/all" className="hero-cta-primary">
                Shop
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <a href="https://github.com/Just4Stan" target="_blank" rel="noopener noreferrer" className="hero-cta-secondary pointer-events-auto" aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
          style={{opacity: Math.max(0, 0.4 - scrollProgress * 3)}}
        >
          <div className="w-px h-5 bg-gradient-to-b from-[var(--color-text-muted)] to-transparent animate-pulse" />
        </div>

        {/* Phase 2: Component labels */}
        <div
          className="absolute z-10 left-0 right-0"
          style={{opacity: labelOpacity, bottom: 'calc(22% - 10px)', transform: `translateY(-${pushUp}vh)`}}
        >
          <div className="max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-3">
            <Link to="/collections/all" className="pointer-events-auto text-center group">
              <p className="font-display font-bold group-hover:text-[var(--color-gold)] transition-colors" style={{fontSize: 'clamp(1.25rem, 2.5vw, 2.5rem)'}}>
                Open<span className="text-[var(--color-gold)]">FC</span>
              </p>
            </Link>
            <Link to="/collections/all" className="pointer-events-auto text-center group">
              <p className="font-display font-bold group-hover:text-[var(--color-gold)] transition-colors" style={{fontSize: 'clamp(1.25rem, 2.5vw, 2.5rem)'}}>
                Open<span className="text-[var(--color-gold)]">Frame</span>
              </p>
            </Link>
            <Link to="/collections/all" className="pointer-events-auto text-center group">
              <p className="font-display font-bold group-hover:text-[var(--color-gold)] transition-colors" style={{fontSize: 'clamp(1.25rem, 2.5vw, 2.5rem)'}}>
                Open<span className="text-[var(--color-gold)]">ESC</span>
              </p>
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
            className="flex items-center justify-center gap-3 px-6 pb-6 pt-2"
            style={{
              background: 'linear-gradient(to top, rgba(10,10,10,0.95) 60%, rgba(10,10,10,0) 100%)',
            }}
          >
            <Link
              to="/collections/all"
              className="inline-flex items-center gap-3 px-14 py-4 bg-[var(--color-gold)] text-[var(--color-bg)] font-mono text-base md:text-lg font-bold uppercase tracking-wider rounded shadow-[0_0_30px_rgba(184,146,46,0.5)] hover:shadow-[0_0_50px_rgba(184,146,46,0.7)] hover:bg-[var(--color-gold-hover)] transition-all duration-300 pointer-events-auto"
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
              className="inline-flex items-center justify-center w-[52px] h-[52px] border border-[var(--color-text-muted)]/30 text-[var(--color-text)] rounded hover:border-[var(--color-gold)]/50 hover:shadow-[0_0_15px_rgba(184,146,46,0.2)] transition-all duration-300 pointer-events-auto"
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
