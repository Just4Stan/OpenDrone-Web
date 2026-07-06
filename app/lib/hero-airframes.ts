/**
 * DERIVED views for the homepage hero's airframe sizes + board stack.
 *
 * The truth now lives in the builder parts registry
 * (`app/lib/builder/registry.ts` — AIRFRAMES / SLOTS / PART_CATALOG /
 * HERO_DEFAULT_BUILDS); this module only reshapes it into the exact exports
 * the hero has always consumed, so every existing consumer (routes/_index,
 * HeroScene, HeroSizeSlider) keeps compiling and behaving unchanged.
 *
 * Adding a drone size is STILL config-only — add an AirframeDef + the per-size
 * PartDefs/GLBs + HERO_DEFAULT_BUILDS entry in the registry, and the matching
 * `Model` variants on the FC/ESC products. Nothing else hardcodes the size
 * list. (See the registry header for the full checklist.)
 *
 * NOTE: the slider's 1:1 drag-scrub (and the 3D cross-slide it feeds) is tuned
 * for two positions. A 3rd size renders fine as a third click-to-select option
 * and swaps correctly; only the drag gesture would need a segmented rework.
 */
import {
  AIRFRAMES,
  HERO_SLOTS,
  HERO_VARIANT_AXIS as REGISTRY_VARIANT_AXIS,
  heroPartFor,
  type HeroSlotId,
} from '~/lib/builder/registry';

export type HeroAirframe = {
  /** Stable id; also the GLB filename suffix (`frame5.glb` → key `"5"`). */
  key: string;
  /** Slider label. */
  label: string;
  /** The Shopify "Model" option value this size maps to — mount-named
   *  (`20×20`/`30×30`, × = U+00D7), the SAME axis for both the FC and the ESC.
   *  Matched case-insensitively against the live variant option values, so the
   *  size-variant cards (and the PDP they link to) resolve to this variant.
   *
   *  NOTE: the FC product's live Shopify variants must be named `20×20`/`30×30`
   *  to match (the OpenESC already is). Any FC variant still tier-named
   *  (`Lite`/`Lite Mini`) won't match and that card falls back to the base
   *  product link — rename them in Shopify to fix. */
  model: string;
};

export const HERO_AIRFRAMES: HeroAirframe[] = AIRFRAMES.map((a) => ({
  key: a.size,
  label: a.label,
  model: a.shopifyModel,
}));

export const HERO_AIRFRAME_KEYS: string[] = HERO_AIRFRAMES.map((a) => a.key);
export const DEFAULT_HERO_SIZE: string = HERO_AIRFRAMES[0].key;

export function findAirframe(key: string): HeroAirframe | undefined {
  return HERO_AIRFRAMES.find((a) => a.key === key);
}

export type HeroBoardKey = HeroSlotId;

export type HeroBoard = {
  boardKey: HeroBoardKey;
  handle: string;
  sizeVariant: boolean;
};

/**
 * The boards each size's hero stack shows, in render/spotlight order
 * (FC → ESC → Frame — HERO_SLOTS order, which drives the scroll reveal
 * order in the 3D scene).
 *
 * `sizeVariant` boards link to the active size's `Model` variant and show that
 * variant's price; the frame is one SKU shared across sizes (its 3D model
 * differs per size, the product doesn't). Derived: a slot is size-variant when
 * its default parts select a variant on the `Model` axis. One handle per slot
 * across all sizes is asserted — the hero cards assume it.
 */
export const HERO_BOARDS: readonly HeroBoard[] = HERO_SLOTS.map((slot) => {
  const parts = AIRFRAMES.map((a) => heroPartFor(slot.id, a.size));
  const commerces = parts.map((p, i) => {
    if (p.commerce.kind !== 'shopify') {
      throw new Error(
        `hero-airframes: hero slot "${slot.id}" part "${p.id}" is not purchasable`,
      );
    }
    // buildHeroStacks matches the AIRFRAME's model value against live
    // variants; a part whose own option value disagrees would silently link
    // the wrong variant — fail loudly at import instead.
    const opt = p.commerce.options?.[REGISTRY_VARIANT_AXIS];
    if (opt && opt !== AIRFRAMES[i].shopifyModel) {
      throw new Error(
        `hero-airframes: part "${p.id}" selects ${REGISTRY_VARIANT_AXIS}="${opt}" but airframe "${AIRFRAMES[i].size}" maps to "${AIRFRAMES[i].shopifyModel}"`,
      );
    }
    return p.commerce;
  });
  const handle = commerces[0].handle;
  if (commerces.some((c) => c.handle !== handle)) {
    throw new Error(
      `hero-airframes: hero slot "${slot.id}" mixes product handles across sizes`,
    );
  }
  return {
    boardKey: slot.id,
    handle,
    sizeVariant: commerces.some((c) => Boolean(c.options?.[REGISTRY_VARIANT_AXIS])),
  };
});

/** The Shopify "Model" axis name the FC/ESC variants use. */
export const HERO_VARIANT_AXIS = REGISTRY_VARIANT_AXIS;
