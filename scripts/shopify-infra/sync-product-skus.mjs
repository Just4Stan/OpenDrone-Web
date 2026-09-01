#!/usr/bin/env node
/** Preview or apply Shopify variant SKUs from stock/product_skus.json. */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {admin, assertNoUserErrors} from './_client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, '../../../../stock/product_skus.json');
const products = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).products;
const apply = process.argv.includes('--apply');

const byHandle = new Map();
for (const product of products) {
  const {handle, model} = product.shopify ?? {};
  if (!handle || !model) throw new Error(`${product.sku}: missing Shopify mapping`);
  const entries = byHandle.get(handle) ?? [];
  entries.push({model, sku: product.sku});
  byHandle.set(handle, entries);
}

let changed = 0;
for (const [handle, expected] of byHandle) {
  const data = await admin(
    `#graphql
    query ProductSkuState($query: String!) {
      products(first: 1, query: $query) {
        nodes {
          id
          variants(first: 100) {
            nodes { id sku selectedOptions { name value } }
          }
        }
      }
    }`,
    {query: `handle:${handle}`},
  );
  const product = data.products.nodes[0];
  if (!product) throw new Error(`Shopify product not found: ${handle}`);
  const variants = new Map(
    product.variants.nodes.map((variant) => [
      variant.selectedOptions.find((option) => option.name === 'Model')?.value,
      variant,
    ]),
  );
  if (variants.size !== expected.length) {
    throw new Error(`${handle}: expected ${expected.length} Model variants, found ${variants.size}`);
  }

  const updates = [];
  for (const item of expected) {
    const variant = variants.get(item.model);
    if (!variant) throw new Error(`${handle}: missing Model=${item.model}`);
    if (variant.sku !== item.sku) {
      console.log(`${apply ? 'APPLY' : 'PREVIEW'}: ${handle} ${item.model}: ${variant.sku} -> ${item.sku}`);
      updates.push({id: variant.id, inventoryItem: {sku: item.sku}});
      changed++;
    }
  }
  if (apply && updates.length) {
    const result = await admin(
      `#graphql
      mutation UpdateProductSkus($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id sku }
          userErrors { field message }
        }
      }`,
      {productId: product.id, variants: updates},
    );
    assertNoUserErrors('productVariantsBulkUpdate', result.productVariantsBulkUpdate);
  }
}

if (changed === 0) {
  console.log('OK: Shopify variant SKUs already match product_skus.json.');
} else if (apply) {
  console.log(`OK: updated ${changed} Shopify variant SKU${changed === 1 ? '' : 's'}.`);
} else {
  console.log(`PREVIEW: ${changed} change${changed === 1 ? '' : 's'}; rerun with --apply to write.`);
}
