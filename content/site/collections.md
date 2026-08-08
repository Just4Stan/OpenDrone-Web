# Collections — `/collections`, `/collections/all`, `/collections/:handle`

> source: app/routes/collections._index.tsx, app/routes/collections.all.tsx, app/routes/collections.$handle.tsx, app/components/CollectionSort.tsx, app/components/CategoryChips.tsx, app/components/PaginatedResourceSection.tsx, app/components/EmptyState.tsx, app/components/Breadcrumb.tsx

Three routes share this file. `/collections` lists collection cards. `/collections/all`
is the catalog browse hub grouped into fixed category sections with filter chips.
`/collections/:handle` shows one collection's products with a sort dropdown and
"load more" pagination. Product titles, prices, collection titles/descriptions, and
category chip lists are Shopify/loader data — not editable here. The browse-page
category headings, the empty/sort/pagination chrome, and the static page copy below
are editable.

## `/collections` — collections index

### Meta (browser tab + search/social)

- **collections_index_meta_title:** Collections
- **collections_index_meta_description:** Browse OpenDrone collections for flight controllers, ESCs, frames, and open hardware builds.

### Header

- **collections_index_eyebrow:** Catalog
- **collections_index_title:** Collections

### prose: collections_index_description

Browse the catalog by product family and jump straight into the
hardware stack you care about.

### Collection card

Each card's heading is the Shopify collection title (dynamic). The subtitle below it
is static:

- **collection_card_subtitle:** OpenDrone collection

## `/collections/all` — catalog browse hub

### Meta (browser tab + search/social)

- **collections_all_meta_title:** All Products
- **collections_all_meta_description:** Browse the full OpenDrone catalog by category — open source flight controllers, ESCs, receivers, frames, bundles, and accessories.

### Header

- **collections_all_eyebrow:** Shop · Catalog
- **collections_all_title:** All Products

### Category section headings

The browse page groups products into a fixed category order. Each heading is the
section title and the chip label for that category. Products whose Shopify
`productType` isn't listed fall into a trailing "Other" section.

- **category_heading_flight_controller:** Flight Controllers
- **category_heading_esc:** ESCs
- **category_heading_receiver:** Receivers
- **category_heading_frame:** Frames
- **category_heading_bundle:** Bundles
- **category_heading_accessory:** Accessories
- **category_heading_other:** Other

```do-not-edit
Headings map to Shopify productType values (set by scripts/shopify-infra/04 + 05):
"Flight Controller" → Flight Controllers; "ESC" → ESCs; "Receiver" → Receivers;
"Frame" → Frames; "Bundle" → Bundles; "Accessory" → Accessories. Any unlisted
type falls into the trailing "Other" section. Changing a heading does NOT change
the productType match key.
```

### Empty states

Shown when no products are listed. Two variants — one when a category filter is
active (`?type=`), one when the whole catalog is empty.

- **collections_all_empty_filtered_title:** No {type} products yet
- **collections_all_empty_filtered_description:** Try another category or browse everything.
- **collections_all_empty_filtered_cta:** Show all
- **collections_all_empty_catalog_title:** Catalog is being stocked
- **collections_all_empty_catalog_description:** Products are not yet listed. Follow along on GitHub for hardware progress.
- **collections_all_empty_catalog_secondary_link:** GitHub

```do-not-edit
"{type}" in the filtered-empty title is the active category value (Shopify
productType, e.g. "ESC") — dynamic, do not retype. Filtered-empty CTA links to
/collections/all. Catalog-empty secondary link → https://github.com/OpenDrone-hw
```

## `/collections/:handle` — single collection

### Meta (browser tab + search/social)

Both meta strings are dynamic when the collection has data and fall back to static
copy otherwise.

- **collection_handle_meta_title_pattern:** {collection title} Collection
- **collection_handle_meta_title_fallback:** Collection
- **collection_handle_meta_description_fallback:** Explore curated OpenDrone hardware collections and product families.

```do-not-edit
Meta title: when the collection loads, it is `<collection.title> Collection`
(e.g. "Flight Controllers Collection"); with no collection it is just "Collection".
Meta description: the Shopify collection description when present, else the
fallback string above. The collection title/description themselves are edited in
Shopify admin.
```

### Breadcrumb

The first crumb is static; the trailing crumb is the Shopify collection title (dynamic).

- **collection_handle_breadcrumb_shop:** Shop

### Header

The page title and description are the Shopify collection title/description (dynamic).
Only the eyebrow is static.

- **collection_handle_eyebrow:** Collection

### Empty state

Shown when the collection has no products.

- **collection_handle_empty_title:** No products yet
- **collection_handle_empty_description:** This collection is empty. Check back soon or browse the full catalog.
- **collection_handle_empty_cta:** Shop all

```do-not-edit
Empty-state CTA links to /collections/all
```

## Shared chrome (browse + collection pages)

### Category filter chips (`/collections/all`)

The "All" chip is static; the remaining chips use the category headings above.
The nav's aria-label is below.

- **category_chips_all:** All
- **category_chips_aria_label:** Filter by category

### Sort dropdown (`/collections/:handle`)

The "Sort" label and the dropdown option labels are static UI chrome.

- **sort_label:** Sort
- **sort_option_featured:** Featured
- **sort_option_price_asc:** Price — low to high
- **sort_option_price_desc:** Price — high to low
- **sort_option_newest:** Newest
- **sort_option_bestselling:** Best selling
- **sort_option_title:** Alphabetical

### Pagination (`/collections`, `/collections/:handle`)

Previous/next pagination links and the in-flight loading label.

- **pagination_load_previous:** ↑ Load previous
- **pagination_load_more:** Load more ↓
- **pagination_loading:** Loading...
