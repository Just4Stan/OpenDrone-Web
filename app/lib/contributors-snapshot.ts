import type {Contributor} from './github';

/**
 * Committed fallback for the PDP contributor wall.
 *
 * The wall fetches GitHub live, but Oxygen shares its egress IP with the rest
 * of the platform, so the unauthenticated 60-calls-an-hour ceiling is usually
 * already spent and the fetch 403s. That left most product pages showing the
 * "+ you" tile alone. `content/contributors.json`, refreshed weekly by
 * scripts/sync-contributors.mjs, is what the page falls back to instead.
 *
 * Live data still wins whenever it arrives: this is a floor, not a cache.
 */
export type ContributorSnapshot = {
  /** ISO date of the last sync run, or "" before the first one. */
  updated: string;
  /** Product handle → roster, already sorted and capped by the script. */
  products: Record<string, Contributor[]>;
};

const EMPTY: ContributorSnapshot = {updated: '', products: {}};

// Same guarded-glob pattern as app/lib/votes.ts: bundled for the worker,
// HMR-tracked for the studio, absent under node:test.
const FILES = import.meta.env
  ? import.meta.glob<{default: ContributorSnapshot}>(
      '/content/contributors.json',
      {eager: true},
    )
  : {};

function isContributor(v: unknown): v is Contributor {
  if (!v || typeof v !== 'object') return false;
  const c = v as Partial<Contributor>;
  return (
    typeof c.login === 'string' &&
    typeof c.avatarUrl === 'string' &&
    typeof c.htmlUrl === 'string' &&
    Number.isFinite(c.contributions)
  );
}

export function contributorSnapshot(): ContributorSnapshot {
  const snap = Object.values(FILES)[0]?.default;
  if (!snap || typeof snap !== 'object') return EMPTY;
  const products: Record<string, Contributor[]> = {};
  for (const [handle, list] of Object.entries(snap.products ?? {})) {
    if (Array.isArray(list)) products[handle] = list.filter(isContributor);
  }
  return {
    updated: typeof snap.updated === 'string' ? snap.updated : '',
    products,
  };
}

/** The recorded roster for one product handle; empty array if unknown. */
export function snapshotContributors(handle: string): Contributor[] {
  return contributorSnapshot().products[handle] ?? [];
}

/**
 * Put the product's authored `credits` order at the front of a roster.
 *
 * GitHub sorts contributors by commit count, which credits whoever touched
 * the most files rather than whoever designed the board: on OpenRX that put
 * 153 docs and scaffolding commits ahead of the 8 that are the receivers.
 * Where a product names its credits, that order wins and everyone else
 * follows in the API's order, so a first-time contributor still shows up
 * without anyone editing content.
 */
export function orderByCredits(
  contributors: Contributor[],
  credits?: string[],
): Contributor[] {
  if (!credits?.length) return contributors;
  const rank = new Map(credits.map((login, i) => [login.toLowerCase(), i]));
  return [...contributors].sort((a, b) => {
    const ra = rank.get(a.login.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.login.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}
