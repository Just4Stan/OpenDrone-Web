/**
 * Provenance card — the honest where-is-this-made line. Designed in
 * Belgium, first runs assembled in Shenzhen, EU assembly on the roadmap.
 * Kept static for now; the batch ID on the build card is the live link
 * between a given unit and its factory.
 */
export function ProvenanceCard() {
  return (
    <section className="provenance-card" aria-label="Where this is made">
      <p className="provenance-label">Provenance</p>
      <ul className="provenance-rows">
        <li>
          <span className="provenance-flag" aria-hidden="true">
            🇧🇪
          </span>
          <span className="provenance-row-label">Designed</span>
          <span className="provenance-row-value">
            Leuven, Belgium{' '}
            <span className="provenance-row-note">
              — schematic, PCB, BOM, firmware partnerships
            </span>
          </span>
        </li>
        <li>
          <span className="provenance-flag" aria-hidden="true">
            🇨🇳
          </span>
          <span className="provenance-row-label">Assembled</span>
          <span className="provenance-row-value">
            Shenzhen, China{' '}
            <span className="provenance-row-note">
              — first runs, while we bring up an EU line
            </span>
          </span>
        </li>
        <li>
          <span className="provenance-flag" aria-hidden="true">
            🇪🇺
          </span>
          <span className="provenance-row-label">Next</span>
          <span className="provenance-row-value">
            EU assembly{' '}
            <span className="provenance-row-note">
              — partner selection underway, 2027 target
            </span>
          </span>
        </li>
      </ul>
      <p className="provenance-foot">
        Every board ships with a build card: batch ID, QC initials,
        factory, firmware rev and GitHub commit. One card per unit, not
        per carton.
      </p>
    </section>
  );
}
