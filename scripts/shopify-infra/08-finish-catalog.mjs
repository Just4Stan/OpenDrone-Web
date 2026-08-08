/**
 * Catalog finish pass (2026-06-09 polish):
 *   1. Real product descriptions (+ SEO description) replacing the joke/TBD
 *      placeholders that currently leak into meta tags, OG and JSON-LD.
 *   2. OpenStack variant: €420 placeholder → €114 (real 20×20 bundle sum)
 *      + SKU OPENSTACK. The PDP composes component prices itself; this fixes
 *      homepage/catalog cards and JSON-LD.
 *   3. Missing SKU on the openframe 5" Freestyle variant → OPENFRAME-5.
 *   4. Alt text on the two screenshot images (openframe, openstack) until
 *      proper renders replace them.
 *   5. Smart collections per product type (the store had only the auto
 *      "frontpage" collection, which leaked a lone "Home page" card on
 *      /collections) + delete "frontpage".
 *
 * Deliberately NOT touched: prices other than openstack (maintainer: current prices
 * are correct), inventory quantities (stocktake pending), weights (need a
 * scale), store password (orders stay disabled).
 *
 * DRY_RUN=1 node scripts/shopify-infra/08-finish-catalog.mjs  → print plan
 *           node scripts/shopify-infra/08-finish-catalog.mjs  → apply
 * Idempotent: safe to re-run.
 */
import {admin, assertNoUserErrors} from './_client.mjs';

const DRY = process.env.DRY_RUN === '1';

// One factual sentence each. Feeds <meta name=description>, OG and JSON-LD.
const DESCRIPTIONS = {
  openesc:
    'Open-source 4-in-1 AM32 ESC. Four independent AT32F421 channels on a 6-layer board, 20×20 or 30×30 mount, browser flashing at am32.ca. CERN-OHL-S licensed, €1 per board goes to the AM32 maintainers.',
  openrx:
    'Open-source ExpressLRS receiver on the ESP32-C3. Four variants: SX1281 2.4 GHz with ceramic antenna or U.FL, and LR1121 dual-band as Mono or true-diversity Gemini. €1 per board goes to the ExpressLRS maintainers.',
  'openfc-lite':
    'Open-source Betaflight flight controller on the Raspberry Pi RP2354. microSD blackbox, switchable 10 V VTX rail, USB-C UF2 flashing, 20×20 or 30×30 mount. CERN-OHL-S licensed, €1 per board goes to the Betaflight maintainers.',
  openframe:
    'CNC carbon-fibre freestyle frame in 5-inch and 3-inch sizes. Replaceable arms, 20×20 to 30.5×30.5 stack mounting, spare parts sold separately. Open source under CERN-OHL-S.',
  openstack:
    'OpenFC-Lite and OpenESC bought together: one checkout, one parcel, the same two boards as sold separately. Betaflight and AM32 each still get their €1.',
  'battery-strap':
    'Battery strap for OpenDrone frame builds.',
  'elrs-antenna-24':
    '2.4 GHz antenna for ExpressLRS receivers with a U.FL connector. Fits OpenRX Lite-UFL, Mono and Gemini.',
  'openframe-spares':
    'Replacement parts for OpenFrame: arm sets, top and bottom plates, and hardware kits. Same carbon and hardware as the stock frame.',
  'hardware-kit':
    'Spare standoffs, screws and grommets for OpenDrone boards and frames.',
};

// handles whose seo.description should also be set (main catalog lines)
const SEO_HANDLES = new Set([
  'openesc',
  'openrx',
  'openfc-lite',
  'openframe',
  'openstack',
]);

const ALT_TEXT = {
  openframe: 'OpenFrame 5" freestyle frame, assembled with arms and standoffs',
  openstack: 'OpenStack: OpenFC-Lite flight controller stacked on the OpenESC 4-in-1',
};

const COLLECTIONS = [
  {title: 'Flight Controllers', handle: 'flight-controllers', type: 'Flight Controller'},
  {title: 'ESCs', handle: 'escs', type: 'ESC'},
  {title: 'Receivers', handle: 'receivers', type: 'Receiver'},
  {title: 'Frames', handle: 'frames', type: 'Frame'},
  {title: 'Bundles', handle: 'bundles', type: 'Bundle'},
  {title: 'Accessories', handle: 'accessories', type: 'Accessory'},
];

const PRODUCTS_QUERY = `#graphql
  query CatalogState {
    products(first: 50) {
      nodes {
        id
        handle
        title
        description
        seo { description }
        media(first: 10) {
          nodes { id alt mediaContentType }
        }
        variants(first: 10) {
          nodes { id title sku price }
        }
      }
    }
    collections(first: 20) {
      nodes { id handle title }
    }
  }
`;

