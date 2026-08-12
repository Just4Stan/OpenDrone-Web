import type {Route} from './+types/contributing';
import {useLoaderData} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {ContributorsWall} from '~/components/ContributorsWall';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';
import {fetchContributors} from '~/lib/github';
import {ROADMAP} from '~/lib/roadmap-data';

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

export async function loader({context}: Route.LoaderArgs) {
  const env = context.env as unknown as Record<string, string | undefined>;
  // Everyone with commits anywhere in the project: every public board repo
  // plus this site's own. Best-effort — rate-limited or offline degrades to
  // an empty wall, never an error (fetchContributors already merges by
  // login, drops bots and sorts by total commits).
  const repos = [
    ...ROADMAP.filter((r) => r.link).map((r) => r.link as string),
    'https://github.com/OpenDrone-hw/OpenDrone-Web',
  ];
  const contributors = await fetchContributors(
    repos,
    100,
    env.GITHUB_TOKEN,
  ).catch(() => []);
  return {contributors};
}

const SECTIONS = [1, 2, 3, 4];

export default function ContributingRoute() {
  const {contributors} = useLoaderData<typeof loader>();
  return (
    <EditorialShell
      slug="contributing"
      aside={<ContributorsWall contributors={contributors} />}
    >
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
