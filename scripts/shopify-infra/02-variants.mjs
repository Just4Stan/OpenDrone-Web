/**
 * Builds the variant axis for each product line (placeholder price + SKU,
 * 100 in stock). Option NAME / VALUE strings match the naming contract in
 * app/lib/product-content.ts exactly (incl. the × glyph U+00D7 and the "
 * inch mark) so the comparison ladder wires each card to a real variant.
 *
 * Axis NAME is standardised to "Model" across every line.
 *
 *   OpenESC   Model: 20×20 / 30×30                 (Pro variants land later)
 *   OpenFC    Model: Lite                          (Lite = former OpenFC-ECO;
 *                                                    20×20 / 30×30 designed but
 *                                                    not in the launch batch)
 *   OpenRX    Model: Lite / Lite-UFL / Mono / Gemini
 *   OpenFrame Model: 5" Freestyle / 3" Freestyle
 *   OpenStack Model: 20×20 / 30×30                 (FC-Lite + ESC bundle; each
 *                                                    size pairs the matching FC
 *                                                    and ESC mount. Add the
 *                                                    values so the size ladder
 *                                                    wires to real variants —
 *                                                    until then it previews and
 *                                                    cart uses the default)
 *
 * Prices/SKUs are placeholders for the maintainer to replace. Idempotent: skips option
 * creation if the option already exists, and always re-applies price/sku/stock.
 */
import {admin} from './_client.mjs';

const PLAN = [
  {
    handle: 'openesc',
    option: 'Model',
    variants: [
      {value: '20×20', price: '69.00', sku: 'OPENESC-2020'},
      {value: '30×30', price: '75.00', sku: 'OPENESC-3030'},
    ],
  },
  {
    handle: 'openfc',
    option: 'Model',
    variants: [
      {value: 'Lite', price: '45.00', sku: 'OPENFC-LITE'},
      // Designed, not in the launch batch — surfaced on the web ladder as
      // greyed "Coming soon" cards (see app/lib/product-content.ts). Restore
      // here when the boards ship.
      // {value: '20×20', price: '55.00', sku: 'OPENFC-2020'},
      // {value: '30×30', price: '59.00', sku: 'OPENFC-3030'},
    ],
  },
  {
    handle: 'openrx',
    option: 'Model',
    variants: [
      {value: 'Lite', price: '22.00', sku: 'OPENRX-LITE'},
      {value: 'Lite-UFL', price: '25.00', sku: 'OPENRX-LITE-UFL'},
      {value: 'Mono', price: '32.00', sku: 'OPENRX-MONO'},
      {value: 'Gemini', price: '39.00', sku: 'OPENRX-GEMINI'},
    ],
  },
  {
    handle: 'openframe',
    option: 'Model',
    variants: [
      {value: '5" Freestyle', price: '41.00', sku: ''},
      {value: '3" Freestyle', price: '35.00', sku: 'OPENFRAME-3'},
    ],
  },
];

async function getLocationId() {
  try {
    const d = await admin(`#graphql
      { locations(first: 1) { nodes { id name } } }`);
    return d.locations.nodes[0]?.id ?? null;
  } catch (e) {
    console.warn(`  ! cannot read locations (${e.message.slice(0, 60)}…) — inventory step will be skipped`);
    return null;
  }
}

async function getProduct(handle) {
  const d = await admin(
    `#graphql
    query P($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id title handle
          options { name optionValues { name } }
          variants(first: 50) {
            nodes { id inventoryItem { id } selectedOptions { name value } }
          }
        }
      }
    }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0];
}

async function createOption(productId, name, values) {
  const d = await admin(
    `#graphql
    mutation Opt($productId: ID!, $options: [OptionCreateInput!]!) {
      productOptionsCreate(productId: $productId, options: $options, variantStrategy: CREATE) {
        userErrors { field message code }
      }
    }`,
    {productId, options: [{name, values: values.map((v) => ({name: v}))}]},
  );
  const errs = d.productOptionsCreate.userErrors;
  if (errs.length) throw new Error(`option create: ${JSON.stringify(errs)}`);
}

async function bulkUpdate(productId, variants) {
  const d = await admin(
    `#graphql
    mutation BU($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message code }
      }
    }`,
    {productId, variants},
  );
  const errs = d.productVariantsBulkUpdate.userErrors;
  if (errs.length) throw new Error(`bulk update: ${JSON.stringify(errs)}`);
}

// Ensure the inventory item is stocked at the location (no-op if already
// active — note: passing `available` to an already-active item errors, so we
// stock first, then set quantity separately).
async function stockItem(inventoryItemId, locationId) {
  const d = await admin(
    `#graphql
    mutation Act($inventoryItemId: ID!, $locationId: ID!) {
      inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) {
        userErrors { field message }
      }
    }`,
    {inventoryItemId, locationId},
  );
  const errs = d.inventoryActivate.userErrors;
  if (errs.length) throw new Error(`stock item: ${JSON.stringify(errs)}`);
}

// Set absolute available quantity for a batch of items at one location.
async function setQuantities(locationId, items, qty) {
  const d = await admin(
    `#graphql
    mutation Set($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        name: 'available',
        reason: 'correction',
        ignoreCompareQuantity: true,
        quantities: items.map((id) => ({
          inventoryItemId: id,
          locationId,
          quantity: qty,
        })),
      },
    },
  );
  const errs = d.inventorySetQuantities.userErrors;
  if (errs.length) throw new Error(`set quantities: ${JSON.stringify(errs)}`);
}

const locationId = await getLocationId();
console.log(`Location: ${locationId}\n`);

for (const line of PLAN) {
  console.log(`=== ${line.handle} — option "${line.option}" ===`);
  let product = await getProduct(line.handle);
  if (!product) {
    console.error(`  ✗ product not found, skipping`);
    continue;
  }

  const hasOption = product.options.some((o) => o.name === line.option);
  if (hasOption) {
    console.log(`  • option "${line.option}" already present — skipping creation`);
  } else {
    await createOption(product.id, line.option, line.variants.map((v) => v.value));
    console.log(`  ✓ created option "${line.option}" with ${line.variants.length} values`);
  }

  // Re-fetch to get the (possibly newly created) variants + inventory items.
  product = await getProduct(line.handle);

  const updates = [];
  const invOps = [];
  for (const planV of line.variants) {
    const match = product.variants.nodes.find((vn) =>
      vn.selectedOptions.some(
        (so) => so.name === line.option && so.value === planV.value,
      ),
    );
    if (!match) {
      console.error(`  ✗ no variant for ${line.option}=${planV.value}`);
      continue;
    }
    updates.push({
      id: match.id,
      price: planV.price,
      inventoryItem: {sku: planV.sku, tracked: true},
    });
    invOps.push({inventoryItemId: match.inventoryItem.id, value: planV.value});
  }

  if (updates.length) {
    await bulkUpdate(product.id, updates);
    console.log(`  ✓ set price + SKU + tracked on ${updates.length} variants`);
  }
  if (locationId) {
    const itemIds = invOps.map((op) => op.inventoryItemId);
    for (const id of itemIds) await stockItem(id, locationId);
    await setQuantities(locationId, itemIds, 100);
    console.log(`  ✓ set 100 available on ${itemIds.length} variants`);
  } else {
    console.log(`  ⏭ inventory skipped (no read_locations/inventory scope yet)`);
  }
}

console.log('\nDone building variants.');
