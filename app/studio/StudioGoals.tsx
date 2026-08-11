import {useCallback, useEffect, useRef, useState} from 'react';
import {ROADMAP} from '~/lib/roadmap-data';
import type {Goal, GoalMode, GoalStatus} from '~/lib/goals';

/**
 * The Goals tab: `content/goals.json` and `content/votes.json`, edited whole.
 *
 * These two files are structured (numbers, statuses, ordered lists), which the
 * Words tab deliberately cannot touch: its leaf editor edits strings in place
 * and never creates or removes structure. So the structure gets a bespoke
 * editor here, same as Chapters. The preview iframe shows /roadmap, which
 * renders both files; a save hot-reloads it like every other content write.
 *
 * The vote tally is normally written by `npm run votes:tally`, but it is
 * shown editable here because the numbers are committed content: reviewing
 * and correcting them by hand before a push is the point of the studio.
 */

type GoalsDoc = {$comment?: string; goals: Goal[]};
type VotesDoc = {
  $comment?: string;
  updated: string;
  ballots: number;
  points: Record<string, number>;
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/__studio${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : {'content-type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & {error?: string};
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json;
}

const STATUSES: GoalStatus[] = ['done', 'current', 'next'];

const BLANK_GOAL: Goal = {
  id: '',
  status: 'next',
  title: '',
  body: '',
  target_label: '',
  progress_pct: 0,
  mode: 'manual',
  target_eur: null,
  allocation_pct: 100,
  since: '',
};

/** `A pick and place machine` -> `a-pick-and-place-machine`. */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export function StudioGoals({setStatus}: {setStatus: (s: string) => void}) {
  const [goalsDoc, setGoalsDoc] = useState<GoalsDoc | null>(null);
  const [votesDoc, setVotesDoc] = useState<VotesDoc | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [selected, setSelected] = useState<number | 'votes'>(0);
  const frame = useRef<HTMLIFrameElement>(null);

  const load = useCallback(() => {
    Promise.all([
      api<{data: GoalsDoc}>('/read', {file: 'goals.json'}),
      api<{data: VotesDoc}>('/read', {file: 'votes.json'}),
    ])
      .then(([g, v]) => {
        setGoalsDoc(g.data);
        setVotesDoc(v.data);
        setSavedJson(JSON.stringify([g.data, v.data]));
        setStatus(
          `${g.data.goals?.length ?? 0} goals · ${v.data.ballots ?? 0} ballots in the tally`,
        );
      })
      .catch((e: unknown) =>
        setStatus(`Could not read goals/votes: ${(e as Error).message}`),
      );
    // setStatus is stable for the lifetime of the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(load, [load]);

  const dirty =
    Boolean(goalsDoc && votesDoc) &&
    JSON.stringify([goalsDoc, votesDoc]) !== savedJson;

  const save = async () => {
    if (!goalsDoc || !votesDoc) return;
    try {
      await api('/write', {file: 'goals.json', data: goalsDoc});
      await api('/write', {file: 'votes.json', data: votesDoc});
      setSavedJson(JSON.stringify([goalsDoc, votesDoc]));
      setStatus('Saved. The preview reloads on its own.');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  };

  const goals = goalsDoc?.goals ?? [];

  const patchGoal = (i: number, patch: Partial<Goal>) => {
    if (!goalsDoc) return;
    const next = goals.map((g, j) => (j === i ? {...g, ...patch} : g));
    setGoalsDoc({...goalsDoc, goals: next});
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!goalsDoc) return;
    const j = i + dir;
    if (j < 0 || j >= goals.length) return;
    const next = [...goals];
    [next[i], next[j]] = [next[j], next[i]];
    setGoalsDoc({...goalsDoc, goals: next});
    if (selected === i) setSelected(j);
    else if (selected === j) setSelected(i);
  };

  const addGoal = () => {
    if (!goalsDoc) return;
    setGoalsDoc({...goalsDoc, goals: [...goals, {...BLANK_GOAL}]});
    setSelected(goals.length);
  };

  const removeGoal = (i: number) => {
    if (!goalsDoc) return;
    setGoalsDoc({...goalsDoc, goals: goals.filter((_, j) => j !== i)});
    if (selected === i) setSelected(0);
  };

  const goal = typeof selected === 'number' ? goals[selected] : undefined;

  return (
    <div className="studio-grid">
      <aside className="studio-rail">
        <h2>Goals</h2>
        <ul className="studio-pages">
          {goals.map((g, i) => (
            <li key={i}>
              <button
                type="button"
                className={selected === i ? 'is-on' : undefined}
                onClick={() => setSelected(i)}
              >
                {g.title || g.id || 'untitled goal'}
                <span className="studio-peek">
                  {g.status} · {g.progress_pct}%
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="studio-actions" style={{padding: '8px 0'}}>
          <button type="button" onClick={addGoal}>
            Add goal
          </button>
        </div>

        <h2>Vote tally</h2>
        <ul className="studio-pages">
          <li>
            <button
              type="button"
              className={selected === 'votes' ? 'is-on' : undefined}
              onClick={() => setSelected('votes')}
            >
              votes.json
              <span className="studio-peek">
                {votesDoc
                  ? `${votesDoc.ballots} ballots · ${votesDoc.updated || 'never tallied'}`
                  : ''}
              </span>
            </button>
          </li>
        </ul>

        <div className="studio-actions" style={{padding: '8px 0', gap: 8}}>
          <button type="button" onClick={load} disabled={!dirty}>
            Revert
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => void save()}
            disabled={!dirty}
          >
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </aside>

      <main className="studio-stage">
        <iframe ref={frame} title="Roadmap preview" src="/roadmap" />
      </main>

      <aside className="studio-inspector">
        {selected === 'votes' && votesDoc ? (
          <>
            <h2>Vote tally</h2>
            <p className="studio-hint">
              content/votes.json · usually written by `npm run votes:tally`,
              hand-correctable here
            </p>
            <label className="studio-goal-field">
              Ballots counted
              <input
                type="number"
                min={0}
                value={votesDoc.ballots}
                onChange={(e) =>
                  setVotesDoc({
                    ...votesDoc,
                    ballots: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })
                }
              />
            </label>
            <p className="studio-hint">
              Weighted points per project (3/2/1 by rank):
            </p>
            {ROADMAP.map((r) => (
              <label className="studio-goal-field" key={r.id}>
                {r.id}
                <input
                  type="number"
                  min={0}
                  value={votesDoc.points[r.id] ?? 0}
                  onChange={(e) => {
                    const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    const points = {...votesDoc.points};
                    if (n === 0) delete points[r.id];
                    else points[r.id] = n;
                    setVotesDoc({...votesDoc, points});
                  }}
                />
              </label>
            ))}
            <p className="studio-hint">
              Last tallied: {votesDoc.updated || 'never'}
            </p>
          </>
        ) : goal ? (
          <>
            <h2>{goal.title || 'New goal'}</h2>
            <p className="studio-hint">content/goals.json · {goal.id || 'no id yet'}</p>
            <label className="studio-goal-field">
              Title
              <input
                value={goal.title}
                onChange={(e) => {
                  const patch: Partial<Goal> = {title: e.target.value};
                  // Derive the id from the title until one exists on disk, so
                  // adding a goal never asks for a slug.
                  if (!savedJson.includes(`"${goal.id}"`) || !goal.id) {
                    patch.id = slug(e.target.value);
                  }
                  patchGoal(selected as number, patch);
                }}
              />
            </label>
            <label className="studio-goal-field">
              What it unlocks
              <textarea
                value={goal.body}
                onChange={(e) =>
                  patchGoal(selected as number, {body: e.target.value})
                }
                spellCheck
              />
            </label>
            <label className="studio-goal-field">
              Target, as prose (&quot;about €30k&quot;)
              <input
                value={goal.target_label}
                onChange={(e) =>
                  patchGoal(selected as number, {target_label: e.target.value})
                }
              />
            </label>
            <label className="studio-goal-field">
              Status
              <select
                value={goal.status}
                onChange={(e) =>
                  patchGoal(selected as number, {
                    status: e.target.value as GoalStatus,
                  })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-goal-field">
              Meter mode
              <select
                value={goal.mode ?? 'manual'}
                onChange={(e) =>
                  patchGoal(selected as number, {
                    mode: e.target.value as GoalMode,
                  })
                }
              >
                <option value="manual">manual: the slider below</option>
                <option value="auto">auto: weekly, from order totals</option>
              </select>
            </label>
            {goal.mode === 'auto' ? (
              <>
                <label className="studio-goal-field">
                  Real target in EUR (input only, never shown)
                  <input
                    type="number"
                    min={1}
                    value={goal.target_eur ?? ''}
                    onChange={(e) =>
                      patchGoal(selected as number, {
                        target_eur: Number(e.target.value) || null,
                      })
                    }
                  />
                </label>
                <label className="studio-goal-field">
                  Share of gross order value that counts (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={goal.allocation_pct ?? 100}
                    onChange={(e) =>
                      patchGoal(selected as number, {
                        allocation_pct: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                </label>
                <label className="studio-goal-field">
                  Counting orders since (YYYY-MM-DD)
                  <input
                    value={goal.since ?? ''}
                    onChange={(e) =>
                      patchGoal(selected as number, {since: e.target.value})
                    }
                  />
                </label>
                <p className="studio-hint">
                  Meter: {goal.progress_pct}%. Auto goals are moved by the
                  weekly community-sync run (or `npm run goals:update`),
                  floored to 5% steps. Saving here can still correct the
                  value below.
                </p>
              </>
            ) : null}
            <label className="studio-goal-field">
              Progress: {goal.progress_pct}%
              {goal.mode === 'auto' ? ' (auto, correct only if wrong)' : ' (approximate, by hand)'}
              <input
                type="range"
                min={0}
                max={100}
                value={goal.progress_pct}
                onChange={(e) =>
                  patchGoal(selected as number, {
                    progress_pct: Number(e.target.value),
                  })
                }
              />
            </label>
            <div className="studio-actions" style={{padding: '10px 0'}}>
              <button type="button" onClick={() => move(selected as number, -1)}>
                Move up
              </button>
              <button type="button" onClick={() => move(selected as number, 1)}>
                Move down
              </button>
              <button
                type="button"
                onClick={() => removeGoal(selected as number)}
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <p className="studio-empty">
            Pick a goal on the left, or the vote tally.
          </p>
        )}
      </aside>
    </div>
  );
}
