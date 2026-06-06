import {makeIO} from './io.mjs';

const src = process.argv[2];
const io = await makeIO();
const doc = await io.read(src);
const scene = doc.getRoot().listScenes()[0];

// --- minimal mat4 (column-major) ---
function compose(t, r, s) {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
  return o;
}
function tp(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
const local = (n) => compose(n.getTranslation(), n.getRotation(), n.getScale());

function meshLocalBboxCenter(node) {
  const mesh = node.getMesh();
  if (!mesh) return null;
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION');
    const a = pos.getMin([]), b = pos.getMax([]);
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a[i]); mx[i] = Math.max(mx[i], b[i]); }
  }
  return [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
}

// occurrence -> descend, accumulate world matrix, find mesh leaf centroid
function worldCentroid(occ) {
  let stack = [[occ, mul(compose([0,0,0],[0,0,0,1],[1,1,1]), local(occ))]];
  while (stack.length) {
    const [node, M] = stack.pop();
    const c = meshLocalBboxCenter(node);
    if (c) return tp(M, c);
    for (const ch of node.listChildren()) stack.push([ch, mul(M, local(ch))]);
  }
  return null;
}

const assembly = scene.listChildren()[0];
const occurrences = assembly.listChildren();

const cats = {fc: [], esc: [], frame: [], other: []};
const FRAME_RE = /^(Body|Arm|motor|22x6|\d+x\d+|Lens|stack|battery|Top|prop|Standoff|screw|nut|washer|bolt|Plate|cam)/i;
occurrences.forEach((node) => {
  const nm = (node.getName() || '').replace(/^occurrence of /, '');
  const c = worldCentroid(node);
  if (!c) return;
  let cat;
  if (/OpenFC/i.test(nm)) cat = 'fc';
  else if (/4in1/i.test(nm)) cat = 'esc';
  else if (FRAME_RE.test(nm)) cat = 'frame';
  else cat = 'other';
  cats[cat].push({nm, c});
});

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function stats(arr) {
  if (!arr.length) return 'empty';
  const ax = (i) => arr.map((o) => o.c[i]);
  const f = (xs) => `[${Math.min(...xs).toFixed(3)}..${Math.max(...xs).toFixed(3)}] µ${mean(xs).toFixed(3)}`;
  return `n=${String(arr.length).padStart(4)}  x ${f(ax(0))}  y ${f(ax(1))}  z ${f(ax(2))}`;
}
for (const k of Object.keys(cats)) console.log(`${k.toUpperCase().padEnd(6)} ${stats(cats[k])}`);

console.log('\nFRAME parts (name @ centroid):');
cats.frame.forEach((o) => console.log(`  ${o.nm.padEnd(14)} [${o.c.map((x) => x.toFixed(3)).join(', ')}]`));

const fcAnchor = [0, 1, 2].map((i) => mean(cats.fc.map((o) => o.c[i])));
const escAnchor = [0, 1, 2].map((i) => mean(cats.esc.map((o) => o.c[i])));
console.log(`\nFC  anchor [${fcAnchor.map((x) => x.toFixed(4)).join(', ')}]`);
console.log(`ESC anchor [${escAnchor.map((x) => x.toFixed(4)).join(', ')}]`);
const d2 = (a, b) => a.reduce((s, _, i) => s + (a[i] - b[i]) ** 2, 0);
let nf = 0, ne = 0;
cats.other.forEach((o) => (d2(o.c, fcAnchor) < d2(o.c, escAnchor) ? nf++ : ne++));
console.log(`unassigned SMD components: ${cats.other.length}  -> nearer FC: ${nf}  nearer ESC: ${ne}`);
// distinguish boards by which axis separates them
console.log('FC vs ESC anchor delta:', fcAnchor.map((v, i) => (v - escAnchor[i]).toFixed(4)).join(', '));
