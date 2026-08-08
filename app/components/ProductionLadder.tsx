import {Txt} from '~/components/Txt';

/**
 * The production page's visual column: the capability ladder, drawn as a
 * dated climb rather than described in a paragraph.
 *
 * Order is the argument. Each rung is bought with the revenue of the rung
 * below it, so the sequence runs cheapest-and-most-useful first (PCB
 * assembly) to hardest-and-most-capital (motors). The horizons are targets
 * we can miss, which is why the caveat is part of the graphic and not
 * small print somewhere else.
 *
 * Date and title only. The why and how of each rung is section 03 of the
 * prose; repeating it here turned the graphic into a second article.
 *
 * The rung order is structure and lives here; the dates and titles are copy
 * and live in `content/copy/production.json` as `ladder<n>_when` /
 * `ladder<n>_title`. Adding a rung is a code change, moving a date is not.
 */
const RUNGS = [1, 2, 3, 4];

export function ProductionLadder() {
  return (
    <figure className="ladder">
      <ol className="ladder-rungs">
        {RUNGS.map((n) => (
          <li key={n} className="ladder-rung">
            <Txt id={`production.ladder${n}_when`} className="ladder-when" />
            <Txt id={`production.ladder${n}_title`} className="ladder-title" />
          </li>
        ))}
      </ol>
      <Txt id="production.ladder_note" as="p" className="ladder-note" />
    </figure>
  );
}
