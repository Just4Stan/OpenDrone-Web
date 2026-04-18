# Contributing to OpenDrone Web

Read [SCOPE.md](SCOPE.md) before starting — it lists what's open for redesign, locked, and forbidden.

## Stack

Shopify Hydrogen 2026.x on Oxygen · React Router 7 (file-based routes in `app/routes/`) · Tailwind CSS v4 (tokens in `app/styles/app.css`) · react-three-fiber hero · TypeScript strict · Plausible analytics (cookieless, no banner).

## Prerequisites

Node 22 or 24, npm 10+, Shopify dev-store credentials (pinned in `#opendrone-web` on [Discord](https://discord.gg/v3sWmTcx3R)).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server + codegen |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Serve production bundle locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Storefront API types |
| `npm run sync:legal` | Refresh legal Markdown snapshots |

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

## Design tokens — use them

Every color, font, and spacing value is in `app/styles/app.css` under `@theme`. Use `var(--color-gold)`, `var(--color-bg)`, `font-mono`, etc. Don't hardcode.

Core: `--color-bg #0a0a0a`, `--color-bg-card #101210`, `--color-text #e5e5e5`, `--color-text-muted #737373`, `--color-gold #b8922e`, `--color-accent #1f4d2c`. Fonts: Space Grotesk (display), Inter (sans), JetBrains Mono.

## Workflow

1. Pick an [open issue](https://github.com/Just4Stan/OpenDrone-Web/issues?q=is%3Aopen+label%3A%22good+first+issue%22) or open a Design proposal.
2. Branch from fresh `main`: `<type>/<topic>` where type is `design`, `feat`, `fix`, `chore`, `refactor`, `docs`.
3. Commit with DCO sign-off: `git commit -s -m "subject"`. Subject ≤60 chars, imperative mood.
4. Verify: `npm run lint && npm run typecheck && npm run build`.
5. Push and open PR with `gh pr create --web`. CI runs lint + typecheck + build; CODEOWNERS review required for locked paths.
6. Address feedback with new commits (don't force-push during review). Stan squash-merges.

Forgot `-s`? `git commit --amend -s --no-edit && git push --force-with-lease`.

## Rules

- Lint + typecheck must pass — fix locally, not in CI.
- No new npm deps without asking — open an issue first (supply-chain risk).
- Mobile-first (design at 375px, enhance at 768px and 1440px).
- WCAG 2.1 AA baseline — semantic HTML, alt text, keyboard nav, ≥4.5:1 contrast.
- Bundle additions >50KB gzipped need justification.
- No `console.log` in prod — strip or guard with `if (import.meta.env.DEV)`.
- No hand-edits to `app/content/legal/**`.
- Dependabot runs weekly — don't duplicate its PRs.

## Where to ask

- `#opendrone-web` on [Discord](https://discord.gg/v3sWmTcx3R) for questions
- Design proposal issue before large redesigns
- Security issues: see [SECURITY.md](SECURITY.md), do not open a public issue
