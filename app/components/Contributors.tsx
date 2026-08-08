import type {Contributor} from '~/lib/github';

/**
 * Contributor grid for the PDP "Built in the open" chapter: one tile per
 * GitHub account with commits on the product's repos, plus a standing
 * "+ you" tile that points at the repo's issues. The section renders even
 * when the GitHub API is rate-limited (empty list): the invitation tile
 * is the point, the avatars are the proof.
 */
export function ContributorGrid({
  contributors,
  issuesUrl,
}: {
  contributors: Contributor[];
  issuesUrl: string;
}) {
  return (
    <ul className="contributor-grid">
      {contributors.map((c) => (
        <li key={c.login}>
          <a
            className="contributor-tile"
            href={c.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* NOT loading="lazy". The chapter sets content-visibility: auto,
                so this subtree is size-contained until it nears the viewport,
                and a lazy image inside it reads as far offscreen and never
                gets fetched — the avatars stayed blank even once the grid was
                on screen. content-visibility already does the deferring; a
                60px avatar needs no second mechanism. */}
            <img
              className="contributor-avatar"
              src={`${c.avatarUrl}${c.avatarUrl.includes('?') ? '&' : '?'}s=120`}
              alt=""
              width={60}
              height={60}
              decoding="async"
            />
            <span className="contributor-login">{c.login}</span>
            <span className="contributor-count">
              {c.contributions} commit{c.contributions === 1 ? '' : 's'}
            </span>
          </a>
        </li>
      ))}
      <li>
        <a
          className="contributor-tile contributor-tile--you"
          href={issuesUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="contributor-avatar contributor-avatar--you" aria-hidden="true">
            +
          </span>
          <span className="contributor-login">you?</span>
          <span className="contributor-count">open an issue</span>
        </a>
      </li>
    </ul>
  );
}

/** Loading placeholder: same grid, grey tiles, no text. */
export function ContributorGridSkeleton() {
  return (
    <ul className="contributor-grid" aria-hidden="true">
      {Array.from({length: 4}, (_, i) => (
        <li key={i}>
          <span className="contributor-tile is-skeleton">
            <span className="contributor-avatar" />
            <span className="contributor-login">&nbsp;</span>
            <span className="contributor-count">&nbsp;</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
