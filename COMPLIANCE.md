# OpenDrone Web — Compliance Requirements

Everything the storefront must implement to be legally compliant for a Belgian BV selling FPV drone electronics to EU consumers.

This file is the implementation-focused extract for the web codebase. Legal copy is maintained by the Incutec compliance workstream and synced into `app/content/legal/` via `npm run sync:legal` (see README.md → Compliance Integration). Template paths referenced below (e.g. `webshop/algemene-voorwaarden.md`) are relative to the authoring source, not this repo.

---

## 1. Mandatory pages

| Page | Route | Source template |
|------|-------|----------------|
| Algemene Voorwaarden (T&C) | `/algemene-voorwaarden` + `/terms` | `incutec/compliance/webshop/algemene-voorwaarden.md` |
| Privacy Policy | `/privacy` | `incutec/compliance/webshop/privacy-policy.md` |
| Cookie Policy | `/cookies` | `incutec/compliance/webshop/cookie-policy.md` |
| Herroepingsrecht + Modelformulier | `/herroepingsrecht` | `incutec/compliance/webshop/herroepingsformulier.md` |
| Shipping & Delivery | `/shipping` | derive from algemene-voorwaarden |
| Warranty (2-year wettelijke garantie) | `/warranty` | algemene-voorwaarden |
| Export Compliance Policy | `/export-compliance` | `incutec/compliance/export-sanctions/export-control-memo.md` |
| Imprint / Legal | `/legal` or in footer | Company identity block (see §3) |
| Contact | `/contact` | — |

All pages must exist in **Dutch (NL) at minimum**. French (FR) and English (EN) recommended for EU reach.

**DO NOT include an ODR platform link.** The EU ODR platform was discontinued 20 July 2025 (Regulation 2024/3228). The old link `ec.europa.eu/consumers/odr` must NOT be referenced.

---

## 2. Shopify default legal templates — DO NOT USE

Shopify auto-generates Terms, Privacy, Refund Policy templates. The EU Commission's CPC Network's 2023 coordinated action found these **non-compliant** with Belgian WER Book VI. **Replace all Shopify legal templates with the Incutec-authored versions** from `incutec/compliance/webshop/`.

Shopify's Refund Policy page can remain as a thin wrapper linking to `/algemene-voorwaarden` Art. 5.

**Known bug in Incutec AV draft Art. 9.2**: Belgian law is 2-year reverse burden of proof, not 1-year. Fix when rendering.

---

## 3. Footer / company identity (required by WER Art. VI.45)

Every page footer must show:

```
Incutec BV
Stapelhuisstraat 15, 3000 Leuven
BE [0XXX.XXX.XXX]                    ← KBO number (post-incorporation)
BTW BE [0XXX.XXX.XXX]                ← VAT number (post-incorporation)
stan@incutec.eu
Tel: [TBD]                           ← optional but recommended
```

Also required in footer:
- Link to all mandatory pages (§1)
- Link to EUIPO dispute procedure (NOT the discontinued ODR platform)
- Language switcher if multi-lingual

---

## 4. Cookie banner spec (GBA 2023 checklist — strict)

**Do NOT use Shopify's native cookie banner.** Use **Pandectes** or **Consentmo** Shopify apps (proven GBA-compliant), OR build custom with these requirements:

1. **Reject-all button at same layer as Accept-all**, same size, same color, same contrast (no dark patterns)
2. No cookie walls — content accessible without consent
3. **Granular opt-in per purpose**: strictly necessary (no consent), functional, analytics, marketing
4. Strictly necessary cookies load before banner; all others blocked until consent
5. **6-month consent re-ask** (max lifetime of consent record)
6. Withdrawal/change preferences link permanently in footer
7. Cookie policy reachable without accepting anything
8. Log consent records with timestamp, IP hash, banner version

**Recommended: skip GA4 and Meta Pixel entirely.** Use **Plausible Analytics** (cookie-free, GDPR-compliant, no banner needed for it). Cuts cookie-banner complexity dramatically.

**Shopify cookies inventory** (classify in cookie-policy.md):
- Strictly necessary: `_secure_session_id`, `_shopify_y`, `_shopify_s`, `cart`, `cart_sig`, `cart_ts`, `_shopify_tm`, `_shopify_tw`, `checkout`, `checkout_token`, `secure_customer_sig`
- Analytics (opt-in): `_shopify_sa_p`, `_shopify_sa_t`, `_shopify_d`, `_y`
- Marketing (opt-in): `_ga`, `_gid`, `_fbp`, Klaviyo cookies if used

---

## 5. GPSR pre-sale listing requirements (Reg 2023/988, Art. 9)

Each product page must display **before purchase**:

