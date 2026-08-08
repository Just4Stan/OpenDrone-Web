import type {Route} from './+types/roadmap';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
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

/**
 * Product status index. One vocabulary, used in three places that must
 * agree: this board, the product pages, and (as `status-<label>` topics)
 * the GitHub repos. Change a status here and mirror it in the other two.
 */
type ProductStatus = 'launched' | 'beta' | 'alpha' | 'in-progress' | 'planned';

type RoadmapItem = {
  item: string;
  status: ProductStatus;
  /** One factual line, short enough for a board card. */
  note: string;
  /** Product page on this site, when one exists. */
  productPath?: string;
  /** Public design source. Omit when nothing public exists. */
  link?: string;
};

/**
 * DATA RULE: every entry must be verifiable in public, or be an explicit
 * statement of intent (planned). Nothing gets a date.
 */
const ROADMAP: RoadmapItem[] = [
  {
    item: 'OpenFC Lite · 30×30',
    status: 'beta',
    note: 'RP2354 Betaflight flight controller. First production batch in preparation.',
    productPath: '/products/openfc-lite',
    link: 'https://github.com/incutec-hw/OpenFC-Lite',
  },
  {
    item: 'OpenFC Lite Mini · 20×20',
    status: 'beta',
    note: 'The same flight controller at 20×20.',
    productPath: '/products/openfc-lite',
    link: 'https://github.com/incutec-hw/OpenFC-Lite-Mini',
  },
  {
    item: 'OpenESC · 20×20',
    status: 'beta',
    note: '4-in-1 AM32 ESC, 30 A per channel.',
    productPath: '/products/openesc',
    link: 'https://github.com/incutec-hw/OpenESC-20x20',
  },
  {
    item: 'OpenESC · 30×30',
    status: 'beta',
    note: '4-in-1 AM32 ESC, 50 A per channel.',
    productPath: '/products/openesc',
    link: 'https://github.com/incutec-hw/OpenESC-30x30',
  },
  {
    item: 'OpenRX',
    status: 'alpha',
    note: 'ExpressLRS receiver family, four variants, in community testing.',
    productPath: '/products/openrx',
    link: 'https://github.com/incutec-hw/OpenRX',
  },
  {
    item: 'OpenFrame · 5" + 3"',
    status: 'in-progress',
    note: 'CNC carbon freestyle frames. First sample sets ordered.',
    productPath: '/products/openframe',
  },
  {
    item: 'Motors',
    status: 'in-progress',
    note: 'Early design work. Nothing public yet.',
  },
  {
    item: 'OpenVTX',
    status: 'planned',
    note: 'Video transmitter. Specs and architecture open for discussion.',
    link: 'https://github.com/incutec-hw/OpenVTX',
  },
  {
    item: 'OpenRemoteID',
    status: 'planned',
    note: 'Remote ID module. Requirements still being worked out.',
    link: 'https://github.com/incutec-hw/OpenRemoteID',
  },
  {
    item: 'OpenAIO + OpenAIO-Whoop',
    status: 'planned',
    note: 'All-in-one boards, full-size and whoop.',
    link: 'https://github.com/incutec-hw/OpenAIO',
  },
  {
    item: 'Charger',
    status: 'planned',
    note: 'LiPo charger.',
    link: 'https://github.com/incutec-hw/Charger',
  },
];

const STATUS_META: Record<ProductStatus, {label: string; legend: string}> = {
  launched: {
    label: 'Launched',
    legend:
      'In the shop and settled. The design has stopped moving; buy it and it will not change under you.',
  },
  beta: {
    label: 'Beta',
    legend:
      'Launched, first production batch. You can buy it in the shop, early-batch pricing can be lower, and the design can still get updates between batches.',
  },
  alpha: {
    label: 'Alpha',
    legend:
      'Coming soon. Hardware is being tested beyond our own bench, by firmware maintainers and community testers, but is not buyable yet. Where a product page exists, you can join the waitlist there.',
  },
  'in-progress': {
    label: 'In progress',
    legend:
      'A first design exists and prototypes may already be ordered, but nothing is under test yet.',
  },
  planned: {
    label: 'Planned',
    legend:
      'No design yet, on purpose. We name it early so the community can shape the spec from day one: the discussion runs on Discord, and design proposals are welcome. No product listing until there is hardware.',
  },
};

