# Contributing to OpenDrone Web

Thanks for helping build the OpenDrone storefront. Before starting design work, read [SCOPE.md](SCOPE.md) to know what's open, locked, and off-limits.

## Tech stack

- **Shopify Hydrogen** (2026.x) — React storefront on Shopify's Oxygen runtime
- **React Router 7** — file-based routing under `app/routes/`
- **Tailwind CSS v4** — utility-first styling, design tokens in `app/styles/app.css`
- **react-three-fiber** — 3D hero scene (`app/components/HeroScene.tsx`)
- **TypeScript**, strict mode
- **Plausible** — analytics (cookieless, no consent banner)

## Prerequisites

- Node 20+ (LTS) — `node --version`
- npm 10+ — `npm --version`
- Git with SSH or HTTPS access to GitHub
- Shopify dev-store credentials — pinned in `#opendrone-web` on [Discord](https://discord.gg/v3sWmTcx3R)

## Getting started

```sh
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/OpenDrone-Web.git
cd OpenDrone-Web

# 2. Add the upstream remote so you can pull in main
git remote add upstream https://github.com/Just4Stan/OpenDrone-Web.git

# 3. Install and configure
npm install
cp .env.example .env
# Fill in the dev-store tokens (shared separately, not in this repo)

# 4. Run it
npm run dev
```

Dev server runs at **http://localhost:3000**. Hot reload is on.

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server with live codegen |
| `npm run build` | Production build (runs `sync:legal` first) |
| `npm run preview` | Build + serve the production bundle locally |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript + React Router typegen |
| `npm run codegen` | Regenerate Shopify Storefront API types |

Run `lint` and `typecheck` before every PR. CI will reject otherwise.

## Project layout

```
app/
  routes/           # file-based routes (React Router 7 conventions)
  components/       # shared React components
  styles/app.css    # Tailwind v4 + design tokens under @theme
  content/legal/    # committed legal Markdown — do not hand-edit
  graphql/          # Storefront API queries
  lib/              # helpers (i18n, SEO, company, context)
public/             # static assets (3D models, OG images, PDFs)
scripts/            # build-time scripts (legal sync, etc.)
.github/            # CI, Dependabot, PR/issue templates, CODEOWNERS
```

## Design tokens — use them, don't hardcode

Every color, font, and spacing value lives in `app/styles/app.css` under `@theme`. Reach for tokens, not literals.

Core tokens:

- `--color-bg` `#0a0a0a` — page background
- `--color-bg-card` `#101210` — card surfaces
- `--color-text` `#e5e5e5` — body copy
- `--color-text-muted` `#737373` — secondary copy
- `--color-gold` `#b8922e` — brand accent, used sparingly
- `--color-accent` `#1f4d2c` — dark green, secondary brand color
- `--font-display` Space Grotesk — headings
- `--font-sans` Inter — body copy
- `--font-mono` JetBrains Mono — technical specs, uppercase labels

In Tailwind: `bg-[var(--color-bg)]`, `text-[var(--color-gold)]`, `font-mono`, etc.

## The full contribution workflow

### 1. Find (or propose) an issue

Browse [open issues labeled `good first issue`](https://github.com/Just4Stan/OpenDrone-Web/issues?q=is%3Aopen+label%3A%22good+first+issue%22) or `design:open`. Comment to claim one.

Don't have an issue? Open a **Design proposal** (`.github/ISSUE_TEMPLATE/design_proposal.md`) before writing code. Aligns the idea with [SCOPE.md](SCOPE.md) and saves wasted effort.

### 2. Branch from a fresh `main`

```sh
git checkout main
git pull upstream main
git checkout -b design/short-topic     # or fix/, feat/, chore/
```

Branch name format: `<type>/<short-topic>`. Types: `design`, `feat`, `fix`, `chore`, `refactor`, `docs`.

### 3. Work in small, signed commits

```sh
git add <specific files>
git commit -s -m "short imperative subject"
```

- `-s` signs off per the [DCO](https://developercertificate.org/). Required.
- Subject ≤ 60 chars, imperative mood ("Add cart empty state" not "Added..."). Match existing commit style — look at `git log --oneline` for examples.
- Body (optional): explain *why*, not *what*. The diff shows what.

### 4. Verify locally before pushing

```sh
npm run lint && npm run typecheck && npm run build
```

If any of those fail, CI will fail. Fix locally — it's faster.

### 5. Open the PR

```sh
git push origin design/short-topic
gh pr create --web       # opens a browser with the PR template
```

The PR template asks for:

- What changed and why (link the issue)
- Scope check — confirm you're not touching locked areas
- Screenshots for visual changes (mobile + desktop)
- Checklist: lint, typecheck, build, manual verification

### 6. Review round-trip

Every PR gets:

1. **CI run** (lint + typecheck + build) — must pass
2. **Preview deploy** via Oxygen — a live URL appears as a status check
3. **Code Owner review** from Stan — direct, critical feedback. Not personal.
4. **Conversation resolution** — every review comment must be resolved before merge

Address feedback with new commits on the same branch (don't force-push during review — reviewers lose context). Once approved, Stan squash-merges.

### 7. After merge

Your branch is auto-deleted. Pull the updated main and start the next one.

```sh
git checkout main
git pull upstream main
```

## Coding standards

- **Lint + typecheck must pass.** No exceptions — fix locally, not in CI.
- **Prefer Tailwind over new CSS.** If a utility doesn't exist, extend the theme rather than writing ad-hoc CSS.
- **No new npm dependencies without asking.** Open an issue first. Supply-chain risk is real on public repos.
- **Mobile-first.** Design at 375px, enhance at 768px and 1440px.
- **Accessibility.** Real HTML semantics, alt text on every image, keyboard navigation works, WCAG AA contrast.
- **Performance.** Large bundle-size additions (>50KB gzipped) need justification. Run `npm run build` and check the output size before PR.
- **No `console.log` in production code.** Strip or guard with `if (import.meta.env.DEV)`.
- **No hardcoded copy for legal pages.** Legal text is synced from `app/content/legal/` — see [SCOPE.md](SCOPE.md).

## What happens if a PR touches a locked area

CODEOWNERS auto-requests Stan's review for legal, compliance, and infra paths. Branch protection blocks merge until Stan approves. If you accidentally touch a locked file, expect Stan to ask you to revert it — not a judgment, just policy.

Locked paths are listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) and expanded in [SCOPE.md](SCOPE.md).

## Commit sign-off (DCO) — required

Every commit must end with a `Signed-off-by:` trailer. `git commit -s` adds it.

This certifies the [Developer Certificate of Origin](https://developercertificate.org/) — you confirm you wrote the code or have the right to contribute it under MIT.

If you forgot `-s` on a commit in an open PR:

```sh
git commit --amend -s --no-edit && git push --force-with-lease
```

## Dependencies

- **Dependabot runs weekly** — security and version bumps are auto-PR'd. Don't duplicate.
- **Manual dependency additions** require an issue and explicit approval in the thread before the PR.
- **Lockfile changes** (`package-lock.json`) from any source other than `npm install` are a red flag — don't hand-edit.

## License

All contributions are licensed under MIT (see [LICENSE](LICENSE)).

## Where to ask

- **Quick question**: `#opendrone-web` on [Discord](https://discord.gg/v3sWmTcx3R)
- **Blocked**: tag `@JustFPV` in Discord
- **Design direction**: open a Design proposal issue before coding
- **Security vulnerability**: see [SECURITY.md](SECURITY.md), **do not open a public issue**
