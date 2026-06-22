import {useEffect, useState} from 'react';

/**
 * The "Watch" bubble in the Open-for-learning chapter — a richer sibling of the
 * plain resource cards. The video's real YouTube thumbnail fills the card; a
 * light scrim along the bottom keeps the label/title legible. Clicking opens an
 * in-page lightbox that lazy-mounts the privacy-enhanced (youtube-nocookie)
 * player and autoplays.
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
        <span className="watch-card-body">
          <span className="open-source-card-label">Watch</span>
          <span className="open-source-card-title">{title}</span>
          <span className="open-source-card-sub">{channel} · YouTube ↗</span>
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
