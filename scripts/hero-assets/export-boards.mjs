// Build web-ready board GLBs straight from KiCad, bypassing Onshape.
//
// Why this exists: routing a PCB through Onshape loses silkscreen, soldermask
// and per-material colour (STEP carries none of it), which is why the older
// Onshape-sourced fc*/esc*.glb render as flat grey-green with no legend.
// kicad-cli emits all of it, and smaller, once traces and via holes are dropped.
//
// Export flags, and why:
//   --include-pads          exposed copper (recoloured to ENIG gold below)
//   --include-silkscreen    the legend
//   --include-soldermask    green surface with cutouts around pads and text
//   --fill-all-vias         do NOT cut via holes in the copper layer
//   --no-dnp --no-unspecified   never render unpopulated parts
// Deliberately omitted: --include-tracks (41 MB vs 6.9 MB, invisible under
// mask), --include-zones, --include-inner-copper, --cut-vias-in-body.
//
// Usage:
//   node export-boards.mjs <board.kicad_pcb> <out.glb> [--ratio 0.5] [--keep-vias]

import {makeIO} from './io.mjs';
import {dedup, weld, prune, meshopt, flatten, join, simplify} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import {execFileSync} from 'node:child_process';
import {statSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join as pjoin} from 'node:path';

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const KICAD_CLI = process.env.KICAD_CLI
  ?? '/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli';

// ENIG gold. KiCad exports pads as 0.5 grey, which reads as bare tin.
const GOLD = [0.90, 0.72, 0.36, 1.0];
const GOLD_METALLIC = 1.0;
const GOLD_ROUGHNESS = 0.30;

// Meshes whose materials belong to the bare board rather than a component.
// KiCad names them "<boardname>_pad" / "_silkscreen" / "_soldermask" / "_PCB".
const BOARD_MESH = /_(pad|silkscreen|soldermask|PCB)$/;
const PAD_MESH = /_pad$/;

// World-space bbox of the BARE BOARD, walking node transforms. kicad-cli emits
// glTF in metres, so this returns metres.
//
// Substrate meshes only (_PCB/_soldermask/_silkscreen/_pad). Component models
// are excluded on purpose: several boards carry footprints whose 3D model has a
// bogus offset baked in by easyeda2kicad (OpenFC-Lite-Mini D10/D3 and
// OpenRX-Mono U4 sit ~1.2 m off), which would blow up the bounding box. Those
// strays are culled separately below; this measurement must not see them.
//
// Must run before meshopt(), which quantizes each mesh into its own unit cube
// with the real scale parked on that mesh's node.
// Board BODY only. Silkscreen legend and pads can overhang the edge cuts by a
// couple of millimetres (reference designators near the rim), which inflates
// the outline and breaks the cross-check against Onshape.
const SUBSTRATE_MESH = /_PCB$/;
function measureMM(doc) {
  const compose = (t, r, sc) => {
    const [x,y,z,w] = r;
    const x2=x+x,y2=y+y,z2=z+z, xx=x*x2,xy=x*y2,xz=x*z2, yy=y*y2,yz=y*z2,zz=z*z2, wx=w*x2,wy=w*y2,wz=w*z2;
    const [sx,sy,sz] = sc;
    return [(1-(yy+zz))*sx,(xy+wz)*sx,(xz-wy)*sx,0, (xy-wz)*sy,(1-(xx+zz))*sy,(yz+wx)*sy,0,
            (xz+wy)*sz,(yz-wx)*sz,(1-(xx+yy))*sz,0, t[0],t[1],t[2],1];
  };
  const mul = (a,b) => { const o=new Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];o[c*4+r]=v;} return o; };
  const tp = (m,[x,y,z]) => [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
  const I4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  const walk = (node, M) => {
    const W = mul(M, compose(node.getTranslation(), node.getRotation(), node.getScale()));
    const mesh = node.getMesh();
    if (mesh && SUBSTRATE_MESH.test(mesh.getName() ?? '')) for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'); if (!pos) continue;
      const lo = pos.getMin([]), hi = pos.getMax([]);
      for (let xi=0;xi<2;xi++) for (let yi=0;yi<2;yi++) for (let zi=0;zi<2;zi++) {
        const q = tp(W, [xi?hi[0]:lo[0], yi?hi[1]:lo[1], zi?hi[2]:lo[2]]);
        for (let i=0;i<3;i++){ min[i]=Math.min(min[i],q[i]); max[i]=Math.max(max[i],q[i]); }
      }
    }
    for (const c of node.listChildren()) walk(c, W);
  };
  for (const sc of doc.getRoot().listScenes()) for (const n of sc.listChildren()) walk(n, I4);
  return {
    centre_m: min.map((v,i) => +((v + max[i]) / 2).toFixed(6)),
    size_mm:  min.map((v,i) => +((max[i] - v) * 1000).toFixed(2)),
  };
}

