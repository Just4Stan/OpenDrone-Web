import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import type {Route} from './+types/timeline';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

/**
 * Every word on this page comes from `content/copy/timeline.json`, edited in
 * the studio. What stays here is structure and evidence: which events exist,
 * their dates, tags, kinds and receipt URLs. An event's title and detail are
 * copy, keyed off its `id`; its date is not, because the same date sorts the
 * list and groups it by year.
 */
export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('timeline.meta_title') ?? 'Timeline',
    description: copyText('timeline.meta_description') ?? '',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

type EventKind =
  | 'commit'
  | 'order'
  | 'validation'
  | 'cert'
  | 'upstream'
  | 'launch'
  | 'post';

type TimelineEvent = {
  /** Copy key stem: `event_<id>_title` and optional `event_<id>_detail`. */
  id: string;
  date: string; // YYYY-MM-DD
  /** Filter tag: esc | fc | rx | frame | company. Untagged = company. */
  tag?: 'esc' | 'fc' | 'rx' | 'frame' | 'company';
  kind: EventKind;
  /** Public receipt: repo, commit, tag, certification, or post. */
  url?: string;
};

const KIND_GLYPH: Record<EventKind, string> = {
  commit: '⌥',
  order: '▦',
  validation: '✓',
  cert: '◉',
  upstream: '⇪',
  launch: '⚑',
  post: '✎',
};

const FILTERS: Array<{key: 'all' | NonNullable<TimelineEvent['tag']>}> = [
  {key: 'all'},
  {key: 'esc'},
  {key: 'fc'},
  {key: 'rx'},
  {key: 'frame'},
  {key: 'company'},
];

/**
 * Verified events only: each entry's date and claim must be reproducible
 * from the linked receipt (git history, OSHWA directory, published post).
 * Keep newest LAST in this array; the page renders newest first.
 */
const TIMELINE: TimelineEvent[] = [
  {id: 'esc20_first_commit', date: '2026-03-09', tag: 'esc', kind: 'commit', url: 'https://github.com/OpenDrone-hw/OpenESC-20x20/commits/main'},
  {id: 'esc_build_video', date: '2026-03-10', tag: 'esc', kind: 'post', url: 'https://www.youtube.com/watch?v=TwAmmPxOpTM'},
  {id: 'esc30_repo_split', date: '2026-03-11', tag: 'esc', kind: 'commit', url: 'https://github.com/OpenDrone-hw/OpenESC-30x30/commits/main'},
  {id: 'esc_first_production_files', date: '2026-03-16', tag: 'esc', kind: 'order', url: 'https://github.com/OpenDrone-hw/OpenESC-20x20'},
  {id: 'fc_mini_first_commit', date: '2026-03-19', tag: 'fc', kind: 'commit', url: 'https://github.com/OpenDrone-hw/OpenFC-Lite-Mini/commits/main'},
  {id: 'web_first_commit', date: '2026-03-21', tag: 'company', kind: 'commit', url: 'https://github.com/OpenDrone-hw/OpenDrone-Web/commits/main'},
  {id: 'rx_first_commit', date: '2026-03-23', tag: 'rx', kind: 'commit', url: 'https://github.com/OpenDrone-hw/OpenRX/commits/main'},
  {id: 'bf_osd_merged', date: '2026-04-22', tag: 'fc', kind: 'upstream', url: 'https://github.com/betaflight/betaflight/pull/14882'},
  {id: 'fc_build_video', date: '2026-05-25', tag: 'fc', kind: 'post', url: 'https://www.youtube.com/watch?v=XDYZoMRJFeQ'},
  {id: 'fc_lite_first_commit', date: '2026-06-03', tag: 'fc', kind: 'commit', url: 'https://github.com/OpenDrone-hw/OpenFC-Lite/commits/main'},
  {id: 'esc_validation_exports', date: '2026-06-05', tag: 'esc', kind: 'order', url: 'https://github.com/OpenDrone-hw/OpenESC-20x20'},
  {id: 'rx_fab_ordered', date: '2026-06-10', tag: 'rx', kind: 'order', url: 'https://github.com/OpenDrone-hw/OpenRX'},
  {id: 'charger_first_commit', date: '2026-06-14', tag: 'company', kind: 'commit', url: 'https://github.com/OpenDrone-hw/Charger/commits/main'},
  {id: 'site_redesign', date: '2026-06-21', tag: 'company', kind: 'launch', url: 'https://github.com/OpenDrone-hw/OpenDrone-Web'},
  {id: 'library_first_commit', date: '2026-06-29', tag: 'company', kind: 'commit', url: 'https://github.com/OpenDrone-hw/KiCad-Library/commits/main'},
  {id: 'frame_first_commit', date: '2026-07-05', tag: 'frame', kind: 'commit'},
  {id: 'esc_bench_validation', date: '2026-07-05', tag: 'esc', kind: 'validation'},
  {id: 'rx_rf_baselines', date: '2026-07-06', tag: 'rx', kind: 'validation'},
  {id: 'rx_range_video', date: '2026-07-18', tag: 'rx', kind: 'post', url: 'https://www.youtube.com/watch?v=ssmQkRkXE84'},
  {id: 'esc20_rework_proposal', date: '2026-07-25', tag: 'esc', kind: 'upstream', url: 'https://github.com/OpenDrone-hw/OpenESC-20x20/issues/8'},
  {id: 'frame_samples_ordered', date: '2026-07-28', tag: 'frame', kind: 'order'},
  {id: 'library_live', date: '2026-08-04', tag: 'company', kind: 'launch', url: 'https://github.com/OpenDrone-hw/KiCad-Library'},
  {id: 'frame_v01_tagged', date: '2026-08-04', tag: 'frame', kind: 'launch'},
  {id: 'batch1_planned', date: '2026-08-04', tag: 'company', kind: 'order'},
  {id: 'hardware_validated', date: '2026-08-05', tag: 'company', kind: 'validation'},
  {id: 'oshwa_certified', date: '2026-08-05', tag: 'company', kind: 'cert', url: 'https://certification.oshwa.org/list.html'},
  {id: 'release_tags_cut', date: '2026-08-06', tag: 'company', kind: 'launch', url: 'https://github.com/OpenDrone-hw'},
];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Scroll-driven trace: the gold spine draws downward as the visitor
 * scrolls and each pad lights once passed. Pure CSS custom property +
 * class toggles; reduced motion renders everything on.
 */
