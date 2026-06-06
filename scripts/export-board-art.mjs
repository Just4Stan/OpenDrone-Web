#!/usr/bin/env node
/**
 * Export a layered SVG of a KiCad PCB for use on a product detail page.
 *
 *   node scripts/export-board-art.mjs <path-to-.kicad_pcb> <product-handle>
 *   node scripts/export-board-art.mjs --all      # every board in boards.config.json
 *
 * Pipeline (per board):
 *   1. `kicad-cli pcb export svg --mode-multi` emits one SVG per copper
 *      layer (Edge.Cuts, F.Cu, B.Cu) into a temp dir.
 *   2. `scripts/board-outline.py` (KiCad's bundled pcbnew) returns the
 *      true board-outline polygon — arcs, chamfers, castellations and
 *      cutouts resolved. OpenDrone boards intentionally have pads that
 *      overshoot the routed edge so JLCPCB CNC-trims them flush; clipping
 *      to the real outline keeps those stubs from showing past the edge.
 *   3. Each layer body is wrapped in `<g id="layer-{slug}">`; F.Cu and
 *      B.Cu are clipped to the outline (Edge.Cuts is the outline, so it
 *      is left unclipped). B.Cu is mirrored about the board's vertical
 *      centre on an inner group so the clip still resolves in the
 *      un-mirrored frame — that gives a clean flip-to-back view.
 *   4. Result is written to `public/boards/<handle>/board.svg`.
 *
 * <BoardArt /> inlines this file and addresses the layer groups by id:
 * CSS drives the entrance reveal and the gold glow, and the Top/Bottom
 * toggle simply shows one copper group at a time.
 *
 * One handle per physical PCB. Product lines (OpenESC, OpenFC, OpenRX) are
 * one Shopify product with several boards behind a variant axis, so each
 * tier gets its own handle (openesc + openesc-30x30, openfc + openfc-lite,
 * openrx-lite + openrx-lite-ufl + openrx-mono + openrx-gemini). Wire each
 * handle into the matching tier's `boardArt` in app/lib/product-content.ts
 * (or `teardown.boardArt` for the default board); the PDP swaps the art as
 * the ladder selects a tier.
 *
 * Point `pcb` at the SINGLE-board source, not a production panel. A panel
 * resolves to dozens of outline rings and a viewBox several boards wide —
 * the art then renders the whole array, not one board.
 *
 * Rerun whenever a hardware rev ships. Idempotent.
 */
import {execSync, execFileSync} from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import {join, basename, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const KICAD_CLI =
  process.env.KICAD_CLI ||
  '/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli';

// KiCad's bundled interpreter — the only Python with `pcbnew` available.
const KICAD_PYTHON =
  process.env.KICAD_PYTHON ||
  '/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3';

const OUTLINE_SCRIPT = resolve(here, 'board-outline.py');
const CONFIG_PATH = resolve(here, 'boards.config.json');

// Every copper layer of a (up to) 6-layer stackup, plus the board outline.
// Boards with fewer layers simply don't emit the missing inner files; we skip
// them. The <BoardArt/> folder viewer renders one sheet per copper layer.
const LAYERS = ['Edge.Cuts', 'F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu'];

/** Map kicad-cli's output filename suffix back to the layer slug we use as `id`. */
const FILENAME_TO_SLUG = {
  Edge_Cuts: 'edge-cuts',
  F_Cu: 'f',
  In1_Cu: 'in1',
  In2_Cu: 'in2',
  In3_Cu: 'in3',
  In4_Cu: 'in4',
  B_Cu: 'b',
};

// Physical top→bottom order. The folder viewer stacks the copper sheets in this
// order; edge-cuts is the shared board silhouette, emitted first so it sits
// under the copper as the "sheet" shape.
const STACK_ORDER = ['edge-cuts', 'f', 'in1', 'in2', 'in3', 'in4', 'b'];

// All copper is shown from the top now (the stack reads as looking straight
// down through the board), so nothing is mirrored.
const MIRROR_SLUGS = new Set();

const TAU = Math.PI * 2;
/** Max arc/bezier chord ≈ this many radians per sample — fine enough that a
 *  curve's true extent is captured to well under the SVG's rounding. */
const ARC_STEP = Math.PI / 24;
const BEZIER_STEPS = 24;

/** Flatten a cubic bezier into points (excluding the start, which is already
 *  recorded as the previous anchor). */
function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, out) {
  for (let k = 1; k <= BEZIER_STEPS; k++) {
    const t = k / BEZIER_STEPS;
    const u = 1 - t;
    out.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
}

/** Flatten a quadratic bezier into points (excluding the start). */
function sampleQuad(x0, y0, x1, y1, x2, y2, out) {
  for (let k = 1; k <= BEZIER_STEPS; k++) {
    const t = k / BEZIER_STEPS;
    const u = 1 - t;
    out.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]);
  }
}

