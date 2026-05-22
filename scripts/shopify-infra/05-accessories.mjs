/**
 * Creates the launch set of accessory products (productType "Accessory", so
 * they group under "Accessories" on the web browse page). Prices/SKUs are
 * placeholders for Stan to replace; 100 in stock. New products are PUBLISHED
 * to every publication — Admin-API-created products are invisible to the
 * Storefront API (and so to the site) until published.
 *
 * Idempotent: matches by handle; skips creation if present and always
 * re-applies price/SKU/stock + (re)publishes. Add more accessories by
 * appending to ACCESSORIES.
 *
 * Single-variant entries omit `option`. Multi-variant entries set `option`
 * (the axis name) and one `variants[]` row per value.
 */
import {admin} from './_client.mjs';

const ACCESSORIES = [
  {
    handle: 'battery-strap',
    title: 'OpenDrone Battery Strap',
    description:
      'Hook-and-loop LiPo strap with a silicone anti-slip face, sized for 4–6S packs on the OpenFrame deck. Placeholder listing — final spec, length and pricing TBD.',
    variants: [{price: '4.50', sku: 'ACC-STRAP-001'}],
  },
  {
    handle: 'elrs-antenna-24',
    title: 'ELRS 2.4 GHz Antenna',
    description:
      '2.4 GHz replacement antenna for ExpressLRS receivers (OpenRX) and the OpenFC break-off RX. Placeholder listing — final spec and pricing TBD.',
    option: 'Type',
    variants: [
      {value: 'U.FL Dipole', price: '6.00', sku: 'ACC-ANT-UFL'},
      {value: 'T-style', price: '7.00', sku: 'ACC-ANT-T'},
    ],
  },
  {
    handle: 'openframe-spares',
    title: 'OpenFrame Spare Parts',
    description:
      'Replacement CNC carbon parts and hardware for the OpenFrame 5". Placeholder listing — final spec and pricing TBD.',
    option: 'Part',
    variants: [
      {value: 'Arms (set of 4)', price: '24.00', sku: 'ACC-FRM-ARMS'},
      {value: 'Top plate', price: '12.00', sku: 'ACC-FRM-TOP'},
      {value: 'Bottom plate', price: '12.00', sku: 'ACC-FRM-BOT'},
      {value: 'Hardware kit', price: '8.00', sku: 'ACC-FRM-HW'},
    ],
  },
  {
    handle: 'hardware-kit',
    title: 'OpenDrone Hardware Kit',
    description:
      'Soft-mount and fastener hardware used across the OpenDrone stack. Placeholder listing — final spec and pricing TBD.',
    option: 'Kit',
    variants: [
      {value: 'M3 soft-mount grommets (×4)', price: '3.00', sku: 'ACC-HW-GROMMET'},
      {value: 'Standoff + bolt kit', price: '5.00', sku: 'ACC-HW-STANDOFF'},
    ],
  },
];

const VARIANT_FIELDS = `id selectedOptions { name value } inventoryItem { id }`;

async function getLocationId() {
  const d = await admin(`#graphql
    { locations(first: 1) { nodes { id } } }`);
  return d.locations.nodes[0]?.id ?? null;
}

async function getPublicationIds() {
  // Needs read_publications scope. The "OpenDrone Infra" app may not have it
  // — degrade gracefully so product creation still runs; publishing is then
  // a manual step (or add read/write_publications to the app and re-run).
  try {
    const d = await admin(`#graphql
      { publications(first: 25) { nodes { id name } } }`);
    return d.publications.nodes;
  } catch (e) {
    console.warn(
      `  ! cannot read publications (${e.message.slice(0, 80)}…) — skipping publish step`,
    );
    return [];
  }
}

