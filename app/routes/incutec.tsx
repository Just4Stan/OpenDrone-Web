import type {Route} from './+types/incutec';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Incutec · The company behind OpenDrone',
    description:
      'Incutec is the Belgian hardware company behind OpenDrone — open-source flight controllers, ESCs, receivers and frames. A short note on who we are and how we work.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

export default function IncutecRoute() {
  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">The company</p>
        <h1 className="editorial-title">
          Incutec builds open hardware.{' '}
          <em>OpenDrone is our first line.</em>
        </h1>
        <p className="editorial-lead">
          Incutec is a hardware company in Belgium. We design open electronics,
          publish the source, and sell the boards that come out of it. OpenDrone
          is our first line. More will follow under the same model.
        </p>
      </header>

      <section className="editorial-section">
        <p>
          Most consumer tech is a black box: sealed, glued, impossible to
          understand by design, so you stay dependent on whoever made it. We
          build the opposite — hardware that works as a real product and opens
          itself up, so you can repair it, re-flash it, fork it, or manufacture
          it yourself.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · What we do</h2>
        <p>
          We make electronics people can actually own. Every product ships with
          its schematics, board files and firmware targets, not locked in a
          vendor silo. The aim is hardware you understand, sold by a company that
          stands behind it.
        </p>
        <p>
          OpenDrone is where it starts: flight controllers, ESCs, receivers and
          frames, plus the firmware partnerships that make them fly. FPV is full
          of builders who can solder but were never shown how their own gear
          works. OpenDrone changes that. The catalogue is small on purpose while
          we get the fundamentals right, and each new product is meant to reach
          one step closer to the everyday user.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · How we work</h2>
        <p>
          Think of it as a record label for hardware. A maker brings a working
          design with real demand; we handle certification, manufacturing, sales
          and support, publish everything, and share the revenue. The pipeline is
          built once and reused for every release, so good hardware that would
          otherwise die between the prototype and the shop actually ships.
        </p>
        <p>
          Hardware is released under CERN-OHL-S, firmware under MIT or GPL,
          designed in KiCad and built with partners we name. We forward a share
          of every order to the open firmware projects we depend on, and we keep
          our legal and security pages honest rather than aspirational.
        </p>
        <p>
          We are a young European company built for where hardware is heading:
          tighter EU rules, shifting trade, and a rising appetite for tech made
          by someone you can name and that you are allowed to understand. This
          page is short on purpose. It grows as we do. For now, the work speaks
          through the boards and the repos.
        </p>
      </section>

      <section className="editorial-cta">
        <Link prefetch="viewport" to="/open-source" className="editorial-cta-primary">
          How we open-source everything →
        </Link>
        <Link prefetch="viewport" to="/collections/all" className="editorial-cta-secondary">
          Browse the boards →
        </Link>
      </section>
    </div>
  );
}
