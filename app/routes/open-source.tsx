import type {Route} from './+types/open-source';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Open source · How OpenDrone makes money',
    description:
      'Why every OpenDrone board is fully open source, and how we pay the bills without closing the hardware.',
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
          We sell hardware. <em>The designs are yours.</em>
        </h1>
        <p className="editorial-lead">
          Every OpenDrone board ships with its full source on GitHub: schematic,
          PCB, BOM and 3D STEP, under CERN-OHL-S v2. Read them, fork them, order
          your own copies, ship a variant. That isn&apos;t a marketing promise,
          it&apos;s the licence. What you pay for here is the production run, done
          properly.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · What you buy</h2>
        <p>
          A finished, tested, packaged board. Built in the EU where we can,
          produced in Asia where we can&apos;t, inspected, flashed, and shipped
          from Belgium. The price covers the PCB, the components, the assembly,
          the QC time, the packaging, the courier, VAT, support, and the
          engineering for the next revision. Nothing hidden in it.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · What stays open</h2>
        <ul className="editorial-list">
          <li>
            <strong>Schematic</strong>: the KiCad 9 project files, not just a
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
        <h2 className="editorial-section-title">03 · Why CERN-OHL-S and not MIT</h2>
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
        <h2 className="editorial-section-title">04 · How the business stays solvent</h2>
        <p>
          Four revenue lines, roughly in order of expected size: retail margin on
          the boards we make, volume orders from schools and teams, paid
          consulting on custom variants, and a firmware split of €1 per unit
          forwarded to the upstream project the board runs. That last line exists
          because we build on decades of other people&apos;s open source. Paying a
          little of it back is the cheap, honest thing to do.
        </p>
        <p>
          We don&apos;t make money from ads, affiliate trackers, resold
          analytics, bundled apps, or features locked behind firmware keys. Our
          analytics are cookieless (Plausible), and the product works whether or
          not this web store exists.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">05 · What this means for you</h2>
        <ul className="editorial-list">
          <li>
            If OpenDrone disappears tomorrow, you still have the files. Anyone,
            including you, can order a revision and keep it alive.
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
        <Link prefetch="viewport" to="/firmware-partners" className="editorial-cta-primary">
          See who the €1 goes to →
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
