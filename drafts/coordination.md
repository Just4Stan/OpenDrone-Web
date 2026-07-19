# Coordination: live lane registry + task board

The ONLY markdown file in this repo that carries status (Stan, 2026-07-17).
Every other doc states settled facts. Add a lane row before touching code;
update rows on handoff; remove row + worktree when your PR merges. Full git
flow rules in CLAUDE.md.

## Lanes

| Lane | Branch | Worktree | Port | State |
|---|---|---|---|---|
| (none active) | | | | |

Free ports: 3001-3002, 3004-3009.

Merged 2026-07-18: #313 launch-prep for the OpenRX video (SEO share
previews: absolute og:image + canonicals + home title; copy audit fixes:
visible em dashes out, OpenFrame lead de-hyped, welcome-email display
titles, frame variant taglines; `npm test` now runs the 8 existing
node:test files, 125 tests green, and is part of the merge gate).
Notify flow verified end-to-end on production 2026-07-18 in a real
browser: Turnstile passes, signup succeeds, survey renders. The welcome
email does NOT arrive (see Stan task 13).

Dropped 2026-07-17: the ui-overhaul-v2 lane (draft PR #285, TITLE BLOCK
re-skin). Stan rejected the re-skin on visual review; main's current UI is
canon. Two fixes were salvaged onto main before deletion (locale-prefixed
menu URLs leaking Home/Catalog/Contact into the desktop nav, and the PDP
buy-column breathing-room pass). The closed PR keeps the commits if anything
else ever needs digging out.

Merged 2026-07-17, all adversarially reviewed before merge: #301 donation
mechanics removed (product archived in admin), #302 Judge.me reviews
(widget-free, dormant until env vars land), #303 funnel analytics (client
events + server Purchase event + chk: counter), #304 ShopPay button + honest
stack-discount copy (10% off the ESC only; admin discount renamed to match),
#310 sitewide performance pass (hero build-pipeline time-slicing, CSS-var
scroll drive, viewer pre-mounts, FrameViewer outline merge, pending
affordances; measured with the new scripts/perf-audit.mjs harness at 1x and
4x CPU against the production preview: home first scroll 46→120fps at 1x,
24→~120fps at 4x, PDP worst scroll frame 359→25ms, no visual changes).

Done 2026-07-18 (browser/infra session, no lane): domain migration to
**opendrone.store** as canonical. opendrone.store + opendrone.shop bought at
Gandi (Stan), DNS mirrors opendrone.be (A 23.227.38.65, www CNAME
shops.myshopify.com). All five hostnames sit on the Hydrogen storefront;
opendrone.store is primary, the rest 301 to it. Turnstile was re-keyed: the
old widget's Cloudflare account is lost; a new widget "OpenDrone storefront"
lives in Stan's new Cloudflare account (stan.coene@gmail.com), hostnames
opendrone.{store,shop,be}; new site/secret keys are in Oxygen (Prod+Preview)
and local .env; production redeployed and the notify form verified on
opendrone.store. The admin "Order payment" webhook URL was updated to
https://opendrone.store/api/webhooks/shopify. PR #(this) swaps every site
URL in the repo to opendrone.store (emails stay @opendrone.be); the
compliance repo still says opendrone.be and needs the same swap at next
sync.

## Stan's tasks

0. Log into plausible.io in Chrome so the agent can change the site domain
   opendrone.be -> opendrone.store (Site settings > General). Until then the
   deployed data-domain=opendrone.store events are dropped by Plausible.
