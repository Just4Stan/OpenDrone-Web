# Shopify independence assessment

Date: 2026-07-06. State: pre-launch (payments/domain/legal/test-order still open per launch plan).
Scope: what in this repo is welded to Shopify, what an exit would cost, and whether it's worth it.

---

## Part A — Coupling audit (what actually depends on Shopify)

The single dependency is `@shopify/hydrogen ^2026.4.1` (plus `@shopify/cli`, `mini-oxygen`,
`hydrogen-codegen`, `oxygen-workers-types` in dev). There is no `@shopify/remix-oxygen` —
the RR7-era template folds that into hydrogen itself. Below, every touchpoint, classified
EASY / MEDIUM / HARD to replace.

### A.1 Runtime + deploy plumbing — MEDIUM

- `server.ts` — `createRequestHandler` + `storefrontRedirect` (404s fall through to
  Shopify's URL-redirect list). The handler itself is ~60 lines; trivially rewritten
  as a plain workerd/Node fetch handler.
- `app/lib/context.ts` — `createHydrogenContext` builds `storefront`, `customerAccount`,
  `cart` clients; pins market to `country: 'BE'` and maps URL locale → Storefront API
  language (EN/NL/FR). This is the root injection point: every loader gets Shopify via
  `context.*`.
- `vite.config.ts` — `hydrogen()` + `oxygen()` (mini-oxygen) plugins; dev server runs in
  a simulated workerd. Also an `@xstate` alias hack to fix a broken hydrogen-react path.
- `app/routes.ts` — `hydrogenRoutes()` wrapper (injects hydrogen's virtual routes, e.g.
  GraphiQL in dev).
- Worker cache: `caches.open('hydrogen')` + `storefront.CacheLong()/CacheShort()` cache
  policies on queries. Cache API is standard workerd — portable to Cloudflare Workers,
  not to Node hosts without a shim.
- Deploy: `.github/workflows/oxygen-deployment-1000116751.yml` runs
  `npx shopify hydrogen deploy` on every push (Oxygen). CI (`ci.yml`) builds with
  stubbed `PUBLIC_STOREFRONT_*` env — i.e. the build itself doesn't need a live shop.
- Env contract (`.env.example`): 8 Shopify vars (store domain, storefront tokens ×2,
  storefront ID, shop ID, checkout domain, customer-account client ID + URL). Everything
  else in the env file (company identity, Discord/Turnstile/Resend/Upstash/OpenBrain,
  Anthropic) is Shopify-free.

### A.2 Cart + checkout handoff — HARD (the real lock-in)

- `app/routes/cart.tsx` — action switches on `CartForm.ACTIONS` (LinesAdd/Update/Remove,
  DiscountCodesUpdate, **GiftCardCodesAdd**, buyer identity). All mutations go through
  hydrogen's cart handler against the Storefront API cart.
- `app/routes/cart.$lines.tsx` — cart permalink / buy-now: builds a cart server-side and
  302s straight to `cartResult.checkoutUrl`.
- `CartSummary.tsx` → "Checkout" is a plain `<a href={cart.checkoutUrl}>` — **checkout,
  payment (Bancontact/cards via Shopify Payments), PSD2/SCA, EU VAT calculation, fraud
  screening, order creation and order-confirmation email all live on Shopify's side of
  that link.** The storefront never touches money.
- `CartMain` / `CartLineItem` use `useOptimisticCart`; `AddToCartButton`, `StackQuickAdd`
  (header/card quick-add), `DonationUpsell` (queries the hidden `firmware-donation`
  product) all submit `CartForm` fetchers.
- Promotions: the OpenStack "complete the stack" discount is a **Shopify automatic
  Buy-X-Get-Y** — `product-content.ts` explicitly says `discountPct` is display-only and
  "the real discount is the automatic BXGY configured in Shopify". `discount.$code.tsx`
  applies discount codes to the cart. Gift cards ride the same cart actions.

Replacing the cart *state* is easy (it's a list of ~6 SKUs in a cookie). Replacing what
`checkoutUrl` buys you — payments, SCA, VAT, fraud, orders, receipts — is the entire
hard part of any exit.

### A.3 Customer accounts — HARD to replicate, EASY to drop

12 routes (`account*.tsx`) + 8 GraphQL documents in `app/graphql/customer-account/`:
OAuth login/authorize/logout against the Customer Account API, order list + order detail,
addresses CRUD, profile update, newsletter subscribe/unsubscribe state, and a support
prefill query (name/email/last order into the support widget — also used by
`api.support.start.tsx` when logged in). None of the alternatives gives you hosted
passwordless accounts with order history for free. But: **zero customers exist today**,
so pre-launch this is deletable, not migratable.

### A.4 Catalog reads (Storefront API `#graphql`) — MEDIUM, and half-escaped already

Routes querying product/collection data: `products.$handle` (PDP: variants, prices,
stock, images, SEO), `collections.$handle` / `collections._index` / `collections.all`,
`search.tsx` (regular + predictive), `_index.tsx` (`HOME_FEATURED_QUERY`, CacheLong),
`[products.json]`, `[llms.txt]`, `pages.$handle`, plus `RelatedProducts`
(productRecommendations) and variant helpers (`getProductOptions`,
`getAdjacentAndFirstAvailableVariants`, `getSelectedOptions`). Fragments live in
`app/lib/fragments.ts` (338 lines).

Crucially, **`app/lib/product-content.ts` (997 lines) already holds the editorial truth
locally**: chapters/pins wired to board art, what's-in-the-box, downloads, tier ladders,
stack config, bundle composition, coming-soon flags — keyed by Shopify handle, sourced
from the hardware repos, with the file header noting the Shopify description field is "a
placeholder". What Shopify actually supplies to the PDP: **price, stock, variant IDs
(for the cart), product images (CDN), handle existence, SEO title/desc.** That is a
~50-line JSON file for this catalog. The catalog was never really in Shopify; only the
purchasable-variant skeleton is.

### A.5 Blog / newsletter — MEDIUM

- `/newsletter` + `[newsletter.rss]` read articles from a Shopify **blog** via
  Storefront API (`/blog` is just a redirect to it).
- Publishing: `scripts/publish-post.mjs` via an Admin API custom app (content + files
  scopes); `scripts/compose-newsletter.mjs`, `scripts/shopify-templates/gen.mjs`.
- Signup: `newsletter._index` action calls Storefront `customerCreate` with
  `acceptsMarketing` using the **private** storefront token; logged-in toggle uses
  Customer Account `customerEmailMarketingSubscribe/Unsubscribe`.
- Sends: manual from Shopify admin via **Shopify Email** (free at this list size) to the
  "Subscribed" segment — Shopify also handles unsubscribes/compliance.
Exit替: markdown-in-repo + Resend broadcasts (Resend already integrated for support).
A day or two of work, but you take on list management + unsubscribe compliance.

### A.6 Presentational / low-stakes hydrogen usage — EASY

- `Money` (ProductPrice + ~11 other imports): `Intl.NumberFormat` wrapper. Trivial.
- `Image` (`SmoothImage` wrapper + ~8 uses): srcset generation against Shopify's image
  CDN. Replace with plain `<img>` + self-hosted images (mobile-rework already deferred a
  white-bg product-image asset task to Stan — those assets are local anyway).
- `Analytics.Provider` + `getShopAnalytics` (root) + `Analytics.*View` on PDP/search/
  cart/collections: Shopify's analytics pipeline. Delete or swap for Plausible-style.
- Sitemaps: `[sitemap.xml]` `getSitemapIndex` + `sitemap.$type.$page[.xml]` `getSitemap`
  — generated from Shopify sitemap data. For ~10 products + fixed routes this is an
  afternoon of static code.
- `storefrontRedirect` 404 fallback, `useNonce`/`NonceProvider`, `Pagination`/
  `getPaginationVariables`, `flattenConnection` — all trivial.
- Session (`AppSession` on hydrogen's cookie session storage) — standard cookie session,
  easy to swap.

### A.7 Already Shopify-independent (bigger than expected)

- All 3D/visual identity: HeroScene, BoardArt + `public/boards/*` exports, SchematicViewer,
  FrameViewer, Pod/ProductPods visuals, wordmarks — generated from the hardware repos by
  local scripts.
- **All legal content**: `app/content/legal/` markdown + `sync:legal`, every legal route
  (algemene-voorwaarden, herroepingsrecht, privacy, cookies, shipping, warranty, terms,
  export-compliance, end-use, security…) renders local copy; company identity from
  `PUBLIC_COMPANY_*` env. The repo deliberately does **not** use Shopify's policy pages.
- **Support bridge**: entire `app/lib/support/*` + `api.support.*` routes run on
  Discord + Upstash + Resend + Turnstile + Anthropic (migrating to OpenBrain). Only the
  optional logged-in prefill touches Shopify.
- Releases/changelog + LatestCommit/WatchCard (GitHub API), open-source/firmware-partners/
  incutec/contact pages, i18n, theming, SEO builder (`lib/seo.ts` builds JSON-LD itself),
  robots.txt, llms.txt *structure* (content query aside).

**Coupling scorecard:** frontend framework (RR7 + Vite + Tailwind + three.js) — portable.
Content — already local. The welds are: cart/checkout (HARD), accounts (HARD but
droppable), catalog skeleton + newsletter + hosting (MEDIUM), and a bag of EASY wrappers.

---

## Part B — Context: Abicart (what sensepeek runs)

**What it is:** hosted e-commerce SaaS from Textalk AB (Gothenburg, one of Sweden's
oldest software companies) — the old "Textalk Webshop", rebranded Abicart. Fully hosted
storefront + admin, template themes, multi-language/multi-currency, an API
(developer.abicart.se), and the Nordic payment stack — **Klarna Checkout** as the
default embedded checkout (which is what sensepeek.com runs), plus Swish et al.

**Pricing (July 2026, abicart.com/pricing):** SEK, no transaction fees, 30-day trial.
Go **449 SEK/mo** (~€39) billed yearly / 539 monthly; Plus **699 SEK/mo** (~€61) — adds
customer login, discounts/gift cards, abandoned-cart, B2B; Pro **990 SEK/mo** (~€86) —
multishop, ERP/POS integrations. So its *entry* tier costs ~1.6× Shopify Basic (€24).

**Why a small Swedish hardware shop uses it:** it's the local default — Swedish vendor,
Swedish support, Klarna Checkout (how Swedes expect to pay), flat fee with zero
transaction fees, completely hands-off hosting. For a company like Sensepeek (PCBite
probes — engineers, not web people) that's rational: they picked the platform their
market already knew and never had a reason to move. It's the Swedish analogue of "just
use Shopify", chosen before Shopify ate Europe.

**For a Belgian merchant: no.** Technically open to international merchants
(multi-currency, EU selling), but ecosystem, docs, support and payment integrations are
Sweden/Nordics-centric — Klarna/Swish-first, no meaningful Bancontact story, SEK
pricing, tiny app ecosystem, and nobody runs it headless. More expensive than Shopify
Basic while offering strictly less for a Belgian EU-wide store. The takeaway from
sensepeek isn't "use Abicart" — it's the pattern: **a small hardware company should sit
on a boring hosted checkout and spend its hours on hardware.** That's an argument for
Path 3 below, not against it.

---

## Part C — Exit paths, ranked for this store

Numbers are July-2026, sourced via web research (Stripe/Mollie/Shopify BE pricing pages,
vendor pricing pages, shopify.dev self-hosting docs).

### Path 3 (do this): stay on Shopify, run it as a checkout+order engine, shrink lock-in

- **Cost:** Basic is **€24/mo annual (€32 monthly)** in Belgium. Shopify Payments Basic:
  ~2% + €0.25 EEA cards. Oxygen hosting is **included free** on Basic — headless
  Hydrogen on Basic is fully supported (Storefront API has no plan gate). Caveat: using
  a third-party PSP (e.g. Mollie) on Basic adds a **2% penalty per order** on top of the
  PSP fee — so under Shopify you use Shopify Payments, full stop.
- **What you keep for €24/mo:** hosted SCA-compliant checkout with Bancontact, EU VAT
  calculation at checkout, fraud analysis, order management + confirmation emails,
  gift cards, automatic BXGY stack discount, discount codes, customer accounts with
  order history, Shopify Email for the newsletter, free edge hosting + deploys.
- **Limitations you already live with:** checkout UI customization is effectively
  Plus-gated — on Basic you get branding tweaks only. Hydrogen pins react-router to
  7.16.x (known ceiling; Dependabot RR bumps get closed on sight).
- **Lock-in-reduction that's worth doing now (cheap, no migration):**
  1. Keep product truth in the repo (done — product-content.ts) and keep treating
     Shopify as "variant IDs + prices + stock" only. Don't start using metafields,
     Shopify pages, or checkout apps.
  2. Keep legal, support, releases, blog-composition local (done / mostly done).
  3. Isolate the Shopify seam: the 8 env vars + `context.ts` + `fragments.ts` +
     cart routes are the entire surface to swap later. Avoid spreading raw Storefront
     queries into new routes; go through the existing ones.
  4. Keep images exportable (the planned white-bg product shots should live in the repo
     or R2, not only Shopify Files).
- **Effort:** zero weeks. **Breaks:** nothing.

### Path 2 (contingency): minimal custom — repo catalog + Stripe Checkout, host on Cloudflare Workers

The honest exit for a 6-10 SKU store. The catalog half-exists in `product-content.ts`;
add a `catalog.ts` with price/stock/SKU per variant and the Storefront API becomes
unnecessary.

- **Payments — Stripe beats Mollie for this shop, on every relevant method:**
  - Stripe BE: EEA standard cards **1.5% + €0.25**; **Bancontact €0.35 flat**;
    iDEAL €0.29 flat. Stripe Checkout (hosted page) costs nothing extra and gives you
    SCA, Radar fraud screening, receipts, Apple/Google Pay.
  - Mollie: Bancontact **1.40% + €0.25** (percentage — worse than Stripe's flat €0.35
    for any basket over ~€7; your boards are €30-100+), EEA cards 1.80% + €0.25,
    iDEAL €0.32-0.39. No monthly fee, but no tax engine at all. Mollie's Belgian-ness
    buys nothing here.
- **EU VAT/OSS:** Stripe Tax pay-as-you-go **0.5% per transaction** on Checkout
  (calculation + OSS-ready per-country reports; filing manual via Intervat quarterly),
  or Tax "Complete" from €80/mo with actual OSS filing (Taxually) — overkill. Cheaper
  still: under the **€10k/yr EU cross-border B2C micro-threshold you may charge Belgian
  21% on everything** and skip OSS entirely, which is exactly where this store starts.
  Invoicing: B2C hardware needs receipts, not Stripe Invoicing (0.4%/invoice); generate
  a PDF invoice from the webhook if B2B asks.
- **Order store:** Stripe Checkout webhook → Upstash Redis (already a dependency) or
  Cloudflare D1; confirmation email via Resend (already a dependency). Stripe Dashboard
  is your order admin at this volume.
- **Hosting the RR7 app off Oxygen:** Cloudflare Workers is the least-friction target —
  Oxygen *is* workerd, so `caches`, `waitUntil`, env bindings map 1:1. Work items:
  replace `createHydrogenContext`/mini-oxygen dev with plain Workers + `wrangler dev`,
  drop `hydrogenRoutes`. Warning from Shopify's own self-hosting guide: it "might not be
  compatible with features introduced in Hydrogen 2025-05 and above" — i.e. this
  template; budget for hand-porting, not a recipe. Cost: Workers **$0-5/mo**. (Fly
  ~$3-7/mo or Vercel $20/mo possible but need Node adapters — more friction, no gain.)
  Side benefit: leaving hydrogen frees the react-router 7.16 pin.
- **What breaks / what you lose:** customer accounts + order history (Stripe customer
  portal covers receipts only), gift cards, automatic BXGY (Stripe has coupons/
  promotion codes; a real Buy-X-Get-Y needs custom line-item logic — the stack discount
  becomes "bundle SKU priced lower", which is arguably cleaner), Shopify Email
  (→ Resend broadcasts + your own unsubscribe handling), Shopify analytics, predictive
  search (local Fuse-style search over 10 SKUs is trivial), inventory sync (a number in
  a file — fine at this scale, but *you* now decrement stock on webhook and handle
  oversell races), fraud beyond Radar defaults, and Shopify's dispute tooling.
- **Effort:** realistically **2-4 weeks solo** (catalog module + local cart + Checkout
  session route + webhook/order store + emails + invoice PDF + hosting port + re-testing
  every PDP/cart flow). **Monthly:** ~€0-5 hosting + 1.5%+€0.25 / €0.35 Bancontact
  + 0.5% Stripe Tax (or 21%-everywhere and skip it).

### Path 1 (rejected for now): swap backend to a headless commerce platform

- **Medusa.js v2** — the only credible one. Mature (v2 GA late 2024, active releases,
  real admin UI), REST/JS SDK pairs fine with the existing RR7 frontend. But:
  self-hosting needs **Postgres + Redis + Node server (+worker)** — ~€25-40/mo and real
  ops on your plate; Medusa Cloud is $29 (dev-grade) / **$99/mo Launch** for production.
  Tax module applies EU rates but does **no OSS reporting/filing** — you still end up
  doing the Stripe-Tax-or-manual dance. **You must build the entire checkout UI
  yourself** (that's the biggest hidden cost vs Shopify's hosted checkout — payment
  element, SCA flows, address/VAT UX). Mollie support is a community plugin whose own
  README says it's untested in production. Effort: **3-6 weeks** + permanent ops.
  For 10 SKUs this is running a warehouse to store a shoebox.
- **Saleor** — cheapest cloud tier **$1,599/mo**; self-host = operating a Python/Django/
  GraphQL stack solo. Out.
- **Commerce Layer** — free Developer tier (100 orders/mo) then **enterprise-sales
  only**. Building a business on a free tier whose next step is a sales call is a trap.
  Out.
- **Swell** — $29/mo Starter, headless-native, hosted checkout; company is small,
  backend closed-source, EU payment-method/VAT story the weakest of the lot. Strictly
  more platform risk than Shopify at the same price. Out.

### Cost comparison (steady state, ~€2.5k/mo revenue assumption)

| Path | Fixed €/mo | Per-order (€75 basket, Bancontact) | Ops burden |
|---|---|---|---|
| Shopify Basic + Shopify Payments | 24 | ~2% + 0.25 ≈ €1.75 | none |
| Custom + Stripe (+ Stripe Tax) | 0-5 | €0.35 (+0.5% tax calc ≈ €0.38) | webhooks, stock, emails, disputes |
| Medusa self-host + Stripe | 25-40 | €0.35 | + database, upgrades, checkout UI |
| Medusa Cloud Launch + Stripe | 99 | €0.35 | checkout UI, integrations |
| Swell + Stripe | 29 | €0.35 | platform risk |

At €30k/yr revenue the total fee delta between staying and the cheapest exit is roughly
€500-700/yr. That does not buy back 2-4 weeks of solo migration — and certainly not
pre-launch.

---

## Recommendation

**Stay on Shopify through launch and the first ~2 quarters of real orders. Path 3.**
Blunt version: the store has never taken an order. Payments, domain, legal review and a
test order are the open launch blockers — replatforming now converts a nearly-done
launch back into a greenfield project, and the thing Shopify is doing for you (checkout,
SCA, Bancontact, VAT, fraud, order emails) is precisely the part you haven't built and
would have to. €24/mo is the cheapest compliant EU checkout available to you.

**Contingency: Path 2 (repo catalog + Stripe Checkout + Workers), not Medusa.** The
codebase is already unusually well-positioned for it — content, legal, support and
visuals are local; the Shopify surface is 8 env vars, one context file, one fragments
file, the cart routes and a price/stock skeleton. If Shopify jacks prices, kills
Basic-plan headless, or the 2%+€0.25 spread starts costing real money (roughly
>€100k/yr revenue before fees alone justify the move), the exit is 2-4 weeks with no
new vendor to trust. Revisit this document after two quarters of order data.

What to do *now* is only the free stuff: keep the seam thin (A.7 list), keep product
truth and images repo-side, and don't adopt any further Shopify-only features
(metafields, checkout apps, Shopify Pages, subscriptions).