- [ ] **Manufacturer name + address + electronic contact** — "Incutec BV, Stapelhuisstraat 15, 3000 Leuven, stan@incutec.eu"
- [ ] **Responsible economic operator in EU** — same as manufacturer (Incutec is in EU)
- [ ] **Product identifier** — model number + type/batch/serial
- [ ] **Image of the product**
- [ ] **Safety information and warnings in the language of the country of sale** (NL minimum for BE)
- [ ] **Instructions** (link to user manual PDF)

For LiPo chargers specifically, add:
- Fire hazard warning (lithium thermal runaway)
- Never charge unattended
- Never charge damaged/puffed batteries
- Use in well-ventilated area
- Warranty void if modified

Implement as a reusable `<ProductCompliance>` component consumed by all product detail pages.

---

## 6. Product display requirements

### 6.1 Prices
- Display **B2C prices INCLUDING 21% BTW** by default (WER Art. VI.2)
- Show delivery cost before checkout (or "delivery calculated at checkout" with clear explanation)
- B2B toggle (if implemented): allows reverse-charge display for VIES-validated EU VAT numbers

### 6.2 Per-product required elements
- SKU, model number, batch identifier (dynamic if needed)
- CE marking visual on product page where applicable
- WEEE crossed-out wheelie bin symbol for all EEE products
- Open source badge (CERN-OHL-S logo) with link to GitHub repo
- Source URL (displayed on product + in technical file + on label)
- Datasheet / user manual download links
- Declaration of Conformity (DoC) download link per SKU
- SBOM download link (CRA compliance — required 11 Dec 2027)

### 6.3 Warranty text per product
> "Wettelijke garantie van 2 jaar conform Boek VI WER. Bij gebrek binnen 2 jaar: herstelling, vervanging of terugbetaling. Commerciële garantie: [none / X maanden]."

---

## 7. Checkout / order flow compliance

### 7.1 Pre-checkout (Art. VI.45 WER)
- Total price incl. BTW + shipping displayed before payment button
- Delivery timeframe shown
- Payment method confirmed
- Button text: "Bestelling met betalingsverplichting" or "Betalen" (NOT just "Order")
- Checkbox for T&C acceptance (pre-ticked illegal)

### 7.2 Country shipping blocks (sanctions)
Shopify Markets configuration must **block** these destinations:
- Russia, Belarus, Iran, Syria, North Korea (DPRK), Cuba, Myanmar
- Crimea, Donetsk/Luhansk People's Republics (occupied territories)

Also require **Article 12g "No Re-Export to Russia" clause** in checkout terms for B2B orders to non-EU + non-Annex-VIII countries (Turkey, UAE, Kazakhstan, Serbia, China, HK, etc.).

Annex VIII exempt countries (ship without clause): AU, CA, CH, IS, JP, LI, NO, NZ, KR, UK, US.

### 7.3 14-day withdrawal confirmation
- Post-purchase email must include herroepingsformulier link + instructions
- Withdrawal period: 14 days from receipt of last item
- No exceptions for FPV electronics (no "custom" / "personalized" carve-out applies)

### 7.4 Order confirmation email
Must include all mandatory pre-contractual info (Art. VI.47 WER):
- Order summary + prices incl. BTW
- Delivery address + timeframe
- Payment method confirmed
- Right of withdrawal + modelformulier attached
- Manufacturer identity + contact
- Warranty terms

---

## 8. Payment providers — DPA + SCC status

| Provider | Role | DPA URL | SCC needed |
|----------|------|---------|------------|
| Shopify | Processor | shopify.com/legal/dpa | Yes (US subprocessors) |
| Stripe | Controller + Processor | stripe.com/legal/dpa | Yes |
| Mollie | Processor | mollie.com/en/privacy | No (NL-based) |
| Sendcloud | Processor | sendcloud.com/dpa | No (NL-based) |

Belgian payment method share: **Bancontact = ~25.7%**. Mollie mandatory for competitive checkout.

---

## 9. OSS VAT (MOSS) — voluntary registration from day 1

Do NOT wait for €10K pan-EU B2C threshold. One viral video = threshold crossed in hours.

- Register via MyMinfin → Intervat → OSS-Unieregeling **before webshop launch**
- Configure **Shopify Tax** with destination-country VAT rates:
  - BE 21%, NL 21%, DE 19%, FR 20%, IT 22%, ES 21%, LU 17%, AT 20%, PL 23%, SE 25%, DK 25%, PT 23%, FI 25.5%, etc.
- Filing: quarterly via Intervat (automated returns from Shopify Tax reports)

---

## 10. Peppol e-invoicing (mandatory Belgium, active since 1 Jan 2026)

- B2B invoices to Belgian BTW-plichtigen MUST be sent via Peppol in BIS Billing 3.0 format
- B2C invoices unaffected (can remain PDF)
- **Implementation: Sufio Shopify app** + **Billit** or **Hermes (free)** as Peppol Access Point
- Estimated cost: €200-500/yr
- Penalties: €1.5K-5K per non-compliant invoice

