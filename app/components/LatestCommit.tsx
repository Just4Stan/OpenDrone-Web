import type {LatestCommit} from '~/lib/github';

function relativeTime(iso: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mo ago`;
  const y = Math.floor(d / 365);
  return `${y} y ago`;
}

export function LatestCommitCard({commit}: {commit: LatestCommit}) {
  return (
    <a
      href={commit.url}
      target="_blank"
      rel="noopener noreferrer"
      className="latest-commit-card"
    >
      <p className="latest-commit-label">
        Last commit · <span>{commit.repoLabel}</span>
      </p>
      <p className="latest-commit-message">{commit.message}</p>
      <p className="latest-commit-meta">
        <span className="latest-commit-sha">{commit.shortSha}</span>
        <span aria-hidden="true"> · </span>
        <span>{commit.author}</span>
        <span aria-hidden="true"> · </span>
        <span>{relativeTime(commit.date)}</span>
      </p>
    </a>
  );
}

export function LatestCommitGrid({commits}: {commits: LatestCommit[]}) {
  if (commits.length === 0) return null;
  return (
    <div className="latest-commits">
      {commits.map((c) => (
        <LatestCommitCard key={c.sha + c.repoUrl} commit={c} />
      ))}
    </div>
  );
}

export function LatestCommitSkeleton({count = 1}: {count?: number}) {
  return (
    <div className="latest-commits" aria-hidden="true">
      {Array.from({length: count}, (_, i) => (
        <div key={i} className="latest-commit-card latest-commit-skeleton">
          <div className="latest-commit-skeleton-line latest-commit-skeleton-label" />
          <div className="latest-commit-skeleton-line latest-commit-skeleton-message" />
          <div className="latest-commit-skeleton-line latest-commit-skeleton-meta" />
        </div>
      ))}
    </div>
  );
}
