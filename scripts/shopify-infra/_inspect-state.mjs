import {admin} from './_client.mjs';
const handles = ['openesc', 'openfc-lite', 'openrx', 'openframe'];
for (const h of handles) {
  const d = await admin(
    `#graphql
    query P($q:String!){ products(first:1,query:$q){ nodes{
      id title handle status
      options{ id name optionValues{ id name } }
      variants(first:50){ nodes{ id sku price selectedOptions{ name value } availableForSale } }
    }}}`,
    {q: `handle:${h}`},
  );
  const p = d.products.nodes[0];
  if (!p) {
    console.log(`\n${h}: NOT FOUND`);
    continue;
  }
  console.log(`\n=== ${h} (${p.status}) ===`);
  console.log(
    '  options:',
    p.options.map((o) => `${o.name}[${o.optionValues.map((v) => v.name).join(', ')}]`).join('  '),
  );
  for (const v of p.variants.nodes) {
    console.log(
      `   - ${v.selectedOptions.map((o) => o.name + '=' + o.value).join(',')} | sku=${v.sku || '–'} price=${v.price} avail=${v.availableForSale}`,
    );
  }
}
