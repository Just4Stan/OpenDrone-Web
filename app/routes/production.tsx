import type {Route} from './+types/production';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {ProductionLadder} from '~/components/ProductionLadder';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Production · Where the boards are made',
    description:
      'OpenDrone boards are designed in the open, fabricated and assembled in China, then inspected, flashed and shipped by Incutec from Belgium. The EU-assembly path is next.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

export default function ProductionRoute() {
  return (
    <EditorialShell slug="production" aside={<ProductionLadder />}>
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Production</p>
        <h1 className="editorial-title">
          Made where we say it&apos;s made.
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
          <Link prefetch="viewport" to="/roadmap">
            anyone who shows up
          </Link>
          .
        </p>
        <p>
          What goes to the factory and what you can download are the same files.{' '}
          <Link prefetch="viewport" to="/open-source">
            The open source page
          </Link>{' '}
          covers what is published and under which licence.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · Built in China today</h2>
        <p>
          Fabrication and assembly currently happen in China, at a fab anyone
          can send the public Gerbers and BOM to. The BOM is written around
          parts you can actually order, so a self-build is a real option, not a
          theoretical one.
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
        <h2 className="editorial-section-title">03 · What we want to make ourselves</h2>
        <p>
          We want more of this made in-house, and closer to home. The obstacle
          is not ambition, it is capital: every step on the ladder is
          equipment, floor space and people. So the plan is to buy it with
          what the boards earn, one capability at a time, cheapest and most
          useful first.
        </p>
        <p>
          PCB assembly is the first rung because it is genuinely approachable
          at our scale and pays for itself fastest. It also buys freedom the
          spreadsheet does not show: we choose the parts instead of designing
          around what a fab stocks, and a revision takes days instead of a
          shipping cycle.
        </p>
        <p>
          After that it gets harder and more expensive. Routing carbon is
          mostly a filtration and enclosure problem. Aluminium means a 5-axis
          machine and a chemical line to finish what comes off it. Motors are
          the deep end: stamping and stacking steel laminations, coating and
          winding them, bonding magnets into a flux ring, machining bells and
          bases, balancing the rotors. None of that is exotic, all of it is a
          factory.
        </p>
        <p>
          This is also why the community half of the project matters. Every
          design a maintainer takes on is engineering time we can spend on
          manufacturing instead of on the next schematic. We would rather be
          the people who build it well than the only people allowed to draw
          it.
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
    </EditorialShell>
  );
}
