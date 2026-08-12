import type {ReactNode} from 'react';
import {useEffect, useRef} from 'react';
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
  const shellRef = useRef<HTMLDivElement>(null);

  // Reading cascade. Every block in the prose column reveals as the reader
  // reaches it: blocks that enter the viewport together (a whole page on a
  // tall screen) stagger top-to-bottom at reading pace, blocks that arrive
  // by scrolling appear on cue. The margin sketch of a section starts its
  // stroke draw on the same cue, so drawing and reading share a clock.
  // Armed entirely at runtime: without JS everything is simply visible, and
  // reduced-motion readers never enter the system at all.
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(
      root.querySelectorAll(
        '.editorial-hero > *, .editorial-section > *, .editorial-cta > *',
      ),
    );
    const io = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort(
            (a, b) =>
              a.getBoundingClientRect().top - b.getBoundingClientRect().top,
          );
        entering.forEach((el, i) => {
          el.style.setProperty('--rv-d', `${Math.min(i, 14) * 110}ms`);
          el.classList.add('is-revealed');
          if (el.classList.contains('section-art')) el.classList.add('is-drawn');
          io.unobserve(el);
        });
      },
      {rootMargin: '0px 0px -8% 0px'},
    );
    for (const el of items) {
      el.classList.add('reveal-item');
      io.observe(el);
    }
    return () => io.disconnect();
  }, [slug]);

  return (
    <div className={`editorial-shell${aside ? '' : ' is-narrow'}`} ref={shellRef}>
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
