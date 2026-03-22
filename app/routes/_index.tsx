import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useState, useCallback} from 'react';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';

// Fully client-only — returns null during SSR, lazy-loads on client
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
    {
      name: 'description',
      content:
        'Open source flight controllers and ESCs. Designed in Belgium, built for the community.',
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
  };
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {recommendedProducts};
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="homepage">
      <HeroSection />
      <FeaturesSection />
      <ProductsSection products={data.recommendedProducts} />
      <OpenSourceSection />
    </div>
  );
}

function HeroSection() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 2)));
      setScrollProgress(p);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fade in labels after 70% scroll
  const labelOpacity = Math.max(0, (scrollProgress - 0.7) / 0.3);

  return (
    <section className="hero-section relative" style={{height: '300vh'}}>
      <div className="sticky top-0 h-screen">
        <div className="absolute inset-0">
          <ClientHeroScene />
        </div>

        {/* Product labels — appear at end of fly-out */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{opacity: labelOpacity}}
        >
          <div className="absolute bottom-[22%] left-0 right-0 px-6 md:px-10">
            <div className="max-w-7xl mx-auto grid grid-cols-3 gap-4">
              {/* FC label — aligned left third */}
              <Link
                to="/collections/all"
                className="pointer-events-auto text-center group"
              >
                <p className="font-display text-sm md:text-lg font-bold group-hover:text-[var(--color-gold)] transition-colors">
                  OpenFC
                </p>
                <p className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.15em]">
                  Flight Controller
                </p>
              </Link>
              {/* Frame label — center third */}
              <div className="text-center">
                <p className="font-display text-sm md:text-lg font-bold text-[var(--color-text-muted)]/60">
                  Frame
                </p>
                <p className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-muted)]/30 uppercase tracking-[0.15em]">
                  Carbon Fiber
                </p>
              </div>
              {/* ESC label — right third */}
              <Link
                to="/collections/all"
                className="pointer-events-auto text-center group"
              >
                <p className="font-display text-sm md:text-lg font-bold group-hover:text-[var(--color-gold)] transition-colors">
                  Open ESC
                </p>
                <p className="font-mono text-[9px] md:text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.15em]">
                  4-in-1 35A
                </p>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/60 to-transparent pointer-events-none" />

        {/* Bottom content — fades out as labels appear */}
        <div
          className="absolute bottom-10 left-0 right-0 z-10 px-6 md:px-10"
          style={{opacity: Math.max(0, 1 - scrollProgress * 2.5)}}
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
            <div className="hidden md:flex items-center gap-3">
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

        {/* Scroll hint — fades out on scroll */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{opacity: Math.max(0, 0.4 - scrollProgress * 2)}}
        >
          <div className="w-px h-5 bg-gradient-to-b from-[var(--color-text-muted)] to-transparent animate-pulse" />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: 'OpenFC',
      subtitle: 'Flight Controller',
      description: 'RP2354B flight controller with integrated break-off ELRS receiver, 16MB blackbox, and analog OSD.',
      specs: ['RP2354B', 'LSM6DSV IMU', 'BMP388 Baro', 'ELRS 2.4GHz'],
    },
    {
      title: 'OpenFC-ECO',
      subtitle: 'Flight Controller',
      description: 'Stripped-down OpenFC. Same RP2354B core and IMU, no baro, no blackbox, no ELRS. Lower cost.',
      specs: ['RP2354B', 'LSM6DSV IMU', 'Analog OSD', '2-6S Input'],
    },
    {
      title: 'Open ESC',
      subtitle: '4-in-1 ESC',
      description: 'AM32 firmware, AT32F421 MCU, 35A per channel. 20x20 and 30x30 mounting options.',
      specs: ['35A / Channel', 'AM32 FW', 'AT32F421', '3-6S LiPo'],
    },
  ];

  return (
    <section className="section-spacing px-6 md:px-10">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-10">
          <p className="section-label">Hardware</p>
          <h2 className="section-title">Designed for Performance</h2>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="feature-card"
            >
              <div className="mb-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent-light)] mb-0.5">
                  {feature.subtitle}
                </p>
                <h3 className="font-display text-lg font-bold leading-tight">{feature.title}</h3>
              </div>
              <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed mb-4">
                {feature.description}
              </p>
              <div className="grid grid-cols-2 gap-1.5 mt-auto">
                {feature.specs.map((spec) => (
                  <div
                    key={spec}
                    className="spec-tag"
                  >
                    {spec}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductsSection({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section className="section-spacing px-6 md:px-10 border-t border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="section-label">Shop</p>
            <h2 className="section-title">Products</h2>
          </div>
          <Link
            to="/collections/all"
            className="hidden md:inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors"
          >
            View all
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({length: 4}).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-[var(--color-bg-card)] rounded animate-pulse"
                />
              ))}
            </div>
          }
        >
          <Await resolve={products}>
            {(response) => (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {response?.products.nodes.length ? (
                  response.products.nodes.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))
                ) : (
                  <div className="col-span-full py-16 text-center">
                    <p className="font-mono text-sm text-[var(--color-text-muted)]">
                      Products coming soon.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}

function OpenSourceSection() {
  const repos = [
    {name: 'OpenFC', desc: '20x20 FC with integrated ELRS receiver', license: 'CERN-OHL-S', url: 'https://github.com/Just4Stan/OpenFC'},
    {name: 'Open-4in1-AM32-ESC', desc: '20x20 4-in-1 ESC, 35A, AM32', license: 'CERN-OHL-S', url: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC'},
    {name: 'Open-4in1-AM32-ESC-30x30', desc: '30x30 4-in-1 ESC variant', license: 'CERN-OHL-S', url: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC-30x30'},
  ];

  return (
    <section className="section-spacing px-6 md:px-10 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto text-center">
        <p className="section-label">Community</p>
        <h2 className="section-title mb-3">100% Open Source</h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-lg mx-auto leading-relaxed mb-8">
          Every schematic, PCB layout, and line of firmware — open and free.
          Hardware: CERN-OHL-S. Firmware: GPL/MIT.
        </p>

        {/* Repo cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {repos.map((repo) => (
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              key={repo.name}
              className="repo-card"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-light)" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                <h4 className="font-mono text-xs font-bold text-[var(--color-text)]">
                  {repo.name}
                </h4>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mb-2">
                {repo.desc}
              </p>
              <p className="font-mono text-[10px] text-[var(--color-accent-light)]">
                {repo.license}
              </p>
            </a>
          ))}
        </div>

        {/* GitHub link */}
        <a
          href="https://github.com/Just4Stan"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          View on GitHub
        </a>
      </div>
    </section>
  );
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
