import type {Route} from './+types/incutec';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Incutec · The company behind OpenDrone',
    description:
      'Incutec is the Belgian hardware company behind OpenDrone — open-source flight controllers, ESCs and frames. A short note on who we are and what we build.',
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
          <em>OpenDrone is the first thing we shipped.</em>
        </h1>
        <p className="editorial-lead">
          Incutec is a small hardware company in Belgium. We design flight
          controllers, ESCs and frames, release the source, and sell the boards
          that come out the other side. OpenDrone is our drone-electronics brand;
          more lines will follow under the same principle.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · What we do</h2>
        <p>
          We make electronics that people can actually own — schematics,
          board files and firmware targets published alongside the product, not
          locked in a vendor silo. The goal is hardware you can repair, re-flash,
          fork or manufacture yourself, sold by a company that stands behind it.
        </p>
        <p>
          OpenDrone is where that starts: a flight controller, an ESC, a frame,
          and the firmware partnerships that make them fly. The catalogue is
          small on purpose while we get the fundamentals right.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · How we work</h2>
        <p>
          Hardware under CERN-OHL-S, firmware under MIT or GPL, designed in
          KiCad and built with partners we name. We forward a slice of every
          order upstream to the firmware projects we depend on, and we keep our
          legal and security pages honest rather than aspirational.
        </p>
        <p>
          This page is intentionally brief — it&apos;ll grow as the company
          does. For now, the work speaks through the boards and the repos.
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
