import type {Route} from './+types/incutec';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Incutec · The company behind OpenDrone',
    description:
      'Incutec is a Belgian hardware company. We design open electronics in Leuven, publish the source, and sell the boards. OpenDrone is our first line.',
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
          We design hardware, publish it for you to see and produce it for you
          to use. OpenDrone is our first line. More will follow under the same
          model.
        </p>
      </header>

      <section className="editorial-section">
        <p>
          Most consumer tech is a sealed box. You are not supposed to know what
          is inside, and that keeps you dependent on whoever made it. We build
          the opposite: hardware that works as a real product and is published
          down to the last resistor, so you can repair it, re-flash it, fork
          it, or build it yourself.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · What we do</h2>
        <p>
          We make electronics you actually own. Every product ships with its
          schematics, board files and firmware targets. Nothing sits in a
          vendor silo. You get hardware you can understand, from a company that
          stands behind it.
        </p>
        <p>
          OpenDrone is where we start: flight controllers, ESCs, receivers and
          frames, plus the firmware partnerships that make them fly. FPV is
          full of people who can solder but were never shown how their gear
          actually works. We want to change that. The catalogue is small on
          purpose while we get the fundamentals right.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · How we work</h2>
        <p>
          Think of it as a record label for hardware. A maker brings a working
          design with real demand. We handle certification, manufacturing,
          sales and support, publish everything, and share the revenue. The
          pipeline is built once and reused for every release, so good hardware
          that would otherwise die between prototype and shop actually ships.
        </p>
        <p>
          Hardware is released under CERN-OHL-S, firmware under MIT or GPL,
          designed in KiCad, built with partners we name. Part of every order
          goes to the open firmware projects we depend on. Our legal and
          security pages say what we do, not what we hope to do.
        </p>
        <p>
          We are a young company from Leuven, Belgium, built for where European
          hardware is heading: CE marking done properly, EU consumer rules
          taken seriously, and products made by people you can name and email.
          This page is short on purpose. It grows as we do.
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
