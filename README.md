# OpenDrone Web

Webshop and marketing site for OpenDrone (working name). Built with Shopify Hydrogen (React/Remix) or Shopify Liquid theme.

## Architecture Decision

### Option A: Shopify Hydrogen (Headless)
- React + Remix frontend
- Shopify Storefront API as backend
- Host on Vercel (free hobby tier)
- Full design freedom
- Proper git workflow
- Cost: €5/month Shopify Starter + free Vercel

### Option B: Shopify Theme (Liquid)
- Customize a Shopify theme
- Liquid templating + HTML/CSS/JS
- Hosted by Shopify
- Less freedom but simpler
- Cost: €36/month Shopify Basic

## Style
- Dark background, clean engineering aesthetic
- Matches JustFPV YouTube style (1920x1080, dark)
- Product-focused, not marketing fluff
- Open source badge + GitHub links prominent
- Interactive BOM viewer (link to ibom)

## Pages Needed
- Landing / hero (product showcase)
- Product pages (stack, ESC, bare PCBs)
- About (open source mission, the team)
- Blog (engineering articles, launch updates)
- Legal (AV, privacy, cookies, herroepingsrecht)

## Compliance Integration

Legal content is sourced from the Incutec compliance repo at
`~/Library/Mobile Documents/com~apple~CloudDocs/incutec/compliance/`. The
storefront ships with Markdown snapshots under `app/content/legal/`. To
re-sync from the source:

```sh
npm run sync:legal
```

`prebuild` also invokes `sync:legal` so every production build picks up
the latest compliance copy from iCloud when available. Legal entity
identity (Incutec BV, KBO, VAT, support email) lives in `PUBLIC_COMPANY_*`
env vars — see `.env.example`. Product branding (OpenDrone, OpenFC,
OpenESC) stays separate from the seller identity shown in the footer and
on `/legal`.

Mandatory legal routes: `/algemene-voorwaarden`, `/privacy`, `/cookies`,
`/herroepingsrecht`, `/shipping`, `/warranty`, `/export-compliance`,
`/legal`, `/contact`, `/security`, `/cookie-settings`, and
`/.well-known/security.txt`. The old Shopify `/policies/*` URLs 308 to
the dedicated routes.

Analytics: Plausible (cookieless, no consent banner). Shopify
`withPrivacyBanner` is disabled — only strictly-necessary cookies are
shipped at launch.

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
- Replace Shopify default Terms/Privacy/Refund templates with Incutec-authored versions

## Payment Providers
- Mollie (Bancontact = 25.7% of Belgian payments!)
- Shopify Payments / Stripe (cards, Apple Pay, Google Pay)

## Related Repos
- [OpenDrone](https://github.com/Just4Stan/OpenDrone) (private) — business/strategy
- [OpenFC](https://github.com/Just4Stan/OpenFC) — flight controller hardware
- [OpenESC 20x20](https://github.com/Just4Stan/Open-4in1-AM32-ESC) — ESC hardware
