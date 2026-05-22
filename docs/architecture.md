# Architecture

Repo layout, routes, and what each subsystem does. Config is in
[environment.md](environment.md); scripts/CI/deploy in
[operations.md](operations.md); headers and secrets in
[security.md](security.md).

## Repo layout

```
app/
  root.tsx                          shell, <html>, head, JSON-LD, layout
  entry.server.tsx                  CSP, security headers, HTMLRewriter for module-preload
  entry.client.tsx                  hydration entry
  routes.ts                         flat-routes + locale-prefix legal routes
  routes/                           68 route files (see Routes)
  components/                       shared React components
  content/legal/{en,nl,fr}/         legal markdown snapshots (sync:legal target)
  graphql/customer-account/         Customer Account API queries
  lib/                              i18n, SEO, company, support bridge, fragments
  styles/app.css                    single Tailwind v4 + custom CSS file (~8600 lines)
public/                             static assets, GLB models, self-hosted fonts, wordmark, board-art SVGs
scripts/                            sync-legal, publish-post, compose-newsletter, smoke, board-art export, wordmark gen, shopify-templates/gen
.github/workflows/                  ci.yml, oxygen-deployment-*.yml, support-cleanup.yml
```

`/dist`, `/.shopify`, `/.react-router`, `tsconfig.tsbuildinfo` are gitignored build artefacts.

## Routes

68 file-based routes under `app/routes/`. Highlights, by family:

**Storefront**
- `_index.tsx` — homepage (3D hero scene, splash, hero CTA)
- `collections._index.tsx`, `collections.$handle.tsx`, `collections.all.tsx`
- `products.$handle.tsx` — PDP with editorial chapters, gallery, firmware contribution split, latest-commit card, JSON-LD Product
- `cart.tsx`, `cart.$lines.tsx` — Hydrogen cart actions, country forced to BE
- `search.tsx` — site search with Aside drawer + predictive results
- `contact.tsx` — Discord widget iframe + ticket intake CTA + direct contact
- `firmware-partners.tsx`, `open-source.tsx`, `blog._index.tsx`, `blog.$handle.tsx`

**Customer account** (signed-in)
- `account.tsx` — layout
- `account._index.tsx`, `account.profile.tsx`, `account.addresses.tsx`
- `account.orders._index.tsx`, `account.orders.$id.tsx`
- `account.support.tsx` — ticket history + read-only thread view
- `account_.login.tsx`, `account_.logout.tsx`, `account_.authorize.tsx` — OAuth
- `account.welcome.tsx`

