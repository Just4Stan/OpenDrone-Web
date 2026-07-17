# Shopify growth research, 2026-07-17

Point-in-time research (agent, web-sourced) commissioned by Stan: reviews on
headless Hydrogen, unused Basic-plan features, launch checklist, email
marketing tooling, Sendcloud shipping rates and strategy, payment methods.
Decisions extracted from this doc live in `drafts/coordination.md`.

## 1. Reviews on headless Hydrogen

Judge.me (already installed) integration paths:

- Official `@judgeme/shopify-hydrogen` npm widget package: works but
  effectively unmaintained (v2.0.0, ~3 yrs old), client-side CDN widgets that
  flash on render; full CSS control paywalled ($15/mo Awesome plan).
  https://www.npmjs.com/package/@judgeme/shopify-hydrogen
- REST API: `https://api.judge.me/api/v1`, GET/POST reviews, review-request
  send; public token for browser GETs, private token server-side. Not
  plan-gated. https://judge.me/api
- Metafield sync: Judge.me writes standard `reviews.rating` /
  `reviews.rating_count` product metafields, queryable via Storefront API for
  SSR stars + JSON-LD.
  https://judge.me/help/en/articles/8394936-displaying-product-ratings-and-review-counts-with-judge-me-metafields
- Export/lock-in: unlimited CSV export on the Free plan (title, body, rating,
  reviewer, product handle, image URLs). Clean exit path.
  https://judge.me/help/en/articles/8236266-exporting-reviews
- Cost: $0 (Free covers unlimited reviews, request emails, photos/videos,
  rich snippets).

Competitors, all ruled out on price for a 10-SKU pre-launch store: Okendo
(headless gated to $499/mo Advanced), Loox (API from $49.99/mo, no
programmatic review creation), Yotpo (free tier caps at 50 orders/mo, then
~$79 to $1000+/mo). DIY (own DB + schema.org AggregateRating): $0, zero
lock-in, but ~1-2 weeks rebuilding moderation + review-request email plumbing
Judge.me gives free.

Recommendation: Judge.me Free via API + metafields, skip their widget
package. Render aggregates server-side from metafields (own JSON-LD), fetch
full reviews server-side via REST in the Oxygen loader, render in own
theme-token components, optional own submission form behind Turnstile posting
to `POST /reviews`. $0, no third-party JS, frontend fully yours; free CSV
export + API makes a later DIY migration a one-off import script. Effort:
1-2 days.

## 2. Unused Basic-plan features (headless viability / effort / exit impact)

| Feature | Works headless? | Effort | Exit impact | Verdict |
|---|---|---|---|---|
| Abandoned checkout emails | NO natively: recovery automation only fires for Online Store / Buy Button channels; Hydrogen-channel checkouts are excluded. https://community.shopify.com/c/hydrogen-headless-and-storefront/abandoned-checkout-email-are-not-sending-for-custom-channel/m-p/2245619 | M (DIY) | Low if DIY | Build it: query abandoned checkouts via Admin API (`abandonedCheckoutUrl` resumes checkout), send via Resend. |
| Shopify Flow | Yes (admin events). "Send HTTP Request" action needs Grow+, so Flow can't call Resend on Basic. | S | Low | Use for low-stock alerts, customer tagging, high-risk order hold. |
| Gift cards | Yes at checkout; Admin API creation is Plus-only. | S | Medium-high: outstanding balances are unexportable liabilities | Skip pre-launch. |
| Shop Pay | Yes; Hydrogen ships `ShopPayButton`. | S | None | Enable; genuine conversion lever. |
| Shop app listing | NO: eligibility requires the Online Store channel. | n/a | n/a | Ineligible. Buyers still get Shop-app order tracking. |
| Markets | Yes via `@inContext(country)`; Basic includes 3 markets. 1.5% currency-conversion fee makes multi-currency near-worthless for a eurozone store; value is per-market gating (intersects sanctions blocks). | M | Medium | Low priority. |
| Discounts | Yes, both kinds. Automatic discounts need zero storefront code; codes apply via `cartDiscountCodesUpdate`. | S | Low | Lowest-effort conversion lever on the list. |
| Back-in-stock | No native feature on any plan; apps are theme-widget based. | M (DIY) | None if DIY | Build it: PDP notify form into the signup ledger + `inventory_levels/update` webhook + Resend. High value for 10 SKUs cycling with fab batches. |
| Bundles | Yes: Cart Transform functions run server-side; you render presentation yourself. | M | Medium | Post-launch AOV lever ("board + ESC" kits). |

Priority: automatic discounts, Flow low-stock/tagging, Shop Pay button (all
S) now; DIY abandoned-checkout and DIY back-in-stock (both M, on-mission for
lock-in) next.

## 3. Launch checklist: top 10 for this store

1. Full end-to-end test orders (Shopify Payments test mode: Hydrogen cart,
   checkout, confirmation email, Sendcloud label, refund). The
   Hydrogen-to-checkout handoff is where headless stores break silently.
2. Enable local EU payment methods (Bancontact especially; section 6).
3. EU tax: OSS registration + VAT-inclusive prices + tax on shipping.
4. Shipping zones with rates verified against actual Sendcloud cost and a
   free threshold slightly above expected AOV.
5. Checkout editor: address autocomplete + validation on, strip optional
   fields, no tipping (~22% of abandonment traces to long forms, Baymard).
6. Brand the checkout (logo, gold/black, typography) so the
   storefront-to-checkout jump doesn't read as phishing.
7. New passwordless customer accounts, optional at checkout.
8. Brand all Shopify notification emails, remove "Powered by Shopify".
9. Headless SEO explicitly: JSON-LD Product/Organization/Breadcrumb,
   per-route canonicals, sitemap in Search Console, Judge.me stars in rich
   results.
