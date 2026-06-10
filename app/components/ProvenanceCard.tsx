/**
 * Provenance card — the honest where-is-this-made line. Designed in
 * Belgium, first runs assembled in Shenzhen, EU assembly on the roadmap.
 * Kept static for now; the batch ID on the build card is the live link
 * between a given unit and its factory.
 *
 * `designNote` customises the "Designed" annotation per product family —
 * the PCB default ("schematic, PCB, BOM…") is nonsense on the carbon
 * frame, which passes its own CAD wording.
 */
export function ProvenanceCard({
  designNote = 'schematic, PCB, BOM, firmware partnerships',
}: {
  designNote?: string;
} = {}) {
  return (
    <section className="provenance-card" aria-label="Where this is made">
      <p className="provenance-label">Provenance</p>
      <ul className="provenance-rows">
        <li>
          <span className="provenance-row-label">Designed</span>
          <span className="provenance-row-value">
            Leuven, Belgium{' '}
            <span className="provenance-row-note">· {designNote}</span>
          </span>
        </li>
        <li>
          <span className="provenance-row-label">Assembled</span>
          <span className="provenance-row-value">
            Shenzhen, China{' '}
            <span className="provenance-row-note">
              · first runs, while we bring up an EU line
            </span>
          </span>
        </li>
        <li>
          <span className="provenance-row-label">Next</span>
          <span className="provenance-row-value">
            EU assembly{' '}
            <span className="provenance-row-note">
              · in planning
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}
