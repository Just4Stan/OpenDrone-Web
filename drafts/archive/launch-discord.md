# Discord launch runbook - product launch announcement

*Lane C draft, 2026-07-06. Companion to `drafts/utm-conventions.md` and
`drafts/growth-infra-brief.md`. ALL COPY IS PLACEHOLDER - Stan rewrites voice
before anything is posted (TODO(copy-stan) on every prose block). No
pre-order/reserve language anywhere: notify-at-launch → normal sale, that's
the whole funnel (decision #2, 2026-07-06).*

## 1. Announcement post template

Post in the announcements channel (see etiquette below for ping choice).

```
TODO(copy-stan) - placeholder structure, rewrite in your own voice:

**<PRODUCT NAME> is live.**

<one-liner: what it is + the one spec that matters>

<2-3 bullets max:>
• <headline spec / what's new vs prev rev>
• <price> - shipping from <region/date>
• Open source: hardware + firmware links

Board page: https://opendrone.be/products/<HANDLE>?utm_source=discord&utm_medium=chat&utm_campaign=launch-<HANDLE>
Docs / repo: <hardware repo URL - no UTM needed on GitHub links>

<one honest line about stock level - "N units on hand, restock lead time
is X weeks" - informational, NOT scarcity-pressure marketing>
```

Notes:
- Keep it one message, no @everyone walls of text. One image or board
  render attached (use the hardware-repo render, white/transparent).
- The UTM'd product link is the ONLY opendrone.be link in the post -
  one link = clean attribution (`utm_source=discord`, `utm_medium=chat`,
  `utm_campaign=launch-<HANDLE>`, exactly per `drafts/utm-conventions.md`).
- If the post gets pinned or re-shared later, the campaign value still
  identifies the launch push - don't mint new campaign names for re-pins.
- Cross-post a short pointer (not a copy) in the general/build channels if
  chatter starts there: "launch post → #announcements".

## 2. Role gate / ping etiquette

- **Do not @everyone.** Use an opt-in launch/updates role and ping that.
- If no such role exists yet: create `@launch-news` (self-assign via the
  server's roles/onboarding flow), announce it once in general a few days
  BEFORE launch ("want a ping when it drops? grab the role"), then ping it
  in the launch post. First launch may have a small role list - that's
  fine, the email blast is the primary channel; Discord is secondary.
- One ping per launch. Restocks/minor revs: post without ping.
- Answer questions in-thread for the first hours - launch-day
  responsiveness is the community-trust play (and interview-opt-in leads
  hang out here).

## 3. Launch-day checklist (ordered)

Pre-flight (day before):
- [ ] Product page live-able: stock set in Shopify, price checked, PDP
      renders, buy button works on a test view (do NOT place a test order
      without checking the launch plan's payments status).
- [ ] Plausible goals exist (Stan, dashboard): `Notify Signup`,
      `Add to Cart`, `Checkout Click`, `Survey EU Premium`,
      `Survey Interview` - check they're registering, not just created.
- [ ] `SHOPIFY_WEBHOOK_SECRET` + `SHOPIFY_ADMIN_API_TOKEN` set in Oxygen
      prod env (growth-infra brief follow-up #2) so orders land in the
      attribution ledger.
- [ ] Announcement copy written (Stan) + UTM link built from
      `drafts/utm-conventions.md` template - copy-paste, don't hand-type.
- [ ] `@launch-news` role teased in general (if using role-ping).

Launch blast (email first, then Discord):
- [ ] Dry-run the launch email: `node scripts/launch-blast.mjs` (dry-run is
      the default - prints the segment + rendered email, sends nothing).
      Check recipient count matches the `notify-<handle>` segment.
- [ ] Real send: `node scripts/launch-blast.mjs --send`.
- [ ] Flip product to purchasable / publish the PDP (if not already).
- [ ] Post the Discord announcement (template above), ping the role once.
- [ ] Pin the announcement post.

Post-launch (same day):
- [ ] Watch Plausible: `utm_source=discord` vs `newsletter` split on the
      product page; funnel to Add to Cart / Checkout Click.
- [ ] Watch the ledger/Upstash for first `ord:` records (webhook working).
- [ ] Reply to Discord questions; collect recurring ones for the FAQ/PDP.
- [ ] Note stock remaining at T+24h in the launch plan doc.

## 4. What NOT to do

- No countdowns, no "reserve yours", no "only X left" pressure framing,
  no DM campaigns. Stock line is plain information, stated once.
- No pre-order or deposit mechanics of any kind (decision #2).
- Don't post opendrone.be links without UTMs during launch week - every
  untagged click pollutes the per-channel numbers the whole growth stack
  was built to read.
