# Drone Builder — phased scope

Evolving the homepage 3D hero into an immersive drone **builder**: pick every
component of a 3" / 5" freestyle quad, see it on the drone, add the purchasable
subset to cart in one click. This doc scopes phases, assets, data model,
commerce wiring, and budgets against the code that exists today.

Status: scoping only. Nothing here is committed work.

---

## 1. What exists today (the foundation)

The hero is already ~60% of a builder's rendering + data plumbing. Concretely:

### Registry pattern — `app/lib/hero-airframes.ts`
- `HERO_AIRFRAMES: HeroAirframe[]` — one entry per size (`key: '5' | '3'`,
  slider `label`, Shopify `model` value `30×30`/`20×20`). Adding a size is
  config-only: the entry + three GLBs named for the key + matching Shopify
  variants. Nothing else hardcodes the size list.
- `HERO_BOARDS` — the ordered part list `[fc, esc, frame]` with Shopify
  `handle` and a `sizeVariant` flag (FC/ESC resolve a `Model` variant per
  size; the frame is one SKU across sizes). **This is a proto-slot system**:
  `boardKey` is a slot id, `handle` is the product filling it, `sizeVariant`
  is a primitive compatibility rule. The builder generalizes exactly this.
- `HERO_VARIANT_AXIS = 'Model'` — the single option axis both FC and ESC use,
  mount-named. The compatibility matrix below builds on this convention.

### GLB-per-size loading pipeline — `app/components/HeroScene.tsx`
- Files: `/models/{frame,fc,esc}<key>.glb`, **EXT_meshopt_compression**
  (MeshoptDecoder decodes on the main thread — DRACOLoader's blob worker is
  blocked by Hydrogen's CSP `worker-src`, discovered the hard way; keep using
  meshopt).
- `buildModel()` is a reusable per-part processing chain:
  `loadModel` → uniform fit-scale → `upgradeNonPBRMaterials` →
  `dedupeMaterialsByFingerprint` → `mergeGroupByBucket` (1200+ meshes →
  single-digit draw calls, the biggest GPU win) → `addProxyHitbox` (bounding
  box raycast proxy instead of ~700k-triangle scans) → `gl.compileAsync`
  shader warm. **None of this is FC/ESC/frame-specific** — it takes any GLB.
- `modelCacheRef: Map<string, BuiltModel>` — per-size cache; inactive sizes
  build lazily on `requestIdleCallback`, warmed offscreen. The builder needs
  the same cache keyed by part id instead of size.
- The one hard coupling to break: `BuiltModel = {frame, esc, fc, *Mats}` and
  the trio of `frameRef/escRef/fcRef` groups. Everything downstream
  (spotlight, lift-toward-camera, label projection) iterates these three by
  name. Phase 1's core refactor is `BuiltModel` → `Map<slotId, BuiltPart>`.

### Scroll / spotlight architecture
- `useScrollProgress` (target ref + smooth ref) + `ScrollDamper`
  (rate-limited exponential ease) + `frameloop="demand"` + `invalidate()` —
  zero-cost idle, everything animates off refs, not React state.
- `spotlightRef: RefObject<'fc'|'esc'|'frame'|null>` — hovering a buy card
  writes a ref; the render loop reads it per frame and pins that part's
  spotlight (gold emissive + lift + dim-others). **No re-render per hover.**
  This is exactly the interaction a slot rail needs — hover a slot, the part
  glows on the drone. Only the key type widens.
- `scrubRef` — 1:1 slider drag driving the 3D cross-slide. Same ref-not-state
  discipline for any new scrubby UI.
- Reveal choreography: `REVEAL_WINDOWS` in `_index.tsx` must match the
  `smoothstep` windows in `DroneAssembly.useFrame`, and the wheel-step
  controller's `STOPS = [0, 0.34, 0.67, 1.0]` brackets them. Adding hero
  slots (Phase 1) means touching all three in lockstep — they are one system.

### Buy-stack card architecture — `app/routes/_index.tsx`
- Loader resolves `HeroStacks` (`Record<sizeKey, HeroCard[]>`) **server-side**
  via `buildHeroStacks()`: per size, per board, match `af.model` against the
  product's `Model` option values → variant URL (`?Model=…`), variant price,
  variant image; graceful fallback to base product. Fully registry-driven.
