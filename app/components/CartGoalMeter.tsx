import {Link} from 'react-router';
import {Txt} from '~/components/Txt';
import {currentGoal} from '~/lib/goals';

/**
 * One quiet line under the cart summary: the financial goal orders are
 * moving toward, with an approximate meter. The full story (all goals, what
 * each unlocks) lives on /roadmap; this is the reminder at the moment of
 * buying, not the pitch.
 *
 * Deliberately not "your money buys X": the goal is Incutec's, the progress
 * figure is hand-set and approximate (see app/lib/goals.ts), and nothing
 * here is an earmark or an escrow. The copy keys keep that register.
 */
export function CartGoalMeter() {
  const goal = currentGoal();
  if (!goal) return null;

  return (
    <Link prefetch="viewport" to="/roadmap" className="cart-goal">
      <p className="cart-goal-line">
        <Txt id="cart.goal_prefix" />{' '}
        <span className="cart-goal-title">{goal.title}</span>
      </p>
      <span
        className="goal-meter"
        role="img"
        aria-label={`${goal.progress_pct}%`}
      >
        <span
          className="goal-meter-fill"
          style={{width: `${goal.progress_pct}%`}}
        />
      </span>
    </Link>
  );
}
