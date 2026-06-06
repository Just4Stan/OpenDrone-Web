# Product page chrome — `/products/:handle`

> source: app/routes/products.$handle.tsx, app/components/ProductForm.tsx, app/components/RelatedProducts.tsx

STATIC UI CHROME ONLY. The PDP renders per-product editorial copy (hero lines,
specs, in-the-box, downloads, teardown pins, firmware project) from
`app/lib/product-content.ts` — edited in `content/site/products/<handle>.md`, NOT
here. Titles, prices, variants, SKU values, and stock come from the Shopify
Storefront API (dynamic). Below are only the hardcoded labels, headings, section
titles, fixed prose, and badges baked into the route + buy-form component.

## Meta (browser tab + search/social)

Both meta fields prefer Shopify SEO/product data; only the title has a static
fallback. The description has no static fallback (omitted when absent).

- **product_meta_title_fallback:** Product

```do-not-edit
Meta title resolves: product.seo.title → product.title → "Product".
Meta description resolves: product.seo.description → product.description → (none).
Both data sources are edited in Shopify admin / product-content, not here.
```

## Hero

- **trust_chips_aria_label:** Certifications
- **trust_chip_open_source:** Open source · CERN-OHL-S-2.0

The eyebrow and the firmware trust chips are templates filled with editorial /
Shopify data — listed for context, do not retype the interpolated parts.

- **hero_eyebrow_pattern:** File {fileNumber} · {family}
- **trust_chip_bundle_pattern:** €1 × {n} → {firmware names joined by " + "}
- **trust_chip_single_pattern:** €1 → {firmware project} maintainers

```do-not-edit
hero_eyebrow_pattern: "File " + content.fileNumber + " · " + content.family —
both values come from product-content.ts.
trust_chip_open_source links to /open-source. The €1 trust chips link to
/firmware-partners; their project names / counts come from product-content.ts.
```

## Buy rail

The price, compare-at price, SKU value, and stock state come from Shopify. Static
chrome: the "SKU" prefix word and the two stock-state badges.

- **buy_sku_prefix:** SKU
- **buy_stock_in_stock:** In stock · ships from Belgium
- **buy_stock_sold_out:** Sold out

### Add-to-cart button (app/components/ProductForm.tsx)

- **cta_add_to_cart:** Add to cart
- **cta_sold_out:** Sold out

## Chapter: Teardown

Chapter index label (the small caption beside the chapter number). The chapter
title and teardown pin rows come from product-content.

- **chapter_label_teardown:** Teardown

## Chapter: Open for learning

- **chapter_label_open_source:** Open for learning
- **chapter_title_open_source:** Published so you can study it. Produced so you don't have to.
- **chapter_subhead_live_repo:** Live from the repo

### prose: open_source_body

The schematic, PCB, BOM and 3D STEP are on GitHub under CERN-OHL-S v2.
Read them, fork them, ship a variant — the license is the contract.
What you buy here is the production run: EU manufacturing, CE / EMC,
QC, packaging, support. That pays for the next design.

### Open-source cards

Single-product layout shows Study / Iterate / License cards; bundle layout shows
one repo card per component (label = component title, dynamic) plus the License card.

- **open_source_card_study_label:** Study
- **open_source_card_study_title:** GitHub repo ↗
- **open_source_card_study_sub:** Schematic · PCB · BOM · 3D STEP · design notes
- **open_source_card_iterate_label:** Iterate
- **open_source_card_iterate_title:** Open issues ↗
- **open_source_card_iterate_sub:** Rev candidates · bugs · community discussion
- **open_source_card_license_label:** License
- **open_source_card_license_title:** CERN-OHL-S v2 ↗
- **open_source_card_license_sub:** Strong reciprocal — share your changes
- **open_source_card_bundle_title:** GitHub repo ↗
- **open_source_card_bundle_sub:** Schematic · PCB · BOM · 3D STEP

```do-not-edit
Card hrefs: Study → content.repoUrl; Iterate → content.repoUrl + "/issues";
License → https://ohwr.org/cern_ohl_s_v2.txt; bundle cards → each component's repoUrl.
Repo URLs come from product-content.ts.
```

## Chapter: In the box

The chapter title differs between bundle and single products. Both bodies are fixed
prose. The actual item list comes from product-content.

- **chapter_label_in_the_box:** In the box
- **chapter_title_in_the_box_bundle:** Two boards, two firmwares, two maintainers paid.
- **chapter_title_in_the_box_single:** Everything that ships, down to the grommet.

### prose: in_the_box_body_bundle

The bundle is just OpenFC and OpenESC shipped together. No combined SKU, no tied
hardware — each board is the same one you can buy on its own. What you save is
courier-and-handling. What you don't lose is the €1 split: each firmware project
still gets paid from this order.

### prose: in_the_box_body_single

No stock photo of an open box. Here is the actual parts list. Anything missing from
a build, say so — we'll ship it.

### Bundle component cards

Component title, blurb, and firmware name are editorial (product-content). Static
chrome:

- **bundle_component_firmware_label:** Firmware ·
- **bundle_component_more:** View the board →

## Chapter: The €1 (firmware split)

Shown for single products with a firmware project. Title is fixed; the split
figures and project name come from Shopify price + product-content.

- **chapter_label_firmware:** The €1
- **chapter_title_firmware:** What you pay, what the people who wrote the firmware get.

```do-not-edit
chapter_title_firmware renders with emphasis on "you" and "people who wrote the
firmware". The price split itself is computed in app/components/FirmwareSplit.tsx
from the Shopify variant price.
```

## Chapter: Specs (datasheet)

Label and title are static; the spec rows + footnote come from product-content.

- **chapter_label_specs:** Datasheet
- **chapter_title_specs:** Every spec, in one table.

## Chapter: Downloads

Label, title, and intro body are static; the download cards come from product-content.

- **chapter_label_downloads:** Downloads
- **chapter_title_downloads:** Files you can fork, build on, or audit.

### prose: downloads_body

Straight from the repo. If a link 404s, the file moved — open an issue on the
matching GitHub repo and we'll point it back.

### Download card

The card's label / note / size come from product-content. Static chrome is the
download action:

- **download_card_cta:** Download ↗

## Related products (app/components/RelatedProducts.tsx)

Recommendation strip at the foot of the PDP. The product cards are Shopify data;
the heading and section aria-label are static.

- **related_products_heading:** You might also like
- **related_products_aria_label:** Related products
