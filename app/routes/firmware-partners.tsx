import type {Route} from './+types/firmware-partners';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {MarginArt, SplitFlowArt, ChipsArt} from '~/components/MarginArt';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Firmware partners · Where your €1 goes',
    description:
      'OpenDrone ships on Betaflight, AM32 and ExpressLRS. Incutec forwards €1 of every board sold to the upstream maintainers. Here is the list.',
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

type MergedPr = {
  project: string;   // upstream project name
  title: string;     // the PR title as it reads on GitHub
  url: string;       // the real PR URL — must resolve
  what: string;      // one line: what the change does for users
};

/**
 * Upstream contributions with receipts. HARD RULE: only list PRs that are
 * real, authored by us, and MERGED on the upstream repo — verify the URL
 * before adding an entry. Never list aspirational or in-progress work here.
 *
 * Verified 2026-07-06 (gh pr list --author Just4Stan on betaflight/betaflight,
 * am32-firmware/AM32, ExpressLRS/ExpressLRS + a global PR search): zero
 * merged and zero open upstream PRs so far. The Betaflight RP2350-platform
 * work lives on our fork and hasn't been submitted upstream yet. The section
 * below stays hidden until this array gains its first verified entry.
 */
const MERGED_PRS: MergedPr[] = [];

const PARTNERS: Partner[] = [
  {
    project: 'Betaflight',
    runsOn: 'OpenFC-Lite',
    blurb:
      'Betaflight is the flight controller firmware used in most mini-quad freestyle builds. OpenFC-Lite is a Betaflight-target board; the RP2354 target work is developed on a public fork and has not been submitted upstream yet.',
    repoUrl: 'https://github.com/betaflight/betaflight',
    donationUrl: 'https://opencollective.com/betaflight',
  },
  {
    project: 'AM32',
    runsOn: 'OpenESC',
    blurb:
      'AM32 is a multi-MCU ESC firmware alternative to BLHeli, GPL-3.0 licensed. OpenESC runs AM32 on AT32F421 channels: the same firmware as other AM32 ESCs, no custom fork, no vendor lock-in.',
    repoUrl:
      'https://github.com/am32-firmware/AM32',
  },
  {
    project: 'ExpressLRS',
    runsOn: 'OpenRX',
    blurb:
      'ExpressLRS is the open long-range 2.4 GHz / sub-GHz radio protocol. OpenRX targets are upstream (Unified_ESP32C3_2400_RX for Lite, Unified_ESP32C3_LR1121_RX for Mono/Gemini) so you flash with the standard ExpressLRS configurator.',
    repoUrl: 'https://github.com/ExpressLRS/ExpressLRS',
    donationUrl: 'https://opencollective.com/expresslrs',
  },
];

export default function FirmwarePartnersRoute() {
  return (
    <EditorialShell slug="firmware-partners">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">€1 per board · forwarded</p>
        <h1 className="editorial-title">
          The firmware makes the hardware fly.{' '}
          <em>We pay the people who wrote it.</em>
        </h1>
        <p className="editorial-lead">
          Every OpenDrone board runs on community firmware the project
          didn&apos;t write. For every board sold, Incutec forwards €1 to the
          upstream project: one contribution, one transaction, one line item in
          the books. Here&apos;s the list, with links if you want to give them
          more directly.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · How the split works</h2>
        <MarginArt><SplitFlowArt /></MarginArt>
        <p>
          When you buy a board, the checkout total covers the hardware price plus
          a €1 firmware contribution baked in. We batch those contributions and
          forward them to the upstream project via GitHub Sponsors,
          OpenCollective, or a direct bank transfer, depending on what the
          maintainers have set up.
        </p>
        <p>
          Buy a stack (an OpenFC-Lite and an OpenESC in one order) and the
          split doubles: €1 to Betaflight, €1 to AM32. Every board carries its
          own contribution, so both maintainers keep their cut.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · The projects</h2>
        <MarginArt><ChipsArt /></MarginArt>
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
        <h2 className="editorial-section-title">03 · Giving directly</h2>
        <p>
          Want to give the maintainers more than the baked-in €1? Where a
          project runs a public donation page, its card above links to it;
          AM32 has none, so its share is forwarded by direct transfer. Giving
          directly means no payment-processor fee: 100% of what you send
          reaches them.
        </p>
      </section>

      {MERGED_PRS.length > 0 ? (
        <section className="editorial-section">
          <h2 className="editorial-section-title">04 · Merged upstream</h2>
          <p>
            Money is one half; patches are the other. These are our changes
            that upstream actually merged: every link goes to the real PR.
          </p>
          <ul className="upstream-list">
            {MERGED_PRS.map((pr) => (
              <li className="upstream-item" key={pr.url}>
                <p className="upstream-project">{pr.project}</p>
                <a
                  className="upstream-title"
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pr.title} ↗
                </a>
                <p className="upstream-what">{pr.what}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="editorial-cta">
        <Link prefetch="viewport" to="/open-source" className="editorial-cta-primary">
          Read why we open-source everything →
        </Link>
        <Link prefetch="viewport" to="/collections/all" className="editorial-cta-secondary">
          Browse the boards →
        </Link>
      </section>
    </EditorialShell>
  );
}
