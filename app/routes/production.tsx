import type {Route} from './+types/production';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Production · Where the boards are made',
    description:
      'OpenDrone boards are designed in the open, fabricated and assembled at JLCPCB, then inspected, flashed and shipped by Incutec from Belgium. The EU-assembly path is next.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

export default function ProductionRoute() {
  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Production · no mystery meat</p>
        <h1 className="editorial-title">
          Designed in the open. <em>Made where we say it&apos;s made.</em>
        </h1>
        <p className="editorial-lead">
          Every board on this site tells you where it comes from, because the
          production files are public. This page is the same answer in prose:
          who designs it, who builds and sells it today, and what we want to
          change about that.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Designed in the open</h2>
        <p>
          OpenDrone is a community project: every board is designed in public,
          in KiCad, with one maintainer holding each layout. Most of the
          current boards were drawn by Incutec people in Leuven, because the
          first boards had to exist; some are already held by community
          maintainers, and the design work is open to{' '}
          <Link prefetch="viewport" to="/contribute">
            anyone who shows up
          </Link>
          .
        </p>
        <p>
          The full project (schematic, layout, BOM, 3D STEP) is public on
          GitHub under CERN-OHL-S v2 before you can buy the board, and every
          board is OSHWA self-certified (BE000026–BE000033). What goes to the
          factory and what you can download are the same files.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · Built at JLCPCB today</h2>
        <p>
          Fabrication and assembly currently happen at JLCPCB in China, the
          same fab anyone can send the public Gerbers and BOM to. The BOM is
          written around parts you can actually order, so a self-build is a
          real option, not a theoretical one.
        </p>
        <p>
          Manufacturing, quality control and sales are Incutec&apos;s side of
          the project: the things a community cannot do alone. Finished boards
          come back to Incutec in Belgium, where they are inspected, flashed
          and packed before shipping. Every board leaves with a build card
          naming its batch and the exact GitHub revision it was built from.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · The EU-assembly path</h2>
        <p>
          We want assembly closer to home. The honest obstacle is cost:
          EU assembly today adds real money per board, and pretending
          otherwise helps nobody. So the plan is a proof-of-concept run:
          assemble a batch in the EU, publish what it actually cost, and let
          the numbers decide how fast we move.
        </p>
        <p>
          No timeline on this page, on purpose. When an EU-assembled batch
          exists, it will say so on the product page and here, with the cost
          breakdown, because that is the interesting part.
        </p>
      </section>

      <section className="editorial-cta">
        <Link
          prefetch="viewport"
          to="/open-source"
          className="editorial-cta-primary"
        >
          Why the files are public →
        </Link>
        <Link prefetch="viewport" to="/roadmap" className="editorial-cta-secondary">
          See the roadmap →
        </Link>
      </section>
    </div>
  );
}
