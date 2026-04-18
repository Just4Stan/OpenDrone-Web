# Peppol E-Invoicing: Incutec BV

**Legal basis:** Wet van 6 februari 2024 (BS 20.02.2024) houdende wijziging van het BTW-Wetboek. Aligns Belgium with EU Directive 2014/55 and the ViDA (VAT in the Digital Age) reform roadmap.

**Sources:**
- Official Belgian portal: https://einvoice.belgium.be/en/article/when-e-invoicing-mandatory
- Official Belgian portal (software / receiving / sending): https://einvoice.belgium.be/en/article/software-solutions-sending-receiving-and-processing-electronic-invoices

---

## Scope

### In scope (mandatory from 1 Jan 2026)
| Transaction | Peppol required? |
|---|---|
| Incutec → Belgian hobby shop (B2B, BTW-plichtig) | Yes: structured e-invoice via Peppol BIS Billing 3.0 |
| Incutec → Belgian reseller/wholesaler | Yes |
| Incutec → Telraam NV (R&D contract invoicing) | Yes |
| Incutec receives invoice from JLCPCB (Belgian entity if applicable) | Yes: must be able to RECEIVE Peppol invoices |
| Incutec receives invoice from Belgian boekhouder | Yes |
| Incutec receives invoice from Belgian hosting/telco/insurance | Yes |

### Out of scope (2026 mandate: regular invoices/PDF still fine)
| Transaction | Peppol required? |
|---|---|
| Incutec → Belgian consumer (B2C) | No: PDF/email invoice fine |
| Incutec → German/Dutch/French consumer (B2C, cross-border) | No (B2C exempt) |
| Incutec → German B2B customer (cross-border intra-EU) | No in 2026 mandate (cross-border out of scope until ViDA 2030); recipient country may have own rules |
| Incutec → VAT-exempt entity (Art. 44 WBTW) | No |
| Incutec → Supplier in non-EU country | No |

**Summary: Peppol is mandatory for domestic Belgian B2B only (both send and receive). Cross-border B2B stays on PDF until EU-wide ViDA mandate (~July 2030).**

### E-reporting (separate mandate, 1 Jan 2028)
Belgium will add near-real-time e-reporting (5-day rule) starting 2028. Not a concern for Q3 2026 launch: re-evaluate late 2027.

---

## Incutec stack

Polar Advisory ships the bookkeeping + invoicing backbone.

