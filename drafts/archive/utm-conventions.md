# UTM conventions - OpenDrone channel attribution

*Lane A, 2026-07-06. Companion to `drafts/growth-infra-brief.md`. These values
are what the Plausible dashboards and the Upstash order ledger break down on -
one typo = one phantom channel. Copy links from the templates below, don't
hand-type parameters.*

## How it flows

`utm_*` on the inbound link → Plausible (aggregate) + sessionStorage
(first touch, session-scoped) → hidden `_utm_*` cart attributes on first
add-to-cart (underscore prefix = invisible to the customer at checkout) →
Shopify order note_attributes → orders/paid webhook → `ord:<id>` ledger
record. First touch wins for the whole session; later links don't overwrite.

## Canonical values - lowercase, exactly these

### utm_source (the channel; anything else shows up as noise)

| value | use for |
|---|---|
| `youtube` | own channel videos, community posts, channel links |
| `discord` | OpenDrone Discord announcements, pinned posts |
| `reddit` | any subreddit post/comment |
| `bardwell` | JB's video descriptions / community posts (creator collab) |
| `newsletter` | Engineering Essentials emails |
| `x` | X/Twitter posts |

Short links may use `?ref=<source>` instead - the site folds `ref` into
`utm_source` at capture. Full `utm_*` preferred wherever length allows.

### utm_medium (the format)

| value | use for |
|---|---|
| `video` | video descriptions, pinned comments |
| `social` | feed posts (reddit, x, youtube community tab) |
| `chat` | discord messages/announcements |
| `email` | newsletter sends |

### utm_campaign (the push)

Format: kebab-case, one of two shapes:

- Launches: `launch-<sku-handle>` → `launch-openfc-lite`, `launch-openfc-lite-mini`
- Per-video: `video-<slug>` → `video-esc-desync-deep-dive`
- (occasional) Evergreen profile/bio links: `evergreen`

Keep it under 64 chars - the cart-attribute pipeline truncates beyond that.

## Ready-to-paste templates

### YouTube description (own channel)

```
Board + docs: https://opendrone.be/?utm_source=youtube&utm_medium=video&utm_campaign=video-<SLUG>
OpenFC Lite: https://opendrone.be/products/openfc-lite?utm_source=youtube&utm_medium=video&utm_campaign=video-<SLUG>
```

### YouTube launch video

```
https://opendrone.be/products/<HANDLE>?utm_source=youtube&utm_medium=video&utm_campaign=launch-<HANDLE>
```

### Discord announcement

```
https://opendrone.be/products/<HANDLE>?utm_source=discord&utm_medium=chat&utm_campaign=launch-<HANDLE>
```

### Reddit post/comment

```
https://opendrone.be/products/<HANDLE>?utm_source=reddit&utm_medium=social&utm_campaign=<CAMPAIGN>
```

### Bardwell brief (hand him exactly this, per video)

```
https://opendrone.be/?utm_source=bardwell&utm_medium=video&utm_campaign=video-<HIS-VIDEO-SLUG>
```

### Newsletter CTA buttons

```
https://opendrone.be/products/<HANDLE>?utm_source=newsletter&utm_medium=email&utm_campaign=<CAMPAIGN>
```

### X bio / profile links

```
https://opendrone.be/?ref=x
```

## Reading the numbers

- **Plausible**: filter by UTM source → funnel `Notify Signup` → `Add to Cart`
  → `Checkout Click` (revenue attached). Goals list = PR #<lane-A> description.
- **Paid orders / AOV per channel**: Upstash ledger `ord:<id>` records
  (`attribution.utm_source`), walk `att:idx`. CAC = channel spend (manual
  input) ÷ ledger conversions.
- No consent banner is involved: Plausible is cookieless, first-touch storage
  is sessionStorage-only (ePrivacy note in the brief; legal verdict 18-jul).
