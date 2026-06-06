import {makeIO} from './io.mjs';
import {dedup, weld, prune, meshopt, transformMesh, flatten, join, cloneDocument, simplify} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

// ---- mat4 helpers (column-major) ----
function compose(t, r, s) {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
const I4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0; for (let k = 0; k < 4; k++) v += a[k*4+r] * b[c*4+k]; o[c*4+r] = v;
  }
  return o;
}
function tp(m, [x, y, z]) {
  return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
}
const local = (n) => compose(n.getTranslation(), n.getRotation(), n.getScale());

function meshBbox(node) {
  const mesh = node.getMesh();
  if (!mesh) return null;
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION'); if (!pos) continue;
    const a = pos.getMin([]), b = pos.getMax([]);
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a[i]); mx[i] = Math.max(mx[i], b[i]); }
  }
  return mn[0] === Infinity ? null : [mn, mx];
}
// world AABB of a subtree given parent world matrix
function subtreeBbox(node, M, acc) {
  const W = mul(M, local(node));
  const bb = meshBbox(node);
  if (bb) {
    const [mn, mx] = bb;
    for (let xi = 0; xi < 2; xi++) for (let yi = 0; yi < 2; yi++) for (let zi = 0; zi < 2; zi++) {
      const p = tp(W, [xi ? mx[0] : mn[0], yi ? mx[1] : mn[1], zi ? mx[2] : mn[2]]);
      for (let i = 0; i < 3; i++) { acc.min[i] = Math.min(acc.min[i], p[i]); acc.max[i] = Math.max(acc.max[i], p[i]); }
    }
  }
  for (const c of node.listChildren()) subtreeBbox(c, W, acc);
  return acc;
}
const center = (bb) => bb.min.map((v, i) => (v + bb.max[i]) / 2);

// The exports contain ONLY the frame + the two PCBs (no motors/props/airtag),
// so nothing is dropped. Classification:
//   /OpenFC/  -> FC board substrate
//   /4in1/    -> ESC board substrate
//   FRAME     -> the exact structural part list (per Onshape): the arms, the
//                base plates, the cross, the top plate
//   else      -> footprint-named SMD component, assigned to its nearest board
// Using an explicit frame whitelist (rather than name-dropping) keeps the
// Base-Top/Base-Bot/Cross plates from leaking onto the ESC by z-proximity.
const FRAME = /^(Arm|Cross|Base|Top)\b/i;

