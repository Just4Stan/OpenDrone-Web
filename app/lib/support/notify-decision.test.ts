import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  decideNotify,
  laterSnowflake,
  QUIET_PERIOD_MS,
  type SweepMessage,
} from './notify-decision.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/support/notify-decision.test.ts

const NOW = 1_800_000_000_000; // fixed "now" in ms
const OLD = NOW - QUIET_PERIOD_MS - 1000; // safely past the quiet period

function msg(over: Partial<SweepMessage> & {id: string}): SweepMessage {
  return {
    staff: false,
    customer: false,
    held: false,
    createdAtMs: OLD,
    firstName: 'Stan',
    content: 'hello',
    ...over,
  };
}

describe('decideNotify', () => {
  it('skips with no messages', () => {
    const d = decideNotify([], NOW);
    assert.deepEqual(d, {action: 'skip', reason: 'no-messages', nextCursor: null});
  });

  it('emails settled staff replies and advances the cursor', () => {
    const d = decideNotify(
      [msg({id: '10', staff: true}), msg({id: '11', staff: true})],
      NOW,
    );
    assert.equal(d.action, 'email');
    if (d.action === 'email') {
      assert.equal(d.include.length, 2);
      assert.equal(d.nextCursor, '11');
    }
  });

  it('defers inside the quiet period without advancing', () => {
    const d = decideNotify(
      [msg({id: '10', staff: true, createdAtMs: NOW - 1000})],
      NOW,
    );
    assert.deepEqual(d, {action: 'defer', reason: 'quiet-period'});
  });

  it('a fresh follow-up re-opens the quiet period for the whole batch', () => {
    const d = decideNotify(
      [
        msg({id: '10', staff: true}),
        msg({id: '11', staff: true, createdAtMs: NOW - 1000}),
      ],
      NOW,
    );
    assert.equal(d.action, 'defer');
  });

  it('skips without email when the customer replied after staff', () => {
    const d = decideNotify(
      [msg({id: '10', staff: true}), msg({id: '11', customer: true})],
      NOW,
    );
    assert.deepEqual(d, {
      action: 'skip',
      reason: 'customer-replied',
      nextCursor: '11',
    });
  });

  it('still emails when staff replied again after the customer', () => {
    const d = decideNotify(
      [
        msg({id: '10', staff: true}),
        msg({id: '11', customer: true}),
        msg({id: '12', staff: true}),
      ],
      NOW,
    );
    assert.equal(d.action, 'email');
    if (d.action === 'email') assert.equal(d.nextCursor, '12');
  });

  it('advances past customer-only windows without emailing', () => {
    const d = decideNotify([msg({id: '10', customer: true})], NOW);
    assert.deepEqual(d, {action: 'skip', reason: 'no-staff', nextCursor: '10'});
  });

  it('never advances past a held message', () => {
    const d = decideNotify(
      [msg({id: '10', staff: true}), msg({id: '11', held: true}), msg({id: '12', staff: true})],
      NOW,
    );
    assert.equal(d.action, 'email');
    if (d.action === 'email') {
      assert.deepEqual(d.include.map((m) => m.id), ['10']);
      assert.equal(d.nextCursor, '10');
    }
  });

  it('defers entirely when the oldest unseen message is held', () => {
    const d = decideNotify(
      [msg({id: '10', held: true}), msg({id: '11', staff: true})],
      NOW,
    );
    assert.deepEqual(d, {action: 'defer', reason: 'held-first'});
  });

  it('snowflake ordering is numeric, not lexicographic', () => {
    const d = decideNotify(
      [msg({id: '9', staff: true}), msg({id: '10', customer: true})],
      NOW,
    );
    assert.equal(d.action, 'skip');
    if (d.action === 'skip') assert.equal(d.reason, 'customer-replied');
  });
});

describe('laterSnowflake', () => {
  it('handles unset sides', () => {
    assert.equal(laterSnowflake(undefined, '5'), '5');
    assert.equal(laterSnowflake('5', undefined), '5');
    assert.equal(laterSnowflake(undefined, undefined), undefined);
  });
  it('compares numerically', () => {
    assert.equal(laterSnowflake('9', '10'), '10');
    assert.equal(laterSnowflake('10', '9'), '10');
  });
});
