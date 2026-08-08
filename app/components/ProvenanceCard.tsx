import {Txt} from './Txt';
import {copyText} from '~/lib/copy';

/**
 * Provenance card — the honest where-is-this-made line. Designed in
 * Belgium, first runs assembled in Shenzhen, EU assembly on the roadmap.
 * Kept static for now; the batch ID on the build card is the live link
 * between a given unit and its factory.
 *
 * `designNote` customises the "Designed" annotation per product family —
 * the PCB default ("schematic, PCB, BOM…") is nonsense on the carbon
 * frame, which passes its own CAD wording. Both strings live in
 * `content/copy/product-chrome.json`; the prop is which one to use, not
 * the words themselves.
 */
export function ProvenanceCard({
  designNote = copyText('product-chrome.provenance_design_note'),
}: {
  designNote?: string;
} = {}) {
  return (
    <section
      className="provenance-card"
      aria-label={copyText('product-chrome.provenance_aria')}
    >
      <Txt id="product-chrome.provenance_label" as="p" className="provenance-label" />
      <ul className="provenance-rows">
        <li>
          <Txt
            id="product-chrome.provenance_designed_label"
            as="span"
            className="provenance-row-label"
          />
          <span className="provenance-row-value">
            {copyText('product-chrome.provenance_designed_value')}{' '}
            <span className="provenance-row-note">· {designNote}</span>
          </span>
        </li>
        <li>
          <Txt
            id="product-chrome.provenance_assembled_label"
            as="span"
            className="provenance-row-label"
          />
          <span className="provenance-row-value">
            {copyText('product-chrome.provenance_assembled_value')}{' '}
            <span className="provenance-row-note">
              · {copyText('product-chrome.provenance_assembled_note')}
            </span>
          </span>
        </li>
        <li>
          <Txt
            id="product-chrome.provenance_next_label"
            as="span"
            className="provenance-row-label"
          />
          <span className="provenance-row-value">
            {copyText('product-chrome.provenance_next_value')}{' '}
            <span className="provenance-row-note">
              · {copyText('product-chrome.provenance_next_note')}
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}
