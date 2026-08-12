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
  it('follows the global flag when a product sets nothing', () => {
    assert.equal(resolveStatus('openesc', true), 'development');
    assert.equal(resolveStatus('openesc', false), 'live');
  });

  it('lets the roadmap decide once the shop is open', () => {
    // Static roadmap: both ESCs are beta -> live; OpenRX is alpha -> a
    // locked page with the waitlist, even though the shop is open.
    assert.equal(resolveStatus('openesc', false), 'live');
    assert.equal(resolveStatus('openrx', false), 'development');
  });

  it('never lets the roadmap unlock a sale past the global gate', () => {
    // Shop still pre-launch: a beta board presents as coming soon.
    assert.equal(resolveStatus('openesc', true), 'development');
    assert.equal(isComingSoon('openesc', true), true);
  });

  it('follows a live topic flag over the static status', () => {
    // A repo topic moving OpenRX to beta puts its price on the page; the
    // flag map is keyed by repo URL, as fetchStatusFlags returns it.
    const flags = {
      'https://github.com/OpenDrone-hw/OpenRX': 'beta',
    } as const;
    assert.equal(resolveStatus('openrx', false, flags), 'live');
    // ...and moving it back down locks it again.
    const down = {
      'https://github.com/OpenDrone-hw/OpenRX': 'in-progress',
    } as const;
    assert.equal(resolveStatus('openrx', false, down), 'development');
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
      assert.equal(isComingSoon('openesc', false), false);
    } finally {
      delete PRODUCT_CONTENT['__test-idea'];
    }
  });
});
