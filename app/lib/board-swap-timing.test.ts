import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYER_SWEEP,
  SWAP_TIMING,
  layerSweepDelays,
  swapInDelayS,
  swapSettleBackstopMs,
} from './board-swap-timing.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/board-swap-timing.test.ts

describe('swapInDelayS', () => {
  it('is the exit duration alone for a single layer', () => {
    // The mobile board swaps as one element: no stagger to wait on.
    assert.equal(swapInDelayS(1), SWAP_TIMING.exitS);
  });

  it('adds one stagger per layer beyond the first', () => {
    assert.equal(swapInDelayS(3), 2 * SWAP_TIMING.staggerS + SWAP_TIMING.exitS);
  });

  it('never goes below the exit duration', () => {
    assert.equal(swapInDelayS(0), SWAP_TIMING.exitS);
  });
});

describe('swapSettleBackstopMs', () => {
  it('covers both phases plus a cushion', () => {
    // Out phase (4 layers) then in phase (8 layers), so the backstop must be
    // longer than either phase measured on its own.
    const both = swapSettleBackstopMs(4, 8);
    assert.ok(both > swapInDelayS(4) * 1000);
    assert.ok(both > swapInDelayS(8) * 1000);
  });

  it('grows with the deeper board', () => {
    assert.ok(swapSettleBackstopMs(4, 8) > swapSettleBackstopMs(4, 4));
  });
});

describe('layerSweepDelays', () => {
  it('returns one delay per step', () => {
    assert.equal(layerSweepDelays(7).length, 7);
    assert.equal(layerSweepDelays(1).length, 1);
  });

  it('has nothing to schedule for a zero or negative sweep', () => {
    assert.deepEqual(layerSweepDelays(0), []);
    assert.deepEqual(layerSweepDelays(-2), []);
  });

  it('spends exactly the per-step budget in total', () => {
    // Easing redistributes the budget across the steps, it never changes it,
    // so the sweep still scales with distance rather than running long on a
    // deep board.
    for (const steps of [1, 2, 3, 7, 11]) {
      const total = layerSweepDelays(steps).reduce((a, b) => a + b, 0);
      assert.ok(
        Math.abs(total - steps * LAYER_SWEEP.perStepMs) < 1e-9,
        `${steps} steps summed to ${total}`,
      );
    }
  });

  it('accelerates hard and settles: every gap is longer than the last', () => {
    const d = layerSweepDelays(7);
    for (let i = 1; i < d.length; i++) {
      assert.ok(d[i] > d[i - 1], `step ${i} (${d[i]}) did not slow from ${d[i - 1]}`);
    }
  });

  it('opens well inside a frame budget and ends on a long settle', () => {
    // The shape Stan asked for: the first layers go by in a couple of frames,
    // the last takes roughly half the whole sweep.
    const d = layerSweepDelays(7);
    const total = d.reduce((a, b) => a + b, 0);
    assert.ok(d[0] < 34, `first gap was ${d[0]}ms, wanted under two frames`);
    assert.ok(d[6] > total * 0.4, `settle was ${d[6]}ms of ${total}ms`);
  });

  it('a single-layer flip is a plain per-step delay, no curve to apply', () => {
    assert.deepEqual(layerSweepDelays(1), [LAYER_SWEEP.perStepMs]);
  });

  it('holds the 80% budget the sweep was retuned to', () => {
    // A flat 95ms interval was the old behaviour; the eased sweep was asked to
    // land at 80% of that. Guards against a perStepMs edit quietly undoing it.
    const total = layerSweepDelays(7).reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(total / (7 * 95) - 0.8) < 0.01,
      `full traverse is ${Math.round(total)}ms, ${Math.round((total / 665) * 100)}% of the old 665ms`,
    );
  });
});