const STATUS_ORDER: ProductStatus[] = [
  'launched',
  'beta',
  'alpha',
  'in-progress',
  'planned',
];

export default function RoadmapRoute() {
  const columns = STATUS_ORDER.map((status) => ({
    status,
    items: ROADMAP.filter((r) => r.status === status),
  }));

  return (
    <EditorialShell slug="roadmap">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Roadmap and Contributing</p>
        <h1 className="editorial-title">
          What we&apos;re building, and how you can help.
        </h1>
        <p className="editorial-lead">
          OpenDrone is a community project, but that doesn&apos;t mean
          compromise. The end goal is to cover each corner of the FPV hardware
          spectrum. The way we get there is by first laying out foundational
          hardware and then building on top of that. We think foundational
          hardware means all the parts to build a 5 inch or 3 inch freestyle
          drone, so that roughly translates to: stack (FC + ESC), receiver,
          frame, motors and video system. You&apos;ll find the status of those
          products below. The ecosystem around the drone is the next part:
          chargers, accessories, propellers, batteries, consumables, buzzers,
          GPS. After that, expanding into different size classes like whoops
          and toothpicks with AIOs, or bigger cinelifters. Step by step, we
          hope to provide everything you need to build and fly your drone.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · How this works</h2>
        <p>
          Everything starts as a conversation on{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
            the OpenDrone Discord
          </a>
          : what the market needs, which specs make sense, what can realistically be produced. Agreeing before anyone draws is the point. It stops two people building the same thing, and it kills bad ideas before someone spends weeks on a layout.
        </p>
        <p>
          Anyone can propose future hardware. A proposal names an owner who carries the design through review and measurement, and decisions are argued on published measurements, not preference. Products marked{' '}
          <strong>Concept</strong> in the shop are published before hardware exists, precisely so this discussion can happen in public, on Discord.
        </p>
        <p>
          Incutec, the company behind this shop, supports and steers the development. Contributors whose hardware is verified by the community receive manufactured samples of their own design. Once hardware is verified we can move to small test runs and integrate it in the rest of the OpenDrone ecosystem.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · Where every product stands</h2>
        <p>
          The same board we work from. Each product carries one status label,
          explained below; the label is mirrored on its product page and on
          its GitHub repo.
        </p>
        <div className="kanban">
          {columns.map((col) => (
            <div className="kanban-col" key={col.status}>
              <p className="kanban-col-head" data-status={col.status}>
                <span className="kanban-dot" />
                {STATUS_META[col.status].label}
                <span className="kanban-count">{col.items.length}</span>
              </p>
              {col.items.length === 0 ? (
                <p className="kanban-empty">none yet</p>
              ) : (
                col.items.map((r) => (
                  <article className="kanban-card" key={r.item}>
                    <h3 className="kanban-name">{r.item}</h3>
                    <p className="kanban-note">{r.note}</p>
                    {r.productPath || r.link ? (
                      <p className="kanban-links">
                        {r.productPath ? (
                          <Link prefetch="viewport" to={r.productPath}>
                            Product →
                          </Link>
                        ) : null}
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noopener noreferrer">
                            Source ↗
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · What the labels mean</h2>
        <dl className="status-legend">
          {STATUS_ORDER.map((status) => (
            <div key={status}>
              <dt data-status={status}>
                <span className="kanban-dot" />
                {STATUS_META[status].label}
              </dt>
              <dd>{STATUS_META[status].legend}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">
          04 · Report what broke
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
          05 · Change the design
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
          06 · Improve the firmware
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
          07 · The repos
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
    </EditorialShell>
  );
}
