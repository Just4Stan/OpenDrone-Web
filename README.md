# OpenDrone Web

The storefront at **[opendrone.be](https://opendrone.be)**: open-source FPV drone
hardware, designed and sold in Belgium: flight controllers (OpenFC), 4-in-1 ESCs
(OpenESC), ExpressLRS receivers (OpenRX), and frames (OpenFrame), plus the OpenStack
bundle.

It's a Shopify store under the hood, but not a themed one. This is a headless
**Hydrogen** app on **Oxygen** (Shopify's Cloudflare Workers host): a `react-three-fiber`
hero on the homepage, editorial product pages with scroll-revealed PCB teardowns, a
trilingual legal system, and a stateless web↔Discord support desk that runs entirely
inside the Worker. Shopify owns the cart, checkout, catalog, and customer accounts; this
repo owns everything the buyer actually looks at.

Selling entity is **Incutec BV**; OpenDrone is the product brand. Storefront code is MIT;
the hardware repos are CERN-OHL-S.

This README is the single source of truth for the project: architecture, every
subsystem, the rules, environment, operations, security, and the content-editing
workflows. There are no other docs to chase.

---

## Contents

- [Stack](#stack)
- [Run it locally](#run-it-locally)
- [Repo layout](#repo-layout)
- [Routes](#routes)
- [Subsystems](#subsystems)
  - [Catalog & product pages](#catalog--product-pages)
  - [Cart](#cart)
  - [Customer accounts](#customer-accounts)
  - [Support bridge](#support-bridge)
  - [Newsletter](#newsletter)
  - [Legal & i18n](#legal--i18n)
  - [3D hero](#3d-hero)
  - [Board art pipeline](#board-art-pipeline)
  - [SEO & static](#seo--static)
- [Theming (light / dark)](#theming-light--dark)
- [Environment variables](#environment-variables)
- [Operations](#operations)
- [Security](#security)
- [Editing content](#editing-content)
- [Going live (headless order flow)](#going-live-headless-order-flow)
- [OpenFrame & OnShape](#openframe--onshape)
- [Contributing](#contributing)
- [License](#license)

---

## Stack

- **[Shopify Hydrogen](https://hydrogen.shopify.dev/)** on **Oxygen** (Cloudflare Workers)
- **React 19** + **React Router 7** + **TypeScript**
- **Tailwind CSS v4**: one CSS file (`app/styles/app.css`, ~8600 lines), self-hosted Inter + JetBrains Mono
- **[react-three-fiber](https://r3f.docs.pmnd.rs/)** for the 3D homepage hero
- **Resend** for transactional email, **Upstash Redis** for the support ticket index, **Plausible** for cookieless analytics

Node 22 or 24, npm 10+ (pinned in `package.json`).

## Run it locally

```sh
git clone https://github.com/OpenDrone-hw/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env       # fill in your Shopify tokens, see Environment variables below
npm run dev                # http://localhost:3000
```

Sign-in runs through a Hydrogen-managed `*.tryhydrogen.dev` tunnel (set up
automatically). Plain `localhost` won't complete the customer-account OAuth callback -
use the tunnel URL the dev server prints.

To run a contributor copy without real credentials, leave the Storefront tokens stubbed
and the loaders fall back to empty states; the support bridge degrades to a "web support
unavailable" notice when its Discord vars are unset.

---

## Repo layout

```
app/
  root.tsx                      shell, <html>, head, Organization JSON-LD, layout
  entry.server.tsx              CSP + security headers, HTMLRewriter for module-preload
  entry.client.tsx              hydration entry
  routes.ts                     flat-routes + locale-prefixed legal routes
  routes/                       68 route files (see Routes)
  components/                   shared React components
  content/legal/{en,nl,fr}/     trilingual legal markdown (the sync:legal target)
  graphql/customer-account/     Customer Account API queries
  lib/                          i18n, SEO, company info, product content, support bridge
  data/                         generated wordmark glyph data
  styles/app.css                the single Tailwind v4 + custom CSS file
public/                         static assets, GLB models, fonts, wordmark, board-art SVGs
content/                        editable copy library + local blog-post sources (see Editing content)
scripts/                        sync-legal, publish-post, compose-newsletter, smoke, board-art, shopify-infra
.github/workflows/              ci.yml, oxygen-deployment-*.yml, support-cleanup.yml
```

`/dist`, `/.shopify`, `/.react-router`, and `tsconfig.tsbuildinfo` are gitignored build
artefacts.

## Routes

68 file-based routes under `app/routes/`, by family:

**Storefront**: `_index` (3D hero homepage), `collections._index` / `.$handle` / `.all`,
`products.$handle` (editorial PDP), `cart` / `cart.$lines`, `search` (Aside drawer +
predictive results), `contact`, `firmware-partners`, `open-source`, `newsletter` /
`newsletter.$handle`.

**Customer account** (signed-in): `account` layout + `._index`, `.profile`,
`.addresses`, `.orders._index` / `.$id`, `.support` (ticket history + read-only thread),
`.welcome`, and the OAuth trio `account_.login` / `.logout` / `.authorize`.

**Support bridge**: `support` (intake / active-ticket view), `support.resume`
(magic-link entry), `api.support.{start,send,poll,close,status,list,feedback,lookup,cleanup}`,
and `api.support.thread.$pid` (read-only thread by public ticket id).

**Legal / i18n**: `algemene-voorwaarden`, `privacy`, `cookies`, `cookie-settings`,
`herroepingsrecht`, `shipping`, `warranty`, `security`, `end-use`,
`terms`, `legal`. Each serves at `/<slug>` (locale-cookie redirect) and at the canonical
`/{en,nl,fr}/<slug>`.

**Newsletter**: `newsletter` (post archive reading the Shopify `news` blog + signup
action) and `newsletter.$handle` (single post). The old `/blog*`, `/releases*`, and
`/blogs*` URLs are 301 redirect stubs into `/newsletter`.

**Infra**: `healthz`, `[robots.txt]`, `[sitemap.xml]` + `sitemap.$type.$page[.xml]`,
`[newsletter.rss]`, `[.well-known].security[.txt]`, `api.$version.[graphql.json]`
(Storefront API proxy), `discount.$code`, `pages.$handle`, `policies.$handle` /
`policies._index`, and `$` (404 catch-all).

---

## Subsystems

### Catalog & product pages

`products.$handle.tsx` queries the Storefront API for full product data plus 15
GPSR/CRA-relevant `custom.*` metafields:

```
safety_warnings_{nl,fr,en}, datasheet_url, manual_url, doc_url, sbom_url,
github_repo, model_number, batch_id, firmware_version, support_end_date,
vuln_contact_email, battery_wh, battery_un_number
```

The PDP is **editorial**, not a generic template: hero copy + gallery + chapters
(teardown, open-source, in-the-box, firmware, specs, downloads). Editorial copy is keyed
by handle in `app/lib/product-content.ts`: the source of truth for chapters, specs, and
the box list. `LatestCommit` cards fetch the `repoUrl` HEAD from GitHub (best-effort,
fail-quiet). `FirmwareSplit` adds an optional firmware-contribution variant on PDPs that
configure it. `ProductCompliance` renders the metafields but is currently queried, not
mounted (removed from the PDP in #60).

Two product-line features hang off `product-content.ts`:

- **Comparison ladder** (`VariantLadder`). Lines like OpenESC (20×20 / 30×30) and OpenRX
  (Lite / Lite-UFL / Mono / Gemini) are one Shopify product with a variant axis, not
  separate products. When a handle defines `optionAxis` + `variants`, the PDP renders a
  tier-card selector that doubles as the buy-axis, wiring each card to a real Shopify
  variant by matching option name and value (case-insensitive). Until those variants
  exist, the ladder still renders for preview and the cart uses the default variant.
  `ProductForm` is told to skip the axis the ladder owns via `hideOptionNames`.
- **Board art** (`BoardArt`). When a handle's teardown sets `boardArt`, the teardown
  chapter inlines a layered SVG of the PCB, reveals copper layers on scroll, and offers a
  Top/Bottom toggle plus an optional "Inspect interactively" link to KiCanvas. See
  [Board art pipeline](#board-art-pipeline).

### Cart

`cart.tsx` uses Hydrogen `CartForm` actions. `BuyerIdentityUpdate` is allowlisted to
`email` and `phone`; `countryCode` is hard-locked to `BE` regardless of client input -
this prevents an attacker from switching the cart's market between SSR render and
checkout.

### Customer accounts

OAuth via `context.customerAccount.authorize()` (Hydrogen SDK handles state, nonce, and
redirect URI). Account routes use the Customer Account API queries in
`app/graphql/customer-account/`. Logout is a GET to `/account/logout`.

### Support bridge

A **stateless web↔Discord chat bridge** running entirely inside the Hydrogen Worker: no
gateway bot, no WebSocket, no application database. A customer opens a ticket on
`/support` (signed-in) or via the CTA on `/contact`; the Worker creates a thread in a
Discord **forum channel**; staff reply in that thread; the browser sees replies through
4-second short polling. Ticket identity lives in a signed HttpOnly cookie plus an Upstash
Redis index for cross-device lookup.

**What the customer sees.** `/support` has three states: signed-out (sign-in prompt + a
"use Discord instead" path), intake (form: product, firmware, subject, message,
attachments, behind Turnstile), and active thread (live chat, sticky header, scrollable
log, sticky composer). Intake submit → `POST /api/support/start` → creates the Discord
thread → sets the cookie → redirects back to `/support` rendering the active thread, no
interstitial. `/account/support` is a two-pane history (ticket list + read-only thread);
the `/account` dashboard shows an open-ticket count. Clicking **End ticket** opens a
feedback survey (three 1–5 ratings + notes), then archives the Discord thread and clears
the cookie.

**How replies surface.** The widget polls every 4 s while the tab is active, every 15 s
when hidden; the first poll after load uses `?initial=1` to backfill the full thread
(refresh-safe). The bot authors the thread starter and every customer reply (prefixed
`**<First>:**` so the projection knows it's customer-relayed); staff humans appear as
themselves. The poll endpoint projects each message with a role: `self` (customer) or
`helper` (staff).

**Staff workflow, in Discord:**

- Watch the support forum channel. Every web ticket opens a thread there
  (`#<id> [<FirstName>] <subject>`). Type in the thread: the customer sees it within 4 s.
- **Email notifications are automatic.** A 15-minute cron
  (`.github/workflows/support-notify.yml` → `/api/support/notify`) emails the customer
  every staff reply they didn't watch arrive in the widget, batched into one email per
  ticket (`Re: <subject>`, ~240-char previews, magic-link "Continue chat →" button). A
  10-minute quiet period lets a burst of replies settle into a single email, and a
  customer reply after yours suppresses it entirely. After each send the bot posts
  "📧 Emailed <name> ..." into the thread as confirmation.
- Sensitive identifiers (email, order number, Shopify customer GID, anonymised IP, UA)
  are posted to a **private staff channel** per ticket: pull them from there, never ask
  the customer to retype, never paste them into the public thread.

**Three staged moderation layers**, each toggleable via env:

1. **Outbound scrubber**: strips Unicode bidi/control chars; redacts emails, IBANs,
   phones, cards, JWTs, long hex secrets, and Discord mentions before any Discord message
   reaches the browser. Author identity flattened to first name only.
2. **Moderation gate**: staff messages reach the customer only when a `SUPPORT_MOD_ROLE_ID`
   member reacts with `SUPPORT_APPROVE_EMOJI` (default ✅). Modes `enforce` / `log` /
   `off`; mod allowlist cached per-isolate for 1h.
3. **Inbound scrubber**: narrower; strips credentials/cards/bidi but lets the user's own
   contact info through (they need it for context).

**Two-channel privacy model.** Discord can't hide parts of one message from some viewers,
so the bridge splits: the public forum thread shows first name + scrubbed body, while a
private staff channel (`DISCORD_STAFF_METADATA_CHANNEL_ID`) gets the full PII. Without the
staff channel set, full PII goes into the public thread (legacy behaviour).

**Trust boundary.** The poll endpoint is the boundary between Discord (untrusted
free-form text) and the browser. Every Discord message passes the moderation gate → the
scrubber → a projection that drops everything except `id`, `firstName`, `role`, scrubbed
`content`, `createdAt`, and sanitized `attachments`. No author IDs, avatars, embeds,
roles, or guild metadata reach the wire.

**Cross-device resume.** Tier 1: a Resend email with `/support/resume?t=<token>`; the
token is HMAC-signed with audience `aud:support-resume-v1`, 1-year TTL, and is not
replayable as a session cookie. Tier 2: the user enters their email;
`/api/support/lookup` checks the Upstash index plus active and archived Discord threads
and emails one resume link per match. It always returns a generic success, never
confirming whether an email has tickets.

**Storage.** The `od_support` cookie (HMAC-SHA256 with `SUPPORT_SESSION_SECRET ?? SESSION_SECRET`,
HttpOnly, Secure, SameSite=Strict, 30-day) carries the thread id, a random ticket id, the
public reference, name, email, and the last-seen cursor. Upstash keys: `tk:{tid}` (ticket
meta), `idx:cust:{customerId}` and `idx:email:{sha256}` (recent-ticket lists, capped 200),
`fb:{tid}` (feedback). When the index is unbound, lists return empty and Discord remains
the source of truth, nothing breaks, you just lose the cross-device index. Discord forum
threads auto-archive after 24h of inactivity.

**Cron sweeps.** Both authenticate with the `SUPPORT_CLEANUP_SECRET` bearer token
(repo secret, must match the Oxygen env var):

- `.github/workflows/support-notify.yml` POSTs `/api/support/notify` every 15 minutes:
  the reply-notification emails described above. Tracks per-ticket `seenCursor` (written
  by the poll route on visible-tab deliveries) and `notifyCursor` (advanced after each
  send) in the ticket meta; decision logic in `app/lib/support/notify-decision.ts`.
- `.github/workflows/support-cleanup.yml` POSTs `/api/support/cleanup` at 03:17 UTC,
  deleting Discord threads + index entries for tickets that are closed or idle 7 days
  (closed threads get a 1-day grace period).

**Files.** UI: `app/components/{SupportWidget,SupportThread,FeedbackModal}.tsx`. Server:
`app/lib/support/{discord,session,resume-token,scrubber,moderation,notify-decision,email,uploads,turnstile,ticket-index,upstash}.ts`
and `app/routes/api.support.*.tsx`.

### Newsletter

A single, manual flow: no third-party ESP, no auto-dispatch. Three parts:

1. **Subscribe**: the footer `NewsletterSignup` (on every page; there is no in-body form,
   to avoid duplicating it) POSTs to the `newsletter.tsx` action, which calls Storefront
   API `customerCreate` with `acceptsMarketing=true` and tag `newsletter`. Abuse controls:
   honeypot + Cloudflare Turnstile + per-IP/per-email rate limits.
2. **Author**: posts are written locally as Markdown in `content/posts/` and pushed to
   the Shopify `news` blog with `npm run publish:post` (Admin API
   `articleCreate`/`articleUpdate` + Files upload for images, idempotent by slug). They
   render at `/newsletter/<slug>`. See [Editing content](#editing-content).
3. **Send**: **manual, no auto-send.** Publishing never emails anyone. You send by hand
   in Shopify admin: Marketing → Shopify Email → blog-post template → "Subscribed"
   segment → Send (free to 10k emails/mo). Shopify owns delivery and unsubscribes.
   `npm run compose:newsletter <handle>` optionally renders a branded custom-HTML email
   from a published article.

> A prior AI-scaffolded Resend auto-dispatcher was removed in favour of this manual flow;
> it's recoverable from git history if auto-send is ever wanted.

### Legal & i18n

The site UI is **English-only**. Legal documents are translated **NL/FR/EN** and served at
`/{en,nl,fr}/<slug>`; unprefixed `/<slug>` redirects to the visitor's cached locale. One
route file per slug handles all three locales, its loader calls `resolveLegalLoader`
(`app/lib/i18n.ts`), which reads the URL prefix to pick the markdown snapshot from
`app/content/legal/{en,nl,fr}/`. `LangToggle` renders only on legal paths; `<html lang>`
tracks the URL locale; each legal route emits `hreflang` for EN/NL/FR + `x-default=en` and
a self-canonical.

The NL snapshot is overwritten by `npm run sync:legal` from an external compliance
workstream (`COMPLIANCE_SRC` override; the sync no-ops when the path is unreachable). EN
and FR are hand-authored in-repo. Slugs live in `app/lib/legal-slugs.ts`.

### 3D hero

The homepage hero is an `@react-three/fiber` scene rendering the FC + frame + ESC GLBs
from `public/models/`. The module and GLBs are dynamic-imported **only** when
`(min-width: 768px)` and `prefers-reduced-motion: no-preference`; mobile and
reduced-motion visitors get a static splash + wordmark. Three component labels are
positioned every frame from world-space bounding boxes so they track the geometry as the
assembly rotates. On first visit the GLB fetch + parse is held back ~750 ms and post-parse
mesh processing yields to the main thread between chunks, so the CSS wireframe-wordmark
intro animates without contention; cached/return visits skip the delay.

### Board art pipeline

`scripts/export-board-art.mjs <kicad_pcb> <handle>` (or `npm run gen:board-art` over
`scripts/boards.config.json`) renders a layered PCB SVG for the PDP teardown. It shells
out to `kicad-cli pcb export svg` for the copper + Edge.Cuts layers, calls
`scripts/board-outline.py` (KiCad's bundled `pcbnew`) for the true board-outline polygon,
clips each copper layer to that outline, mirrors B.Cu for the flip-to-back view, and
writes `public/boards/<handle>/board.svg`. `BoardArt` fetches the file lazily on scroll
and inlines it so CSS can address each `<g id="layer-…">` and animate the reveal.

`boards.config.json` maps handles to absolute `.kicad_pcb` paths that live outside this
(public) repo, so it's gitignored, copy `boards.config.example.json` and fill it in. The
export tool is build-time / maintainer-only; rerun it whenever a hardware rev ships.

### SEO & static

- `[sitemap.xml]` + `sitemap.$type.$page[.xml]`: product/collection/article/page sitemap.
- `[robots.txt]`: disallows `/cart`, `/account`, `/api/`, `/support`, `/policies/`, and
  sort-faceted collection variants; sitemap pointer at the end.
- `[.well-known].security[.txt]`: RFC 9116 contact record, rolling 1-year `Expires`.
- Organization JSON-LD emitted globally from `root.tsx` (`buildOrgJsonLd`); Product JSON-LD
  from the PDP (`buildProductJsonLd`, with price + availability + brand + sku).
- `buildSeoMeta` (`app/lib/seo.ts`) returns the meta array every route loader uses.

---

## Theming (light / dark)

The site supports light and dark via the standard CSS-custom-property token swap. Follow
the pattern and new UI gets both themes for free.

- **Tokens, not literals.** Every color in CSS or JSX references a semantic token:
  `var(--color-bg)`, `--color-bg-card`, `--color-bg-elevated`, `--color-text`,
  `--color-text-muted`, `--color-text-dim`, `--color-border`, `--color-border-strong`,
  `--color-gold` (accent) + `--color-gold-hover`, `--color-gold-soft`, `--color-stock`.
  Never hardcode a hex/rgb for something that should change between themes.
- **Text on the gold accent** uses `--color-on-accent` (dark ink in both modes), not
  `--color-bg`. Use it for any filled-gold button/badge/active state.
- **Where the values live** (`app/styles/app.css`): dark is the default in the Tailwind
  `@theme` block; light overrides the same token names in the `html.light { … }` block
  right below it. Retune a color in those two places only.
- **If a dark literal is unavoidable** (e.g. a load overlay), add a matching
  `html.light .your-selector { … }` twin in the light-mode section. Grep `html.light` in
  `app.css` for examples.
- **Switching mechanics** (`app/lib/theme.ts`): an inline `<head>` script
  (`THEME_INIT_SCRIPT`, injected in `root.tsx`) resolves the theme before first paint -
  no flash. Order: `localStorage['od-theme']` → OS `prefers-color-scheme` → dark.
  `ThemeToggle` writes the explicit choice and live-follows the OS until the visitor
  toggles.
- **Third-party embeds** (Discord widget, Turnstile) can't be CSS-themed. Turnstile gets
  `getActiveTheme()`; the Discord widget panel is intentionally dark in both modes.
- Don't reintroduce `class="dark"`-only assumptions or `prefers-color-scheme` media
  queries for color, the class on `<html>` is the single source of truth.

---

## Environment variables

The full list with inline comments and source pointers is in
[`.env.example`](.env.example): copy it to `.env`. This is the grouped summary.

**Required** (storefront won't boot without these):
`SESSION_SECRET` (`openssl rand -hex 32`), `PUBLIC_STORE_DOMAIN`,
`PUBLIC_STOREFRONT_API_TOKEN`, `PUBLIC_STOREFRONT_ID`, `SHOP_ID`,
`PRIVATE_STOREFRONT_API_TOKEN`, `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`,
`PUBLIC_CUSTOMER_ACCOUNT_API_URL`.

**Optional core:** `PUBLIC_CHECKOUT_DOMAIN` (dedicated checkout subdomain; falls back to
`PUBLIC_STORE_DOMAIN`).

**Legal entity** (Belgian WER Art. VI.45 mandates these on every page):
`PUBLIC_COMPANY_NAME`, `PUBLIC_COMPANY_ADDRESS`, `PUBLIC_COMPANY_KBO`,
`PUBLIC_COMPANY_VAT`, `PUBLIC_COMPANY_EMAIL`, `PUBLIC_COMPANY_TEL`.

**Support bridge** (all optional; the bridge degrades gracefully when unset):
`DISCORD_BOT_TOKEN`, `DISCORD_SUPPORT_CHANNEL_ID` (a **Forum** channel),
`DISCORD_GUILD_ID`, `DISCORD_STAFF_METADATA_CHANNEL_ID`, `DISCORD_FEEDBACK_CHANNEL_ID`,
`DISCORD_SUPPORT_INVITE`, `PUBLIC_DISCORD_GUILD_ID`, `PUBLIC_DISCORD_INVITE`,
`SUPPORT_MOD_ROLE_ID`, `SUPPORT_APPROVE_EMOJI` (✅),
`SUPPORT_MODERATION_MODE` (`off`), `SUPPORT_SESSION_SECRET` (falls back to
`SESSION_SECRET`), `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (fail-closed in prod),
`SUPPORT_TURNSTILE_DEV_SKIP=1` (local-dev only; gated behind
`NODE_ENV !== 'production'`), `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL`.

**Ticket index (Upstash Redis REST):** `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`.

**Blog / newsletter:** `NEWSLETTER_BLOG_HANDLE` (defaults to `news`). The publisher
(`scripts/publish-post.mjs`, reads `.env` directly) needs `SHOPIFY_ADMIN_API_TOKEN`
(scopes `read_content` + `write_content` + `write_files` on the "OpenDrone Infra" custom
app) and `SHOPIFY_ADMIN_API_VERSION` (defaults to `2026-01`). Sends are manual in Shopify
admin, no dispatch secrets needed.

**Ops:** `SUPPORT_CLEANUP_SECRET` (bearer for the daily cleanup workflow), `COMPLIANCE_SRC`
(override path for `sync:legal`).

`PUBLIC_*` vars surface to the client bundle; no token/secret values do.

---

## Operations

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Hydrogen dev + codegen + tunnel |
| `npm run build` | `sync:legal` then production build |
| `npm run preview` | Serve the production bundle locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | React Router typegen + `tsc --noEmit` |
| `npm run codegen` | Regenerate Storefront + Customer Account types |
| `npm run sync:legal` | Refresh NL legal markdown from `COMPLIANCE_SRC` |
| `npm run publish:post -- content/posts/<slug>.md` | Publish a Markdown post to the Shopify blog (`--dry` to preview, `--draft` to stage) |
| `npm run compose:newsletter <handle>` | Render a branded custom-HTML email from a published article |
| `npm run gen:shopify-templates` | Generate Shopify admin notification templates from `scripts/shopify-templates/` |
| `npm run gen:board-art` | Export every board in `scripts/boards.config.json` (needs KiCad CLI + `pcbnew`) |

Standalone (not in `package.json`): `scripts/smoke.mjs` hits 25+ routes against a base URL
and asserts status + content invariants (`BASE=https://opendrone.be node scripts/smoke.mjs`);
`scripts/smoke-recursive.mjs` is a deeper recursive crawl; `scripts/export-board-art.mjs`
is the one-off board-art export; `scripts/gen-wordmark-assets.mjs` /
`gen-wordmark-from-png.mjs` regenerate the hero wordmark glyph data.

### Tests

Unit tests run on Node's built-in test runner (no extra deps):

```sh
node --experimental-strip-types --test app/lib/support/*.test.ts
```

### CI & branch protection

`.github/workflows/ci.yml` runs **Lint**, **Typecheck**, and **Build** (with stub env) on
every PR and push to `main`; all three must pass. `main` additionally requires 1 approval,
Code Owner review (`CODEOWNERS`), conversation resolution, and linear history; force-push
and delete are blocked. Dependabot runs weekly (Monday), grouped by `@shopify/*`,
`react-router*`, and devDeps, ignoring major-version bumps.

### Deployment

Oxygen auto-deploys from this repo: every push to `main` → ~2 min build + deploy; every PR
→ a preview URL as a status check (`oxygen-deployment-*.yml` is the Shopify-managed
workflow). **Always `git push` after committing**: local-only commits never reach
opendrone.be. Monitor in Shopify admin → Hydrogen → storefront → Deployments. Emergency
manual deploy (bypasses CI + git history; use only when CD is broken):
`npx shopify hydrogen deploy`.

**DNS.** Web: `A @ → 23.227.38.65`, `CNAME www → shops.myshopify.com.` (trailing dot
matters). Mail (MX/DKIM/DMARC/SPF) lives on the email provider, don't replace those when
Shopify asks for an SPF change; merge into a single TXT instead.

---

## Security

**Headers** (`app/entry.server.tsx`): nonce-based `Content-Security-Policy` (Hydrogen
default + `cdn.shopify.com` + `challenges.cloudflare.com` for Turnstile + `discord.com`
frame-src for the widget; no `'unsafe-inline'` outside the nonce);
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`;
`X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`;
`Referrer-Policy: strict-origin-when-cross-origin`; a `Permissions-Policy` denying camera,
mic, geolocation, payment (except `self`), USB, serial, MIDI, etc.;
`Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-site`.

`HTMLRewriter` forces `crossorigin="anonymous"` on every `<link rel="modulepreload">` and
`<script type="module">` so Oxygen's asset CDN doesn't 503 during deployment-rollout
windows.

**Rate limits.** A per-isolate sliding-window limiter (`app/lib/rate-limit.ts`) guards
every public POST: `/api/support/{start,send,poll,close,feedback,lookup,thread}`,
`/newsletter`, `/support/resume`. Best-effort, pair with Cloudflare-edge rules for serious
flood protection.

**Input caps.** `support.start`: subject 256, product/firmware 80. `support.send`: content
1800. `feedback.notes`: 1500. Uploads: 5 files max, 8 MB/file, 24 MB total, MIME +
extension allowlist.

**Cart.** `BuyerIdentityUpdate` forces `countryCode: 'BE'`.

**Board art.** `BoardArt` inlines a layered SVG via `dangerouslySetInnerHTML`, but the
source is a first-party static asset under `public/boards/`, generated at build time from
the maintainer's own KiCad files, never user input. The path is a hardcoded constant in
`product-content.ts`, so there's no attacker-controlled URL or traversal vector, and the
nonce-based CSP would block any inline script/handler regardless.

**Secrets.** `.env` is gitignored; history is clean of token-shaped strings. Rotate
`SESSION_SECRET`, `SUPPORT_SESSION_SECRET`, Storefront tokens, the Discord bot token, and
the Turnstile secret annually or on any suspected leak.

**Vulnerability disclosure.** GitHub private vulnerability reporting is enabled. The
machine-readable contact is at `/.well-known/security.txt`; the human-readable policy is at
`/security` and `app/content/legal/{en,nl,fr}/vulnerability-handling-policy.md`. Default
embargo is 90 days from first report.

---

## Editing content

Content splits into three editing surfaces, each with a clear runtime contract.

### The studio (`content/`)

Run `npm run dev` and open **`/studio`**. It is a local, dev-only mirror of the site:
the real pages in an iframe with every editable string outlined. Click one, change it,
save. There is no database and no publish step, so `git diff` is the changelog and
`git checkout` is undo. The studio never reaches production: `app/routes.ts` excludes it
from the build and the write endpoint is an `apply: 'serve'` Vite plugin.

| Tab | Edits | Files |
|---|---|---|
| Words | Page copy, product copy | `content/copy/*.json`, `content/products/*.json` |
| Chapters | Product page sections: order, titles, on/off | `content/chapters.json` |
| Design | The 61 design tokens | `content/theme.json` |
| Media | Browse images, see where each is used | read-only, `public/` |
| Legal | Policy pages in en, nl, fr | `app/content/legal/**` |
| Hero | The 3D scene: lighting, timeline, camera, materials | `public/models/<design>/studio.json` |

**Adding a page.** Create `content/copy/<page>.json` with `$route` and `$title`, then
render its strings with `<Txt id="<page>.<key>" as="p" />` (`app/components/Txt.tsx`).
The `data-edit` annotation and the value come from the same id, so they cannot drift.
For a string that has to go in an attribute, use `copyText(id)`.

**Inline markup**, the whole of it: `[label](/path)`, `[Discord](@discord)` for links
defined in code, `*emphasis*`, `**strong**`. Deliberately not Markdown, because headings
and lists are structure and structure is not a string's job.

**What is not editable, by design.** Shopify data (product titles, prices, collection
descriptions) is edited in Shopify admin. The five Dutch legal pages listed in
`scripts/sync-legal.mjs` are overwritten from the external compliance repo on every
build, so the studio shows them read-only. Board art is generated from KiCad and the
hero model from Onshape; the studio can point at a different asset but cannot author one.

**Coverage.** `npm run studio:coverage` reports which files still have words baked into
the code. It over-reports on purpose, so a count means "worth a look", not "broken".

### Blog posts (`content/posts/`)

Local Markdown is the source of truth for post content; the Shopify copy is generated from
it, never hand-edit in the admin (it's overwritten on the next push).

1. **Write** `content/posts/<slug>.md` with front-matter (`title` required; `summary`,
   `date`, `tags`, `image` + `imageAlt`, `author`, `slug`, `published` optional) and a
   Markdown body. Keep referenced images next to the post (e.g. `content/posts/images/`);
   they upload to Shopify Files on publish and their URLs are rewritten to the CDN.
2. **Preview** (no API calls): `npm run publish:post -- content/posts/<slug>.md --dry` -
   renders HTML to `scripts/out/` and lists images it would upload.
3. **Publish**: `npm run publish:post -- content/posts/<slug>.md` (`--draft` to stage).
   Idempotent by slug; prints the live URL.
4. **Email** (manual): publishing emails no one. Send by hand in Shopify admin (Marketing
   → Shopify Email → blog-post template → "Subscribed" segment). One-time before the first
   send: verify a custom `@opendrone.be` sender (Settings → Notifications), or mail goes
   out as `store+…@shopifyemail.com`.

> One-time API setup: the publisher needs `read_content` + `write_content` (and the
> already-granted `write_files`) on the "OpenDrone Infra" custom app. On
> `ACCESS_DENIED for ... content`, add those scopes, reinstall the app, and update
> `SHOPIFY_ADMIN_API_TOKEN`.

### Shopify infra scripts (`scripts/shopify-infra/`)

Re-runnable scripts that set up the store via the Admin GraphQL API, reading credentials
from `.env` (nothing hard-coded). They use the "OpenDrone Infra" custom app
(`read/write` on products, discounts, translations, files, inventory, content; `read`
locations).

| Script | What it does |
|---|---|
| `_client.mjs` | Admin GraphQL client + `.env` loader (imported by the others) |
| `00-inspect.mjs` | Read-only dump of products, variants, and `custom.*` metafield definitions |
| `01-metafield-definitions.mjs` | Creates the 15 GPSR/CRA `custom.*` definitions (storefront `PUBLIC_READ`) |
| `02-variants.mjs` | Builds the line variant axes (Mount/Model/Size), placeholder price + SKU, 100 stock |
| `03-metafield-values.mjs` | Populates verifiable compliance metafields (repo, security contact, model, doc URLs) |

All are safe to re-run. Reviewer/content attribution is UTM-based (no discount codes),
tracked in Notion.

---

## Going live (headless order flow)

This is a **headless** store: the storefront is this Hydrogen app on Oxygen, but the
**checkout, payments, orders, inventory, and emails all live in Shopify's backend**.
Hydrogen builds the cart through the Storefront API and hands off to the Shopify-hosted
`checkoutUrl`; on payment Shopify creates the order, decrements inventory, and sends the
confirmation; the buyer then sees order history back on `/account` via the Customer
Account API.

The implication: the storefront can be perfect and **no order completes until payments,
shipping, and taxes are configured in Shopify admin.** Those three are the launch
blockers:

1. **Payments**: activate a provider (Shopify Payments or Mollie), complete KYC, connect
   the bank. **Bancontact is essential** for a Belgian storefront.
2. **Shipping**: define zones + rates on the OpenDrone Leuven location profile (Basic plan
   = flat / weight rates only; set product weights so weight tiers work).
3. **Taxes**: VAT-inclusive pricing is already on (`taxesIncluded=true`). Register for OSS
   if EU cross-border sales exceed €10k/yr; confirm the SME exemption with the accountant.

Also before launch: point the Customer Account API callback / JS-origin / logout URLs at
the production domain (not the `*.tryhydrogen.dev` preview); make the custom domain
primary; finalise the two missing SKUs (OpenFrame 5″ Freestyle, OpenStack) and real
prices; and customise the order / shipping / refund notification emails (this repo
generates branded HTML via `gen:shopify-templates`: there's no Admin API for notification
templates, so paste it in by hand). Then place one real low-value order end-to-end and
verify capture → fulfilment → refund.

---

## OpenFrame & OnShape

OpenFrame is a carbon-fibre frame whose source of truth is an **OnShape cloud CAD
document**, not a KiCad/GitHub repo. OnShape **cannot be iframe-embedded** the way
KiCanvas is (it serves frame-busting headers and has no public embed URL), so the planned
PDP integration mirrors the board-art pattern: a **build-time GLB export** rendered in-page
with `<model-viewer>`, plus a STEP download.

The OnShape document is deliberately kept **private**: a free-plan *public* document
auto-grants third parties an irrevocable license to use/modify/**sell** the IP, and a
public doc also lets anyone export the DXF flat-pattern cutting files. The export script
must target only Part Studio / Assembly STEP + glTF endpoints (never the drawings/DXF
endpoint), pin to a Version id for reproducibility, and ship only curated geometry under
CERN-OHL-S. This keeps the storefront a pure static-asset consumer with no runtime backend.

---

## Contributing

1. Branch from a fresh `main`: `<type>/<topic>`: `feat`, `fix`, `chore`, `refactor`,
   `docs`.
2. Commit with DCO sign-off: `git commit -s`. Subject ≤60 chars, imperative,
   Conventional Commits. (Forgot `-s`? `git commit --amend -s --no-edit && git push
   --force-with-lease`.)
3. Run `npm run lint && npm run typecheck && npm run build` locally, CI rejects if any
   fails.
4. `gh pr create --web`: CI + an Oxygen preview run automatically.
5. Address feedback with new commits; maintainers squash-merge.

**Rules**

- No new npm deps without an issue first (supply-chain hygiene). Outside-contributor PRs
  get their `package.json` diff reviewed by hand.
- Mobile-first: design at 375px, enhance at 768px and 1440px.
- WCAG 2.1 AA baseline.
- Bundle additions >50 KB gzipped need justification.
- No `console.log` in prod, strip it or guard with `if (import.meta.env.DEV)`.
- Don't duplicate Dependabot's PRs.

## License

[MIT](LICENSE) for this repo. The hardware repos are CERN-OHL-S:
[OpenFC](https://github.com/OpenDrone-hw/OpenFC),
[OpenESC](https://github.com/OpenDrone-hw/OpenESC-20x20), and
[OpenRX](https://github.com/OpenDrone-hw/OpenRX).
