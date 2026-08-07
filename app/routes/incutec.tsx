import type {Route} from './+types/incutec';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {DISCORD_INVITE_URL} from '~/lib/company';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Incutec · The company behind this website',
    description:
      'OpenDrone is a community project. Incutec is the Belgian company that manufactures the boards, sells them on this website, and carries the warranty. Anybody can help design.',
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
          OpenDrone is a community project.{' '}
          <em>Incutec is the company behind this website.</em>
        </h1>
        <p className="editorial-lead">
          OpenDrone was started by people from Incutec, but it is not ours. The
          designs are developed in the open and the direction belongs to the
          people who fly them. Incutec manufactures the boards, sells them
          here, and carries the obligations that come with selling hardware.
        </p>
      </header>

      <section className="editorial-section">
        <p>
          Most consumer tech is a sealed box. You are not supposed to know what
          is inside, and that keeps you dependent on whoever made it. OpenDrone
          is the opposite: hardware that works as a real product and is
          published down to the last resistor, so you can repair it, re-flash
          it, fork it, improve it, or build it yourself.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Two jobs, two sets of hands</h2>
        <p>
          The community designs, reviews, tests and decides. Incutec does what
          a community cannot do alone: production, quality control,
          certification, distribution, warranty and legal responsibility for
          what is sold. When you buy a board on this website, Incutec BV is the
          seller, and the warranty and support are our job. That does not
          change because the design is open.
        </p>
        <p>
          Today Incutec still draws most of the hardware, because the first
          boards had to exist before anything else could. The intent is to move
          from designer to maintainer as contributors arrive. There is no date
          on that handover; it depends on who shows up. Anybody can help:{' '}
          <Link prefetch="viewport" to="/contribute">
            here is how
          </Link>
          , and the conversation runs on{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
            Discord
          </a>
          .
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · The company</h2>
        <p>
          Incutec is a young hardware company from Leuven, Belgium. Think of it
          as a record label for hardware: a maker brings a working design with
          real demand, and we handle certification, manufacturing, sales and
          support, publish everything, and share the revenue. That
          infrastructure is built once and reused, so good hardware that would
          otherwise die between prototype and shop actually ships. OpenDrone is
          the first release.
        </p>
        <p>
          Hardware is released under CERN-OHL-S, the firmware we ship is
          GPL-3.0 community firmware, boards are designed in KiCad, and €1 of
          every board sold goes to the upstream firmware projects the hardware
          depends on. Our legal and security pages say what we do, not what we
          hope to do.
        </p>
        <p>
          We are built for where European hardware is heading: CE marking done
          properly, EU consumer rules taken seriously, and products made by
          people you can name and talk to. This page is short on purpose. It
          grows as we do.
        </p>
      </section>

      <section className="editorial-cta">
        <Link prefetch="viewport" to="/contribute" className="editorial-cta-primary">
          Help design the hardware →
        </Link>
        <Link prefetch="viewport" to="/open-source" className="editorial-cta-secondary">
          How the open source model works →
        </Link>
      </section>
    </div>
  );
}
