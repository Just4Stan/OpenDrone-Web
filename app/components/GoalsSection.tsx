import {Txt} from '~/components/Txt';
import {goals} from '~/lib/goals';

/**
 * Incutec's financial goals, from `content/goals.json` (edited in the
 * studio's Goals tab). Titles and bodies come from the goals file itself
 * rather than the copy store; the section heading and labels are copy.
 */
export function GoalsSection() {
  const list = goals();
  if (list.length === 0) return null;

  return (
    <section className="editorial-section">
      <Txt id="roadmap.goals_title" as="h2" className="editorial-section-title" />
      <Txt id="roadmap.goals_body" as="p" />
      <div className="goal-list">
        {list.map((g) => (
          <article className="goal-card" key={g.id} data-goal-status={g.status}>
            <header className="goal-head">
              <h3 className="goal-title">{g.title}</h3>
              <Txt
                id={`roadmap.goals_status_${g.status}`}
                as="span"
                className="goal-status"
              />
            </header>
            <p className="goal-body">{g.body}</p>
            <div className="goal-meter-row">
              <span
                className="goal-meter"
                role="img"
                aria-label={`${g.status === 'done' ? 100 : g.progress_pct}%`}
              >
                <span
                  className="goal-meter-fill"
                  style={{width: `${g.status === 'done' ? 100 : g.progress_pct}%`}}
                />
              </span>
              <span className="goal-target">
                <Txt id="roadmap.goals_target_prefix" /> {g.target_label}
              </span>
            </div>
          </article>
        ))}
      </div>
      <Txt id="roadmap.goals_foot" as="p" className="goal-foot" />
    </section>
  );
}