10. Review fraud analysis on every early order; hold high-risk orders. Small
    electronics is chargeback-prone; chargebacks can get a new Shopify
    Payments account suspended.

Plan caveat: full Checkout Branding API is Plus-only; Basic gets the checkout
editor (logo, colors, fonts).

## 4. Email marketing: Resend vs Shopify Email vs Klaviyo

- Resend (current): $0 at ~1k contacts, $40/mo at 5k. Automations shipped
  April 2026 (visual builder + API, wait steps, event triggers); triggers are
  custom API events, so abandoned-cart needs own webhook wiring (which
  already exists). GDPR: legal via DPA + SCCs but data stored in US
  regardless of EU sending region. Exit posture: best of the three.
- Shopify Email: 10k free emails/mo then $1/1,000. Its abandoned-checkout
  automation is documented for Online Store/Buy Button only (same headless
  gap); deepest lock-in (flows, templates, consent state inside Shopify).
- Klaviyo: ~$30/mo at 1k, ~$100/mo at 5k. Best automation; official Hydrogen
  guide requires manual klaviyo.js + consent banner in the EU. Lists export;
  flow logic does not.
- Brevo is the only genuinely EU-resident option if EU data residency ever
  becomes a hard requirement.

Recommendation: stay on Resend. Skip Shopify Email as primary. Revisit
Klaviyo only if browse-abandonment/predictive segments become the bottleneck
post-launch.

## 5. Shipping (Sendcloud from Leuven)

Rates (Sendcloud published BE rates, excl. fuel;
https://www.sendcloud.com/be/prijzen/):

- BE domestic tracked: Mondial Relay pickup from EUR 2.98, DPD pickup 4.16,
  DPD home 5.16, bpost home 5.79-6.10, PostNL home 5.99.
- EU tracked sub-1 kg: pickup point EUR 3.45-9; home NL/DE/FR EUR 6-10.
- UK/US/RoW: gated rate card; realistic tracked sub-500 g bands: UK EUR
  12-20, US EUR 18-30, RoW EUR 20-35 (bpost consumer 2026 rates are the
  upper bound, EUR 36+ tracked to US).
- Untracked letter mail: barely cheaper domestically, seller bears loss risk,
  bpost registered mail no longer accepts goods from 2026.

Strategy: flat rate per zone + free above threshold is correct and, on Basic,
the only option (carrier-calculated checkout rates require Advanced/Plus).

Two-delivery-methods law (verified): Art. VI.45/2 WER (in force 21 Sept
2024) requires at least two delivery methods for Belgian consumers (home +
pickup point counts). Companies under 3 years old are exempt, but a pickup
tier is cheaper than current cost anyway.
https://www.eylaw.be/insights/webshops-have-to-offer-at-least-two-delivery-methods-as-of-september-2024

Free vs charged evidence: Baymard puts "extra costs too high" as the top
actionable abandonment reason (39-48%); the killer is surprise at checkout,
not the fee, so show cost early. No rigorous study isolates baked-in vs
checkout-charged for sub-50-EUR technical products; hobbyists routinely pay
shipping at Mouser/Digikey-class shops, so a transparent modest flat fee is
defensible.

Config assessment vs current (BE 5 free>70; EU 9.95 free>70; no RoW): BE fine;
EU 9.95 is high vs 6-10 cost, consider 7.95 home + ~4.95 Mondial Relay pickup
tier; keep free>70; missing rest-of-world rates lose real sales (FPV demand
is heavily US/UK and an unshippable checkout is a silent hard bounce): add
at-cost UK ~12-15, US/CA ~18-25, RoW ~25-30 tracked; add a BE pickup-point
option for the two-methods rule.

## 6. Payments (Shopify Payments Belgium, Basic)

Available: cards (Visa/MC/Maestro/Amex/UnionPay), Apple/Google Pay, Shop Pay,
Bancontact (manual activation, live mode only), iDEAL|Wero (eligibility gate
of ~100 processed orders, so likely not day-one), Klarna. SEPA/Sofort not
offered to BE merchants.
https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries/belgium/payment-methods

Fees (Basic, BE): EU cards 2.0% + EUR 0.25; Amex/non-EU 3.2% + EUR 0.25.
PayPal Express is exempt from the 2% third-party-gateway penalty when Shopify
Payments is active. PayPal BE: 3.40% + EUR 0.35, EUR 14 dispute fee, possible
early-account holds. On a EUR 50 order: card ~EUR 1.25, PayPal ~EUR 2.05.

Market evidence: Bancontact dominates BE (382M online payments 2024); iDEAL
~70-73% of Dutch online purchases; PayPal is Germany's #1 online method
(~27.7% of e-commerce revenue, EHI). Baymard: ~9-13% abandoned because their
preferred method was missing.

Rollout: launch with Shopify Payments (cards + Bancontact + Apple/Google Pay
+ Klarna); add PayPal at/near launch for Germany (the FPV hobby's biggest EU
community); enable iDEAL once past the order-count gate.

## Cross-cutting takeaways

- Two native features this store might assume it has do NOT work for
  headless channels: abandoned-checkout recovery emails and the Shop app
  listing. Fill the abandoned-cart and back-in-stock gaps with the existing
  Resend + webhook + ledger infra (on-mission for lock-in minimization).
- Cheapest high-impact wins before launch: automatic launch discount, Shop
  Pay button, Bancontact activation, checkout branding + address
  autocomplete, JSON-LD with Judge.me metafield stars, rest-of-world shipping
  rates, BE pickup-point tier.
- Total new recurring spend recommended: EUR 0.
