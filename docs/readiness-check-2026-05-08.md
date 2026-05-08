# Launch-readiness check — 2026-05-08

Automated follow-up audit two weeks after the FR locale + GPSR/CRA metafield
wiring shipped. Checks: `[pending]` defaults, Storefront metafield population,
git activity since 2026-04-24.

---

## 1. `app/lib/company.ts` — pending defaults

Three fields remain unresolved (unchanged since the initial pre-launch sync):

| Field | Current value |
|-------|--------------|
| `kbo` | `[pending]` |
| `vat` | `BE[pending]` |
| `tel` | `[pending]` |

`name`, `address`, and `email` are populated (`Incutec BV`, `Stapelhuisstraat 15,
3000 Leuven, Belgium`, `contact@opendrone.be`).

**No commit has touched `company.ts` since `2fcf9e0` (pre-launch sync,
pre-2026-04-24).** The file is also mirrored verbatim in `.env.example`
(`PUBLIC_COMPANY_KBO`, `PUBLIC_COMPANY_VAT`, `PUBLIC_COMPANY_TEL` all still
`[pending]`).

**Impact**: WER Art. VI.45 (BE webshop) requires the legal entity's KBO number,
VAT number, and a phone or contact address on every page. Missing KBO/VAT renders
the footer legally non-compliant at launch.

---

## 2. Storefront API — metafield population status

**The 15 `custom.*` metafields are fetched in the `PRODUCT_QUERY` GraphQL
fragment** (lines 815–858 of `app/routes/products.$handle.tsx`) but **none are
rendered in the component tree** as of commit `b9225b3` (`ui(pdp): remove
MANUFACTURER · SAFETY · DOCUMENTATION block`). The data lands in the loader
response and is then silently discarded.

**API probe result**: Cannot execute — no live Storefront API token is stored in
the repo (`.env.example` has empty strings; CI uses the stub `"ci-stub"`). A
real-token probe from Shopify admin would be needed to confirm which metafields
are populated vs null on the `openfc` product.

**Consequence**: Even if all 15 metafields were populated in Shopify admin today,
they would not appear on the product page. Either the render block needs
reinstating (or a replacement component) before launch, or the metafields should
be removed from the query to eliminate dead payload.

---

## 3. Git activity since 2026-04-24

50+ commits merged. **None relate to KBO/VAT, company phone, or metafield
population.** Notable activity:

| Commit | Subject |
|--------|---------|
| `b9225b3` | `ui(pdp): remove MANUFACTURER · SAFETY · DOCUMENTATION block (#60)` — removes the compliance render block |
| `4714c95` | `Pre-launch audit: compliance, perf, a11y, security, ops, seo + README rewrite (#70)` — adds Product JSON-LD, tightens robots.txt, hardens Turnstile, adds `fr` to security.txt |
| `ff8def8` | `security: hardening round 3 — account cache, logout GET, headers, npm overrides` |
| `cfefca4` | `security: hardening round 2 — buyer-identity, body cap, URL allowlist, search bounds` |
| `d42e137`–`4c08a22` | Support bridge: Discord thread lifecycle, Upstash archive, AI drafts, moderation gate |

No KBO/VAT/phone registration activity. No FR translation commits (those
pre-date the window). No new Oxygen secret definitions.

---

## 4. Remaining admin action list

| # | Action | Owner | Blocker? |
|---|--------|-------|---------|
| 1 | **Receive KBO number from CBE** — IncuTec BV registration in-flight as of 2026-04-24 | Stan / legal | **Yes — blocks legal compliance** |
| 2 | **Set `PUBLIC_COMPANY_KBO`, `PUBLIC_COMPANY_VAT`, `PUBLIC_COMPANY_TEL`** in Oxygen env + update `.env.example` and `DEFAULTS` in `company.ts` | Stan (dev) | Unblocks WER Art. VI.45 |
| 3 | **Decide: restore or retire the compliance metafield render block** — commit `b9225b3` removed it; the 15 `custom.*` metafields are still fetched but never displayed | Stan (dev) | Blocks GPSR/CRA disclosure on PDP |
| 4 | **Populate `custom.*` metafields on each product in Shopify admin** (safety warnings NL/FR/EN, model number, batch ID, firmware version, support end date, vuln contact, battery specs, URLs) | Stan (admin) | Blocks CRA Art. 13 disclosure |
| 5 | **Probe live Storefront API** (needs real token from Shopify admin → Headless → Storefront API) to confirm which metafields return values vs null | Stan (admin) | Required for gap analysis |
| 6 | **Remove dead metafield payload from `PRODUCT_QUERY`** if the block is not being reinstated — saves ~600 B per PDP response | Stan (dev) | Nice-to-have |
| 7 | **Set `DISCORD_STAFF_METADATA_CHANNEL_ID`** in Oxygen if not done — currently guards PII routing in the support bridge | Stan (admin) | Ops / privacy |

---

## 5. Launch-readiness assessment

**Not yet launch-ready.**

The two hardest blockers remain external-registration-gated:

- **KBO/VAT number** is the single item with no code workaround — it requires
  the Belgian CBE to complete the IncuTec BV registration. Until that number is
  in hand the storefront legally cannot display a compliant imprint.

- **Compliance metafield render** was removed in the last two weeks without a
  replacement. If GPSR/CRA disclosure is a launch requirement (it is for EU
  consumers), reinstating a render surface is a code task that can be done now,
  but the Shopify admin data population (action 4) must happen in parallel.

**What has improved since 2026-04-24**: The support bridge is production-grade
(archiving, AI drafts, moderation gate, Upstash backend). Security hardening
rounds 2 & 3 are in. Product JSON-LD and SEO polish landed. The store is
technically solid and operationally ready once the legal identity and compliance
display gaps are closed.

**Recommended unblocking sequence**: (1) KBO received → (2) env vars set in
Oxygen + `company.ts` updated → (3) compliance render block reinstated → (4)
metafields populated in Shopify admin → (5) smoke-test PDP on
staging → launch.
