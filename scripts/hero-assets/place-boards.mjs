// Drop the KiCad-built board GLBs into the Onshape assembly's coordinate frame.
//
// build-hero.mjs culls the Onshape board geometry (a STEP round-trip through
// Onshape loses silkscreen, soldermask and pad colour) and records where each
// board sat in `placement.json`. This step takes that placement and moves the
// matching kicad-cli GLB to the same spot, so the runtime just loads a file and
// adds it to the scene with no positioning logic of its own.
//
// Onshape works in metres, KiCad in millimetres, hence the 0.001 scale. The
// boards are mounted flat and axis-aligned, which build-hero verifies by
// matching each board's Onshape extent against its pcbnew outline in the same
// axis order; a 90-degree yaw would swap X and Y and fail that check.
//
// Geometry is never mutated here; the placement goes on a wrapper node instead.
// transformMesh() would be wrong: export-boards.mjs leaves meshes shared across
// several nodes, and baking one node's matrix into a shared mesh applies it to
// every other user of that mesh too. build.mjs carries the same warning.
//
// Usage:
//   node place-boards.mjs <placement.json> <outdir> <key>=<board.glb> [...]

import {makeIO} from './io.mjs';
import {meshopt, prune, dedup} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import {readFileSync, statSync, mkdirSync, existsSync} from 'node:fs';
import {join as pjoin} from 'node:path';

await MeshoptEncoder.ready;

const [placementPath, outDir, ...pairs] = process.argv.slice(2);
if (!placementPath || !outDir || !pairs.length) {
  console.error('usage: place-boards.mjs <placement.json> <outdir> <key>=<board.glb> [...]');
  process.exit(1);
}
mkdirSync(outDir, {recursive: true});
const placement = JSON.parse(readFileSync(placementPath, 'utf8'));
const io = await makeIO();

// kicad-cli emits glTF in metres and Onshape exports in metres, so no unit
// conversion is needed. The bounds sidecar reports size in mm for the
// human-readable outline check only.
const KICAD_TO_ONSHAPE = 1.0;

// kicad-cli writes Y-up (the glTF convention); Onshape assemblies are Z-up. A
// board therefore needs -90 degrees about X to stand up correctly, plus however
// it happens to be yawed in the airframe. Rather than hardcode that per board,
// try the four right-angle yaws and keep whichever reproduces the XY extent
// Onshape measured. Quaternions are [x, y, z, w].
const SQRT_HALF = Math.SQRT1_2;
const YAW_CHOICES = [
  {deg: 0,   q: [-SQRT_HALF, 0, 0, SQRT_HALF]},
  {deg: 90,  q: [-0.5, -0.5, -0.5, 0.5]},
  {deg: 180, q: [0, -SQRT_HALF, -SQRT_HALF, 0]},
  {deg: 270, q: [0.5, -0.5, -0.5, -0.5]},
];
// Extent of a Y-up box after the Y-up->Z-up fix plus `deg` of yaw.
function extentAfter(sizeYUp, deg) {
  const [x, y, z] = sizeYUp;          // kicad: x = width, y = thickness, z = length
  const zUp = [x, z, y];              // after -90 about X
  return deg % 180 === 0 ? zUp : [zUp[1], zUp[0], zUp[2]];
}

// ---- column-major mat4, matching build-hero.mjs ----
function compose(t, r, sc) {
  const [x, y, z, w] = r;
  const x2=x+x, y2=y+y, z2=z+z, xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2, wx=w*x2, wy=w*y2, wz=w*z2;
  const [sx, sy, sz] = sc;
  return [(1-(yy+zz))*sx, (xy+wz)*sx, (xz-wy)*sx, 0,
          (xy-wz)*sy, (1-(xx+zz))*sy, (yz+wx)*sy, 0,
          (xz+wy)*sz, (yz-wx)*sz, (1-(xx+yy))*sz, 0,
          t[0], t[1], t[2], 1];
}
const I4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0; for (let k = 0; k < 4; k++) v += a[k*4+r] * b[c*4+k]; o[c*4+r] = v;
  }
  return o;
}
const tp = (m, [x, y, z]) => [
  m[0]*x + m[4]*y + m[8]*z + m[12],
  m[1]*x + m[5]*y + m[9]*z + m[13],
  m[2]*x + m[6]*y + m[10]*z + m[14],
];

