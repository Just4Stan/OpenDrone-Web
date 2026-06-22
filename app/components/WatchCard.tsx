import {useState} from 'react';

/**
 * The "Watch" bubble in the Open-for-learning chapter. The real YouTube
 * thumbnail is cropped into the card with a centred gold play mark; clicking
 * opens the video on YouTube in a new tab.
 */
export function WatchCard({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
  /** Accepted for call-site symmetry; not rendered. */
  channel?: string;
}) {
  // maxres is the sharp 16:9 frame but only exists for HD uploads; fall back to
  // hqdefault (always present) if it 404s.
  const [poster, setPoster] = useState(
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  );

  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="open-source-card watch-card"
      aria-label={`Watch on YouTube: ${title}`}
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
        <svg className="watch-card-yt" viewBox="0 0 28 20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M27.4 3.12a3.5 3.5 0 0 0-2.46-2.48C22.76 0 14 0 14 0S5.24 0 3.06.64A3.5 3.5 0 0 0 .6 3.12 36.5 36.5 0 0 0 0 10a36.5 36.5 0 0 0 .6 6.88 3.5 3.5 0 0 0 2.46 2.48C5.24 20 14 20 14 20s8.76 0 10.94-.64a3.5 3.5 0 0 0 2.46-2.48A36.5 36.5 0 0 0 28 10a36.5 36.5 0 0 0-.6-6.88Z"
          />
          <path className="watch-card-yt-tri" d="M11.2 14.3 18.5 10 11.2 5.7Z" />
        </svg>
      </span>
    </a>
  );
}
