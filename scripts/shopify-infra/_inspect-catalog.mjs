import {admin} from './_client.mjs';

const prods = await admin(`#graphql
  { products(first: 50) { nodes {
      title handle status productType vendor
      tags
      collections(first: 10) { nodes { title handle } }
  } } }`);
console.log('=== PRODUCTS ===');
for (const p of prods.products.nodes) {
  console.log(
    `${p.handle.padEnd(12)} | type="${p.productType || '–'}" | collections=[${p.collections.nodes
      .map((c) => c.handle)
      .join(', ')}] | tags=[${(p.tags || []).join(', ')}]`,
  );
}

const colls = await admin(`#graphql
  { collections(first: 50) { nodes {
      title handle id
      ruleSet { appliedDisjunctively rules { column relation condition } }
      productsCount { count }
  } } }`);
console.log('\n=== COLLECTIONS ===');
for (const c of colls.collections.nodes) {
  const kind = c.ruleSet ? 'SMART' : 'manual';
  console.log(`${c.handle.padEnd(16)} | "${c.title}" | ${kind} | ${c.productsCount.count} products`);
  if (c.ruleSet) {
    for (const r of c.ruleSet.rules) console.log(`     rule: ${r.column} ${r.relation} "${r.condition}"`);
  }
}
