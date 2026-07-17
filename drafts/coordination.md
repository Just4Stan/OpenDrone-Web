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

1. Oxygen env vars (agent cannot enter secrets): add `SHOPIFY_WEBHOOK_SECRET`
   (value shown at Settings > Notifications > Webhooks, "signed with" line;
   mark secret, Production + Preview) and `SHOPIFY_ADMIN_API_TOKEN` (the
   shpat_ value from local .env; mark secret, Production + Preview).
   Production notify tagging stays broken until the token lands.
2. Activate a payment provider (launch blocker #1; BV verification + bank
   account).
3. Prices still unreviewed in admin: OpenFrame 5"/3" (EUR 41/35) and the
   accessories (strap 4.50, antenna 6/7, hw kit 3/5, spares 8-24). Boards were
   set to Stan's 2026-07-17 numbers, see Done note below.
4. Stack discount math: the automatic discount gives 10% off the ESC only, so
   FC+ESC 20x20 checks out at 66,50. Stan's target (63 / 72) means 10% off the
   pair; decide and reconfigure the automatic discount (or accept 66,50/76,50).
5. Belgian VAT registration: Settings > Taxes and duties > European Union >
   "Collect VAT" next to Belgium, VAT number BE 1038.934.039. The agent's
   attempt hit a Shopify admin 404 on the add-registration route (twice);
   retry from a normal session. OSS already collects in 26 regions.
6. Legal pages final text + privacy-policy processor table (with Iebe; ePrivacy
   verdict on attribution storage belongs to the same pass).
7. Plausible Business tier, then goals/funnels per PR #279's list. Resend:
   verify marketing domain + set `RESEND_MARKETING_FROM` in Oxygen.
8. Copy pass on all `TODO(copy-stan)` and `TODO(copy)` markers, plus the
   banner wording if "OPENING SOON / Get notified" should change.
9. End-to-end test order once payments are live (also confirms which webhook
   fields survive Basic-plan redaction).
10. Review PR #285 visually once rebased; decide merge.

Done 2026-07-17 (agent, browser): Preview env unlocked (`PUBLIC_COMING_SOON=0`
+ `PUBLIC_PRELAUNCH=0`, Preview only); board prices set to Stan's numbers
(OpenFC Lite 35/35; OpenESC 35/45; OpenRX Lite 18, Lite-UFL 20, Mono 25,
Gemini 35, all verified saved); www.opendrone.be retargeted to Hydrogen
Production, 301 to apex verified; OpenStack confirmed archived; untaxed
variants confirmed to be only the four firmware-donation tiers (deliberate).

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
