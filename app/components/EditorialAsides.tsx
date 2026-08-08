/**
 * The visual columns for the editorial pages. One figure per page, same
 * grammar as the production ladder: a mono eyebrow, a one-line sub, then
 * a small graphic built from type and hairlines. Data, not paragraphs:
 * anything that needs a sentence belongs in the prose column.
 */

/**
 * Open source page: what is actually in every board repo, drawn as the
 * repo tree. The argument of the page in one glance: the factory files
 * and the download are the same thing.
 */
const REPO_TREE: Array<{name: string; note: string; last?: boolean}> = [
  {name: 'hardware/', note: 'KiCad source'},
  {name: 'production/', note: 'Gerbers · BOM · CPL'},
  {name: '3d/', note: 'STEP'},
  {name: 'firmware/', note: 'configs'},
  {name: 'LICENSE', note: 'CERN-OHL-S-2.0', last: true},
];

export function RepoTreeAside() {
  return (
    <figure className="aside-fig">
      <figcaption className="aside-head">
        <span className="aside-eyebrow">In every repo</span>
        <span className="aside-sub">The factory gets the same files</span>
      </figcaption>
      <ul className="repo-tree">
        {REPO_TREE.map((row) => (
          <li key={row.name} className={row.last ? 'is-licence' : undefined}>
            <span className="repo-tree-branch" aria-hidden="true">
              {row.last ? '└─' : '├─'}
            </span>
            <span className="repo-tree-name">{row.name}</span>
            <span className="repo-tree-note">{row.note}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

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

/**
 * Firmware partners page: the €1 split, drawn as a flow. Three fixed
 * destinations; the projects are the page's subject so they are named
 * here, not configured.
 */
const SPLIT_DESTINATIONS = ['Betaflight', 'AM32', 'ExpressLRS'];

export function FirmwareSplitAside() {
  return (
    <figure className="aside-fig">
      <figcaption className="aside-head">
        <span className="aside-eyebrow">The split</span>
        <span className="aside-sub">Forwarded upstream, per board sold</span>
      </figcaption>
      <div className="split-flow">
        <p className="split-src">€1</p>
        <ul className="split-dsts">
          {SPLIT_DESTINATIONS.map((name) => (
            <li key={name}>
              <span className="split-arrow" aria-hidden="true">→</span>
              {name}
            </li>
          ))}
        </ul>
      </div>
      <p className="aside-note">
        The board&apos;s own firmware project gets the euro.
      </p>
    </figure>
  );
}
