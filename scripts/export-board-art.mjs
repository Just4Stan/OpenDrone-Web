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
 * Rerun whenever a hardware rev ships. Idempotent.
 */
import {execSync, execFileSync} from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
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

const LAYERS = ['Edge.Cuts', 'F.Cu', 'B.Cu'];

/** Map kicad-cli's output filename suffix back to the layer slug we use as `id`. */
const FILENAME_TO_SLUG = {
  Edge_Cuts: 'edge-cuts',
  F_Cu: 'copper',
  B_Cu: 'b-copper',
};

// Paint order — first is deepest. Both copper layers ship; the Top/Bottom
// toggle in <BoardArt /> reveals one at a time. Edge.Cuts crowns the stack.
const STACK_ORDER = ['b-copper', 'copper', 'edge-cuts'];

// Bottom-side copper is mirrored so it reads as a flip-to-back view.
const MIRROR_SLUGS = new Set(['b-copper']);

const NUM_RE = /-?\d+(?:\.\d+)?/g;

/**
 * Parse a KiCad-emitted Edge.Cuts `d` attribute, returning the segment's
 * start and end coords. KiCad concatenates the command letter with its
 * first number (e.g. `M8.4070 … A2.5000 …`), so we don't bind on
 * whitespace — the first number after `M` is the start coord, the last
 * pair is the end coord. Used only to bound the board in the kicad-cli
 * page frame; the clip shape itself comes from pcbnew.
 */
function parseSegment(d) {
  const s = d.trim();
  if (!s.startsWith('M')) return null;
  const nums = s.match(NUM_RE);
  if (!nums || nums.length < 4) return null;
  return {
    start: [+nums[0], +nums[1]],
    end: [+nums[nums.length - 2], +nums[nums.length - 1]],
  };
}

/**
 * Tight bounding box of the actual Edge.Cuts geometry in the kicad-cli
 * page frame. `--fit-page-to-board` inflates the emitted viewBox to
 * include pads that overshoot the routed edge, so we recompute the true
 * board extent here for use as the master viewBox and as the alignment
 * anchor for the pcbnew outline.
 */
function edgeCutsBBox(edgeCutsSvg) {
  const re = /d="([^"]+)"/g;
  let m;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  while ((m = re.exec(edgeCutsSvg))) {
    const seg = parseSegment(m[1]);
    if (!seg) continue;
    for (const [x, y] of [seg.start, seg.end]) {
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
      const raw = readFileSync(join(tmp, `${projectBase}-${suffix}.svg`), 'utf8');
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
    const viewBox = `${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`;
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
