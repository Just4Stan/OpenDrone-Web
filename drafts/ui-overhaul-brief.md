# OpenDrone-Web UI overhaul — design brief

*Compiled 2026-07-06 from Stan's notes + library research + full site/code audit. This is the working brief for all UI agents. Read fully before touching `app/`.*

## The honest starting point

The site is **not** actually "vibecoded" in the usual sense — the token system, motion vocabulary (`app/lib/motion.ts`), HeroScene, BoardArt, and PDP editorial chapters are mature and restrained. What *does* read as unfinished today:

1. **Placeholder content** — grey "ACCESSORY" cards with no imagery on /collections/all, ChapterMediaPlaceholders, the red PRE-LAUNCH badge. Content problem, not a design problem.
2. **Thin commerce components** — `ProductPrice.tsx`, `CartSummary.tsx`, `RelatedProducts.tsx` are bare next to the polished surfaces.
3. **No "keep shopping" on a populated cart**; drawer is a dead end.
4. **Homepage below the hero** is weaker than the hero itself.

Rule #1 of this overhaul: **do not re-skin the polished surfaces.** Elevate the weak ones to their level.

## Design direction (target feel)

"Professional engineer, still fun and explorative." Reference set, in order:

- **Teenage Engineering** — mono type for all numerals/specs, flat engineering tables, instrument-style product shots. (Already largely followed — keep.)
- **U.S. Graphics / Berkeley Graphics** — catalog-number language, hairline rules instead of card shadows, "engineering document as website".
- **Framework** — modular-parts commerce: exploded views, parts as first-class products, repairability storytelling. Closest analog to our SKU + kit model.
- **DJI** — hero treatment only; ignore their scroll-jacking.

