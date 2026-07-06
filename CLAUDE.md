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
  `--color-gold-soft`, `--color-gold-fill` + `--color-gold-fill-hover`,
  `--color-stock`. Never hardcode a hex/rgb for something that should change
  between themes.
- **Two golds.** `--color-gold` is for gold TEXT/icons/borders sitting on page
  backgrounds — it must hold AA 4.5:1 in light mode, which forces it deep.
  `--color-gold-fill` (+ `-hover`) is for FILLED surfaces — buttons, badges,
  active pills, the wordmark — and stays bright true gold in light mode. Any
  rule that paints `background: gold` with ink on top takes the fill token,
  never `--color-gold`. The two are identical in dark mode; they split only
  in light.
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

## Git flow — worktree per agent, PRs into protected `main` (READ THIS FIRST)

`main` is protected on GitHub: direct pushes are **rejected**; everything lands
via squash-merged PRs, and Oxygen deploys `main` on merge. Multiple Claude
agents routinely work this repo in parallel (each in its own terminal). The
2026-07-06 pile-up — reverted edits, deleted untracked files, branches switched
under a running editor — all came from agents sharing one checkout. Hence:

- **One agent = one worktree = one branch = one dev port.** Before touching
  code, claim a lane:
  `git worktree add ~/OpenDrone-Web-wt/<lane> -b feat/<lane> origin/main`
  then work ONLY inside that directory (`npm ci` once, then
  `npm run dev -- --port <port>`; ports 3001–3009, pick one nobody's using).
  The main checkout `~/OpenDrone-Web` (port 3000) belongs to Stan and the
  oversight/integration session — don't edit files there if `git status`
  shows work that isn't yours.
- **Hands off other lanes.** Never `git stash`, `git clean`, `checkout`/
  `switch`, or delete untracked files over someone else's WIP — if something
  blocks you, note it in the active brief's coordination section instead.
- **Commit small, push after every commit** (`git push -u origin feat/<lane>`).
- **PR early, merge fast**: `gh pr create` once the lane is coherent;
  `gh pr merge --squash --delete-branch` after `npm run typecheck && npm run
  lint` pass and the change is verified on your own port. Small PRs measured
  in hours, not days.
- **Never squash-merge a branch that redid work already on `main`** — it
  silently reverts `main`'s newer version to the branch's older one.
- **After any PR merges: every live lane rebases** — `git fetch && git rebase
  origin/main`. Build only against `origin/main`, never against another
  lane's unmerged branch; if you need unmerged work, get it merged first.
- **Coordination map**: the active project brief (currently
  `drafts/ui-overhaul-brief.md`, section "Coordination — LIVE") holds the
  lane registry and file-ownership map. Check it before claiming files;
  update it when you claim or finish a lane.
- **When a lane is done**: merge the PR, then
  `git worktree remove ~/OpenDrone-Web-wt/<lane>` and delete the branch.
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Always `git push` after committing (see Deployment above).
