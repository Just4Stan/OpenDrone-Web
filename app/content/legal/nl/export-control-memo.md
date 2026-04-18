# Export Control Self-Classification Memo: Incutec BV

**Purpose:** Document that Incutec's products are not dual-use controlled under EU Reg 2021/821. Keep on file for customs/authorities.

**Assessment Date:** 18 April 2026
**Assessor:** Stan Coene, Bestuurder

---

## Products Assessed

| Product | Description | Freq | Max power |
|---------|-------------|------|-----------|
| OpenFC-ECO / OpenFC | MCU + IMU + OSD, 7-36 VDC (2-6S) | 2.4 GHz (OpenFC full only, WiFi factory-disabled) | N/A |
| OpenESC 20x20 | BLDC motor driver, 11.1-25.2 VDC | N/A | 35 A continuous |
| OpenESC 30x30 | BLDC motor driver, 11.1-25.2 VDC | N/A | 120 A continuous |
| OpenRX Lite | ExpressLRS RX | 2.4 GHz ISM | ~10 dBm (telemetry) |
| OpenRX Mono | ExpressLRS RX | 868 MHz (EU) + 2.4 GHz ISM | ≤ 25 mW EIRP (EN 300 220 / EN 300 328 limits) |
| OpenRX Gemini | ExpressLRS RX (true diversity, 2× RF chain) | 868 MHz (EU) + 2.4 GHz ISM | ≤ 25 mW EIRP per chain |

## Applicable Regulation

EU Dual-Use Regulation (EU) 2021/821, Annex I.

## Analysis

### Category 7 — Navigation and Avionics

- Commercial MEMS IMUs (MPU6000, BMI270), open source firmware (Betaflight/INAV)
- Functionally equivalent to general-purpose MCU dev boards with accelerometers
- Don't meet Cat 7A performance thresholds (military-grade INS, ring laser gyros)
- **Conclusion: Not controlled**

### Category 9A012 — Unmanned Aerial Vehicles

- Controls complete UAV SYSTEMS meeting specific range/endurance/payload thresholds
- Incutec sells individual components only, not complete systems
- Commodity electronics for hobbyist self-assembled multirotors
- FPV racing/freestyle drones do not meet MTCR payload/range thresholds
- **Conclusion: Not controlled**

### Category 5 — Telecommunications & Information Security

- ELRS + VTX operate on ISM bands (2.4 GHz, 868/915 MHz, 5.8 GHz) — publicly available, unlicensed
- No encryption beyond standard wireless protocols
- No military-grade spread spectrum or anti-jamming
- **Conclusion: Not controlled**

### Article 5 Catch-All

- MS catch-all authority for non-listed items with suspected WMD/military end-use
- Incutec products = consumer hobby electronics, no plausible WMD application
- **Risk: Negligible for standard commercial sales**

## Conclusion

None of Incutec's products listed in Annex I of Reg (EU) 2021/821. No export license required for commercial sales to non-sanctioned countries.

## Mitigations

Despite non-classification:
1. All orders screened against EU sanctions lists (see `sanctions-screening.md`)
2. Unusual bulk orders to sensitive destinations flagged for manual review
3. Assessment reviewed annually or when adding new product types

### Belgian Authority

Flanders: Departement Kanselarij en Buitenlandse Zaken, Dienst Controle Strategische Goederen (CSG) — https://www.fdfa.be/en/csg

**Signed:** Stan Coene, Bestuurder Incutec BV · **Date:** 18 April 2026

## Notes

*Everything below this heading is internal analysis and is not part of the public memo. It is retained in the source file for record-keeping and is stripped from the rendered legal page.*

---

# Incutec-Specific Analysis (April 2026)

**Bottom line:** Products not listed in Annex I of Reg 2021/821. No license for commercial sales to non-sanctioned countries. but products ARE on the EU **Common High Priority Items** list (Annex XL of Reg 833/2014), meaning "No re-export to Russia" clause kicks in for every non-EU B2B sale. **This is the real compliance burden**, not Annex I dual-use classification.

## 1. Annex I (Dual-Use) Detailed Analysis

### 5A002 Cryptography — not applicable

- ELRS uses LoRa spread-spectrum on ISM bands. No "information security" function as defined in Cat 5 Part 2.
- WiFi on FC uses standard 802.11 with published commercial crypto. Cat 5 Part 2 Note 3 ("Cryptography Note") exempts mass-market items using only published/standard crypto and available at retail without restriction. Incutec meets all criteria.

