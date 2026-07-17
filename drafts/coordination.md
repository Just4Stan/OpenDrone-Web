# Coordination: live lane registry + task board

The ONLY markdown file in this repo that carries status (Stan, 2026-07-17).
Every other doc states settled facts. Add a lane row before touching code;
update rows on handoff; remove row + worktree when your PR merges. Full git
flow rules in CLAUDE.md.

## Lanes

| Lane | Branch | Worktree | Port | State |
|---|---|---|---|---|
| overhaul-v2 | `feat/ui-overhaul-v2` | `~/OpenDrone-Web-wt/overhaul-v2` | 3006 | Draft PR #285 (TITLE BLOCK re-skin). Needs rebase onto main (post-#286 palette), then Stan's visual review on the preview deployment. |
| wip-banner | `feat/wip-banner` | `~/OpenDrone-Web-wt/wip-banner` | 3008 | In flight: banner becomes "OPENING SOON / Get notified" linking to /newsletter. |

Free ports: 3001-3005, 3007, 3009.

## Stan's tasks

1. Oxygen preview environment: set `PUBLIC_COMING_SOON=0` (and
   `PUBLIC_PRELAUNCH=0`) so the unlocked full shop is browsable on the preview
   URL while production stays locked (view-split decision, 2026-07-17).
2. Oxygen env vars, Production + Preview: `SHOPIFY_WEBHOOK_SECRET`,
   `SHOPIFY_ADMIN_API_TOKEN`. Production notify tagging stays broken until the
   token lands.
3. Activate a payment provider (launch blocker #1; BV verification + bank
   account).
4. Shopify prices: replace placeholders with the vault beta prices (e.g.
   OpenESC 20x20 is EUR 69 in admin vs EUR 24.99 in the vault).
5. www.opendrone.be points at the legacy password-protected store; redirect
   www to the apex/Hydrogen channel.
6. Legal pages final text + privacy-policy processor table (with Iebe; ePrivacy
   verdict on attribution storage belongs to the same pass).
7. Plausible Business tier, then goals/funnels per PR #279's list. Resend:
   verify marketing domain + set `RESEND_MARKETING_FROM` in Oxygen.
8. Copy pass on all `TODO(copy-stan)` and `TODO(copy)` markers, plus the
   banner wording if "OPENING SOON / Get notified" should change.
9. End-to-end test order once payments are live (also confirms which webhook
   fields survive Basic-plan redaction).
10. Review PR #285 visually once rebased; decide merge.

## Agent-ready backlog (claim a lane, work top-down)

- Builder P1: RX + battery slots on the hero (`drafts/drone-builder-scope.md`;
  registry groundwork merged in #268).
- Homepage SEO: `_index.tsx` still uses a plain meta array; convert to
  `buildSeoMeta` (og:image, canonical, JSON-LD).
- Downloads: six `TODO(downloads)` blocks in `product-content.ts`; link the
  hardware repos' production exports.
- Search: family keywords (esc, fc, receiver, frame) so /search?q=esc matches;
  desktop header has no search entry point; predictive search UI unwired at
  1440px.
- `repoUrl` for openframe/openstack points at the GitHub org, not real repos:
  fix or hide.
- QA tail: re-verify the P2/P3 items of `drafts/archive/qa-audit-2026-07-06.md`
  against main (P1s and part of P2 fixed in #269).

## Branch registry notes

- `origin/feat/phase2-thin-surfaces`: backup of a dropped lane (spec-forward
  related cards, pre-#285). Delete once #285 lands.
- `origin/feat/cart-interaction`: pre-#260 integration branch, never merged.
  Delete after confirming nothing in it is still wanted.
- Local `fix/*-review`, `phase2-complete`, `save/my-cart-dupes`: unverified
  leftovers from July agent sessions; `save/my-cart-dupes` holds an
  inline-reveal ShareCartButton variant.
