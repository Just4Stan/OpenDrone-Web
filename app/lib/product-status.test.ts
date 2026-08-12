import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  isComingSoon,
  resolveStatus,
  PRODUCT_CONTENT,
} from './product-content.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/product-status.test.ts

describe('resolveStatus', () => {
  it('follows the global flag only for handles off the roadmap', () => {
    assert.equal(resolveStatus('battery-strap', true), 'development');
    assert.equal(resolveStatus('battery-strap', false), 'live');
  });

  it('the roadmap decides for roadmap products, whatever the global flag', () => {
    // Static roadmap: every board is alpha today -> waitlist, no price,
    // on a locked AND an open shop alike.
    for (const flag of [true, false]) {
      assert.equal(resolveStatus('openesc', flag), 'development');
      assert.equal(resolveStatus('openrx', flag), 'development');
      assert.equal(isComingSoon('openesc', flag), true);
    }
  });

  it('a status-beta topic is the release act: price + orderable', () => {
    // The flag map is keyed by repo URL, as fetchStatusFlags returns it.
    // Beta unlocks even while the global pre-launch flag is still set.
    const flags = {
      'https://github.com/OpenDrone-hw/OpenESC-20x20': 'beta',
    } as const;
    assert.equal(resolveStatus('openesc', true, flags), 'live');
    assert.equal(isComingSoon('openesc', true, flags), false);
    // ...and moving it back down locks it again.
    const down = {
      'https://github.com/OpenDrone-hw/OpenESC-20x20': 'in-progress',
      'https://github.com/OpenDrone-hw/OpenESC-30x30': 'in-progress',
    } as const;
    assert.equal(resolveStatus('openesc', false, down), 'development');
  });

  it('a page with two boards sells on its furthest-along board', () => {
    // OpenESC page carries 20x20 and 30x30; one beta board is enough.
    const flags = {
      'https://github.com/OpenDrone-hw/OpenESC-30x30': 'beta',
    } as const;
    assert.equal(resolveStatus('openesc', true, flags), 'live');
  });

  it('treats unknown handles like unset products', () => {
    assert.equal(resolveStatus('no-such-product', true), 'development');
    assert.equal(resolveStatus(null, false), 'live');
    assert.equal(resolveStatus(undefined, true), 'development');
  });

  it('lets an explicit status override the global flag', () => {
    PRODUCT_CONTENT['__test-idea'] = {
      ...PRODUCT_CONTENT.openesc,
      status: 'idea',
    };
    PRODUCT_CONTENT['__test-live'] = {
      ...PRODUCT_CONTENT.openesc,
      status: 'live',
    };
    try {
      assert.equal(resolveStatus('__test-idea', false), 'idea');
      assert.equal(resolveStatus('__test-live', true), 'live');
    } finally {
      delete PRODUCT_CONTENT['__test-idea'];
      delete PRODUCT_CONTENT['__test-live'];
    }
  });

  it('maps the legacy comingSoon boolean when no status is set', () => {
    PRODUCT_CONTENT['__test-legacy'] = {
      ...PRODUCT_CONTENT.openesc,
      comingSoon: false,
    };
    try {
      assert.equal(resolveStatus('__test-legacy', true), 'live');
      PRODUCT_CONTENT['__test-legacy'].comingSoon = true;
      assert.equal(resolveStatus('__test-legacy', false), 'development');
    } finally {
      delete PRODUCT_CONTENT['__test-legacy'];
    }
  });

  it('explicit status beats the legacy boolean', () => {
    PRODUCT_CONTENT['__test-both'] = {
      ...PRODUCT_CONTENT.openesc,
      status: 'live',
      comingSoon: true,
    };
    try {
      assert.equal(resolveStatus('__test-both', true), 'live');
    } finally {
      delete PRODUCT_CONTENT['__test-both'];
    }
  });
});

describe('isComingSoon', () => {
  it('is true for every non-live status', () => {
    PRODUCT_CONTENT['__test-idea'] = {
      ...PRODUCT_CONTENT.openesc,
      status: 'idea',
    };
    try {
      assert.equal(isComingSoon('__test-idea', false), true);
      assert.equal(isComingSoon('openesc', true), true);
      // openesc is on the roadmap (alpha today) so the open-shop flag does
      // not unlock it; an off-roadmap accessory follows the flag.
      assert.equal(isComingSoon('openesc', false), true);
      assert.equal(isComingSoon('battery-strap', false), false);
    } finally {
      delete PRODUCT_CONTENT['__test-idea'];
    }
  });
});
