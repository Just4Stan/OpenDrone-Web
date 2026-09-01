# Growth architecture (analytics, attribution, email, ledger)

Implemented architecture of the growth stack. Verify behavior against the
current source and tests; this document is not a task tracker.

## Data spine

```
utm_* on inbound links we control
  -> Plausible (cookieless aggregate; no consent banner needed)
  -> first-touch UTM in sessionStorage (session-scoped, not persistent)
  -> hidden _utm_* cart attributes written on first add-to-cart
     (allowlist: _utm_source, _utm_medium, _utm_campaign, _landing; 64-char cap;
      the underscore prefix hides them from the customer at checkout)
  -> Shopify order note_attributes
  -> orders/paid webhook (HMAC-verified) -> Upstash ledger order record
notify signup -> Upstash ledger + Shopify customer (acceptsMarketing,
  notify-<handle> tag) + Resend contact upsert + welcome email (waitUntil)
```

## Modules and routes

- `app/lib/growth/ledger.ts`: sole owner of Upstash key shapes.
  `sig:<email>` signup/profile record (merge, don't clobber), `ord:<order_id>`
  attributed order, `att:idx` append-only export index. RtbF = DEL the sig key
  plus Resend contact delete.
- `app/lib/growth/attribution.ts`: first-touch capture; `ref=<source>` folds
  into `utm_source`.
- `app/lib/growth/resend.ts`: marketing client (global Contacts +
  `notify-<handle>` Segments). `app/lib/support/email.ts` is transactional
  support mail and stays separate.
- `app/lib/growth/survey-token.ts` + `app/routes/api.survey.tsx`: post-signup
  micro-survey, short-lived HMAC token gate, rate-limited.
- `app/routes/newsletter._index.tsx` action: signup pipeline described above.
- `app/routes/api.webhooks.shopify.tsx`: orders/paid receiver, 200-fast with
  `waitUntil`.
- `scripts/launch-blast.mjs`: Resend broadcast for launch emails, dry-run by
  default.

## Plausible events

Client (via `trackEvent` in `app/lib/growth/plausible.ts`, all carrying the
first-touch `source` prop, folded to the canonical vocabulary below plus
`other`/`direct`): `PDP View` (product), `Variant Select` (product,
variant), `Stack Toggle` (product, partner, surface), `Cart Drawer Open`,
`Add to Cart` (product), `Share Cart`, `Checkout Click` (+ cart total as
revenue), `Notify Signup` (product), `Survey EU Premium` / `Survey
Interview` (answer).

Server (`app/lib/growth/plausible-server.ts`): `Purchase` (source, campaign,
+ order total as revenue), sent by the webhook route on the orders/paid
topic only (orders/create still records the ledger order but is never a
Purchase; creation can precede payment). Deduped via an atomic
`pev:<order_id>` claim plus the `purchaseEventAt` stamp on the `ord:`
record; production host only.

Checkout-abandonment counter without Plausible Business: the checkout CTA
beacons `/api/track/checkout`, which increments the ledger's `chk:<day>`
counter; buy-rate = `ord:` count / `chk:<day>`. Full model + the maintainer's
Plausible UI goal/funnel checklist: `drafts/analytics-brief.md`.

## Constraints (decided, do not relitigate in code)

- No pre-orders, no reserve/deposit flows (maintainer, 2026-07-06). Notify-at-launch
  signup, then normal sale.
- Shopify Basic webhook payloads redact customer name/email/address (Level-2
  protected data). Email joins come from our own `sig:` records, never the
  webhook payload.
- No consent banner: Plausible is cookieless and first-touch storage is
  sessionStorage-only, disclosed as functional in the cookie policy.
- OpenBrain becomes the durable CRM only after EU hosting + DPA review; until
  then the Upstash ledger is the system of record
  (`drafts/archive/openbrain-crm-scope.md` holds the buildout scope).

## Canonical UTM values (lowercase, exactly these)

- `utm_source`: youtube, discord, reddit, bardwell, newsletter, x
- `utm_medium`: video, social, chat, email
- `utm_campaign`: `launch-<sku-handle>`, `video-<slug>`, or `evergreen`
- Short links may use `?ref=<source>`; the site folds it into `utm_source`.

Ready-to-paste link templates: `drafts/archive/utm-conventions.md`.