Anti-patterns (the actual "vibecoded" tells — never introduce):
- staggered fade-in-on-scroll on every element
- shader/gradient backgrounds on more than ONE surface
- glitch/scramble text outside a deliberate easter egg
- rounded-card + drop-shadow soup; use hairlines
- more than 2 type families (we have Inter + JetBrains Mono + Tokyo for brand tokens — that's the ceiling)

Motion budget: ~2 animated things per viewport. `MotionConfig reducedMotion="user"` is global — keep it.

## Library decisions (researched 2026-07-06)

| Library | Verdict | Notes |
|---|---|---|
| **Motion (motion.dev)** | Already in stack | MIT. The engine everything else sits on. No anime.js — one engine only. |
| **React Bits** (reactbits.dev) | USE, cherry-pick | MIT+Commons-Clause, copy-paste/shadcn CLI. Candidates: Count Up (spec numbers), Spotlight Card (related products), Logo Loop (partner/firmware logos), Stepper (build guides). Skip the WebGL backgrounds — HeroScene already owns that slot. |
| **Kokonut UI** | Safe base, MIT | Only unambiguously-MIT shadcn collection. Use for utility components if needed. |
| **Paper Shaders** (shaders.paper.design) | SHELF | Apache-2.0, zero-dep. Only if we ever want a hero background on a page *without* the r3f scene. Never alongside it. |
| **Skiper UI** | Cherry-pick free only | No OSS license, attribution on free tier. Don't buy yet. |
| **Vengeance UI** | CAUTION | Repo has NO license file. Don't ship its code until that's fixed; inspiration only. |
| **Bklit UI** | NICHE, later | MIT charts. Real use case: live thrust/efficiency/latency benchmark charts on PDPs — engineering differentiator. Post-launch. |
| **anime.js, Animmaster, Manus, setupsai list** | SKIP | Second engine / no license / wrong tool / low signal. |
| **Google Stitch** | Optional exploration | Free; layout ideation only, output has an AI-dashboard look. |
| **Higgsfield, ContentCore, ls.graphics** | Marketing track, not website | Social carousels + device mockups at launch time. Iebe/marketing decision. |

## Phases

### Phase 1 — commerce features (agent running now)
Price masking behind `PUBLIC_HIDE_PRICES`, keep-shopping on populated cart, share-cart view links, drawer companion row. See agent brief; small commits, push each.

### Phase 2 — elevate the thin components (next agent, after phase 1 lands)
- `RelatedProducts` → spec-forward cards matching header-Pod quality (board render, one-line spec, mono price, quick-add). Spotlight-hover acceptable.
- `CartSummary` + `/cart` page → engineering-invoice feel: hairline table, mono columns, VAT line, checkout CTA. The cart page should feel like a build sheet ("your stack"), not a generic list.
- `ProductPrice` → single `Price` component everywhere (phase 1 creates it), tabular-nums mono.
- Homepage below-hero: tighten sections to the spec-table language; Count Up on the "published/produced" numbers.
- Collections grid: proper hover states; fix what's possible in code for the placeholder accessory cards (real photos are a separate Notion task).

### Phase 3 — content + polish (needs Stan)
- Accessory product photos (Notion task exists), quickstart content, pricing decision in Shopify admin (placeholders are €45/49/69/75 vs Stan's working €39/49), early-adopter compare-at pricing.

## Hard constraints (from repo CLAUDE.md — non-negotiable)
- Trunk-based on `main`, ONE agent in the tree at a time, small commits, **push after every commit** (Oxygen auto-deploys).
- Tokens only, never hardcoded colors; every new surface must work in light mode (`html.light`).
- Verify on `localhost:3000` before pushing; `npm run typecheck && npm run lint`.

## Coordination — SUPERSEDED (frozen 2026-07-07; live registry is now `drafts/coordination.md`)

Four agents share this tree. To avoid the clobbering CLAUDE.md warns about:

**File ownership right now** (do not edit files outside your lane; if you must, grep `git status` first and rebase on the other agent's uncommitted work, never revert it):
- **Phase-1 / prices agent** (running, uncommitted WIP in tree): `Price.tsx` (new), `ProductPrice.tsx`, `CartLineItem/CartSummary`, `root.tsx` (`PUBLIC_HIDE_PRICES`), `env.d.ts`, `app.css`.
- **Coming-soon agent (Prompt 1)**: ⚠️ OVERLAP — the phase-1 agent already builds price hiding behind `PUBLIC_HIDE_PRICES`. Do NOT invent a parallel `PUBLIC_COMING_SOON` price-mask; build the notify-me signup + per-product lock state ON TOP of the phase-1 flag/Price component. Own: `product-content.ts` (lock field), notify-me UI, newsletter action tagging.
- **Cart agent (Prompt 2)**: `Header.tsx` (cart icon hover), `Aside.tsx`, `CartMain.tsx`, `cart.$lines.tsx`, `cart.tsx` route actions. Coordinate with phase-1 on `CartSummary`.
- **Surfaces agent (Prompt 3)**: `RelatedProducts.tsx`, cart-page styling, homepage below-hero, collections grid hover. Start AFTER prompts 1–2 land or work in a separate `git worktree` on port 3001.

**Shared primitives (committed on main — reuse, don't re-copy from React Bits):**
- `~/components/AnimatedNumber.tsx` — Count Up for mixed spec strings ("20×20 mm", "3,3 V"); in-view once, reduced-motion-safe, SSR-safe. This IS the React Bits Count Up equivalent.
- `~/components/ScrambleText.tsx` — decode-in text. Easter-egg budget only (used on the 404 SIGNAL LOST banner). Do not put it on headings.

**Git discipline:** stage file-scoped (`git add <your files>`) — NEVER `git add -A`/`.` — the tree always contains other agents' WIP. Push after every commit.

**In flight elsewhere:** `drafts/shopify-independence.md` (Shopify exit assessment) and `drafts/drone-builder-scope.md` (3D builder roadmap) are being written by research agents. Don't deepen Shopify coupling gratuitously: keep new commerce logic behind small functions in `app/lib/`, not inlined in routes.

### Git flow decision (Stan, 2026-07-06) — SUPERSEDES the trunk-based section for this overhaul

`main` is protected on the remote; direct pushes are rejected. Effective now, ALL agents:

1. Work on a **feature branch** (`feat/<lane>`), commit small, `git push -u origin <branch>` after every commit.
2. Open a PR via `gh pr create` when the lane is coherent; **squash-merge** via `gh pr merge --squash` (never squash-merge a branch that redid work already on main).
3. **Before starting work and after any PR merges: `git fetch && git rebase origin/main`** (or merge origin/main) so you build against the latest integrated state — the `~/lib/coming-soon` breakage happened because a lane built against an unmerged branch.
4. The tree is SHARED across terminals. **Never `git checkout`/`switch` while `git status` shows another lane's uncommitted files** — commit or coordinate first. Never `git stash` / `git clean` another lane's files; if something blocks you, leave a note here instead.
5. Existing local `main` is 2 commits ahead of origin and unpushable — do not build on local main; those commits are being reconciled by the oversight session.

Merged so far: #257 coming-soon state. In flight: `feat/cart-interaction` (cart + newsletter tagging + 404 easter egg + integration merge, pushed), `feat/coming-soon` (may be fully superseded by #257 — check before reusing).

**Cart lane (Prompt 2) — DONE, merged as PR #260 (2026-07-06, cart agent):** cart icon click→/cart + non-modal hover drawer preview, keep-shopping on populated cart, `cart.$lines?view=1` (merges into existing carts, filters donation + coming-soon-locked lines server-side), share-this-cart copier (BXGY-split lines aggregated per variant, discount codes carried), "Goes well with" companion row (coming-soon-locked partners never offered). Rebased onto #259/#262/#263 before merge; verified on :3003 with `PUBLIC_COMING_SOON=0` (worktree-local .env only). Worktree + branch removed. PR #258 closed (branch had picked up another session's commits; its `?view=1` commit is duplicated on #260). Note for the reviewer: `window.prompt` clipboard fallback in ShareCartButton kept as reviewed, but it hard-blocks browser automation — an inline-reveal variant exists in branch `save/my-cart-dupes` if we ever want it. Free ports again: 3003.
