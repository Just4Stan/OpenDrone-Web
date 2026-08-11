import type {Route} from './+types/roadmap';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';
import {
  ROADMAP,
  STATUS_ORDER,
  voteCandidates,
  type ProductStatus,
} from '~/lib/roadmap-data';
import {goals} from '~/lib/goals';
import {
  VOTE_COUNT_VISIBLE_FROM,
  voteShares,
  voteTally,
} from '~/lib/votes';

/**
 * Words live in `content/copy/roadmap.json`; this file holds the machinery.
 *
 * The split is not the usual one here, because this page carries the product
 * status system. A status is a controlled vocabulary shared with the
 * `status-*` topics on the GitHub repos, so the status KEYS and their column
 * order stay in code where a copy edit cannot invent a sixth status or
 * reorder the board. What a status is CALLED, and the sentence explaining it,
 * are prose and live in the copy file, keyed 1:1 off the status key. Same for
 * the roadmap entries: the status, the links and the order are code; the name
 * and the one-line note are copy, keyed off the entry's `id`.
 */
export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title:
      copyText('roadmap.meta_title') ??
      'Roadmap · What we build and how to help',
    description: copyText('roadmap.meta_description') ?? '',
  });

/**
 * The status-* topic on each public GitHub repo is the canonical status
 * (see hardware/README.md in the working container). This loader pulls
 * the topics at request time so the page mirrors the repos; the static
 * status in ROADMAP is the fallback for products without a public repo
 * and for API failures. In-memory cache, 1 hour per worker isolate,
 * which also keeps unauthenticated API usage far under the rate limit.
 */
let topicCache: {at: number; map: Record<string, ProductStatus>} | null = null;

