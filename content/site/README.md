# Site content library

Editable plain-text mirror of every production page's copy. **Retype the
values here, leave the keys alone, then ask Claude to apply.** The source
of truth for the live site stays in the `.tsx` / `.ts` / legal `.md`
files — this folder is the editing surface, not the runtime.

## How to edit

Each file mirrors one page (or one group of related pages / components).
Two kinds of content appear:

1. **Keyed strings** — short UI copy (buttons, eyebrows, labels, meta).

   ```
   - **cta_primary:** Shop Now
   ```

   Edit only the text **after** the colon. Do not rename the key
   (`cta_primary`) — keys are stable IDs Claude uses to find the string
   in source. Keep it on one line.

2. **Prose blocks** — longer body copy under a `### prose: <id>` heading.
   Edit freely as Markdown; the `<id>` is the anchor.

Anything in a `> source:` line or a fenced `do-not-edit` block is
metadata — leave it.

## How edits get applied

1. This whole folder is committed as a snapshot of the **current** live
   copy.
2. You edit the Markdown.
3. `git diff content/site/` shows exactly which values changed.
4. Claude reads that diff and rewrites only the changed strings back into
   the matching source files, then commits + pushes (Oxygen auto-deploys).

Because applying is diff-driven, untouched keys are never touched in
source. If you add a key that doesn't exist, Claude will flag it rather
than guess.

## What is NOT in here

- **Legal pages** (warranty, privacy, terms, …) already live as Markdown
  in `app/content/legal/{en,nl,fr}/` — those *are* the library for legal
  copy. Edit them there directly. ⚠️ The Dutch (`nl`) files are
  overwritten by `npm run sync:legal` from the external compliance repo;
  edit NL legal in that repo, not here. EN/FR are hand-authored and safe.
  Legal page *chrome* (titles/eyebrows shown around the body) lives in
  `legal-chrome.md` here.
- **Shopify-managed copy** — product titles, prices, collection
  descriptions, and any text coming from the Shopify Storefront API are
  edited in Shopify admin, not here. Files note where this applies.
- **Structured data** (links, file paths, part refs, SKUs) — shown inside
  `do-not-edit` fences for context; changing them needs a code edit.

## Index

| File | Pages |
|------|-------|
| `home.md` | `/` (desktop 3D hero + mobile static) |
| `contact.md` | `/contact` |
| `firmware-partners.md` | `/firmware-partners` |
| `open-source.md` | `/open-source` |
| `support.md` | `/support`, `/support/resume` |
| `search.md` | `/search` |
| `cart.md` | `/cart` |
| `collections.md` | `/collections`, `/collections/all`, `/collections/:handle` |
| `product-page.md` | `/products/:handle` chrome (buttons, section labels) |
| `newsletter.md` | `/newsletter`, `/newsletter/:handle` |
| `legal-overview.md` | `/legal` imprint/overview page |
| `legal-chrome.md` | titles/eyebrows around every legal page body |
| `account.md` | `/account/*` |
| `errors.md` | 404 / catch-all |
| `ui/header.md` | site header + nav |
| `ui/footer.md` | site footer |
| `ui/components.md` | newsletter signup, donation upsell, empty states, banners |
| `products/<handle>.md` | per-product editorial (openfc, openesc, openrx, openframe, openstack) |
