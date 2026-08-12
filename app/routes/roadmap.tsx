import type {Route} from './+types/roadmap';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';
import {
  STATUS_ORDER,
  fetchStatusFlagsFast,
  resolveRoadmap,
  voteCandidates,
  type RoadmapItem,
} from '~/lib/roadmap-data';
import {goals} from '~/lib/goals';
import {voteShares, voteTally} from '~/lib/votes';

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

// The status-* topic fetch (canonical status carrier) lives in
// app/lib/roadmap-data.ts now, shared with the ballot's candidate route.
// The fast variant caps the wait: static statuses stand in while a cold
// cache warms, instead of the whole page hanging on GitHub.
export async function loader({context}: Route.LoaderArgs) {
  const env = context.env as unknown as Record<string, string | undefined>;
  const flags = await fetchStatusFlagsFast(env.GITHUB_STATUS_TOKEN);
  return {roadmap: resolveRoadmap(flags)};
}

// ROADMAP, STATUS_ORDER and the vote-candidate rule live in
// `app/lib/roadmap-data.ts` so the cart ballot derives its choices from the
// same structure this board renders. Only the rendering stays here.

/**
 * The community vote, read from `content/votes.json` (written by the tally
 * script, reviewable in the studio's Goals tab).
 *
 * Takes the LIVE roadmap from the loader, so the section keeps itself
 * current: an entry graduating out of `planned`/`in-progress` leaves the
 * standings on its own and moves to the "already moving" receipt below if it
 * had votes, and a newly listed entry appears with its listed-since date so a
 * low count reads as "new", not "unpopular". Each row shows how many ballots
 * ranked it, as the reference figure next to the share bar.
 */
function VotesSection({roadmap}: {roadmap: RoadmapItem[]}) {
  const tally = voteTally();
  const candidates = voteCandidates(roadmap);
  const shares = voteShares(
    tally,
    candidates.map((c) => c.id),
  );
  const rows = [...candidates].sort(
    (a, b) => (tally.points[b.id] ?? 0) - (tally.points[a.id] ?? 0),
  );
  // Voted-for entries that have since left the candidate set: the receipt
  // that voting moves things. Their points stay in the tally on purpose.
  const graduated = roadmap.filter(
    (r) =>
      !candidates.some((c) => c.id === r.id) && (tally.mentions[r.id] ?? 0) > 0,
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
              <span className="vote-name">
                <Txt id={`roadmap.item_${c.id}_name`} />
                {c.added ? (
                  <span className="vote-added">
                    <Txt id="roadmap.votes_added_prefix" /> {c.added}
                  </span>
                ) : null}
              </span>
              <span className="vote-bar" aria-hidden="true">
                <span
                  className="vote-bar-fill"
                  style={{width: `${shares[c.id]}%`}}
                />
              </span>
              <span className="vote-share">
                {shares[c.id]}%
                <span className="vote-count">
                  {tally.mentions[c.id] ?? 0}{' '}
                  <Txt id="roadmap.votes_count_label" />
                </span>
              </span>
            </div>
          ))}
          <p className="vote-foot">
            {tally.ballots} <Txt id="roadmap.votes_ballots_label" />
            {' · '}
            <Txt id="roadmap.votes_method" />
          </p>
          {graduated.length ? (
            <div className="vote-graduated">
              <Txt id="roadmap.votes_graduated_title" as="p" />
              <ul>
                {graduated.map((r) => (
                  <li key={r.id}>
                    <Txt id={`roadmap.item_${r.id}_name`} />
                    {' · '}
                    <Txt id={`roadmap.status_${r.status}_label`} />
                    {' · '}
                    {tally.mentions[r.id]}{' '}
                    <Txt id="roadmap.votes_count_label" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
        <Txt id="roadmap.s2_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s2_body" as="p" />
        <div className="kanban">
          {columns.map((col) => (
            <div className="kanban-col" key={col.status}>
              <p className="kanban-col-head" data-status={col.status}>
                <span className="kanban-dot" />
                <Txt id={`roadmap.status_${col.status}_label`} />
                <span className="kanban-count">
                  {/* Boards, not entries: OpenRX is one entry, four boards. */}
                  {col.items.reduce((n, r) => n + (r.variants?.length ?? 1), 0)}
                </span>
              </p>
              {col.items.length === 0 ? (
                <Txt id="roadmap.kanban_empty" as="p" className="kanban-empty" />
              ) : (
                col.items.flatMap((r) => {
                  // One card per BOARD: an entry with variants (OpenRX) fans
                  // out, everything else is its own card. Visual first: the
                  // render is the card, the name is the caption, and the whole
                  // card is the link. From alpha on there is a product page
                  // worth landing on; before that the design source is the
                  // truth, so the card goes to GitHub.
                  const toProduct =
                    STATUS_ORDER.indexOf(r.status) <=
                      STATUS_ORDER.indexOf('alpha') && r.productPath;
                  const cards = r.variants ?? [{id: r.id, image: r.image}];
                  return cards.map((card) => {
                    const body = (
                      <>
                        {card.image ? (
                          <span className="kanban-media">
                            <img
                              src={card.image}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                        ) : null}
                        <Txt
                          id={`roadmap.item_${card.id}_name`}
                          as="h3"
                          className="kanban-name"
                        />
                      </>
                    );
                    if (toProduct) {
                      return (
                        <Link
                          prefetch="viewport"
                          to={r.productPath as string}
                          className="kanban-card is-linked"
                          key={card.id}
                        >
                          {body}
                        </Link>
                      );
                    }
                    if (r.link) {
                      return (
                        <a
                          href={r.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="kanban-card is-linked"
                          key={card.id}
                        >
                          {body}
                        </a>
                      );
                    }
                    return (
                      <article className="kanban-card" key={card.id}>
                        {body}
                      </article>
                    );
                  });
                })
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

      <section className="editorial-section">
        <Txt id="roadmap.s1_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s1_body" as="p" />
      </section>

      <VotesSection roadmap={loaderData.roadmap} />

      <GoalsSection />

      {/* The how-to-contribute sections moved to /contributing (2026-08-11);
          the roadmap is the status board, votes and goals. */}
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
