# OpenDrone Web

Open-source storefront for [OpenDrone](https://opendrone.be) — FPV flight controllers, ESCs, and frames. Built on Shopify Hydrogen 2026.x (React Router 7, Tailwind v4, r3f hero).

## Quick start

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env   # fill in Shopify tokens (ask in #opendrone-web on Discord)
npm run dev            # http://localhost:3000
```

Requires Node 22 or 24, npm 10+.

## Production workflow

Production site: <https://opendrone.be> → Shopify Oxygen.

Continuous deployment is live — every push to `main` triggers an Oxygen build + deploy. Pull-request branches get a preview URL as a status check.

```sh
git checkout -b feat/topic       # branch off main
# work, commit (DCO-signed: git commit -s)
git push -u origin feat/topic
gh pr create --web               # CI runs lint + typecheck + build
                                 # Oxygen posts preview URL
# review, merge → auto-deploy (~2 min)
```

Monitor deploys in Shopify admin → Hydrogen → Opendrone Web.

**Manual deploy (emergency only):** `npx shopify hydrogen deploy` ships the current local tree directly, bypassing CI and git history. Use only when the CD path is broken.

### DNS

`opendrone.be` is at Gandi. Mail (MX + DKIM + DMARC) stays on Google Workspace — only web records point at Shopify:

- `A @` → `23.227.38.65`
- `CNAME www` → `shops.myshopify.com.` (trailing dot matters)

Do not modify MX, `google._domainkey`, `_dmarc`, or SPF TXT records. When Shopify needs SPF updated, merge into a single TXT: `v=spf1 include:_spf.google.com include:shops.shopify.com ~all`.

## Stack

Shopify Hydrogen 2026.x on Oxygen · React Router 7 (file-based routes in `app/routes/`) · Tailwind CSS v4 (tokens in `app/styles/app.css` `@theme`) · react-three-fiber hero · TypeScript strict · Plausible analytics (cookieless, no banner).

Design tokens: `--color-bg #0a0a0a`, `--color-bg-card #101210`, `--color-text #e5e5e5`, `--color-text-muted #737373`, `--color-gold #b8922e`, `--color-accent #1f4d2c`. Fonts: Space Grotesk (display), Inter (sans), JetBrains Mono (mono). Use the CSS vars — don't hardcode.

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev + codegen |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Serve the production bundle locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Storefront API types |
| `npm run sync:legal` | Refresh legal Markdown snapshots |
| `npm run compose:newsletter <handle>` | Render a newsletter email from a blog article |

`lint` and `typecheck` must pass before every PR — CI will reject otherwise.

## Project layout

```
app/
  routes/           file-based routes (React Router 7)
  components/       shared components
  styles/app.css    Tailwind v4 + @theme tokens
  content/legal/    committed legal Markdown — generated, do not hand-edit
  graphql/          Customer Account API queries
  lib/              i18n, SEO, company, context, fragments
public/             static assets
scripts/            build-time scripts
```

## Contributing

Prerequisites: Node 22/24, npm 10+, Shopify dev-store credentials (ask in `#opendrone-web` on [Discord](https://discord.gg/ABajnacUsS)).

1. Pick an [open issue](https://github.com/Just4Stan/OpenDrone-Web/issues) or open a Design proposal first.
2. Branch from fresh `main`: `<type>/<topic>` — `design`, `feat`, `fix`, `chore`, `refactor`, or `docs`.
3. Commit with DCO sign-off: `git commit -s -m "subject"`. Subject ≤60 chars, imperative mood.
4. Run `npm run lint && npm run typecheck && npm run build` locally.
5. `gh pr create --web` — CI and Oxygen preview run automatically.
6. Address feedback with new commits. Maintainers squash-merge.

Forgot `-s`? `git commit --amend -s --no-edit && git push --force-with-lease`.

### Rules

- Lint + typecheck must pass locally before pushing.
- No new npm deps without opening an issue first (supply-chain risk).
- Mobile-first: design at 375px, enhance at 768px and 1440px.
- WCAG 2.1 AA baseline — semantic HTML, alt text, keyboard nav, ≥4.5:1 contrast.
- Bundle additions >50 KB gzipped need justification.
- No `console.log` in prod — strip or guard with `if (import.meta.env.DEV)`.
- No hand-edits to `app/content/legal/**`.
- Dependabot runs weekly — don't duplicate its PRs.

## Design scope

What's open for community design work, what's locked, and what's forbidden.

### Open for redesign

Go wild within the brand aesthetic (dark, engineering, gold accent, monospace specs).

- Homepage hero (current 3D scene is a placeholder direction)
- Collection pages, product pages, cart UI (pre-Shopify-checkout only)
- Blog index and article pages
- Header / nav, footer (non-legal sections)
- Search UI, component library, empty/loading/error states

### Locked — ask first

- Brand tokens (`@theme` block in `app/styles/app.css`)
- Logo, wordmark, OpenDrone/OpenFC/OpenESC/OpenFrame branding
- `CompanyFooterBlock.tsx` — Incutec BV identity (KBO/VAT required by law)
- Analytics implementation (Plausible, cookieless — do not add GA/FB Pixel/Hotjar)
- `/cookie-settings` — GBA-compliant, touching it risks non-compliance

### Forbidden — do not touch

Legal content is authored in a private compliance repo and synced in. Editing it creates legal liability.

- Legal route files: `algemene-voorwaarden.tsx`, `privacy.tsx`, `cookies.tsx`, `herroepingsrecht.tsx`, `terms.tsx`, `shipping.tsx`, `warranty.tsx`, `export-compliance.tsx`, `legal.tsx`, `security.tsx`
- `app/content/legal/*.md` (regenerated by `sync:legal`)
- `ProductCompliance.tsx` — GPSR pre-sale block
- `.well-known/security.txt`, `robots.txt`, `sitemap.xml`
- Country shipping blocks (RU/BY/IR/SY/KP/CU/MM + occupied territories) — export control
- Peppol e-invoicing, OSS VAT, 21% BTW display logic
- `vite.config.ts`, `react-router.config.ts`, `server.ts`, `package.json` deps

Layout and styling of legal pages (typography, spacing, TOC) is open — what's forbidden is editing the copy or changing which routes exist.

### Brand aesthetic

- **Dark.** Background `#0a0a0a`. No light mode.
- **Engineering.** JustFPV YouTube channel is the reference — precise, no marketing fluff.
- **Monospace** for specs and technical data. Uppercase + wide tracking for labels.
- **Gold** (`#b8922e`) used sparingly — CTAs, hover, wordmark highlights.
- **No stock photography.** Product shots only, on black, high contrast.
- **No gradients beyond subtle radial lighting.** No glassmorphism, no neumorphism.

When in doubt, ask in `#opendrone-web` before spending hours on something.

## Compliance

Requirements for a Belgian BV selling FPV drone electronics to EU consumers. Legal copy lives in a separate compliance repo and is synced into `app/content/legal/` via `npm run sync:legal` (override source with `COMPLIANCE_SRC=/path/to/legal-md`). Company identity comes from `PUBLIC_COMPANY_*` env vars.

### Mandatory pages

| Page | Route |
|---|---|
| Algemene Voorwaarden (T&C) | `/algemene-voorwaarden` + `/terms` |
| Privacy Policy | `/privacy` |
| Cookie Policy | `/cookies` |
| Herroepingsrecht + Modelformulier | `/herroepingsrecht` |
| Shipping & Delivery | `/shipping` |
| Warranty (2-year wettelijke garantie) | `/warranty` |
| Export Compliance Policy | `/export-compliance` |
| Imprint / Legal | `/legal` + footer |
| Contact | `/contact` |

All pages in Dutch (NL) minimum. French and English recommended.

The EU ODR platform was discontinued 20 July 2025 (Reg 2024/3228) — do **not** reference `ec.europa.eu/consumers/odr`.

Do **not** use Shopify's default Terms/Privacy/Refund templates — the EU Commission's CPC Network 2023 action found them non-compliant with Belgian WER Book VI.

### Company identity footer (WER Art. VI.45)

Every page footer must show the full Incutec BV block (company name, address, KBO, VAT, contact email, optional tel). KBO and VAT numbers are pending incorporation — the footer renders placeholders from `PUBLIC_COMPANY_*` env vars until those are set.

### Cookie banner (GBA 2023)

Current site uses Plausible (cookie-free, no banner). If a banner is ever required:

- Reject-all at the same layer / size / contrast as Accept-all (no dark patterns)
- No cookie walls
- Granular opt-in per purpose (strictly necessary, functional, analytics, marketing)
- Strictly necessary cookies load before the banner, everything else blocked until consent
- 6-month consent re-ask
- Withdraw-consent link permanently in footer
- Log consent records with timestamp, IP hash, banner version

### GPSR pre-sale info (Reg 2023/988 Art. 9)

Each product page must display before purchase, via `ProductCompliance.tsx`: manufacturer + EU operator name/address/contact, product identifier (model + type/batch/serial), image, safety warnings in the language of sale (NL minimum), link to user manual. LiPo chargers require the extra fire/charging warnings.

### Product display (WER Art. VI.2)

B2C prices include 21% BTW by default. Delivery cost shown before checkout. Per-product required: SKU, model, batch identifier, CE marking, WEEE symbol, open-source badge + GitHub link, datasheet + manual + DoC + SBOM downloads (SBOM mandatory from 11 Dec 2027 under CRA).

Warranty line per product: *"Wettelijke garantie van 2 jaar conform Boek VI WER. Bij gebrek binnen 2 jaar: herstelling, vervanging of terugbetaling. Commerciële garantie: [none / X maanden]."*

### Checkout

Art. VI.45 WER pre-checkout: total incl. BTW + shipping shown before the pay button, delivery timeframe, payment method, button text `Bestelling met betalingsverplichting` or `Betalen`, T&C checkbox (not pre-ticked).

Shopify Markets blocks Russia, Belarus, Iran, Syria, North Korea, Cuba, Myanmar, and occupied Ukrainian territories. B2B orders to non-EU + non-Annex-VIII countries require the Article 12g "No Re-Export to Russia" clause. Annex VIII exempt: AU, CA, CH, IS, JP, LI, NO, NZ, KR, UK, US.

Post-purchase email includes the herroepingsformulier link (14 days from receipt of last item, no exceptions for FPV electronics) and all Art. VI.47 pre-contractual info.

### Payment providers

| Provider | Role | DPA |
|---|---|---|
| Shopify | Processor | shopify.com/legal/dpa |
| Stripe | Controller + Processor | stripe.com/legal/dpa |
| Mollie | Processor | mollie.com/en/privacy |
| Sendcloud | Processor | sendcloud.com/dpa |

Belgian market share makes Bancontact (via Mollie) mandatory — ~25% of checkouts.

### VAT and invoicing

- **OSS (MOSS)** registered via Intervat before launch — no €10K threshold waiting. Shopify Tax configured with destination-country rates, quarterly filing via Intervat.
- **Peppol e-invoicing** (mandatory BE since 1 Jan 2026) — B2B invoices to BE BTW-plichtigen sent via Peppol BIS Billing 3.0 through a Shopify app + Access Point. B2C unaffected.

### CRA (by 11 Dec 2027)

- SBOM (CycloneDX JSON or SPDX) download per SKU
- DoC PDF download per SKU
- `/.well-known/security.txt` (RFC 9116) — already live
- Security advisories page listing CVEs
- ENISA vulnerability reporting channel set up by 11 Sep 2026

### Open source

Every product page links to its GitHub repo. Each repo contains LICENSE, NOTICE.md, TRADEMARKS.md, CONTRIBUTING (DCO). Footer badge: "Open Source Hardware — CERN-OHL-S-2.0".

### Accessibility (EAA, 28 Jun 2025)

EAA applies to e-commerce services with >10 employees or >€2M turnover — Incutec is below threshold, exempt Y1. WCAG 2.1 AA implemented as baseline anyway.

### Analytics

Plausible only (cookieless, GDPR-safe). Do not add GA4 (Schrems II risk + banner complexity), Meta Pixel (ad-block rate >40%), or Hotjar (session-recording PII risk). Shopify's built-in order/product analytics is functional and needs no opt-in.

## Newsletter

Monthly-ish email to opt-in subscribers. Teaser + CTA format — full content lives on the site, the email drives traffic.

```
  subscribe form  ──▶  Shopify Customers (acceptsMarketing=true, tag: newsletter)
  (Hydrogen)             │
                         ├──▶  Shopify Email campaign ──▶  inbox
                         │
  blog post (Shopify)  ──┘
       │
  compose-newsletter.mjs  ──▶  scripts/out/newsletter-<slug>.html
                                          │
                                          └──▶ paste into Shopify Email (Custom HTML)
```

- Subscribers: `app/routes/newsletter.tsx` writes to Shopify's customer list via Storefront API.
- Content: authored as a blog article in Shopify admin, renders at `/blogs/<blog>/<article>`.
- Email: `npm run compose:newsletter <handle>` renders `scripts/out/newsletter-<handle>.html`. Paste into Shopify admin → Marketing → Campaigns → Custom HTML. Subject + preheader are printed to stdout by the script.

Shopify Email injects `{% unsubscribe %}` automatically and honours opt-outs. Free up to 10K emails/month.

Template placeholders (`scripts/newsletter-template.html`): `{{TITLE}}`, `{{EXCERPT_HTML}}`, `{{HERO_IMAGE_BLOCK}}`, `{{PUBLISHED_DATE}}`, `{{ISSUE_LABEL}}`, `{{ARTICLE_URL}}`, `{{SUBJECT}}`, `{{PREHEADER}}`. Keep the template table-based with inline styles — most email clients strip modern CSS.

If we outgrow Shopify Email (>500 subscribers, multiple automations, or per-link analytics), migrate to Klaviyo or Beehiiv. One-line swap in `app/routes/newsletter.tsx`. The privacy policy already lists Klaviyo/Mailchimp as contemplated processors.

## Security

**Do not open a public GitHub issue for security vulnerabilities.** Use:

- Email: **security@opendrone.be**
- [GitHub private vulnerability reporting](https://github.com/Just4Stan/OpenDrone-Web/security/advisories/new)

Full policy (CRA obligations, ENISA reporting, triage windows, patch SLAs) lives at <https://opendrone.be/security>. Machine-readable pointer at [`/.well-known/security.txt`](https://opendrone.be/.well-known/security.txt).

**In scope:** this repo and the deployed site — auth, sessions, checkout, customer data. XSS, CSRF, SSRF, injection, auth bypass, IDOR.

**Out of scope:** DoS, volumetric testing, physical or social-engineering attacks, third-party services not operated by Incutec, reports from automated scanners without proof of exploitability.

Do not access accounts/data/orders that aren't your own, run automated scanners against production, or test payment flows with real cards.

## License

[MIT](LICENSE). Hardware repos are CERN-OHL-S — see [OpenFC](https://github.com/Just4Stan/OpenFC) and [OpenESC](https://github.com/Just4Stan/Open-4in1-AM32-ESC).
