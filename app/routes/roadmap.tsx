import type {Route} from './+types/roadmap';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Roadmap · What ships next',
    description:
      'The public OpenDrone product roadmap: what is in revision, what comes next, and what we are still exploring. Every line links to its source.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

type RoadmapStatus = 'shipped' | 'in-revision' | 'next' | 'exploring';

type RoadmapItem = {
  item: string;
  status: RoadmapStatus;
  /** One factual line. No dates, no promises — only what is verifiable
   *  in the public repos / on this site today. */
  note: string;
  /** Public source (GitHub repo or issue). Omit when nothing public exists. */
  link?: string;
};

/**
 * DATA RULE: every entry must be verifiable in public — an incutec-hw
 * repo, a product page on this site, or nothing. Nothing aspirational,
 * no dates, no unannounced SKUs. 'exploring' entries are designs that
 * have been named publicly but have no public files yet.
 * Verified against github.com/incutec-hw on 2026-07-06.
 */
const ROADMAP: RoadmapItem[] = [
  {
    item: 'OpenFC Lite · 20×20 + 30×30',
    status: 'in-revision',
    note: 'Betaflight flight controller, RP2354. Rev 2 design is on main; production bring-up in progress.',
    link: 'https://github.com/incutec-hw/OpenFC-Lite',
  },
  {
    item: 'OpenESC · 20×20',
    status: 'in-revision',
    note: '4-in-1 AM32 ESC, 30 A/channel preliminary: bench characterization pending.',
    link: 'https://github.com/incutec-hw/OpenESC_20X20',
  },
  {
    item: 'OpenESC · 30×30',
    status: 'in-revision',
    note: '4-in-1 AM32 ESC, 50 A/channel preliminary: bench characterization pending.',
    link: 'https://github.com/incutec-hw/OpenESC-30x30',
  },
  {
    item: 'OpenRX · Lite / Lite-UFL / Mono / Gemini',
    status: 'in-revision',
    note: 'ExpressLRS receiver family: SX1281 2.4 GHz and single/dual LR1121 multi-band.',
    link: 'https://github.com/incutec-hw/OpenRX',
  },
  {
    item: 'OpenFrame · 5" + 3"',
    status: 'in-revision',
    note: 'CNC carbon freestyle frames. CAD lives in OnShape; public link pending.',
  },
  {
    item: 'OpenVTX',
    status: 'next',
    note: 'Video transmitter. Repo is public; not yet in the shop.',
    link: 'https://github.com/incutec-hw/OpenVTX',
  },
  {
    item: 'OpenRemoteID',
    status: 'next',
    note: 'Remote ID module. Repo is public; not yet in the shop.',
    link: 'https://github.com/incutec-hw/OpenRemoteID',
  },
  {
    item: 'OpenAIO + OpenAIO-Whoop',
    status: 'exploring',
    note: 'All-in-one boards. Designs not public yet.',
  },
  {
    item: 'Charger',
    status: 'exploring',
    note: 'LiPo charger. Design not public yet.',
  },
  {
    item: 'Motors',
    status: 'exploring',
    note: 'Named on the long list. Nothing public yet.',
  },
];

const STATUS_META: Record<RoadmapStatus, {label: string; blurb: string}> = {
  shipped: {
    label: 'Shipped',
    blurb: 'In the shop, in stock, done arguing with it.',
  },
  'in-revision': {
    label: 'In revision',
    blurb:
      'Design is public and boards exist; we are still spinning revisions before general availability.',
  },
  next: {
    label: 'Up next',
    blurb: 'Public files exist, but it is not a product in the shop yet.',
  },
  exploring: {
    label: 'Exploring',
    blurb: 'Publicly named, nothing published. May change or die quietly.',
  },
};

const STATUS_ORDER: RoadmapStatus[] = [
  'shipped',
  'in-revision',
  'next',
  'exploring',
];

export default function RoadmapRoute() {
  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: ROADMAP.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Roadmap · public</p>
        {/* TODO(copy-stan): placeholder hero copy — rewrite in your voice. */}
        <h1 className="editorial-title">
          What we&apos;re building, <em>in the open.</em>
        </h1>
        <p className="editorial-lead">
          Same rule as the hardware: if it&apos;s not public, it&apos;s not on
          this page. Every line below is backed by a public repo, a product
          page, or it says so. No dates: we&apos;d only be guessing.
        </p>
      </header>

      {groups.map((group, gi) => (
        <section className="editorial-section" key={group.status}>
          <h2 className="editorial-section-title">
            {String(gi + 1).padStart(2, '0')} ·{' '}
            {STATUS_META[group.status].label}
          </h2>
          {/* TODO(copy-stan): placeholder status blurbs (STATUS_META). */}
          <p>{STATUS_META[group.status].blurb}</p>
          <ul className="roadmap-list">
            {group.items.map((r) => (
              <li className="roadmap-item" key={r.item}>
                <div className="roadmap-item-head">
                  <span className="roadmap-name">{r.item}</span>
                  <span className="roadmap-status" data-status={r.status}>
                    {STATUS_META[r.status].label}
                  </span>
                </div>
                <p className="roadmap-note">{r.note}</p>
                {r.link ? (
                  <a
                    className="roadmap-link"
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="editorial-cta">
        <Link
          prefetch="viewport"
          to="/collections/all"
          className="editorial-cta-primary"
        >
          Browse what exists today →
        </Link>
        <a
          href="https://github.com/incutec-hw"
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-secondary"
        >
          Watch the repos on GitHub ↗
        </a>
      </section>
    </div>
  );
}
