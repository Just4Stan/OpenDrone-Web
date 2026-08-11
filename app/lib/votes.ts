/**
 * The community vote: ballot codec and tally store.
 *
 * How a vote travels: the cart ballot serialises a ranking into ONE cart
 * attribute (`_vote_rank`), Shopify copies cart attributes onto the order at
 * checkout, and `scripts/tally-votes.mjs` later walks orders via the Admin
 * API and writes the weighted totals into `content/votes.json`. This module
 * owns both ends: the codec the ballot and the cart action share, and the
 * read side of the tally file. Nothing at request time talks to the Admin
 * API.
 *
 * The tally file is committed like all other content, so the counts shown on
 * /roadmap are exactly as fresh as the last tally run, and Stan can review or
 * correct them in the studio's Goals tab before they ship.
 */

/** Cart attribute key. `_` prefix hides it from the customer at checkout. */
export const VOTE_ATTR_KEY = '_vote_rank';

/** At most three ranked choices, scored 3/2/1. */
export const VOTE_MAX_CHOICES = 3;
export const VOTE_WEIGHTS = [3, 2, 1] as const;

/**
 * `openvtx>motors>charger`. `>` reads as "over" in a ranking, cannot appear
 * in a roadmap id, and keeps the longest possible value (three ids) well
 * under the cart action's 64-char attribute cap.
 */
const SEPARATOR = '>';

export function serializeVoteRank(ids: string[]): string {
  return ids.slice(0, VOTE_MAX_CHOICES).join(SEPARATOR);
}

/**
 * Decode and validate in one step: order-preserving, deduplicated, unknown
 * ids dropped, capped at three. Returns [] for garbage rather than throwing,
 * because the value crosses a trust boundary twice (client -> cart action,
 * order -> tally script) and both callers want "ignore what is not a vote".
 */
export function parseVoteRank(
  value: unknown,
  validIds: readonly string[],
): string[] {
  if (typeof value !== 'string' || value.length > 64) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(SEPARATOR)) {
    const id = raw.trim();
    if (!id || seen.has(id) || !validIds.includes(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === VOTE_MAX_CHOICES) break;
  }
  return out;
}

/** Points one ballot contributes, by rank position. */
export function ballotPoints(rank: number): number {
  return VOTE_WEIGHTS[rank] ?? 0;
}

/** Shape of `content/votes.json`. */
export type VoteTally = {
  /** ISO date of the last tally run, or "" before the first one. */
  updated: string;
  /** Ballots counted. Drives whether an absolute count is shown at all. */
  ballots: number;
  /** Weighted points per roadmap id. */
  points: Record<string, number>;
};

const EMPTY: VoteTally = {updated: '', ballots: 0, points: {}};

// Same guarded-glob pattern as app/lib/copy.ts: bundled for the worker,
// HMR-tracked for the studio, absent under node:test.
const FILES = import.meta.env
  ? import.meta.glob<{default: VoteTally}>('/content/votes.json', {eager: true})
  : {};

export function voteTally(): VoteTally {
  const mod = Object.values(FILES)[0];
  const t = mod?.default;
  if (!t || typeof t !== 'object') return EMPTY;
  return {
    updated: typeof t.updated === 'string' ? t.updated : '',
    ballots: Number.isFinite(t.ballots) ? Math.max(0, Math.floor(t.ballots)) : 0,
    points: t.points && typeof t.points === 'object' ? t.points : {},
  };
}

/**
 * Percentage share per candidate, over the given ids. Sums can exceed 100 by
 * a point from rounding; the bars are visual, not an audit, and each value is
 * rounded for display anyway.
 */
export function voteShares(
  tally: VoteTally,
  ids: readonly string[],
): Record<string, number> {
  const total = ids.reduce((sum, id) => sum + (tally.points[id] ?? 0), 0);
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = total > 0 ? Math.round(((tally.points[id] ?? 0) / total) * 100) : 0;
  }
  return out;
}

/** Absolute ballot counts read as sad below this; show shares only. */
export const VOTE_COUNT_VISIBLE_FROM = 25;
