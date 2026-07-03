import {Image} from '@shopify/hydrogen';
import {useSearchParams} from 'react-router';
import {useEffect, useRef} from 'react';
import {SmoothImage} from './SmoothImage';

type GalleryImage = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

const IMAGE_PARAM = 'image';

export function ProductGallery({
  images,
  activeImageId,
}: {
  images: GalleryImage[];
  activeImageId?: string | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Swipe tracker (declared before any early return so the hook order is stable).
  const touch = useRef<{x: number; y: number} | null>(null);
  const parsed = parseInt(searchParams.get(IMAGE_PARAM) ?? '', 10);
  const fallbackIndex = activeImageId
    ? Math.max(
        0,
        images.findIndex((img) => img.id === activeImageId),
      )
    : 0;
  const index =
    Number.isFinite(parsed) && parsed >= 0 && parsed < images.length
      ? parsed
      : fallbackIndex;

  useEffect(() => {
    if (!searchParams.has(IMAGE_PARAM)) return;
    if (parsed >= 0 && parsed < images.length) return;
    const next = new URLSearchParams(searchParams);
    next.delete(IMAGE_PARAM);
    setSearchParams(next, {replace: true, preventScrollReset: true});
  }, [parsed, images.length, searchParams, setSearchParams]);

  if (images.length === 0) {
    return (
      <div className="product-gallery-empty">
        <span className="product-card-media-ghost">Render pending</span>
      </div>
    );
  }

  const setIndex = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n === 0) next.delete(IMAGE_PARAM);
    else next.set(IMAGE_PARAM, String(n));
    setSearchParams(next, {replace: true, preventScrollReset: true});
  };

  const prev = () => setIndex(index === 0 ? images.length - 1 : index - 1);
  const next = () => setIndex(index === images.length - 1 ? 0 : index + 1);
  const current = images[index];

  // Touch swipe: flick the main image ←/→ to step photos. Same threshold +
  // direction-ratio gate as the board explorer (BoardArt). Horizontal-only —
  // we never preventDefault, so a vertical drag still scrolls the page; only a
  // deliberate sideways flick (>44px and >1.3× the vertical travel) navigates.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = {x: t.clientX, y: t.clientY};
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || images.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <div className="product-gallery">
      <div
        className="product-gallery-main"
        role="group"
        aria-label="Product images"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <SmoothImage
          data={current}
          alt={current.altText || 'Product image'}
          aspectRatio="1/1"
          sizes="(min-width: 960px) 60vw, 100vw"
          loading="eager"
          // This is the PDP's LCP element — without an explicit priority it
          // competes with the route chunk + fonts at default priority.
          fetchPriority="high"
        />
        {images.length > 1 && (
          <div className="product-gallery-controls" aria-hidden="false">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="product-gallery-arrow"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="product-gallery-counter" aria-live="polite">
              {index + 1}/{images.length}
            </span>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="product-gallery-arrow"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
        {images.length > 1 && (
          <span className="product-gallery-swipe-hint" aria-hidden="true">
            Swipe ←/→
          </span>
        )}
      </div>
      {/* Mobile swipe bar — the touch-first replacement for the arrow pill +
          thumbnail strip (both hidden on mobile via CSS). A tick per image (tap
          to jump) + counter + swipe hint, matching the board/schematic decks. */}
      {images.length > 1 && (
        <div className="product-gallery-deck">
          <div className="board-deck-dots" aria-label="Product image">
            {images.map((img, i) => (
              <button
                type="button"
                key={img.id ?? img.url}
                className={`board-deck-dot${i === index ? ' is-active' : ''}${
                  i < index ? ' is-done' : ''
                }`}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <p className="board-deck-meta" aria-live="polite">
            <span className="board-deck-count">
              {index + 1}/{images.length}
            </span>
            <span className="board-deck-hint">Swipe ←/→</span>
          </p>
        </div>
      )}
      {images.length > 1 && (
        <ul className="product-gallery-thumbs" role="tablist" aria-label="Product image thumbnails">
          {images.map((img, i) => (
            <li key={img.id ?? img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-selected={i === index}
                role="tab"
                className={`product-gallery-thumb${
                  i === index ? ' is-active' : ''
                }`}
              >
                <Image
                  data={img}
                  alt={img.altText || `Thumbnail ${i + 1}`}
                  aspectRatio="1/1"
                  sizes="80px"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
