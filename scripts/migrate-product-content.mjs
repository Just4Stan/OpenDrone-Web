/**
 * Write `app/lib/product-content.ts`'s in-memory data back out to
 * `content/products/<handle>.json`, one file per Shopify handle, plus
 * `_fallback.json` for PRODUCT_CONTENT_FALLBACK.
 *
 * Originally a one-shot migration off the hand-written TypeScript literal.
 * It stays because it is idempotent: the module now LOADS those same files,
 * so re-running normalises formatting (two-space indent, trailing newline,
 * stable key order) without changing a single value. Run it after editing a
 * file by hand:
 *
 *   npm run studio:products
 *
 * Run with `node --experimental-strip-types`: it imports the .ts directly, the
 * same way the node:test suites do.
 */

import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  PRODUCT_CONTENT,
  PRODUCT_CONTENT_FALLBACK,
} from '../app/lib/product-content.ts';

const OUT_DIR = new URL('../content/products/', import.meta.url);

/** Two-space indent, trailing newline, matching `content/copy/*.json`. */
function write(name, value) {
  const file = new URL(`${name}.json`, OUT_DIR);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return fileURLToPath(file);
}

mkdirSync(OUT_DIR, {recursive: true});

const written = [];
for (const [handle, content] of Object.entries(PRODUCT_CONTENT)) {
  if (!handle || handle.startsWith('_')) {
    throw new Error(`Refusing to write reserved/empty handle: "${handle}"`);
  }
  written.push(write(handle, content));
}
written.push(write('_fallback', PRODUCT_CONTENT_FALLBACK));

for (const file of written) {
  // eslint-disable-next-line no-console
  console.log(file);
}
