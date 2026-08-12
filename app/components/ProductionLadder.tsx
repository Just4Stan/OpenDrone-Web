import {Txt} from '~/components/Txt';
import {goals} from '~/lib/goals';

/**
 * The production page's visual column: the capability climb, drawn from the
 * SAME data as the financial goals (`content/goals.json`), so the ladder can
 * never promise something the goals do not.
 *
 * Shape, per Stan (2026-08-11): the filled node is where we are today
 * (inspect/flash/ship from Belgium), a SOLID line climbs to the goal being
 * saved for, and a DOTTED line continues to the one after it, which is
 * openly speculative. Nothing beyond that is drawn, and nothing carries a
 * date. Completed goals stack above as a record.
 */
type Rung = {
  key: string;
  kind: 'done' | 'now' | 'current' | 'next';
  /** Goal title, or undefined for the fixed "now" rung (copy-keyed). */
  title?: string;
};

export function ProductionLadder() {
  const list = goals();
  const rungs: Rung[] = [
    ...list
      .filter((g) => g.status === 'done')
      .map((g): Rung => ({key: g.id, kind: 'done', title: g.title})),
    {key: 'now', kind: 'now'},
    ...list
      .filter((g) => g.status === 'current')
      .slice(0, 1)
      .map((g): Rung => ({key: g.id, kind: 'current', title: g.title})),
    ...list
      .filter((g) => g.status === 'next')
      .slice(0, 1)
      .map((g): Rung => ({key: g.id, kind: 'next', title: g.title})),
  ];

  return (
    <figure className="ladder">
      <ol className="ladder-rungs">
        {rungs.map((r, i) => (
          <li
            key={r.key}
            className="ladder-rung"
            data-kind={r.kind}
            // The connector below this node: dotted when it climbs into the
            // speculative rung, solid otherwise.
            data-seg={
              i === rungs.length - 1
                ? undefined
                : rungs[i + 1].kind === 'next'
                  ? 'dashed'
                  : 'solid'
            }
          >
            <Txt
              id={
                r.kind === 'now'
                  ? 'production.ladder_now_when'
                  : `roadmap.goals_status_${r.kind === 'done' ? 'done' : r.kind === 'current' ? 'current' : 'next'}`
              }
              className="ladder-when"
            />
            {r.kind === 'now' ? (
              <Txt id="production.ladder_now_title" className="ladder-title" />
            ) : (
              <span className="ladder-title">{r.title}</span>
            )}
          </li>
        ))}
      </ol>
      <Txt id="production.ladder_note" as="p" className="ladder-note" />
    </figure>
  );
}
