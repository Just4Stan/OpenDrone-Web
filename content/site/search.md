# Search — `/search`

> source: app/routes/search.tsx, app/components/SearchForm.tsx, app/components/SearchResults.tsx

The search page renders a header, a search form, and result sections
(Products, Pages, Articles) grouped by type, with an empty state when
there is no term or no results. Result titles, product images, and prices
come from the Shopify Storefront API — not editable here. The meta title /
description vary depending on whether a search term is present (the
`{term}` token below is the dynamic query string).

## Meta (browser tab + search/social)

- **title_no_term:** Search
- **title_with_term:** *(template — `{term}` is the query)* Search results for "{term}"
- **description_no_term:** Search OpenDrone products, articles, and pages.
- **description_with_term:** *(template — `{term}` is the query)* Search OpenDrone for {term}.

## Page header

- **eyebrow:** Search
- **title:** Search the catalog
- **description:** Find products, technical pages, and journal entries across the OpenDrone storefront.

## Search form

- **input_placeholder:** Search...
- **submit_button:** Search

## Empty state (no term or no results)

- **empty_body:** No results yet. Try a product name, part number, or article keyword.

## Results — section headings

*(Each section only renders when it has results. Item titles and prices
are dynamic Shopify data.)*

- **section_products:** Products
- **section_pages:** Pages
- **section_articles:** Articles

## Results — products pagination

- **pagination_loading:** Loading...
- **pagination_previous:** ↑ Load previous
- **pagination_next:** Load more ↓

## Errors

*(Search error text is the raw message returned by the loader / Shopify
API; not authored copy. Rendered verbatim when present.)*

- **predictive_search_failure:** *(thrown error message, not user-facing chrome)* Search failed

```do-not-edit
Result links (structural):
- Product → /products/<handle>
- Page → /pages/<handle>
- Article → /blogs/<blog handle>/<article handle>
Form: GET /search?q=<term>; Cmd/Ctrl+K focuses the input, Esc blurs it.
Predictive search (?predictive) renders nothing on this route (returns
null) — it powers the header search dropdown elsewhere.
```