async function getProduct(handle) {
  const d = await admin(
    `#graphql
    query P($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id handle
          options { name }
          variants(first: 50) { nodes { ${VARIANT_FIELDS} } }
        }
      }
    }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0];
}

// productCreate makes the product + a single default variant. The multi-value
// option (and its per-value variants) is added afterwards via
// productOptionsCreate(variantStrategy: CREATE) — inline productOptions on
// productCreate only yields one variant on this API version.
async function createProduct(acc) {
  const d = await admin(
    `#graphql
    mutation Create($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id handle
          options { name }
          variants(first: 50) { nodes { ${VARIANT_FIELDS} } }
        }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title: acc.title,
        handle: acc.handle,
        descriptionHtml: acc.description,
        productType: 'Accessory',
        vendor: 'OpenDrone',
        status: 'ACTIVE',
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

async function bulkUpdate(productId, variants) {
  const d = await admin(
    `#graphql
    mutation BU($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,
    {productId, variants},
  );
  const errs = d.productVariantsBulkUpdate.userErrors;
  if (errs.length) throw new Error(`bulkUpdate: ${JSON.stringify(errs)}`);
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
  const errs = d.inventoryActivate.userErrors;
  if (errs.length) throw new Error(`stockItem: ${JSON.stringify(errs)}`);
}

async function setQuantities(locationId, itemIds, qty) {
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
        quantities: itemIds.map((id) => ({
          inventoryItemId: id,
          locationId,
          quantity: qty,
        })),
      },
    },
  );
  const errs = d.inventorySetQuantities.userErrors;
  if (errs.length) throw new Error(`setQuantities: ${JSON.stringify(errs)}`);
}

async function publish(productId, publicationIds) {
  const d = await admin(
    `#graphql
    mutation Pub($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`,
    {id: productId, input: publicationIds.map((publicationId) => ({publicationId}))},
  );
  const errs = d.publishablePublish.userErrors;
  if (errs.length) throw new Error(`publish: ${JSON.stringify(errs)}`);
}

const locationId = await getLocationId();
const pubs = await getPublicationIds();
console.log(`Location: ${locationId}`);
console.log(`Publications: ${pubs.map((p) => p.name).join(', ')}\n`);

for (const acc of ACCESSORIES) {
  console.log(`=== ${acc.handle} ===`);
  let product = await getProduct(acc.handle);
  if (product) {
    console.log(`  • exists — re-applying price/SKU/stock + publish`);
  } else {
    product = await createProduct(acc);
    console.log(`  ✓ created product`);
  }

  // Add the option + per-value variants if missing (idempotent: skip when the
  // option already exists). Then re-fetch so we see every variant.
  if (acc.option && !product.options.some((o) => o.name === acc.option)) {
    await createOption(product.id, acc.option, acc.variants.map((v) => v.value));
    console.log(`  ✓ option "${acc.option}" + ${acc.variants.length} variants`);
    product = await getProduct(acc.handle);
  }

  // Match each plan row to a live variant. Single-variant products have one
  // node (Title=Default Title); multi-variant match on the option value.
  const updates = [];
  const itemIds = [];
  for (const planV of acc.variants) {
    const match = acc.option
      ? product.variants.nodes.find((vn) =>
          vn.selectedOptions.some((so) => so.value === planV.value),
        )
      : product.variants.nodes[0];
    if (!match) {
      console.error(`  ✗ no variant for ${acc.option}=${planV.value}`);
      continue;
    }
    updates.push({
      id: match.id,
      price: planV.price,
      inventoryItem: {sku: planV.sku, tracked: true},
    });
    itemIds.push(match.inventoryItem.id);
  }

  if (updates.length) {
    await bulkUpdate(product.id, updates);
    console.log(`  ✓ price + SKU on ${updates.length} variant(s)`);
  }
  if (locationId && itemIds.length) {
    for (const id of itemIds) await stockItem(id, locationId);
    await setQuantities(locationId, itemIds, 100);
    console.log(`  ✓ 100 in stock on ${itemIds.length} variant(s)`);
  }
  if (pubs.length) {
    await publish(product.id, pubs.map((p) => p.id));
    console.log(`  ✓ published to ${pubs.length} channel(s)`);
  }
}

console.log('\nDone creating accessories.');
