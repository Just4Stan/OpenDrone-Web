import type {Route} from './+types/contributing';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';

/**
 * The practical half of the community project: report, change, get credited.
 * Split out of /roadmap (2026-08-11, Stan) so the roadmap can be the status
 * board and this can be the how-to. Words live in
 * `content/copy/contributing.json`; this file holds the section order.
 */
export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title:
      copyText('contributing.meta_title') ??
      'Contributing · How to take a piece of OpenDrone',
    description: copyText('contributing.meta_description') ?? '',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

const SECTIONS = [1, 2, 3, 4];

export default function ContributingRoute() {
  return (
    <EditorialShell slug="contributing">
      <header className="editorial-hero">
        <Txt id="contributing.title" as="h1" className="editorial-title" />
        <Txt id="contributing.lead" as="p" className="editorial-lead" />
      </header>

      {SECTIONS.map((n) => (
        <section className="editorial-section" key={n}>
          <Txt
            id={`contributing.s${n}_title`}
            as="h2"
            className="editorial-section-title"
          />
          <Txt id={`contributing.s${n}_body`} as="p" />
        </section>
      ))}

      <section className="editorial-cta">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-primary"
        >
          <Txt id="contributing.cta_primary" />
        </a>
        <a
          href="https://github.com/OpenDrone-hw"
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-secondary"
        >
          <Txt id="contributing.cta_secondary" />
        </a>
      </section>
    </EditorialShell>
  );
}