**Support bridge** (see [Support bridge](#support-bridge))
- `support.tsx` — intake / active-ticket view
- `support.resume.tsx` — magic-link entry
- `api.support.start|send|poll|close|status|list|feedback|lookup|cleanup.tsx` — bridge API
- `api.support.thread.$pid.tsx` — read-only thread fetch by public ticket id

**Legal / i18n**
- `algemene-voorwaarden.tsx`, `privacy.tsx`, `cookies.tsx`, `cookie-settings.tsx`, `herroepingsrecht.tsx`, `shipping.tsx`, `warranty.tsx`, `security.tsx`, `export-compliance.tsx`, `end-use.tsx`, `terms.tsx`, `legal.tsx` — each served at `/<slug>` (locale-cookie redirect) and `/{en,nl,fr}/<slug>` (canonical)

**Newsletter / blog**
- `newsletter.tsx` — opt-in landing page (loader) + signup handler (action: writes to Shopify customer list with `acceptsMarketing=true`, `newsletter` tag)
- `blog._index.tsx` — single consolidated blog archive (reads the Shopify `news` blog), tag filter, year grouping, RSS auto-discovery
- `blog.$handle.tsx` — individual post (prev/next, optional version chip, subscribe CTA)
- `releases._index.tsx`, `releases.$handle.tsx`, `[releases.rss].tsx`, `blogs._index.tsx`, `blogs.$blogHandle._index.tsx`, `blogs.$blogHandle.$articleHandle.tsx` — 301 redirect stubs into `/blog` (old URLs)

**Misc / infra**
- `healthz.tsx` — uptime probe
- `[robots.txt].tsx`, `[sitemap.xml].tsx`, `sitemap.$type.$page[.xml].tsx`
- `[blog.rss].tsx` — RSS 2.0 feed of blog articles (old `/releases.rss` redirects here)
- `[.well-known].security[.txt].tsx` — RFC 9116 contact record
- `api.$version.[graphql.json].tsx` — Hydrogen storefront API proxy
- `discount.$code.tsx` — discount-code apply + redirect
- `pages.$handle.tsx`, `policies.$handle.tsx`, `policies._index.tsx`
- `$.tsx` — 404 catch-all

## Subsystems

### Catalog / PDP

`products.$handle.tsx` queries the Storefront API for full product data plus 15 GPSR/CRA-relevant `custom.*` metafields:

```
safety_warnings_{nl,fr,en}, datasheet_url, manual_url, doc_url, sbom_url,
github_repo, model_number, batch_id, firmware_version, support_end_date,
vuln_contact_email, battery_wh, battery_un_number
```

`ProductCompliance` component renders these. Currently not mounted on PDP (removed in #60); content is queried but not displayed. PDP is editorial: hero copy + gallery + chapters (teardown, open-source, in-the-box, firmware, specs, downloads). `LatestCommit` cards pull `repoUrl` HEADs from GitHub (best-effort, fail-quiet). `FirmwareSplit` adds an optional €N+€1 firmware-contribution variant on PDPs configured for it.

Editorial copy is keyed by handle in `app/lib/product-content.ts`, the source of truth for chapters, specs, and the box list. Two product-line features hang off it:

- **Comparison ladder** (`VariantLadder`). Lines like OpenESC (20×20 / 30×30) and OpenRX (Lite / Lite-UFL / Mono / Gemini) are a single Shopify product with a variant axis, not separate products. When a handle defines `optionAxis` + `variants`, the PDP renders a tier-card selector that doubles as the buy-axis. Editorial is the source of truth for which tiers exist; the card wires to a real Shopify variant by matching the option name (`optionAxis`) and value (the `variants` key), case-insensitive. Until those Shopify variants exist the ladder still renders for preview and the cart uses the single default variant. `ProductForm` is told to skip the axis the ladder owns via `hideOptionNames`.
- **Board art** (`BoardArt`). When a handle's teardown sets `boardArt`, the teardown chapter inlines a layered SVG of the PCB (`/boards/<handle>/board.svg`, generated by `scripts/export-board-art.mjs`), reveals copper layers on scroll, and offers a Top/Bottom toggle plus an optional "Inspect interactively" link to KiCanvas. See [Board art pipeline](#board-art-pipeline).

### Cart

`cart.tsx` uses `CartForm` actions. `BuyerIdentityUpdate` is allowlisted to `email` and `phone`; `countryCode` is hard-locked to `BE` regardless of client input — prevents an attacker from switching the cart's market between SSR render and checkout.

### Customer accounts

OAuth via `context.customerAccount.authorize()` (Hydrogen SDK). State + nonce + redirect URI handled by the SDK. Account routes use the Customer Account API queries in `app/graphql/customer-account/`. Logout is GET `/account/logout`.

### Support bridge

Stateless web ↔ Discord chat bridge. Customer opens a ticket on `/support` (signed-in) or `/contact` (unauth → sign-in CTA). Worker creates a thread in a Discord forum channel; replies in the thread come back to the browser via 4-second short polling. No DB on the server — ticket identity lives in a signed HttpOnly cookie + an Upstash Redis index for cross-device lookup.

Five staged moderation/AI layers, each toggleable via env:

1. **Outbound scrubber** — strips Unicode bidi/control chars, redacts emails / IBANs / phones / cards / JWTs / Discord mentions before any Discord message reaches the browser. Author identity flattened to first-name only.
2. **Moderation gate** — staff messages only reach the customer when a `SUPPORT_MOD_ROLE_ID` member reacts with `SUPPORT_APPROVE_EMOJI` (default ✅). Modes: `enforce` / `log` / `off`. Mod allowlist cached per-isolate for 1h.
3. **Inbound scrubber** — narrower than outbound; strips credentials/cards/bidi but lets the user's own contact info through (they need it for context).
4. **AI first-responder** *(off by default)* — when `SUPPORT_AI_DRAFTS_ENABLED=1` + `ANTHROPIC_API_KEY` set, every new ticket gets a Claude-drafted reply posted into the Discord thread with `🤖 **AI draft:**` prefix. Goes through the same moderation gate.
5. **Thread summariser** *(same flag)* — once a thread has ≥8 non-bot messages since the last recap, the bot drafts a summary tagged `🤖 **Recap so far up to msg_id=…:**`. Mod ✅ → customer's widget shows the recap as one `role: 'ai'` message.

**Two-channel privacy model.** Discord can't hide parts of one message from some viewers, so the bridge optionally splits: public forum thread shows first-name + scrubbed body; private staff-only channel (`DISCORD_STAFF_METADATA_CHANNEL_ID`) gets the full PII (email, customer GID, anonymised IP `/24` or `/48`, truncated UA). Without the staff channel ID set, full PII goes into the public thread (legacy behaviour).

**Cross-device resume.** Two paths:
- **Tier 1, magic link.** New ticket triggers a Resend email with `https://opendrone.be/support/resume?t=<token>`. Token is HMAC-signed with audience `aud:support-resume-v1`, 1-year TTL.
- **Tier 2, list by email.** User enters their address on the widget; `/api/support/lookup` checks the Upstash ticket index plus the Discord active+archived threads, emails one resume link per match. Always returns generic success — never confirms whether an email has tickets.

**Daily sweep.** `.github/workflows/support-cleanup.yml` POSTs `/api/support/cleanup` at 03:17 UTC with a bearer token. Deletes Discord threads + Upstash index entries for tickets that are closed or have had no activity for 7 days; closed threads get a 1-day grace period before deletion.

**Files.** UI in `app/components/SupportWidget.tsx`, `SupportThread.tsx`, `FeedbackModal.tsx`. Server in `app/lib/support/{discord,session,resume-token,scrubber,moderation,ai-draft,email,uploads,turnstile,ticket-index,upstash}.ts` and `app/routes/api.support.*.tsx`. End-to-end runbook in [support.md](support.md); code-level notes in `app/lib/support/README.md`.

### Newsletter

Single, manual flow — no third-party ESP, no auto-dispatch. Three parts:

1. **Subscribe** — the `/newsletter` page (and footer `NewsletterSignup`) POST to the `newsletter.tsx` action, which calls Storefront API `customerCreate` with `acceptsMarketing=true` and tag `newsletter`. Abuse controls: honeypot + Cloudflare Turnstile + per-IP/per-email rate limits. `/newsletter` GET renders an opt-in landing page with recent posts.
2. **Author** — posts are written locally as Markdown in `content/posts/` and pushed to the Shopify `news` blog with `npm run publish:post -- content/posts/<slug>.md` (Admin API `articleCreate`/`articleUpdate` + Files upload for images). Idempotent by slug. They render at `/blog/<slug>`. See `content/posts/README.md`.
3. **Send** — done by hand in Shopify admin: Marketing → Shopify Email → blog-post template → "Subscribed" segment → Send (free to 10k emails/mo). Shopify owns delivery and unsubscribes. `npm run compose:newsletter <handle>` is an optional helper that renders a branded custom-HTML email from a published article.

> A prior AI-scaffolded Resend auto-dispatcher (`app/lib/newsletter/*`, `api.newsletter.dispatch/unsubscribe`) was removed in favour of this manual flow. It's recoverable from git history if auto-send is ever wanted.

### Legal / i18n

Site UI is English-only. Legal documents are translated NL/FR/EN and live at `/{en,nl,fr}/<slug>`. The same component file (`app/routes/<slug>.tsx`) handles all three locales — its loader calls `resolveLegalLoader` in `app/lib/i18n.ts` which reads the URL prefix to pick the markdown snapshot. Unprefixed `/<slug>` URLs redirect to the user's cached locale.

Slugs (in `app/lib/legal-slugs.ts`): `algemene-voorwaarden`, `privacy`, `cookies`, `herroepingsrecht`, `shipping`, `warranty`, `security`, `export-compliance`, `end-use`, `legal`, `cookie-settings`, `terms`.

`LangToggle` only renders on legal paths (everywhere else stays EN). `<html lang>` tracks URL locale. Each legal route emits `hreflang` for EN/NL/FR + `x-default=en` and a self-canonical.

Markdown lives under `app/content/legal/{en,nl,fr}/`. NL snapshot is overwritten by `npm run sync:legal` from the iCloud compliance workstream (`COMPLIANCE_SRC` env override; sync no-ops when path unreachable). EN + FR are hand-authored in-repo.

### Blog / RSS

`/blog` is the single consolidated archive (reads the Shopify `news` blog), with year grouping and a tag filter; posts render at `/blog/$handle`. `[blog.rss].tsx` exposes RSS 2.0 with `lastBuildDate`, `atom:self`, item per article, discoverable from `/blog` via `<link rel="alternate">`, Cache-Control 10 min on the edge. The old `/releases*` and `/blogs*` URLs 301-redirect into `/blog`.

### Static / SEO

- `[sitemap.xml].tsx` + `sitemap.$type.$page[.xml].tsx` — Hydrogen-default product/collection/article/page sitemap.
- `[robots.txt].tsx` — disallows `/cart`, `/account`, `/api/`, `/support`, `/policies/`, sort-faceted collection variants. Sitemap pointer at end.
- `[.well-known].security[.txt].tsx` — RFC 9116 contact record, `Expires` rolling 1y.
- Organization JSON-LD emitted globally from `root.tsx` via `buildOrgJsonLd`.
- Product JSON-LD emitted from PDP via `buildProductJsonLd` (price + availability + brand + sku).
- `buildSeoMeta` in `app/lib/seo.ts` returns the meta array used by every route loader.

### 3D hero

Homepage hero is a `@react-three/fiber` scene rendering FC + frame + ESC GLBs from `public/models/`. Module + GLBs are dynamic-imported only when `(min-width: 768px)` and `prefers-reduced-motion: no-preference`. Mobile and reduced-motion users get a static splash + wordmark. The scene renders three component labels positioned every frame from world-space bounding boxes so they track the geometry as the assembly rotates. On first visit the GLB fetch + parse is held back ~750 ms and the post-parse mesh processing yields to the main thread between chunks, so the CSS wireframe-wordmark intro animates without contention; cached/return visits skip the delay.

### Board art pipeline

`scripts/export-board-art.mjs <kicad_pcb> <handle>` (or `npm run gen:board-art` over `scripts/boards.config.json`) renders a layered SVG of a PCB for the PDP teardown chapter. It shells out to `kicad-cli pcb export svg` for the copper + Edge.Cuts layers, calls `scripts/board-outline.py` (KiCad's bundled `pcbnew`) for the true board-outline polygon, clips each copper layer to that outline, mirrors B.Cu for a flip-to-back view, and writes `public/boards/<handle>/board.svg`. `BoardArt` fetches the file lazily on scroll, inlines it so CSS can address each `<g id="layer-…">`, and animates the reveal.

`scripts/boards.config.json` maps handles to absolute `.kicad_pcb` paths that live outside this (public) repo, so it is gitignored — copy `boards.config.example.json` and fill it in. The export tool is build-time / maintainer-only; rerun it whenever a hardware rev ships.
