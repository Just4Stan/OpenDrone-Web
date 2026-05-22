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

## 4. Email subscribers

Sending is **manual, in Shopify** (deliberately — you review every send):

1. Shopify admin → **Marketing → Create campaign → Shopify Email**.
2. Pick the blog-post template (auto-pulls title, hero, excerpt, link).
3. Audience: the **Email subscribers** segment (people who opted in via the
   site form, `acceptsMarketing: true`).
4. Review, then **Send**. Free up to 10,000 emails/month.

No third-party email service, no auto-send-on-publish. One post → one
reviewed campaign.