function useTraceProgress(
  rootRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const rows = root.querySelectorAll<HTMLElement>('.tl-event');
    if (reduce) {
      root.style.setProperty('--tl-progress', '1');
      rows.forEach((r) => r.classList.add('is-passed'));
      return;
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = root.getBoundingClientRect();
        const viewH = window.innerHeight;
        // Progress: how far the viewport's 70% line has travelled through
        // the timeline block.
        const line = viewH * 0.7;
        const p = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
        root.style.setProperty('--tl-progress', p.toFixed(4));
        rows.forEach((r) => {
          const rr = r.getBoundingClientRect();
          r.classList.toggle('is-passed', rr.top < line);
        });
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef]);
}

export default function TimelineRoute() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const rootRef = useRef<HTMLDivElement | null>(null);
  useTraceProgress(rootRef);

  // Newest first, grouped by year.
  const groups = useMemo(() => {
    const events = [...TIMELINE]
      .filter((e) => filter === 'all' || (e.tag ?? 'company') === filter)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const byYear = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const y = e.date.slice(0, 4);
      byYear.set(y, [...(byYear.get(y) ?? []), e]);
    }
    return [...byYear.entries()];
  }, [filter]);

  return (
    <EditorialShell slug="timeline" pageClassName="timeline-page">
      <header className="editorial-hero">
        <Txt id="timeline.title" as="h1" className="editorial-title" />
        <Txt id="timeline.lead" as="p" className="editorial-lead" />
        <div
          className="tl-filters"
          role="group"
          aria-label="Filter timeline by product"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tl-filter${filter === f.key ? ' is-active' : ''}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              <Txt id={`timeline.filter_${f.key}`} />
            </button>
          ))}
        </div>
      </header>

      <div className="tl-root" ref={rootRef}>
        <div className="tl-trace" aria-hidden="true" />
        {groups.map(([year, events]) => (
          <section key={year} className="tl-year">
            <h2 className="tl-year-label">{year}</h2>
            <ol className="tl-events">
              {events.map((e) => (
                <li key={e.id} className="tl-event">
                  <span className="tl-pad" aria-hidden="true" />
                  <div className="tl-card">
                    <p className="tl-date">
                      <span className="tl-glyph" aria-hidden="true">
                        {KIND_GLYPH[e.kind]}
                      </span>
                      {fmtDate(e.date)}
                      {e.tag && e.tag !== 'company' ? (
                        <span className="tl-tag">{e.tag.toUpperCase()}</span>
                      ) : null}
                    </p>
                    <h3 className="tl-title">
                      {e.url ? (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Txt id={`timeline.event_${e.id}_title`} /> ↗
                        </a>
                      ) : (
                        <Txt id={`timeline.event_${e.id}_title`} />
                      )}
                    </h3>
                    {/* No detail key on this event renders nothing. */}
                    <Txt
                      id={`timeline.event_${e.id}_detail`}
                      as="p"
                      className="tl-detail"
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {groups.length === 0 ? (
          <Txt id="timeline.empty" as="p" className="tl-empty" />
        ) : null}
      </div>

      <section className="editorial-cta">
        <Link prefetch="viewport" to="/roadmap" className="editorial-cta-primary">
          <Txt id="timeline.cta_primary" />
        </Link>
        <Link
          prefetch="viewport"
          // "Put yourself on this timeline" is a contributing pitch, not a
          // second roadmap link (audit 2026-08-12).
          to="/contributing"
          className="editorial-cta-secondary"
        >
          <Txt id="timeline.cta_secondary" />
        </Link>
      </section>
    </EditorialShell>
  );
}
