import {useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {useEffect, useState} from 'react';

// Client-only 3D scene
function ClientHeroScene() {
  const [Scene, setScene] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    import('~/components/HeroScene').then((m) => {
      setScene(() => m.HeroScene);
    });
  }, []);
  if (!Scene) return null;
  return <Scene />;
}

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'OpenDrone — Open Source Drone Electronics'},
    {name: 'description', content: 'Open source flight controllers and ESCs. Designed in Belgium.'},
  ];
};

export async function loader(args: Route.LoaderArgs) {
  return {
    isShopLinked: Boolean(args.context.env.PUBLIC_STORE_DOMAIN),
  };
}

export default function Homepage() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 3)));
      setScrollProgress(p);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Text phases
  const labelOpacity = smoothstep(0.45, 0.6, scrollProgress);
  const infoOpacity = smoothstep(0.65, 0.8, scrollProgress);
  const heroTextOpacity = Math.max(0, 1 - scrollProgress * 4);

  return (
    <div className="homepage">
      {/* Single continuous hero — 400vh for full scroll range */}
      <section className="relative" style={{height: '400vh'}}>
        <div className="sticky top-0 h-screen">
          {/* 3D Scene */}
          <div className="absolute inset-0">
            <ClientHeroScene />
          </div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/40 to-transparent pointer-events-none" />

          {/* Phase 1: OpenDrone wordmark (fades out fast) */}
          <div
            className="absolute bottom-12 left-0 right-0 z-10 px-6 md:px-10 pointer-events-none"
            style={{opacity: heroTextOpacity}}
          >
            <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-none">
                  Open<span className="text-[var(--color-gold)]">Drone</span>
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                  Open Source Drone Electronics
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
                <a href="https://github.com/Just4Stan" target="_blank" rel="noopener noreferrer" className="hero-cta-secondary">
                  Source
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

          {/* Phase 2: Component labels under 3D models */}
          <div
            className="absolute z-10 left-0 right-0 pointer-events-none"
            style={{opacity: labelOpacity, bottom: '18%'}}
          >
            <div className="max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-3">
              <Link to="/collections/all" className="pointer-events-auto text-center group px-8">
                <p className="font-display text-sm md:text-lg font-bold group-hover:text-[var(--color-gold)] transition-colors">
                  OpenFC
                </p>
                <p className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.15em]">
                  Flight Controller
                </p>
              </Link>
              <Link to="/collections/all" className="pointer-events-auto text-center group">
                <p className="font-display text-sm md:text-lg font-bold group-hover:text-[var(--color-gold)] transition-colors">
                  Frame
                </p>
                <p className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.15em]">
                  Carbon Fiber
                </p>
              </Link>
              <Link to="/collections/all" className="pointer-events-auto text-center group px-8">
                <p className="font-display text-sm md:text-lg font-bold group-hover:text-[var(--color-gold)] transition-colors">
                  Open ESC
                </p>
                <p className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.15em]">
                  4-in-1 · 35A
                </p>
              </Link>
            </div>
          </div>

          {/* Phase 3: Info overlay — specs + open source + CTA */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
            style={{opacity: infoOpacity}}
          >
            <div className="bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/95 to-transparent pt-16 pb-8 px-6 md:px-10">
              <div className="max-w-5xl mx-auto pointer-events-auto">
                {/* Key specs row */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="text-center">
                    <p className="font-mono text-[10px] text-[var(--color-accent-light)] uppercase tracking-[0.2em] mb-1">MCU</p>
                    <p className="font-display text-sm font-bold">RP2354B</p>
                    <p className="font-mono text-[10px] text-[var(--color-text-muted)]">ARM Cortex-M33</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] text-[var(--color-accent-light)] uppercase tracking-[0.2em] mb-1">ESC</p>
                    <p className="font-display text-sm font-bold">35A × 4</p>
                    <p className="font-mono text-[10px] text-[var(--color-text-muted)]">AM32 · DShot</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] text-[var(--color-accent-light)] uppercase tracking-[0.2em] mb-1">License</p>
                    <p className="font-display text-sm font-bold">CERN-OHL-S</p>
                    <p className="font-mono text-[10px] text-[var(--color-text-muted)]">100% Open Source</p>
                  </div>
                </div>

                {/* CTA row */}
                <div className="flex items-center justify-center gap-4">
                  <Link to="/collections/all" className="hero-cta-primary">
                    Shop Now
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                  <a href="https://github.com/Just4Stan" target="_blank" rel="noopener noreferrer" className="hero-cta-secondary">
                    View Source
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer-only below hero — no more feature cards or product grid */}
    </div>
  );
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