- Cards write `heroSpotlightRef` on hover/focus; deferred `Await`/`Suspense`
  so Shopify latency never blocks the hero.
- `AddToCartButton` (`app/components/AddToCartButton.tsx`) already takes
  `lines: Array<OptimisticCartLineInput>` into one `CartForm.ACTIONS.LinesAdd`
  submit — **multi-line add-to-cart already exists** (the PDP stack toggle
  uses it). The builder's "add build to cart" is the same call with more lines.
- `cart.$lines.tsx` — cart permalink route, useful for shareable builds later.

### Adjacent proofs
- `FrameViewer.tsx` — second GLB consumer: `THREE.Cache`, preload-all-tiers +
  visibility toggle for instant switching, node-name-based part
  classification (`top`/`arm`/`base`), IntersectionObserver mount/unmount.
  Pattern library for the builder's per-slot model swapping.
- `BoardArt.tsx` (skimmed) — content-hash cache busting (`BOARD_ART_VERSION`),
  manifest-driven highlights. Precedent for a generated `parts` manifest.
- `product-content.ts` — the precedent that **editorial/config data lives in
  the repo, keyed by Shopify handle**, with Shopify only authoritative for
  price/stock/variants. The parts registry follows this, which also keeps it
  portable if the Shopify exit happens.
- Products that exist today: `openfc-lite`, `openesc` (Model axis 20×20/30×30),
  `openrx` (Model axis: Lite / Lite-UFL / Mono / Gemini), `openframe` (Model
  axis 3"/5"). No motors/props/battery/VTX SKUs yet — those are Phase 3+
  placeholder parts or future products.

---

## 2. Phase plan

Four phases, each shippable alone. P1 is deliberately small (~a week of solo
evenings); the suggested split survives contact with the code with one
adjustment: **the `BuiltModel` → slot-map refactor belongs in P1**, because
adding even one part to the hardcoded trio forces it anyway — better to pay it
once while adding two low-risk parts than during the /builder route build.

### Phase 1 — RX + battery on the existing hero stacks (~1 week evenings)
Goal: the hero drone gains a receiver and a battery; two new reveal cards; no
new route, no configuration UI. Ships as "the hero got richer".

- Refactor `BuiltModel`/`DroneAssembly` from the fixed `{frame, esc, fc}`
  trio to `Map<slotId, {group, mats}>` driven by an ordered slot list.
  `spotlightRef` key type widens from `'fc'|'esc'|'frame'` to `string`
  (slot id). Hover/lift/dim loops iterate the map. This is the bulk of P1.
