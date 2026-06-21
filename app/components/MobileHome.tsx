import {Suspense} from 'react';
import {Await, Link} from 'react-router';
import {motion, useReducedMotion, type MotionProps} from 'motion/react';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {HeroWordmark} from '~/components/HeroWordmark';
import {ProductItem} from '~/components/ProductItem';

/**
 * Phone homepage (≤768px). The desktop homepage IS the WebGL hero scene +
 * scroll-pinned choreography (DesktopHome in routes/_index.tsx) — ~6.3 MB of
 * GLBs and a scroll story tuned for a mouse, deliberately never loaded on a
 * phone. This is the mobile counterpart: not a plain fallback but a hero in its
 * own right — the animated wordmark, a floating "stack" of the real board
 * renders under a gold glow (the desktop hero's product showcase, distilled),
 * and a Dynamic-Island Shop pill — then a clear path to the flagship line and
 * the full catalogue. No 3D, no scroll tricks: fast, legible, touch-first.
 */
export function MobileHome({
  featured,
}: {
  featured: Promise<CollectionItemFragment[]>;
}) {
  const reduce = useReducedMotion();

  // Staggered entrance: each block rises + fades a beat after the last. Skipped
  // wholesale under prefers-reduced-motion (rendered static, no transform).
  const rise = (i: number): MotionProps =>
    reduce
      ? {}
      : {
          initial: {opacity: 0, y: 18},
          animate: {opacity: 1, y: 0},
          transition: {
            duration: 0.55,
            delay: i * 0.09,
            ease: [0.22, 1, 0.36, 1],
          },
        };

  return (
    <div className="home-mobile">
      <section className="home-mobile-hero">
        {/* Floating board "stack" — the two flagship boards (FC over ESC),
            offset like the OpenStack bundle, on a gold-glow island. The desktop
            hero's rotatable 3D trio, distilled to a still that loads instantly. */}
        <motion.div className="home-mobile-stage" {...rise(0)} aria-hidden="true">
          <span className="home-mobile-glow" />
          <img
            className="home-mobile-board home-mobile-board--rear"
            src="/boards/openesc/front.png"
            alt=""
            width={520}
            height={520}
            loading="eager"
            decoding="async"
          />
          <img
            className="home-mobile-board home-mobile-board--front"
            src="/boards/openfc-lite/front.png"
            alt=""
            width={520}
            height={520}
            loading="eager"
            decoding="async"
          />
        </motion.div>

        <motion.h1
          className="home-mobile-wordmark"
          aria-label="OpenDrone"
          {...rise(1)}
        >
          <HeroWordmark progress={1} className="is-filled" />
        </motion.h1>

        <motion.p className="home-mobile-tagline" {...rise(2)}>
          Open Source drone parts, designed in Belgium. Published and transparent
          so you can understand it, not just fly it.
        </motion.p>

        {/* Two full-width actions side by side — Shop (gold) + GitHub (ghost).
            Each is its own pill spanning half the row, not nested in one pod. */}
        <motion.div className="home-mobile-cta" {...rise(3)}>
          <Link
            prefetch="viewport"
            to="/collections/all"
            className="home-mobile-cta-btn home-mobile-cta-shop"
          >
            Shop
            <svg
              width="18"
              height="18"
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
            className="home-mobile-cta-btn home-mobile-cta-github"
            aria-label="View source on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </motion.div>
      </section>

      <Suspense fallback={null}>
        <Await resolve={featured} errorElement={null}>
          {(items) =>
            items.length > 0 ? (
              <section className="home-mobile-featured">
                <p className="section-label">Flagship hardware</p>
                <p className="home-mobile-featured-note">
                  FC, ESC, RX and frame. The OpenStack is simply the FC + ESC
                  bundled together.
                </p>
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

      <Link
        prefetch="viewport"
        to="/collections/all"
        className="home-mobile-browse"
      >
        Browse the full catalog
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
