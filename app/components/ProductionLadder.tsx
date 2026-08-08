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
 */
type Rung = {
  when: string;
  title: string;
};

const RUNGS: Rung[] = [
  {when: '2027 Q2', title: 'PCB assembly'},
  {when: '2027 Q4', title: 'Carbon fibre routing'},
  {when: '2028 Q3', title: 'Aluminium and anodising'},
  {when: '2029 Q2', title: 'Motors'},
];

export function ProductionLadder() {
  return (
    <figure className="ladder">
      <figcaption className="ladder-head">
        <span className="ladder-eyebrow">Capability ladder</span>
        <span className="ladder-sub">What the boards are meant to pay for</span>
      </figcaption>
      <ol className="ladder-rungs">
        {RUNGS.map((rung) => (
          <li key={rung.title} className="ladder-rung">
            <span className="ladder-when">{rung.when}</span>
            <span className="ladder-title">{rung.title}</span>
          </li>
        ))}
      </ol>
      <p className="ladder-note">
        Targets, not promises: the dates move when the numbers do.
      </p>
    </figure>
  );
}