- Extend `HERO_BOARDS` → 5 entries: `fc, esc, rx, frame, battery`.
  - `rx` → handle `openrx` (product exists; pick a default tier per size,
    e.g. Lite — its Model axis is tier-named, not mount-named, so the
    `sizeVariant` flag stays false and the card links to the base PDP).
  - `battery` → **non-purchasable placeholder** (we don't sell batteries):
    card renders info-only, no price, "bring your own — 4S/6S 1300–1500 mAh"
    style copy. This forces the purchasable/non-purchasable card split early,
    cheaply, before P3 depends on it.
- Assets: 4 new GLBs (`rx3/rx5` from the OpenRX KiCad boards via the proven
  KiCad → STEP → GLB path; `battery3/battery5` as simple stylized boxes with
  a strap hint — model them in Onshape in an evening). Budget ≤300 KB each
  (RX boards are tiny; batteries are boxes ≤50 KB).
- Choreography: `REVEAL_WINDOWS` 3 → 5, `STOPS` 4 → 6 (or group RX+battery
  into shared stops to keep the scroll from getting long — decide in-browser).
  Update the matching `smoothstep` windows in `DroneAssembly`.
- Load discipline: the visible trio is ~3.2 MB today; two more parts/size adds
  ~0.6 MB. Load FC/ESC/frame first (splash-gating unchanged), RX + battery
  join the same `Promise.all` only if measurement shows no splash regression —
  otherwise late-attach them the way inactive sizes already idle-build.

Shippable outcome: 5-part hero, registry-driven, slot-map internals ready for
P2. No compatibility engine yet — the hero still shows one blessed stack per
size.

### Phase 2 — `/builder` route: slot rail + compatibility rules (~2–3 weeks)
Goal: dedicated route where the visitor actually chooses parts.

- New route `routes/builder.tsx` (desktop-first, see §6 for mobile). Reuses
  `HeroScene`'s extracted assembly component — extract `DroneAssembly` + the
  build pipeline into `app/components/builder/DroneRig.tsx` shared by hero
  and builder, rather than forking 1600 lines.
- Left rail of **slots** (stack, RX, frame, battery, motors×4, props×4 …);
  clicking a slot opens its option list; hovering an option spotlights /
  ghost-previews it on the drone (same `spotlightRef` mechanics, plus a
  "ghost material" preview state).
- Data model from §4: `PART_CATALOG` + `SLOTS` + compatibility predicates
  (mount pattern, size class, connector). Incompatible options render
  disabled with the reason ("needs 20×20 mount").
- Camera: per-slot framing presets (reuse `CameraRig`'s lerp pattern — a
  target position per slot instead of scroll-driven).
- Loader: one Storefront query resolving every purchasable part's
  variants/prices/stock, deferred like `HOME_FEATURED_QUERY`; a
  `buildHeroStacks`-style resolver maps catalog entries → live variants.
- Build state in `useState` + URL search params (`?frame=5&fc=lite-30&…`) so
  refresh/back preserve the build — free shareability before P4's saved builds.
- Running price total for the purchasable subset; "Add build to cart" =
  existing `AddToCartButton` with N lines.
- Motors/props have no SKUs and likely no models yet at P2 start — ship the
  route with slots that have real options (stack, RX, frame, battery) and
  show motors/props as "coming soon" slots. **Do not block P2 on motor CAD.**

### Phase 3 — third-party video systems + placeholder parts (~2 weeks)
Goal: completeness — every part of a real build is representable, including
what we don't sell.

- Video-system slot: Analog / HDZero / DJI O4, each a **stylized generic**
  camera + VTX/air-unit model (see §3 — deliberately non-replica to avoid
  trademark/design-right issues; label by protocol "Digital HD (O4-class)"
  rather than brand where prudent, brand names in text are nominative use).
- Non-purchasable slot UX (battery pattern from P1, now systematic):
  info card, spec guidance, optional outbound link (§5). `PartDef.commerce`
  discriminated union makes this a data change, not a UI fork.
- Motors/props/AirTag-buzzer-mount slots go live with generic models
  (stylized motor: bell + stator + shaft, ~one model reused at 2 scales;
  props as flat swept blades; mount from the actual OpenFrame accessory CAD
  if it exists by then).
- Weight field lands on `PartDef` now (P4 needs history): show all-up weight.

### Phase 4 — saved/shareable builds, cart bundling, readouts (~2–3 weeks)
- Shareable build URLs (canonicalize the P2 search params; short-code via a
  KV/redirect table only if URLs get ugly).
- Saved builds: localStorage first; customer-account metafield only if the
  Shopify exit question has resolved *for* staying.
- One-click cart: multi-line `LinesAdd` (exists) + optional `cart.$lines`
  permalink for "buy this build" links in shared contexts. Attach build id as
  line-item attribute for support traceability.
- Readouts per build: all-up weight (sum of `PartDef.weightGrams`), price
  (purchasable subset), **estimated** flight time (simple physics: capacity ×
  voltage / assumed hover draw per size class — label it as an estimate, keep
  the model honest per the no-aspirational-content rule), thrust-to-weight
  band. All derived client-side from registry data; no backend.

---

## 3. Asset pipeline

### Per-phase GLB needs
| Phase | New models | Est. count | Est. added bytes |
|---|---|---|---|
| P1 | rx3, rx5, battery3, battery5 | 4 | ~0.7 MB |
| P2 | none required (reuse P1 set; motors deferred) | 0 | 0 |
| P3 | video ×3 styles (cam+VTX), motor ×2 sizes, prop ×2 sizes, mount ×1–2 | ~10 | ~1.5–2 MB |
| P4 | none | 0 | 0 |

Today's baseline: 6 GLBs, **6.33 MB total** (fc3 0.83 / fc5 0.97 / esc3 1.14 /
esc5 1.23 / frame3 1.11 / frame5 1.05 MB), ~3.2 MB for one size's visible trio.

