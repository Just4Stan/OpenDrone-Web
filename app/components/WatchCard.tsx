import {useEffect, useState} from 'react';

/**
 * The "Watch" bubble in the Open-for-learning chapter. Sized to match the
 * sibling resource cards: the real YouTube thumbnail is cropped into the card,
 * a gold YouTube glyph sits on top, and the caption overlays the bottom (no
 * video title — the thumbnail carries it). Clicking opens an in-page lightbox
 * that lazy-mounts the privacy-enhanced (youtube-nocookie) player and
 * autoplays.
 *
 * The iframe only mounts while the lightbox is open, so the PDP carries no
 * YouTube weight until a visitor actually asks to watch (the lite-embed
 * pattern). Esc and a backdrop click close it; body scroll is locked meanwhile.
 */
export function WatchCard({
  videoId,
  title,
  channel = 'JustFPV',
}: {
  videoId: string;
  title: string;
  channel?: string;
}) {
  const [open, setOpen] = useState(false);
  // maxres is the sharp 16:9 frame but only exists for HD uploads; fall back to
  // hqdefault (always present) if it 404s.
  const [poster, setPoster] = useState(
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="open-source-card watch-card"
        onClick={() => setOpen(true)}
        aria-label={`Watch: ${title}`}
      >
        <img
          className="watch-card-thumb"
          src={poster}
          alt=""
          loading="lazy"
          onError={() =>
            setPoster(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)
          }
        />
        <span className="watch-card-overlay">
          <svg
            className="watch-card-yt"
            viewBox="0 0 28 20"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M27.4 3.12a3.5 3.5 0 0 0-2.46-2.48C22.76 0 14 0 14 0S5.24 0 3.06.64A3.5 3.5 0 0 0 .6 3.12 36.5 36.5 0 0 0 0 10a36.5 36.5 0 0 0 .6 6.88 3.5 3.5 0 0 0 2.46 2.48C5.24 20 14 20 14 20s8.76 0 10.94-.64a3.5 3.5 0 0 0 2.46-2.48A36.5 36.5 0 0 0 28 10a36.5 36.5 0 0 0-.6-6.88Z"
            />
            <path className="watch-card-yt-tri" d="M11.2 14.3 18.5 10 11.2 5.7Z" />
          </svg>
          <span className="open-source-card-label">Watch · {channel} ↗</span>
        </span>
      </button>

      {open ? (
        <div
          className="watch-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="watch-lightbox-close"
            aria-label="Close video"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
          <div
            className="watch-lightbox-frame"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