Sufio handles Shopify integration; Billit/Hermes handles network transmission. Configure to send Peppol automatically for B2B orders (VIES-validated VAT numbers).

---

## 11. Technical file + SBOM downloads (CRA)

By **11 Dec 2027**, each product page must offer:
- **SBOM** (CycloneDX JSON or SPDX) download per SKU
- **Declaration of Conformity** PDF download per SKU
- **Vulnerability disclosure contact** — publish `/.well-known/security.txt` per RFC 9116
- **Security advisories** page listing CVEs affecting products (if any)

By **11 Sep 2026**, set up vulnerability reporting channel to ENISA (not a web requirement but parallel obligation).

---

## 12. Open source attribution (CERN-OHL-S + DCO)

- Every product page links to its public GitHub repo
- Each repo contains: LICENSE, NOTICE.md, TRADEMARKS.md, CONTRIBUTING.md (DCO)
- Footer badge: "Open Source Hardware — CERN-OHL-S-2.0"
- Link to ohwr.org / OSHWA certification when obtained

---

## 13. Accessibility (EAA — EU 2019/882, effective 28 Jun 2025)

European Accessibility Act applies to e-commerce services with >10 employees OR >€2M turnover — **Incutec is below threshold Y1**, exempt Y1.

Still: implement WCAG 2.1 AA as baseline (keyboard navigation, alt text, color contrast ≥4.5:1) because (a) it's good, (b) threshold will be crossed Y2-Y3.

---

## 14. Product liability insurance display

Not a legal requirement to display, but recommended for trust:
- "Alle producten gedekt door productaansprakelijkheidsverzekering"
- Consider SafeShops.be / BeCommerce trust badge (evaluate ROI)

---

## 15. Analytics + marketing tooling — recommended stack

| Tool | Why | Privacy |
|------|-----|---------|
| **Plausible** (self-host or plausible.io) | Lightweight, cookie-free analytics | GDPR-safe, no banner needed |
| **Shopify Analytics** | Built-in order/product metrics | Functional, no opt-in for strictly necessary |
| **Klaviyo** or **Mailchimp** (email) | Transactional + marketing | DPA + SCC required, opt-in marketing |
| **Sentry** (error tracking) | JS error monitoring | Configure PII scrubbing, DPA required |

**Avoid**: GA4 (cookie banner complexity + Schrems II risk), Meta Pixel (cookie banner + ad-block rate >40%), Hotjar (session recording PII risk).

---

## 16. File storage reference

Templates, research, and legal drafts are maintained in the Incutec
compliance workstream (separate from this public repo). Contributors do
not need access. For reference, the layout of the authoring source is:

```
<COMPLIANCE_SRC>/
  webshop/
    algemene-voorwaarden.md          ← T&C draft (has Art. 9.2 2yr fix needed)
    privacy-policy.md                ← GDPR + DPA inventory
    cookie-policy.md                 ← GBA checklist + Shopify cookie inventory
    herroepingsformulier.md          ← EU standard withdrawal form
    peppol-e-invoicing.md            ← Peppol implementation plan
  product/
    opendrone-compliance-analysis.md ← RED 3.3, CRA, EN 18031 per-SKU matrix
    product-labels.md                ← what goes on the PCB + packaging
    user-manual-template.md          ← what goes in the included manual
  export-sanctions/
    export-control-memo.md           ← country matrix + No-Russia clause template
    sanctions-screening.md           ← order screening procedure
```

When in doubt: **read the source files above, not this summary.**

---

## 17. Implementation priority (phased)

**Phase 1 — Pre-launch (blocking):**
1. Mandatory pages (§1) rendered from Incutec-authored Markdown/MDX
2. Company identity footer (§3)
3. Cookie banner spec (§4) — Pandectes/Consentmo or custom
4. GPSR pre-sale component (§5) on all product pages
5. Country shipping blocks (§7.2)
6. OSS VAT configuration (§9)
7. DoC + manual download per product (§6.2)
8. Plausible analytics (no GA4 initially)

**Phase 2 — Post-launch (weeks 1-4):**
9. Peppol e-invoicing integration (§10) via Sufio + Billit
10. Article 12g clause in B2B checkout terms (§7.2)
11. Warranty page + return flow automation (§7.3)
12. `/export-compliance` page publishing country policy

**Phase 3 — Before CRA deadline (by Dec 2027):**
13. SBOM download per SKU (§11)
14. security.txt + vulnerability reporting page
15. Security advisories page structure

**Phase 4 — As revenue grows (Y2-Y3):**
16. EAA WCAG 2.1 AA full audit
17. B2B VIES-validated reverse-charge flow
18. Multi-language NL/FR/EN/DE complete
19. Trust badges (SafeShops/BeCommerce evaluation)