### Sources
- **Our boards (FC/ESC/RX): KiCad → STEP → GLB — already proven** (the hero
  trios came out of this; `HeroScene` even documents the Onshape/cascadio
  export quirks it corrects: unlit materials, double-sided faces, metres
  scale). RX boards are 10×10 mm — trivially small models.
- **Frames**: Onshape CAD (existing; `FrameViewer` consumes the same
  frame GLBs).
- **Third-party / generic parts**: modeled from scratch, stylized — silhouette
  fidelity, zero logos, no replica geometry. This is both the trademark-safe
  choice and the cheap one: a battery is a rounded box, a motor is three
  revolve features. Style them to match the hero (they'll pass through
  `upgradeNonPBRMaterials` and the merge pipeline like everything else).

### Budgets & compression
- Per-model targets: boards ≤1.0 MB (they carry real pad/component geometry),
  frames ≤1.1 MB, generic/stylized parts ≤300 KB, boxes (battery) ≤50 KB.
- **Full P3 catalog ceiling: ≤10 MB on disk, ≤4.5 MB fetched for a default
  build** (one size, one option per slot). Enforce by decimating in the
  export step, not by hoping.
- **Compression: meshopt (EXT_meshopt_compression) only — not Draco.** The
  CSP lesson at the top of `HeroScene.tsx` stands: DRACOLoader's blob worker
  hangs under Hydrogen's `worker-src`. Meshopt + quantization via
  `gltfpack -cc -kn` (keep node names — `FrameViewer` classifies by them and
  the builder will too). Add a `scripts/` export step mirroring
  `export-board-art.mjs`, including a content-hash version token
  (`BOARD_ART_VERSION` pattern) for Oxygen's immutable cache.
