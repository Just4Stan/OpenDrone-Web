# Shopify setup state — store ktjqug-jw / opendrone.be

Updated: 2026-07-02 after read-only recon (agent browsed full admin). One browser-agent task at a
time; update this file after every run. **STAN** = needs Stan personally.

## Task queue

- [x] 0. Recon audit — done 2026-07-02, findings below
- [x] 1. DONE 2026-07-02 (verified): OpenStack category → "Circuit Boards & Components in Electronics"; Legal notice now states KBO 1038.934.039 / VAT BE 1038.934.039 (rest of text untouched). Side notes: OpenStack metafield count dropped 4→3 with the category swap (check nothing important vanished); OpenFC Lite's own category is "Microcontroller Starter Kits in Computer Starter Kits" — consider aligning to Circuit Boards & Components in a later pass.
- [x] 2. Prices — RESOLVED 2026-07-02: all placeholders, Stan updates them in Shopify himself later. Verified the site hardcodes no prices (all from Storefront API), so nothing to sync code-side.
- [x] 3. DONE 2026-07-02: archived "OpenFC" product deleted (3 markers verified pre-delete); automatic discount "OpenStack — FC + ESC stack discount" live (buy 1 OpenFC Lite any variant → 1 OpenESC any variant 10% off, can't combine, no end date). Code side shipped in PR #246 (openfc entry + board art removed).
- [ ] 3b. OpenStack retirement — code SHIPPED (PR #250 merged + deployed 2026-07-02): stack builder live on FC/ESC buy modules (partner picker ready for future OpenFC Pro), /products/openstack 301s to the FC page, nav/home/cart references gone. REMAINING: archive the OpenStack product in Shopify admin (safe now that the redirect is deployed) — next agent run.
- [ ] 3c. Donation upsell — code SHIPPED (PR #250): cart page AND cart drawer render DonationUpsell once the `firmware-donation` product exists (agent creating it: 4 variants €1/3/5/10, no shipping, no inventory, type Donation). Bookkeeping note for accountant: decide VAT treatment of the donation line (currently created tax-unchecked).
- [ ] 4. Product descriptions + SEO + alt text ← Stan's copy walkthrough (in progress in terminal)
- [x] 5. Collections exclusion — INVESTIGATED 2026-07-02: Storefront API returns 0 collections, but harmless — all internal links go to /collections/all which queries products directly (products API returns all 9 active). Optional later: publish collections to the Hydrogen channel if real category pages are ever wanted.
- [ ] 6. Taxes: add **Belgian VAT registration** (OSS explicitly can't cover BE — in-app warning); toggle company VAT number on; enable VAT invoices
- [ ] 7. Shipping — DECIDED 2026-07-02: worldwide at launch. Notion task created for Iebe (rates/zones via Sendcloud, real weights incl. battery strap 0.0 kg, HS codes + origin, DDU/DDP, export-compliance country exclusions, policy page update): https://app.notion.com/p/391fe06764e181e49526d6b486f83299
- [ ] 8. Notifications: sender stan.coene@gmail.com UNVERIFIED (customers see generic @shopifyemail.com) → switch to contact@opendrone.be + verify domain; retarget notification URLs from legacy Online Store to opendrone.be Hydrogen channel
- [ ] 9. Domains: opendrone.be = primary on Hydrogen channel ✓ (Notion task stale — mostly done). But www.opendrone.be points at the LEGACY password-protected Online Store → redirect www → apex/Hydrogen
- [ ] 10. Legal/policy pages final text (2-yr guarantee, GPSR, withdrawal form, Consumentenombudsdienst not ODR); privacy policy is "Automated" (generic) → vault version with processor table
- [ ] 11. **STAN**: Activate payment provider — NONE active (Shopify Payments "Set up", PayPal not activated). #1 blocker. BV verification + bank account.
- [ ] 12. **Iebe**: InvenTree custom app token ("OpenDrone Infra" custom app already installed) + sync plugin
- [ ] 13. **STAN**: End-to-end test order → then remove legacy-store password (currently ON, pw "askohg")

## Price discrepancy — resolve before launch (task 2)

| Product / variant | Shopify now | Vault beta (incl BTW) |
|---|---|---|
| OpenFC Lite Mini (20×20) | €45 | €34.99 (OFC-ECO) |
| OpenFC Lite 30×30 | €49 | €49.99 (OFC-FULL) |
| OpenESC 20×20 | **€69** | **€24.99** (OESC-2020) |
| OpenESC 30×30 | **€75** | **€29.99** (OESC-3030) |
| OpenRX Lite | €22 | €19.99 |
| OpenRX Lite-UFL | €25 | — (not in vault) |
| OpenRX Mono | €32 | €29.99 |
| OpenRX Gemini | €39 | €39.99 |
| OpenStack bundle | €114 (= 45+69, no bundle discount) | — |
| OpenFrame 5"/3" | €41 / €35 | — |
| Accessories: strap €4.50, antenna €6/€7, hw kit €3/€5, spares €8–24 | | — |

## Store snapshot (recon 2026-07-02)

- **Products (10):** OpenFC Lite (Mini/30×30, 4 real photos), OpenESC (20×20/30×30, 4 photos),
  OpenRX (4 variants, 7 photos), OpenFrame (5"/3", 1 render), OpenStack (1 render, miscategorized,
  stock 2000), 4 accessories (ALL 0 images), archived "OpenFC" (joke desc). Descriptions otherwise
  real and detailed.
- **Collections:** 6 automated, ALL "excluded from all sales channels" (investigate, task 5).
- **Payments:** none active.
- **Taxes:** Shopify Tax on; EU OSS collecting 26 regions; BE itself NOT registered (warning shown);
  VAT number toggle off; VAT invoices off.
- **Shipping:** BE free≥€70/€5; Rest-of-EU €9.95 free≥€70; "western eu" €6.50 free≥€70. No RoW.
- **Markets:** Belgium + International (234 regions, 207 can't check out — no rates).
- **Policies:** custom, link to opendrone.be; Legal notice still says KBO/VAT "published after
  incorporation"; privacy = Shopify automated boilerplate.
- **Notifications:** sender stan.coene@gmail.com unverified; target storefront = legacy channel.
- **Apps:** Judge.me, Messaging, Flow, Claude Connector, Sendcloud, Translate & Adapt, OpenDrone
  Infra (custom).
- **Domains:** opendrone.be primary on Hydrogen "Opendrone Web (Production)"; www.opendrone.be on
  legacy password-protected Online Store (pw "askohg", meta/title unset — irrelevant if legacy
  never serves, but www points there!).
- **General:** Incutec BV, Stapelhuisstraat 15 Leuven; +32491978361; EUR.