async function fetchStatusFlags(
  token?: string,
): Promise<Record<string, ProductStatus>> {
  if (topicCache && Date.now() - topicCache.at < 3_600_000) {
    return topicCache.map;
  }
  const map: Record<string, ProductStatus> = {};
  await Promise.all(
    ROADMAP.filter((r) => r.link).map(async (r) => {
      try {
        const name = (r.link as string).replace('https://github.com/', '');
        const res = await fetch(`https://api.github.com/repos/${name}/topics`, {
          headers: {
            'User-Agent': 'opendrone-store-roadmap',
            Accept: 'application/vnd.github+json',
            // 60 req/h unauthenticated vs 5000 with a token; set
            // GITHUB_STATUS_TOKEN (read-only, public repos) in Oxygen.
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
          },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {names?: string[]};
        const flag = data.names
          ?.find((t) => t.startsWith('status-'))
          ?.slice('status-'.length);
        if (flag && (STATUS_ORDER as string[]).includes(flag)) {
          map[r.link as string] = flag as ProductStatus;
        }
      } catch {
        // Unreachable API: the static status stands in.
      }
    }),
  );
  topicCache = {at: Date.now(), map};
  return map;
}

export async function loader({context}: Route.LoaderArgs) {
  const env = context.env as unknown as Record<string, string | undefined>;
  const flags = await fetchStatusFlags(env.GITHUB_STATUS_TOKEN);
  const roadmap = ROADMAP.map((r) =>
    r.link && flags[r.link] ? {...r, status: flags[r.link]} : r,
  );
  return {roadmap};
}

// ROADMAP, STATUS_ORDER and the vote-candidate rule live in
// `app/lib/roadmap-data.ts` so the cart ballot derives its choices from the
// same structure this board renders. Only the rendering stays here.

/**
 * The community vote, read from `content/votes.json` (written by the tally
 * script, reviewable in the studio's Goals tab). Shares are shown as
 * percentages of weighted points; the absolute ballot count only appears
 * once it stops being a small number, so week one does not read as an empty
 * room. Candidates and their order come from the same roadmap structure the
 * kanban renders.
 */
function VotesSection() {
  const tally = voteTally();
  const candidates = voteCandidates();
  const shares = voteShares(
    tally,
    candidates.map((c) => c.id),
  );
  const rows = [...candidates].sort(
    (a, b) => (tally.points[b.id] ?? 0) - (tally.points[a.id] ?? 0),
  );
  const hasVotes = tally.ballots > 0;

  return (
    <section className="editorial-section">
      <Txt id="roadmap.votes_title" as="h2" className="editorial-section-title" />
      <Txt id="roadmap.votes_body" as="p" />
      {hasVotes ? (
        <div className="vote-board">
          {rows.map((c) => (
            <div className="vote-row" key={c.id}>
              <Txt
                id={`roadmap.item_${c.id}_name`}
                as="span"
                className="vote-name"
              />
              <span className="vote-bar" aria-hidden="true">
                <span
                  className="vote-bar-fill"
                  style={{width: `${shares[c.id]}%`}}
                />
              </span>
              <span className="vote-share">{shares[c.id]}%</span>
            </div>
          ))}
          <p className="vote-foot">
            {tally.ballots >= VOTE_COUNT_VISIBLE_FROM ? (
              <>
                {tally.ballots} <Txt id="roadmap.votes_ballots_label" />
                {' · '}
              </>
            ) : null}
            <Txt id="roadmap.votes_method" />
          </p>
        </div>
      ) : (
        <Txt id="roadmap.votes_empty" as="p" className="vote-empty" />
      )}
    </section>
  );
}

/**
 * Incutec's financial goals, from `content/goals.json` (edited in the
 * studio's Goals tab). Titles and bodies come from the goals file itself
 * rather than the copy store; the section heading and labels are copy.
 */
function GoalsSection() {
  const list = goals();
  if (list.length === 0) return null;

  return (
    <section className="editorial-section">
      <Txt id="roadmap.goals_title" as="h2" className="editorial-section-title" />
      <Txt id="roadmap.goals_body" as="p" />
      <div className="goal-list">
        {list.map((g) => (
          <article className="goal-card" key={g.id} data-goal-status={g.status}>
            <header className="goal-head">
              <h3 className="goal-title">{g.title}</h3>
              <Txt
                id={`roadmap.goals_status_${g.status}`}
                as="span"
                className="goal-status"
              />
            </header>
            <p className="goal-body">{g.body}</p>
            <div className="goal-meter-row">
              <span
                className="goal-meter"
                role="img"
                aria-label={`${g.status === 'done' ? 100 : g.progress_pct}%`}
              >
                <span
                  className="goal-meter-fill"
                  style={{width: `${g.status === 'done' ? 100 : g.progress_pct}%`}}
                />
              </span>
              <span className="goal-target">
                <Txt id="roadmap.goals_target_prefix" /> {g.target_label}
              </span>
            </div>
          </article>
        ))}
      </div>
      <Txt id="roadmap.goals_foot" as="p" className="goal-foot" />
    </section>
  );
}

export default function RoadmapRoute({loaderData}: Route.ComponentProps) {
  const columns = STATUS_ORDER.map((status) => ({
    status,
    items: loaderData.roadmap.filter((r) => r.status === status),
  }));

  return (
    <EditorialShell slug="roadmap">
      <header className="editorial-hero">
        <Txt id="roadmap.eyebrow" as="p" className="editorial-eyebrow" />
        <Txt id="roadmap.title" as="h1" className="editorial-title" />
        <Txt id="roadmap.lead" as="p" className="editorial-lead" />
      </header>

      <section className="editorial-section">
        <Txt id="roadmap.s1_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s1_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s2_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s2_body" as="p" />
        <div className="kanban">
          {columns.map((col) => (
            <div className="kanban-col" key={col.status}>
              <p className="kanban-col-head" data-status={col.status}>
                <span className="kanban-dot" />
                <Txt id={`roadmap.status_${col.status}_label`} />
                <span className="kanban-count">{col.items.length}</span>
              </p>
              {col.items.length === 0 ? (
                <Txt id="roadmap.kanban_empty" as="p" className="kanban-empty" />
              ) : (
                col.items.map((r) => (
                  <article className="kanban-card" key={r.id}>
                    <Txt
                      id={`roadmap.item_${r.id}_name`}
                      as="h3"
                      className="kanban-name"
                    />
                    <Txt
                      id={`roadmap.item_${r.id}_note`}
                      as="p"
                      className="kanban-note"
                    />
                    {r.productPath || r.link ? (
                      <p className="kanban-links">
                        {r.productPath ? (
                          <Link prefetch="viewport" to={r.productPath}>
                            <Txt id="roadmap.kanban_product_link" />
                          </Link>
                        ) : null}
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noopener noreferrer">
                            <Txt id="roadmap.kanban_source_link" />
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s3_title" as="h2" className="editorial-section-title" />
        <dl className="status-legend">
          {STATUS_ORDER.map((status) => (
            <div key={status}>
              <dt data-status={status}>
                <span className="kanban-dot" />
                <Txt id={`roadmap.status_${status}_label`} />
              </dt>
              <Txt id={`roadmap.status_${status}_legend`} as="dd" />
            </div>
          ))}
        </dl>
      </section>

      <VotesSection />

      <GoalsSection />

      <section className="editorial-section">
        <Txt id="roadmap.s4_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s4_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s5_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s5_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s6_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s6_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s7_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s7_body" as="p" />
      </section>

      <section className="editorial-cta">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-primary"
        >
          <Txt id="roadmap.cta_primary" />
        </a>
        <a
          href="https://github.com/OpenDrone-hw"
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-secondary"
        >
          <Txt id="roadmap.cta_secondary" />
        </a>
      </section>
    </EditorialShell>
  );
}
