import {Link} from 'react-router';
import {pickVersionTag} from './VersionChip';

type StripArticle = {
  handle: string;
  title: string;
  publishedAt: string;
  excerpt: string | null;
  tags: string[];
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/**
 * Homepage cell pulling release articles from the `releases` blog.
 *
 * Three layouts:
 *  - "ribbon" (default) — single horizontal row, eyebrow | body | CTA.
 *    Best when the homepage already has a strong hero.
 *  - "card"   — stacked vertical card. Best when releases are the
 *    homepage's main job.
 *  - "rail"   — top-bordered list of recent releases. Best as a
 *    sidebar / lower-fold cell.
 *
 * The loader on the homepage route picks the variant; the variant only
 * affects render — the data shape is the same for all three.
 */
export function LatestReleaseStrip({
  articles,
  variant = 'ribbon',
}: {
  articles: StripArticle[];
  variant?: 'ribbon' | 'card' | 'rail';
}) {
  if (articles.length === 0) return null;
  const latest = articles[0];
  const version = pickVersionTag(latest.tags);

  if (variant === 'rail') {
    const recent = articles.slice(0, 4);
    return (
      <div className="rn-strip is-rail">
        <div className="rn-strip-rail-head">
          <span>Recent releases</span>
          <Link to="/releases">All releases →</Link>
        </div>
        {recent.map((a) => {
          const v = pickVersionTag(a.tags);
          return (
            <Link
              key={a.handle}
              to={`/releases/${a.handle}`}
              className="rn-strip-row"
              prefetch="intent"
            >
              <span className="rn-rail-date">{formatDate(a.publishedAt)}</span>
              <span className="rn-rail-headline">{a.title}</span>
              <span className="rn-rail-version">{v ?? '—'}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Link
        to={`/releases/${latest.handle}`}
        className="rn-strip is-card"
        prefetch="intent"
      >
        <div className="rn-strip-eyebrow">
          <span>Latest release</span>
          <span className="rn-strip-date">{formatDate(latest.publishedAt)}</span>
          {version ? <span>· {version}</span> : null}
        </div>
        <h3 className="rn-strip-headline">{latest.title}</h3>
        {latest.excerpt ? (
          <p className="rn-strip-summary">{latest.excerpt}</p>
        ) : null}
        <span className="rn-strip-cta">Read release →</span>
      </Link>
    );
  }

  // Default — "ribbon"
  return (
    <Link
      to={`/releases/${latest.handle}`}
      className="rn-strip"
      prefetch="intent"
    >
      <div className="rn-strip-eyebrow">
        <span>Latest release</span>
        <span className="rn-strip-date">{formatDate(latest.publishedAt)}</span>
      </div>
      <div className="rn-strip-body">
        <h3 className="rn-strip-headline">{latest.title}</h3>
        {latest.excerpt ? (
          <p className="rn-strip-summary">{latest.excerpt}</p>
        ) : null}
      </div>
      <span className="rn-strip-cta">Read →</span>
    </Link>
  );
}
