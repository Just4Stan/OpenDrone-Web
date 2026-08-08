/**
 * Populates the custom.* compliance metafields with values that are
 * verifiable from the codebase / known facts only. Intentionally leaves
 * blank the fields that require the maintainer's input or real per-batch data:
 *   safety_warnings_{nl,fr,en}  — must be authored, not invented (GPSR)
 *   doc_url, sbom_url           — Declaration of Conformity / SBOM not yet published
 *   firmware_version, batch_id  — per-build values, set at fulfillment
 *   support_end_date            — CRA support-period policy decision
 *   battery_wh, battery_un_*    — these products are PCBs, not batteries
 *
 * Idempotent: metafieldsSet overwrites in place. Safe to re-run.
 */
import {admin} from './_client.mjs';

const SECURITY_EMAIL = 'security@opendrone.be';

// key -> Shopify metafield type (must match the definitions created in 01-*)
const TYPES = {
  github_repo: 'url',
  datasheet_url: 'url',
  manual_url: 'url',
  vuln_contact_email: 'single_line_text_field',
  model_number: 'single_line_text_field',
};

const DATA = {
  openesc: {
    github_repo: 'https://github.com/OpenDrone-hw/OpenESC-20x20',
    vuln_contact_email: SECURITY_EMAIL,
    model_number: 'OPENESC',
  },
  openfc: {
    github_repo: 'https://github.com/OpenDrone-hw/OpenFC',
    datasheet_url: 'https://github.com/OpenDrone-hw/OpenFC/raw/main/hardware/schematic.pdf',
    manual_url: 'https://github.com/OpenDrone-hw/OpenFC/raw/main/docs/manual.pdf',
    vuln_contact_email: SECURITY_EMAIL,
    model_number: 'OPENFC',
  },
  openrx: {
    github_repo: 'https://github.com/OpenDrone-hw/OpenRX',
    datasheet_url: 'https://github.com/OpenDrone-hw/OpenRX/raw/main/hardware/schematic.pdf',
    manual_url: 'https://github.com/OpenDrone-hw/OpenRX/raw/main/docs/manual.pdf',
    vuln_contact_email: SECURITY_EMAIL,
    model_number: 'OPENRX',
  },
  openframe: {
    github_repo: 'https://github.com/OpenDrone-hw',
    manual_url: 'https://github.com/OpenDrone-hw/OpenFrame/raw/main/docs/assembly.pdf',
    vuln_contact_email: SECURITY_EMAIL,
    model_number: 'OPENFRAME',
  },
  openstack: {
    github_repo: 'https://github.com/OpenDrone-hw',
    vuln_contact_email: SECURITY_EMAIL,
    model_number: 'OPENSTACK',
  },
};

async function productIdByHandle(handle) {
  const d = await admin(
    `#graphql
    query($q: String!) { products(first: 1, query: $q) { nodes { id } } }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0]?.id ?? null;
}

const MUTATION = `#graphql
  mutation Set($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key }
      userErrors { field message code }
    }
  }
`;

for (const [handle, fields] of Object.entries(DATA)) {
  const ownerId = await productIdByHandle(handle);
  if (!ownerId) {
    console.error(`✗ ${handle}: product not found`);
    continue;
  }
  const metafields = Object.entries(fields).map(([key, value]) => ({
    ownerId,
    namespace: 'custom',
    key,
    type: TYPES[key],
    value,
  }));
  const d = await admin(MUTATION, {metafields});
  const errs = d.metafieldsSet.userErrors;
  if (errs.length) {
    console.error(`✗ ${handle}: ${JSON.stringify(errs)}`);
  } else {
    console.log(`✓ ${handle}: set ${metafields.map((m) => m.key).join(', ')}`);
  }
}
console.log('\nDone. Left blank (need maintainer input / real data): safety_warnings_nl/fr/en, doc_url, sbom_url, firmware_version, batch_id, support_end_date, battery_wh, battery_un_number');