/** Flatten an SVG elliptical arc (endpoint parameterization) into points
 *  (excluding the start). Center-conversion per the SVG 1.1 implementation
 *  notes (F.6). Used so the bbox captures a curved board edge whose extreme
 *  lies mid-arc, not on an anchor. */
function sampleArc(x0, y0, rx, ry, xrotDeg, fA, fS, x, y, out) {
  if (rx === 0 || ry === 0 || (x0 === x && y0 === y)) {
    out.push([x, y]);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (xrotDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
  }
  const sign = fA !== fS ? 1 : -1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * (rx * y1p)) / ry;
  const cyp = (-co * (ry * x1p)) / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y) / 2;
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const theta1 = angle(1, 0, ux, uy);
  let dTheta = angle(ux, uy, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fS && dTheta > 0) dTheta -= TAU;
  else if (fS && dTheta < 0) dTheta += TAU;
  const steps = Math.max(2, Math.ceil(Math.abs(dTheta) / ARC_STEP));
  for (let k = 1; k <= steps; k++) {
    const t = theta1 + (dTheta * k) / steps;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    out.push([cx + rx * ct * cosP - ry * st * sinP, cy + rx * ct * sinP + ry * st * cosP]);
  }
}

/**
 * Walk an SVG path `d` and return points along the curve — anchors for
 * straight segments, flattened samples for arcs/beziers. Enough to compute a
 * tight bounding box. KiCad's SVG plotter is inconsistent about how it emits
 * an Edge.Cuts ring: sometimes one polyline (`M x,y` then bare lineto pairs),
 * sometimes a mix of line, arc (`A`) and bezier (`C`) segments for filleted
 * corners. Reading raw number pairs breaks on the arc/bezier boards (radii,
 * rotation and the two single-digit flags get mistaken for coordinates), and
 * anchors alone undersize the box when a board edge's extreme lies mid-arc.
 * So we walk the grammar and flatten curves.
 *
 * Handles absolute + relative commands, implicit lineto runs after a moveto,
 * and the SVG arc-flag quirk (large-arc/sweep are single digits that may abut
 * the next number with no separator). S/T (smooth) reflection isn't tracked —
 * KiCad doesn't emit them for Edge.Cuts; their endpoints are still recorded.
 */
function pathPoints(d) {
  const pts = [];
  let i = 0;
  const n = d.length;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  const isCmdChar = (c) => 'MmLlHhVvCcSsQqTtAaZz'.includes(c);
  const skipSep = () => {
    while (i < n && (d[i] === ' ' || d[i] === ',' || d[i] === '\n' || d[i] === '\t' || d[i] === '\r')) i++;
  };
  const readNumber = () => {
    skipSep();
    const s = i;
    if (d[i] === '+' || d[i] === '-') i++;
    while (i < n && d[i] >= '0' && d[i] <= '9') i++;
    if (d[i] === '.') {
      i++;
      while (i < n && d[i] >= '0' && d[i] <= '9') i++;
    }
    if (d[i] === 'e' || d[i] === 'E') {
      i++;
      if (d[i] === '+' || d[i] === '-') i++;
      while (i < n && d[i] >= '0' && d[i] <= '9') i++;
    }
    return parseFloat(d.slice(s, i));
  };
  const readFlag = () => {
    skipSep();
    const f = d[i] === '1' ? 1 : 0;
    i++;
    return f;
  };
  const rd = (base) => readNumber() + base;

  while (i < n) {
    skipSep();
    if (i >= n) break;
    if (isCmdChar(d[i])) {
      cmd = d[i];
      i++;
    } else if (!cmd) {
      i++; // stray token before any command
      continue;
    }
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const bx = rel ? cx : 0;
    const by = rel ? cy : 0;
    let x = cx;
    let y = cy;
    switch (up) {
      case 'Z':
        continue;
      case 'H':
        x = rd(bx);
        pts.push([x, y]);
        break;
      case 'V':
        y = rd(by);
        pts.push([x, y]);
        break;
      case 'A': {
        const rx = readNumber();
        const ry = readNumber();
        const rot = readNumber();
        const fA = readFlag();
        const fS = readFlag();
        x = rd(bx);
        y = rd(by);
        sampleArc(cx, cy, rx, ry, rot, fA, fS, x, y, pts);
        break;
      }
      case 'C': {
        const c1x = rd(bx);
        const c1y = rd(by);
        const c2x = rd(bx);
        const c2y = rd(by);
        x = rd(bx);
        y = rd(by);
        sampleCubic(cx, cy, c1x, c1y, c2x, c2y, x, y, pts);
        break;
      }
      case 'Q': {
        const c1x = rd(bx);
        const c1y = rd(by);
        x = rd(bx);
        y = rd(by);
        sampleQuad(cx, cy, c1x, c1y, x, y, pts);
        break;
      }
      case 'S': {
        readNumber();
        readNumber();
        x = rd(bx);
        y = rd(by);
        pts.push([x, y]);
        break;
      }
      default: {
        // M / L / T — 2 coords. After a moveto, repeated pairs are linetos.
        x = rd(bx);
        y = rd(by);
        pts.push([x, y]);
        if (up === 'M') cmd = rel ? 'l' : 'L';
        break;
      }
    }
    cx = x;
    cy = y;
  }
  return pts;
}