async function main() {
  const state = await admin(PRODUCTS_QUERY);
  const byHandle = Object.fromEntries(
    state.products.nodes.map((p) => [p.handle, p]),
  );

  // 1+2. Descriptions + SEO
  for (const [handle, text] of Object.entries(DESCRIPTIONS)) {
    const p = byHandle[handle];
    if (!p) {
      console.log(`SKIP description ${handle} (not found)`);
      continue;
    }
    const needsDesc = p.description.trim() !== text;
    const needsSeo = SEO_HANDLES.has(handle) && p.seo?.description !== text;
    if (!needsDesc && !needsSeo) {
      console.log(`OK   description ${handle} (already set)`);
      continue;
    }
    console.log(`SET  description ${handle}: "${text.slice(0, 60)}…"`);
    if (DRY) continue;
    const input = {id: p.id, descriptionHtml: `<p>${text}</p>`};
    if (SEO_HANDLES.has(handle)) input.seo = {description: text};
    const res = await admin(
      `#graphql
      mutation UpdateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id }
          userErrors { field message }
        }
      }`,
      {input},
    );
    assertNoUserErrors(`productUpdate ${handle}`, res.productUpdate);
  }

  // 2+3. Variant fixes: openstack price+SKU, openframe 5" SKU
  const variantFixes = [];
  const stack = byHandle.openstack;
  if (stack) {
    const v = stack.variants.nodes[0];
    if (v && (v.price !== '114.00' || v.sku !== 'OPENSTACK')) {
      variantFixes.push({
        label: `openstack "${v.title}" price ${v.price}→114.00, sku "${v.sku ?? ''}"→OPENSTACK`,
        productId: stack.id,
        variants: [
          {id: v.id, price: '114.00', inventoryItem: {sku: 'OPENSTACK'}},
        ],
      });
    } else {
      console.log('OK   openstack variant (price/SKU already set)');
    }
  }
  const frame = byHandle.openframe;
  if (frame) {
    const v5 = frame.variants.nodes.find((v) => v.title.startsWith('5'));
    if (v5 && !v5.sku) {
      variantFixes.push({
        label: `openframe "${v5.title}" sku ""→OPENFRAME-5`,
        productId: frame.id,
        variants: [{id: v5.id, inventoryItem: {sku: 'OPENFRAME-5'}}],
      });
    } else {
      console.log('OK   openframe 5" SKU (already set)');
    }
  }
  for (const fix of variantFixes) {
    console.log(`SET  ${fix.label}`);
    if (DRY) continue;
    const res = await admin(
      `#graphql
      mutation FixVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id sku price }
          userErrors { field message }
        }
      }`,
      {productId: fix.productId, variants: fix.variants},
    );
    assertNoUserErrors(fix.label, res.productVariantsBulkUpdate);
  }

  // 4. Alt text on screenshot media
  for (const [handle, alt] of Object.entries(ALT_TEXT)) {
    const p = byHandle[handle];
    const media = p?.media.nodes.filter((m) => m.mediaContentType === 'IMAGE');
    if (!media?.length) {
      console.log(`SKIP alt ${handle} (no images)`);
      continue;
    }
    const stale = media.filter((m) => m.alt !== alt);
    if (!stale.length) {
      console.log(`OK   alt ${handle} (already set)`);
      continue;
    }
    console.log(`SET  alt ${handle} on ${stale.length} image(s): "${alt}"`);
    if (DRY) continue;
    const res = await admin(
      `#graphql
      mutation UpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
        productUpdateMedia(productId: $productId, media: $media) {
          media { id alt }
          mediaUserErrors { field message }
        }
      }`,
      {
        productId: p.id,
        media: stale.map((m) => ({id: m.id, alt})),
      },
    );
    if (res.productUpdateMedia.mediaUserErrors?.length) {
      throw new Error(
        `alt ${handle}: ${JSON.stringify(res.productUpdateMedia.mediaUserErrors)}`,
      );
    }
  }

  // 5. Smart collections by product type + drop the auto "frontpage"
  const existing = Object.fromEntries(
    state.collections.nodes.map((c) => [c.handle, c]),
  );
  for (const c of COLLECTIONS) {
    if (existing[c.handle]) {
      console.log(`OK   collection ${c.handle} (exists)`);
      continue;
    }
    console.log(`ADD  collection ${c.handle} (product_type = ${c.type})`);
    if (DRY) continue;
    const res = await admin(
      `#graphql
      mutation CreateCollection($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { id handle }
          userErrors { field message }
        }
      }`,
      {
        input: {
          title: c.title,
          handle: c.handle,
          ruleSet: {
            appliedDisjunctively: false,
            rules: [{column: 'TYPE', relation: 'EQUALS', condition: c.type}],
          },
        },
      },
    );
    assertNoUserErrors(`collectionCreate ${c.handle}`, res.collectionCreate);
  }
  if (existing.frontpage) {
    console.log('DEL  collection frontpage ("Home page" auto-collection)');
    if (!DRY) {
      const res = await admin(
        `#graphql
        mutation DeleteCollection($input: CollectionDeleteInput!) {
          collectionDelete(input: $input) {
            deletedCollectionId
            userErrors { field message }
          }
        }`,
        {input: {id: existing.frontpage.id}},
      );
      assertNoUserErrors('collectionDelete frontpage', res.collectionDelete);
    }
  } else {
    console.log('OK   frontpage collection already gone');
  }

  console.log(
    `\n${DRY ? 'DRY RUN — nothing applied.' : 'Applied.'}\nStill manual (need maintainer): weights (scale), real inventory counts (stocktake), accessory images, openframe/openstack renders, primary domain, payments. Orders stay disabled.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