### 7A003 / 7A103 Inertial Navigation — not applicable

- 7A003: military INS with bias stability ≤0.5°/h gyro — hobby MEMS IMUs 100-1000× worse
- 7A103: missile-grade INS. Not close.

### 9A012 UAVs — not applicable (to components)

- EU 9A012 controls complete UAV SYSTEMS with endurance ≥30 min AND range ≥300 km. FPV racing 3-8 min flight typical. Not in scope.
- Controls COMPLETE systems, not components.
- 9A012.b captures "specially designed components" only where specific to controlled UAV systems. Betaflight FC / BLHeli ESC = generic commodity electronics usable in anything with 4+ motors.
- US BIS relaxing 9A012 in 2026 (EO 14307, Interim Final Rule Jan 2026): explicitly carving out non-military UAS with endurance <30 min. EU hasn't mirrored, but direction of travel confirms hobby FPV out of scope. [Federal Register](https://www.federalregister.gov/documents/2026/01/21/2026-01059/streamlining-export-controls-for-drone-exports)

### 9A112 — not applicable

UAV subsystems with payload/range thresholds FPV hardware doesn't meet.

## 2. Article 4 Catch-All (Military End-Use) — real RISK

Art. 4 is the trap. Even unlisted items require license if exporter "is aware" or "has been informed" items are for:
- WMD end-use
- Military end-use in arms-embargoed countries (Russia, Belarus, Iran, Syria, Myanmar, DPRK)
- Components in illegally exported military items

**Trigger:** If Flanders CSG writes "we're aware your products may be used militarily in X", must stop shipping to that destination without license regardless of Annex I. No notice = no obligation, but "should have known" applies for obvious red flags.

**Red flags requiring rejection:**
- Ships to Russia, Belarus, Iran, Syria, DPRK, Crimea, DNR, LNR (prohibited anyway)
- Bulk (>50 units) from Turkey, UAE, Kazakhstan, Kyrgyzstan, Armenia, Georgia, Uzbekistan, Serbia, China, Hong Kong — documented Russia diversion hubs per EU 14th/17th sanctions packages
- Customers with military-sounding names, government agency addresses
- Orders requesting "military" configurations, ruggedization, removed civilian markings
- Rushed orders with payment from third-country entities

## 3. Russia/Belarus Sanctions — The Actual Compliance Burden

### Annex VII (Reg 833/2014)

Advanced tech items banned to Russia. Aluminum capacitors added in 13th package (Feb 2024). MCUs listed. Incutec products contain 8542.31 MCUs → **component-level ship to Russia prohibited.** No direct/indirect sales to Russia, Belarus, Crimea, DNR, LNR. Period.

### Annex XL (Common High Priority Items) — Affects Incutec Directly

Incutec's core components are on the list:

- **HS 8542.31** Processors and controllers (FC MCUs STM32, AT32): **TIER 1**
- **HS 8542.39** Other ICs: **TIER 1**
- **HS 8526.91** Radio navigational aid (GPS on FC): **TIER 2**
- **HS 8532.24** Ceramic dielectric multilayer caps: **TIER 2**
- **HS 8504.40** PSUs / DC-DC (ESC, FC): **TIER 3.A**
- **HS 8517.62 / 8517.69** Radio transceiver (ELRS RX, VTX): **TIER 2/3.A**
- **HS 8548.00** Electrical parts n.e.c.: **TIER 2**

