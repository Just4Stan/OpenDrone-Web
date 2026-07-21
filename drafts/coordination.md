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

Merged 2026-07-21 (second PR): automatic reply-notification emails for
support tickets. A 15-min cron (support-notify.yml -> POST
/api/support/notify, same SUPPORT_CLEANUP_SECRET bearer) emails the
customer any staff replies they did not watch arrive in the widget:
one batched email per ticket, 10-min quiet period so reply bursts
collapse into a single mail, suppressed when the customer replied
after staff. The bot posts "📧 Emailed <name> ..." into the thread
after each send. Replaces the manual 📧-reaction mechanism (removed;
SUPPORT_EMAIL_EMOJI is gone). Poll route now records a per-ticket
seenCursor on visible-tab deliveries. ALSO FIXED: the daily cleanup
cron still POSTed opendrone.be, whose 301 curl treats as failure, so
the stale-ticket sweep had been failing since the 07-18 domain move;
now opendrone.store. Emails stay dead until RESEND_API_KEY lands
(task 13); the sweep retries the same batch each run until then, by
design. Tests 110 -> 122 (notify-decision suite).

Merged 2026-07-21: support AI first-responder + thread summariser
removed (Stan's call: never provisioned, no ANTHROPIC_API_KEY was ever
set, so it only added dead code paths). The support bridge is now
purely human: staff type in the Discord forum thread, ✅ publishes a
reply to the widget (enforce mode), 📧 flags it for the email
notification. Test count drops 125 -> 110 (ai-draft suite deleted).

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

Done 2026-07-21 (browser/infra session + feat/resend-contacts-fix lane):
newsletter plumbing audited end to end after the subscriber influx. Resend
key story untangled (see task 13), Oxygen re-keyed + redeployed, welcome
email verified delivered in production. Found and fixed a launch-day bug:
upsertContact had never worked (wrong POST /contacts payload shape, 422
swallowed by design), so Resend had ZERO contacts while Shopify had 409
subscribed customers. Fixed the payload in app/lib/growth/resend.ts and
scripts/launch-blast.mjs (segments must be [{id}] objects; custom
properties unusable on this plan), added scripts/resend-backfill.mjs, and
ran it: Shopify -> Resend backfill of all consented subscribers
(notify-openrx 65, notify-openfc-lite 17, rest as plain contacts due to
the 3-segment free-plan cap, see task 13b).

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
13. RESOLVED 2026-07-21 (agent, browser session): production email was
    never broken and is verified live end to end (real opendrone.store
    signup -> "Subscribed: Engineering Essentials" welcome, Resend
    reports delivered, 08:05 UTC). The confusion: there are TWO Resend
    accounts. The ORIGINAL (Google login stan.coene@gmail.com, team
    "stan.coene") has opendrone.be verified since 2026-04-25, its DKIM/
    SPF records are the ones live at Gandi, and its key had been in
    Oxygen as a secret-flagged (unreadable) variable, which is why every
    audit read it as "never provisioned". A SECOND account (team
    "incutec", login stan@incutec.eu, created the morning of
    2026-07-21) holds a duplicate opendrone.be entry, status failed:
    that is the entry the earlier "systems check" note described. DO
    NOT add the DNS records from the failed entry: they would put a
    second conflicting DKIM key at resend._domainkey and can break the
    live sender. Done today: fresh key `opendrone-web-oxygen-2` created
    in the ORIGINAL account, set in Oxygen Production + Preview (plain
    value now, so env pull/push work) and local .env, production
    redeployed, end-to-end verified. No deploy ever ran with a bad key,
    so no sends were lost. Remaining, Stan only, three decisions:
    (a) Account consolidation. Either stay on the gmail-login account
        (then delete the failed opendrone.be entry + the unused
        `opendrone-web-oxygen` key in the incutec account), or migrate
        to the incutec account later: delete the domain in the old
        account, claim it in the new one (verification TXT already
        live at Gandi), re-key Oxygen, re-run
        scripts/resend-backfill.mjs. Do NOT migrate during launch
        traffic; sends 403 between domain deletion and claim.
    (b) Resend free plan caps segments at 3 (General, notify-openrx,
        notify-openfc-lite, all in use). Subscribers for openesc,
        openframe, hardware-kit, elrs-antenna-24 exist as plain
        contacts only and cannot be broadcast-targeted per SKU until
        the plan is upgraded or segments are freed.
    (c) Rotate the two Resend keys pasted through agent chat when
        convenient (same hygiene note as the shpat_ token in task 1).
14. VIDEO BLOCKER: OpenRX PDP has zero downloads (every card 404'd, so the
    chapter is hidden; TODO(downloads) at product-content.ts). Video viewers
    will want schematic.pdf / BOM / STEP. Publish the artifacts to the
    OpenRX repo releases, then fill the six TODO(downloads) blocks.
15. Shopify admin image alt texts use em dashes ("OpenRX Gemini, front");
    swap for hyphens or middots in admin when convenient.
16. Back-in-stock notify shipped 2026-07-18 (took over the parked lane;
    zero WIP existed). inventory_levels/update -> notify-<handle> Resend
    broadcast, ACTIVE + not-coming-soon + 7-day cooldown latch guards,
    dormant-safe without env. ACTIVATED: the inventory_levels/update
    webhook is registered at Settings > Notifications > Webhooks
    (confirmed live in admin 2026-07-21), SHOPIFY_ADMIN_API_TOKEN is in
    Oxygen (task 1). Real sends stay blocked by the coming-soon guard
    until launch, by design.
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
