# OpenDrone launch plan - 2026-07-02

Synthesis of: full codebase audit, git history, Notion storefront sprint (16 tasks),
/Users/stan/OpenDrone hardware inventory, incutec vault (business plan, pricing, roadmap).
Target: September 2026 launch, first sale Q3 2026 (OFC-ECO + ESC stack).

## A. Launch blockers - business/Shopify (Notion storefront sprint)

Dependency chain: payments + domain → legal pages + InvenTree sync → test order → remove password.

1. **Activate payment provider + connect Incutec BV bank account** (Shopify Payments or Mollie,
   BV business verification). Notion calls this the #1 blocker.
2. **Connect opendrone.be to the Shopify store** (currently ktjqug-jw.myshopify.com), set primary,
   verify SSL. Also update `.env` `PUBLIC_STORE_DOMAIN` / `PUBLIC_CHECKOUT_DOMAIN` in production.
3. **Legal pages live and reachable** - Shopify policy pages currently link to opendrone.be/en/…
   which isn't connected (mandatory text unreachable). Must include: 2-year legal guarantee
   (EU 2019/771), GPSR safety info, withdrawal model form (downloadable + in order emails),
   Consumentenombudsdienst instead of the dead EU ODR link. Due 2026-07-18 in Notion.
4. **Finalize privacy policy** - live one is Shopify generic; vault version has unfilled processor
   table (Shopify IE, Stripe IE, Sendcloud NL, Polar/Exact, carriers, Plausible) + GBA as authority.
5. **VAT config** - confirm BE 21%, tax-inclusive pricing, EU OSS registration decision.
6. **InvenTree sync** - Shopify custom app (write_inventory, read_products, read_orders) + enable
   inventree-incutec-sync plugin. Blocked behind 1+2.
7. **End-to-end test order** - payment capture, confirmation email, stock decrement, refund. Final
   gate before removing storefront password.
8. **Export Compliance Policy page on incutec.eu** - promised in the opendrone.be export memo;
   separate repo (incutec-hw/website, Astro).

## B. Launch blockers - code (this repo)

1. **Placeholder banner**: `PUBLIC_PRELAUNCH` unset ⇒ banner "Text & numbers are AI-generated
   placeholders" on every page (`root.tsx:128`, `PlaceholderBanner.tsx`). Set `=0` in prod only
   after copy/pricing is real.
2. **Salvage stash@{2}**: real KBO/VAT `1038.934.039` filling `[pending]` in `company.ts` +
   `.env.example`, plus SEO guard against leaking placeholder phone into JSON-LD. Notion marks
   "fill KBO+VAT" Done, but the code side never merged. Rest of that stash (perf-tier) is dead -
   extract legal bits, drop the stash.
3. **Homepage SEO**: `_index.tsx:119` uses plain meta array - no og:image, canonical, twitter card,
   JSON-LD on the most-shared URL. Convert to `buildSeoMeta`.
4. **Product copy**: Shopify descriptions are placeholders (overridden by `product-content.ts`);
   `TODO(copy)` at product-content.ts:996 (teardown editorial), :1036 (variant editorial).
   Verify content keys (`openesc`, `openfc`, `openfc-lite`, `openrx`, `openframe`, `openstack`)
   match live Shopify handles.
5. **Downloads all empty** (6× `TODO(downloads)`) - publish schematic/BOM/gerber/manual links per
   product. Open-source is the brand promise; empty Downloads at launch undercuts it. Hardware
   repos have production exports ready to link.
6. **Pricing sanity**: site shows Shopify prices - load the 7 SKU beta prices from the vault
   (OFC-ECO €34.99 … ORX-GEMI €39.99) into Shopify before dropping the banner.
7. **Ops per .HANDOFF.md**: rotate Storefront + Customer-Account tokens (secrets lived in iCloud),
   deploy to Oxygen, enable secret scanning.
8. **`repoUrl` for openframe/openstack** points at the org, not real repos - fix or hide.
9. **Company phone** `[pending]` (`company.ts:24`) - gracefully hidden; decide: get a number or ship without.

## C. Pictures / physical assets still needed

1. **4 accessory photos** (Notion, look broken now): OpenDrone Battery Strap, ELRS 2.4GHz antenna,
   OpenFrame Spare Parts, OpenDrone Hardware Kit - shoot white-bg, upload to Shopify Media.
