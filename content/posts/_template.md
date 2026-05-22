---
title: Post title goes here
summary: One or two sentences. Becomes the list deck and the email preview text.
date: 2026-05-22
tags: [build-notes]
author: Stan
published: false
---

Copy this file to `content/posts/<slug>.md`, set `published: true` when ready,
and write below. Markdown is converted to the article body on publish.

## A heading

Body paragraphs, **bold**, _italic_, [links](https://opendrone.be), and lists:

- point one
- point two

Add a hero image by putting `image: ./images/hero.jpg` in the front-matter, and
inline images anywhere in the body:

<!-- ![Alt text](./images/diagram.png) -->

```c
// Code fences render with the site's monospace styling.
gpio_put(LED_PIN, 1);
```

> Preview with `npm run publish:post -- content/posts/<slug>.md --dry` before
> pushing. See `content/posts/README.md` for the full workflow.
