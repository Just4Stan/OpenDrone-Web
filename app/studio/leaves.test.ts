import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {flattenLeaves, leafLabel, setLeaf} from './leaves.ts';

// Run with:
//   node --experimental-strip-types --test app/studio/leaves.test.ts

const PRODUCT = {
  $route: '/products/openesc',
  fileNumber: '01',
  hero: {line1: 'An ESC', line2Italic: '(or 4)', lead: 'Six mosfets.'},
  specs: [
    ['Continuous', '40 A / channel'],
    ['Input', '2-6S LiPo'],
  ],
  inTheBox: [{qty: '1×', item: 'OpenESC'}],
  stack: {discountPct: 10, adds: 'flight controller'},
  downloads: [],
};

describe('flattenLeaves', () => {
  it('finds every string, addressed by path', () => {
    const paths = flattenLeaves(PRODUCT).map((l) => l.path);
    assert.ok(paths.includes('hero.line1'));
    assert.ok(paths.includes('specs.0.1'));
    assert.ok(paths.includes('inTheBox.0.item'));
    assert.ok(paths.includes('stack.adds'));
  });

  it('skips reserved $ keys at the root', () => {
    assert.ok(!flattenLeaves(PRODUCT).some((l) => l.path.startsWith('$')));
  });

  it('skips numbers, so a count cannot be retyped as prose', () => {
    // `discountPct: 10` is configuration. Editing it in a words box is how a
    // page ends up with "ten".
    assert.ok(!flattenLeaves(PRODUCT).some((l) => l.path === 'stack.discountPct'));
  });

  it('handles an empty array without inventing a leaf', () => {
    assert.ok(!flattenLeaves(PRODUCT).some((l) => l.path.startsWith('downloads')));
  });

  it('reports depth so the list can be indented', () => {
    const byPath = Object.fromEntries(flattenLeaves(PRODUCT).map((l) => [l.path, l.depth]));
    assert.ok(byPath['specs.0.1'] > byPath['fileNumber']);
  });

  it('flattens a bare string and a bare array', () => {
    assert.deepEqual(flattenLeaves('hi'), [{path: '', value: 'hi', depth: 0}]);
    assert.equal(flattenLeaves(['a', 'b']).length, 2);
  });
});

describe('setLeaf', () => {
  it('changes one leaf and leaves the rest alone', () => {
    const next = setLeaf(PRODUCT, 'hero.line1', 'A different ESC');
    assert.equal(next.hero.line1, 'A different ESC');
    assert.equal(next.hero.lead, PRODUCT.hero.lead);
    assert.deepEqual(next.specs, PRODUCT.specs);
  });

  it('does not mutate the original', () => {
    const before = JSON.stringify(PRODUCT);
    setLeaf(PRODUCT, 'hero.line1', 'changed');
    assert.equal(JSON.stringify(PRODUCT), before);
  });

  it('writes through an array index', () => {
    const next = setLeaf(PRODUCT, 'specs.1.1', '2-8S LiPo');
    assert.deepEqual(next.specs[1], ['Input', '2-8S LiPo']);
    assert.deepEqual(next.specs[0], ['Continuous', '40 A / channel']);
  });

  it('writes into an object inside an array', () => {
    const next = setLeaf(PRODUCT, 'inTheBox.0.item', 'OpenESC 30x30');
    assert.equal(next.inTheBox[0].item, 'OpenESC 30x30');
    assert.equal(next.inTheBox[0].qty, '1×');
  });

  it('refuses to create structure that is not already there', () => {
    // An edit may only change a string in place. Inventing a spec row or a
    // variant as a side effect of a bad path is exactly what must not happen.
    assert.deepEqual(setLeaf(PRODUCT, 'hero.nope', 'x'), PRODUCT);
    assert.deepEqual(setLeaf(PRODUCT, 'specs.99.0', 'x'), PRODUCT);
    assert.deepEqual(setLeaf(PRODUCT, 'specs.-1.0', 'x'), PRODUCT);
    assert.deepEqual(setLeaf(PRODUCT, 'nothing.at.all', 'x'), PRODUCT);
  });

  it('ignores a non-numeric index into an array', () => {
    assert.deepEqual(setLeaf(PRODUCT, 'specs.first.0', 'x'), PRODUCT);
  });

  it('round-trips: flatten, set every leaf to itself, unchanged', () => {
    let out: typeof PRODUCT = PRODUCT;
    for (const l of flattenLeaves(PRODUCT)) out = setLeaf(out, l.path, l.value);
    assert.deepEqual(out, PRODUCT);
  });
});

describe('leafLabel', () => {
  it('keeps a plain key readable', () => {
    assert.equal(leafLabel('fileNumber'), 'fileNumber');
    assert.equal(leafLabel('hero.line1'), 'hero.line1');
  });

  it('folds a trailing index into its key', () => {
    assert.equal(leafLabel('s1_body.0'), 's1_body[0]');
  });

  it('keeps the parent visible when the index is in the middle', () => {
    assert.equal(leafLabel('specs.3.1'), 'specs 3·1');
  });
});
