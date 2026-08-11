/**
 * Repo activity as a background texture: one faint tick per commit, placed
 * on a horizontal time axis behind the contributors chapter's text. The
 * dates come straight from the GitHub API (see fetchCommitDates), so the
 * drawing stays in sync with the repo without anyone curating it.
 *
 * Deliberately quiet: hairline axis, low-opacity ticks, no labels except
 * the axis ends. It has to read as engraving under the text, never as a
 * chart competing with it. aria-hidden throughout, the same activity is
 * available as real content on the repo itself.
 */
export function CommitTimeline({dates}: {dates: string[]}) {
  const times = dates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  // A texture needs a minimum of material.
  if (times.length < 5) return null;

  const first = times[0];
  const last = times[times.length - 1];
  const span = Math.max(last - first, 1);
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

  return (
    <div className="commit-timeline" aria-hidden="true">
      <div className="commit-timeline-axis" />
      {times.slice(-100).map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="commit-timeline-tick"
          style={{
            left: `${((t - first) / span) * 100}%`,
            // Deterministic height variation so the row reads as activity,
            // not as a fence. No randomness: SSR and client must agree.
            height: `${10 + (i % 4) * 7}px`,
          }}
        />
      ))}
      <span className="commit-timeline-date" style={{left: 0}}>
        {fmt(first)}
      </span>
      <span className="commit-timeline-date" style={{right: 0}}>
        {fmt(last)}
      </span>
    </div>
  );
}
