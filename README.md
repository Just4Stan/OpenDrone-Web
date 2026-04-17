# OpenDrone Web

Open-source storefront for OpenDrone — FPV flight controllers, ESCs, and frames. Built on Shopify Hydrogen.

The storefront is MIT licensed (see [LICENSE](LICENSE)). Hardware repos are linked at the bottom — see those repos for their respective licenses.

## Stack

- **Shopify Hydrogen** 2026.1.x on Oxygen (Shopify's edge runtime)
- **React Router 7** — file-based routes under `app/routes/`
- **Tailwind CSS v4** — design tokens in `app/styles/app.css`
- **react-three-fiber** — 3D hero scene in `app/components/HeroScene.tsx`
- **TypeScript** strict
- **Plausible** analytics — cookieless, no consent banner required

## Quick start

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env   # fill in Shopify tokens — see CONTRIBUTING.md
npm run dev            # http://localhost:3000
```

Contributing? Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SCOPE.md](SCOPE.md) first.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server with codegen |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Serve production bundle locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Shopify Storefront API types |
| `npm run sync:legal` | Refresh legal Markdown snapshots |

## Project layout

```
app/
  routes/           # file-based routes
  components/       # shared React components
  styles/app.css    # Tailwind + design tokens
  content/legal/    # committed legal Markdown (do not hand-edit)
  graphql/          # Customer Account API queries
  lib/              # helpers (i18n, SEO, company, context, fragments)
public/             # static assets
scripts/            # build-time scripts (legal sync, etc.)
```

## Design

Dark background (`#0a0a0a`), gold accent (`#b8922e`), JetBrains Mono for technical specs, Space Grotesk for headings. Engineering aesthetic — no stock photography, no marketing fluff. Performance-first; bundle size is reviewed on every PR.

Full design scope and what's open vs. locked: [SCOPE.md](SCOPE.md).

## Compliance Integration

The storefront ships with Markdown snapshots under `app/content/legal/` — that committed snapshot is the source of truth for what is deployed. Maintainers author legal copy in a separate location and run `npm run sync:legal` to refresh the snapshot. Contributors do not need access to the authoring source; `sync:legal` no-ops gracefully when the source is unavailable and the existing snapshot is preserved.

Override the authoring-source path with `COMPLIANCE_SRC` if you maintain your own fork:

```sh
COMPLIANCE_SRC=/path/to/your/legal-md npm run sync:legal
```

Legal entity identity (company name, KBO, VAT, support email) lives in `PUBLIC_COMPANY_*` env vars — see `.env.example`. Product branding (OpenDrone, OpenFC, OpenESC) is separate from the seller identity shown in the footer and on `/legal`.

Mandatory legal routes: `/algemene-voorwaarden`, `/privacy`, `/cookies`, `/herroepingsrecht`, `/shipping`, `/warranty`, `/export-compliance`, `/legal`, `/contact`, `/security`, `/cookie-settings`, and `/.well-known/security.txt`. The old Shopify `/policies/*` URLs 308 to the dedicated routes.

Analytics: Plausible (cookieless, no consent banner). Shopify `withPrivacyBanner` is disabled — only strictly-necessary cookies are shipped at launch.

## Belgian Legal Requirements

Full compliance spec: [COMPLIANCE.md](COMPLIANCE.md). Summary:

- Company info in footer: KBO, BTW, address (per WER Art. VI.45)
- Prices including 21% BTW
- GBA-compliant cookie banner (Pandectes/Consentmo, NOT Shopify default)
- Herroepingsrecht (14 days) + withdrawal form, no ODR link (EU ODR platform discontinued 20 Jul 2025)
- Dutch language minimum for Flanders market
- GPSR pre-sale info block on each product page
- OSS VAT registration from day 1 (not waiting for €10K threshold)
- Peppol e-invoicing for B2B (mandatory since 1 Jan 2026)
- Country shipping blocks for RU/BY/IR/SY/KP/CU/MM + occupied territories
- Incutec-authored legal copy replaces Shopify defaults

## Payment Providers

- Mollie — Bancontact (25.7% of Belgian payments), iDEAL, SEPA
- Shopify Payments / Stripe — cards, Apple Pay, Google Pay

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md). Do not open a public issue.

## Contributing

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, workflow, coding standards
- [SCOPE.md](SCOPE.md) — what's open for redesign, what's locked
- [Discord](https://discord.gg/v3sWmTcx3R) — `#opendrone-web` for questions and design chat

## License

[MIT](LICENSE). Contributions accepted under DCO sign-off (`git commit -s`).

## Related

- [OpenFC](https://github.com/Just4Stan/OpenFC) — flight controller hardware
- [OpenESC](https://github.com/Just4Stan/Open-4in1-AM32-ESC) — 4-in-1 ESC hardware