[CHPL (BIS)](https://www.bis.gov/licensing/country-guidance/common-high-priority-items-list-chpl)

### Article 12g "No Re-Export to Russia" Clause — mandatory from 20 Mar 2024

**Applies to Incutec** (sells Annex XL goods). Requirements:
- All B2B contracts with non-EU buyers must include no-Russia re-export clause
- Clause must include enforceable penalty/termination remedies
- Exempt countries (Annex VIII): AU, CA, IS, JP, NZ, NO, KR, CH, UK, USA, LI
- Shipping Swiss/US retailer = no clause. Turkish/UAE/Serbian/Kazakh retailer = clause required.

**DTC consumer sales?** Regulation targets "contract partners not established in EU" — written for B2B. Consumer Shopify orders arguably not "contracts" in this sense, but EC guidance doesn't exempt DTC. **Prudent:** put clause in Shopify ToS as condition of purchase for non-EU shipments. Cheap insurance.

[Commission FAQ no-re-export](https://finance.ec.europa.eu/system/files/2024-02/faqs-sanctions-russia-no-re-export_en.pdf) · [Arnold & Porter briefing](https://www.arnoldporter.com/en/perspectives/advisories/2024/04/the-no-re-export-to-russia-clause)

### Required Contract Clause Template

```
No Re-export to Russia: Article 12g Compliance Clause

(1) The Buyer shall not sell, export or re-export, directly or indirectly,
to the Russian Federation, to Belarus, or for use in the Russian Federation
or in Belarus, any goods supplied under or in connection with this Agreement
that fall under the scope of Article 12g of Council Regulation (EU) No
833/2014.

(2) The Buyer shall undertake its best efforts to ensure that the purpose
of paragraph (1) is not frustrated by any third parties further down the
commercial chain, including by possible resellers.

(3) The Buyer shall set up and maintain an adequate monitoring mechanism
to detect conduct by any third parties further down the commercial chain
that would frustrate the purpose of paragraph (1).

(4) Any violation of paragraphs (1), (2), or (3) shall constitute a
material breach of an essential element of this Agreement, and Incutec BV
shall be entitled to seek appropriate remedies, including (a) termination
of this Agreement and (b) a penalty of 100% of the contract value or
€10,000, whichever is higher.

(5) The Buyer shall immediately inform Incutec BV of any problems in
applying paragraphs (1), (2), or (3), including any relevant activities
by third parties that could frustrate the purpose of paragraph (1). The
Buyer shall make available to Incutec BV information concerning compliance
with the obligations under paragraphs (1), (2), and (3) within two weeks
of the simple request of such information.
```

## 4. Iran Sanctions (Reg 267/2012)

Iran sourcing components for Shahed-136 drones via third countries. EU added UAV-components restrictions in 2023. Ship NOTHING to Iran. Flag bulk orders from Iran-adjacent diversion hubs (UAE, Turkey, Armenia).

## 5. Practical Compliance

### Ship WITHOUT license and WITHOUT No-Russia clause:
- All 27 EU Member States
- Annex VIII partners (no clause): NO, CH, UK, USA, CA, AU, NZ, JP, KR, IS, LI

### Ship but must include No-Russia clause (B2B):
- Everywhere else non-EU, non-Annex VIII: Turkey, UAE, TH, BR, IN, MX, SG, MY, VN, ZA, etc.

### CANNOT ship (sanctions-prohibited):
- Russia, Belarus (full embargo on Annex VII/XL goods incl. 8542.31 MCU)
- Iran, Syria, DPRK (full embargo)
- Crimea, DNR, LNR, Kherson, Zaporizhzhia occupied zones
- Myanmar (partial, avoid entirely)
- Cuba (US extraterritorial risk if using US-origin ICs — verify)

### Enhanced Due Diligence (high-diversion-risk, even if legal):
- Turkey, UAE, Kazakhstan, Kyrgyzstan, Armenia, Georgia, Uzbekistan, Serbia, China, Hong Kong, Vietnam
- Require end-user statement, verify company website, check sanctions lists, limit quantities, red-flag unusual payment routing

## 6. Belgian Export Control Authority

**Flanders:** Departement Kanselarij en Buitenlandse Zaken, Dienst Controle Strategische Goederen (dCSG).
- [fdfa.be/csg](https://www.fdfa.be/csg) · [Digital counter](https://www.fdfa.be/nl/digitaal-loket)
- Benelux exemption: no license for intra-Benelux transfers of dual-use
- Licenses via Digitaal Loket
- Fees: none for individual licenses (per public info; VERIFY before first app)
- Timelines: 4-8 weeks individual (unverified EU estimate)

**Incutec: no license apps needed unless Art. 4 catch-all notice received.** Registration not required proactively for non-listed items.

## 7. Internal Compliance Programme (ICP) — Recommended, Not Mandatory

**Not legally mandatory** for non-listed exporters. Becomes mandatory if applying for Global Licence under Art. 12(4) of 2021/821.

EU Commission strongly recommends ICPs for potentially sensitive items. Incutec products ARE potentially sensitive (Annex XL, Russia diversion risk) → **strongly recommended** despite not mandatory. Proportionate to size: one-page policy + screening SOP + record-keeping sufficient at Incutec's scale.

[EU Recommendation 2019/1318](https://eur-lex.europa.eu/eli/reco/2019/1318/oj)

**Minimal ICP skeleton:**
1. Top-level management commitment (signed statement by Stan)
2. Responsibility assignment (Stan = export compliance officer)
3. Item classification (this memo, update annually)
4. Customer/transaction screening (see sanctions-screening.md)
5. End-use/end-user screening (red flag checklist, EUS for bulk orders)
6. Record-keeping (5 years order/screening records)
7. Training (Stan reads updates annually; staff trained before first export work)
8. Audit & review (annual self-audit)
9. Reporting (escalation path to Flanders CSG)

## 8. When to Lawyer Up

- **Immediately** if Flanders CSG sends catch-all notice (Art. 4 letter)
- **Before first wholesale** to high-risk country (Turkey, UAE, Kazakhstan, China): one-time €500-1500 legal review of Shopify ToS + wholesale templates
- **Order >€10K** suspicious and Stan can't decide alone
- **Customs stops shipment** anywhere in EU
- **Firms:** Belgian export control/sanctions specialists — NautaDutilh Brussels, Van Bael & Bellis, Baker McKenzie Brussels. Startup budget: solo practitioners or boutique firms.

## 9. Contract/ToS Action Items

- [ ] Add No-Russia Clause to wholesale agreement template (B2B): **mandatory**
- [ ] Add No-Russia Clause to Shopify ToS (non-EU, non-Annex VIII): recommended
- [ ] Add export control + sanctions compliance warranty to Shopify ToS
- [ ] Block Russian/Belarusian/Iranian/Syrian/DPRK/Cuban/Crimea/DNR/LNR shipping in Shopify country dropdown
- [ ] Implement EUS form for any B2B order >€5,000 to non-Annex VIII country
- [ ] Publish public Export Compliance Policy on incutec.eu (reference: iFlight)

## 10. Summary Matrix

| Scenario | License | Clause | Risk |
|----------|---------|--------|------|
| DTC BE consumer | No | No | None |
| DTC DE/FR consumer | No | No | None |
| DTC CH consumer | No | No (Annex VIII) | None |
| DTC US consumer | No | No (Annex VIII) | Low (US re-export on 5A002 if chips) |
| DTC Turkey consumer | No | Recommended in ToS | Low |
| Wholesale CH retailer | No | No | Low |
| Wholesale UK/US retailer | No | No (Annex VIII) | Low |
| Wholesale Turkey retailer | No | **Yes mandatory** | Medium (diversion) |
| Wholesale UAE retailer | No | **Yes mandatory** | HIGH (diversion) |
| Wholesale Kazakhstan retailer | No | **Yes mandatory** | HIGH (diversion) |
| Anywhere → Russia/Belarus | **PROHIBITED** | N/A | Criminal |
| Anywhere → Iran/DPRK/Syria | **PROHIBITED** | N/A | Criminal |

## Sources

- [EU Reg 2021/821 Dual-Use](https://eur-lex.europa.eu/eli/reg/2021/821/oj/eng)
- [EU Reg 833/2014 Russia consolidated](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02014R0833-20240625)
- [Commission FAQ No-Re-Export](https://finance.ec.europa.eu/system/files/2024-02/faqs-sanctions-russia-no-re-export_en.pdf)
- [Arnold & Porter 12g](https://www.arnoldporter.com/en/perspectives/advisories/2024/04/the-no-re-export-to-russia-clause)
- [INN Law no-Russia clause](https://www.inn.law/en/insights/no-russia-clause)
- [CHPL BIS](https://www.bis.gov/licensing/country-guidance/common-high-priority-items-list-chpl)
- [Flanders CSG](https://www.fdfa.be/csg)
- [EU Recommendation 2019/1318 ICP](https://eur-lex.europa.eu/eli/reco/2019/1318/oj)
- [iFlight Export Policy (benchmark)](https://shop.iflight.com/Export-Policy-info)
- [OCCRP EU parts in Russian drones](https://www.occrp.org/en/investigation/made-in-the-eu-dropped-on-kyiv-how-european-parts-are-enabling-russias-winter-drone-war)
- [BIS drone IFR Jan 2026](https://www.federalregister.gov/documents/2026/01/21/2026-01059/streamlining-export-controls-for-drone-exports)

**Unverified:**
- Flanders CSG license fees (stated none — verify)
- Flanders CSG processing time (stated 4-8 weeks — EU industry estimate)
- DTC consumer sales technically triggering Art. 12g (conservative: include clause in ToS anyway)
- PCB design technology exports + Art. 5 cyber-surveillance catch-all (not analyzed, low risk for OSHW)
