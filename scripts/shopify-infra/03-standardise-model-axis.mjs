/**
 * One-time migration: standardise every product line's option axis to "Model"
 * and align option values with app/lib/product-content.ts.
 *
 *   OpenESC    option  Mount → Model
 *   OpenFrame  option  Size  → Model; values 5" → 5" Freestyle, 3" → 3" Freestyle
 *   OpenFC     drop the 20×20 / 30×30 variants (Lite-only at launch; the two
 *              mount models render as "Coming soon" cards on the web ladder)
 *   OpenRX     already Model — no change
 *
 * Idempotent: each step checks current state and skips when already applied.
 * Safe to re-run. After this, scripts/02-variants.mjs reflects the same
 * contract for a from-scratch rebuild.
 */
import {admin} from './_client.mjs';

const RENAME_OPTION = [
  {handle: 'openesc', from: 'Mount', to: 'Model'},
  {handle: 'openframe', from: 'Size', to: 'Model'},
];

const RENAME_VALUES = [
  {handle: 'openframe', map: {'5"': '5" Freestyle', '3"': '3" Freestyle'}},
];

const DROP_VARIANTS = [{handle: 'openfc', values: ['20×20', '30×30']}];

async function getProduct(handle) {
  const d = await admin(
    `#graphql
    query P($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id title handle
          options { id name optionValues { id name } }
          variants(first: 50) { nodes { id selectedOptions { name value } } }
        }
      }
    }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0];
}

async function updateOption(productId, option, optionValuesToUpdate) {
  const d = await admin(
    `#graphql
    mutation OptUpd(
      $productId: ID!
      $option: OptionUpdateInput!
      $optionValuesToUpdate: [OptionValueUpdateInput!]
    ) {
      productOptionUpdate(
        productId: $productId
        option: $option
        optionValuesToUpdate: $optionValuesToUpdate
        variantStrategy: LEAVE_AS_IS
      ) {
        userErrors { field message code }
      }
    }`,
    {productId, option, optionValuesToUpdate},
  );
  const errs = d.productOptionUpdate.userErrors;
  if (errs.length) throw new Error(`option update: ${JSON.stringify(errs)}`);
}

async function deleteVariants(productId, variantsIds) {
  const d = await admin(
    `#graphql
    mutation Del($productId: ID!, $variantsIds: [ID!]!) {
      productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
        userErrors { field message }
      }
    }`,
    {productId, variantsIds},
  );
  const errs = d.productVariantsBulkDelete.userErrors;
  if (errs.length) throw new Error(`variant delete: ${JSON.stringify(errs)}`);
}

// --- Rename option axis (+ values) -----------------------------------------
for (const {handle, from, to} of RENAME_OPTION) {
  console.log(`=== ${handle}: option "${from}" → "${to}" ===`);
  const p = await getProduct(handle);
  if (!p) {
    console.error(`  ✗ not found`);
    continue;
  }
  let opt = p.options.find((o) => o.name === from);
  if (!opt) {
    if (p.options.some((o) => o.name === to)) {
      console.log(`  • already "${to}" — skipping`);
    } else {
      console.error(`  ✗ neither "${from}" nor "${to}" present (${p.options.map((o) => o.name).join(', ')})`);
    }
    continue;
  }

  const valueMap = RENAME_VALUES.find((r) => r.handle === handle)?.map ?? {};
  const optionValuesToUpdate = opt.optionValues
    .filter((v) => valueMap[v.name])
    .map((v) => ({id: v.id, name: valueMap[v.name]}));

  await updateOption(p.id, {id: opt.id, name: to}, optionValuesToUpdate);
  console.log(
    `  ✓ renamed option → "${to}"` +
      (optionValuesToUpdate.length
        ? ` + ${optionValuesToUpdate.length} value(s): ${optionValuesToUpdate
            .map((v) => v.name)
            .join(', ')}`
        : ''),
  );
}

// --- Drop launch-deferred variants -----------------------------------------
for (const {handle, values} of DROP_VARIANTS) {
  console.log(`=== ${handle}: drop variants ${values.join(', ')} ===`);
  const p = await getProduct(handle);
  if (!p) {
    console.error(`  ✗ not found`);
    continue;
  }
  const toDelete = p.variants.nodes.filter((vn) =>
    vn.selectedOptions.some((so) => values.includes(so.value)),
  );
  if (!toDelete.length) {
    console.log(`  • none present — skipping`);
    continue;
  }
  await deleteVariants(
    p.id,
    toDelete.map((v) => v.id),
  );
  console.log(`  ✓ deleted ${toDelete.length} variant(s)`);
}

console.log('\nDone standardising the Model axis.');
