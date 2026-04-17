# OpenDrone Web — Agent Instructions

Guidance for AI assistants (Claude Code, Cursor, etc.) working on this repo. Human contributors should read [CONTRIBUTING.md](CONTRIBUTING.md) and [SCOPE.md](SCOPE.md) first.

## What This Is

Storefront and marketing site for OpenDrone — open-source drone electronics. Built on Shopify Hydrogen (React + React Router 7) with Tailwind v4.

## Stack

- Shopify Hydrogen 2026.1.x (Oxygen runtime)
- React Router 7 (file-based routes under `app/routes/`)
- Tailwind CSS v4 — tokens in `app/styles/app.css`
- react-three-fiber for the 3D hero (`app/components/HeroScene.tsx`)
- TypeScript strict
- Plausible analytics (cookieless, no consent banner)

## Style

- Dark background (`#0a0a0a`), clean engineering aesthetic
- JustFPV YouTube channel as visual reference
- Product photography on black, high contrast
- Monospace (JetBrains Mono) for specs, uppercase + wide tracking
- Gold (`#b8922e`) as the single accent color, used sparingly
- No stock photography, no gradients beyond subtle radial lighting

## Rules

- Mobile-first responsive design (design at 375px, enhance up)
- Performance matters — justify bundle size increases over 50KB
- No new dependencies without discussion
- No hardcoded values — use design tokens from `app/styles/app.css`
- Accessibility: semantic HTML, alt text, keyboard nav, WCAG AA contrast

## Compliance

Read [COMPLIANCE.md](COMPLIANCE.md) before touching any legal page or product listing component. Covers mandatory routes, GPSR product requirements, cookie banner spec, Peppol e-invoicing, OSS VAT, country shipping blocks, GDPR, and CRA SBOM downloads.

Legal page copy is authored separately and synced into `app/content/legal/` via `npm run sync:legal`. The committed snapshot is the source of truth for what ships. Do not edit the snapshot files by hand — point `COMPLIANCE_SRC` at your authoring source and re-sync.

## Locked areas

See [SCOPE.md](SCOPE.md) for the full list. Summary:
- Legal route files and `app/content/legal/**`
- `CompanyFooterBlock.tsx`, `ProductCompliance.tsx`, `app/lib/company.ts`
- Brand design tokens in `app/styles/app.css`
- Analytics setup (Plausible, no cookie-setting trackers)
- Country shipping block logic
