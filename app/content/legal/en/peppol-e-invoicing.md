# Peppol E-Invoicing: Incutec BV

**Legal basis:** Belgian Law of 6 February 2024 (Belgian Official Gazette 20.02.2024) amending the Belgian VAT Code (*Wetboek van de belasting over de toegevoegde waarde*, WBTW), which introduces a mandatory structured B2B e-invoicing obligation and anticipates the EU ViDA (VAT in the Digital Age) reform package. The 2014/55/EU Directive on e-invoicing in public procurement has been separately implemented in Belgium and covers only B2G flows.

**Sources:**
- Official Belgian portal: https://einvoice.belgium.be/en/article/when-e-invoicing-mandatory
- Official Belgian portal (software / receiving / sending): https://einvoice.belgium.be/en/article/software-solutions-sending-receiving-and-processing-electronic-invoices

---

## Scope

### In scope (mandatory from 1 January 2026)

| Transaction | Peppol required? |
|---|---|
| Incutec → Belgian business customer (B2B, VAT-registered) | Yes: structured e-invoice via Peppol BIS Billing 3.0 |
| Incutec → Belgian reseller/wholesaler | Yes |
| Incutec → Belgian R&D client (e.g. contract invoicing) | Yes |
| Incutec receives invoice from Belgian supplier | Yes: must be able to RECEIVE Peppol invoices |
| Incutec receives invoice from Belgian accountant | Yes |
| Incutec receives invoice from Belgian hosting, telecom or insurance provider | Yes |

### Out of scope (2026 mandate: regular PDF invoices still allowed)

| Transaction | Peppol required? |
|---|---|
| Incutec → Belgian consumer (B2C) | No: PDF/email invoice is sufficient |
| Incutec → German/Dutch/French consumer (B2C, cross-border) | No (B2C exempt) |
| Incutec → German B2B customer (cross-border intra-EU) | Not required by the Belgian 2026 mandate. Cross-border B2B stays out of scope until the EU ViDA mandate. The recipient country may impose its own rules (e.g. Germany phased in 2025–2028) |
| Incutec → entity VAT-exempt under Article 44 of the Belgian VAT Code | No |
| Incutec → supplier in a non-EU country | No |

**Summary:** Peppol is mandatory for domestic Belgian B2B only, both for sending and receiving. Cross-border B2B invoices stay on PDF until the EU-wide ViDA mandate takes effect on **1 July 2030**.

### E-reporting (separate mandate, 1 January 2028)

Belgium will add near-real-time e-reporting (the "5-day rule") starting 2028. This is a separate obligation that will be re-evaluated closer to the deadline.

---

## Shopify → Peppol integration path

Shopify core does not natively generate Peppol BIS 3.0 XML. A Shopify e-invoicing application or accounting-led flow is required to originate structured invoices for Belgian B2B orders; B2C orders stay on PDF.

If the primary Shopify e-invoicing application does not cover Belgian structured invoicing cleanly, fallback options include:

- **Accounting-led flow:** push Shopify order data into the accounting system (manual export or lightweight middleware) and let the accounting system originate the structured invoice
- **Standalone Peppol access point:** cheaper than middleware, but creates two parallel invoice ledgers; suitable only as a temporary bridge

### Do not

- Rely on Shopify's built-in "Orders > Print invoice" for B2B: it produces PDFs, not Peppol XML, and is non-compliant for Belgian B2B from 1 January 2026
- Wait until the first B2B sale to set up the flow: test receive and send before invoicing starts

---

## Shopify Plus vs Basic for Peppol

Neither Shopify Basic nor Shopify Plus ships native Peppol support. Both require a third-party application or middleware. Plus adds B2B wholesale features (customer-specific pricing, net terms), but Peppol generation is identical via the same applications. The plan decision is therefore independent of the Peppol requirement.

---

## Invoice format requirements (Peppol BIS Billing 3.0)

Structured XML, using the Peppol BIS Billing 3.0 profile of UBL 2.1, containing the mandatory Belgian fields:

- Sender: enterprise number (BCE/KBO, formatted `BE 0xxx.xxx.xxx`), full legal name, address, IBAN
- Recipient: enterprise number (for B2B), full legal name, address
- Invoice lines: description, quantity, unit price, VAT rate, VAT amount per line
- Totals: net, VAT, gross
- Payment terms and a structured payment reference (the Belgian *OGM* / structured communication)
- Sequential invoice number (no gaps)
- Invoice date and delivery date
- Reference to the reverse-charge mechanism for intra-EU supplies (once cross-border e-invoicing is in scope)

All the Shopify Peppol applications handle this automatically: Incutec needs only to enter the correct company details at application setup.

---

## Penalties for non-compliance

Administrative fines are imposed under the Belgian VAT Code and Royal Decree nr. 44. The exact scale is set by that Royal Decree and may be revised — **verify the current amounts against the consolidated text before publication**. At the time of drafting, commonly cited figures are €1,500 for a first infringement (waived if corrected promptly and in good faith), €3,000 for a second infringement, and €5,000 for a third and subsequent infringement.

In addition to the administrative fine, an invoice that does not comply with the structured format cannot be used as proof for VAT deduction at the receiving end, which creates commercial pressure to comply.

**3-month tolerance period (1 January to 31 March 2026):** No sanctions for infringements where the taxable person can demonstrate reasonable steps toward compliance. Full compliance is expected at webshop launch regardless of this tolerance window.

Sources:
- https://einvoice.belgium.be/en/faq/specific-questions-about-e-invoicing
- https://einvoice.belgium.be/en/news/period-tolerance-during-first-three-months-2026

## Implementation Checklist

*Everything below this heading is internal planning detail and is stripped from the rendered public legal page. It is retained in the source for record-keeping.*

### Phase 1: At BV incorporation
- [ ] Confirm VAT number activation
- [ ] Open a receive-only Peppol access point until the main e-invoicing platform is live
- [ ] Configure invoices@incutec.com and route to the accounting inbox
- [ ] Test-receive a Peppol invoice

### Phase 2: Pre-launch
- [ ] Install the chosen Peppol Shopify application on the development store
- [ ] Connect the application to the accounting system so B2B invoices flow into the Peppol path
- [ ] Configure VAT number field on Shopify B2B checkout with VIES validation
- [ ] Test: place B2B test order → verify Peppol XML generated → verify delivered to test recipient
- [ ] Test: place B2C test order → verify PDF invoice only (no Peppol)
- [ ] Archive: ensure Peppol invoices stored for 10 years (Belgian VAT retention obligation)

### Phase 3: Go-live
- [ ] Monitor first 10 B2B invoices for Peppol delivery confirmation
- [ ] Reconcile Shopify orders against Peppol invoices sent and the monthly books
- [ ] Review application and access-point pricing annually

### Incutec stack (internal reference)

The operational stack (accounting software, Peppol access point, Shopify invoicing application) is selected with the accountant and re-checked annually. Pricing, vendor choice and package tier are not stable enough to publish on a public legal page.

### Selection criteria
- Confirm with the accountant which structured-invoicing platform or access point they prefer
- Verify the chosen stack can route Belgian B2B as structured invoices and keep B2C on PDF/email
- Verify VIES validation, invoice numbering, retention, and export for bookkeeping
- Check whether key B2B customers impose additional invoicing requirements

### Cost summary
Pricing changes faster than the legal requirement. Budget for one receiving/sending provider or accountant-led platform, any Shopify application or middleware needed to originate Belgian B2B invoices, and testing and annual retention review. Select the stack on accountant fit, invoice retention, Belgian B2B support and low-friction B2C fallback, not on transient promotional pricing.
