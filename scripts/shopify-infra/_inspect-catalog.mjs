import {admin} from './_client.mjs';

const count = await admin(`#graphql
  { productsCount { count } }`);
console.log(`TOTAL products (all statuses): ${count.productsCount.count}\n`);

let after = null;
let n = 0;
console.log('=== PRODUCTS ===');
do {
  const d = await admin(
    `#graphql
    query P($after: String) {
      products(first: 100, after: $after, sortKey: TITLE) {
        nodes {
          title handle status productType vendor
          tags
          collections(first: 10) { nodes { handle } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {after},
  );
  for (const p of d.products.nodes) {
    n++;
    console.log(
      `${String(n).padStart(2)}. ${p.handle.padEnd(18)} [${p.status}] type="${p.productType || '–'}" coll=[${p.collections.nodes.map((c) => c.handle).join(', ')}] tags=[${(p.tags || []).join(', ')}]`,
    );
  }
  after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
} while (after);

const colls = await admin(`#graphql
  { collections(first: 100) { nodes { title handle ruleSet { rules { column relation condition } } productsCount { count } } } }`);
console.log('\n=== COLLECTIONS ===');
for (const c of colls.collections.nodes) {
  console.log(`${c.handle.padEnd(18)} "${c.title}" ${c.ruleSet ? 'SMART' : 'manual'} ${c.productsCount.count}p`);
}
