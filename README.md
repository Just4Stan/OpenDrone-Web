# OpenDrone Web

Storefront for [opendrone.be](https://opendrone.be). Belgian webshop selling open-source FPV drone hardware: flight controllers (OpenFC), 4-in-1 ESCs (OpenESC), frames, ExpressLRS receivers. Selling entity is Incutec BV; OpenDrone is the product brand.

Built on Shopify Hydrogen 2026.x, deployed on Shopify Oxygen, source open under MIT.

## Stack

| Layer | Choice |
|---|---|
| Framework | Hydrogen 2026.x on Oxygen (Cloudflare Workers runtime) |
| Routing | React Router 7 (file-based, `app/routes/`) + Hydrogen preset |
| UI | React 19 + TypeScript strict |
| Styling | Tailwind CSS v4 (`@theme` tokens in `app/styles/app.css`) |
| 3D hero | `@react-three/fiber` + `three` 0.184 |
| Storefront API | `@shopify/hydrogen` codegen → `storefrontapi.generated.d.ts` |
| Customer Accounts | Shopify Customer Account API (OAuth via Hydrogen tunnel) |
| Email | Resend (transactional), Shopify Email (marketing) |
| Bot challenge | Cloudflare Turnstile |
| Ticket index | Upstash Redis (REST) |
| Analytics | Plausible (cookieless) |

Node 22 or 24, npm 10+. Engines pinned in `package.json`.

## Quick start

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env       # fill in tokens, see Environment below
npm run dev                # http://localhost:3000 (uses Hydrogen tunnel for OAuth)
```

The dev server proxies the Customer Account OAuth callback through a Hydrogen-managed `*.tryhydrogen.dev` tunnel — local-only `localhost` won't work for sign-in. Tunnel is automatic.

## Repo layout

```
app/
  root.tsx                          shell, <html>, head, JSON-LD, layout
  entry.server.tsx                  CSP, security headers, HTMLRewriter for module-preload
  entry.client.tsx                  hydration entry
  routes.ts                         flat-routes + locale-prefix legal routes
  routes/                           67 route files (see Routes)
  components/                       shared React components
  content/legal/{en,nl,fr}/         legal markdown snapshots (sync:legal target)
  graphql/customer-account/         Customer Account API queries
  lib/                              i18n, SEO, company, support bridge, newsletter, fragments
  styles/app.css                    single Tailwind v4 + custom CSS file (~7600 lines)
public/                             static assets, GLB models, wordmark
scripts/                            sync-legal, compose-newsletter, smoke, shopify-templates/gen
.github/workflows/                  ci.yml, oxygen-deployment-*.yml, support-cleanup.yml
```

`/dist`, `/.shopify`, `/.react-router`, `tsconfig.tsbuildinfo` are gitignored build artefacts.

## Routes

67 file-based routes under `app/routes/`. Highlights, by family:

**Storefront**
- `_index.tsx` — homepage (3D hero scene, splash, hero CTA)
- `collections._index.tsx`, `collections.$handle.tsx`, `collections.all.tsx`
- `products.$handle.tsx` — PDP with editorial chapters, gallery, firmware contribution split, latest-commit card, JSON-LD Product
- `cart.tsx`, `cart.$lines.tsx` — Hydrogen cart actions, country forced to BE
- `search.tsx` — site search with Aside drawer + predictive results
- `contact.tsx` — Discord widget iframe + ticket intake CTA + direct contact
- `firmware-partners.tsx`, `open-source.tsx`, `releases._index.tsx`, `releases.$handle.tsx`

**Customer account** (signed-in)
- `account.tsx` — layout
- `account._index.tsx`, `account.profile.tsx`, `account.addresses.tsx`
- `account.orders._index.tsx`, `account.orders.$id.tsx`
- `account.support.tsx` — ticket history + read-only thread view
- `account_.login.tsx`, `account_.logout.tsx`, `account_.authorize.tsx` — OAuth
- `account.welcome.tsx`

**Support bridge** (see Support subsystem)
- `support.tsx` — intake / active-ticket view
- `support.resume.tsx` — magic-link entry
- `api.support.start|send|poll|close|status|feedback|lookup|cleanup.tsx` — bridge API
- `api.support.thread.$pid.tsx` — read-only thread fetch by public ticket id

**Legal / i18n**
- `algemene-voorwaarden.tsx`, `privacy.tsx`, `cookies.tsx`, `cookie-settings.tsx`, `herroepingsrecht.tsx`, `shipping.tsx`, `warranty.tsx`, `security.tsx`, `export-compliance.tsx`, `terms.tsx`, `legal.tsx` — each served at `/<slug>` (locale-cookie redirect) and `/{en,nl,fr}/<slug>` (canonical)

**Newsletter / blog**
- `newsletter.tsx` — opt-in form (writes to Shopify customer list with `acceptsMarketing=true`)
- `newsletter_.unsubscribed.tsx` — confirmation page
- `api.newsletter.dispatch.tsx` — Shopify webhook receiver + manual bearer trigger
- `api.newsletter.unsubscribe.tsx` — token-verified unsubscribe action
- `blogs._index.tsx`, `blogs.$blogHandle._index.tsx`, `blogs.$blogHandle.$articleHandle.tsx`

**Misc / infra**
- `healthz.tsx` — uptime probe
- `[robots.txt].tsx`, `[sitemap.xml].tsx`, `sitemap.$type.$page[.xml].tsx`
- `[releases.rss].tsx` — RSS 2.0 feed of release-note articles
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

**Files.** UI in `app/components/SupportWidget.tsx`, `SupportThread.tsx`, `FeedbackModal.tsx`. Server in `app/lib/support/{discord,session,resume-token,scrubber,moderation,ai-draft,email,uploads,turnstile,ticket-index,upstash}.ts` and `app/routes/api.support.*.tsx`. Detailed runbook in `app/lib/support/README.md` and `docs/support.md`.

### Newsletter

Two-flow system. Subscribers come in via the `/newsletter` form, which calls Storefront API `customerCreate` with `acceptsMarketing=true` and tag `newsletter` (and re-uses `customerUpdate` for existing emails). Content lives as blog articles in Shopify admin and renders at `/blogs/<blog>/<article>`. Outbound email is rendered offline by `npm run compose:newsletter <handle>` into `scripts/out/newsletter-<handle>.html` for paste into Shopify Email Custom HTML.

`api.newsletter.dispatch.tsx` is the auto-send path:
- **Webhook mode** — Shopify `articles/update` topic, HMAC-verified against `SHOPIFY_WEBHOOK_SECRET`, article id read from JSON `admin_graphql_api_id`.
- **Manual mode** — bearer-authed (`NEWSLETTER_DISPATCH_SECRET`) with `?article=<gid>&force=1`.

Long sends move into `waitUntil` so Shopify gets a 200 inside its 5-second window. KV-backed dedup via `NEWSLETTER_DISPATCH_KV` (optional binding) prevents double-sends across webhook retries; the metafield write inside `dispatchArticle()` makes redelivery a no-op even without KV. Unsubscribe via `api.newsletter.unsubscribe.tsx` uses HMAC-signed tokens (`unsubscribe-token.ts`).

### Legal / i18n

Site UI is English-only. Legal documents are translated NL/FR/EN and live at `/{en,nl,fr}/<slug>`. The same component file (`app/routes/<slug>.tsx`) handles all three locales — its loader calls `resolveLegalLoader` in `app/lib/i18n.ts` which reads the URL prefix to pick the markdown snapshot. Unprefixed `/<slug>` URLs redirect to the user's cached locale.

Slugs (in `app/lib/legal-slugs.ts`): `algemene-voorwaarden`, `privacy`, `cookies`, `herroepingsrecht`, `shipping`, `warranty`, `security`, `export-compliance`, `legal`, `cookie-settings`, `terms`.

`LangToggle` only renders on legal paths (everywhere else stays EN). `<html lang>` tracks URL locale. Each legal route emits `hreflang` for EN/NL/FR + `x-default=en` and a self-canonical.

Markdown lives under `app/content/legal/{en,nl,fr}/`. NL snapshot is overwritten by `npm run sync:legal` from the iCloud compliance workstream (`COMPLIANCE_SRC` env override; sync no-ops when path unreachable). EN + FR are hand-authored in-repo.

### Releases / RSS

`/releases` lists release-note articles; individual notes at `/releases/$handle`. `[releases.rss].tsx` exposes RSS 2.0 with `lastBuildDate`, `atom:self`, item per article. Discoverable from `/releases` via `<link rel="alternate">`. Cache-Control: 10 min on the edge.

### Static / SEO

- `[sitemap.xml].tsx` + `sitemap.$type.$page[.xml].tsx` — Hydrogen-default product/collection/article/page sitemap.
- `[robots.txt].tsx` — disallows `/cart`, `/account`, `/api/`, `/support`, `/policies/`, sort-faceted collection variants. Sitemap pointer at end.
- `[.well-known].security[.txt].tsx` — RFC 9116 contact record, `Expires` rolling 1y.
- Organization JSON-LD emitted globally from `root.tsx` via `buildOrgJsonLd`.
- Product JSON-LD emitted from PDP via `buildProductJsonLd` (price + availability + brand + sku).
- `buildSeoMeta` in `app/lib/seo.ts` returns the meta array used by every route loader.

### 3D hero

Homepage hero is a `@react-three/fiber` scene rendering FC + frame + ESC GLBs from `public/models/`. Module + GLBs are dynamic-imported only when `(min-width: 768px)` and `prefers-reduced-motion: no-preference`. Mobile and reduced-motion users get a static splash + wordmark. The scene renders three component labels positioned every frame from world-space bounding boxes so they track the geometry as the assembly rotates.

## Environment

Full list with comments and source pointers in `.env.example`. Summary:

**Required.** Storefront cannot boot without these.
- `SESSION_SECRET` (`openssl rand -hex 32`)
- `PUBLIC_STORE_DOMAIN`, `PUBLIC_STOREFRONT_API_TOKEN`, `PUBLIC_STOREFRONT_ID`, `SHOP_ID`, `PRIVATE_STOREFRONT_API_TOKEN`
- `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `PUBLIC_CUSTOMER_ACCOUNT_API_URL`

**Legal entity.** WER Art. VI.45 mandates these on every page.
- `PUBLIC_COMPANY_NAME`, `PUBLIC_COMPANY_ADDRESS`, `PUBLIC_COMPANY_KBO`, `PUBLIC_COMPANY_VAT`, `PUBLIC_COMPANY_EMAIL`, `PUBLIC_COMPANY_TEL`

**Support bridge.** All optional; bridge degrades when unset.
- `DISCORD_BOT_TOKEN`, `DISCORD_SUPPORT_CHANNEL_ID` (forum channel), `DISCORD_GUILD_ID`
- `DISCORD_STAFF_METADATA_CHANNEL_ID` — private staff channel for PII split
- `SUPPORT_MOD_ROLE_ID`, `SUPPORT_APPROVE_EMOJI`, `SUPPORT_MODERATION_MODE`
- `SUPPORT_SESSION_SECRET` — falls back to `SESSION_SECRET`
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` — fail-closed in prod
- `SUPPORT_TURNSTILE_DEV_SKIP=1` — local-dev escape only; gated behind `process.env.NODE_ENV !== 'production'` so it can't activate in Oxygen
- `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL`
- `ANTHROPIC_API_KEY`, `SUPPORT_AI_DRAFTS_ENABLED`, `SUPPORT_AI_MODEL`

**Ticket index (Upstash Redis REST).**
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Newsletter dispatch.**
- `SHOPIFY_WEBHOOK_SECRET` — HMAC verifier
- `NEWSLETTER_DISPATCH_SECRET` — bearer for manual trigger
- `NEWSLETTER_DISPATCH_KV` — optional KV binding for retry dedup
- `NEWSLETTER_BLOG_HANDLE` — defaults to `releases`

**Ops.**
- `SUPPORT_CLEANUP_SECRET` — bearer for the daily cleanup workflow
- `COMPLIANCE_SRC` — override path for `npm run sync:legal`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Hydrogen dev + codegen + tunnel |
| `npm run build` | `sync:legal` then production build |
| `npm run preview` | Serve the production bundle locally |
| `npm run lint` | ESLint (`--no-error-on-unmatched-pattern`) |
| `npm run typecheck` | React Router typegen + `tsc --noEmit` |
| `npm run codegen` | Regenerate Storefront + Customer Account types |
| `npm run sync:legal` | Refresh NL legal markdown from `COMPLIANCE_SRC` |
| `npm run compose:newsletter <handle>` | Render a newsletter email from a blog article |
| `npm run gen:shopify-templates` | Generate Shopify admin notification templates from `scripts/shopify-templates/` |

Standalone scripts (not in `package.json`):
- `scripts/smoke.mjs` — hits 25+ routes against a base URL and asserts status + content invariants. `BASE=https://opendrone.be node scripts/smoke.mjs`.
- `scripts/smoke-recursive.mjs` — recursive crawl smoke; deeper than `smoke.mjs`.

Unit tests run on Node's built-in test runner (no extra deps):

```sh
node --experimental-strip-types --test app/lib/support/*.test.ts
```

## CI / branch protection

`.github/workflows/ci.yml` runs three jobs on every PR + push to `main`: Lint, Typecheck, Build (with stub env). All three must pass — branch protection on `main` requires them green, plus 1 approval, plus Code Owner review (`CODEOWNERS`), plus conversation resolution, plus linear history. Force-push and delete are blocked.

Dependabot runs weekly (Monday), groups by `@shopify/*`, `react-router*`, and devDeps; ignores major-version bumps.

`oxygen-deployment-1000116751.yml` is the Shopify-managed Oxygen deploy workflow (one per linked storefront). Pushes to `main` trigger an Oxygen build + deploy; PR branches get preview URLs as a status check.

`support-cleanup.yml` runs daily at 03:17 UTC — see Support bridge above.

## Deployment

Oxygen auto-deploys from this repo. Every push to `main` → ~2 min build + deploy. Every PR → preview URL.

Monitor in Shopify admin → Hydrogen → storefront → Deployments.

**Manual emergency deploy.** `npx shopify hydrogen deploy` ships the local tree directly, bypassing CI and git history. Use only when the CD path is broken.

**DNS.** Web records:
- `A @` → `23.227.38.65`
- `CNAME www` → `shops.myshopify.com.` (trailing dot matters)

Mail (MX + DKIM + DMARC + SPF) lives on the email provider — do not modify those records when Shopify asks for SPF changes; merge into a single TXT instead.

## Security model

**Headers** (set in `app/entry.server.tsx`):
- `Content-Security-Policy` — Hydrogen-default + `cdn.shopify.com` + `challenges.cloudflare.com` (Turnstile) + `discord.com` (frame-src for the server widget). Nonce-based, no `'unsafe-inline'` outside the nonce.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HTTPS only)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — camera, mic, geolocation, payment (except `self`), USB, serial, MIDI, etc. all denied
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`

`HTMLRewriter` forces `crossorigin="anonymous"` on every `<link rel="modulepreload">` and `<script type="module">` so Oxygen's asset CDN doesn't 503 during deployment-rollout windows.

**Rate limits.** Per-isolate sliding-window limiter (`app/lib/rate-limit.ts`) on every public POST: `/api/support/{start,send,poll,close,feedback,lookup,thread}`, `/newsletter`, `/api/newsletter/unsubscribe`, `/support/resume`. Best-effort — pair with Cloudflare-edge rate-limit rules for serious flood protection.

**Input caps.** `support.start` subject 256, product/firmware 80; `support.send` content 1800; `feedback.notes` 1500. Uploads: 5 files max, 8 MB/file, 24 MB total, MIME + extension allowlist.

**Cart.** `BuyerIdentityUpdate` allowlist forces `countryCode: 'BE'`.

**Secrets.** `.env` is gitignored. `git log --all -p` clean of token-shaped strings (`shpat_*`, `shpss_*`, `sk_live`, `ghp_*`, `Bearer …`). Annual rotation on `SESSION_SECRET`, `SUPPORT_SESSION_SECRET`, Storefront tokens, Discord bot token, Turnstile secret.

**Vulnerability disclosure.** GitHub private vulnerability reporting enabled. Machine-readable contact at `/.well-known/security.txt`. Human-readable policy at `/security` + `app/content/legal/{en,nl,fr}/vulnerability-handling-policy.md`. Default embargo 90 days from first report.

## Contributing

1. Branch from fresh `main`: `<type>/<topic>` — `feat`, `fix`, `chore`, `refactor`, `docs`.
2. Commit with DCO sign-off: `git commit -s`. Subject ≤60 chars, imperative mood, Conventional Commits format.
3. Run `npm run lint && npm run typecheck && npm run build` locally. CI will reject if any fails.
4. `gh pr create --web` — CI + Oxygen preview run automatically.
5. Address feedback with new commits. Maintainers squash-merge.

Forgot `-s`? `git commit --amend -s --no-edit && git push --force-with-lease`.

**Rules.**
- No new npm deps without an issue first (supply-chain hygiene).
- Mobile-first: design at 375px, enhance at 768px and 1440px.
- WCAG 2.1 AA baseline.
- Bundle additions >50 KB gzipped need justification.
- No `console.log` in prod — strip or guard with `if (import.meta.env.DEV)`.
- Don't duplicate Dependabot's PRs.

## License

[MIT](LICENSE) for this repo. Hardware repos are CERN-OHL-S — see [OpenFC](https://github.com/Just4Stan/OpenFC) and [OpenESC](https://github.com/Just4Stan/Open-4in1-AM32-ESC).
