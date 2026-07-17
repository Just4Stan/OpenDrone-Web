# Growth stack research memo — 2026-07-06

(Agent-researched, spot-checked. Companion to growth-infra-brief.md.)

## One-screen summary

| Area | Decision | Cost |
|---|---|---|
| Analytics | Plausible Cloud -> Business tier; UTM -> `_utm_*` cart attributes -> `orders/paid` webhook -> server-side Events API | EUR 19/mo |
| Email | Resend only (Automations since Apr 2026: welcome/blast/drip native) | EUR 0 until >1k marketing contacts, then $40/mo |
| Pre-order | Full-payment pre-orders w/ dated ship window once payments live; NO selling-plan app (kills Bancontact) | EUR 0 |
| CRM | contacts/consents/interactions tables in OpenBrain + sqladmin panel | EUR 0 |

## A. Plausible
- Funnels, ecommerce revenue attribution, custom properties, Stats API = **Business tier (EUR 19/mo @10k pv)**. Custom events alone = Starter (EUR 9). UTM source reports = every tier.
- Since Oct 2025: one consolidated script configured via `plausible.init()`; old `script.tagged-events.revenue.js` chaining is legacy but still works.
- Stats API v2: visitors/conversion_rate/total_revenue/average_revenue by `visit:utm_source` — per-channel funnel + AOV directly queryable.
- Plausible CE self-hosted deliberately lacks funnels + revenue (cloud-only moat) — trap for this use case. Umami OSS has them free — credible cheap fallback, not worth migrating today. Cloudflare Web Analytics: pageview-only, 10% sample — disqualified.
- GDPR: cookieless EU-hosted analytics run banner-free across EU today; EDPB Guidelines 2/2023 expansive reading is contested, zero known enforcement vs Plausible/Umami; disclose honestly on privacy page.

## Shopify attribution seam (verified 2026-07, API 2026-07)
- Custom apps on Basic: created via **Dev Dashboard** since 2026-01-01 (not admin). Webhooks ORDERS_CREATE/ORDERS_PAID (`read_orders`) have no plan gate.
- **Basic-plan caveat: Level-2 protected customer data (name, email, address) is REDACTED from webhook payloads** (Grow+ required). Order id, totals, line items, note_attributes unaffected. => buyer email for CRM/Resend joins must come from our own records or Admin API lookup, not the webhook payload. Confirm with a test order.
- Cart `attributes` flow to order `note_attributes`/customAttributes; **`_underscore` prefix hides them from the customer**. Re-assert on fresh cartCreate (buy-now permalinks, expired carts).
- Custom pixels don't fire on the Hydrogen domain; `checkout_completed` fires on Shopify-hosted checkout but never sees original UTMs — fallback only. Thank-you-page scripts dead (force-upgrade by 2026-08-26). `Order.customerJourneySummary` unreliable on headless (cookie deprecation 2026-04-30) — bonus signal only.
- Cleanest chain: first-touch UTM first-party -> `_utm_*` cart attributes -> `orders/paid` webhook (HMAC) -> own ledger + Plausible server-side Events API revenue event.

## B. Resend (model changed 2025-2026)
- Nov 2025: Audiences -> global **Contacts + Segments** (custom properties, Topics).
- **Apr 2026: Automations shipped** — event-triggered flows (Delay/Condition/Wait-for-Event/Send/Contact-update), 10k runs/mo free. Trigger = custom event from our handler; `contact.created` webhook exists.
- Broadcasts: API, segment/topic targeting, schedulable, auto List-Unsubscribe + RFC-8058, managed unsubscribe page, auto-suppression.
- Pricing: free = 3k transactional/mo + **1,000 marketing contacts** + 10k automation runs. Pro Marketing $40/mo @5k contacts. Only cliff = crossing 1k contacts.
- Loops.so: skip (second US processor, no capability edge post-Apr-2026). Listmonk: only if EU-resident contact storage becomes hard requirement (no drip automation).

## C. Pre-orders on Shopify Basic (headless)
- Native selling plans work on Basic + headless BUT effectively require Shopify Payments/PayPal wallet flow and **Bancontact/iDEAL/Klarna cannot buy selling-plan items** — killer for BE. Apps (PreProduct, Purple Dot) inherit same constraint. Skip.
- Simple lawful route: "continue selling when out of stock", full payment via normal checkout (keeps Bancontact), **concrete ship window** ("Pre-order — ships October 2026") on PDP + cart line + confirmation email.
- CRD 2011/83/EU Art. 18(1): 30-day delivery is default "unless agreed otherwise" — a dated window accepted at purchase is that agreement. Belgian Art. VI.43 WER verbatim; full prepayment lawful (old ban died 2014). Withdrawal: 14 days from DELIVERY, unchanged for catalog pre-orders (made-to-order exemption does NOT apply); model form in T&Cs. If date slips: offer additional period, then full refund (Art. 18(2)-(3)); proactively offer cancel+refund.
- Real exposure = commercial: new-store delayed fulfillment is a classic Shopify Payments reserve trigger (10-30% held 30-120 days); Visa MNR dispute clock = 120 days from promised delivery.

## D. CRM
- Twenty v2.18: mature but Node+PG+Redis+worker self-host — a lot of machine for 10 SKUs. Adopt only if pipeline UI needed later.
- Attio: generous free tier, best API, but UK controller w/ non-EEA transfers — worst GDPR fit.
- EspoCRM: light + boring, but paid automation pack + dated UX.
- **Winner: OpenBrain** — contacts/consents/interactions tables + sqladmin/Starlette-Admin (or ~200 lines FastAPI+HTMX). Zero new containers/processors, RtbF one-liner, order linkage = FK + the webhook we build anyway.

## Caveats
- Banner-free analytics rests on contested (unenforced) EDPB reading.
- Resend Automations ~3 months old — expect rough edges.
- Test order needed to confirm exactly which webhook fields survive Basic-plan redaction.
