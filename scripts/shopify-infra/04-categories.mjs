/**
 * Assigns a Shopify `productType` to each core board so the catalog can be
 * browsed by category. The web browse page (/collections/all) groups products
 * by these exact strings — keep them in sync with CATEGORY_ORDER in
 * app/routes/collections.all.tsx.
 *
 *   openfc    → Flight Controller
 *   openesc   → ESC
 *   openrx    → Receiver
 *   openframe → Frame
 *   openstack → Bundle
 *
 * Accessories get productType "Accessory" in 05-accessories.mjs.
 * Idempotent: productUpdate is a no-op when the type already matches.
 */
import {admin} from './_client.mjs';

const TYPES = {
  openfc: 'Flight Controller',
  openesc: 'ESC',
  openrx: 'Receiver',
  openframe: 'Frame',
  openstack: 'Bundle',
};

async function getProduct(handle) {
  const d = await admin(
    `#graphql
    query P($q: String!) {
      products(first: 1, query: $q) { nodes { id handle productType } }
    }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0];
}

async function setType(productId, productType) {
  const d = await admin(
    `#graphql
    mutation U($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id productType }
        userErrors { field message }
      }
    }`,
    {product: {id: productId, productType}},
  );
  const errs = d.productUpdate.userErrors;
  if (errs.length) throw new Error(`productUpdate: ${JSON.stringify(errs)}`);
}

for (const [handle, productType] of Object.entries(TYPES)) {
  const p = await getProduct(handle);
  if (!p) {
    console.error(`✗ ${handle}: not found`);
    continue;
  }
  if (p.productType === productType) {
    console.log(`• ${handle}: already "${productType}"`);
    continue;
  }
  await setType(p.id, productType);
  console.log(`✓ ${handle}: productType → "${productType}"`);
}

console.log('\nDone assigning categories.');
