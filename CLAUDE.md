# OpenDrone Web — Claude instructions

## Deployment
- Oxygen auto-deploys from this GitHub repo. **Always push after committing** — local-only commits don't reach opendrone.be.
- After every commit, run `git push` (or `git push -u origin <branch>` for feature branches). Don't leave commits sitting locally unless explicitly told "don't push" / "local only".

## Theming (light / dark)
The site supports light and dark. The pattern is the standard CSS-custom-property
token swap — follow it and new UI themes for free.

- **Tokens, not literals.** Every color in CSS or JSX must reference a semantic
  token: `var(--color-bg)`, `--color-bg-card`, `--color-bg-elevated`,
  `--color-text`, `--color-text-muted`, `--color-text-dim`, `--color-border`,
  `--color-border-strong`, `--color-gold` (accent) + `--color-gold-hover`,
  `--color-gold-soft`, `--color-stock`. Never hardcode a hex/rgb for something
  that should change between themes.
- **Text on the gold accent** uses `--color-on-accent` (dark ink in both modes),
  not `--color-bg`. Use it for any filled-gold button/badge/active state.
- **Where the values live** (`app/styles/app.css`): dark is the default in the
  Tailwind `@theme` block; light overrides the same token names under the
  `html.light { … }` block right below it. To retune a color, edit those two
  places only.
- **If a dark literal is unavoidable** (e.g. a load overlay or a backdrop that
  can't be a token), add a matching `html.light .your-selector { … }` twin in
  the light-mode section. Grep `html.light` in app.css for examples.
- **Switching mechanics** (`app/lib/theme.ts`): an inline `<head>` script
  (`THEME_INIT_SCRIPT`, injected in `root.tsx`) resolves the theme before first
  paint — no flash. Resolution order: `localStorage['od-theme']` → OS
  `prefers-color-scheme` → dark. `ThemeToggle` writes the explicit choice and
  live-follows the OS until the visitor toggles. Default with no stored choice
  is the OS preference.
- **Third-party embeds** (Discord widget, Turnstile) can't be CSS-themed.
  Turnstile is passed `getActiveTheme()`; the Discord widget panel is
  intentionally dark in both modes (it frames a dark iframe).
- **Don't** reintroduce `class="dark"`-only assumptions or `prefers-color-scheme`
  media queries for color — the class on `<html>` is the single source of truth.

## Git flow — trunk-based, one tree (READ THIS FIRST)

This repo is a solo project with Oxygen auto-deploying `main`. Past pain came
from many long-lived feature branches all editing the PDP, plus multiple agents
sharing one checkout and switching its branch — work kept getting overwritten.
The rule now: **work on `main`, in one tree, and see it on `localhost:3000`.**

- **Trunk-based, no routine branches.** Pull `main`, edit, watch it live on
  `localhost:3000` (HMR — no deploy needed), `commit` small + focused, `push`.
  Oxygen deploys `main`. That's the whole loop. Do **not** open a feature branch
  for ordinary work — divergence is what caused the overwrites.
- **One agent at a time in this working tree.** Two agents editing the same
  directory race and clobber each other (it has happened). If you genuinely need
  parallel work, give each agent its **own** `git worktree` on its **own** dev
  port (3001/3002) — never two agents in one directory — and merge back the same
  day, then delete the worktree.
- **Never `git checkout <other-branch>` in this tree while work is uncommitted.**
  It yanks the tree out from under whoever is working. Commit or stash first.
- **Never squash-merge a branch that redid work already on `main`** — it silently
  reverts `main`'s newer version to the branch's older one.
- **Keep changes small and ship them fast.** A change that lives a day before
  landing is already at risk of being overwritten by parallel work.
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Always `git push` after committing (see Deployment above).
