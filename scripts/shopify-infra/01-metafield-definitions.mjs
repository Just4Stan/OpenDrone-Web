/**
 * Creates the 15 GPSR/CRA product metafield definitions in the `custom`
 * namespace that app/routes/products.$handle.tsx queries and
 * app/components/ProductCompliance.tsx renders. Types are chosen to match the
 * renderer's expectations. Each is granted PUBLIC_READ storefront access so
 * the Hydrogen Storefront API can actually read the values (a definition
 * without storefront access returns null to the storefront).
 *
 * Idempotent: re-running skips definitions that already exist (TAKEN).
 */
import {admin} from './_client.mjs';

const DEFS = [
  ['safety_warnings_nl', 'Safety warnings (NL)', 'multi_line_text_field'],
  ['safety_warnings_fr', 'Safety warnings (FR)', 'multi_line_text_field'],
  ['safety_warnings_en', 'Safety warnings (EN)', 'multi_line_text_field'],
  ['datasheet_url', 'Datasheet URL', 'url'],
  ['manual_url', 'User manual URL', 'url'],
  ['doc_url', 'Declaration of Conformity URL', 'url'],
  ['sbom_url', 'SBOM URL', 'url'],
  ['github_repo', 'GitHub repository', 'url'],
  ['model_number', 'Model number', 'single_line_text_field'],
  ['batch_id', 'Batch ID', 'single_line_text_field'],
  ['firmware_version', 'Firmware version', 'single_line_text_field'],
  ['support_end_date', 'Security support end date', 'date'],
  ['vuln_contact_email', 'Security contact email', 'single_line_text_field'],
  ['battery_wh', 'Battery energy (Wh)', 'number_decimal'],
  ['battery_un_number', 'Battery UN number', 'single_line_text_field'],
];

const MUTATION = `#graphql
  mutation CreateDef($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id key }
      userErrors { field message code }
    }
  }
`;

let created = 0;
let skipped = 0;
for (const [key, name, type] of DEFS) {
  const data = await admin(MUTATION, {
    definition: {
      name,
      namespace: 'custom',
      key,
      type,
      ownerType: 'PRODUCT',
      access: {storefront: 'PUBLIC_READ'},
      pin: true,
    },
  });
  const {createdDefinition, userErrors} = data.metafieldDefinitionCreate;
  if (createdDefinition) {
    created++;
    console.log(`✓ created custom.${key} (${type})`);
  } else if (userErrors.some((e) => e.code === 'TAKEN')) {
    skipped++;
    console.log(`• custom.${key} already exists — skipped`);
  } else {
    console.error(`✗ custom.${key} FAILED: ${JSON.stringify(userErrors)}`);
  }
}
console.log(`\nDone. created=${created} skipped=${skipped} total=${DEFS.length}`);
