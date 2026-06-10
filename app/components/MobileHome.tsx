import {Suspense} from 'react';
import {Await, Link} from 'react-router';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {HeroWordmark} from '~/components/HeroWordmark';
import {ProductItem} from '~/components/ProductItem';

/**
 * Static, non-interactive homepage for phones (≤768px).
 *
 * The desktop homepage IS the WebGL hero scene + scroll-pinned
 * choreography (see DesktopHome in routes/_index.tsx). That experience is
 * deliberately never loaded on mobile — ~6.3 MB of GLBs and a scroll story
 * tuned for a mouse. Rendering only the desktop tree on a phone left a
 * ~400vh empty void with floating, overlapping CTAs. This component is
 * the mobile counterpart: a plain landing page that gets a visitor to the
 * flagship products and the catalogue with no 3D and no scroll tricks.
 */
export function MobileHome({
  featured,
}: {
  featured: Promise<CollectionItemFragment[]>;
}) {
  return (
    <div className="home-mobile">
      <section className="home-mobile-hero">
        <h1 className="home-mobile-wordmark" aria-label="OpenDrone">
          <HeroWordmark progress={1} className="is-filled" />
        </h1>
        <p className="home-mobile-tagline">
          Open-source flight controllers, ESCs, and frames. Designed in
          Belgium.
        </p>
        <div className="home-mobile-cta">
          <Link prefetch="viewport" to="/collections/all" className="hero-action-primary">
            Shop
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <a
            href="https://github.com/incutec-hw"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-action-secondary"
            aria-label="View source on GitHub"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </section>

      <Suspense fallback={null}>
        <Await resolve={featured} errorElement={null}>
          {(items) =>
            items.length > 0 ? (
              <section className="home-mobile-featured">
                <p className="section-label">Flagship hardware</p>
                <div className="home-mobile-grid">
                  {items.map((product, i) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      loading={i === 0 ? 'eager' : 'lazy'}
                    />
                  ))}
                </div>
              </section>
            ) : null
          }
        </Await>
      </Suspense>

      <Link prefetch="viewport" to="/collections/all" className="home-mobile-browse">
        Browse the full catalogue
        <svg
          width="16"
          height="16"
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
  );
}
