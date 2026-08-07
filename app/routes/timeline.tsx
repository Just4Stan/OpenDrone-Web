import {useEffect, useMemo, useRef, useState} from 'react';
import type {Route} from './+types/timeline';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Timeline · OpenDrone, dated',
    description:
      'Every milestone of the OpenDrone project with a receipt: first commits, fab orders, bench validations, certifications, upstream merges.',
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
  date: string; // YYYY-MM-DD
  title: string;
  detail?: string;
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

const FILTERS: Array<{key: 'all' | NonNullable<TimelineEvent['tag']>; label: string}> = [
  {key: 'all', label: 'Everything'},
  {key: 'esc', label: 'OpenESC'},
  {key: 'fc', label: 'OpenFC'},
  {key: 'rx', label: 'OpenRX'},
  {key: 'frame', label: 'OpenFrame'},
  {key: 'company', label: 'Company'},
];

/**
 * Verified events only: each entry's date and claim must be reproducible
 * from the linked receipt (git history, OSHWA directory, published post).
 * Keep newest LAST in this array; the page renders newest first.
 */
const TIMELINE: TimelineEvent[] = [
  {date: '2026-03-09', title: 'OpenESC 20×20: first commit', detail: 'The project starts as one 4-in-1 ESC design.', tag: 'esc', kind: 'commit', url: 'https://github.com/incutec-hw/OpenESC_20X20/commits/main'},
  {date: '2026-03-10', title: 'ESC build video published', detail: 'How drone ESCs work (so I built my own).', tag: 'esc', kind: 'post', url: 'https://www.youtube.com/watch?v=TwAmmPxOpTM'},
  {date: '2026-03-11', title: 'OpenESC 30×30 split into its own repo', tag: 'esc', kind: 'commit', url: 'https://github.com/incutec-hw/OpenESC-30x30/commits/main'},
  {date: '2026-03-16', title: 'First production files exported', detail: '20×20 V1 and 30×30 V0.1 gerbers, BOM and placement.', tag: 'esc', kind: 'order', url: 'https://github.com/incutec-hw/OpenESC_20X20'},
  {date: '2026-03-19', title: 'OpenFC Lite Mini: first commit', detail: 'A stripped, cost-down flight controller begins.', tag: 'fc', kind: 'commit', url: 'https://github.com/incutec-hw/OpenFC-Lite-Mini/commits/main'},
  {date: '2026-03-21', title: 'This webshop: first commit', tag: 'company', kind: 'commit', url: 'https://github.com/incutec-hw/OpenDrone-Web/commits/main'},
  {date: '2026-03-23', title: 'OpenRX: first commit', detail: 'A six-receiver ExpressLRS lineup, shared BOM.', tag: 'rx', kind: 'commit', url: 'https://github.com/incutec-hw/OpenRX/commits/main'},
  {date: '2026-04-22', title: 'RP2350 framebuffer OSD merged into Betaflight', detail: 'The driver our FCs need, upstream for everyone (betaflight#14882).', tag: 'fc', kind: 'upstream', url: 'https://github.com/betaflight/betaflight/pull/14882'},
  {date: '2026-05-25', title: 'FC build video published', detail: 'How flight controllers work (so I built my own).', tag: 'fc', kind: 'post', url: 'https://www.youtube.com/watch?v=XDYZoMRJFeQ'},
  {date: '2026-06-03', title: 'OpenFC Lite 30.5×30.5: first commit', tag: 'fc', kind: 'commit', url: 'https://github.com/incutec-hw/OpenFC-Lite/commits/main'},
  {date: '2026-06-05', title: 'ESC production exports for the validation run', detail: 'Rev2 20×20 and Rev1 30×30 sent out as a combined panel.', tag: 'esc', kind: 'order', url: 'https://github.com/incutec-hw/OpenESC_20X20'},
  {date: '2026-06-10', title: 'OpenRX fabrication set ordered', detail: 'All four receiver variants on one JLCPCB order.', tag: 'rx', kind: 'order', url: 'https://github.com/incutec-hw/OpenRX'},
  {date: '2026-06-14', title: 'Charger: first commit', detail: 'LiPo charger spec and part selection start in public.', tag: 'company', kind: 'commit', url: 'https://github.com/incutec-hw/Charger/commits/main'},
  {date: '2026-06-21', title: 'Site redesign deployed', detail: 'The current look of opendrone.be goes live.', tag: 'company', kind: 'launch', url: 'https://github.com/incutec-hw/OpenDrone-Web'},
  {date: '2026-06-29', title: 'Shared KiCad library: first commit', tag: 'company', kind: 'commit', url: 'https://github.com/incutec-hw/KiCad-Library/commits/main'},
  {date: '2026-07-05', title: 'OpenFrame: first commit', detail: '3" and 5" CNC carbon frames, CAD from Onshape.', tag: 'frame', kind: 'commit', url: 'https://github.com/incutec-hw/OpenFrame/commits/main'},
  {date: '2026-07-05', title: 'ESC bench validation opens', detail: 'Test records public in OpenDrone-Testing from day one.', tag: 'esc', kind: 'validation', url: 'https://github.com/incutec-hw/OpenDrone-Testing'},
  {date: '2026-07-06', title: 'OpenRX RF bring-up baselines recorded', detail: 'Mono and Gemini link budgets measured and logged.', tag: 'rx', kind: 'validation', url: 'https://github.com/incutec-hw/OpenDrone-Testing'},
  {date: '2026-07-18', title: 'OpenRX video and range test published', tag: 'rx', kind: 'post', url: 'https://www.youtube.com/watch?v=ssmQkRkXE84'},
  {date: '2026-07-25', title: 'External contributor proposes a full 20×20 rework', detail: 'Issue #8: exactly the kind of contribution the license invites.', tag: 'esc', kind: 'upstream', url: 'https://github.com/incutec-hw/OpenESC_20X20/issues/8'},
  {date: '2026-07-28', title: 'First CNC frame samples ordered', detail: '10× 3" and 10× 5" sample sets on their way.', tag: 'frame', kind: 'order', url: 'https://github.com/incutec-hw/OpenFrame'},
  {date: '2026-08-04', title: 'Shared library live across ten repos', detail: '105 symbols, 195 footprints, one pinned submodule.', tag: 'company', kind: 'launch', url: 'https://github.com/incutec-hw/KiCad-Library'},
  {date: '2026-08-04', title: 'OpenFrame v0.1 tagged, first CNC pack ordered', tag: 'frame', kind: 'launch', url: 'https://github.com/incutec-hw/OpenFrame/releases/tag/v0.1'},
  {date: '2026-08-04', title: 'Production batch 1 planned', detail: '200 boards across 8 SKUs for the first stocked run.', tag: 'company', kind: 'order', url: 'https://github.com/incutec-hw'},
  {date: '2026-08-05', title: 'Hardware validated', detail: 'Both ESCs, the FC Mini and all four OpenRX variants pass bench validation.', tag: 'company', kind: 'validation', url: 'https://github.com/incutec-hw/OpenDrone-Testing'},
  {date: '2026-08-05', title: 'Eight boards OSHWA-certified', detail: 'BE000026 through BE000033, both FCs, both ESCs, all four receivers.', tag: 'company', kind: 'cert', url: 'https://certification.oshwa.org/list.html'},
  {date: '2026-08-06', title: 'Release tags cut on the validated boards', detail: 'rev2 on OpenESC 20×20 and both FCs, rev1 on OpenESC 30×30.', tag: 'company', kind: 'launch', url: 'https://github.com/incutec-hw'},
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
    <div className="editorial-page timeline-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Timeline · receipts linked</p>
        <h1 className="editorial-title">
          Dated, <em>like everything else in the repo.</em>
        </h1>
        <p className="editorial-lead">
          The project&apos;s history as a trace: first commits, fab orders,
          bench validations, certifications, upstream merges. Every entry
          links to something you can check.
        </p>
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
              {f.label}
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
                <li key={`${e.date}-${e.title}`} className="tl-event">
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
                          {e.title} ↗
                        </a>
                      ) : (
                        e.title
                      )}
                    </h3>
                    {e.detail ? <p className="tl-detail">{e.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="tl-empty">Nothing under this filter yet.</p>
        ) : null}
      </div>
    </div>
  );
}
