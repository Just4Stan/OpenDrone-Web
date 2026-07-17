# Funnel analytics brief (plan of record)

*Lane feat/analytics-funnel, 2026-07-17. Answers Stan's four questions with
data: where do customers come from, what is their buy-rate per channel, where
do they get stuck, and what makes them buy or not buy. Companion to
`docs/growth-architecture.md` (the settled spine) and
`drafts/archive/growth-infra-brief.md` (the original buildout).*

## 1. The funnel model

One funnel, five steps, every step carrying the same two props so any step can
be broken down per channel and per product:

```
Session (Plausible visit, UTM-tagged entry)
  -> PDP View            (product, source)
  -> Add to Cart         (product, source)
  -> Checkout Click      (source) + cart total as revenue
  -> Purchase            (source, campaign) + order total as revenue  [SERVER]
```

- `source` is the session's first-touch channel from
  `app/lib/growth/attribution.ts` (`utm_source`, `ref` fallback, else
  `direct`), folded into the bounded vocabulary: a canonical value
  (`CANONICAL_SOURCES`, mirroring `docs/growth-architecture.md`), `other`
  for anything non-canonical, `direct` when absent. A crafted
  `?utm_source=` link cannot spray junk values across the dashboard; the
  raw (capped, lowercased) value still reaches cart attributes and the
  order ledger. Canonical values live in
  `drafts/archive/utm-conventions.md`.
- `product` is the Shopify handle, low-cardinality by construction.
- Steps 1 to 3 are client events fired through the `trackEvent` helper
  (`app/lib/growth/plausible.ts`). Step 4 happens on Shopify's checkout
  domain, outside our pages, so it is fired server-side from the orders/paid
  webhook (`app/lib/growth/plausible-server.ts`); channel comes from the
  order's `_utm_*` note_attributes, which are the same first-touch record
  promoted through cart attributes.
- Pre-launch products run a shorter variant of the same funnel:
  PDP View -> Notify Signup (product, source).

### The four questions, mapped

| Question | Answer source |
|---|---|
| Where do customers come from? | Plausible top sources + the `source` prop on every funnel event; ledger `ord:` records carry the same attribution for revenue-weighted answers |
| Buy-rate per channel? | Funnel step conversion filtered by `source` (Plausible Business funnels), and independently: ledger `ord:` count / `chk:<day>` clicks (site-wide), `ord:` grouped by attribution (per channel) |
| Where do they get stuck? | Step-to-step drop-off in the funnel; Variant Select / Stack Toggle / Cart Drawer Open / Share Cart are the between-step diagnostic events |
| Why buy or not buy? | Not answerable by counters. Post-purchase micro-survey + exit-intent prompt, specced as follow-up lanes in section 6 |

## 2. What already existed (and what it answers)

| Piece | Answers |
|---|---|
| Plausible pageviews + UTM (root.tsx script, cookieless) | Traffic volume and top-level channel mix; cannot join page path to a custom channel prop |
| First-touch attribution (sessionStorage, `attribution.ts`) | The per-session channel every event props carry |
| `Notify Signup` event + `sig:<email>` ledger record | Pre-launch demand per product per channel |
| `Add to Cart`, `Checkout Click` events | Mid-funnel intent, client-side |
| Hidden `_utm_*` cart attributes -> order note_attributes | The channel join that survives into Shopify orders |
| orders/paid webhook -> `ord:<order_id>` ledger record | Revenue, AOV, items per channel, server-side truth |
| `Survey EU Premium` / `Survey Interview` events + ledger fields | EU-assembly premium sentiment among notify signups |

The gap this lane closed: no per-product-per-channel top of funnel (PDP View),
no engagement diagnostics between the steps, no conversion event at all after
the buyer left our domain, and no way to compute buy-rate without paying for
Plausible Business.

## 3. What this lane adds

### Event schema (complete, after this lane)

