import type {Route} from './+types/open-source';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {DISCORD_INVITE_URL} from '~/lib/company';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Open source · OpenDrone and Incutec',
    description:
      'OpenDrone is a community project, Incutec is a Belgian startup that started the initiative and hosts this website, sells the products here, and does what the community can\'t do on their own. Why everything is open source, and how the bills get paid.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

export default function OpenSourceRoute() {
  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Open source · CERN-OHL-S-2.0</p>
        <h1 className="editorial-title">
          We sell hardware. The designs are yours.
        </h1>
        <p className="editorial-lead">
          Every OpenDrone board ships with its full source on GitHub: schematic,
          PCB, BOM and 3D STEP, under CERN-OHL-S v2. Read them, fork them, order
          your own copies, ship a variant. That isn&apos;t a marketing promise,
          it&apos;s the licence. OpenDrone is a community project; Incutec is
          the Belgian startup that started the initiative, hosts this website,
          sells the products here, and does what the community can&apos;t do on
          their own. What you pay for is the production run, done properly.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Two jobs, two sets of hands</h2>
        <p>
          OpenDrone was started by people from Incutec, but it is not ours. The
          designs are developed in the open and the direction belongs to the
          people who fly them. The community designs, reviews, tests and
          decides. Incutec does what a community cannot do alone: production,
          quality control, certification, distribution, warranty and legal
          responsibility for what is sold. When you buy a board on this
          website, Incutec BV is the seller, and the warranty and support are
          our job. That does not change because the design is open.
        </p>
        <p>
          Today Incutec still draws most of the hardware, because the first
          boards had to exist before anything else could. The intent is to move
          from designer to maintainer as contributors arrive. There is no date
          on that handover; it depends on who shows up. Anybody can help:{' '}
          <Link prefetch="viewport" to="/roadmap">
            here is how
          </Link>
          , and the conversation runs on{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
            Discord
          </a>
          .
        </p>
        <p>
          Incutec itself is a young hardware company from Leuven, Belgium.
          Think of it as a record label for hardware: a maker brings a working
          design with real demand, and we handle certification, manufacturing,
          sales and support, publish everything, and share the revenue. That
          infrastructure is built once and reused, so good hardware that would
          otherwise die between prototype and shop actually ships. OpenDrone is
          the first release.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · What you buy</h2>
        <p>
          A finished, tested, packaged board, sold by Incutec. Fabricated and
          assembled at JLCPCB today, then inspected, flashed, and shipped from
          Belgium; EU assembly is an ambition we cost openly on the{' '}
          <Link to="/production">production page</Link>. The price covers the PCB, the components, the assembly,
          the QC time, the packaging, the courier, VAT, support, and the
          engineering for the next revision. Nothing hidden in it.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · What stays open</h2>
        <ul className="editorial-list">
          <li>
            <strong>Schematic</strong>: the KiCad 10 project files, not just a
            PDF export. Every net and value is rebuildable from source.
          </li>
          <li>
            <strong>PCB layout</strong>: the same Gerbers and CPL we send to the
            fab. Not a &ldquo;reference&rdquo;, the actual production files.
          </li>
          <li>
            <strong>BOM</strong>: the same CSV the assembler gets, with real
            orderable LCSC part numbers, not generic MPNs you still have to
            chase down.
          </li>
          <li>
            <strong>3D STEP</strong>: check clearance against your frame before
            you buy.
          </li>
          <li>
            <strong>Fab notes</strong>: the fab-ready export settings and the
            revision notes that explain what changed and why, spin after spin.
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">04 · Why CERN-OHL-S and not MIT</h2>
        <p>
          CERN-OHL-S v2 is a reciprocal, copyleft open-hardware licence. It keeps
          the design open: modify an OpenDrone board, ship your own version, and
          if someone asks for your sources, you hand them over on the same terms.
          The point isn&apos;t to stop clones. We can&apos;t, and we wouldn&apos;t
          want to. The point is that every clone carries its sources forward to
          the next maker.
        </p>
        <p>
          Firmware stays under whatever its upstream uses. Betaflight, AM32 and
          ExpressLRS are all GPL-3.0. We don&apos;t relicense anyone&apos;s
          work.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">05 · How Incutec stays solvent</h2>
        <p>
          The community project needs no revenue; the company manufacturing and
          supporting the boards does. Four revenue lines, roughly in order of
          expected size: retail margin on the boards, volume orders from schools
          and teams, paid consulting on custom variants, and a firmware split of
          €1 of every board sold forwarded to the upstream project the board
          runs. That last line exists because all of this is built on decades of
          other people&apos;s open source. Paying a little of it back is the
          cheap, honest thing to do.
        </p>
        <p>
          We don&apos;t make money from ads, affiliate trackers, resold
          analytics, bundled apps, or features locked behind firmware keys. Our
          analytics are cookieless (Plausible), and the product works whether or
          not this web store exists.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">06 · What this means for you</h2>
        <ul className="editorial-list">
          <li>
            If Incutec disappears tomorrow, you still have the files, and the
            community still owns the project. Anyone, including you, can order a
            revision and keep it alive.
          </li>
          <li>
            Want a 4&quot; version, a 3S-only build, a heavier-copper variant?
            Fork it, change it, fab it. If it&apos;s good, open a PR upstream.
          </li>
          <li>
            Teacher or club? We would rather you copy the design than buy a cheap
            closed alternative.
          </li>
        </ul>
      </section>

      <section className="editorial-cta">
        <Link prefetch="viewport" to="/roadmap" className="editorial-cta-primary">
          Help design the hardware →
        </Link>
        <a
          href="https://github.com/incutec-hw"
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-secondary"
        >
          Browse the repos on GitHub ↗
        </a>
      </section>
    </div>
  );
}
