import type {Route} from './+types/open-source';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {RepoTreeAside} from '~/components/EditorialAsides';
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
    <EditorialShell slug="open-source" aside={<RepoTreeAside />}>
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Open Source</p>
        <h1 className="editorial-title">
          We sell hardware. The designs are yours.
        </h1>
        <p className="editorial-lead">
          Every OpenDrone product comes with its full source on GitHub. Incutec is the Belgian startup that started the initiative, hosts this website, sells the products here, and does what the community can&apos;t do on their own.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Job one: the community designs it</h2>
        <p>
          OpenDrone was started by people from Incutec, but it is not ours. The
          designs are developed in the open and the direction belongs to the
          people who fly them. The community designs, reviews, tests and
          decides.
        </p>
        <p>
          The intent for us is to move from designer to maintainer as contributors arrive. We believe there&apos;s plenty of talent out there to take on the challenges of hardware development. We will support that in any way we can to drive innovation in our hobby. If you feel like you want and can help, then{' '}
          <Link prefetch="viewport" to="/roadmap">
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
        <h2 className="editorial-section-title">02 · Job two: Incutec brings it to market</h2>
        <p>
          Incutec does what a community cannot do alone: production, quality
          control, certification, distribution and legal responsibility for
          what is sold. That does not change because the design is open. We
          believe the best support comes from community members helping each
          other, since information about FPV is widely available. As a small
          team, we want to focus on improving our vertical integration to
          deliver the best products possible.
        </p>
        <p>
          The community project needs no revenue; the company manufacturing and
          supporting the boards does. We don&apos;t make money from ads,
          affiliate trackers, resold analytics, bundled apps, or features locked
          behind firmware keys. Our analytics are cookieless (Plausible), and
          the product works whether or not this web store exists.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · Why a company is in the loop</h2>
        <p>
          Incutec is a young startup from Leuven, Belgium, founded in June 2026.
          We&apos;re trying out a new business model where development is
          decentralised like open-source code projects, but a company still
          holds the responsibility of bringing the product to market.
        </p>
        <p>
          OpenDrone is our pilot project; we think FPV is the perfect place to
          start. Development is already partly decentralised in code, but we
          are increasingly reliant on Chinese goods and the companies behind
          them to innovate on the hardware side. We don&apos;t think this is
          bad, but we think they shouldn&apos;t be the only players.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">04 · A record label for hardware</h2>
        <p>
          For the future business model of Incutec, think of it as a music
          record label for hardware: someone brings us a working design with
          real demand, and we handle certification, manufacturing, sales and
          support.
        </p>
        <p>
          That infrastructure is built once, with OpenDrone. Most products are
          a mixture of PCB manufacturing, machining and injection molding. If
          we can build this infrastructure once, we can expand to more
          projects. Each one, like OpenDrone, will retain its own staff and
          final assembly, but the pipeline between &apos;prototype&apos; and
          &apos;sold product&apos; is something we can re-use again and again,
          once we know how. OpenDrone is what will teach us.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">05 · What you buy</h2>
        <p>
          A finished, tested, packaged board, sold by Incutec. Fabricated and
          assembled in China today, then inspected, flashed, and shipped from
          Belgium; EU assembly is an ambition covered on the{' '}
          <Link to="/production">production page</Link>. The price covers the
          PCB, the components, the assembly, the QC time, the packaging, the
          courier, VAT, support, and the engineering for the next revision.
          Nothing hidden in it. We hope to be more transparent about where the
          profits go; for now, you can be assured they all go to either
          R&amp;D or investment in manufacturing.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">06 · Why CERN-OHL-S</h2>
        <p>
          CERN-OHL-S v2 is a reciprocal, copyleft open-hardware licence. It keeps
          the design open: modify an OpenDrone board, ship your own version, and
          if someone asks for your sources, you hand them over on the same terms.
          The point isn&apos;t to stop clones. We can&apos;t, and we wouldn&apos;t
          want to. The point is that every clone carries its sources forward to
          the next maker.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">07 · What this means for you</h2>
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
    </EditorialShell>
  );
}
