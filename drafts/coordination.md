# Coordination — LIVE lane registry

*The single source of truth for parallel-agent coordination. Supersedes the
"Coordination — LIVE" sections in `drafts/ui-overhaul-brief.md` and
`drafts/growth-infra-brief.md` (frozen 2026-07-07, kept as history).
Claim a lane by adding a row BEFORE touching code; update your row on every
handoff; remove worktree + row when your PR merges. Full git-flow rules in
`CLAUDE.md`.*

Last refreshed: 2026-07-17 (oversight session).

## Active lanes / worktrees

| Lane | Branch | Worktree | Port | State |
|---|---|---|---|---|
| overhaul-v2 | `feat/ui-overhaul-v2` | `~/OpenDrone-Web-wt/overhaul-v2` | 3006? | Draft PR **#285** (full TITLE-BLOCK re-skin), 15 commits, 0 behind main, mergeable. **Waiting on Stan's visual review.** Interacts with #286 — see decisions. |
| palette | `feat/palette` | `~/OpenDrone-Web-wt/palette` | 3007? | PR **#286** (brand palette `#fdb600` gold + PCB green, **reverts the gold-on-black chips from #283**), mergeable. **Waiting on Stan's decision** — contradicts CLAUDE.md "Gold rules"; whichever way it goes, update CLAUDE.md's theming section in the same PR. |
| phase2 | `feat/phase2-thin-surfaces` | `~/OpenDrone-Web-phase2` (nonstandard path) | — | STALE: 1 commit (spec-forward related cards), 24 behind main, no PR. Rebase-and-land or fold into overhaul-v2, else drop. |
| builder-p1 | `feat/builder-p1` | `~/OpenDrone-Web-wt/builder-p1` | — | EMPTY: 0 ahead of main (groundwork merged as #268). Worktree + branch can be removed. |

Ports: 3000 = main checkout (Stan + oversight only). 3001–3005 freed when the
growth lanes merged. Pick a free one and note it here.

## Pending decisions (Stan)

1. **Palette direction** — #286 (`#fdb600` + green, no gold-on-black chips) vs
   the merged #283 gold-on-black system that CLAUDE.md currently codifies.
   Blocks: any new gold/theming work, and #285's final form.
2. **Overhaul #285** — review the re-skin on the preview deployment; decide
   merge order vs #286 (palette first, then rebase overhaul, is the cheaper order).
3. **Shopify prices** — admin still holds placeholders (OpenESC €69/€75 vs vault
   €24.99/€29.99, see `drafts/shopify-state.md`). Must be real before the
   pre-launch banner drops.
4. **phase2-thin-surfaces branch** — land or drop (see table).

## Merged / closed history (recent)

- Growth infra Lanes A–E all merged: #277 (GPSR block), #279+#281 (analytics +
  attribution + orders/paid webhook), #282 (Resend email automation), #284
  (notify micro-survey), #280 (USP pages). Lane F (OpenBrain CRM) is blocked on
  OpenBrain EU hosting + DPA — do not start (see `drafts/openbrain-crm-scope.md`).
- QA-audit fix wave merged as #269; gold/theming waves #274/#276/#278/#283.
- Builder Phase-1 groundwork (parts registry + slot-map hero, behavior-identical)
  merged as #268 — `drafts/drone-builder-scope.md` P1 continues from there.

## Dependabot queue (2026-07-17)

- **Close #287** (react-router 7.18 group) — Hydrogen pins RR to 7.16.x.
- #288–#292 (dev-deps group, lucide, isbot, auto-animate, setup-node): fine to
  merge after CI passes, one agent, sequentially, rebasing between merges.

## Stan's manual follow-ups (accumulated from merged lanes)

1. Oxygen env vars (Production+Preview): `SHOPIFY_WEBHOOK_SECRET`,
   `SHOPIFY_ADMIN_API_TOKEN` — prod notify tagging stays broken until set
   (details in `drafts/growth-infra-brief.md` §follow-ups).
2. Plausible → Business tier, then configure goals/funnels (list in PR #279).
3. Resend: verify marketing send domain + `RESEND_MARKETING_FROM` in Oxygen.
4. Copy passes on all `TODO(copy-stan)` markers (survey, USP pages, Discord runbook).
5. Legal (Iebe, due 2026-07-18): attribution-storage ePrivacy verdict +
   privacy-policy processor table (Resend marketing, Upstash ledger).
6. Adopt `drafts/utm-conventions.md` links in every video description / Discord post.
7. Test order once payments are live (confirms webhook field redaction too).