// Remove nodes whose geometry sits beyond `radius` metres of the origin,
// measured in world space over the whole tree.
function cullFarNodes(doc, radius) {
  const compose = (t, r, sc) => {
    const [x,y,z,w] = r;
    const x2=x+x,y2=y+y,z2=z+z, xx=x*x2,xy=x*y2,xz=x*z2, yy=y*y2,yz=y*z2,zz=z*z2, wx=w*x2,wy=w*y2,wz=w*z2;
    const [sx,sy,sz] = sc;
    return [(1-(yy+zz))*sx,(xy+wz)*sx,(xz-wy)*sx,0, (xy-wz)*sy,(1-(xx+zz))*sy,(yz+wx)*sy,0,
            (xz+wy)*sz,(yz-wx)*sz,(1-(xx+yy))*sz,0, t[0],t[1],t[2],1];
  };
  const mul = (a,b) => { const o=new Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];o[c*4+r]=v;} return o; };
  const I4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const doomed = [];
  const visit = (node, M) => {
    const W = mul(M, compose(node.getTranslation(), node.getRotation(), node.getScale()));
    const dist = Math.hypot(W[12], W[13], W[14]);
    if (node.getMesh() && dist > radius) {
      doomed.push({node, name: node.getName() || node.getMesh().getName() || '?', dist});
      return; // whole subtree goes
    }
    for (const c of node.listChildren()) visit(c, W);
  };
  for (const sc of doc.getRoot().listScenes()) for (const n of [...sc.listChildren()]) visit(n, I4);
  const seen = new Set();
  const out = [];
  for (const d of doomed) {
    if (seen.has(d.name)) continue;
    seen.add(d.name);
    out.push(d);
  }
  for (const d of doomed) disposeSubtree(d.node);
  return out;
}

/* Clamp pad/silk/mask vertices that overshoot the routed board edge back onto
 * the true Edge.Cuts outline (from pcbnew via scripts/board-outline.py). The
 * boards deliberately draw pads past the edge for JLCPCB's flush CNC trim, so
 * the exported geometry must be cut the same way the fab cuts the copper.
 * Only board LAYERS are clipped; component bodies legitimately overhang. */
const CLIP_MESH = /_(pad|silkscreen|soldermask)$/;

function mat4Mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
  return o;
}
function mat4InvAffine(m) {
  // Inverse of a column-major affine matrix (rotation+scale+translation).
  const a = [m[0], m[1], m[2]], b = [m[4], m[5], m[6]], c = [m[8], m[9], m[10]];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - b[0] * (a[1] * c[2] - a[2] * c[1]) + c[0] * (a[1] * b[2] - a[2] * b[1]);
  const i = 1 / det;
  const r = [
    (b[1] * c[2] - b[2] * c[1]) * i, (a[2] * c[1] - a[1] * c[2]) * i, (a[1] * b[2] - a[2] * b[1]) * i,
    (b[2] * c[0] - b[0] * c[2]) * i, (a[0] * c[2] - a[2] * c[0]) * i, (a[2] * b[0] - a[0] * b[2]) * i,
    (b[0] * c[1] - b[1] * c[0]) * i, (a[1] * c[0] - a[0] * c[1]) * i, (a[0] * b[1] - a[1] * b[0]) * i,
  ];
  const t = [m[12], m[13], m[14]];
  return [
    r[0], r[1], r[2], 0,
    r[3], r[4], r[5], 0,
    r[6], r[7], r[8], 0,
    -(r[0] * t[0] + r[3] * t[1] + r[6] * t[2]),
    -(r[1] * t[0] + r[4] * t[1] + r[7] * t[2]),
    -(r[2] * t[0] + r[5] * t[1] + r[8] * t[2]),
    1,
  ];
}
const mat4Apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
function worldMatrix(node) {
  let m = node.getMatrix();
  for (let p = node.getParentNode?.(); p; p = p.getParentNode?.()) m = mat4Mul(p.getMatrix(), m);
  return m;
}
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function nearestOnRing(pt, ring) {
  let best = null, bd = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i];
    const dx = x2 - x1, dy = y2 - y1;
    const L2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / L2));
    const px = x1 + t * dx, py = y1 + t * dy;
    const d = (pt[0] - px) ** 2 + (pt[1] - py) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}

