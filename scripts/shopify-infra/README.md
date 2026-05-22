# scripts/shopify-infra

One-off / re-runnable scripts that set up the OpenDrone Shopify store via the
**Admin GraphQL API**. They read credentials from the repo `.env` (gitignored)
— nothing is hard-coded and no secrets live in this directory.

## Auth
Uses the custom app **"OpenDrone Infra"** (Dev Dashboard). Required `.env`:

```
PUBLIC_STORE_DOMAIN=ktjqug-jw.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=<offline token from the app install>
SHOPIFY_ADMIN_API_VERSION=2026-01
```

Granted scopes: `read/write_products`, `read/write_discounts`,
`read/write_translations`, `read/write_files`, `read_locations`,
`read/write_inventory`, `read/write_content`.
The token can be rotated by re-installing the app (OAuth) and updating `.env`.

## Scripts
| Script | What it does |
|---|---|
| `_client.mjs` | Admin GraphQL client + `.env` loader (imported by the others). |
| `00-inspect.mjs` | Read-only dump of products, variants and `custom.*` metafield definitions. |
| `01-metafield-definitions.mjs` | Creates the 15 GPSR/CRA `custom.*` definitions (storefront `PUBLIC_READ`). |
| `02-variants.mjs` | Builds the line variant axes (Mount/Model/Size), placeholder price + SKU, 100 stock. |
| `03-metafield-values.mjs` | Populates verifiable compliance metafields (repo, security contact, model, doc URLs). |
| `04-reviewer-code.mjs` | `node 04-reviewer-code.mjs <CODE> [percent]` — mints a reviewer attribution discount code. |

All are safe to re-run.

## Attribution scheme (reviewers + YouTube)
- **Reviewers**: one Shopify discount code each (`REVIEWER-NAME`), minted with
  `04-reviewer-code.mjs`. The code is the attribution key — Shopify Discounts
  reports orders + revenue per code. Tracked in Notion → *Reviewer Units*.
- **Videos/content**: tag landing links `?utm_source=youtube&utm_medium=video&utm_campaign=<slug>`.
  Shopify Marketing + GA4 (if a measurement ID is added) attribute by campaign.
  Tracked in Notion → *Content / Video Calendar*.

## Notion
The Shopify-infra pass also created a **Store Ops** hub under the "shopify"
project page in INCUTEC HQ: *Store Catalog (Shopify)* (seeded), *Reviewer
Units*, *Content / Video Calendar*. Live Shopify→Notion sync is designed (see
that hub page) but not wired — it needs a `NOTION_TOKEN` and a webhook route.
