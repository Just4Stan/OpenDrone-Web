# OpenDrone Web

Open-source storefront for [OpenDrone](https://opendrone.be) — FPV flight controllers, ESCs, and frames. Built on Shopify Hydrogen 2026.1.x (React Router 7, Tailwind v4, r3f hero).

**Contents**

- [Quick start](#quick-start)
- [Production workflow](#production-workflow)
- [Stack & scripts](#stack--scripts)
- [Project layout](#project-layout)
- [Design tokens](#design-tokens)
- [Contributing](#contributing)
- [Design scope](#design-scope)
- [Compliance](#compliance)
- [Newsletter](#newsletter)
- [Security](#security)
- [License](#license)

## Quick start

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env   # fill in Shopify tokens (ping #opendrone-web on Discord)
npm run dev            # http://localhost:3000
```

Requires Node 22 or 24, npm 10+.

## Production workflow

Production site: **<https://opendrone.be>** → Shopify Oxygen.

**Continuous deployment is live.** Every push to `main` triggers an automatic Oxygen build + deploy. Pull request branches get a preview URL posted as a status check (staff-only access).

### Day-to-day

```sh
git checkout -b feat/topic       # branch off main
# work, commit (DCO-signed)
git push -u origin feat/topic
gh pr create --web               # CI runs lint + typecheck + build
                                 # Oxygen posts preview URL
# review, merge → Oxygen auto-deploys to opendrone.be (~2 min)
```

Monitor deploys in **Shopify admin → Hydrogen → Opendrone Web**.

### Manual deploy (emergency only)

```sh
npx shopify hydrogen deploy      # ships the current local tree directly
```

Bypasses CI and git history. Use only when the CD path is broken or a hotfix has to land before the next push can be reviewed.

### DNS and domain

`opendrone.be` is registered at Gandi. Mail (MX + DKIM + DMARC) stays on Google Workspace. Only the web records below point at Shopify:

- `A @` → `23.227.38.65` (Shopify edge)
- `CNAME www` → `shops.myshopify.com.` (trailing dot matters)

Do not modify MX, `google._domainkey`, `_dmarc`, or SPF TXT records — those carry email. When Shopify needs SPF updated for transactional mail, merge: `v=spf1 include:_spf.google.com include:shops.shopify.com ~all` (one TXT record, never two).

### Environments

Production environment must be set to **Public** under *Hydrogen → Storefront settings → Environments and variables → Production → URL privacy*. Staff-only locks out real visitors.

## Stack & scripts

Shopify Hydrogen 2026.x on Oxygen · React Router 7 (file-based routes in `app/routes/`) · Tailwind CSS v4 (tokens in `app/styles/app.css`) · react-three-fiber hero · TypeScript strict · Plausible analytics (cookieless, no banner).

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server + codegen |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Serve production bundle locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Storefront API types |
| `npm run sync:legal` | Refresh legal Markdown snapshots |
| `npm run compose:newsletter <handle>` | Render a newsletter email from a blog article |

Run `lint` and `typecheck` before every PR. CI will reject otherwise.

## Project layout

```
app/
  routes/           file-based routes (React Router 7)
  components/       shared components
  styles/app.css    Tailwind v4 + @theme tokens
  content/legal/    committed legal Markdown — do not hand-edit
  graphql/          Customer Account API queries
  lib/              i18n, SEO, company, context, fragments
public/             static assets
scripts/            build-time scripts
```

## Design tokens

Every color, font, and spacing value is defined in `app/styles/app.css` under `@theme`. Use `var(--color-gold)`, `var(--color-bg)`, `font-mono`, etc. Don't hardcode.

Core: `--color-bg #0a0a0a`, `--color-bg-card #101210`, `--color-text #e5e5e5`, `--color-text-muted #737373`, `--color-gold #b8922e`, `--color-accent #1f4d2c`. Fonts: Space Grotesk (display), Inter (sans), JetBrains Mono (mono).

## Contributing

Prerequisites: Node 22/24, npm 10+, Shopify dev-store credentials (pinned in `#opendrone-web` on [Discord](https://discord.gg/v3sWmTcx3R)).

1. Pick an [open issue](https://github.com/Just4Stan/OpenDrone-Web/issues?q=is%3Aopen+label%3A%22good+first+issue%22) or open a Design proposal.
2. Branch from fresh `main`: `<type>/<topic>` where type is `design`, `feat`, `fix`, `chore`, `refactor`, or `docs`.
3. Commit with DCO sign-off: `git commit -s -m "subject"`. Subject ≤60 chars, imperative mood.
4. Verify locally: `npm run lint && npm run typecheck && npm run build`.
5. Push and open a PR (`gh pr create --web`). CI + Oxygen preview run automatically.
6. Address feedback with new commits (don't force-push during review). Stan squash-merges.

Forgot `-s`? `git commit --amend -s --no-edit && git push --force-with-lease`.

### Rules

- Lint + typecheck must pass — fix locally, not in CI.
- No new npm deps without asking — open an issue first (supply-chain risk).
- Mobile-first (design at 375px, enhance at 768px and 1440px).
- WCAG 2.1 AA baseline — semantic HTML, alt text, keyboard nav, ≥4.5:1 contrast.
- Bundle additions >50 KB gzipped need justification.
- No `console.log` in prod — strip or guard with `if (import.meta.env.DEV)`.
- No hand-edits to `app/content/legal/**`.
- Dependabot runs weekly — don't duplicate its PRs.

### Where to ask

- `#opendrone-web` on [Discord](https://discord.gg/v3sWmTcx3R) for questions
- Open a Design proposal issue before large redesigns
- Security issues: see [Security](#security), do not open a public issue

## Design scope

What's open for community design work, what's locked, and what's forbidden. Read before starting.

### ✅ Open for redesign

Go wild within the brand aesthetic (dark, engineering, gold accent, monospace specs).

- **Homepage hero** — current 3D scroll-driven scene is a placeholder direction, not sacred
- **Product listing pages** (`/collections/*`) — card design, filtering, sort UI
- **Product detail pages** (`/products/*`) — gallery, spec table layout, BOM viewer integration
- **Cart & checkout flow** (pre-Shopify-checkout only — Shopify owns the actual checkout)
- **Blog index and article pages** (`/blogs/*`)
- **Header / nav** — mobile menu, search UX, account dropdown
- **Footer** (non-legal sections only — company block is locked)
- **About / team pages** (to be added)
- **Search results UI** (`/search`)
- **Component library** — button variants, form inputs, badges, toast/notifications
- **Empty states, loading states, error boundaries**

### 🔒 Locked — do not redesign without asking

Change these only after a Discord discussion and explicit approval.

- **Brand tokens** (`app/styles/app.css` `@theme` block) — colors, fonts, spacing scale
- **Logo, wordmark, OpenDrone/OpenFC/OpenESC/OpenFrame branding**
- **Company footer block** (`CompanyFooterBlock.tsx`) — Incutec BV identity, KBO, VAT are legally required in specific form
- **Analytics implementation** — Plausible cookieless setup. Do not add GA, FB Pixel, Hotjar, or anything that sets tracking cookies
- **Cookie settings page** (`/cookie-settings`) — GBA-compliant, touching it risks non-compliance

### ⛔ Forbidden — do not touch

Legal content is drafted by a lawyer and synced from a private compliance repo. Editing it creates legal liability.

- **Legal route files** — `algemene-voorwaarden.tsx`, `privacy.tsx`, `cookies.tsx`, `herroepingsrecht.tsx`, `terms.tsx`, `shipping.tsx`, `warranty.tsx`, `export-compliance.tsx`, `legal.tsx`, `security.tsx`
- **Committed legal Markdown** — `app/content/legal/*.md` (auto-regenerated by `sync:legal`)
- **`ProductCompliance.tsx`** — GPSR-mandated pre-sale information block
- **`.well-known/security.txt`**, `robots.txt`, `sitemap.xml` routes
- **Country shipping blocks** (RU/BY/IR/SY/KP/CU/MM + occupied territories) — export control, not a UX choice
- **Peppol e-invoicing, OSS VAT, 21% BTW display logic** — tax compliance
- **Repo-level config** — `vite.config.ts`, `react-router.config.ts`, `server.ts`, `package.json` deps

**Layout/styling** of legal pages (typography, spacing, TOC, breadcrumbs) is **open** — what's forbidden is editing the copy or changing which routes exist.

### Brand aesthetic

- **Dark.** Background `#0a0a0a`. No light mode.
- **Engineering.** JustFPV YouTube channel is the reference — technical, precise, no marketing fluff.
- **Monospace for specs and technical data.** JetBrains Mono. Uppercase + wide tracking for labels.
- **Gold (`#b8922e`) is the accent**, used sparingly — CTAs, hover states, brand wordmark highlights.
- **No stock photography.** Product shots only, on black, high contrast.
- **No gradients beyond subtle radial lighting.** No glassmorphism. No neumorphism.
- **Performance matters.** If your redesign adds >50 KB to the page, justify it.

When in doubt, ask in `#opendrone-web` on Discord before spending hours on something. Better to clarify upfront than reject a polished PR.

## Compliance

Implementation requirements for a Belgian BV selling FPV drone electronics to EU consumers. Legal copy is authored in a separate compliance repo and synced into `app/content/legal/` via `npm run sync:legal` — override the authoring source with `COMPLIANCE_SRC=/path/to/legal-md`. Company identity (KBO/VAT/address/tel) comes from `PUBLIC_COMPANY_*` env vars.

### 1. Mandatory pages

| Page | Route |
|------|-------|
| Algemene Voorwaarden (T&C) | `/algemene-voorwaarden` + `/terms` |
| Privacy Policy | `/privacy` |
| Cookie Policy | `/cookies` |
| Herroepingsrecht + Modelformulier | `/herroepingsrecht` |
| Shipping & Delivery | `/shipping` |
| Warranty (2-year wettelijke garantie) | `/warranty` |
| Export Compliance Policy | `/export-compliance` |
| Imprint / Legal | `/legal` + footer |
| Contact | `/contact` |

All pages must exist in **Dutch (NL) at minimum**. French and English recommended for EU reach.

**DO NOT include an ODR platform link.** The EU ODR platform was discontinued 20 July 2025 (Regulation 2024/3228). The old link `ec.europa.eu/consumers/odr` must NOT be referenced.

### 2. Shopify default legal templates — DO NOT USE

Shopify auto-generates Terms, Privacy, and Refund Policy templates. The EU Commission's CPC Network 2023 coordinated action found these **non-compliant** with Belgian WER Book VI. Replace all Shopify legal templates with the Incutec-authored versions. Shopify's Refund Policy page can remain as a thin wrapper linking to `/algemene-voorwaarden` Art. 5.

**Known bug in Incutec AV draft Art. 9.2**: Belgian law is 2-year reverse burden of proof, not 1-year. Fix when rendering.

### 3. Footer / company identity (WER Art. VI.45)

Every page footer must show:

```
Incutec BV
Stapelhuisstraat 15, 3000 Leuven
BE [0XXX.XXX.XXX]                    ← KBO number (post-incorporation)
BTW BE [0XXX.XXX.XXX]                ← VAT number (post-incorporation)
contact@opendrone.be
Tel: [TBD]                           ← optional but recommended
```

Also required: link to all mandatory pages (§1), link to EUIPO dispute procedure (NOT the discontinued ODR platform), language switcher if multi-lingual.

### 4. Cookie banner spec (GBA 2023 checklist — strict)

**Do NOT use Shopify's native cookie banner.** Use **Pandectes** or **Consentmo** Shopify apps (proven GBA-compliant), or build custom with these requirements:

1. **Reject-all button at same layer as Accept-all**, same size, same color, same contrast (no dark patterns)
2. No cookie walls — content accessible without consent
3. **Granular opt-in per purpose**: strictly necessary (no consent), functional, analytics, marketing
4. Strictly necessary cookies load before banner; all others blocked until consent
5. **6-month consent re-ask** (max lifetime of consent record)
6. Withdrawal/change preferences link permanently in footer
7. Cookie policy reachable without accepting anything
8. Log consent records with timestamp, IP hash, banner version

**Recommended: skip GA4 and Meta Pixel entirely.** Use **Plausible Analytics** (cookie-free, GDPR-compliant, no banner needed for it).

Shopify cookies inventory (classify in cookie-policy.md):

- Strictly necessary: `_secure_session_id`, `_shopify_y`, `_shopify_s`, `cart`, `cart_sig`, `cart_ts`, `_shopify_tm`, `_shopify_tw`, `checkout`, `checkout_token`, `secure_customer_sig`
- Analytics (opt-in): `_shopify_sa_p`, `_shopify_sa_t`, `_shopify_d`, `_y`
- Marketing (opt-in): `_ga`, `_gid`, `_fbp`, Klaviyo cookies if used

### 5. GPSR pre-sale listing requirements (Reg 2023/988, Art. 9)

Each product page must display **before purchase**:

- Manufacturer name + address + electronic contact — "Incutec BV, Stapelhuisstraat 15, 3000 Leuven, contact@opendrone.be"
- Responsible economic operator in EU — same as manufacturer (Incutec is in EU)
- Product identifier — model number + type/batch/serial
- Image of the product
- Safety information and warnings in the language of the country of sale (NL minimum for BE)
- Instructions (link to user manual PDF)

For LiPo chargers specifically, add: fire hazard warning, never charge unattended, never charge damaged/puffed batteries, use in well-ventilated area, warranty void if modified.

Implement as a reusable `<ProductCompliance>` component consumed by all product detail pages.

### 6. Product display requirements

**Prices:** display B2C prices INCLUDING 21% BTW by default (WER Art. VI.2). Show delivery cost before checkout (or "delivery calculated at checkout" with clear explanation). B2B toggle, if implemented, allows reverse-charge display for VIES-validated EU VAT numbers.

**Per-product required elements:** SKU, model number, batch identifier (dynamic if needed), CE marking visual, WEEE crossed-out wheelie bin symbol, open source badge (CERN-OHL-S) with GitHub link, source URL, datasheet / user manual download links, Declaration of Conformity (DoC) download per SKU, SBOM download per SKU (CRA — required 11 Dec 2027).

**Warranty text per product:**

> "Wettelijke garantie van 2 jaar conform Boek VI WER. Bij gebrek binnen 2 jaar: herstelling, vervanging of terugbetaling. Commerciële garantie: [none / X maanden]."

### 7. Checkout / order flow compliance

**Pre-checkout (Art. VI.45 WER):** total price incl. BTW + shipping shown before payment button, delivery timeframe shown, payment method confirmed, button text "Bestelling met betalingsverplichting" or "Betalen" (NOT just "Order"), checkbox for T&C acceptance (pre-ticked illegal).

**Country shipping blocks (sanctions):** Shopify Markets configuration must **block** Russia, Belarus, Iran, Syria, North Korea (DPRK), Cuba, Myanmar, Crimea, Donetsk/Luhansk People's Republics (occupied territories). Also require **Article 12g "No Re-Export to Russia" clause** in checkout terms for B2B orders to non-EU + non-Annex-VIII countries (Turkey, UAE, Kazakhstan, Serbia, China, HK, etc.). Annex VIII exempt countries (ship without clause): AU, CA, CH, IS, JP, LI, NO, NZ, KR, UK, US.

**14-day withdrawal confirmation:** post-purchase email must include herroepingsformulier link + instructions. Withdrawal period: 14 days from receipt of last item. No exceptions for FPV electronics.

**Order confirmation email** must include all mandatory pre-contractual info (Art. VI.47 WER): order summary + prices incl. BTW, delivery address + timeframe, payment method confirmed, right of withdrawal + modelformulier attached, manufacturer identity + contact, warranty terms.

### 8. Payment providers

| Provider | Role | DPA URL | SCC needed |
|----------|------|---------|------------|
| Shopify | Processor | shopify.com/legal/dpa | Yes (US subprocessors) |
| Stripe | Controller + Processor | stripe.com/legal/dpa | Yes |
| Mollie | Processor | mollie.com/en/privacy | No (NL-based) |
| Sendcloud | Processor | sendcloud.com/dpa | No (NL-based) |

Belgian payment method share: **Bancontact ≈ 25.7%**. Mollie mandatory for competitive checkout.

### 9. OSS VAT (MOSS) — voluntary registration from day 1

Do NOT wait for the €10K pan-EU B2C threshold. One viral video crosses it in hours.

- Register via MyMinfin → Intervat → OSS-Unieregeling **before webshop launch**.
- Configure **Shopify Tax** with destination-country VAT rates: BE 21%, NL 21%, DE 19%, FR 20%, IT 22%, ES 21%, LU 17%, AT 20%, PL 23%, SE 25%, DK 25%, PT 23%, FI 25.5%, etc.
- Filing: quarterly via Intervat (automated returns from Shopify Tax reports).

### 10. Peppol e-invoicing (mandatory Belgium, active since 1 Jan 2026)

- B2B invoices to Belgian BTW-plichtigen MUST be sent via Peppol in BIS Billing 3.0 format.
- B2C invoices unaffected (can remain PDF).
- **Implementation**: Sufio Shopify app + Billit or Hermes (free) as Peppol Access Point.
- Estimated cost: €200–500/yr.
- Penalties: €1.5K–5K per non-compliant invoice.

Sufio handles Shopify integration; Billit/Hermes handles network transmission. Configure to send Peppol automatically for B2B orders (VIES-validated VAT numbers).

### 11. Technical file + SBOM downloads (CRA)

By **11 Dec 2027**, each product page must offer:

- SBOM (CycloneDX JSON or SPDX) download per SKU
- Declaration of Conformity PDF download per SKU
- Vulnerability disclosure contact — `/.well-known/security.txt` per RFC 9116
- Security advisories page listing CVEs affecting products

By **11 Sep 2026**, set up vulnerability reporting channel to ENISA (parallel obligation, not a web requirement).

### 12. Open source attribution (CERN-OHL-S + DCO)

- Every product page links to its public GitHub repo.
- Each repo contains: LICENSE, NOTICE.md, TRADEMARKS.md, CONTRIBUTING (DCO).
- Footer badge: "Open Source Hardware — CERN-OHL-S-2.0".
- Link to ohwr.org / OSHWA certification when obtained.

### 13. Accessibility (EAA — EU 2019/882, effective 28 Jun 2025)

EAA applies to e-commerce services with >10 employees OR >€2M turnover — **Incutec is below threshold Y1, exempt Y1**. Implement WCAG 2.1 AA as baseline anyway (keyboard navigation, alt text, color contrast ≥4.5:1) — the threshold will be crossed Y2–Y3.

### 14. Analytics + marketing tooling

| Tool | Why | Privacy |
|------|-----|---------|
| **Plausible** (self-host or plausible.io) | Lightweight, cookie-free analytics | GDPR-safe, no banner needed |
| **Shopify Analytics** | Built-in order/product metrics | Functional, no opt-in for strictly necessary |
| **Klaviyo** or **Mailchimp** (email) | Transactional + marketing | DPA + SCC required, opt-in marketing |
| **Sentry** (error tracking) | JS error monitoring | Configure PII scrubbing, DPA required |

**Avoid**: GA4 (cookie banner complexity + Schrems II risk), Meta Pixel (cookie banner + ad-block rate >40%), Hotjar (session recording PII risk).

### 15. Implementation priority

**Phase 1 — Pre-launch (blocking)**

1. Mandatory pages (§1) rendered from Incutec-authored Markdown/MDX
2. Company identity footer (§3)
3. Cookie banner spec (§4) — Pandectes/Consentmo or custom
4. GPSR pre-sale component (§5) on all product pages
5. Country shipping blocks (§7)
6. OSS VAT configuration (§9)
7. DoC + manual download per product (§6)
8. Plausible analytics (no GA4 initially)

**Phase 2 — Post-launch (weeks 1–4)**

9. Peppol e-invoicing integration (§10) via Sufio + Billit
10. Article 12g clause in B2B checkout terms (§7)
11. Warranty page + return flow automation
12. `/export-compliance` page publishing country policy

**Phase 3 — Before CRA deadline (by Dec 2027)**

13. SBOM download per SKU (§11)
14. security.txt + vulnerability reporting page
15. Security advisories page

**Phase 4 — As revenue grows (Y2–Y3)**

16. EAA WCAG 2.1 AA full audit
17. B2B VIES-validated reverse-charge flow
18. Multi-language NL/FR/EN/DE complete
19. Trust badges (SafeShops/BeCommerce evaluation)

## Newsletter

Monthly-ish email sent to people who signed up at opendrone.be. Announces product releases, firmware drops, and linked long-form articles. Teaser + CTA format — full content lives on the site, the email drives traffic.

### Pipeline

```
  subscribe form  ──▶  Shopify Customers (acceptsMarketing=true, tag: newsletter)
  (Hydrogen site)        │
                         ├──▶  Shopify Email campaign ──▶  inbox
                         │
  blog post (Shopify)  ──┘
       │
  compose-newsletter.mjs  ──▶  scripts/out/newsletter-<slug>.html
                                          │
                                          └──▶ paste into Shopify Email (Custom HTML)
```

- **Subscribers**: `app/routes/newsletter.tsx` writes them into Shopify's customer list with marketing consent via the Storefront API.
- **Content**: authored as a blog article in Shopify admin (Content → Blog posts), renders automatically at `/blogs/<blog>/<article>`.
- **Email**: composed from the article via `npm run compose:newsletter`, sent manually from Shopify Email.

### Sending an issue (~3 minutes)

1. **Write the article** — Shopify admin → Content → Blog posts → Add blog post. Fill title, excerpt (important — becomes the email teaser), featured image, body. Publish.
2. **Render the email** — `npm run compose:newsletter <article-handle>` (or `<blog-handle>/<article-handle>` for a non-default blog). Writes `scripts/out/newsletter-<handle>.html`. Prints subject line and preheader to stdout.
3. **Preview** — `open scripts/out/newsletter-<handle>.html`. Check hero image, title, excerpt, and CTA button.
4. **Paste into Shopify Email** — Shopify admin → Marketing → Campaigns → Create campaign → Shopify Email → Custom HTML. Paste the full file contents. Fill subject (printed by script), preheader (printed by script), from (verified sender), audience (Email subscription status = Subscribed).
5. **Send** — preview in Shopify, send a test to yourself, then send to the list. Shopify Email is free for 10,000 emails per month.

### Template

`scripts/newsletter-template.html` — email-safe HTML (table layout, inline styles, dark background, gold accent, JetBrains Mono for eyebrow text). Placeholders replaced by `compose-newsletter.mjs`:

| Placeholder | Source |
|---|---|
| `{{TITLE}}` | `article.title` |
| `{{EXCERPT_HTML}}` | `article.excerptHtml` → `article.excerpt` → first `<p>` fallback |
| `{{HERO_IMAGE_BLOCK}}` | `article.image` (omitted if absent) |
| `{{PUBLISHED_DATE}}` | `article.publishedAt`, formatted `Month D, YYYY` |
| `{{ISSUE_LABEL}}` | `MMM YYYY` shown in the header |
| `{{ARTICLE_URL}}` | `https://opendrone.be/blogs/<blog>/<article>` |
| `{{SUBJECT}}` | `<title>` tag, mirrors the H1 |
| `{{PREHEADER}}` | Hidden preview text shown in inbox list |

Keep the template table-based with inline styles only — email clients still strip most modern CSS.

### Unsubscribe

Shopify Email injects the `{% unsubscribe %}` link automatically and honours opt-outs across future campaigns. No custom handling needed.

### When to upgrade

This manual-with-template workflow is right until:

- > ~500 subscribers, OR
- more than one automation (welcome series, product drops, cart abandonment), OR
- per-link analytics Shopify Email doesn't provide.

At that point, migrate to **Klaviyo** (deep Shopify integration, $20/mo to start) or **Beehiiv** (newsletter-native, RSS-to-email automation). Both have a one-line API swap in `app/routes/newsletter.tsx`. The privacy policy already lists Klaviyo / Mailchimp as contemplated processors — if you pick a different provider, update `app/content/legal/*/privacy-policy.md` via `npm run sync:legal`.

### Files

| Path | Purpose |
|---|---|
| `app/components/NewsletterSignup.tsx` | Signup form UI (footer + `/blogs`) |
| `app/routes/newsletter.tsx` | POST handler — Storefront API customerCreate |
| `scripts/newsletter-template.html` | Email-safe HTML template |
| `scripts/compose-newsletter.mjs` | Render article → email HTML |
| `scripts/out/` | Rendered outputs (git-ignored, safe to delete) |

## Security

**Do not open a public GitHub issue for security vulnerabilities.** Use one of:

- Email: **security@opendrone.be**
- [GitHub private vulnerability reporting](https://github.com/Just4Stan/OpenDrone-Web/security/advisories/new)

The canonical policy — including CRA obligations, ENISA reporting timelines, triage windows, and patch SLAs — lives on the live site at **<https://opendrone.be/security>**. A machine-readable pointer is published at [`/.well-known/security.txt`](https://opendrone.be/.well-known/security.txt).

### Scope

**In scope**: this repository and the site it deploys. Authentication, session handling, checkout flow, customer data handling. XSS, CSRF, SSRF, injection, auth bypass, IDOR.

**Out of scope**: denial of service attacks, volumetric testing, physical attacks, social engineering or phishing of staff, third-party services not operated by Incutec (Shopify, Stripe, hosting providers), reports generated solely by automated scanners without proof of exploitability.

### What not to do

- Do not access accounts, data, or orders that aren't your own
- Do not run automated scanners against production
- Do not test payment flows with real cards

## License

[MIT](LICENSE). Hardware repos are CERN-OHL-S — see [OpenFC](https://github.com/Just4Stan/OpenFC) and [OpenESC](https://github.com/Just4Stan/Open-4in1-AM32-ESC).
