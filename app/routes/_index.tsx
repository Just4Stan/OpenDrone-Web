import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useState} from 'react';
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
    <div>
      <HeroSection />
      <FeaturesSection />
      <ProductsSection products={data.recommendedProducts} />
      <OpenSourceSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[200vh] overflow-hidden">
      {/* 3D Scene — sticky, full viewport */}
      <div className="sticky top-0 h-screen">
        <div className="absolute inset-0">
          <ClientHeroScene />
        </div>

        {/* Gradient overlays — less aggressive so drone is prominent */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg)]/80 via-transparent to-[var(--color-bg)]/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg)]/70 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 flex items-center h-full">
          <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)] mb-4">
            Open Source Drone Electronics
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            Build Better
            <br />
            <span className="text-[var(--color-gold)]">Drones.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] max-w-lg mb-10 leading-relaxed">
            Flight controllers and ESCs designed from the ground up.
            Open hardware, open firmware, no compromises.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/collections/all"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] text-[var(--color-bg)] font-mono text-sm font-bold uppercase tracking-wider rounded hover:bg-[var(--color-gold-hover)] transition-colors"
            >
              Shop Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a
              href="https://github.com/Just4Stan"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--color-border)] text-[var(--color-text)] font-mono text-sm uppercase tracking-wider rounded hover:border-[var(--color-text-muted)] transition-colors"
            >
              View Source
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
          <span className="font-mono text-[10px] uppercase tracking-widest">Scroll to explore</span>
          <div className="w-px h-8 bg-gradient-to-b from-[var(--color-text-muted)] to-transparent animate-pulse" />
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
      description: 'STM32H7-based FC with dual IMU, barometer, and OSD. Betaflight & INAV compatible.',
      specs: ['STM32H750', '2x BMI270 IMU', 'BMP388 Baro', '8 Motor Outputs'],
    },
    {
      title: 'OpenESC',
      subtitle: 'Electronic Speed Controller',
      description: '4-in-1 ESC with AM32 firmware. 50A continuous per motor, 128kHz PWM.',
      specs: ['50A Continuous', 'AM32 Firmware', '128kHz PWM', 'DShot1200'],
    },
    {
      title: 'Open Stack',
      subtitle: 'FC + ESC Combo',
      description: 'Perfect integration. 30.5x30.5mm mounting. Single connector between boards.',
      specs: ['30.5mm Mount', '8-pin Connector', '3-6S LiPo', '20x20mm Option'],
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)] mb-3">
            Hardware
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Designed for Performance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-light)]/30 transition-all duration-300"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-1">
                {feature.subtitle}
              </p>
              <h3 className="font-display text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
                {feature.description}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {feature.specs.map((spec) => (
                  <div
                    key={spec}
                    className="px-2 py-1 bg-[var(--color-bg)] rounded text-xs font-mono text-[var(--color-text-muted)]"
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
    <section className="py-24 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)] mb-3">
            Shop
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Products
          </h2>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Array.from({length: 4}).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-[var(--color-bg-card)] rounded-lg animate-pulse"
                />
              ))}
            </div>
          }
        >
          <Await resolve={products}>
            {(response) => (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {response?.products.nodes.length ? (
                  response.products.nodes.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))
                ) : (
                  <div className="col-span-full text-center py-16">
                    <p className="text-[var(--color-text-muted)] font-mono text-sm">
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
  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-accent)] mb-3">
          Community
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-6">
          100% Open Source
        </h2>
        <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Every schematic, every PCB layout, every line of firmware — open and free.
          Hardware licensed under CERN-OHL-S, firmware under GPL/MIT.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://github.com/Just4Stan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded hover:border-[var(--color-text-muted)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="font-mono text-sm">GitHub</span>
          </a>
        </div>

        {/* Repo cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto">
          {[
            {name: 'OpenFC', description: '20x20 flight controller with integrated ELRS receiver', license: 'CERN-OHL-S', url: 'https://github.com/Just4Stan/OpenFC'},
            {name: 'Open-4in1-AM32-ESC', description: '20x20 4-in-1 ESC, 35A, AM32 firmware', license: 'CERN-OHL-S', url: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC'},
            {name: 'Open-4in1-AM32-ESC-30x30', description: '30x30 variant of the 4-in-1 ESC', license: 'CERN-OHL-S', url: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC-30x30'},
          ].map((repo) => (
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              key={repo.name}
              className="text-left p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-light)]/30 transition-all"
            >
              <h4 className="font-mono text-sm font-bold text-[var(--color-accent-light)] mb-1">
                {repo.name}
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                {repo.description}
              </p>
              <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
                {repo.license}
              </p>
            </a>
          ))}
        </div>
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
