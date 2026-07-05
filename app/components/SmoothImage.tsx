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

  useEffect(() => {
    const img = wrapRef.current?.querySelector('img');
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
        <div
          className={`smooth-media-cover${phase === 'loaded' ? ' is-lifted' : ''}${
            tiny ? '' : ' no-thumb'
          }`}
          aria-hidden="true"
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
