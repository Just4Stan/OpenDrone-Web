// Build the per-board PDP viewer GLBs straight from the final KiCad PCBs —
// the PCB files are ground truth, so the board models are exported from them
// rather than from OnShape/STEP. Pipeline per board:
//   kicad-cli pcb export glb (copper + zones + silk + mask + populated models)
//     -> cull export junk (footprints whose 3D model lands far off-board)
//     -> recentre on the board bbox
//     -> weld/dedup/draco compress
// Raw KiCad GLBs are ~20-48MB; the shipped assets land well under 2MB each.
//
// Usage: node scripts/hero-assets/build-boards.mjs [fc3 fc5 esc3 esc5]
// Requires KiCad 9+ (kicad-cli). Override the binary with KICAD_CLI=...

import {execFileSync} from 'node:child_process';
import {statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join as pjoin} from 'node:path';
import {makeIO} from './io.mjs';
import {dedup, weld, prune, draco, flatten, join, center} from '@gltf-transform/functions';

const KICAD_CLI =
  process.env.KICAD_CLI ||
  '/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli';
const HW = '/Users/stan/OpenDrone';
const OUT = '/Users/stan/OpenDrone-Web/public/models';

// name -> source PCB. 3 = 3" hardware, 5 = 5" hardware.
const BOARDS = {
  fc5: `${HW}/OpenFC-Lite/hardware/OpenFC.kicad_pcb`,
  fc3: `${HW}/OpenFC-Lite-Mini/hardware/OpenFC.kicad_pcb`,
  esc5: `${HW}/4in1/4in1.kicad_pcb`,
  esc3: `${HW}/4in1-mini/4in1-mini.kicad_pcb`,
};

// glTF units are metres. No board here is wider than ~40mm, so any footprint
// whose world centroid sits >80mm from the board's median centroid is a
// mis-placed library model (e.g. the FC's D2/D3/D10 LEDs export ~1m away).
const CULL_M = 0.08;

// ---- column-major mat4 helpers for true world centroids ----
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
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0; for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = v;
  }
  return o;
}
const local = (n) => compose(n.getTranslation(), n.getRotation(), n.getScale());

function exportRaw(pcb, dest) {
  execFileSync(KICAD_CLI, [
    'pcb', 'export', 'glb', '-o', dest, '--force',
    '--include-tracks', '--include-pads', '--include-zones',
    '--include-silkscreen', '--include-soldermask',
    '--subst-models', '--no-dnp', pcb,
  ], {stdio: ['ignore', 'ignore', 'inherit']});
}

async function build(name) {
  const pcb = BOARDS[name];
  if (!pcb) throw new Error(`unknown board ${name}`);
  const raw = pjoin(tmpdir(), `${name}_raw.glb`);
  exportRaw(pcb, raw);

  const io = await makeIO();
  const doc = await io.read(raw);
  const scene = doc.getRoot().listScenes()[0];

  // KiCad instances component meshes, so flatten() can't bake them — compute
  // each mesh node's world centroid by walking transforms ourselves.
  const rows = [];
  const walk = (n, M) => {
    const W = mul(M, local(n));
    const mesh = n.getMesh();
    if (mesh) {
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const p of mesh.listPrimitives()) {
        const pos = p.getAttribute('POSITION');
        if (!pos) continue;
        const a = pos.getMin([]), b = pos.getMax([]);
        for (let xi = 0; xi < 2; xi++) for (let zi = 0; zi < 2; zi++) {
          const X = xi ? b[0] : a[0], Z = zi ? b[2] : a[2];
          const wx = W[0] * X + W[8] * Z + W[12];
          const wz = W[2] * X + W[10] * Z + W[14];
          mn[0] = Math.min(mn[0], wx); mx[0] = Math.max(mx[0], wx);
          mn[2] = Math.min(mn[2], wz); mx[2] = Math.max(mx[2], wz);
        }
      }
      if (Number.isFinite(mn[0])) rows.push({node: n, name: n.getName(), cx: (mn[0] + mx[0]) / 2, cz: (mn[2] + mx[2]) / 2});
    }
    for (const c of n.listChildren()) walk(c, W);
  };
  for (const n of scene.listChildren()) walk(n, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const medX = med(rows.map((r) => r.cx)), medZ = med(rows.map((r) => r.cz));
  const strays = rows.filter((r) => Math.hypot(r.cx - medX, r.cz - medZ) > CULL_M);
  for (const s of strays) {
    console.log(`  cull ${s.name || '(unnamed)'} @ (${(s.cx * 1000).toFixed(0)},${(s.cz * 1000).toFixed(0)})mm`);
    s.node.dispose();
  }

  await doc.transform(
    prune(),
    flatten(),
    join({keepNamed: false}),
    center({pivot: 'center'}),
    weld({tolerance: 0.0001}),
    dedup(),
    prune(),
    draco({quantizePosition: 12, quantizeNormal: 8, quantizeColor: 8, quantizeGeneric: 12}),
  );
  const out = `${OUT}/${name}.glb`;
  await io.write(out, doc);
  console.log(`${name}: culled ${strays.length}  ->  ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BOARDS);
for (const name of want) await build(name);
