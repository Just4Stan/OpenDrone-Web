/**
 * Read-only inspection: confirms the Admin token works and dumps the current
 * catalog (products, options, variants) + product metafield definitions so we
 * know the starting state before mutating anything. Safe to run anytime.
 */
import {admin, SHOP, VERSION} from './_client.mjs';

const data = await admin(`#graphql
  query Inspect {
    shop { name myshopifyDomain }
    products(first: 50) {
      nodes {
        id
        title
        handle
        status
        options { name optionValues { name } }
        variants(first: 50) {
          nodes { id title sku price inventoryQuantity selectedOptions { name value } }
        }
      }
    }
    metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: "custom") {
      nodes { key name type { name } }
    }
  }
`);

console.log(`Shop: ${data.shop.name} (${data.shop.myshopifyDomain}) — API ${VERSION}`);
console.log(`\n=== PRODUCTS (${data.products.nodes.length}) ===`);
for (const p of data.products.nodes) {
  const opt = p.options.map((o) => `${o.name}[${o.optionValues.map((v) => v.name).join('/')}]`).join(', ') || '(none)';
  console.log(`\n• ${p.title}  handle=${p.handle}  status=${p.status}`);
  console.log(`  id=${p.id}`);
  console.log(`  options: ${opt}`);
  for (const v of p.variants.nodes) {
    console.log(`    - ${v.title} | sku=${v.sku || '-'} | €${v.price} | qty=${v.inventoryQuantity} | ${v.id}`);
  }
}
console.log(`\n=== custom.* PRODUCT METAFIELD DEFINITIONS (${data.metafieldDefinitions.nodes.length}) ===`);
for (const d of data.metafieldDefinitions.nodes) {
  console.log(`  custom.${d.key}  (${d.type.name})  "${d.name}"`);
}
