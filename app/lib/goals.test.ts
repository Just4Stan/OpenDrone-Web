import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoal} from './goals.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/goals.test.ts

describe('normalizeGoal', () => {
  it('passes a well-formed goal through', () => {
    const g = normalizeGoal({
      id: 'pick-and-place',
      status: 'current',
      title: 'A pick and place machine',
      body: 'First step to EU assembly.',
      target_label: 'about €30k',
      progress_pct: 33,
    });
    assert.equal(g?.progress_pct, 33);
    assert.equal(g?.status, 'current');
  });

  it('clamps progress into 0-100 and rounds', () => {
    assert.equal(normalizeGoal({id: 'x', progress_pct: 140})?.progress_pct, 100);
    assert.equal(normalizeGoal({id: 'x', progress_pct: -5})?.progress_pct, 0);
    assert.equal(normalizeGoal({id: 'x', progress_pct: 12.6})?.progress_pct, 13);
  });

  it('defaults junk fields instead of failing the page', () => {
    const g = normalizeGoal({id: 'x', status: 'someday', progress_pct: 'lots'});
    assert.equal(g?.status, 'next');
    assert.equal(g?.progress_pct, 0);
    assert.equal(g?.title, '');
  });

  it('rejects records without an id', () => {
    assert.equal(normalizeGoal({title: 'no id'}), null);
    assert.equal(normalizeGoal(null), null);
    assert.equal(normalizeGoal('goal'), null);
  });
});