async function buildOne(srcPath, _unused, sizeLabel) {
  const suffix = sizeLabel === '5in' ? '5' : '3';
  const io = await makeIO();
  console.log(`\n[${sizeLabel}] reading ${srcPath}`);
  const doc = await io.read(srcPath);
  // Some Onshape exports (e.g. the 3-inch) ship Draco-compressed. io.read
  // decodes the geometry into plain accessors, but the KHR_draco_mesh_
  // compression extension declaration lingers in extensionsUsed — which makes
  // three's GLTFLoader demand a DRACOLoader at runtime even though we re-encode
  // with meshopt. Dispose it so the output is pure EXT_meshopt_compression.
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const assembly = scene.listChildren()[0];
  const Masm = local(assembly);
  const occurrences = assembly.listChildren();

  // Pass A: classify + world centroid + per-occ world bbox
  const kept = []; // {occ, group}
  const culled = [];
  // board z planes: gather from substrate parts first
  const fcZ = [], escZ = [];
  const occInfo = occurrences.map((occ) => {
    const bb = subtreeBbox(occ, Masm, {min: [Infinity,Infinity,Infinity], max: [-Infinity,-Infinity,-Infinity]});
    const cen = center(bb);
    return {occ, name: (occ.getName() || '').replace(/^occurrence of /, ''), bb, cen};
  });
  for (const o of occInfo) {
    if (/OpenFC/i.test(o.name)) fcZ.push(o.cen[2]);
    else if (/4in1/i.test(o.name)) escZ.push(o.cen[2]);
  }
  const median = (a) => {
    const f = a.filter(Number.isFinite).sort((x, y) => x - y);
    return f.length ? f[f.length >> 1] : NaN;
  };
  const fcPlane = median(fcZ), escPlane = median(escZ);
  console.log(`[${sizeLabel}] FC plane z=${fcPlane.toFixed(4)}  ESC plane z=${escPlane.toFixed(4)}`);

  // core radius cull: drone parts cluster near origin in x/y; export junk is flung far
  const CORE = 0.22;
  for (const o of occInfo) {
    const [cx, cy] = o.cen;
    if (Math.abs(cx) > CORE || Math.abs(cy) > CORE) { culled.push(o); continue; }
    let group;
    if (/OpenFC/i.test(o.name)) group = 'FC';
    else if (/4in1/i.test(o.name)) group = 'ESC';
    else if (FRAME.test(o.name)) group = 'Frame';
    // Everything else is a footprint-named SMD component — assign to its board
    // by which substrate z-plane it sits closest to.
    else group = Math.abs(o.cen[2] - fcPlane) <= Math.abs(o.cen[2] - escPlane) ? 'FC' : 'ESC';
    kept.push({...o, group});
  }
  console.log(`[${sizeLabel}] kept ${kept.length}, culled(far) ${culled.length}`);
  const frameNames = [...new Set(kept.filter((k) => k.group === 'Frame').map((o) => o.name))];
  console.log(`[${sizeLabel}] frame parts:`, frameNames.join(', '));
  const counts = kept.reduce((m, k) => ((m[k.group] = (m[k.group]||0)+1), m), {});
  console.log(`[${sizeLabel}] group counts:`, counts);

  const ext = ['x','y','z'].map((_, i) => (Math.max(...kept.map((k) => k.bb.max[i])) - Math.min(...kept.map((k) => k.bb.min[i]))).toFixed(3));
  console.log(`[${sizeLabel}] extent=[${ext.join(',')}]`);
  // Build group nodes carrying the assembly's transform, pre-translated by the
  // shared recenter T(-C). Reparent kept occurrences under them (keeping their
  // own local transforms) and let flatten() bake everything downstream.
  //
  // NOTE: do NOT manually transformMesh per occurrence — 5 meshes here are
  // shared across up to 4 occurrences, so a destructive per-occurrence bake
  // double-applies the transform and flings the shared part off to ±0.9.
  // flatten() clones shared meshes per node before baking, which is correct.
  const asmT = assembly.getTranslation();
  const asmR = assembly.getRotation();
  const asmS = assembly.getScale();
  const groupNodes = {
    Frame: doc.createNode('Frame'),
    FC: doc.createNode('FC'),
    ESC: doc.createNode('ESC'),
  };
  for (const g of Object.values(groupNodes)) {
    // Raw assembly transform — NO recenter, NO normalisation. The geometry
    // stays at true Onshape world scale/position; all three groups share the
    // same origin so they reassemble exactly as exported. On-screen fit is a
    // single uniform scale applied in the runtime, never here.
    g.setTranslation(asmT).setRotation(asmR).setScale(asmS);
  }
  for (const k of kept) groupNodes[k.group].addChild(k.occ);

  // New clean scene with just the 3 groups
  const newScene = doc.createScene('Root');
  newScene.addChild(groupNodes.Frame).addChild(groupNodes.FC).addChild(groupNodes.ESC);
  root.setDefaultScene(newScene);
  for (const s of root.listScenes()) if (s !== newScene) s.dispose();

  // NOTE: keep TEXCOORD_0 on the FRAME — the runtime carbon-fibre material
  // samples it (without UVs the weave can't map and the frame renders flat
  // grey/white). The FC/ESC boards use flat per-material colours with no
  // texture, so their UVs are dropped per-group below to save bytes.
  await doc.transform(prune({keepAttributes: true}), dedup());

  // Emit one merged GLB per group. Isolating a single group lets flatten+join
  // collapse its ~10k tiny primitives down to one-per-material without ever
  // merging FC green into ESC green (they'd cross-contaminate in a combined
  // scene). Each group is recentred on the SHARED drone centre C, so the trio
  // re-assembles correctly at runtime.
  const fileMap = {Frame: `frame${suffix}`, FC: `fc${suffix}`, ESC: `esc${suffix}`};
  for (const g of ['Frame', 'FC', 'ESC']) {
    const clone = cloneDocument(doc);
    const cScene = clone.getRoot().listScenes()[0];
    for (const node of [...cScene.listChildren()]) {
      if (node.getName() !== g) disposeTree(node);
    }
    // Boards don't use a UV-mapped texture (flat material colours) — drop their
    // UVs to save bytes. The frame keeps UVs for the carbon-fibre weave.
    if (g !== 'Frame')
      for (const m of clone.getRoot().listMeshes())
        for (const p of m.listPrimitives())
          if (p.getAttribute('TEXCOORD_0')) p.setAttribute('TEXCOORD_0', null);
    const ops = [
      prune({keepAttributes: true}),
      flatten(),
      join({keepNamed: false}),
      weld({tolerance: 0.0001}),
    ];
    // Halve the board geometry. The SMD components are sub-pixel at hero
    // scale, so this removes triangles you can't see, not visible detail —
    // it roughly halves the per-frame vertex cost (incl. the shadow pass).
    // The frame is already low-poly and has crisp silhouettes, so it's left
    // untouched.
    if (g !== 'Frame')
      ops.push(simplify({simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.004}));
    ops.push(dedup(), prune({keepAttributes: true}));
    await clone.transform(...ops);
    // Bake residual node transforms so accessor coords == world coords; the
    // flip + normalise below depend on that.
    bakeNodeTransforms(clone);
    // Flip the boards 180° in-plane so the silkscreen reads upright (they're
    // mounted rotated in the airframe). Rotate about each board's OWN centre so
    // its position relative to the frame is preserved; z is untouched so the
    // FC-above-ESC stack order stays correct. (x,y,z) -> (2cx-x, 2cy-y, z).
    if (g === 'FC' || g === 'ESC') {
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const m of clone.getRoot().listMeshes())
        for (const p of m.listPrimitives()) {
          const a = p.getAttribute('POSITION'), lo = a.getMin([]), hi = a.getMax([]);
          for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], lo[i]); mx[i] = Math.max(mx[i], hi[i]); }
        }
      const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
      const Rz = [-1,0,0,0, 0,-1,0,0, 0,0,1,0, 2*cx, 2*cy, 0, 1];
      for (const m of clone.getRoot().listMeshes()) transformMesh(m, Rz);
    }

    // NO normalisation here — geometry stays at raw Onshape scale.
    // meshopt (EXT_meshopt_compression), not Draco: the decoder runs on the
    // main thread (no Web Worker), so it works under Hydrogen's CSP which
    // blocks worker-src blob:. Draco's worker silently hangs there.
    await clone.transform(
      meshopt({encoder: MeshoptEncoder, level: 'high'}),
    );
    const cr = clone.getRoot();
    let verts = 0, prims = 0;
    for (const m of cr.listMeshes()) for (const p of m.listPrimitives()) { verts += p.getAttribute('POSITION')?.getCount() || 0; prims++; }
    const out = `${OUT}/${fileMap[g]}.glb`;
    await io.write(out, clone);
    const kb = (await import('node:fs')).statSync(out).size / 1024;
    console.log(`[${sizeLabel}] ${g.padEnd(5)} -> ${fileMap[g]}.glb  ${(kb/1024).toFixed(2)} MB  (${verts.toLocaleString()} verts, ${prims} prims)`);
  }
  return null;
}

