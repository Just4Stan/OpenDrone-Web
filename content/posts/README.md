# Blog posts — local authoring

Write posts here as Markdown, then push them to the Shopify blog with one
command. Subscribers are emailed separately from Shopify (see step 4).

This is the **source of truth** for post content. The copy that lives in
Shopify is generated from these files — edit here, re-run publish, never
hand-edit in the Shopify admin (it'll be overwritten on the next push).

## 1. Write

Create `content/posts/<slug>.md`. The filename (minus `.md`) is the default
URL slug. Front-matter on top, Markdown body below:

```markdown
---
title: Bringing up the OpenFC power tree
summary: First boot, the regulator that fought back, and the fix.
date: 2026-05-24
tags: [build-notes, openfc]
image: ./images/openfc-firstboot.jpg
imageAlt: OpenFC on the bench, scope probes on the 3V3 rail
author: Stan
published: true
---

Body text in **Markdown**. Headings, lists, code fences, tables, links.

![Scope capture of the 3V3 rail](./images/3v3-ramp.png)

```c
// code fences render with the site's mono styling
gpio_put(LED_PIN, 1);
```
```

### Front-matter fields

| Field       | Required | Notes |
|-------------|----------|-------|
| `title`     | yes      | Post title + email subject. |
| `summary`   | no       | Excerpt / email preview / list deck. Falls back to first paragraph. |
| `date`      | no       | Publish date (`YYYY-MM-DD`). Defaults to today. |
| `tags`      | no       | `[a, b]` or `a, b`. Used for the on-site tag filter. |
| `image`     | no       | Hero image — path relative to this `.md` file. Uploaded to Shopify. |
| `imageAlt`  | no       | Alt text for the hero. |
| `author`    | no       | Defaults to `Stan`. |
| `slug`      | no       | Override the URL slug (defaults to the filename). |
| `published` | no       | `true` (default) publishes live; `false` keeps it a Shopify draft. |

Images referenced in the body (`![alt](./images/x.png)`) and the hero are
uploaded to Shopify Files on publish; their URLs are rewritten to the CDN.
Keep them next to the post (e.g. `content/posts/images/`).

## 2. Preview locally (no API calls)

```sh
npm run publish:post -- content/posts/<slug>.md --dry
```

Renders the HTML to `scripts/out/post-<slug>.html` and lists the images it
would upload. Open it in a browser to proofread. Touches nothing in Shopify.

## 3. Publish to Shopify

```sh
npm run publish:post -- content/posts/<slug>.md            # publish live
npm run publish:post -- content/posts/<slug>.md --draft    # push as a draft
```

Idempotent: re-running updates the existing article (matched by slug) instead
of creating a duplicate. Prints the live URL when done.

> **One-time setup:** the publisher writes articles via the Shopify Admin API,
> which needs the `read_content` + `write_content` scopes on the "OpenDrone
> Infra" custom app. Image upload (`write_files`) is already granted. If you
> see `ACCESS_DENIED for ... content`, add those two scopes in
> Settings → Apps → Develop apps → OpenDrone Infra → Configuration, then
> reinstall the app and update `SHOPIFY_ADMIN_API_TOKEN` in `.env`.

## 4. Email subscribers (manual, in Shopify)

**There is no auto-send.** Publishing a post does not email anyone. Sends are
done by hand in the Shopify admin so every one is reviewed first. This is
deliberate — no third-party email service, no webhook auto-dispatch.

Subscribers come in through the site: the footer signup form (on every page)
writes a Shopify customer with `acceptsMarketing: true`, landing them in the
**"Subscribed"** segment. Nothing to do in this repo for that.

### One-time setup — verify the sender email (before your first send)

This is done entirely in Shopify + your DNS, not in this repo:

1. Shopify admin → **Settings → Notifications → Sender email**.
2. A public domain (gmail.com, etc.) can't be a branded sender — mail would go
   out as `store+…@shopifyemail.com`. Add a custom `@opendrone.be` address
   ("create a new one") and complete the DNS records Shopify gives you.
3. Confirm it shows **Verified**. (As of setup it was `stan.coene@gmail.com`,
   Unverified — replace it.)

### Each post

1. Shopify admin → **Marketing → Create campaign → Shopify Email**.
2. Pick the blog-post template (auto-pulls title, hero, excerpt, and the link
   to `/newsletter/<slug>`).
3. Audience: the **"Subscribed"** customer segment.
4. Review, then **Send**. Free up to 10,000 emails/month; Shopify handles
   delivery and unsubscribes.

One post → one reviewed campaign.
