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