// Non-destructive world-space bbox over a subtree.
function subtreeBbox(node, M, acc) {
  const W = mul(M, compose(node.getTranslation(), node.getRotation(), node.getScale()));
  const mesh = node.getMesh();
  if (mesh) for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION');
    if (!pos) continue;
    const lo = pos.getMin([]), hi = pos.getMax([]);
    for (let xi = 0; xi < 2; xi++) for (let yi = 0; yi < 2; yi++) for (let zi = 0; zi < 2; zi++) {
      const q = tp(W, [xi?hi[0]:lo[0], yi?hi[1]:lo[1], zi?hi[2]:lo[2]]);
      for (let i = 0; i < 3; i++) { acc.min[i] = Math.min(acc.min[i], q[i]); acc.max[i] = Math.max(acc.max[i], q[i]); }
    }
  }
  for (const c of node.listChildren()) subtreeBbox(c, W, acc);
  return acc;
}

let failures = 0;

for (const pair of pairs) {
  const eq = pair.indexOf('=');
  const key = pair.slice(0, eq);
  const src = pair.slice(eq + 1);
  const target = placement[key];
  if (!target) {
    console.log(`  SKIP ${key}: not in placement.json (have: ${Object.keys(placement).join(', ')})`);
    failures++;
    continue;
  }

  const doc = await io.read(src);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];

  // True millimetres come from the sidecar export-boards.mjs writes before
  // meshopt() compresses. Re-measuring the finished GLB is unreliable: meshopt
  // quantizes internally, normalising each mesh into its own unit cube with the
  // real scale on that mesh's node.
  const boundsPath = src.replace(/\.glb$/, '.bounds.json');
  if (!existsSync(boundsPath)) {
    console.log(`  SKIP ${key}: missing ${boundsPath.split('/').pop()} (re-run export-boards.mjs)`);
    failures++;
    continue;
  }
  const bounds = JSON.parse(readFileSync(boundsPath, 'utf8'));
  const srcCentre = bounds.centre_m;   // metres
  const srcSize = bounds.size_mm;      // mm, for the outline check

  const want = target.size_mm;
  let best = null;
  for (const cand of YAW_CHOICES) {
    const ext = extentAfter(srcSize, cand.deg);
    const err = Math.max(...[0, 1, 2].map((i) => Math.abs(ext[i] - want[i])));
    if (!best || err < best.err) best = {...cand, ext, err};
  }
  const ok = best.err < 1.0;
  if (!ok) failures++;
  // A square board matches at every yaw, so extent cannot tell us which way the
  // silkscreen faces. Flag it; --yaw <key>=<deg> forces a specific one.
  const square = Math.abs(srcSize[0] - srcSize[2]) < 1.0;
  const override = process.argv
    .filter((a) => a.startsWith('--yaw'))
    .map((a) => process.argv[process.argv.indexOf(a) + 1])
    .map((v) => (v ?? '').split('='))
    .find(([k]) => k === key);
  if (override) best = {...YAW_CHOICES.find((c) => c.deg === Number(override[1])), ext: best.ext, err: best.err};
  console.log(
    `  ${key.padEnd(14)} kicad ${srcSize.map(v=>v.toFixed(2)).join(' x ')} mm (Y-up)` +
    `  ->  yaw ${String(best.deg).padStart(3)} deg  gives ${best.ext.map(v=>v.toFixed(2)).join(' x ')}` +
    `  vs onshape ${want.join(' x ')}  ${ok ? 'MATCH' : '*** MISMATCH ***'}` +
    `${square ? '  [square: yaw not determinable from extent]' : ''}`
  );

  // Wrapper node: centre the board on its own origin, scale mm to m, translate
  // to the Onshape centre. A transform, so shared meshes stay shared.
  // Two nested nodes: the inner one recentres the board on its own origin, the
  // outer one rotates it upright and drops it at the Onshape centre. Keeping
  // them separate means the rotation pivots about the board centre, not the
  // KiCad page origin.
  const recentre = doc.createNode(`${key}-recentre`)
    .setTranslation(srcCentre.map((v) => -v * KICAD_TO_ONSHAPE));
  const wrap = doc.createNode(`${key}-placed`)
    .setScale([KICAD_TO_ONSHAPE, KICAD_TO_ONSHAPE, KICAD_TO_ONSHAPE])
    .setRotation(best.q)
    .setTranslation(target.centre_m);
  wrap.addChild(recentre);
  for (const child of [...scene.listChildren()]) {
    scene.removeChild(child);
    recentre.addChild(child);
  }
  scene.addChild(wrap);

  await doc.transform(prune({keepAttributes: false}), dedup());
  await doc.transform(meshopt({encoder: MeshoptEncoder, level: 'high'}));
  const out = pjoin(outDir, `${key}.glb`);
  await io.write(out, doc);
  console.log(`     -> ${out.split('/').pop()}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

if (failures) {
  console.error(`\n${failures} board(s) failed the dimension check. Not safe to ship.`);
  process.exit(1);
}
