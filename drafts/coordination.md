# Coordination: live lane registry + task board

The ONLY markdown file in this repo that carries status (Stan, 2026-07-17).
Every other doc states settled facts. Add a lane row before touching code;
update rows on handoff; remove row + worktree when your PR merges. Full git
flow rules in CLAUDE.md.

## Lanes

| Lane | Branch | Worktree | Port | State |
|---|---|---|---|---|
| overhaul-v2 | `feat/ui-overhaul-v2` | `~/OpenDrone-Web-wt/overhaul-v2` | 3006 | Draft PR #285 (TITLE BLOCK re-skin). Rebased onto main through #305 (2026-07-17): #301 donation removal, #302 reviews, #303 analytics, #304 ShopPay + derived stack copy all preserved under the re-skin. Awaiting Stan's visual review. Review note: the branch's homepage header shows a teal "incutec" wordmark with a "Who's incutec?" tag; confirm intentional. |

Free ports: 3001-3005, 3007-3009.

Merged 2026-07-17, all adversarially reviewed before merge: #301 donation
mechanics removed (product archived in admin), #302 Judge.me reviews
(widget-free, dormant until env vars land), #303 funnel analytics (client
events + server Purchase event + chk: counter), #304 ShopPay button + honest
stack-discount copy (10% off the ESC only; admin discount renamed to match).

## Stan's tasks

1. Oxygen env vars (agent cannot enter secrets): `SHOPIFY_WEBHOOK_SECRET`
   (shown at Settings > Notifications > Webhooks), `SHOPIFY_ADMIN_API_TOKEN`
   (shpat_ from local .env), `JUDGEME_PRIVATE_TOKEN` (Apps > Judge.me >
   Settings > Integrations > API), all secret, Production + Preview; plus
   plain `PUBLIC_JUDGEME_SHOP_DOMAIN` = ktjqug-jw.myshopify.com. Also confirm
   Judge.me's metafield sync is on.
2. Activate a payment provider (launch blocker #1). Then: Bancontact manual
   activation, add PayPal for the German market, iDEAL after the ~100-order
   eligibility gate.
3. Belgian VAT registration: Settings > Taxes and duties > European Union >
   "Collect VAT" next to Belgium, VAT BE 1038.934.039 (agent hit an admin 404
   twice; retry from a normal session).
4. Shipping zones per `drafts/archive/sendcloud-shipping-research-2026-07-17.md`:
   tune to the Sendcloud rate card incl. 21% VAT, add a pickup-point method
   per zone, lower rest-of-EU home to ~7.95, ADD the missing rest-of-world
   zones (UK ~12-15, US/CA ~18-25, RoW ~25-30 tracked). Dynamic rates are
   unavailable on Basic and not worth chasing.
5. Flow templates in your own browser (the Flow iframe rejects automation):
   "Get notified when product variant inventory is low" and "Hold orders if
   high fraud risk". Note: the three existing "Recover abandoned cart/checkout"
   Flow workflows likely never fire for Hydrogen-channel checkouts; the DIY
   abandoned-checkout emailer in the backlog is the real fix.
6. Launch discount: pick percentage/scope/dates, then create as an automatic
   discount (check combination rules against "OpenESC -10% with OpenFC").
7. Email domain auth: sender is sales@incutec.eu but domain authentication
   "Needs setup" (emails fall back to shopifyemail.com). Add the DKIM/DMARC
   records at the DNS host, then customize notification templates (logo,
   colors).
8. Plausible: Business tier, then add the goals/funnels listed in
   `drafts/analytics-brief.md` and PR #303.
9. Prices still unreviewed in admin: OpenFrame 5"/3" (41/35) and accessories.
10. Legal pages final text + privacy processor table (with Iebe).
11. Copy pass on TODO(copy-stan) markers + banner wording.
12. End-to-end test order once payments live (also validates the Purchase
    event path end-to-end and webhook field redaction).
13. Review PR #285 visually after its rebase; decide merge.

## Agent-ready backlog (claim a lane, work top-down)

- DIY abandoned-checkout recovery: Admin API poll for abandoned checkouts
  (abandonedCheckoutUrl) + Resend email; blocked on SHOPIFY_ADMIN_API_TOKEN
  in Oxygen (task 1).
- Back-in-stock notify: PDP form into the signup ledger +
  inventory_levels/update webhook + Resend.
- Post-purchase one-click "why did you buy / where from" email survey and
  optional exit-intent prompt: specced in `drafts/analytics-brief.md`;
  survey blocked on task 1.
- First-party review submission form (POST /reviews via app/lib/reviews.ts).
- Builder P1: RX + battery slots on the hero (`drafts/drone-builder-scope.md`).
- Homepage SEO: `_index.tsx` plain meta array to `buildSeoMeta`.
- Downloads: six TODO(downloads) blocks in product-content.ts.
- Search: family keywords; desktop header search entry; predictive search UI.
- `repoUrl` for openframe points at the GitHub org: fix or hide.
- Optional later: Sendcloud rate-card sync script (weight-banded zone rates
  via deliveryProfileUpdate), only if orders start crossing weight bands.
- QA tail: re-verify P2/P3 items of `drafts/archive/qa-audit-2026-07-06.md`.

## Branch registry notes

- `origin/feat/phase2-thin-surfaces`: backup of a dropped lane. Delete once
  #285 lands.
- `origin/feat/cart-interaction`: pre-#260 integration branch, never merged.
  Delete after confirming nothing in it is still wanted.
- Local `fix/*-review`, `phase2-complete`, `save/my-cart-dupes`: unverified
  leftovers from July agent sessions.
