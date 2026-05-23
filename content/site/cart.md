# Cart — `/cart`

> source: app/routes/cart.tsx, app/components/CartMain.tsx, app/components/CartLineItem.tsx, app/components/CartSummary.tsx, app/components/DonationUpsell.tsx

The cart page renders a header, then `CartMain`: an empty state when the
cart has no lines, otherwise the line items, an optional firmware-donation
upsell, and a summary with totals + checkout. The same `CartMain` powers
the slide-out cart drawer (aside layout). Product titles, variant option
names/values, quantities, prices, subtotals, donation tier titles/prices,
and the checkout URL are all dynamic (Shopify cart data) — not editable
here. Cart action error/warning text is returned by Shopify and rendered
verbatim.

## Meta (browser tab + search/social)

- **title:** Cart
- **description:** Review the items currently in your OpenDrone cart.

## Page header

- **eyebrow:** Checkout
- **title:** Your cart
- **description:** Review your selected hardware before heading to Shopify checkout.

## Section aria-labels

- **aria_cart_page:** Cart page
- **aria_cart_drawer:** Cart drawer
- **aria_cart_lines:** Line items

## Empty state

- **empty_title:** Your cart is empty
- **empty_body:** Start with the full catalog — open-source hardware ready to fly.
- **empty_cta:** Shop all

## Cart action notices (errors + warnings)

*(Messages are surfaced from Shopify cart-action responses — out of stock,
quantity caps, unknown variant, etc. The text itself is dynamic and not
authored here; only the container is local.)*

## Line item

*(Product title, image alt, variant options, quantity, and price are
dynamic. `{product.title}` is the dynamic product name in the template
below.)*

- **option_row:** *(template — `name` / `value` are dynamic variant option)* {name}: {value}
- **children_label_sr:** *(template — `{product.title}` is dynamic)* Line items with {product.title}
- **quantity_label:** *(template — `{quantity}` is dynamic)* Quantity: {quantity}
- **decrease_quantity_aria:** Decrease quantity
- **increase_quantity_aria:** Increase quantity
- **remove_button:** Remove

## Cart summary

- **subtotal_label:** Subtotal
- **checkout_cta:** Checkout
- **summary_note_taxes:** Taxes, shipping, and any discount or gift-card codes are applied on the next page.
- **summary_note_terms_lead:** By completing this order you accept the Incutec
- **summary_note_terms_enduse_link:** End-Use Policy
- **summary_note_terms_and:** and the
- **summary_note_terms_gtc_link:** General Terms and Conditions
- **summary_note_terms_trailing:** .

## Donation upsell (optional `firmware-donation` product)

*(Only renders when the cart has items and the `firmware-donation` Shopify
product exists with available variants. Tier titles and prices are dynamic
Shopify variant data.)*

- **aria_optional_donation:** Optional donation
- **eyebrow:** Optional · top up the firmware split
- **title:** Add a thank-you to the firmware maintainers.
- **body:** 100% forwarded on top of the baked-in €1 — we don’t keep any of it. Betaflight, AM32, ExpressLRS. Pick a tier or skip.
- **tier_remove:** Remove

```do-not-edit
Links / routes (structural):
- Empty state CTA → /collections/all
- Line item title → /products/<handle> (variant-aware URL)
- Terms note → /end-use (End-Use Policy), /algemene-voorwaarden (GTC)
- Checkout CTA → Shopify-provided cart.checkoutUrl (target=_self)
- Cart mutations POST to /cart action (LinesAdd/Update/Remove,
  DiscountCodesUpdate, GiftCardCodes*, BuyerIdentityUpdate — market forced
  to BE). Donation product handle: firmware-donation.
Note: discount + gift-card code entry happens on Shopify's checkout page,
not in this summary.
```