- Serving: keep `/public/models/`; revisit CDN only if the catalog outgrows
  the repo (it shouldn't at these budgets).

---

## 4. Data model

Extend the `HERO_AIRFRAMES`/`HERO_BOARDS` registry into a slot/module system.
Lives in the repo — `app/lib/builder/registry.ts` — following the
`product-content.ts` precedent (repo holds identity/compat/editorial; Shopify
holds only price/stock/variant ids, resolved at load time). Repo-resident data
is also the hedge for the parallel Shopify-exit evaluation.

```ts
// app/lib/builder/registry.ts — sketch

/** Airframe size class. Extends HERO_AIRFRAMES' key space. */
export type SizeClass = '3' | '5';

/** Stack mounting patterns (mm). Matches the Shopify "Model" axis values
 *  already in use (HERO_VARIANT_AXIS) — 20×20 ↔ '20x20', 30×30 ↔ '30x30'. */
export type MountPattern = '20x20' | '25x25' | '30x30' | 'm9' | 'm12' | 'm16' | 'm19';

export type Connector = 'jst-sh-8' | 'uart-pads' | 'xt30' | 'xt60' | 'mipi' | 'analog-cam';

export type SlotId =
  | 'frame' | 'fc' | 'esc' | 'rx' | 'video' | 'battery'
  | 'motors' | 'props' | 'mount'; // AirTag/buzzer mount

export type SlotDef = {
  id: SlotId;
  label: string;                 // "Receiver", "Video system"
  required: boolean;             // frame/fc/esc/motors yes; mount no
  /** Reveal + spotlight order — generalizes HERO_BOARDS' array order. */
  order: number;
  /** Parts rendered as N instances (motors/props ×4). */
  instances?: number;
};

/** Commerce nature of a part — drives card UI + cart eligibility. */
export type PartCommerce =
  | { kind: 'shopify'; handle: string;            // e.g. 'openrx'
      /** Option-axis values selecting the variant, e.g. {Model: '20×20'}.
       *  Resolved against live variants exactly like buildHeroStacks(). */
      options?: Record<string, string> }
  | { kind: 'external'; url?: string; note: string }   // third-party, link out
  | { kind: 'info'; note: string };                    // purely informational

export type PartDef = {
  id: string;                    // 'openfc-lite-20', 'battery-4s-1300', 'video-o4'
  slot: SlotId;
  label: string;
  commerce: PartCommerce;
  /** GLB per size class it supports; absent size ⇒ not offered there.
   *  Doubles as the size-compatibility rule and the loader manifest. */
  models: Partial<Record<SizeClass, string>>;   // '/models/rx-lite.glb'
  /** Compatibility facts — consumed by the rule set below. */
  mounts?: MountPattern[];       // what it bolts to (boards: its own pattern)
  provides?: Connector[];        // e.g. ESC provides 'jst-sh-8'
  requires?: Connector[];        // e.g. FC requires 'jst-sh-8' from ESC
  weightGrams?: Partial<Record<SizeClass, number>>;
  /** Battery only — feeds the P4 flight-time estimate. */
  cell?: {s: number; mAh: number};
  /** Per-part placement tweak if the GLB origin isn't the mounted pose. */
  transform?: {position?: [number, number, number]; rotationY?: number};
};

export type BuildState = Record<SlotId, string | null>; // partId per slot

/** Compatibility = pure predicates over (frame, part). Start with three rules:
 *  1. size class:   part.models[sizeOf(build.frame)] exists
 *  2. mount:        part.mounts ∩ frameDef.stackMounts ≠ ∅ (boards)
 *                   / motorMountMatch (motors)
 *  3. connector:    part.requires ⊆ union(provides of selected parts)
 *  Return a reason string for the disabled-option tooltip, not a boolean. */
export function incompatibility(build: BuildState, part: PartDef): string | null;
```

Migration: `HERO_AIRFRAMES` stays (it's the size slider), `HERO_BOARDS`
becomes a derived view of the registry (`SLOTS` filtered to the hero's slot
set) so the homepage keeps working untouched while the builder grows. The
frame entries carry `stackMounts`/`motorMounts` matching what
`product-content.ts` already states editorially for `openframe`
(5": 20×20·25×25·30×30 stack, 16×16·19×19 M3 motors; 3": 20×20·25×25,
9×9·12×12 M2).

Deliberately out of scope for the matrix: electrical fine-grain (UART counts,
protocol matching), prop/motor thrust matching beyond size class. Three rules
cover the real failure modes for this catalog; more rules = more maintenance
per SKU (§7).

## 5. Commerce integration

- **Slot → variant resolution**: reuse the `buildHeroStacks()` approach
  verbatim — server loader queries products by handle with
  `variants(first: 30) { selectedOptions price availableForSale id }`, a
  resolver matches `PartCommerce.options` against `selectedOptions`
  case-insensitively, falls back to base product. Output: `Record<partId,
  {variantId, price, availableForSale, url}>` handed to the client.
- **One-click add**: collect the build's `kind: 'shopify'` parts →
  `AddToCartButton lines={[{merchandiseId, quantity, attributes:
  [{key: '_build', value: buildCode}]}]}` — one `LinesAdd` submit, already
  supported. Motors ×4 etc. use `quantity`.
- **Non-purchasable slots**: `kind: 'external'` renders an info card with an
  optional plain outbound link (no affiliate program, no tracking params —
  keep it clean); `kind: 'info'` renders guidance only. Neither enters the
  cart lines; the price readout labels itself "parts sold by us".
- **Loose coupling for the Shopify exit**: the registry never stores variant
  GIDs — only handle + option values. The Storefront query + `LinesAdd`
  submit sit behind two functions (`resolveCommerce(parts)` /
  `addBuildToCart(lines)`) in one module (`app/lib/builder/commerce.ts`).
  A future backend swaps that module; registry, 3D, and UI are untouched.
- Stack discount (`StackConfig` BXGY in Shopify) applies automatically at
  checkout when FC+ESC are both in the lines — no builder-side work, but
  surface the "−10% stack" hint on the price readout so it doesn't look
  like a pricing bug at checkout.

## 6. Perf + UX budgets

- **Mobile**: the hero's answer today is a hard split (`shouldLoadHero()`
  excludes ≤768 px + reduced-motion; SSR UA hint picks `MobileHome`). The
  builder should NOT attempt mobile 3D in P2. Mobile `/builder` = the same
  slot rail + compatibility engine with **static renders** per part
  (the hw-repo render pipeline already produces transparent 1568² PNGs) and
  the same cart flow. Configuration is the product; 3D is the garnish.
  Revisit real mobile 3D only post-P3, gated on the P1-refactored rig
  proving cheap (it should — single-digit draw calls after merging).
- **Load budgets**: builder route JS ≤ hero scene chunk (r3f already ships);
  first meaningful build view ≤4.5 MB GLB fetched (default parts of the
  active size only), remaining options idle-preloaded exactly like
  `HeroScene`'s inactive-size builds (`requestIdleCallback`-gated
  `buildModel`, offscreen `compileAsync` warm). Cache by part id, never
  refetch on option toggles (`FrameViewer`'s preload-and-toggle pattern).
- **Frame budget**: keep `frameloop="demand"` + ref-driven animation +
  `invalidate()` discipline everywhere; every added part goes through the
  merge pipeline so draw calls stay double-digit for a full build; keep
  `AdaptiveDpr` and the proxy-hitbox raycast approach as-is.
- **Reduced motion**: builder must be fully usable with 3D replaced by the
  static-render rail (same path as mobile) — configuration and cart never
  depend on WebGL. `SceneErrorBoundary` wraps the rig like the hero.
- **SSR**: route SSRs the rail, prices, and a poster image; Canvas is
  client-only (dynamic import, as `_index.tsx` does with
  `heroScenePromise`). URL-param build state must resolve server-side so
  shared links render meaningful HTML (SEO + no-JS).

## 7. Risks

- **GLB asset workload — the real bottleneck.** Every *purchasable-and-shown*
  part is 1–2 models × up to 2 sizes, through export → decimate → meshopt →
  visual QA in-scene (materials, origin, scale — the hero needed z-fight
  fixes, side-flags, exposure tuning per model). Realistic cost: **2–4
  evenings per board-class model, ~1 per stylized generic**. Full P3 catalog
  ≈ 14 new models ≈ **3–5 weeks of evenings on assets alone** — comparable to
  all the code. Mitigations: stylized generics wherever the part isn't ours,
  one motor/prop model reused across sizes by scaling, an export script that
  bakes the corrections `buildModel()` currently applies at runtime.
- **Scope creep.** The builder borders a config tool (Betaflight presets,
  wiring diagrams, tuning advice), a compatibility encyclopedia, and a CAD
  viewer. The compatibility matrix is capped at three rules on purpose;
  flight-time is an estimate, not a simulator; no per-part color/skin options
  in any phase. Anything not in a phase table above is a new decision, not a
  drive-by addition.
- **Maintenance per new SKU.** Today a hero size is "config + 3 GLBs". After
  the builder, a new SKU = registry entry + 1–2 GLBs + compat facts + Shopify
  variants named on the `Model` axis convention — and the P1 battery/RX cards
  + choreography windows if it joins the hero. Document this as a checklist
  in the registry file header (the `hero-airframes.ts` header comment is the
  model) or each launch quietly grows a day of spelunking.
- **Choreography coupling.** `REVEAL_WINDOWS` / `STOPS` / `smoothstep`
  windows live in two files and must move together; P1 touches all of them.
  Extract the windows into the slot registry (`SlotDef.order` → generated
  windows) during the P1 refactor so the invariant is structural, not
  disciplinary.
- **Parallel Shopify exit.** Mitigated by §5's two-function seam; the real
  risk is P4 saved-builds choosing a Shopify-native store (customer
  metafields) right before an exit. Keep P4's persistence localStorage-first
  and defer the account-backed version until the platform question closes.
- **RX tier naming mismatch.** `openrx`'s Model axis is tier-named
  (Lite/Mono/Gemini), not mount-named like FC/ESC — the registry's
  `options` map absorbs this, but don't "fix" it by renaming live Shopify
  variants mid-flight.