/**
 * Tight bounding box of the actual Edge.Cuts geometry in the kicad-cli
 * page frame. `--fit-page-to-board` inflates the emitted viewBox to
 * include pads that overshoot the routed edge, so we recompute the true
 * board extent here from the flattened path (see {@link pathPoints}) for use
 * as the master viewBox and the alignment anchor for the pcbnew outline.
 * Boards with cutouts emit several `<path>` elements; we walk all of them.
 */
function edgeCutsBBox(edgeCutsSvg) {
  const re = /d="([^"]+)"/g;
  let m;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  while ((m = re.exec(edgeCutsSvg))) {
    for (const [x, y] of pathPoints(m[1])) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX)) return null;
  return {minX, minY, width: maxX - minX, height: maxY - minY};
}

/**
 * True board outline polygon via KiCad's own pcbnew API (see
 * scripts/board-outline.py). Returns `{ bbox, rings }` in mm in the
 * board's native coordinate frame.
 */
function boardOutline(pcbPath) {
  const out = execFileSync(KICAD_PYTHON, [OUTLINE_SCRIPT, pcbPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

/**
 * Build a clip-path `d` from the outline rings, translated from the
 * board's native frame into the kicad-cli page frame. The two frames
 * relate by a pure translation (1:1 mm, no scale), so we align by their
 * bounding-box min corner. Rings close with Z; the clip uses fill-rule
 * evenodd so inner cutouts subtract.
 */
function outlineClipPath(outline, cliBBox) {
  const dx = cliBBox.minX - outline.bbox.minX;
  const dy = cliBBox.minY - outline.bbox.minY;
  return outline.rings
    .map((ring) => {
      const [hx, hy] = ring[0];
      const head = `M ${(hx + dx).toFixed(4)} ${(hy + dy).toFixed(4)}`;
      const rest = ring
        .slice(1)
        .map(([x, y]) => `L ${(x + dx).toFixed(4)} ${(y + dy).toFixed(4)}`)
        .join(' ');
      return `${head} ${rest} Z`;
    })
    .join(' ');
}

/** Strip the `<svg>` wrapper + KiCad's <title>/<desc> from a layer file. */
function layerBody(raw) {
  return raw
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<desc>[\s\S]*?<\/desc>/g, '')
    .trim();
}

/** Generate `public/boards/<handle>/board.svg` from one .kicad_pcb. */
function buildBoard(pcbPath, handle) {
  const outDir = resolve(here, '..', 'public', 'boards', handle);
  mkdirSync(outDir, {recursive: true});

  const tmp = mkdtempSync(join(tmpdir(), 'board-art-'));
  try {
    execSync(
      [
        KICAD_CLI,
        'pcb export svg',
        `--output ${JSON.stringify(tmp + '/')}`,
        '--mode-multi',
        `--layers ${LAYERS.join(',')}`,
        '--page-size-mode 2',
        '--exclude-drawing-sheet',
        '--fit-page-to-board',
        // Ground pours are stored as polygons recomputed on the fly;
        // without this the board centre (GND flood) renders empty.
        '--check-zones',
        JSON.stringify(pcbPath),
      ].join(' '),
      {stdio: 'inherit'},
    );

    const projectBase = basename(pcbPath, '.kicad_pcb');
    const perLayer = {};
    let edgeCutsRaw = null;
    for (const [suffix, slug] of Object.entries(FILENAME_TO_SLUG)) {
      // Inner-layer files are absent on <6-layer boards — skip rather than throw.
      const file = join(tmp, `${projectBase}-${suffix}.svg`);
      if (!existsSync(file)) continue;
      const raw = readFileSync(file, 'utf8');
      if (slug === 'edge-cuts') edgeCutsRaw = raw;
      perLayer[slug] = layerBody(raw);
    }

    const bbox = edgeCutsRaw && edgeCutsBBox(edgeCutsRaw);
    if (!bbox) throw new Error(`No Edge.Cuts geometry found in ${pcbPath}`);
    const outline = boardOutline(pcbPath);
    if (!outline.rings || !outline.rings.length) {
      throw new Error(`pcbnew returned no board outline for ${pcbPath}`);
    }

    const clipId = `board-clip-${handle}`;
    const clipD = outlineClipPath(outline, bbox);
    const r4 = (v) => +v.toFixed(4);
    const viewBox = `${r4(bbox.minX)} ${r4(bbox.minY)} ${r4(bbox.width)} ${r4(bbox.height)}`;
    // Mirror axis = board's vertical centre, so mirrored B.Cu stays in place.
    const mirrorTx = (bbox.minX * 2 + bbox.width).toFixed(4);

    const layers = STACK_ORDER.map((slug) => {
      const body = perLayer[slug];
      if (!body) return '';
      if (slug === 'edge-cuts') {
        return `  <g id="layer-${slug}" class="board-layer board-layer-${slug}">\n${body}\n  </g>`;
      }
      const clipAttr = ` clip-path="url(#${clipId})"`;
      if (MIRROR_SLUGS.has(slug)) {
        // Clip on the outer (untransformed) group so it resolves in the
        // board frame; the inner group mirrors the copper.
        return `  <g id="layer-${slug}" class="board-layer board-layer-${slug}"${clipAttr}>\n    <g transform="matrix(-1 0 0 1 ${mirrorTx} 0)">\n${body}\n    </g>\n  </g>`;
      }
      return `  <g id="layer-${slug}" class="board-layer board-layer-${slug}"${clipAttr}>\n${body}\n  </g>`;
    })
      .filter(Boolean)
      .join('\n');

    const master = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" width="${bbox.width.toFixed(4)}mm" height="${bbox.height.toFixed(4)}mm" preserveAspectRatio="xMidYMid meet" overflow="hidden" data-board="${handle}">
  <defs>
    <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
      <path d="${clipD}" clip-rule="evenodd"/>
    </clipPath>
  </defs>
${layers}
</svg>
`;
    const outPath = join(outDir, 'board.svg');
    writeFileSync(outPath, master);
    const sizeKb = (Buffer.byteLength(master) / 1024).toFixed(1);
    const pts = outline.rings.reduce((n, r) => n + r.length, 0);
    console.log(
      `Wrote ${outPath} (${sizeKb} KB, viewBox=${viewBox}) — clipped to board outline (${outline.rings.length} ring(s), ${pts} pts)`,
    );
  } finally {
    rmSync(tmp, {recursive: true, force: true});
  }
}

/** Read the local board manifest (handle → .kicad_pcb path). */
function loadConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    console.error(
      `No ${basename(CONFIG_PATH)} found. Copy boards.config.example.json to ` +
        `boards.config.json and fill in your local .kicad_pcb paths.`,
    );
    process.exit(2);
  }
  const boards = JSON.parse(raw);
  if (!Array.isArray(boards)) throw new Error('boards.config.json must be an array');
  return boards;
}

function usage() {
  console.error(
    'Usage:\n' +
      '  node scripts/export-board-art.mjs <path-to-.kicad_pcb> <handle>\n' +
      '  node scripts/export-board-art.mjs --all',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  const boards = loadConfig();
  const failures = [];
  for (const {handle, pcb} of boards) {
    if (!handle || !pcb) {
      failures.push(`${handle || '(no handle)'}: missing handle or pcb`);
      continue;
    }
    try {
      buildBoard(pcb, handle);
    } catch (err) {
      failures.push(`${handle}: ${err.message}`);
    }
  }
  if (failures.length) {
    console.error(`\n${failures.length} board(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
} else if (args.length === 2) {
  buildBoard(args[0], args[1]);
} else {
  usage();
}
