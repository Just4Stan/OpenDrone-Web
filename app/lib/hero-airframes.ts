/**
 * Single source of truth for the homepage hero's airframe sizes.
 *
 * Each entry drives, across the whole hero:
 *  - the size slider (one option per entry, in this order),
 *  - which GLB trio the 3D scene loads (`/models/{frame,fc,esc}<key>.glb`),
 *  - which size variant of the FC + ESC products the reveal cards link to (and
 *    price). The FC and ESC are single Shopify products with a "Model" variant
 *    axis — `30×30` (5") and `20×20` (3", "mini"); there is NO separate -mini
 *    product, so a size's cards point at the same handle with `?Model=<model>`.
 *
 * Adding a drone size is config-only: add an entry here, ship the three GLBs
 * named for its `key`, and add the matching `<model>` variant on the FC/ESC
 * products. Nothing else in the hero hardcodes the size list.
 *
 * NOTE: the slider's 1:1 drag-scrub (and the 3D cross-slide it feeds) is tuned
 * for two positions. A 3rd size renders fine as a third click-to-select option
 * and swaps correctly; only the drag gesture would need a segmented rework.
 */
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

export const HERO_AIRFRAMES: HeroAirframe[] = [
  {key: '5', label: '5″ Freestyle', model: '30×30'},
  {key: '3', label: '3″ Freestyle', model: '20×20'},
];

export const HERO_AIRFRAME_KEYS: string[] = HERO_AIRFRAMES.map((a) => a.key);
export const DEFAULT_HERO_SIZE: string = HERO_AIRFRAMES[0].key;

export function findAirframe(key: string): HeroAirframe | undefined {
  return HERO_AIRFRAMES.find((a) => a.key === key);
}

/**
 * The three boards each size's hero stack shows, in render/spotlight order
 * (FC → ESC → Frame — matches the scroll reveal order in the 3D scene).
 *
 * `sizeVariant` boards link to the active size's `Model` variant and show that
 * variant's price; the frame is one SKU shared across sizes (its 3D model
 * differs per size, the product doesn't).
 */
export const HERO_BOARDS = [
  {boardKey: 'fc', handle: 'openfc-lite', sizeVariant: true},
  {boardKey: 'esc', handle: 'openesc', sizeVariant: true},
  {boardKey: 'frame', handle: 'openframe', sizeVariant: false},
] as const;

export type HeroBoardKey = (typeof HERO_BOARDS)[number]['boardKey'];

/** The Shopify "Model" axis name the FC/ESC variants use. */
export const HERO_VARIANT_AXIS = 'Model';
