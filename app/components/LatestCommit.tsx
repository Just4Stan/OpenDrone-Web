import {useRef} from 'react';
import {useInView} from 'motion/react';
import type {LatestCommit} from '~/lib/github';
import {ScrambleText} from '~/components/ScrambleText';

/**
 * Footer REV cell — the KiCad title block's revision box. Renders the flagship
 * repo's HEAD as `REV {short-hash} · {date}`, the hash decoding in ONCE on
 * first in-view via ScrambleText (the single sanctioned decode outside the 404
 * — flagged for Stan's sign-off; flip {@link REV_DECODE} to retire it in one
 * line). Values are pure derived data: a git short-hash and an ISO date.
 *
 * Data source: a `commit` prop, so the box stays a pure render with zero
 * network cost in global chrome. It is NOT fetched here — the storefront CSP
 * (`connectSrc` in entry.server.tsx) blocks api.github.com from the browser,
 * and the commit fetch that feeds it (`fetchLatestCommits`) already runs
 * server-side on the routes that have it. Until a global loader threads a
 * commit through PageLayout, the box degrades to the em-dash placeholder and
 * links to the repo's commit history — a title block before first issue, never
 * a broken cell. Wiring a live hash is a one-line `commit={…}` once the value
 * is available in Footer's data.
 */

/** Flip to false to retire the footer REV decode in one line (Stan sign-off). */
export const REV_DECODE = true;

/** Flagship repo the REV box reports (also linked in the footer's Open Source
 *  column); its /commits page is the placeholder link target. */
export const REV_REPO_URL = 'https://github.com/incutec-hw/OpenFC';

export function FooterRevCell({
  label = 'REV',
  commit,
}: {
  label?: string;
  commit?: LatestCommit | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, {once: true, margin: '0px 0px -8% 0px'});

  const sha = commit?.shortSha ?? '';
  const date = commit?.date ? commit.date.slice(0, 10) : '';
  const href = commit?.url ?? `${REV_REPO_URL.replace(/\/$/, '')}/commits`;

  return (
    <a
      className="footer-rev"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={sha ? `Revision ${sha}, ${date}` : 'Revision history'}
    >
      <span className="footer-rev-label doc-annot" aria-hidden="true">
        {label}
      </span>
      <span ref={ref} className="footer-rev-value doc-cell">
        {sha ? (
          REV_DECODE && inView ? (
            <ScrambleText
              key={sha}
              className="footer-rev-sha"
              text={sha}
              duration={650}
            />
          ) : (
            <span className="footer-rev-sha">{sha}</span>
          )
        ) : (
          <span className="footer-rev-sha" aria-hidden="true">
            —
          </span>
        )}
        {date ? (
          <>
            <span className="footer-rev-sep" aria-hidden="true">
              {' · '}
            </span>
            <span className="footer-rev-date">{date}</span>
          </>
        ) : null}
      </span>
    </a>
  );
}

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

/**
 * Static stand-in for {@link LatestCommitCard} when the live GitHub fetch comes
 * back empty (the unauthenticated API is capped at 60 req/hour per IP, so the
 * edge gets rate-limited under load). Keeps the row's 4th card present on every
 * page — it just links to the repo's commit history instead of a single commit.
 */
export function CommitHistoryCard({repoUrl}: {repoUrl: string}) {
  return (
    <a
      href={`${repoUrl.replace(/\/$/, '')}/commits`}
      target="_blank"
      rel="noopener noreferrer"
      className="open-source-card"
    >
      <p className="open-source-card-label">Changelog</p>
      <p className="open-source-card-title">Commit history ↗</p>
      <p className="open-source-card-sub">Every revision, public on GitHub</p>
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
