# Order Readiness

How an order actually flows through this **headless Hydrogen + Oxygen** store, and
the concrete go-live checklist to make "money in → product out" work end to end.

Most items here are **Shopify admin actions only the merchant can do** (bank/KYC,
VAT registration, shipping rates). This doc tells you exactly which, in order, and
what the storefront already handles.

## How a headless order works

This store is headless: the **storefront** is the Hydrogen app on Oxygen
(`opendrone.be`); the **checkout, payments, orders, inventory and emails** all live
in Shopify's backend. Hydrogen does not process payments.

1. Hydrogen builds the cart through the **Storefront API** (`app/lib/fragments.ts`,
   `cart.tsx`).
2. The cart's **`checkoutUrl`** redirects the buyer to **Shopify-hosted checkout**.
   That page is owned by Shopify — it renders the configured payment methods,
   shipping rates and taxes.
3. On payment, Shopify **creates the order, decrements inventory at the location,
   and sends the order-confirmation email**.
4. The merchant **fulfils** the order in admin → Shopify sends the
   shipping-confirmation email with tracking.
5. The buyer sees order status/history back on `opendrone.be/account` via the
   **Customer Account API** (`app/routes/account.*`).

The implication: the storefront can be perfect and **no order will ever complete
until payments, shipping and taxes are configured in admin.** Those three are the
launch-blockers.

## Current store state (audited 2026-05-22)

| Setting | Value | Note |
|---|---|---|
| Plan | **Basic** | Can accept payments; no carrier-calculated shipping/Markets Pro |
| Currency | EUR | |
| Timezone | Europe/Brussels | |
| Billing country | Belgium (Retie) | |
| Location | **OpenDrone Leuven** (active, ships inventory) | single location |
| Prices include tax | **Yes** (`taxesIncluded=true`) | correct for EU B2C VAT-inclusive |
| Primary domain | **`ktjqug-jw.myshopify.com`** | custom domain not yet primary — see §6 |
| Catalog | 5 line products + 4 accessories, all ACTIVE, stocked | 2 missing SKUs — see §7 |
| Compliance metafields | 15 `custom.*` definitions present | |

> The "OpenDrone Infra" Admin app token **cannot read** payments, shipping
> (`deliveryProfiles`), markets, or publications — those scopes aren't granted. So
> the items below were verified manually / must be checked in admin, not by script.

## Go-live checklist

### 1. Payments — **blocker**
Without an active payment provider, `checkoutUrl` dead-ends at the payment step.

- **Belgium options:** Shopify Payments (cards + **Bancontact** + Apple/Google Pay,
  one-click activation, settles to a BE IBAN) **or** Mollie (Bancontact at a flat
  €0.39, iDEAL, cards, PayPal, SEPA — broadest EU local-method coverage).
- **Bancontact is essential** for a BE storefront — it's the dominant local method.
- Action (admin → Settings → Payments): activate a provider, complete KYC, connect
  the bank account. Enable Shop Pay if using Shopify Payments (one-click repeat buyers).

### 2. Shipping — **blocker**
- Admin → Settings → Shipping and delivery → the **OpenDrone Leuven** profile.
- Define zones + flat/weight rates: **Belgium**, **EU**, **Rest of world** (or
  restrict to where you'll actually ship). Set real costs — under-pricing shipping
  eats margin; missing rates abandon carts.
- Basic plan = manual/flat rates only (no live carrier rates). Set product **weights**
  so weight-based tiers work.

### 3. Taxes — **blocker for cross-border**
- VAT-inclusive pricing is already on (`taxesIncluded=true`). Good for EU consumer pricing.
- Admin → Settings → Taxes and duties → European Union → **Collect VAT**:
  - If EU cross-border sales exceed **€10,000/yr**: register for **OSS** (One-Stop-Shop)
    and select "Collect using OSS registration" + enter the VAT number. Then each
    buyer is charged their own country's VAT rate; you file one OSS return.
  - Under €10k, or qualifying for the new **SME <€100k EU-turnover exemption** (2025):
    you may charge only BE VAT — confirm with the accountant.
  - Note: **Basic Tax is retired for new EU stores from 2026-05-13** — use Shopify Tax
    or manual rates.

### 4. Order & customer notifications
- Admin → Settings → Notifications: customise **order confirmation**, **shipping
  confirmation**, and **order-canceled/refund** emails; set the sender + branding.
- This repo generates branded admin notification HTML — `npm run gen:shopify-templates`
  (source in `scripts/shopify-templates/`). There is **no Admin API for notification
  templates**, so the generated HTML is **pasted into admin by hand**.
- Support emails (Resend) are a separate system — not order emails.

### 5. Customer accounts (headless) — config fix needed
- `.shopify/project.json` shows the Customer Account API callback/JS-origin/logout
  URLs still point at the **`*.tryhydrogen.dev` preview**, not `opendrone.be`.
- Admin → Settings → Customer accounts → headless storefront: add the **production**
  `https://opendrone.be/account/authorize` callback, JS origin, and logout URI.
  Oxygen injects the matching env vars on deploy. Login on the live domain fails until this is done.

### 6. Domain & checkout domain
- Storefront serves on `opendrone.be` via Oxygen, but the store's **primary domain is
  still the myshopify URL**. Confirm the custom-domain + checkout-domain relationship
  so checkout runs on a branded/trusted host (DNS records in `docs/operations.md`).

### 7. Inventory / SKUs
- **OpenFrame "5\" Freestyle" and OpenStack have no SKU**; prices across the catalog
  are placeholders from the infra scripts. Finalise SKUs + real prices before launch
  (the storefront's "AI-generated placeholders" banner should come down at the same time).

### 8. Final end-to-end test (after 1–4)
Place one **real** low-value order through live checkout and verify, per the Shopify
launch checklist:
- payment captures and settles;
- inventory decrements at OpenDrone Leuven;
- order appears in admin;
- confirmation email arrives;
- fulfil it → shipping email + tracking arrives;
- refund it → refund email + inventory restock.
Then test on mobile, and test a discount code if any are live.

## Sources
- [Shopify — ecommerce launch checklist](https://www.shopify.com/blog/shopify-store-launch-checklist)
- [Hydrogen & Oxygen fundamentals](https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals)
- [Customer Account API with Hydrogen](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/hydrogen)
- [Shopify Help — setting up EU taxes / OSS](https://help.shopify.com/en/manual/taxes/eu/eu-tax-setup)
- [Payment gateways — Belgium](https://www.shopify.com/payment-gateways/belgium) · [Mollie + Shopify](https://www.mollie.com/integrations/shopify)
