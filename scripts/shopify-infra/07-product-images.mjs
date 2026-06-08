/**
 * Replace product imagery with the current board renders from the hardware
 * repos, and wire each render to its matching Model variant.
 *
 * Source of truth = the five hardware repos under ~/OpenDrone:
 *   openesc      ← 4in1-mini (20×20) + 4in1 (30×30)        [replaces old screenshots]
 *   openfc-lite  ← OpenFC-Lite-Mini (Lite Mini) + OpenFC-Lite (Lite)  [was empty]
 *   openrx       ← OpenRX Lite / Lite-UFL / Mono / Gemini  [replaces old screenshots]
 *
 * The old full `openfc` product is intentionally left untouched (no repo for it).
 *
 * Idempotent: deletes ALL existing media on each target product, then re-uploads
 * the repo set, so a re-run always converges to exactly these images. Filenames
 * and alt text use the lite naming. Run from repo root:
 *   node scripts/shopify-infra/07-product-images.mjs
 */
import fs from 'node:fs';
import {admin, assertNoUserErrors} from './_client.mjs';

const REPOS = '/Users/stan/OpenDrone';

// handle -> {replace, images:[{file, name, alt, variant}]}
const PLAN = {
  openesc: {
    replace: true,
    images: [
      {file: `${REPOS}/4in1-mini/images/front.png`, name: 'openesc-20x20-front.png', alt: 'OpenESC 20×20 — front', variant: '20×20'},
      {file: `${REPOS}/4in1-mini/images/back.png`,  name: 'openesc-20x20-back.png',  alt: 'OpenESC 20×20 — back',  variant: '20×20'},
      {file: `${REPOS}/4in1/images/front.png`,      name: 'openesc-30x30-front.png', alt: 'OpenESC 30×30 — front', variant: '30×30'},
      {file: `${REPOS}/4in1/images/back.png`,       name: 'openesc-30x30-back.png',  alt: 'OpenESC 30×30 — back',  variant: '30×30'},
    ],
  },
  'openfc-lite': {
    replace: true,
    images: [
      {file: `${REPOS}/OpenFC-Lite-Mini/images/openfc-lite-mini-rev2-top.png`,    name: 'openfc-lite-mini-top.png',    alt: 'OpenFC Lite Mini — top',    variant: 'Lite Mini'},
      {file: `${REPOS}/OpenFC-Lite-Mini/images/openfc-lite-mini-rev2-bottom.png`, name: 'openfc-lite-mini-bottom.png', alt: 'OpenFC Lite Mini — bottom', variant: 'Lite Mini'},
      {file: `${REPOS}/OpenFC-Lite/images/openfc-lite-rev2-top.png`,              name: 'openfc-lite-top.png',         alt: 'OpenFC Lite — top',         variant: 'Lite'},
      {file: `${REPOS}/OpenFC-Lite/images/openfc-lite-rev2-bottom.png`,           name: 'openfc-lite-bottom.png',      alt: 'OpenFC Lite — bottom',      variant: 'Lite'},
    ],
  },
  openrx: {
    replace: true,
    images: [
      {file: `${REPOS}/OpenRX/images/openrx-lite-front.png`,     name: 'openrx-lite-front.png',     alt: 'OpenRX Lite — front',     variant: 'Lite'},
      {file: `${REPOS}/OpenRX/images/openrx-lite-back.png`,      name: 'openrx-lite-back.png',      alt: 'OpenRX Lite — back',      variant: 'Lite'},
      {file: `${REPOS}/OpenRX/images/openrx-lite-ufl-front.png`, name: 'openrx-lite-ufl-front.png', alt: 'OpenRX Lite-UFL — front', variant: 'Lite-UFL'},
      {file: `${REPOS}/OpenRX/images/openrx-lite-ufl-back.png`,  name: 'openrx-lite-ufl-back.png',  alt: 'OpenRX Lite-UFL — back',  variant: 'Lite-UFL'},
      {file: `${REPOS}/OpenRX/images/openrx-mono-front.png`,     name: 'openrx-mono-front.png',     alt: 'OpenRX Mono — front',     variant: 'Mono'},
      {file: `${REPOS}/OpenRX/images/openrx-mono-back.png`,      name: 'openrx-mono-back.png',      alt: 'OpenRX Mono — back',      variant: 'Mono'},
      {file: `${REPOS}/OpenRX/images/openrx-gemini-front.png`,   name: 'openrx-gemini-front.png',   alt: 'OpenRX Gemini — front',   variant: 'Gemini'},
      {file: `${REPOS}/OpenRX/images/openrx-gemini-back.png`,    name: 'openrx-gemini-back.png',    alt: 'OpenRX Gemini — back',    variant: 'Gemini'},
    ],
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getProduct(handle) {
  const d = await admin(
    `#graphql
    query P($q: String!) {
      products(first: 1, query: $q) {
        nodes {
          id title handle
          media(first: 50) { nodes { ... on MediaImage { id } } }
          variants(first: 50) { nodes { id selectedOptions { name value } } }
        }
      }
    }`,
    {q: `handle:${handle}`},
  );
  return d.products.nodes[0];
}

async function deleteMedia(productId, mediaIds) {
  if (!mediaIds.length) return;
  const d = await admin(
    `#graphql
    mutation Del($productId: ID!, $mediaIds: [ID!]!) {
      productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
        deletedMediaIds
        mediaUserErrors { field message }
      }
    }`,
    {productId, mediaIds},
  );
  const errs = d.productDeleteMedia.mediaUserErrors;
  if (errs.length) throw new Error(`deleteMedia: ${JSON.stringify(errs)}`);
}

async function stageAndUpload(images) {
  // One stagedUploadsCreate for all files in this product.
  const input = images.map((im) => ({
    filename: im.name,
    mimeType: 'image/png',
    httpMethod: 'POST',
    resource: 'IMAGE',
  }));
  const staged = await admin(
    `#graphql
    mutation S($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {input},
  );
  assertNoUserErrors('stagedUploadsCreate', staged.stagedUploadsCreate);
  const targets = staged.stagedUploadsCreate.stagedTargets;

  const sources = [];
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    const target = targets[i];
    const buf = fs.readFileSync(im.file);
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append('file', new Blob([buf], {type: 'image/png'}), im.name);
    const up = await fetch(target.url, {method: 'POST', body: form});
    if (![200, 201, 204].includes(up.status)) {
      throw new Error(`upload ${im.name} failed ${up.status}: ${(await up.text()).slice(0, 200)}`);
    }
    sources.push(target.resourceUrl);
  }
  return sources;
}

async function createMedia(productId, images, sources) {
  const d = await admin(
    `#graphql
    mutation CM($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { ... on MediaImage { id alt } status }
        mediaUserErrors { field message }
      }
    }`,
    {
      productId,
      media: images.map((im, i) => ({
        originalSource: sources[i],
        alt: im.alt,
        mediaContentType: 'IMAGE',
      })),
    },
  );
  const errs = d.productCreateMedia.mediaUserErrors;
  if (errs.length) throw new Error(`createMedia: ${JSON.stringify(errs)}`);
  return d.productCreateMedia.media.map((m) => m.id);
}

// Poll until every new media id is READY (so variant-append doesn't race).
async function waitReady(ids) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const d = await admin(
      `#graphql
      query N($ids: [ID!]!) { nodes(ids: $ids) { ... on MediaImage { id status } } }`,
      {ids},
    );
    const statuses = d.nodes.map((n) => n.status);
    if (statuses.every((s) => s === 'READY')) return;
    if (statuses.some((s) => s === 'FAILED')) throw new Error('media FAILED to process');
    await sleep(1500);
  }
  throw new Error('timed out waiting for media to process');
}

async function appendToVariants(productId, variantMedia) {
  const d = await admin(
    `#graphql
    mutation AV($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
      productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
        userErrors { field message }
      }
    }`,
    {productId, variantMedia},
  );
  const errs = d.productVariantAppendMedia.userErrors;
  if (errs.length) throw new Error(`appendToVariants: ${JSON.stringify(errs)}`);
}

// ---- run ----
for (const [handle, cfg] of Object.entries(PLAN)) {
  // Verify every source file exists before mutating anything.
  for (const im of cfg.images) {
    if (!fs.existsSync(im.file)) throw new Error(`missing image: ${im.file}`);
  }

  const product = await getProduct(handle);
  if (!product) {
    console.error(`✗ ${handle}: product not found — skipping`);
    continue;
  }
  console.log(`\n▶ ${handle} (${product.title})`);

  if (cfg.replace) {
    const old = product.media.nodes.map((m) => m.id);
    if (old.length) {
      await deleteMedia(product.id, old);
      console.log(`  ✓ removed ${old.length} old image(s)`);
    }
  }

  const sources = await stageAndUpload(cfg.images);
  const mediaIds = await createMedia(product.id, cfg.images, sources);
  console.log(`  ✓ uploaded ${mediaIds.length} render(s)`);
  await waitReady(mediaIds);

  // Group media ids by the variant they belong to.
  const byVariant = new Map();
  cfg.images.forEach((im, i) => {
    if (!im.variant) return;
    if (!byVariant.has(im.variant)) byVariant.set(im.variant, []);
    byVariant.get(im.variant).push(mediaIds[i]);
  });
  const variantMedia = [];
  for (const [value, ids] of byVariant) {
    const v = product.variants.nodes.find((vn) =>
      vn.selectedOptions.some((so) => so.name === 'Model' && so.value === value),
    );
    if (!v) {
      console.error(`  ✗ no Model variant "${value}" — image left at product level`);
      continue;
    }
    // Shopify allows one featured image per variant — use the first (front/top).
    variantMedia.push({variantId: v.id, mediaIds: [ids[0]]});
  }
  if (variantMedia.length) {
    await appendToVariants(product.id, variantMedia);
    console.log(`  ✓ linked images to ${variantMedia.length} variant(s)`);
  }
}

console.log('\nDONE');
