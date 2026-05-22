# Operations

Scripts, tests, CI, and how the site ships.

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
| `npm run gen:board-art` | Export every board in `scripts/boards.config.json` to `public/boards/<handle>/board.svg` (needs KiCad CLI + `pcbnew`) |

Standalone scripts (not in `package.json`):

- `scripts/smoke.mjs` — hits 25+ routes against a base URL and asserts status + content invariants. `BASE=https://opendrone.be node scripts/smoke.mjs`.
- `scripts/smoke-recursive.mjs` — recursive crawl smoke; deeper than `smoke.mjs`.
- `scripts/export-board-art.mjs <kicad_pcb> <handle>` — one-off board-art export (the `--all` form is wrapped by `gen:board-art`); calls `scripts/board-outline.py` under KiCad's bundled Python. See [Board art pipeline](architecture.md#board-art-pipeline).
- `scripts/gen-wordmark-assets.mjs`, `scripts/gen-wordmark-from-png.mjs` — regenerate the hero wordmark glyph data (`app/data/wordmark.ts`) and `public/opendrone-wordmark.svg`.

## Tests

Unit tests run on Node's built-in test runner (no extra deps):

```sh
node --experimental-strip-types --test app/lib/support/*.test.ts
```

## CI / branch protection

`.github/workflows/ci.yml` runs three jobs on every PR + push to `main`: Lint, Typecheck, Build (with stub env). All three must pass — branch protection on `main` requires them green, plus 1 approval, plus Code Owner review (`CODEOWNERS`), plus conversation resolution, plus linear history. Force-push and delete are blocked.

Dependabot runs weekly (Monday), groups by `@shopify/*`, `react-router*`, and devDeps; ignores major-version bumps.

`oxygen-deployment-1000116751.yml` is the Shopify-managed Oxygen deploy workflow (one per linked storefront). Pushes to `main` trigger an Oxygen build + deploy; PR branches get preview URLs as a status check.

`support-cleanup.yml` runs daily at 03:17 UTC — see the [support bridge](architecture.md#support-bridge).

## Deployment

Oxygen auto-deploys from this repo. Every push to `main` → ~2 min build + deploy. Every PR → preview URL.

Monitor in Shopify admin → Hydrogen → storefront → Deployments.

**Manual emergency deploy.** `npx shopify hydrogen deploy` ships the local tree directly, bypassing CI and git history. Use only when the CD path is broken.

**DNS.** Web records:

- `A @` → `23.227.38.65`
- `CNAME www` → `shops.myshopify.com.` (trailing dot matters)

Mail (MX + DKIM + DMARC + SPF) lives on the email provider — do not modify those records when Shopify asks for SPF changes; merge into a single TXT instead.
