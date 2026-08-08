/**
 * The visual columns for the editorial pages. One figure per page, same
 * grammar as the production ladder: a mono eyebrow, a one-line sub, then
 * a small graphic built from type and hairlines. Data, not paragraphs:
 * anything that needs a sentence belongs in the prose column.
 */

/**
 * Roadmap page: the pipeline at a glance. Counts come from the page's own
 * data so the figure can never drift from the list it summarises.
 */
export function RoadmapPipelineAside({
  stages,
}: {
  stages: Array<{label: string; count: number}>;
}) {
  return (
    <figure className="aside-fig">
      <figcaption className="aside-head">
        <span className="aside-eyebrow">The pipeline</span>
        <span className="aside-sub">Every project below, by stage</span>
      </figcaption>
      <ol className="pipeline">
        {stages.map((s, i) => (
          <li key={s.label} className={i === 0 ? 'is-now' : undefined}>
            <span className="pipeline-count">{s.count}</span>
            <span className="pipeline-label">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="aside-note">No dates: a status moves when hardware does.</p>
    </figure>
  );
}

