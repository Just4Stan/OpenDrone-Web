import type {CommitTick} from '~/lib/github';
import {contributorColor} from '~/lib/contributor-colors';

/**
 * Repo activity as a strip along the chapter's bottom edge: one tick per
 * commit, colored per contributor with the same hash the contributor tiles
 * use for their accent line, so the grid above doubles as the legend. The
 * data comes straight from the GitHub API (fetchCommitActivity), so the
 * drawing stays in sync with the repo without anyone curating it.
 *
 * Deliberately quiet: hairline axis, low-opacity ticks, dates only at the
 * ends. aria-hidden throughout; the same activity is available as real
 * content on the repo itself.
 */
export function CommitTimeline({commits}: {commits: CommitTick[]}) {
  const ticks = commits
    .map((c) => ({t: new Date(c.date).getTime(), author: c.author}))
    .filter((c) => Number.isFinite(c.t))
    .sort((a, b) => a.t - b.t);
  // A texture needs a minimum of material.
  if (ticks.length < 5) return null;

  const first = ticks[0].t;
  const last = ticks[ticks.length - 1].t;
  const span = Math.max(last - first, 1);
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

  return (
    <div className="commit-timeline" aria-hidden="true">
      <div className="commit-timeline-axis" />
      {ticks.slice(-100).map((c, i) => {
        const color = contributorColor(c.author);
        return (
          <span
            key={`${c.t}-${i}`}
            className="commit-timeline-tick"
            style={{
              left: `${((c.t - first) / span) * 100}%`,
              // Deterministic height variation so the row reads as activity,
              // not as a fence. No randomness: SSR and client must agree.
              height: `${10 + (i % 4) * 7}px`,
              ...(color
                ? {background: `color-mix(in srgb, ${color} 55%, transparent)`}
                : {}),
            }}
          />
        );
      })}
      <span className="commit-timeline-date" style={{left: 0}}>
        {fmt(first)}
      </span>
      <span className="commit-timeline-date" style={{right: 0}}>
        {fmt(last)}
      </span>
    </div>
  );
}