function clipBoardLayersToOutline(doc, pcbPath) {
  const KICAD_PYTHON = process.env.KICAD_PYTHON
    ?? '/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3';
  const outlineScript = new URL('../board-outline.py', import.meta.url).pathname;
  let outline;
  try {
    outline = JSON.parse(execFileSync(KICAD_PYTHON, [outlineScript, pcbPath], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch (err) {
    console.log('  clip        SKIPPED: board-outline.py failed:', String(err).split('\n')[0]);
    return;
  }
  const ring = outline.rings[0];   // outer outline, mm, board frame

  // Which glTF axes hold the board plane, and with which signs? Decide by
  // fitting the substrate (_PCB) verts against pcbnew's outline bbox: the
  // mapping that reproduces it is the right one. kicad-cli has changed this
  // convention before, so measure instead of assuming.
  const bb = outline.bbox;
  const want = [bb.minX, bb.minY, bb.minX + bb.width, bb.minY + bb.height];
  const nodesOf = (re) => doc.getRoot().listNodes()
    .filter((n) => n.getMesh() && re.test(n.getMesh().getName() ?? ''));
  const CANDS = [];
  for (const [iu, iv] of [[0, 2], [2, 0], [0, 1], [1, 0]])
    for (const su of [1, -1]) for (const sv of [1, -1]) CANDS.push({iu, iv, su, sv});
  const pcbWorld = [];
  for (const n of nodesOf(SUBSTRATE_MESH)) {
    const W = worldMatrix(n);
    for (const prim of n.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const arr = pos.getArray();
      for (let i = 0; i < pos.getCount(); i += Math.max(1, Math.floor(pos.getCount() / 400)))
        pcbWorld.push(mat4Apply(W, [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]]).map((v) => v * 1000));
    }
  }
  let map = null, bestErr = Infinity;
  for (const c of CANDS) {
    let mnu = Infinity, mnv = Infinity, mxu = -Infinity, mxv = -Infinity;
    for (const p of pcbWorld) {
      const u = c.su * p[c.iu], v = c.sv * p[c.iv];
      mnu = Math.min(mnu, u); mxu = Math.max(mxu, u);
      mnv = Math.min(mnv, v); mxv = Math.max(mxv, v);
    }
    const err = Math.abs(mnu - want[0]) + Math.abs(mnv - want[1]) + Math.abs(mxu - want[2]) + Math.abs(mxv - want[3]);
    if (err < bestErr) { bestErr = err; map = c; }
  }
  if (!map || bestErr > 2.0) {
    console.log(`  clip        SKIPPED: no axis mapping fits the outline (err ${bestErr.toFixed(2)} mm)`);
    return;
  }

  // Clamp. A vertex outside the ring moves to the nearest boundary point,
  // then 5 microns inward so the collapsed wall cannot z-fight the PCB side.
  let moved = 0;
  const seen = new Set();
  for (const n of nodesOf(CLIP_MESH)) {
    const W = worldMatrix(n);
    const Wi = mat4InvAffine(W);
    for (const prim of n.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (seen.has(pos)) continue;
      seen.add(pos);
      const arr = pos.getArray().slice();
      for (let i = 0; i < pos.getCount(); i++) {
        const w = mat4Apply(W, [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]]).map((v) => v * 1000);
        const pt = [map.su * w[map.iu], map.sv * w[map.iv]];
        if (pointInRing(pt, ring)) continue;
        const nr = nearestOnRing(pt, ring);
        const dx = nr[0] - pt[0], dy = nr[1] - pt[1];
        const L = Math.hypot(dx, dy) || 1;
        const fx = nr[0] + (dx / L) * 0.005, fy = nr[1] + (dy / L) * 0.005;
        w[map.iu] = (fx / map.su);
        w[map.iv] = (fy / map.sv);
        const back = mat4Apply(Wi, w.map((v) => v / 1000));
        arr[i * 3] = back[0]; arr[i * 3 + 1] = back[1]; arr[i * 3 + 2] = back[2];
        moved++;
      }
      pos.setArray(arr);
    }
  }
  console.log(`  clip        ${moved} overshooting layer verts clamped to the board edge`);
}

function disposeSubtree(node) {
  for (const c of [...node.listChildren()]) disposeSubtree(c);
  node.dispose();
}

const argv = process.argv.slice(2);
const src = argv[0];
const out = argv[1];
if (!src || !out) {
  console.error('usage: node export-boards.mjs <board.kicad_pcb> <out.glb> [--ratio N] [--keep-vias]');
  process.exit(1);
}
const ratioArg = argv.indexOf('--ratio');
const ratio = ratioArg === -1 ? 1 : parseFloat(argv[ratioArg + 1]);
const keepVias = argv.includes('--keep-vias');

const tmp = mkdtempSync(pjoin(tmpdir(), 'kicad-glb-'));
const raw = pjoin(tmp, 'raw.glb');

try {
  const flags = [
    'pcb', 'export', 'glb', '-o', raw,
    '--include-pads', '--include-silkscreen', '--include-soldermask',
    '--no-dnp', '--no-unspecified', '-f',
  ];
  if (!keepVias) flags.splice(-1, 0, '--fill-all-vias');
  execFileSync(KICAD_CLI, [...flags, src], {stdio: ['ignore', 'ignore', 'ignore']});
  console.log(`  kicad-cli   ${(statSync(raw).size / 1024 / 1024).toFixed(2)} MB raw`);

  const io = await makeIO();
  const doc = await io.read(raw);

  // KiCad 10's glTF export parks the real substrate names on the MESHES and
  // gives their nodes junk like "=>[0:1:1:16]". The hero runtime groups a
  // board by NODE name (boardMembers in HeroDroneScene.tsx), so copy the mesh
  // name up whenever a substrate node carries no usable name of its own.
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const mn = mesh.getName() ?? '';
    if (BOARD_MESH.test(mn) && !BOARD_MESH.test(node.getName() ?? '')) node.setName(mn);
  }

  // OpenDrone boards deliberately draw solder pads past the routed edge so
  // JLCPCB's CNC trims them flush; kicad-cli exports that overshoot as gold
  // tabs floating beyond the board. Clamp every pad/silk/mask vertex that
  // falls outside the true Edge.Cuts outline back onto it, which reproduces
  // the trim: the overhang collapses into a flush vertical wall at the edge.
  // Components are exempt on purpose: a USB port really does stick out.
  clipBoardLayersToOutline(doc, src);

  // Measure straight off the kicad-cli output, before any transform runs.
  // Downstream (place-boards.mjs) needs honest millimetres to check the outline
  // against pcbnew, and every later stage muddies that: flatten()/join() rewrite
  // the node graph, and meshopt() quantizes each mesh into its own unit cube
  // with the real scale parked on that mesh's node.
  const bounds = measureMM(doc);

  // Drop anything parked absurdly far from the board. Those are the broken
  // easyeda2kicad model offsets described above; left in, they wreck the camera
  // framing and every downstream bounding box. Tested in WORLD space and
  // recursively: the offending nodes are nested, so checking a top-level node's
  // own translation misses them entirely.
  const CULL_RADIUS_M = 0.25;
  const strays = cullFarNodes(doc, CULL_RADIUS_M);
  if (strays.length) {
    for (const s of strays) console.log(`  stray       "${s.name}" at ${s.dist.toFixed(2)} m -> culled`);
    console.log(`  culled      ${strays.length} node(s) with bad 3D-model offsets`);
  }

  // Collect the materials actually used by bare-board meshes. Doing this by
  // mesh name (not by colour or alpha) means a change to KiCad's default board
  // colours can't silently retarget the fix onto a component material.
  const boardMats = new Set(), padMats = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    const name = mesh.getName() ?? '';
    if (!BOARD_MESH.test(name)) continue;
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (!m) continue;
      boardMats.add(m);
      if (PAD_MESH.test(name)) padMats.add(m);
    }
  }

  for (const m of padMats) {
    m.setBaseColorFactor(GOLD).setMetallicFactor(GOLD_METALLIC).setRoughnessFactor(GOLD_ROUGHNESS);
  }
  // Soldermask ships at alpha 0.83 and silkscreen at 0.90 so copper reads
  // through them in KiCad's own viewer. We export no copper under the mask, so
  // the blend buys nothing and costs depth-sorting artifacts in three.js.
  for (const m of boardMats) {
    const c = m.getBaseColorFactor();
    m.setBaseColorFactor([c[0], c[1], c[2], 1.0]).setAlphaMode('OPAQUE');
  }
  console.log(`  materials   ${padMats.size} pad -> gold, ${boardMats.size} board surfaces -> OPAQUE`);

  const ops = [
    prune({keepAttributes: false}),
    flatten(),
    join({keepNamed: false}),
    weld({tolerance: 0.0001}),
  ];
  if (ratio < 1) ops.push(simplify({simplifier: MeshoptSimplifier, ratio, error: 0.004}));
  ops.push(dedup(), prune({keepAttributes: false}));
  await doc.transform(...ops);

  // meshopt, not Draco: its decoder runs on the main thread, so it survives
  // Hydrogen's CSP (which blocks worker-src blob: and hangs Draco's worker).
  await doc.transform(meshopt({encoder: MeshoptEncoder, level: 'high'}));
  await io.write(out, doc);
  writeFileSync(out.replace(/\.glb$/, '.bounds.json'), JSON.stringify(bounds, null, 2));
  console.log(`  bounds      ${bounds.size_mm.slice(0,2).join(' x ')} mm`);

  let verts = 0, tris = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      verts += p.getAttribute('POSITION')?.getCount() ?? 0;
      tris += (p.getIndices()?.getCount() ?? 0) / 3;
    }
  console.log(`  -> ${out}  ${(statSync(out).size / 1024).toFixed(0)} KB  ${verts.toLocaleString()} verts  ${tris.toLocaleString()} tris`);
} finally {
  rmSync(tmp, {recursive: true, force: true});
}
