/**
 * Shared motion vocabulary for the storefront.
 *
 * The easing curves here mirror the cubic-beziers already hand-tuned in
 * app.css (the wordmark settle, the chapter scroll-reveal, the expo-out
 * entrances) so that JS-driven motion (Motion / framer-motion) and the
 * existing CSS animation feel like one coherent system rather than two
 * libraries with different personalities.
 *
 * Keep motion calm and engineering-grade: short travel, no bounce/overshoot.
 * Reduced-motion is enforced globally by <MotionConfig reducedMotion="user">
 * in PageLayout — individual components don't need to re-check it.
 */

/** Cubic-bezier control points, as Motion expects them ([x1,y1,x2,y2]). */
export const EASE = {
  /** slow-start, snappy middle, soft land — the PDP `.chapter` reveal curve. */
  reveal: [0.2, 0.7, 0.2, 1],
  /** symmetric in/out — the hero wordmark settle curve. */
  settle: [0.72, 0, 0.28, 1],
  /** expo-out — quick to acknowledge, used for entrances and hovers. */
  out: [0.22, 1, 0.36, 1],
} as const;

export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.5,
} as const;

/**
 * Spring vocabulary for user-initiated detent mechanics (SegmentedControl,
 * sheet tabs, theme/lang flick switches). `sled` moves the thumb, `detent`
 * settles it — ≤1px overshoot, so it reads as a mechanical click, not a
 * bounce. User-initiated: doesn't count against the ≤2-animated-things
 * viewport budget.
 */
export const SPRING = {
  detent: {type: 'spring', stiffness: 900, damping: 52, mass: 0.6},
  sled: {type: 'spring', stiffness: 550, damping: 42},
} as const;

/**
 * In-view reveal: fade + a small rise. Travel is deliberately small (16px)
 * to read as "settling into place", not "flying in". Matches the existing
 * `.chapter` reveal (opacity 0→1, translateY 16px→0) so JS reveals and the
 * CSS ones are indistinguishable.
 */
export const revealVariants = {
  hidden: {opacity: 0, y: 16},
  visible: {
    opacity: 1,
    y: 0,
    transition: {duration: DURATION.slow, ease: EASE.reveal},
  },
} as const;

/**
 * Container that staggers its `Reveal` children, for grids/lists that should
 * cascade in rather than appear all at once. Pair with `revealVariants` on
 * each child.
 */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {staggerChildren: 0.06, delayChildren: 0.02},
  },
} as const;

/**
 * TITLE BLOCK signature reveal: a section hairline *draws in* left-to-right
 * (scaleX 0→1) instead of the generic fade-up stagger. Use with
 * `whileInView="visible"` + `viewport={{once: true}}` on the rule element.
 * `originX: 0` pins the transform origin to the left edge so the rule draws
 * like a plotter stroke. Reduced-motion (global MotionConfig) renders the
 * rule already drawn.
 */
export const drawRule = {
  hidden: {scaleX: 0, originX: 0},
  visible: {
    scaleX: 1,
    originX: 0,
    transition: {duration: DURATION.slow, ease: EASE.reveal},
  },
} as const;

/**
 * The site's signature surface motion: a Pod *expands from its origin* rather
 * than just appearing — dropdowns from their chip, the hero showcase from the
 * shop button, the PDP scroll-bubble into place. Set `transform-origin` on the
 * element to the trigger edge so it grows from the right spot.
 */
export const popOpen = {
  closed: {opacity: 0, scale: 0.96, y: -4},
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {duration: DURATION.base, ease: EASE.out},
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: {duration: DURATION.fast, ease: EASE.out},
  },
} as const;
