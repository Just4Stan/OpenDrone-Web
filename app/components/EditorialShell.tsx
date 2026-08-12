import type {ReactNode} from 'react';
import {Link} from 'react-router';
import {BrandWatermark} from '~/components/BrandWatermark';
import {EDITORIAL_SERIES, nextInSeries} from '~/lib/editorial-index';

/**
 * Three-column reading frame for the long-form pages.
 *
 *   [ series rail ] [ prose, 720px measure ] [ page visual ]
 *
 * The prose column is unchanged: `.editorial-page` still owns the measure,
 * so a page can adopt the shell without its copy reflowing. The rail is the
 * table of contents for the whole series (where am I, what else is there,
 * how long is each), and the aside is whatever picture that page's argument
 * deserves.
 *
 * It degrades by dropping columns, not by hiding content: below 1360px the
 * rail moves under the prose as a "keep reading" list, and below 1120px the
 * aside stacks under the prose too. Nothing is display:none at any width.
 */
export function EditorialShell({
  slug,
  aside,
  pageClassName,
  children,
}: {
  /** This page's slug, matched against EDITORIAL_SERIES. */
  slug: string;
  /** The page's visual column. Omit and the shell runs two-column. */
  aside?: ReactNode;
  /** Extra class on the prose column, e.g. timeline-page. */
  pageClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`editorial-shell${aside ? '' : ' is-narrow'}`}>
      <BrandWatermark />
      <div className={`editorial-page${pageClassName ? ` ${pageClassName}` : ''}`}>
        {children}
        <EditorialNext slug={slug} />
      </div>
      {aside ? <aside className="editorial-aside">{aside}</aside> : null}
      <SeriesRail slug={slug} />
    </div>
  );
}

/**
 * The series index. Rendered after the prose in DOM order so a screen
 * reader and a phone both get the article first; CSS `order` lifts it into
 * the left column on wide viewports.
 *
 * Number and title only. The hooks and reading times live in the data for
 * the end-of-page hand-off card; putting them in the rail made it a wall
 * of small text competing with the article.
 */
function SeriesRail({slug}: {slug: string}) {
  return (
    <nav className="series-rail" aria-label="Reading series">
      <ol className="series-rail-list">
        {EDITORIAL_SERIES.map((entry, i) => {
          const current = entry.slug === slug;
          return (
            <li key={entry.slug} className={current ? 'is-current' : undefined}>
              <Link
                prefetch="viewport"
                to={`/${entry.slug}`}
                aria-current={current ? 'page' : undefined}
              >
                <span className="series-rail-num">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="series-rail-title">{entry.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** End-of-page hand-off to the next entry. The thing that keeps a reader going. */
function EditorialNext({slug}: {slug: string}) {
  const next = nextInSeries(slug);
  if (!next) return null;
  return (
    <Link prefetch="viewport" to={`/${next.slug}`} className="editorial-next">
      <span className="editorial-next-label">Next in the series</span>
      <span className="editorial-next-title">{next.title}</span>
      <span className="editorial-next-hook">{next.hook}</span>
      <span className="editorial-next-min">{next.minutes} min read →</span>
    </Link>
  );
}
