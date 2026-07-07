/**
 * app/lib/gsap.ts — GSAP loader + scroll-driver gate for the homepage hero.
 *
 * ENGINE OWNERSHIP (read before adding GSAP anywhere in the app):
 *   • GSAP owns ONLY the hero scroll driver — the ScrollTrigger that snaps the
 *     native scrollbar to the registry stops over the pinned hero range (and,
 *     later, optionally the homepage Drawing Register "plotter" scrub).
 *   • motion@12 owns every discrete / enter transition on the page.
 *   • NEVER run both engines on one element. The known hotspot is motion's hero
 *     buy-stack (the `HERO_STACK_SWAP` AnimatePresence cross-slide) vs the
 *     scroll-driven reveal children — they live on separate DOM nodes and must
 *     stay that way.
 *
 * GSAP is code-split and NEVER shipped to mobile or reduced-motion visitors:
 * `loadGsap()` is a no-op server-side, and `withScrub()` only imports + builds
 * inside a `(prefers-reduced-motion: no-preference) and (min-width: 769px)`
 * matchMedia — the same desktop / no-reduced-motion gate `shouldLoadHero()`
 * uses for the GLB chunk. Phones and reduced-motion visitors keep plain native
 * scroll and their bundle contains no gsap.
 */

// Type-only queries against the dynamic-import modules: these are erased at
// compile time, so they add nothing to the eager module graph — the value
// import happens lazily inside `loadGsap()`.
export type GsapApi = {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
};

// SSR-guarded, single-flight dynamic import mirroring `heroScenePromise` in
// _index.tsx. The ScrollTrigger plugin registers exactly once. Returns null
// server-side so callers branch without their own window check.
let gsapPromise: Promise<GsapApi> | null = null;

export function loadGsap(): Promise<GsapApi> | null {
  if (typeof window === 'undefined') return null;
  if (!gsapPromise) {
    gsapPromise = Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]).then(([g, st]) => {
      const {gsap} = g;
      const {ScrollTrigger} = st;
      gsap.registerPlugin(ScrollTrigger);
      return {gsap, ScrollTrigger};
    });
  }
  return gsapPromise;
}

/**
 * Run `build` to create ScrollTriggers / tweens ONLY on desktop with motion
 * enabled, and return a cleanup that tears everything down.
 *
 * The `gsap.matchMedia()` context auto-collects everything `build` creates and
 * reverts it when the query stops matching (window resized past 769px, OS
 * reduced-motion flipped on) OR when the returned cleanup runs. Mobile and
 * reduced-motion visitors never import GSAP at all — the promise resolves and
 * the media simply never matches, so `build` never fires.
 */
export async function withScrub(
  build: (api: GsapApi) => void,
): Promise<() => void> {
  const pending = loadGsap();
  if (!pending) return () => {};
  const api = await pending;
  const mm = api.gsap.matchMedia();
  mm.add(
    '(prefers-reduced-motion: no-preference) and (min-width: 769px)',
    () => {
      build(api);
    },
  );
  return () => mm.revert();
}
