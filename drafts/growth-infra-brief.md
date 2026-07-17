# Growth infrastructure brief — analytics, email automation, CRM, notify funnel

*Compiled 2026-07-06. Working brief for all growth-infra agents. Read fully before
touching `app/`. Companion to `drafts/ui-overhaul-brief.md` (design rules) and
`drafts/launch-plan-2026-07-02.md` (launch blockers). Maps to ISS Werkpakketten
A (interviews), B (per-kanaal-analytics), D (Made-in-EU meerprijs).*

## Decisions taken (Stan AFK 2026-07-06 — flag if wrong, all reversible at this stage)

1. **Analytics = Plausible Cloud** (script already live in `root.tsx:319-325`, base build).
   Upgrade to tagged-events + revenue script variants, add goals/funnels.
2. **NO pre-orders — Stan's decision 2026-07-06.** Notify-at-launch signup is the
   only demand mechanism; products go on normal sale when released. The research
   memo's pre-order legal analysis (section C) is kept for reference only — do not
   build reserve/deposit/pre-payment flows of any kind.
3. **CRM = OpenBrain**, eventually. OpenBrain's `crm.*` schema exists but is a support
   ticket store, explicitly NOT a sales CRM, and OpenBrain has no EU hosting yet.
   Interim: **web repo owns capture** in an Upstash ledger with a clean export path.
4. **Email automation = Resend** (already integrated for support transactional).
   Shopify Email remains usable for manual blasts during transition.

## What exists today (from repo + OpenBrain audits, 2026-07-06)

- Plausible base script hardcoded `root.tsx:319-325` — no custom events, no goals,
  no revenue. Hydrogen `Analytics.*View` events emitted (search/collection/product)
  but **nothing consumes them**; Shopify pixel deliberately not shipped.
- No consent banner (`withPrivacyBanner: false`); cookie policy says Plausible is
  cookieless so none needed. `cookie-settings.tsx` is disclosure-only.
- Cart action (`app/routes/cart.tsx`) has **no `AttributesUpdate` case** — hydrogen's
  `cart.updateAttributes()` exists but is unwired. Cart attributes flow to Shopify
  order custom attributes = the attribution join.
- No webhook receiver exists. `SHOPIFY_WEBHOOK_SECRET` documented in `env.d.ts`,
  unimplemented. Model on `api.support.cleanup.tsx` (secret-gated POST) with HMAC
  over raw body.
- Signup pipeline (`newsletter._index.tsx` action): captures email + consent +
  optional product handle → Shopify customer (`acceptsMarketing`) + `notify-<handle>`
  tag. **Not captured:** timestamp of our own, locale, channel/UTM, any local record.
- Resend primitive: `app/lib/support/email.ts` (send + HTML template renderer).
- Upstash Redis REST: `app/lib/support/upstash.ts` (KV + global rate limit) — the
  durable store available to Oxygen (no KV binding on Oxygen).
- OpenBrain (`/Users/stan/OpenBrain`): Python/FastAPI/Postgres+pgvector. KB (PII-free
  by hard rule) + flag-gated CRM ticket store (`crm.customer/ticket/message`,
  keyed on `shopify_customer_id`, RtbF tombstone). Old-roadmap M4 scopes Shopify
  webhooks + unified customer profile; explicit non-goals: "deal pipelines, CDP,
  real-time push". EU hosting + DPA review are hard prerequisites, not done.
- Web-side OpenBrain client scaffold: `app/lib/support/openbrain.ts` (X-OpenBrain-Key,
  `SUPPORT_BACKEND` gate, dormant).

## Architecture — the data spine

