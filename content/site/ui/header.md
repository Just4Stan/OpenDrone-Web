# Header — `Header.tsx`, `LangToggle.tsx`

> source: app/components/Header.tsx, app/components/LangToggle.tsx

The site header: wordmark logo, the Shopify-driven primary menu, a row of
gold category links, and the right-side action group (language toggle,
Newsletter / Catalog / Contact links, account, search, cart, mobile menu
button). The primary menu items come from the Shopify main menu and are
**dynamic** — only the hardcoded fallback labels and the locally-added
links are editable here. The language toggle only renders on legal routes.

## Logo

- **logo_alt:** OpenDrone
- **logo_aria_label:** OpenDrone

## Category links (gold row)

- **cat_fc:** FC
- **cat_esc:** ESC
- **cat_stack:** Stack
- **cat_rx:** RX
- **cat_frame:** Frame
- **cat_accessories:** Accessories
- **categories_nav_aria:** Product categories

## Primary menu (mobile aside extras)

The center menu maps Shopify main-menu items (titles are **dynamic**).
These two entries are added in code:

- **menu_home_mobile:** Home
- **menu_newsletter_mobile:** Newsletter

## Right-side actions

- **cta_newsletter:** Newsletter
- **cta_catalog:** Catalog
- **cta_contact:** Contact
- **account_signed_out:** Sign in
- **account_signed_in:** Account
- **account_fallback:** Sign in
- **menu_button_aria:** Menu
- **search_button_aria:** Search

The account link shows "Sign in" while logged out (and as the Suspense /
error fallback) and "Account" once logged in — both computed from the
session, captured above. The cart badge count is **dynamic**.

## Language toggle (legal pages only)

- **lang_group_aria:** Language
- **lang_nl:** NL
- **lang_fr:** FR
- **lang_en:** EN

## Shopify main-menu fallback (used when the menu fails to load)

```do-not-edit
FALLBACK_HEADER_MENU items (Shopify-managed in admin; these are the
hardcoded defaults). Titles + URLs:
- Catalog       → /collections/all
- Newsletter    → /newsletter
- Open Source   → https://github.com/OpenDrone-hw

Local page rewrites: /pages/contact → /contact
Category link hrefs: FC → /products/openfc ; ESC → /products/openesc ;
Stack → /products/openstack ; RX → /products/openrx ;
Frame → /products/openframe ; Accessories → /collections/all?type=Accessory
Action link hrefs: Newsletter → /newsletter ; Catalog → /collections/all ;
Contact → /contact ; Account → /account ; logo → / ; cart → /cart
```
