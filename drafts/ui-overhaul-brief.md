# UI design rules

Design reference for all UI work in `app/`. Read fully before touching UI.
Compiled 2026-07-06 from Stan's notes, library research, and a full site/code
audit; status and task tracking live in `drafts/coordination.md`.

## Design direction (target feel)

"Professional engineer, still fun and explorative." Reference set, in order:

- **Teenage Engineering**: mono type for all numerals/specs, flat engineering
  tables, instrument-style product shots. (Already largely followed. Keep.)
- **U.S. Graphics / Berkeley Graphics**: catalog-number language, hairline
  rules instead of card shadows, "engineering document as website".
- **Framework**: modular-parts commerce: exploded views, parts as first-class
  products, repairability storytelling. Closest analog to our SKU + kit model.
- **DJI**: hero treatment only; ignore their scroll-jacking.

Rule #1: do not re-skin the polished surfaces (token system, motion vocabulary
in `app/lib/motion.ts`, HeroScene, BoardArt, PDP editorial chapters). Elevate
weaker surfaces to their level.

## Anti-patterns (never introduce)

- staggered fade-in-on-scroll on every element
- shader/gradient backgrounds on more than ONE surface
- glitch/scramble text outside a deliberate easter egg
- rounded-card + drop-shadow soup; use hairlines
- more than 2 type families (Inter + JetBrains Mono + Tokyo for brand tokens
  is the ceiling)

Motion budget: about 2 animated things per viewport.
`MotionConfig reducedMotion="user"` is global; keep it.

## Library decisions (researched 2026-07-06)

| Library | Verdict | Notes |
|---|---|---|
| **Motion (motion.dev)** | Already in stack | MIT. The engine everything sits on. No anime.js; one engine only. |
| **React Bits** (reactbits.dev) | USE, cherry-pick | MIT+Commons-Clause, copy-paste. Candidates: Count Up (spec numbers), Spotlight Card (related products), Logo Loop (partner logos), Stepper (build guides). Skip the WebGL backgrounds; HeroScene owns that slot. |
| **Kokonut UI** | Safe base, MIT | Only unambiguously-MIT shadcn collection. Utility components if needed. |
| **Paper Shaders** (shaders.paper.design) | SHELF | Apache-2.0, zero-dep. Only for a hero background on a page without the r3f scene. Never alongside it. |
| **Skiper UI** | Cherry-pick free only | No OSS license, attribution on free tier. Don't buy. |
| **Vengeance UI** | CAUTION | Repo has NO license file. Inspiration only; never ship its code. |
| **Bklit UI** | NICHE, later | MIT charts. Real use case: live thrust/efficiency/latency benchmark charts on PDPs. Post-launch. |
| **anime.js, Animmaster, Manus** | SKIP | Second engine / no license / wrong tool. |
| **Google Stitch** | Optional exploration | Layout ideation only; output has an AI-dashboard look. |
| **Higgsfield, ContentCore, ls.graphics** | Marketing track, not website | Social carousels + device mockups at launch time. |

## Shared primitives (on main; reuse, don't re-copy from React Bits)

- `~/components/AnimatedNumber.tsx`: Count Up for mixed spec strings
  ("20x20 mm", "3,3 V"); in-view once, reduced-motion-safe, SSR-safe. This IS
  the React Bits Count Up equivalent.
- `~/components/ScrambleText.tsx`: decode-in text. Easter-egg budget only
  (used on the 404 SIGNAL LOST banner). Do not put it on headings.
