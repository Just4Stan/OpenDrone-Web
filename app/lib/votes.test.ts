import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  VOTE_ATTR_KEY,
  VOTE_MAX_CHOICES,
  VOTE_WEIGHTS,
  parseVoteRank,
  serializeVoteRank,
  voteShares,
} from './votes.ts';
import {ROADMAP, voteCandidateIds} from './roadmap-data.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/votes.test.ts

const IDS = ['openvtx', 'motors', 'charger', 'openaio'];

describe('vote rank codec', () => {
  it('round-trips a ranking', () => {
    const v = serializeVoteRank(['openvtx', 'motors', 'charger']);
    assert.equal(v, 'openvtx>motors>charger');
    assert.deepEqual(parseVoteRank(v, IDS), ['openvtx', 'motors', 'charger']);
  });

  it('drops unknown ids, duplicates and overflow, preserving order', () => {
    assert.deepEqual(
      parseVoteRank('bogus>motors>motors>openvtx>charger>openaio', IDS),
      ['motors', 'openvtx', 'charger'],
    );
  });

  it('returns [] for garbage and oversized values', () => {
    assert.deepEqual(parseVoteRank(undefined, IDS), []);
    assert.deepEqual(parseVoteRank(42, IDS), []);
    assert.deepEqual(parseVoteRank('', IDS), []);
    assert.deepEqual(parseVoteRank('x'.repeat(65), IDS), []);
  });

  it('every real candidate ranking fits the 64-char cart attribute cap', () => {
    const ids = voteCandidateIds();
    assert.ok(ids.length >= VOTE_MAX_CHOICES, 'need at least three candidates');
    const longest = [...ids]
      .sort((a, b) => b.length - a.length)
      .slice(0, VOTE_MAX_CHOICES);
    assert.ok(serializeVoteRank(longest).length <= 64);
  });

  it('no roadmap id contains the separator', () => {
    for (const r of ROADMAP) assert.ok(!r.id.includes('>'), r.id);
  });
});

describe('voteShares', () => {
  it('splits points into rounded percentages', () => {
    const shares = voteShares(
      {updated: '', ballots: 3, points: {openvtx: 6, motors: 3}},
      ['openvtx', 'motors', 'charger'],
    );
    assert.deepEqual(shares, {openvtx: 67, motors: 33, charger: 0});
  });

  it('is all zeros with no points', () => {
    const shares = voteShares({updated: '', ballots: 0, points: {}}, IDS);
    assert.ok(Object.values(shares).every((v) => v === 0));
  });
});

describe('tally script mirror', () => {
  // scripts/tally-votes.mjs cannot import this TS module, so it restates the
  // codec constants and the roadmap ids. This test fails when they drift.
  const script = fs.readFileSync(
    path.join(import.meta.dirname, '../../scripts/tally-votes.mjs'),
    'utf8',
  );

  it('uses the same attribute key, weights and separator', () => {
    assert.ok(script.includes(`VOTE_ATTR_KEY = '${VOTE_ATTR_KEY}'`));
    assert.ok(script.includes(`WEIGHTS = [${VOTE_WEIGHTS.join(', ')}]`));
    assert.ok(script.includes(`SEPARATOR = '>'`));
  });

  it('lists exactly the roadmap ids', () => {
    const m = script.match(/ROADMAP_IDS = new Set\(\[(.*?)\]\)/s);
    assert.ok(m, 'ROADMAP_IDS set not found in script');
    const scriptIds = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    const libIds = ROADMAP.map((r) => r.id).sort();
    assert.deepEqual(scriptIds, libIds);
  });
});
