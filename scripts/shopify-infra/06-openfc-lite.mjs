/**
 * Create the "OpenFC Lite" product — the shipping cost-down FC line, in two
 * mount sizes (Lite Mini 20×20, Lite 30×30). The full OpenFC / OpenFC Mini
 * stay on the existing `openfc` product as coming-soon.
 *
 * Created as DRAFT with PLACEHOLDER price/SKU — Stan sets the real values in
 * admin before activating. Idempotent: skips creation if the handle exists,
 * always re-applies the option + price/sku/stock.
 *
 *   Model: Lite Mini  -> /boards/openfc-lite-mini/board.svg
 *   Model: Lite       -> /boards/openfc-lite/board.svg
 */
import {admin} from './_client.mjs';

const HANDLE = 'openfc-lite';
const OPTION = 'Model';
const VARIANTS = [
  {value: 'Lite Mini', price: '45.00', sku: 'OPENFC-LITE-MINI'},
  {value: 'Lite', price: '49.00', sku: 'OPENFC-LITE-3030'},
];
const STOCK = 100;

async function getProduct(handle) {
  const d = await admin(
    `#graphql
    query P($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id title handle status
          options { name optionValues { name } }
          variants(first: 50) {
            nodes { id title sku selectedOptions { name value } inventoryItem { id } }
          }
        }
      }
    }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0];
}

async function createProduct() {
  const d = await admin(
    `#graphql
    mutation Create($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id handle status }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title: 'OpenFC Lite',
        handle: HANDLE,
        productType: 'Flight Controller',
        vendor: 'OpenDrone',
        status: 'DRAFT',
      },
    },
  );
  const errs = d.productCreate.userErrors;
  if (errs.length) throw new Error(`productCreate: ${JSON.stringify(errs)}`);
  return d.productCreate.product;
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

// Remove the leftover "Default Title" variant productCreate seeds, once the
// real Model variants exist (it has no Model option value).
async function deleteVariants(productId, ids) {
  if (!ids.length) return;
  const d = await admin(
    `#graphql
    mutation Del($productId: ID!, $ids: [ID!]!) {
      productVariantsBulkDelete(productId: $productId, variantsIds: $ids) {
        userErrors { field message }
      }
    }`,
    {productId, ids},
  );
  const errs = d.productVariantsBulkDelete.userErrors;
  if (errs.length) throw new Error(`variant delete: ${JSON.stringify(errs)}`);
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

async function getLocationId() {
  const d = await admin(`#graphql
    { locations(first: 1) { nodes { id } } }`);
  return d.locations.nodes[0]?.id ?? null;
}

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
  // Already-active is fine.
  const errs = d.inventoryActivate.userErrors.filter((e) => !/already/i.test(e.message));
  if (errs.length) throw new Error(`stock item: ${JSON.stringify(errs)}`);
}

async function setQuantities(locationId, items, qty) {
  const d = await admin(
    `#graphql
    mutation Set($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) { userErrors { field message } }
    }`,
    {
      input: {
        name: 'available',
        reason: 'correction',
        ignoreCompareQuantity: true,
        quantities: items.map((id) => ({inventoryItemId: id, locationId, quantity: qty})),
      },
    },
  );
  const errs = d.inventorySetQuantities.userErrors;
  if (errs.length) throw new Error(`set quantities: ${JSON.stringify(errs)}`);
}

// ---- run ----
let product = await getProduct(HANDLE);
if (product) {
  console.log(`• ${HANDLE} exists (${product.status}) — updating in place`);
} else {
  product = await createProduct();
  console.log(`✓ created ${HANDLE} (${product.status})`);
}

const hasOption = (product.options ?? []).some((o) => o.name === OPTION);
if (hasOption) {
  console.log(`• option "${OPTION}" already present`);
} else {
  await createOption(product.id, OPTION, VARIANTS.map((v) => v.value));
  console.log(`✓ created option "${OPTION}" with ${VARIANTS.length} values`);
}

product = await getProduct(HANDLE);

// Drop any seed variant that has no Model value (the "Default Title" one).
const orphans = product.variants.nodes
  .filter((vn) => !vn.selectedOptions.some((so) => so.name === OPTION))
  .map((vn) => vn.id);
if (orphans.length) {
  await deleteVariants(product.id, orphans);
  console.log(`✓ removed ${orphans.length} seed variant(s)`);
  product = await getProduct(HANDLE);
}

const updates = [];
const invItems = [];
for (const planV of VARIANTS) {
  const match = product.variants.nodes.find((vn) =>
    vn.selectedOptions.some((so) => so.name === OPTION && so.value === planV.value),
  );
  if (!match) {
    console.error(`  ✗ no variant for ${OPTION}=${planV.value}`);
    continue;
  }
  updates.push({id: match.id, price: planV.price, inventoryItem: {sku: planV.sku, tracked: true}});
  if (match.inventoryItem?.id) invItems.push(match.inventoryItem.id);
}
await bulkUpdate(product.id, updates);
console.log(`✓ set price + sku on ${updates.length} variant(s) (PLACEHOLDER)`);

const locationId = await getLocationId();
if (locationId && invItems.length) {
  for (const id of invItems) await stockItem(id, locationId);
  await setQuantities(locationId, invItems, STOCK);
  console.log(`✓ stocked ${invItems.length} variant(s) @ ${STOCK}`);
}

const final = await getProduct(HANDLE);
console.log(`\nDONE — ${final.handle} [${final.status}]`);
for (const v of final.variants.nodes) {
  const val = v.selectedOptions.map((s) => `${s.name}:${s.value}`).join(',');
  console.log(`  • ${val}  sku=${v.sku || '—'}`);
}