1. Oxygen env vars: DONE except Judge.me private token.
   `SHOPIFY_ADMIN_API_TOKEN` + `SHOPIFY_WEBHOOK_SECRET` landed
   2026-07-19 (Stan pasted; agent staged, redeployed, verified).
   Verified in production: /newsletter/unsubscribe flips Shopify
   emailMarketingConsent (test alias UNSUBSCRIBED, fresh
   consentUpdatedAt), webhook receiver authenticates (unsigned 401,
   HMAC-signed synthetic inventory_levels/update 200 through the
   back-in-stock handler; real sends stay blocked by the coming-soon
   guard until launch, by design). orders/paid attribution deliveries
   are authenticated from now on too. `PUBLIC_JUDGEME_SHOP_DOMAIN` =
   ktjqug-jw.myshopify.com added (plain value, agent). Remaining, Stan
   only: `JUDGEME_PRIVATE_TOKEN` (Apps > Judge.me > Settings >
   Integrations > API) + confirm Judge.me metafield sync. NOTE: Stan
   pasted the shpat_ admin token into an agent chat 2026-07-19; rotate
   it when convenient (Dev Dashboard) and update .env + Oxygen.
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
7. Email domain auth: DONE 2026-07-18 (agent). The 6 Shopify CNAME
   records live on incutec.eu at Gandi, verified on the authoritative
   NS; Shopify status "Propagating", flips to Authenticated on its own
   (up to 48 h). Notification templates were already customized.
8. Plausible: Business tier, then add the goals/funnels listed in
   `drafts/analytics-brief.md` and PR #303.
9. Prices still unreviewed in admin: OpenFrame 5"/3" (41/35) and accessories.
10. Legal pages final text + privacy processor table (with Iebe).
11. Copy pass on TODO(copy-stan) markers + banner wording.
12. End-to-end test order once payments live (also validates the Purchase
    event path end-to-end and webhook field redaction).
13. VIDEO BLOCKER: notify signups get no welcome email. Verified 2026-07-18
    with a real production signup (stan.coene+openrx-launchtest@gmail.com,
    still absent after 30+ min incl. spam). RESEND_API_KEY is empty even in
    the local .env, so it was never provisioned. Create the Resend API key,
    verify the sending domain in Resend (pairs with task 7 DKIM), set
    RESEND_API_KEY in Oxygen (Production + Preview), then delete the test
    signup or leave it, it is Stan's own alias. Signups are not lost
    meanwhile: they land as Shopify customers with the notify tag.
14. VIDEO BLOCKER: OpenRX PDP has zero downloads (every card 404'd, so the
    chapter is hidden; TODO(downloads) at product-content.ts). Video viewers
    will want schematic.pdf / BOM / STEP. Publish the artifacts to the
    OpenRX repo releases, then fill the six TODO(downloads) blocks.
15. Shopify admin image alt texts use em dashes ("OpenRX Gemini, front");
    swap for hyphens or middots in admin when convenient.
16. Back-in-stock notify shipped 2026-07-18 (took over the parked lane;
    zero WIP existed). inventory_levels/update -> notify-<handle> Resend
    broadcast, ACTIVE + not-coming-soon + 7-day cooldown latch guards,
    dormant-safe without env. TO ACTIVATE: register the
    inventory_levels/update webhook at Settings > Notifications >
    Webhooks (same receiver URL), confirm the custom-app token has
    read_products, and land SHOPIFY_ADMIN_API_TOKEN in Oxygen (task 1).
17. No OpenFrame repo exists in incutec-hw, so the frame PDP's GitHub chip
    links to the org. Publish the frame CAD repo, then set `repoUrl` in
    product-content.ts. Task 14 is partially closed: the OpenRX PDP now
    links the published schematics/STEP/BOM; still missing upstream are
    STEP for Lite/Gemini, BOM for Lite-UFL/Mono, gerbers, manual.
18. DONE 2026-07-18 (agent): the video description's opendrone.be link
    now carries utm_source=youtube&utm_medium=video&utm_campaign=video-openrx
    (edited in Studio, verified on the public watch page).

## Agent-ready backlog (claim a lane, work top-down)

- DIY abandoned-checkout recovery: Admin API poll for abandoned checkouts
  (abandonedCheckoutUrl) + Resend email; blocked on SHOPIFY_ADMIN_API_TOKEN
  in Oxygen (task 1).
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

- `origin/feat/phase2-thin-surfaces`: backup of a dropped lane. Its planned
  successor #285 was itself dropped 2026-07-17, so this is the only copy of
  that work; keep until Stan explicitly writes it off.
- `origin/feat/cart-interaction`: pre-#260 integration branch, never merged.
  Delete after confirming nothing in it is still wanted.
- Local `fix/*-review`, `phase2-complete`, `save/my-cart-dupes`: unverified
  leftovers from July agent sessions.
