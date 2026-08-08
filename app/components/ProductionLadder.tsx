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
 * Process detail is deliberately real. A reader who machines or assembles
 * for a living should recognise the steps and conclude we know what we are
 * asking for, not that we googled a buzzword.
 */
type Rung = {
  when: string;
  title: string;
  detail: string;
  /** Steps of the actual process, for readers who want the specifics. */
  steps: string;
};

const RUNGS: Rung[] = [
  {
    when: '2027 Q2',
    title: 'PCB assembly',
    detail:
      'The first rung that pays for itself. Shorter supply chains, the parts we chose rather than the ones a fab happens to stock, and a revision turned around in days.',
    steps: 'Stencil print · pick-and-place · reflow · AOI',
  },
  {
    when: '2027 Q4',
    title: 'Carbon fibre routing',
    detail:
      'Frame plates cut in-house. Mostly an extraction problem: carbon dust is both conductive and a respiratory hazard, so the filtration is a bigger purchase than the machine.',
    steps: 'Diamond-cut tooling · sealed cell · HEPA extraction',
  },
  {
    when: '2028 Q3',
    title: 'Aluminium and anodising',
    detail:
      'Camera mounts, standoffs and motor bells cut from billet on a 5-axis mill, then finished on our own line instead of shipped out for it.',
    steps: 'Degrease · etch · desmut · anodise · dye · seal',
  },
  {
    when: '2029 Q2',
    title: 'Motors',
    detail:
      'The deep end, and the one that would say we actually built a factory. Every FPV motor worth flying is still made by someone else, in one place.',
    steps:
      'Stamped laminations · stack and coat · wind · bond magnets into the flux ring · machine bell and base · dynamic balance',
  },
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
            <span className="ladder-detail">{rung.detail}</span>
            <span className="ladder-steps">{rung.steps}</span>
          </li>
        ))}
      </ol>
      <p className="ladder-note">
        Targets, not promises. Each rung is bought with what the one below it
        earns, so the dates move when the numbers do.
      </p>
    </figure>
  );
}
