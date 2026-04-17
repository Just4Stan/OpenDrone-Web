# Contributing to OpenDrone Web

Thanks for helping build the OpenDrone storefront. This doc covers what you need to get running, how to submit changes, and what's in/out of scope. Read [SCOPE.md](SCOPE.md) before starting design work.

## Tech stack

- **Shopify Hydrogen** (2026.1.x) — React storefront on Shopify's Oxygen runtime
- **React Router 7** — file-based routing under `app/routes/`
- **Tailwind CSS v4** — utility-first styling, design tokens in `app/styles/app.css`
- **react-three-fiber** — 3D hero scene (`app/components/HeroScene.tsx`)
- **TypeScript**, strict mode
- **Plausible** — analytics (cookieless, no consent banner)

## Prerequisites

- Node 20+ (LTS)
- npm 10+
- A Shopify dev store storefront token (ask Stan on Discord — shared via DM)

## Getting started

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env
# Fill in the Shopify tokens from the DM
npm run dev
```

The dev server runs at `http://localhost:3000`. Hot reload is on.

## Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start local dev server with codegen |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Build + serve production bundle locally |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Shopify Storefront API types |

## Project layout

```
app/
  routes/           # file-based routes (see React Router 7 docs)
  components/       # shared React components
  styles/app.css    # Tailwind + design tokens
  content/legal/    # committed legal Markdown (do not edit — sourced from Incutec)
  graphql/          # Storefront API queries
public/             # static assets
scripts/            # build scripts (legal sync, etc.)
```

## Design tokens

All colors, fonts, and spacing live in `app/styles/app.css` under `@theme`. Use them — don't hardcode hex values.

Key tokens:
- `--color-bg` `#0a0a0a` — page background
- `--color-gold` `#b8922e` — brand accent
- `--color-text` `#e5e5e5` — body
- `--font-display` Space Grotesk — headings
- `--font-mono` JetBrains Mono — technical specs, uppercase labels

## Workflow

1. **Pick an issue** labeled `design:open` or `good-first-issue`. Comment to claim it.
2. **Branch** from `main`: `git checkout -b design/short-description`
3. **Commit** often, small commits. Conventional prefix (`feat:`, `fix:`, `style:`, `refactor:`, `chore:`). Sign off with `git commit -s` (DCO).
4. **PR** into `main`. Preview deploy builds automatically. Include before/after screenshots for visual changes.
5. **Review** — Stan reviews and merges. Expect direct feedback.

## Coding standards

- `npm run lint` and `npm run typecheck` must pass before PR
- Prefer Tailwind classes over new CSS
- No new dependencies without asking first
- Mobile-first — design at 375px wide, enhance up
- Accessibility: real semantics, alt text, keyboard nav, WCAG AA contrast

## Commit sign-off (DCO)

By signing off, you certify the [Developer Certificate of Origin](https://developercertificate.org/). Add `-s` to every commit:

```sh
git commit -s -m "feat: new product card hover state"
```

## License

Contributions are licensed under MIT (see [LICENSE](LICENSE)).

## Questions

Discord: `#opendrone-web` channel. Tag `@Stan` for blockers.