function disposeTree(node) {
  for (const c of [...node.listChildren()]) disposeTree(c);
  node.dispose();
}

// Force-bake every node's world transform into its mesh geometry and reset the
// nodes to identity. flatten()+join() leave a residual node transform (a common
// translation/rotation) rather than baking it in; that's fine for rendering,
// but our normalisation + flip operate on raw accessor data, so they'd ignore
// that residual and break each group's placement differently. After this, the
// accessor coordinates ARE world coordinates.
function bakeNodeTransforms(clone) {
  const scene = clone.getRoot().listScenes()[0];
  const done = new Set();
  const walk = (node, M) => {
    const W = mul(M, local(node));
    const mesh = node.getMesh();
    if (mesh && !done.has(mesh)) { done.add(mesh); transformMesh(mesh, W); }
    for (const c of node.listChildren()) walk(c, W);
  };
  for (const n of scene.listChildren()) walk(n, I4);
  const reset = (node) => {
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    for (const c of node.listChildren()) reset(c);
  };
  for (const n of scene.listChildren()) reset(n);
}

const OUT = '/Users/stan/OpenDrone-Web/public/models';
// Source .gltf paths — override on the CLI:
//   node build.mjs <5inch.gltf> <3inch.gltf>
const SRC5 = process.argv[2] || '/Users/stan/Downloads/OpenDrone5.gltf';
const SRC3 = process.argv[3] || '/Users/stan/Downloads/OpenDrone3 (1).gltf';
const {existsSync} = await import('node:fs');
const centers = {};
for (const [src, label, key] of [[SRC5, '5in', 'c5'], [SRC3, '3in', 'c3']]) {
  if (!existsSync(src)) { console.log(`[${label}] SKIP — source not found: ${src}`); continue; }
  centers[key] = await buildOne(src, null, label);
}
console.log('\nDONE  centers:', centers);
