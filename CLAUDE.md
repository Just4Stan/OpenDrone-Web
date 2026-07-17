# OpenDrone Web — Claude instructions

## Deployment
- Oxygen auto-deploys from this GitHub repo. **Always push after committing** — local-only commits don't reach opendrone.be.
- After every commit, run `git push` (or `git push -u origin <branch>` for feature branches). Don't leave commits sitting locally unless explicitly told "don't push" / "local only".

## Compliance
- `docs/store-compliance.md` is the storefront compliance reference: product-listing content (GPSR),
  consumer-law machinery (14-day withdrawal + the mandatory withdrawal button, 2-year guarantee),
  privacy/cookies, VAT display, sanctions country-blocks, and the battery-free shipping rule. Read it
  before building checkout, legal pages, product templates, or shipping/tax config.

## Project docs — read before starting a lane
- `drafts/coordination.md` — **LIVE lane registry + pending decisions.** Check it before claiming
  files; update it when you claim, hand off, or finish a lane.
- `drafts/ui-overhaul-brief.md` — design rules, reference set, anti-patterns, library verdicts.
  Read before touching UI. (Its coordination section is frozen — use `coordination.md`.)
- `drafts/growth-infra-brief.md` — analytics/attribution/email/ledger architecture. Lanes A–E
  merged; Lane F (OpenBrain CRM) is blocked on EU hosting — don't start it.
- `drafts/drone-builder-scope.md` — 3D drone-builder phase plan; P1 groundwork merged (#268).
- `drafts/launch-plan-2026-07-02.md` — launch blockers, business + code. Target: September 2026.
- `drafts/shopify-state.md` — Shopify admin state + task queue. Update it after every admin run.
- `drafts/utm-conventions.md` — canonical UTM values for any outbound link we control.
- `drafts/qa-audit-2026-07-06.md` — E2E/UX audit; P1s fixed in #269, tail items may remain.

## Skills
For work in this repo, the relevant Claude Code skills are `frontend-design` (load before
building new UI), `verify` (before committing nontrivial changes), `code-review`, and `run`.
The EDA/hardware skills (kicad, bom, jlcpcb, …) do not apply here.

## Dependencies
- Hydrogen pins react-router to **7.16.x** — close react-router Dependabot PRs on sight,
  never merge them. Recheck the `vite.config.ts` xstate alias hack on every Hydrogen upgrade.

## Local dev gotchas
- `PUBLIC_COMING_SOON` unset = shop **locked** (no prices, notify-only). Set `=0` in your
  worktree's `.env` to test unlocked commerce flows; never commit or deploy that.
- Turnstile never renders on localhost, and `SUPPORT_TURNSTILE_DEV_SKIP=1` is only honored
  when `TURNSTILE_SECRET_KEY` is **unset** (`app/lib/support/turnstile.ts`) — with both set,
  every notify/support submit fail-closes with a 400. Comment out the secret locally to test forms.

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
- **⚠️ Palette decision pending (2026-07-17):** PR #286 proposes a new brand palette
  (`#fdb600` gold + PCB green) and reverts the gold-on-black chips. If it merges, the two
  gold bullets below change — check `drafts/coordination.md` before starting gold/theming work.
- **Gold rules (Stan, 2026-07-06).** One light gold: `#dab040` in light mode
  (text AND fills), `#c89d2e` base in dark. A darker "AA-safe" gold reads
  brown on white — do NOT walk light gold back down to a dark amber.
- **Gold text is always gold-on-black.** Dark mode gets this for free; in
  light mode every gold label/badge/eyebrow sits on a near-black tag chip
  (`--color-tag-bg`, see the "Gold tags — light mode" section in app.css).
  Adding a new gold label? Add its selector to that section, or put the
  `gold-tag` class on it in JSX. Deliberate exceptions (plain gold, no
  chip): inline headline accent words and hover states — below AA on
  white, accepted.
- **`--color-gold-fill` (+ `-hover`)** is still the token for FILLED
  surfaces (buttons, active pills, the wordmark) with `--color-on-accent`
  ink on top; `background: gold` never takes `--color-gold`.
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
- **Coordination map**: `drafts/coordination.md` holds the lane registry,
  file-ownership map, and pending decisions. Check it before claiming files;
  update it when you claim or finish a lane.
- **When a lane is done**: merge the PR, then
  `git worktree remove ~/OpenDrone-Web-wt/<lane>` and delete the branch.
- Commit message trailer: `Co-Authored-By: Claude <your model name> <noreply@anthropic.com>`
  (e.g. `Claude Fable 5`).
- Always `git push` after committing (see Deployment above).
