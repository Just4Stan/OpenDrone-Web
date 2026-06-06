import {NodeIO} from '@gltf-transform/core';

const src = process.argv[2];
if (!src) {
  console.error('usage: node inspect-tree.mjs <file.gltf>');
  process.exit(1);
}

const io = new NodeIO();
console.error(`reading ${src} ...`);
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// Aggregate vertex counts per top-level subtree so we can see how big
// each named branch is and decide the frame/fc/esc bucketing.
function vertsOf(node) {
  let v = 0;
  const mesh = node.getMesh();
  if (mesh) {
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      if (pos) v += pos.getCount();
    }
  }
  for (const c of node.listChildren()) v += vertsOf(c);
  return v;
}
function meshCount(node) {
  let n = node.getMesh() ? 1 : 0;
  for (const c of node.listChildren()) n += meshCount(c);
  return n;
}

function dump(node, depth, maxDepth) {
  const pad = '  '.repeat(depth);
  const name = node.getName() || '(unnamed)';
  const kids = node.listChildren();
  const t = node.getTranslation();
  console.log(
    `${pad}${name}  [kids:${kids.length} meshes:${meshCount(node)} verts:${vertsOf(node).toLocaleString()}]  t=[${t.map((x) => x.toFixed(3)).join(',')}]`,
  );
  if (depth < maxDepth) {
    // Only descend into branch nodes (those with children); collapse leaves.
    for (const c of kids) dump(c, depth + 1, maxDepth);
  }
}

console.log('=== SCENE ROOTS ===');
for (const n of scene.listChildren()) {
  dump(n, 0, 2);
}

// Histogram of leaf node names (group by stripped suffix) to find the
// natural product buckets.
const nameCount = new Map();
scene.traverse((node) => {
  const nm = (node.getName() || '').replace(/_\d+$/, '').replace(/\s+\d+$/, '');
  nameCount.set(nm, (nameCount.get(nm) || 0) + 1);
});
console.log('\n=== NAME HISTOGRAM (stripped trailing index) ===');
[...nameCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 60)
  .forEach(([n, c]) => console.log(`${String(c).padStart(5)}  ${n}`));
