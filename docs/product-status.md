# Product status: the one system that decides what is public

The `status-*` GitHub topic on a board's repo is the single source of truth
for where that product stands AND for what the shop shows. Flipping a topic
is a release act. This document is the contract; read it before touching
anything in this chain.

## Why this is strict

OpenDrone (designs, repos, roadmap) is fully public. Incutec's commerce side
(prices, orderability, launch timing) is not public until a deliberate
release. The status system is the wall between the two: a wrong status can
leak a price onto a live page, into feeds, and into search engines. Every
default in this chain therefore fails CLOSED (locked, no price).

## The taxonomy

One `status-*` topic per repo, matched against `STATUS_ORDER` in
`app/lib/roadmap-data.ts`. Labels and legends are copy keys in
`content/copy/roadmap.json`; the website never states status in prose.

| Topic | Meaning | Shop behaviour |
|---|---|---|
| `status-launched` | Buyable, design settled | Price shown, orderable (Shopify stock decides in/out of stock) |
| `status-beta` | Buyable, first production batch | Price shown, orderable, early-batch pricing possible |
| `status-alpha` | Community testing, not buyable | Product page with waitlist signup; NO price anywhere |
| `status-in-progress` | First design exists, nothing under test | Locked page ("coming soon" plate); no price |
| `status-planned` | No design yet, spec open on Discord | Concept plate + "help design it" repo link; no price |

## Resolution order (app/lib/product-content.ts, `resolveStatus`)

1. **Per-product JSON kill-switch** — `"status": "idea" | "development" |
   "live"` in `content/products/<handle>.json`. Beats everything. This is
   the emergency lever: if a price ever leaks, set `"status": "development"`
   on that handle and deploy; no GitHub dependency in the loop.
2. **Legacy `comingSoon` boolean** in the same JSON (kept for compatibility).
3. **Roadmap status** — the live topic, falling back to the static list in
   `app/lib/roadmap-data.ts`. `launched`/`beta` → sellable ('live'),
   `alpha`/`in-progress` → waitlist ('development'), `planned` → concept
   ('idea'). A page carrying several boards (OpenESC 20×20 + 30×30,
   OpenFC-Lite + Mini) sells on its furthest-along board.
4. **`PUBLIC_COMING_SOON` env flag** — only reaches products with no roadmap
   entry and no JSON override (accessories: straps, antennas, hardware kits).

The roadmap wins in BOTH directions: `status-beta` puts the price on the
page even if `PUBLIC_COMING_SOON` is still set, and `status-alpha` keeps the
waitlist up even on an open shop. That is the point: one flag, one meaning,
no second switch to forget.

## Where the lock is enforced

All of these read the same resolution (do not add a surface that doesn't):

- PDP buy module (price, add-to-cart, JSON-LD offer suppression)
- Product cards, header product pods, collections grid, related/search
- Feeds: `/products.json`, `/llms.txt` (no price, no cart permalink)
- Server-side cart gate (`app/lib/coming-soon.ts`): direct cart POSTs and
  cart permalinks drop locked lines — the client hiding a button is never
  the only defence
- Back-in-stock growth flow

The root loader resolves every handle once per request with the live topics
and ships the map to the client (`productStatuses`), so all surfaces agree
within one request.

## Latency and failure model

- Topic fetches are cached 10 minutes per worker isolate; loaders cap the
  wait (400-600ms) and fall back to the static list, while the fetch fills
  the cache for the next request. A flip lands within ~10 minutes.
- `GITHUB_STATUS_TOKEN` (fine-grained, public read only) must be set in
  Oxygen: without it the unauthenticated 60/h budget can rate-limit the
  fetch and pin the site to the static statuses.
- **Fallback discipline: the static status in ROADMAP must LAG the repo
  topic, never lead it.** If the API is down, the static value stands in; a
  static `beta` while the repo says `alpha` would leak prices exactly when
  nobody is looking. Flip the topic first, then update the static value in
  a follow-up PR once the flip is live.

## Runbooks

**Release a product (alpha → beta):** confirm the Shopify product has the
right variants, prices and stock; flip the repo topic to `status-beta`
(repo admin only — topics cannot be changed by pull request); within ~10
minutes the price is public and orders open; then update the static status
in `roadmap-data.ts` in a follow-up PR.

**Emergency lock:** set `"status": "development"` in
`content/products/<handle>.json`, deploy (auto on merge). Then fix the
topic at leisure.

**Test buy flows in a dev worktree:** roadmap products ignore
`PUBLIC_COMING_SOON=0` now. Temporarily set `"status": "live"` in the
product's JSON — and do not commit that change.

## Gatekeeping

Repo topics are editable only by people with admin/maintain rights on the
OpenDrone-hw repos. A pull request cannot change topics, so outside
contributors cannot flip a product to buyable. Keep it that way: never
build automation that writes topics from CI on contributor-triggerable
events.
