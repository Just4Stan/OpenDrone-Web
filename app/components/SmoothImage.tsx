import {Image} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import type {ComponentProps} from 'react';

/** Width (px) of the low-quality placeholder fetched from the Shopify CDN.
 *  32px keeps the thumb around 1 KB while still carrying the dominant
 *  colors and rough shape once blurred up. */
const LQIP_WIDTH = 32;

/** Build the tiny-preview URL for a Shopify CDN image by pinning `width`.
 *  Returns null for non-Shopify hosts or unparseable URLs — the cover then
 *  falls back to the flat token background (no wrong-origin fetches). */
function lqipUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url === '') return null;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isShopifyCdn =
      host === 'cdn.shopify.com' ||
      host.endsWith('.shopify.com') ||
      host.endsWith('.shopifycdn.com') ||
      host.endsWith('.shopifycdn.net');
    if (!isShopifyCdn) return null;
    u.searchParams.set('width', String(LQIP_WIDTH));
    u.searchParams.delete('height'); // keep intrinsic ratio at thumb size
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Hydrogen <Image> with a blur-up cover while the file streams in. SSR-safe:
 * the image renders visible by default; only after hydration, if the file
 * hasn't arrived yet, a cover fades over it — a heavily blurred ~1 KB CDN
 * thumb of the same image (flat `--color-bg-elevated` when no thumb URL can
 * be derived) — and crossfades away on load. The cover is absolutely
 * positioned inside the existing wrapper, so aspect-ratio handling and
 * layout are untouched (no shift). Cached images never see it; reduced
 * motion swaps without the fade. No hydration mismatch, no invisible
 * images without JS.
 */
export function SmoothImage(props: ComponentProps<typeof Image>) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'loaded'>('idle');

  // Re-arm whenever the source changes (e.g. PDP gallery paging), so each
  // new file gets its own blur-up instead of a blank swap.
  const srcUrl =
    (props.data && typeof props.data.url === 'string' ? props.data.url : null) ??
    (typeof props.src === 'string' ? props.src : null);
  const tiny = lqipUrl(srcUrl);

  // Synchronous re-arm on source change (sanctioned derived-state pattern:
  // setting state during render restarts the render before commit). Without
  // it the first committed frame after a source swap still has phase
  // 'loaded', so the cover would mount lifted and fade IN over the
  // stale/blank main image instead of appearing instantly.
  const [armedFor, setArmedFor] = useState(srcUrl);
  if (armedFor !== srcUrl) {
    setArmedFor(srcUrl);
    setPhase('loading');
  }

  useEffect(() => {
    // `:scope > img` — the main image is the wrapper's direct child; never
    // match the cover's own thumb img.
    const img = wrapRef.current?.querySelector<HTMLImageElement>(
      ':scope > img',
    );
    if (!img) return;
    if (img.complete) {
      // Already cached — drop any cover from a previous source, never
      // flash one for this one.
      setPhase('idle');
      return;
    }
    setPhase('loading');
    const done = () => setPhase('loaded');
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    return () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
    };
  }, [srcUrl]);

  return (
    <div ref={wrapRef} className="smooth-media">
      <Image {...props} />
      {phase !== 'idle' ? (
        // Keyed by source so a re-arm swaps in a FRESH node at full opacity
        // instead of transitioning the old (lifted, mid-fade) one back up.
        // Once the lift fade finishes the cover leaves the DOM entirely;
        // under reduced motion the transition is disabled so no
        // transitionend fires and the invisible cover simply stays — the
        // pre-existing (harmless) behavior.
        <div
          key={srcUrl ?? 'cover'}
          className={`smooth-media-cover${phase === 'loaded' ? ' is-lifted' : ''}${
            tiny ? '' : ' no-thumb'
          }`}
          aria-hidden="true"
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && phase === 'loaded') {
              setPhase('idle');
            }
          }}
        >
          {tiny ? (
            <img
              src={tiny}
              alt=""
              loading={props.loading === 'eager' ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