| Layer | Tool | Purpose |
|---|---|---|
| Bookkeeping + e-invoice engine | Exact Online Basic (part of Polar's Comfort package) | Issues and receives Peppol BIS 3.0 invoices, handles archival |
| Banking → bookkeeping | CODA (1 zicht + 1 spaar via Polar) | Automatic bank transaction feed into Exact Online |
| Webshop checkout → invoice | **Sufio** for Shopify | Generates invoices from Shopify orders; routes B2B invoices into the Exact Online / Peppol path |
| Webshop receive-only fallback | **Billit** basic account | Cheap standalone Peppol access point during the BV-incorporation window before Exact Online is fully live |

Pricing moves. Re-check Polar's current Comfort package, Sufio plan, and Billit tier before launch instead of hard-coding numbers here.

## Receiving Peppol invoices: Incutec must be reachable

Even before sending any Belgian B2B invoice, Incutec must be able to **receive** structured invoices from Belgian suppliers. This is configured via Exact Online (through Polar) and, optionally, a standalone Billit account for the window between BV incorporation and the Exact Online flow being fully live.

**Action:** Confirm receive capability with Polar at BTW activation, test-receive a Peppol invoice from Polar or Billit before webshop launch.

---

## Shopify → Peppol integration path

Shopify core does not natively generate Peppol BIS 3.0 XML. Incutec's chosen path is **Sufio on Shopify → Exact Online (Polar) → Peppol**. Sufio generates the invoice from the Shopify order and hands it to Exact Online for numbering, archival, and Peppol delivery for Belgian B2B orders; B2C orders stay on PDF.

If Sufio ever fails to cover Belgian structured invoicing cleanly, fall back to:

- Accounting-led flow: push Shopify order data into Exact Online (manual export or lightweight middleware), let Exact originate the structured invoice. Slower but guaranteed compliant.
- Billit standalone: cheaper than middleware, but you then maintain two invoice ledgers. Only use as a temporary bridge.

### Don't

- Rely on Shopify's built-in "Orders > Print invoice" for B2B: it generates PDFs, not Peppol XML. Non-compliant for BE B2B from 1 Jan 2026.
- Wait until the first B2B sale to set up: test receive and send before invoicing starts.

---

## Shopify Plus vs Basic for Peppol: no difference
Neither Shopify Basic nor Shopify Plus ship native Peppol. Both require a third-party app/middleware. Plus adds B2B wholesale features (customer-specific pricing, net terms) but Peppol generation is identical via the same apps. **Stay on Shopify Basic/Advanced at launch.** Reassess Plus only if B2B wholesale becomes >30% of revenue.

---

## Invoice format requirements (Peppol BIS Billing 3.0)
Structured XML (UBL 2.1 syntax) containing mandatory Belgian fields:
- Sender: BCE nummer (BE0xxxxxxxxx), full legal name, address, IBAN
- Recipient: BCE nummer (B2B), full legal name, address
- Invoice lines: description, quantity, unit price, BTW rate, BTW amount per line
- Totals: excl. BTW, BTW, incl. BTW
- Payment terms + structured reference (OGM/gestructureerde mededeling)
- Invoice number (sequential, no gaps)
- Invoice date + delivery date
- Reference to reverse-charge if intra-EU (when cross-border eventually in scope)

All the Shopify Peppol apps handle this automatically: Incutec just needs to fill in BV details correctly at app setup.

---

## Penalties for non-compliance
Administrative fines under Belgian BTW code (AR nr. 44):
- **1st infringement: €1,500** (waived if corrected promptly and good faith)
- **2nd infringement: €3,000**
- **3rd and subsequent: €5,000 per infringement**
- Plus: invoice cannot be used as proof for BTW deduction at the receiving end, creating commercial pressure to comply

**3-month tolerance period (1 Jan to 31 Mar 2026):** No sanctions for infringements IF Incutec can demonstrate reasonable steps were taken toward compliance. Given Incutec launches Q3 2026, tolerance window does not apply: full compliance expected at launch.

Sources:
- https://einvoice.belgium.be/en/FAQ/specific-questions-about-e-invoicing
- https://einvoice.belgium.be/en/news/period-tolerance-during-first-three-months-2026

---

## Implementation plan for Incutec (pre-launch)

### Phase 1: At BV incorporation (Apr 2026)
- [ ] Confirm BTW number activation via Acerta
- [ ] Open Billit basic account for receive-only Peppol access until Exact Online is live
- [ ] Route Peppol to stan@incutec.eu for now (split to invoices@ once infra is set up)
- [ ] Test-receive a Peppol invoice from Polar or Billit

### Phase 2: Pre-launch (Jun-Jul 2026)
- [ ] Install Sufio on the Shopify dev store
- [ ] Connect Sufio to Exact Online (via Polar) so B2B invoices flow into the Peppol path
- [ ] Configure VAT number field on Shopify B2B checkout with VIES validation
- [ ] Test: place B2B test order → verify Peppol XML generated → verify delivered to test recipient
- [ ] Test: place B2C test order → verify PDF invoice only (no Peppol)
- [ ] Archive: ensure Peppol invoices stored 10 years (Belgian bewaarplicht)

### Phase 3: Go-live (Q3 2026)
- [ ] Monitor first 10 B2B invoices for Peppol delivery confirmation
- [ ] Reconcile Shopify orders ↔ Peppol invoices sent ↔ Polar monthly books
- [ ] Review Sufio + Billit + Exact Online pricing annually

---

## Cost summary for Incutec

Pricing changes faster than the legal requirement. Budget for:
- one receiving/sending provider or accountant-led platform
- any Shopify app or middleware needed to originate Belgian B2B invoices
- testing and annual retention/review

Pick the stack based on accountant fit, invoice retention, Belgian B2B support, and low-friction B2C fallback, not on transient promo pricing.

---

## Selection checklist
- [ ] Confirm with the accountant which structured-invoicing platform or access point they prefer
- [ ] Verify the chosen stack can route Belgian B2B as structured invoices and keep B2C on PDF/email
- [ ] Verify VIES validation, invoice numbering, retention, and export for bookkeeping
- [ ] Check whether Telraam NV or other key B2B customers impose additional invoicing requirements
