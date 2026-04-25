import type {Route} from './+types/firmware-partners';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Firmware partners · Where your €1 goes',
    description:
      'OpenDrone ships on Betaflight, AM32 and ExpressLRS. We forward €1 of every order to the upstream maintainers — here is the list.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

type Partner = {
  project: string;
  runsOn: string;                 // which OpenDrone boards
  blurb: string;
  repoUrl: string;
  donationUrl?: string;           // where we forward funds (GitHub Sponsors, OpenCollective, bank)
};

const PARTNERS: Partner[] = [
  {
    project: 'Betaflight',
    runsOn: 'OpenFC',
    blurb:
      'Betaflight is the flight controller firmware used in most mini-quad freestyle builds. OpenFC is a Betaflight-target board — the RP2354B port is being upstreamed.',
    repoUrl: 'https://github.com/betaflight/betaflight',
    donationUrl: 'https://opencollective.com/betaflight',
  },
  {
    project: 'AM32',
    runsOn: 'OpenESC',
    blurb:
      'AM32 is a multi-MCU ESC firmware alternative to BLHeli, MIT-licensed. OpenESC runs AM32 on AT32F421 channels — same firmware as other AM32 ESCs, no custom fork, no vendor lock-in.',
    repoUrl:
      'https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware',
  },
  {
    project: 'ExpressLRS',
    runsOn: 'OpenRX · OpenFC break-off RX',
    blurb:
      'ExpressLRS is the open long-range 2.4 GHz / sub-GHz radio protocol. OpenRX targets are upstream (Unified_ESP32C3_2400_RX for Lite, Unified_ESP32C3_LR1121_RX for Mono/Gemini) so you flash with the standard ExpressLRS configurator.',
    repoUrl: 'https://github.com/ExpressLRS/ExpressLRS',
    donationUrl: 'https://opencollective.com/expresslrs',
  },
];

export default function FirmwarePartnersRoute() {
  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">€1 per order · forwarded</p>
        <h1 className="editorial-title">
          The firmware makes the hardware fly.{' '}
          <em>We pay the people who wrote it.</em>
        </h1>
        <p className="editorial-lead">
          Every OpenDrone board runs on firmware we didn&apos;t write. For every
          unit sold we forward €1 to the upstream project — one contribution,
          one transaction, one line item in our books. Here&apos;s the list, with
          links so you can double-dip if you want.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · How the split works</h2>
        <p>
          When you buy a board, the checkout total covers the hardware price plus
          a €1 firmware contribution baked in. We batch those contributions and
          forward them to the upstream project — GitHub Sponsors, OpenCollective,
          or a direct bank transfer depending on what the maintainers have set
          up. We publish the totals on each release so you can see what went
          where.
        </p>
        <p>
          On the OpenStack bundle (OpenFC + OpenESC) the split doubles: €1 to
          Betaflight, €1 to AM32. The bundle price is still lower than the two
          boards bought separately — the maintainers don&apos;t lose their cut.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · The projects</h2>
        <div className="partners-grid">
          {PARTNERS.map((p) => (
            <article key={p.project} className="partner-card">
              <p className="partner-label">Runs on · {p.runsOn}</p>
              <h3 className="partner-project">{p.project}</h3>
              <p className="partner-blurb">{p.blurb}</p>
              <div className="partner-links">
                <a
                  href={p.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source ↗
                </a>
                {p.donationUrl ? (
                  <a
                    href={p.donationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Donate directly ↗
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · Want to double the €1?</h2>
        <p>
          At checkout you&apos;ll see an optional donation step — pick €1, €3, €5,
          €10 or skip. 100% of that line is forwarded on top of the baked-in €1.
          We don&apos;t keep a cut.
        </p>
        <p>
          If you&apos;d rather give directly, every project above links to their
          own donation page. We&apos;d honestly prefer that to a 1% processor fee
          skimming our route — but the checkout option is there if it&apos;s more
          convenient.
        </p>
      </section>

      <section className="editorial-cta">
        <Link to="/open-source" className="editorial-cta-primary">
          Read why we open-source everything →
        </Link>
        <Link to="/collections/all" className="editorial-cta-secondary">
          Browse the boards →
        </Link>
      </section>
    </div>
  );
}
