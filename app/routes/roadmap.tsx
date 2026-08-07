import type {Route} from './+types/roadmap';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {DISCORD_INVITE_URL} from '~/lib/company';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Roadmap · What we build and how to help',
    description:
      'Every OpenDrone project with its current status: what is nearly in the shop, what is in development, and the pre-design ideas anyone can help shape on Discord and GitHub.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

type RoadmapStatus = 'coming-soon' | 'in-development' | 'pre-design' | 'idea';

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
 * repo, a product page on this site, or nothing. Nothing gets a date.
 * To add a future-project idea, append an entry with status 'idea':
 * a name and one honest line is enough.
 * Verified against github.com/incutec-hw on 2026-08-08.
 */
const ROADMAP: RoadmapItem[] = [
  {
    item: 'OpenFC Lite · 30×30',
    status: 'coming-soon',
    note: 'Betaflight flight controller, RP2354, 30.5×30.5 mounting. Rev 2 bench-validated; first production batch in preparation.',
    link: 'https://github.com/incutec-hw/OpenFC-Lite',
  },
  {
    item: 'OpenFC Lite Mini · 20×20',
    status: 'coming-soon',
    note: 'The 20×20 version of the same RP2354 flight controller. Bench-validated; first production batch in preparation.',
    link: 'https://github.com/incutec-hw/OpenFC-Lite-Mini',
  },
  {
    item: 'OpenESC · 20×20',
    status: 'coming-soon',
    note: '4-in-1 AM32 ESC, 30 A/channel. Bench validation passed; characterization data to be published.',
    link: 'https://github.com/incutec-hw/OpenESC-20x20',
  },
  {
    item: 'OpenESC · 30×30',
    status: 'coming-soon',
    note: '4-in-1 AM32 ESC, 50 A/channel. Bench validation passed; characterization data to be published.',
    link: 'https://github.com/incutec-hw/OpenESC-30x30',
  },
  {
    item: 'OpenRX · Lite / Lite-UFL / Mono / Gemini',
    status: 'coming-soon',
    note: 'ExpressLRS receiver family: SX1281 2.4 GHz and single/dual LR1121 multi-band. All four variants bench-validated.',
    link: 'https://github.com/incutec-hw/OpenRX',
  },
  {
    item: 'OpenFrame · 5" + 3"',
    status: 'in-development',
    note: 'CNC carbon freestyle frames. First sample sets ordered; CAD lives in Onshape, public link pending.',
  },
  {
    item: 'OpenVTX',
    status: 'pre-design',
    note: 'Video transmitter. The repo is public; specs and architecture are open for discussion.',
    link: 'https://github.com/incutec-hw/OpenVTX',
  },
  {
    item: 'OpenRemoteID',
    status: 'pre-design',
    note: 'Remote ID module. The repo is public; requirements are still being worked out.',
    link: 'https://github.com/incutec-hw/OpenRemoteID',
  },
  {
    item: 'OpenAIO + OpenAIO-Whoop',
    status: 'pre-design',
    note: 'All-in-one boards, full-size and whoop. Early designs are public; specs are still being argued, no prototype ordered yet.',
    link: 'https://github.com/incutec-hw/OpenAIO',
  },
  {
    item: 'Charger',
    status: 'pre-design',
    note: 'LiPo charger. Early design is public; no prototype ordered yet.',
    link: 'https://github.com/incutec-hw/Charger',
  },
  {
    item: 'Motors',
    status: 'idea',
    note: 'Named on the long list. Nothing public yet.',
  },
];

const STATUS_META: Record<RoadmapStatus, {label: string; blurb: string}> = {
  'coming-soon': {
    label: 'Coming soon',
    blurb:
      'Bench-validated designs with first production batches in preparation. These arrive in the shop next; the remaining work is manufacturing, not design.',
  },
  'in-development': {
    label: 'In development',
    blurb:
      'Hardware is ordered or being iterated. The design is public where it can be, and still moving.',
  },
  'pre-design': {
    label: 'Pre-design',
    blurb:
      'Boards we want to make and want help making. The work right now is reading the market, agreeing on specs, and discussing what we can actually produce. That conversation runs on Discord, and anyone can join it.',
  },
  idea: {
    label: 'Idea',
    blurb: 'Named, nothing more. If one of these is your itch, say so.',
  },
};