2. **White-bg physical product photos** of the 8 launch boards (deferred task; renders currently
   stand in as product images). Shoot when Rev2 boards arrive from fab.
3. **Board-art gaps**: `public/boards/openfc/` has only board.svg (no front/back/components.json);
   no `public/schematics/openfc/` dir. Verify the openfc family page doesn't need them.
4. **Renders for coming-soon products** (OpenAIO, OpenAIO-Whoop, Charger, OpenVTX) - blocked on
   designs existing; use `tools/render_board.py` when routed.
5. **Lifestyle/hero photography**: assembled stack, built quad, bench/lab shots - needed for launch
   video, home page, press kit, Bardwell review context.
6. **Launch video assets** - YouTube FC deep-dive is the launch mechanism (pre-orders open same day).

## D. Physical / hardware to-dos (launch-critical)

1. Rev2 OpenFC-Lite + OpenFC-Lite-Mini fab orders (in progress) → bring-up → bench tests
   (Testing repo procedures are still stubs - write them as boards arrive).
2. EMC pre-compliance on test-representative boards (OESC-3030, ORX-Gemini per vault).
3. CE/DoC documentation per SKU (OFC-ECO first: simplest CE path, ships first).
4. Packaging + inserts (safety info is a GPSR requirement - ties to legal task).
5. Review units to Joshua Bardwell ahead of launch video.
6. Stock into InvenTree so the sync has something to sync.

## E. Future expansion readiness

- `product-content.ts` (1,200 lines, single file) is the CMS. Fine at 6 entries; will strain with
  AIO family + frames + motors. Near-term: split per-product modules + write an "add a product"
  checklist (Shopify product → handle → content module → board art → schematics → models → downloads).
  Later: consider Shopify metaobjects if non-dev editing is ever needed.
- `comingSoon` tier flag already works - use it for OpenAIO family, OpenFrame3/5, motors, VTX/VRX.
- Support: `openbrain.ts` scaffold stays unwired (`SUPPORT_BACKEND=discord`) until OpenBrain M2
  replaces the AI drafter.
- incutec.eu (parent site) is a separate workstream - vision copy + design pass + export policy page.

## F. Maintenance

1. Merge PR #234 (404 signal-lost). Delete stale `fix/pdp-swap-conveyor` (superseded by merged #226).
2. Dependabot: merge #242, #241, #240, #239, #238, #232. **Close #237** (react-router 7.18 group -
   Hydrogen pins RR toolchain to 7.16.x).
3. Commit or discard `account.tsx` diff (cosmetic header removal - safe). Commit `brand/` +
   `scripts/gen-*.py`; gitignore `scripts/__pycache__/` and `brand.zip`; keep `drafts/` untracked.
4. Drop stash@{0} (already on main) and stash@{1} (lockfile churn) after salvaging stash@{2}.
5. Add `test` script + CI for the existing `app/lib/support/*.test.ts` files.
6. `sync:legal` no-ops silently when COMPLIANCE_SRC unreachable - add a staleness warning.
7. Vite xstate alias workaround (`vite.config.ts:18-25`) - recheck on every Hydrogen upgrade.
8. Weekly ops review already tracks the sprint - keep Notion as the canonical task board.

## Backlog from council round 2 (2026-07-03) - verified open items

- Search: query "esc" returns zero products (Shopify prefix search doesn't hit
  substrings; productType didn't match either). Fix: tag products in Shopify
  with family keywords (esc, fc, flight controller, receiver, frame) via a
  browser agent, or expand queries server-side. Also: no desktop header search
  entry point + predictive search UI unwired at 1440px.
- Theme toggle: first click on the (heavy) homepage sometimes no-ops before
  hydration completes.
- Cart minus-at-qty-1 is disabled but unstyled (reads as broken).
- Agent-UX P4-P6: JSON-LD offers as per-variant ARRAY + seller/itemCondition,
  rel=canonical + og:url on PDPs, ItemList on /collections/all, /llms-full.txt
  (spec tables, compatibility matrix, worked permalink examples).
- Homepage-only cosmetic: hero 5"/3" toggle can sit under the header dropdown.
- Light-mode --color-on-accent is white (deliberate, contradicts CLAUDE.md,
  ~3:1 contrast on gold) - STAN DECIDES.