```
visitor lands (utm_* on every outbound link we control)
  → Plausible (aggregate: source/UTM → funnel steps, cookieless, no consent needed)
  → first-touch attribution kept client-side (see ePrivacy note) 
      → written into cart attributes on first LinesAdd (allowlisted keys)
      → Shopify order custom attributes
  → notify signup: action stores a signup record in Upstash ledger
      {email, consentAt, product, locale, channel, euPremium?, interviewOptIn?}
      + Shopify customer + notify-<handle> tag (existing)
      + Resend contact upsert (audience) + welcome email (waitUntil)
orders/paid webhook (HMAC) → order record {channel, total, items} in Upstash ledger
  → per-channel conversion / AOV / CAC = Plausible funnel + ledger reconciliation
export script → OpenBrain crm.* when EU box lands (schema mapping documented per lane)
```

**ePrivacy note (needs Iebe's legal review, due with 18-jul legal task):** the repo's
own cookie policy classes `_orig_referrer`-style attribution cookies as "Marketing,
opt-in". Default design: **session-scoped (not persistent) first-touch UTM in
`sessionStorage`, promoted server-side into cart attributes only when the visitor
acts** (signup/add-to-cart). Disclosed in the cookie policy as functional. If legal
review disagrees, fallback is consent-gating just that storage — do NOT build a
site-wide banner without that verdict. Plausible aggregate stats stay consent-free.

**Upstash ledger keys** (proposal, Lane A+B+C share it — coordinate here):
- `sig:<email>` — signup/profile record (JSON, no TTL; RtbF = DEL)
- `ord:<order_id>` — attributed order record
- `att:idx` — append-only index list for export
All writes via one new module `app/lib/growth/ledger.ts` — single owner of key
shapes. GDPR: email is the join key; anonymize IP (never store raw); document
retention in privacy policy update (flag for legal).

## Lanes (worktree per agent, PR into main, per CLAUDE.md git flow)

### Lane A — analytics + attribution (`feat/analytics-attribution`, port 3001)
Owns: `root.tsx` (script swap only), new `app/lib/growth/attribution.ts` +
`ledger.ts`, `cart.tsx` (AttributesUpdate case only), new `api.webhooks.shopify.tsx`,
`AddToCartButton.tsx` (attribute write hook), Plausible event helper + events:
`Notify Signup` (props: product, channel), `Add to Cart`, `Checkout Click`.
- Swap Plausible script to the tagged-events + revenue variant; goals configured in
  Plausible UI are Stan's 5-min task — list them in the PR description.
- Cart AttributesUpdate: allowlist `_utm_source/_utm_medium/_utm_campaign/_landing`
  (underscore prefix hides them from the customer at checkout), cap 64 chars each,
  mirror the BuyerIdentityUpdate pattern.
- Webhook: HMAC verify (`SHOPIFY_WEBHOOK_SECRET`), **orders/paid** primary, store
  attributed order in ledger, 200 fast + `waitUntil`. Basic-plan caveat: webhook
  payloads REDACT customer name/email/address (Level-2 protected data, Grow+ only);
  order id/totals/lines/note_attributes survive — email joins come from our own
  signup records. Stan registers the webhook via a Dev Dashboard custom app
  (`read_orders` scope — note in PR).
- UTM discipline doc: `drafts/utm-conventions.md` — canonical `utm_source` values
  (youtube, discord, reddit, bardwell, newsletter), link templates for video
  descriptions and Discord. CAC math needs spend input; ledger gives conv + AOV.

### Lane B — email automation (`feat/email-automation`, port 3002)
Owns: `app/lib/growth/resend.ts` (contacts/audiences/broadcast client — do NOT
touch `support/email.ts`), `newsletter._index.tsx` action (ledger write + Resend
upsert + welcome email via `waitUntil`), welcome email template, launch-blast
script `scripts/launch-blast.mjs` (reads notify tags/audience segment, sends via
Resend broadcast; dry-run default).
- Resend model (post-Apr-2026): global Contacts + Segments (not Audiences);
  Automations = event-triggered flows, 10k runs/mo free; Broadcasts auto-handle
  List-Unsubscribe/RFC-8058 + suppression + managed unsubscribe page. Free to
  1,000 marketing contacts, then Pro Marketing $40/mo. Welcome mail: either fire
  an Automation event or send transactionally in the handler (simpler, already
  wired). Sync unsubscribes back to Shopify `acceptsMarketing` best-effort
  (`contact.updated` webhook or poll).
- Blocked by Lane A only on `ledger.ts` — coordinate; Lane A creates it, B extends.

### Lane C — notify micro-survey (`feat/notify-survey`, port 3003)
NO reserve/pre-order semantics anywhere (decision #2). Owns:
`NewsletterSignup.tsx` notify-success panel → 2-question micro-survey shown after
a successful notify signup ("would you pay +10/20/30% more for EU-assembled?";
15-min interview opt-in w/ early-adopter perk), new `api.survey.tsx`
(Turnstile-free — only reachable post-signup with a short-lived HMAC token from
the signup response; rate-limited), ledger profile update (`euPremium`,
`interviewOptIn` fields on the signup record).
- Copy = DRAFT, flagged `TODO(copy-stan)` — Stan rewrites all voice himself.
- Discord launch runbook: `drafts/launch-discord.md` (announce post template,
  utm links, role gate) — draft for Stan, no bot changes.

### Lane D — USP/B2B content pages (`feat/usp-pages`, port 3004)
Owns (all new routes, `open-source.tsx` editorial pattern, EN-only unprefixed):
- `/roadmap` — public roadmap (data array in route, statuses: shipped/in-rev/next).
- `/production` — production story (where boards are made, EU-assembly PoC narrative).
- `/wholesale` — dealer inquiry: 40%-off Y2 channel pitch skeleton + mailto/support
  CTA (no new form backend; route through existing support).
- Upstream receipts: extend `firmware-partners.tsx` with a `MERGED_PRS[]` array
  (real PR URLs — verify each exists via GitHub before listing) or new `/upstream`.
- "You asked, we changed" per-product: new optional `communityChanges` field in
  `product-content.ts` (issue URL → what changed in which rev), rendered as a PDP
  section. Populate ONLY entries verifiable in the hardware repos' issues/history.
- ALL COPY DRAFT — `TODO(copy-stan)` markers throughout.

### Lane E — compliance surface (`feat/compliance-surface`, port 3005)
Owns: `product-content.ts` types (+`'doc'` DownloadKind, DoC slot per SKU, empty
until CE closes), PDP manufacturer block (GPSR: Incutec BV, address, email from
`PUBLIC_COMPANY_*` via `company.ts`) on every product listing, rendered near specs.
Small lane — can merge first.

### Lane F — OpenBrain CRM (separate repo, NOT this codebase)
Scope after ledger shape stabilizes: marketing-profile table beside `crm.customer`
(consents, channel, survey answers, notify tags), web-ledger import script,
Shopify webhook receivers (old M4 scope), GDPR webhooks. Blocked on EU hosting +
DPA review (IMPLEMENTATION.md prerequisites). Do not start until Lanes A-C merge.

## Coordination — SUPERSEDED (all lanes merged; live registry is now `drafts/coordination.md`)

| Lane | Branch | Port | Status | Owner |
|---|---|---|---|---|
| A analytics | feat/analytics-attribution | 3001 | MERGED (PR #279 + fixups PR #281: `_utm_*` hidden keys, orders/paid topic) — worktrees removed; utm doc in drafts/utm-conventions.md | Lane A agent |
| B email | feat/email-automation | 3002 | MERGED (PR #282, 2026-07-06) — resend.ts marketing client (global Contacts + notify-<handle> Segments), ledger `recordSignup` (sig:<email> merge-don't-clobber: Lane C write survey fields via the same read-modify-write pattern), newsletter action growth job (waitUntil), hidden `channel` input added to NewsletterSignup.tsx (additive — C's success-panel area untouched), scripts/launch-blast.mjs (dry-run default); worktree removed. Stan follow-ups in PR #282 (Resend domain + RESEND_MARKETING_FROM in Oxygen; unsubscribe→Shopify sync NOT built) | Lane B agent |
| C survey | feat/notify-survey | 3003 | MERGED (PR #284, 2026-07-07) — 2-question micro-survey on notify success (EU-premium pills + interview Yes/No), token-gated `api.survey.tsx`, `recordSurveyAnswers` ledger merge, Plausible events `Survey EU Premium`/`Survey Interview`. Browser-verified full flow end-to-end (both POSTs 200, degrade-soft clean). Agent died on credits pre-PR; oversight session rebased past #283 (gold-theme conflict in NewsletterSignup.tsx), verified, shipped. Discord launch runbook: drafts/launch-discord.md | oversight session |
| D USP pages | feat/usp-pages | 3004 | MERGED (PR #280, 2026-07-06) — /roadmap /production /wholesale live; MERGED_PRS scaffold empty (zero verifiable upstream PRs, checked 2026-07-06); communityChanges rendered on openesc; worktree removed | Lane D agent |
| E compliance | feat/compliance-surface | 3005 | MERGED (PR #277, 2026-07-06) — GPSR block + 'doc' DownloadKind | Lane E agent |

Shared-file conflicts to watch: `newsletter._index.tsx` (B action, C success-flow),
`NewsletterSignup.tsx` (C), `product-content.ts` (D `communityChanges`, E downloads/
GPSR — different sections, rebase carefully), `env.d.ts` (A, B — additive, rebase).
`ledger.ts` is Lane A's file; B and C extend after A merges. Merge order preference:
E → A → B → C → D (D independent, anytime).

Rules: worktree per agent, small commits, push every commit, typecheck+lint before
PR, squash-merge, everyone rebases after any merge. Tokens-only styling, light mode
twin for any dark literal. New env vars: additive to `.env.example` + `env.d.ts`
with comments; never rename existing ones.

## Stan's manual follow-ups (accumulating list)
1. Plausible: upgrade subscription to **Business tier (€19/mo yearly)** — funnels,
   revenue, Stats API are Business-gated. Then add goals/funnels in UI (list in PR).
2. ~~Shopify webhook + scopes~~ DONE 2026-07-06 (agent, via admin):
   - Shop-level webhook "Order payment" → https://opendrone.be/api/webhooks/shopify
     (JSON, 2026-07) registered at Settings→Notifications→Webhooks.
   - OpenDrone Infra app: version `customers-orders-scopes` released + grant
     accepted → token now has read/write_customers + read_orders.
   - FINDING: notify tagging was broken since day one — NO app had customer
     scopes. 3 real early signups exist with no notify tags (interest lost).
   Still Stan (~1 min, secret values so agent leaves them to you) — Hydrogen
   storefront → Environments and variables, add for Production+Preview:
   (a) `SHOPIFY_WEBHOOK_SECRET` = the signing secret shown on
       Settings→Notifications→Webhooks;
   (b) `SHOPIFY_ADMIN_API_TOKEN` = the shpat_ value from local .env (prod has
       NONE today — prod notify tagging stays broken until this lands).
   Then a test order to confirm which fields survive Basic-plan redaction.
   Also noted: Infra app shows "API health: fix by Jan 1" (breaking-change API
   calls in the last 14 days — likely the blog publisher); see Dev Dashboard →
   Monitoring.
3. Resend: verify domain for marketing sends (separate from support@ if desired).
4. Copy passes on all `TODO(copy-stan)` markers (Lanes C, D).
5. Legal: attribution-storage ePrivacy verdict + privacy-policy processor table
   update (Resend marketing use, Upstash ledger) — fold into Iebe's 18-jul task.
6. UTM links: adopt `drafts/utm-conventions.md` in every video description /
   Discord post / Bardwell brief.
7. Decide EU-premium survey percentages (draft uses +10/20/30%).

## Research memo: `drafts/growth-stack-research.md` (2026-07-06)
Plausible tiers (Business €19/mo needed), Resend Contacts/Automations model,
pre-order EU consumer-law analysis (full prepayment + dated window lawful;
selling plans kill Bancontact), CRM comparison (OpenBrain wins), Shopify Basic
webhook PII-redaction caveat.