const STATUS_ORDER: RoadmapStatus[] = [
  'coming-soon',
  'in-development',
  'pre-design',
  'idea',
];

export default function RoadmapRoute() {
  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: ROADMAP.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  // Section 01 is "How this works"; the status groups take 02..(n+1);
  // the contribution sections continue the numbering after that.
  const sec = (i: number) => String(i).padStart(2, '0');
  const afterGroups = groups.length + 2;

  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Roadmap · Contribute</p>
        <h1 className="editorial-title">
          What we&apos;re building, <em>and how you can help.</em>
        </h1>
        <p className="editorial-lead">
          OpenDrone is a community project: every board is designed in public
          from the first commit, and this page lists all of them with an honest
          status. No dates: we&apos;d only be guessing. The list is not closed
          either. Anyone can propose a board, and the FC connector on every
          OpenESC exists because someone sent a PR.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · How this works</h2>
        <p>
          Everything starts as a conversation on{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
            the OpenDrone Discord
          </a>
          : what the market needs, which specs make sense, what can
          realistically be produced. Agreeing before anyone draws is the point.
          It stops two people building the same thing, and it kills bad ideas
          before someone spends weeks on a layout. Once a plan settles, the
          design work moves to GitHub, which holds the record.
        </p>
        <p>
          Anyone can propose hardware, including boards that compete with what
          is already in the shop. A proposal names an owner who carries the
          design through review and measurement, and decisions are argued on
          published measurements, not preference. Products marked{' '}
          <strong>Concept</strong> in the shop are published before hardware
          exists, precisely so this discussion can happen in public.
        </p>
        <p>
          Incutec, the company behind this shop, supports the development
          rather than steering it: it buys the prototype samples, pays for test
          runs, and manufactures a design once it is verified. Contributors
          whose hardware is verified by the community receive manufactured
          samples of their own design.
        </p>
      </section>

      {groups.map((group, gi) => (
        <section className="editorial-section" key={group.status}>
          <h2 className="editorial-section-title">
            {sec(gi + 2)} · {STATUS_META[group.status].label}
          </h2>
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

      <section className="editorial-section">
        <h2 className="editorial-section-title">
          {sec(afterGroups)} · Report what broke
        </h2>
        <p>
          Flew it, bench-tested it, or just read the schematic and found
          something off: open an issue on the board&apos;s repo. A photo, a log
          file, or a net name is enough. Confirmed design problems get fixed in
          the next revision and credited on the product page, receipts linked.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">
          {sec(afterGroups + 1)} · Change the design
        </h2>
        <p>
          Hardware is not software: two people can edit the same code file, but
          a PCB layout cannot be merged. So each board has one maintainer who
          holds the layout, and edits are serialised through file locks.
          Schematics are split across hierarchical sheets, so separate sheets
          can have separate owners. Two people can hold two boards. Two people
          cannot hold one layout.
        </p>
        <p>
          Everyone else contributes through review, and review is where the
          real capacity is: CI renders the schematic, the board images, ERC and
          DRC output and a BOM diff on every pull request, so a design one
          person draws can be reviewed by anyone, without opening KiCad. Small,
          focused changes land fastest: one connector, one footprint, one
          silkscreen fix, agreed with the board&apos;s maintainer.
        </p>
        <p>
          Merged design changes show up in the &ldquo;You asked. We changed
          it.&rdquo; chapter of the product page, and your account lands in its
          contributor grid. Every product page names who developed the board,
          maintainer first, the way a record sleeve names the band. A handle
          and avatar are enough; nobody needs your real name.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">
          {sec(afterGroups + 2)} · Improve the firmware
        </h2>
        <p>
          The boards run community firmware: Betaflight, AM32 and ExpressLRS.
          Work there helps every board, not just ours; €1 of every board sold
          already goes to these projects. Start with the{' '}
          <Link to="/firmware-partners">firmware partners</Link> page if you
          want the details.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">
          {sec(afterGroups + 3)} · The repos
        </h2>
        <p>
          Every entry above links to its source where one is public. The
          hardware is KiCad, latest stable release, licensed CERN-OHL-S v2:
          strong reciprocal, share your changes. By opening a PR you license
          your contribution under the repo&apos;s license. No CLA, no
          paperwork.
        </p>
      </section>

      <section className="editorial-cta">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-primary"
        >
          Join the Discord ↗
        </a>
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
