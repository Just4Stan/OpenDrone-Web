/**
 * Shared homepage copy + derived ledger data.
 *
 * The desktop hero (routes/_index.tsx) and the phone homepage
 * (components/MobileHome.tsx) both render the open-hardware "index" band and
 * the hero tagline. The copy was authored once by Stan on MobileHome; it is
 * MOVED here verbatim (the one sanctioned copy move) so a single edit updates
 * both homepages and the two can never drift apart.
 *
 * Nothing here is new prose — HOME_LEDGER + HOME_TAGLINE are the exact strings
 * that lived in MobileHome, and OPEN_DESIGN_COUNT is derived from the
 * product-content registry so the published-designs figure can't go stale.
 */
import {PRODUCT_CONTENT} from '~/lib/product-content';

/* Every row is a fact already published elsewhere on the site (open-source
 * page, PDP downloads); the design count is derived from the product-content
 * registry so it can't drift. */
const OPEN_DESIGN_COUNT = Object.values(PRODUCT_CONTENT).filter(
  (c) => c.fileNumber !== '—',
).length;

/* [key, value, countUp?] — only the derived design COUNT is a quantity worth
 * sweeping; licence versions, tool versions and prices are identifiers/fixed
 * figures and render static. */
export const HOME_LEDGER: Array<[string, string, boolean?]> = [
  ['Board designs published', String(OPEN_DESIGN_COUNT).padStart(2, '0'), true],
  ['Hardware licence', 'CERN-OHL-S 2.0'],
  ['Source format', 'KiCad 9 · STEP · BOM'],
  ['Firmware split', '€1 / unit upstream'],
  ['Designed in', 'Belgium'],
];

/** Hero subhead — moved verbatim from MobileHome. */
export const HOME_TAGLINE =
  'Open Source drone parts, designed in Belgium. Published and transparent so you can understand it, not just fly it.';
