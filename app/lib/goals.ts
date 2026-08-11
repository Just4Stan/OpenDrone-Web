/**
 * Incutec's financial goals, read from `content/goals.json`.
 *
 * The file is the studio's to write (Goals tab) and git's to version. The
 * progress figure is set BY HAND, deliberately: it is an approximate public
 * signal ("about a third of the way to the pick and place machine"), not a
 * live revenue feed. Wiring it to real sales data would leak order volume and
 * imply an audited number nobody is auditing.
 *
 * Statuses: `done` goals are kept as a record, `current` is the one being
 * saved for (the cart meter shows the first current goal), `next` is queued.
 */

export type GoalStatus = 'done' | 'current' | 'next';

export type Goal = {
  id: string;
  status: GoalStatus;
  /** Short name: "A pick and place machine". */
  title: string;
  /** One paragraph on what reaching it unlocks. */
  body: string;
  /** Approximate target, as prose: "about €30k". Never an invoice figure. */
  target_label: string;
  /** 0-100, hand-set, clamped on read. */
  progress_pct: number;
};

const STATUSES: ReadonlySet<string> = new Set(['done', 'current', 'next']);

// Same guarded-glob pattern as app/lib/copy.ts: bundled for the worker,
// HMR-tracked for the studio, absent under node:test.
const FILES = import.meta.env
  ? import.meta.glob<{default: {goals?: unknown}}>('/content/goals.json', {
      eager: true,
    })
  : {};

/** Clamp one raw record into a Goal, or null if it is not one. */
export function normalizeGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.id !== 'string' || !g.id) return null;
  const pct = typeof g.progress_pct === 'number' ? g.progress_pct : 0;
  return {
    id: g.id,
    status: STATUSES.has(g.status as string) ? (g.status as GoalStatus) : 'next',
    title: typeof g.title === 'string' ? g.title : '',
    body: typeof g.body === 'string' ? g.body : '',
    target_label: typeof g.target_label === 'string' ? g.target_label : '',
    progress_pct: Math.min(100, Math.max(0, Math.round(pct))),
  };
}

export function goals(): Goal[] {
  const mod = Object.values(FILES)[0];
  const list = mod?.default?.goals;
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeGoal)
    .filter((g): g is Goal => g !== null);
}

/** The goal the cart meter points at. First `current` in file order. */
export function currentGoal(): Goal | undefined {
  return goals().find((g) => g.status === 'current');
}
