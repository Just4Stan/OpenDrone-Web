# Newsletter — `/newsletter`, `/newsletter/:handle`

> source: app/routes/newsletter._index.tsx, app/routes/newsletter.$handle.tsx, app/components/release-notes/PrevNextNav.tsx

The newsletter is the single hub: posts authored locally and published to
the Shopify `news` blog appear here as the archive, grouped by year. The
signup *form* lives in the site footer (see `ui/footer.md` /
`ui/components.md`), not on this page. Article titles, excerpts, bodies,
dates, tags, version chips, and images all come from Shopify — they are
**dynamic** and not editable here. The POST signup action returns JSON
status messages (captured below as the user-facing text on success/error).

## Archive — Meta (browser tab + search/social)

- **title:** Newsletter
- **description:** Engineering Essentials — build notes, hardware releases, and write-ups from OpenDrone. Subscribe to get each post by email.
- **rss_link_title:** OpenDrone — Newsletter

## Archive — Header

- **eyebrow:** Newsletter · Engineering Essentials
- **rss_link:** ⌁ RSS · /newsletter.rss
- **heading:** Build notes.

## Archive — Year group

- **post_count_singular:** post
- **post_count_plural:** posts

Each year row shows `<n> post` or `<n> posts` — the year number and count
are computed; only the word "post"/"posts" is editable copy.

## Archive — Empty state

- **empty_heading:** No posts yet.
- **empty_body:** First post coming soon. Subscribe below to get it in your inbox.

## Post page — crumb

- **crumb_root:** Newsletter

Followed by `/` and the article handle (dynamic).

## Post page — prev/next navigation

- **nav_aria_label:** Post navigation
- **prev_label:** ← Previous
- **next_label:** Next →

Each card's title and date are dynamic (from the sibling article).

## Post page — dynamic content (not editable here)

```do-not-edit
Dynamic from Shopify `news` blog (edit in Shopify admin, not here):
- Post meta title  → article.seo.title || article.title || "Post"
- Post meta description → article.seo.description || article.excerpt
- Post title, deck/excerpt, hero image + altText, body HTML
- Date (formatted YYYY-MM-DD), version chip (from tag), filter tag
Routes/links: archive → /newsletter ; post → /newsletter/<handle>
RSS feed → /newsletter.rss
A `no-archive` tag hides a post from the public list.
```

## Signup action — status messages (returned by POST to /newsletter)

- **success:** You're in. Welcome aboard.
- **already_subscribed:** You're already on the list.
- **honeypot_silent_ok:** Thanks.
- **err_method_not_allowed:** Method not allowed.
- **err_rate_limited:** Too many requests — try again in a few minutes.
- **err_invalid_email:** Enter a valid email address.
- **err_no_consent:** Please confirm you want to receive updates.
- **err_turnstile:** Could not verify you are human. Refresh and try again.
- **err_email_rejected:** That email address was rejected. Double-check it and try again.
- **err_generic_subscribe:** Couldn't subscribe right now. Try again in a moment.
- **err_unavailable:** Signup temporarily unavailable. Try again later.
