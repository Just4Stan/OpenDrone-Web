// Single source of truth for the PDP teardown variant-swap timing. Both the CSS
// (pushed as custom properties onto the .board-art root) and the JS settle
// backstop read THESE numbers, so a duration change is a one-line edit here with
// no magic numbers drifting out of sync. See BoardArt.tsx (the swap reducer) and
// app.css (the @media swap block that consumes --swap-dur/--swap-stagger/--swap-exit).
//
// The swap is TWO sequential phases: the old board flies OUT (exitS + stagger),
// then the new board flies IN (durS + stagger) — the incoming is delayed by the
// outgoing's full flight (--swap-in-delay) so the two never overlap.
export const SWAP_TIMING = {
  /** Incoming layer fly-in duration (seconds). */
  durS: 0.45,
  /** Per-layer --depth stagger (seconds) — shared by the in + out animations. */
  staggerS: 0.06,
  /** Outgoing layer fly-out (shove) duration (seconds). */
  exitS: 0.45,
} as const;

/**
 * When the LAST (deepest) outgoing layer's fly-out ends (seconds) — i.e. how long
 * the whole OUT phase takes, which is exactly the delay the IN phase waits so the
 * old board is gone before the new one arrives. `layers` = outgoing layer count
 * (1 for the mobile whole-board slide).
 */
export function swapInDelayS(layers: number): number {
  return Math.max(0, layers - 1) * SWAP_TIMING.staggerS + SWAP_TIMING.exitS;
}

/**
 * Backstop deadline (ms) for a swap whose old board has `outLayers` and new board
 * has `inLayers`: the moment the LAST incoming layer lands (out phase + in phase),
 * plus a cushion. The swap settles on real board-swap-in `animationend` counting;
 * this is only a safety net for a dropped event (e.g. a backgrounded tab) so the
 * swap can never hang.
 */
export function swapSettleBackstopMs(outLayers: number, inLayers: number): number {
  const lastInLandS =
    swapInDelayS(outLayers) +
    Math.max(0, inLayers - 1) * SWAP_TIMING.staggerS +
    SWAP_TIMING.durS;
  return Math.round(lastInLandS * 1000) + 350;
}