| Event | Fired from | Props | Revenue |
|---|---|---|---|
| `PDP View` | PDP mount / product switch (`products.$handle.tsx`) | `product`, `source` | no |
| `Variant Select` | tier ladder + option pills, user clicks only (`products.$handle.tsx`, `ProductForm.tsx`) | `product`, `variant`, `source` | no |
| `Stack Toggle` | stack-builder add on any surface (`StackQuickAdd.tsx` pdp, `ProductPods.tsx` pod, `CartCompanion.tsx` cart) | `product` (pdp/pod only), `partner`, `surface` (pdp/pod/cart), `source` | no |
| `Cart Drawer Open` | deliberate drawer opens: full open or pinned hover preview; grazes excluded (`Aside.tsx` provider) | `source` | no |
| `Add to Cart` (existing) | successful LinesAdd (`AddToCartButton.tsx`) | `product`, `source` | no |
| `Share Cart` | cart-link copy button (`CartSummary.tsx`) | `source` | no |
| `Checkout Click` (existing) | cart checkout CTA (`CartSummary.tsx`) AND the PDP ShopPay express button (`ProductForm.tsx`, #304), via the shared `trackCheckoutClick` helper (`checkout-beacon.ts`) | `source` | cart total, or the express item's price |
| `Notify Signup` (existing) | notify success (`NewsletterSignup.tsx`) | `product`, `source` | no |
| `Survey EU Premium` / `Survey Interview` (existing) | micro-survey answers | `answer` | no |
| `Purchase` (NEW, server) | orders/paid webhook, Plausible Events API (`plausible-server.ts`) | `source`, `campaign` | order total |

Design rules baked in: every event goes through the one `trackEvent` helper,
props stay low-cardinality (product handles, the folded source vocabulary,
fixed surface/variant names), no free-form strings, no new events without
touching this table. `campaign` on Purchase is the one open-ended prop
(slug-based by convention, 64-char cap, only reachable through a real paid
order).

### Server-side Purchase event

`app/routes/api.webhooks.shopify.tsx` now POSTs a `Purchase` event with
revenue to `https://plausible.io/api/event` (no API key needed for event
ingestion) from inside the existing waitUntil job. Details:

- Channel from the order's `_utm_*` note_attributes, folded to the same
  bounded source vocabulary as the client events; `direct` when absent.
- Sent on the orders/paid topic ONLY. orders/create still records the
  ledger order, but creation can precede payment (pending payment
  methods), so it is never a Purchase.
- The ledger `ord:` write happens BEFORE the Plausible send, and the send
  carries a 5s timeout: a slow or down Plausible can never stall the
  webhook job past its waitUntil budget and cost us the order record
  (Shopify does not retry an ACKed delivery).
- Deduped by an atomic `pev:<order_id>` claim (SETNX) taken before the
  send, then a `purchaseEventAt` stamp on the `ord:` record. Concurrent
  deliveries (redeliveries, the create + paid pair) elect one winner; a
  GET-check latch alone would double-send. A failed send releases the
  claim, so a redelivery retries.
- Host-guarded to opendrone.be: local and preview webhook tests never write
  to the production dashboard.
- All server events share one synthetic User-Agent and no client IP, so
  Plausible shows them as one "visitor". Counts, revenue and prop breakdowns
  are correct; visitor counts on this one event are meaningless. There is no
  session join to the buyer's browsing, by design (cookieless posture).

### Checkout-abandonment counter (no Plausible Business required)

`chk:<YYYY-MM-DD>` (UTC day) in the Upstash ledger counts Checkout Clicks,
incremented by a sendBeacon to the new rate-limited `/api/track/checkout`
route (always 204, per-IP + global caps, production host only, no body,
no PII). Every checkout entry point fires it through the one
`trackCheckoutClick` helper: the cart CTA and the PDP ShopPay express
button (#304). A path that skips the helper undercounts the denominator
while its orders still land in the numerator; add any future express
button to the helper, not around it. With `ord:` records on the other
side:

- buy-rate = paid orders that day / `chk:<day>`
- checkout abandonment = 1 minus that

Known caveat: ShopPay express checkouts start from the variant list, not
from our cart, so they carry no `_utm_*` cart attributes; their orders
record and count correctly but attribute as `direct`.

Key shapes stay documented in `app/lib/growth/ledger.ts`, the single owner.

## 4. What remains manual (Stan's Plausible UI tasks)

Plausible goals/funnels are dashboard configuration, not code. After the
Business upgrade (funnels, revenue and Stats API are Business-gated,
EUR 19/mo yearly, follow-up item from the growth brief):

1. **Goals** (Site settings -> Goals -> Add goal -> Custom event), names must
   match exactly: `PDP View`, `Variant Select`, `Stack Toggle`,
   `Cart Drawer Open`, `Add to Cart`, `Share Cart`, `Checkout Click`,
   `Notify Signup`, `Purchase`. (`Survey EU Premium` and `Survey Interview`
   exist already if configured with Lane C; add if missing.) `Checkout Click`
   and `Purchase` carry revenue and will show it once the goal exists.
2. **Funnels** (Site settings -> Funnels), from those goals:
   - "Buy funnel": PDP View -> Add to Cart -> Checkout Click -> Purchase
   - "Notify funnel" (pre-launch): PDP View -> Notify Signup
3. Per-channel read: open the funnel, then filter the dashboard by the
   `source` prop (or by top-level Source for referral traffic).
4. Sanity check after the first real order: `Purchase` count matches Shopify
   orders and the `ord:` ledger.

Also still open from the growth brief: `SHOPIFY_WEBHOOK_SECRET` and
`SHOPIFY_ADMIN_API_TOKEN` must be set in Oxygen (Production + Preview) for
the webhook and for notify tagging; the token is also the unblock for the
post-purchase survey below.

## 5. Known blind spot: Shopify-hosted checkout (Basic plan)

Once the buyer clicks Checkout they are on Shopify's domain. On Basic there
is no checkout extensibility, no web pixel worth shipping (deliberately not
shipped, see growth brief), and webhook payloads redact customer PII. So:

- Per-step checkout data (shipping info entered, payment method chosen,
  which field they abandoned on) is NOT available and cannot be made
  available at this plan tier. Do not try to instrument it.
- The delta between `Checkout Click` events (and the `chk:<day>` counter) and
  orders/paid webhooks IS the checkout-abandonment metric. It is one number,
  not a step breakdown. That is the accepted resolution.
- Shopify's own admin conversion report remains the only per-checkout-step
  view, manual reading only.

## 6. "Why buy / why not buy": follow-up lanes (specced, NOT built here)

Counters say where, never why. Two small lanes, both reusing existing
machinery, no new persistent identifiers, privacy posture unchanged:

### Lane: post-purchase one-click email survey (effort: ~1 day)

- Trigger: orders/paid webhook job (already exists) sends a transactional
  email via Resend (`app/lib/support/email.ts` renderer or a growth
  template): "What nearly stopped you from ordering?" with 4 or 5 one-click
  answer links + a free-text fallback page.
- Auth: reuse the survey-token pattern (`app/lib/growth/survey-token.ts`):
  each answer link carries a short-lived HMAC token bound to the order, so
  the endpoint needs no login and cannot be spammed cross-order. Answers
  merge into the ledger (new `whyBuy` field on the order or sig record,
  ledger.ts owns the shape).
- BLOCKER: Basic-plan webhook payloads redact the buyer email. The join is
  an Admin API order lookup by id, which needs `SHOPIFY_ADMIN_API_TOKEN` in
  Oxygen (listed in section 4, not landed at time of writing). Until then
  this lane cannot send anything.
- GDPR: transactional post-purchase contact, one mail per order, no
  marketing content, answer stored against the order id. Flag for the
  privacy-policy processor table anyway.

### Lane: exit-intent one-question prompt (effort: ~0.5 day, optional)

- One question ("What stopped you today?") with 3 or 4 canned answers,
  shown at most once per session (sessionStorage latch, same posture as
  attribution) when a cart-holding visitor signals exit (desktop:
  mouse-out past the viewport top; mobile: skip, exit intent is not
  reliably detectable without dark patterns).
- Answers go to a Plausible event (`Exit Reason`, props: answer, source),
  no ledger write needed, fully anonymous.
- Risk: annoyance. Ship behind a quick Stan yes/no; default off. Do not
  build any variant that interrupts checkout.

## 7. Verification notes (this lane)

- `npm run typecheck` and `npm run lint` green.
- Events verified on port 3003 via browser network/console: Plausible's
  script deliberately ignores localhost (logs "Ignoring Event: localhost"),
  so the check is that the calls are attempted with the right names/props,
  plus the `/api/track/checkout` beacon returning 204.
- The Purchase path is host-guarded, so its full verification is Stan's
  first real (or test) order on opendrone.be: expect one Purchase in
  Plausible, one `ord:` record with `purchaseEventAt` set, and `chk:<day>`
  incremented by the preceding click.
