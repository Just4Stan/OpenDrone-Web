import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const domain = env.PUBLIC_STORE_DOMAIN;
const token = env.PUBLIC_STOREFRONT_API_TOKEN;
const ver = env.PUBLIC_STOREFRONT_API_VERSION || '2025-01';
const res = await fetch(`https://${domain}/api/${ver}/graphql.json`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token},
  body: JSON.stringify({query: `{ products(first: 50) { nodes { handle productType } } }`}),
});
const j = await res.json();
if (j.errors) { console.error('Storefront errors:', JSON.stringify(j.errors)); process.exit(1); }
const nodes = j.data.products.nodes;
console.log(`Storefront API (${ver}) sees ${nodes.length} products:`);
for (const n of nodes) console.log(`  ${n.handle.padEnd(18)} type="${n.productType||'–'}"`);
