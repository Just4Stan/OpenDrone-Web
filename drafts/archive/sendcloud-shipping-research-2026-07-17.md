# Sendcloud + Shopify checkout rates research, 2026-07-17

Point-in-time research (agent, web-sourced). Question: can checkout shipping
rates reflect actual carrier cost dynamically instead of flat zone rates?
Verdict: not on Shopify Basic in 2026, and it would buy nothing for this
catalog. Decisions extracted to `drafts/coordination.md`.

## What the Sendcloud integration does

Order sync into Sendcloud, shipping-rule mapping from the checkout method
name to a carrier product, label creation, tracking sync, and a service-point
picker. It never injects prices into checkout: Sendcloud states "Sendcloud
does not import shipping rates into Shopify; in Shopify you create flat
shipping rates".
https://support.sendcloud.com/hc/en-us/articles/360049346772-Setting-up-shipping-methods-in-Shopify

## Carrier-calculated shipping (CCS) availability, 2026 plans

- Included: Advanced and Plus only.
- Grow: USD 20/mo add-on, or free on annual billing after a support ticket.
- Basic and Starter: NOT AVAILABLE at any price. Three independent sources
  agree (Shopify help, Shipmondo, Zapiet). The old Basic+annual waiver now
  applies to Grow.
  https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/third-party-carrier-calculated-shipping
- Every live-rate app uses the CarrierService API and requires CCS on the
  store. Cheapest live-rate path: Basic annual (EUR 24) to Grow annual
  (EUR 69), +EUR 45/mo before app fees.

## Sendcloud as a rate source

No CarrierService integration on normal plans. Sendcloud's "Dynamic
Checkout" app is Shopify Plus + premium Sendcloud plans only, and serves
rates you configure in Sendcloud, not raw carrier cost. Third-party rate
apps (Calcurates, Boxify, ShipperHQ) quote carrier-direct accounts, not your
Sendcloud contract rates, and still need CCS.

## Headless notes

Hydrogen carts redirect to the Shopify-hosted checkout, so rates, CCS, and
checkout apps behave identically to a theme store. Shopify Functions
delivery customization on Basic can only hide/rename/reorder existing
options, never create rates. The Plus-only pickup-point generator API is out
of reach.

## Service points (Mondial Relay / bpost pickup) on Basic

Sendcloud's supported flow on Basic: a flat-rate "Pickup point" method at
checkout; the buyer picks the exact point AFTER payment on the thank-you
page via Sendcloud's checkout-app block (works with Hydrogen because the
thank-you page is Shopify-hosted); auto-assign covers non-pickers. In-checkout
pickers are Grow+ or Plus-only apps.
https://support.sendcloud.com/hc/en-us/articles/26012711559185-Shopify-service-points-setup-guide

## Rate-card sync alternative (no CCS)

A script can pull contract prices from the Sendcloud API and write
weight-banded flat rates via Admin GraphQL `deliveryProfileUpdate`
(write_shipping scope), run monthly. Gotchas: order-weight conditions need
accurate variant weights + packaging padding; no dimensional logic (letterbox
vs parcel approximated by weight bands); Sendcloud prices are ex-VAT and BE
consumer prices must include 21% VAT; delete-and-recreate method definitions
each sync (conditionsToUpdate can silently no-op).

## Bottom line for this store (10 SKUs, sub-250 g, battery-free)

| Option | Cost delta | Effort | Verdict |
|---|---|---|---|
| Flat zones hand-tuned to the rate card | EUR 0 | ~2 h, retune 1-2x/yr | DO THIS |
| CCS + rate app | +EUR 45/mo minimum | high | Unavailable on Basic; useless for a one-band catalog |
| Weight-band sync script | EUR 0 | ~1 day + cron | Only if multi-unit orders cross bands or rates churn |

Virtually every order lands in one or two price bands per zone, so dynamic
rates would return the same numbers a flat table encodes. Tune the zones to
the rate card (including 21% VAT), add one home + one pickup-point method per
zone, and add the missing rest-of-world zones.
