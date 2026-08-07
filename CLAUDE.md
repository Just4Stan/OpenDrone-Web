# OpenDrone Web: Claude instructions

## Commands
- `npm run dev -- --port <port>`: dev server. Ports 3001-3009 for agent worktrees; 3000 is Stan's.
- `npm run typecheck && npm run lint && npm test`: must pass before any PR merge.
  `npm test` runs the node:test suites in `app/**/*.test.ts` (no framework dep).
- `npm run build`: production build (runs `sync:legal` first).

## Writing rules
- **No em dashes anywhere**: not in docs, site copy, commit messages, or code
  comments. Use commas, colons, hyphens, or middots instead.
- Docs state settled facts only. Status, open questions, and task tracking live
  in exactly one file: `drafts/coordination.md`.

## Git flow: worktree per agent, PRs into protected `main`

`main` is protected: direct pushes are rejected; everything lands via
squash-merged PRs, and Oxygen auto-deploys `main` on merge. **Push after every
commit**; local-only commits never reach opendrone.be.

- **One agent = one worktree = one branch = one dev port.** Claim a lane first:
  `git worktree add ~/OpenDrone-Web-wt/<lane> -b feat/<lane> origin/main`, then
  work ONLY there (`npm ci` once). The main checkout `~/OpenDrone-Web` belongs
  to Stan and the oversight session; don't edit files there if `git status`
  shows work that isn't yours.
- **Check `drafts/coordination.md` before claiming files.** It is the live
  lane registry, file-ownership map, and task board. Update it when you claim,
  hand off, or finish a lane.
- **Hands off other lanes.** Never stash, clean, branch-switch over, or delete
  someone else's WIP; note blockers in coordination.md instead.
- **Commit small; PR early, merge fast**: `gh pr create` once the lane is
  coherent; `gh pr merge --squash --delete-branch` after typecheck + lint pass
  and the change is verified on your own port.
- **Verify UI changes visually, always, before merging**: load every affected
  view on your dev port in the browser, light and dark theme, iterate on the
  design, and show Stan screenshots of the result. Checks passing is not
  verification for anything a user can see.
- **Never squash-merge a branch that redid work already on `main`**: it
  silently reverts main's newer version to the branch's older one.
- **After any merge, every live lane rebases** (`git fetch && git rebase
  origin/main`). Build only against origin/main, never against another lane's
  unmerged branch.
- **Lane done**: merge the PR, `git worktree remove ~/OpenDrone-Web-wt/<lane>`,
  delete the branch.
- Commit trailer: `Co-Authored-By: Claude <your model name> <noreply@anthropic.com>`.

## Project docs: read before starting a lane
- `drafts/coordination.md`: live lane registry + task board. Always check first.
- `drafts/ui-overhaul-brief.md`: design rules, anti-patterns, library verdicts. Before UI work.
- `drafts/theming.md`: full light/dark token contract + gold/green rules. Before touching colors.
- `docs/store-compliance.md`: GPSR, withdrawal, VAT, sanctions, battery-free shipping.
  Before checkout, legal pages, product templates, or shipping/tax config.
- `docs/growth-architecture.md`: analytics/attribution/email/ledger facts + canonical UTM values.
- `drafts/drone-builder-scope.md`: 3D builder phase plan.
- `drafts/archive/`: frozen point-in-time documents. Reference only; never update them.

## Theming (summary)
Light + dark via CSS-custom-property token swap. Semantic tokens only, never
literal colors: dark values live in the Tailwind `@theme` block in
`app/styles/app.css`, light overrides under `html.light` right below. Text on
gold fills uses `--color-on-accent`. Theme init/toggle: `app/lib/theme.ts`.
Token list, gold/green ramps, embed caveats: `drafts/theming.md`.

## Skills
`frontend-design` before building new UI, `verify` before committing nontrivial
changes, `code-review`, `run`. The EDA/hardware skills don't apply to this repo.

## Gotchas
- Hydrogen pins react-router to **7.16.x**: close react-router Dependabot PRs,
  never merge them. Recheck the `vite.config.ts` xstate alias on Hydrogen upgrades.
- `PUBLIC_COMING_SOON` unset = shop locked (no prices, notify-only). Set `=0` in
  your worktree's `.env` to test unlocked flows; never deploy that to production.
- Turnstile never renders on localhost, and `SUPPORT_TURNSTILE_DEV_SKIP=1` is
  only honored when `TURNSTILE_SECRET_KEY` is unset. Comment out the secret
  locally to test notify/support forms.
