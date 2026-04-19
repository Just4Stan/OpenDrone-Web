import type {Route} from './+types/open-source';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Open source · How OpenDrone makes money',
    description:
      'Why every OpenDrone board is fully open source — and how we pay the bills without closing the hardware.',
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
          Every OpenDrone board ships with the schematic, PCB, BOM and 3D STEP on
          GitHub under CERN-OHL-S v2. You can read them, fork them, order your own
          copies, ship a variant. That&apos;s not a marketing promise — it&apos;s the
          license. What you&apos;re paying for here is the production run.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · What you buy</h2>
        <p>
          A finished, tested, packaged board. Manufactured in the EU where we can,
          assembled at JLCPCB where we can&apos;t, inspected, flashed, and shipped
          from Belgium. The price covers the PCBs, the components, the assembly,
          the QC time, the packaging, the courier, the VAT, support, and —
          increasingly — the next revision&apos;s engineering time.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · What stays open</h2>
        <ul className="editorial-list">
          <li>
            <strong>Schematics</strong> — KiCad 9 project files, not just
            PDF exports. Every net and value is rebuildable from source.
          </li>
          <li>
            <strong>PCB layout</strong> — the same Gerbers and CPL files
            we ship to the fab. Not a &ldquo;reference&rdquo; — the actual
            production artefacts.
          </li>
          <li>
            <strong>BOM</strong> — distributor part numbers (LCSC, Mouser,
            Digi-Key where relevant), not just generic MPNs.
          </li>
          <li>
            <strong>3D STEP</strong> — so you can check clearance against
            your frame before you buy.
          </li>
          <li>
            <strong>Fab notes</strong> — stackup, impedance targets,
            assembly quirks, any hack that made rev-N work.
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · Why CERN-OHL-S and not MIT</h2>
        <p>
          CERN-OHL-S-2.0 is a reciprocal (&ldquo;copyleft&rdquo;) open hardware
          licence. It keeps the design open: if you modify an OpenDrone board,
          ship your own version, and someone asks for your sources, you hand them
          over on the same terms. The goal isn&apos;t to stop clones — we can&apos;t,
          and wouldn&apos;t want to. The goal is to make sure every clone carries
          its sources forward to the next maker.
        </p>
        <p>
          Firmware is usually GPL or MIT depending on the upstream project we
          build on (Betaflight, AM32, ExpressLRS). We don&apos;t relicense any of
          them.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">04 · How the business stays solvent</h2>
        <p>
          Four sources in rough order of size: retail margin on the boards we
          make, volume orders from schools and teams, paid consulting on custom
          variants, and the firmware split — €1 per unit forwarded to the
          upstream firmware project the board runs. That last line exists because
          we build on decades of other people&apos;s open source; paying a little
          of it back is the cheap, honest thing to do.
        </p>
        <p>
          We do <em>not</em> make money from: ads, affiliate trackers, reselling
          analytics data, bundled apps, or SKU-locking features behind firmware
          keys. The site runs cookieless (Plausible) and the product works without
          the web store existing.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">05 · What this means for you</h2>
        <ul className="editorial-list">
          <li>
            If OpenDrone vanishes tomorrow, you still have the files. Someone
            else — including you — can order a rev and keep it alive.
          </li>
          <li>
            If you want a 4&quot; version, a 3S-only version, a heavier-copper
            variant: fork, change, fab. If it&apos;s good, open a PR upstream.
          </li>
          <li>
            If you&apos;re a teacher or a club, we&apos;d rather you copy the
            design than buy a cheap closed alternative.
          </li>
        </ul>
      </section>

      <section className="editorial-cta">
        <Link to="/firmware-partners" className="editorial-cta-primary">
          See who the €1 goes to →
        </Link>
        <a
          href="https://github.com/Just4Stan"
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
