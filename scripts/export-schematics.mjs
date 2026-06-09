#!/usr/bin/env node
/**
 * Export each sheet of a hierarchical KiCad schematic as an SVG, for the paged
 * schematic viewer in the "Open for learning" chapter.
 *
 *   node scripts/export-schematics.mjs <root.kicad_sch> <handle>
 *   node scripts/export-schematics.mjs --all     # every board in boards.config.json
 *   npm run gen:schematics                        # alias for --all; re-run after
 *                                                 # the KiCad schematics change
 *
 * The OpenDrone title block (logo + title + date + sheet number) drawn on each
 * sheet is stripped automatically on export — see stripTitleBlock below.
 *
 * `--all` reuses boards.config.json (handle → .kicad_pcb) and derives the
 * schematic next to it (same basename, .kicad_sch). One folder per board
 * handle — the same handles the board art uses, so a variant's schematic
 * follows the same ladder selection as its layer viewer.
 *
 * Output: public/schematics/<handle>/<slug>.svg + manifest.json listing the
 * sheets in reading order ({slug, label, file}). <SchematicViewer/> fetches the
 * manifest, shows sheet tabs, and lazy-loads one sheet SVG at a time.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import {join, basename, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const KICAD_CLI =
  process.env.KICAD_CLI ||
  '/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli';
const CONFIG_PATH = resolve(here, 'boards.config.json');

// Nicer labels for common sheet names; anything else is title-cased.
const LABELS = {
  root: 'Overview',
  power: 'Power',
  rp2350a: 'MCU',
  rp2354a: 'MCU',
  imu: 'IMU',
  osd: 'OSD',
  blackbox: 'Blackbox',
  pads: 'Connectors',
  esc: 'ESC channel',
};
// Reading order: overview first, then the big functional blocks.
const ORDER = ['root', 'rp2350a', 'rp2354a', 'power', 'imu', 'osd', 'blackbox', 'pads', 'esc'];

// Boards whose root "Overview" sheet is just a sparse hierarchical block diagram
// — drop it so the viewer opens on the real circuitry. The Gemini RX keeps its
// overview (a meaningful dual-radio top sheet).
const DROP_OVERVIEW = new Set([
  'openfc-lite',
  'openfc-lite-mini',
  'openrx-lite',
  'openrx-lite-ufl',
  'openrx-mono',
]);

const titleCase = (s) =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// --- Crop a KiCad schematic SVG to its content bounding box. ---
// KiCad plots on the full A-series page, so most sheets sit in a corner with
// huge empty margins. We walk every path/rect/circle/line/text coordinate to
// find the real extent and rewrite the <svg> viewBox + width/height to it.
function pathBBox(d, acc) {
  let i = 0;
  const n = d.length;
  let cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
  const isCmd = (c) => 'MmLlHhVvCcSsQqTtAaZz'.includes(c);
  const num = () => {
    while (i < n && ' ,\n\t\r'.includes(d[i])) i++;
    const s = i;
    if (d[i] === '+' || d[i] === '-') i++;
    while (i < n && ((d[i] >= '0' && d[i] <= '9') || d[i] === '.')) i++;
    if (d[i] === 'e' || d[i] === 'E') {
      i++;
      if (d[i] === '+' || d[i] === '-') i++;
      while (i < n && d[i] >= '0' && d[i] <= '9') i++;
    }
    return parseFloat(d.slice(s, i));
  };
  const pt = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < acc.minX) acc.minX = x;
    if (y < acc.minY) acc.minY = y;
    if (x > acc.maxX) acc.maxX = x;
    if (y > acc.maxY) acc.maxY = y;
  };
  while (i < n) {
    while (i < n && ' ,\n\t\r'.includes(d[i])) i++;
    if (i >= n) break;
    if (isCmd(d[i])) { cmd = d[i]; i++; }
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === 'Z') { cx = sx; cy = sy; continue; }
    if (up === 'H') { let x = num(); if (rel) x += cx; cx = x; pt(x, cy); }
    else if (up === 'V') { let y = num(); if (rel) y += cy; cy = y; pt(cx, y); }
    else if (up === 'A') {
      num(); num(); num(); num(); num();
      let x = num(), y = num(); if (rel) { x += cx; y += cy; } cx = x; cy = y; pt(x, y);
    } else if (up === 'C' || up === 'S' || up === 'Q') {
      const k = up === 'C' ? 3 : 2;
      for (let j = 0; j < k; j++) {
        let x = num(), y = num(); if (rel) { x += cx; y += cy; } pt(x, y);
        if (j === k - 1) { cx = x; cy = y; }
      }
    } else { // M / L / T
      let x = num(), y = num(); if (rel) { x += cx; y += cy; }
      cx = x; cy = y; pt(x, y);
      if (up === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    }
  }
}

// --- Strip the OpenDrone title block from a sheet SVG. ---
// Every sheet carries a graphical title block (OpenDrone logo + sheet title +
// date + sheet number) drawn directly on the schematic and anchored to the
// page's bottom-right corner. kicad-cli's --exclude-drawing-sheet only drops the
// worksheet frame, not these schematic-level graphics, so they survive export,
// inflate the content bounding box, and shrink the real circuitry once cropped.
// We anchor on the date field (DD/MM/YYYY — always present, easy to match) and
// remove every primitive fully inside the block's box around it: the title/date/
// sheet-number text, the logo, and the block's frame lines. The block is the
// isolated bottom-right cluster, well clear of the circuitry comments, which are
// kept. (The title block has no rotate transforms, so raw path coords are the
// on-page coords.)
function stripTitleBlock(svg) {
  const dm = svg.match(
    /<text\s+x="([-\d.]+)"\s+y="([-\d.]+)"[^>]*?>\s*\d\d\/\d\d\/\d{4}\s*<\/text>/s,
  );
  if (!dm) return svg;
  const dx = +dm[1], dy = +dm[2];
  // Box around the date anchor: covers the logo (up/left), the title (left) and
  // the sheet number (right). Sized from the measured block (~28 mm left, 55 mm
  // right, 26 mm up of the date) plus margin.
  const B = {x0: dx - 45, x1: dx + 64, y0: dy - 36, y1: dy + 12};
  const inBox = (x, y) => x >= B.x0 && x <= B.x1 && y >= B.y0 && y <= B.y1;
  const fitsBox = (d) => {
    const acc = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
    pathBBox(d, acc);
    return (
      Number.isFinite(acc.minX) &&
      inBox(acc.minX, acc.minY) &&
      inBox(acc.maxX, acc.maxY)
    );
  };
  let out = svg;
  // 1. Hidden text anchors inside the box (title/date/sheet number).
  out = out.replace(
    /<text\s+x="([-\d.]+)"\s+y="([-\d.]+)"[^>]*?>.*?<\/text>/gs,
    (m, x, y) => (inBox(+x, +y) ? '' : m),
  );
  // 2. Stroked-text glyph groups whose strokes fall inside the box.
  out = out.replace(/<g class="stroked-text">[\s\S]*?<\/g>/g, (g) => {
    const acc = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
    let m;
    const re = /\sd="([^"]+)"/g;
    while ((m = re.exec(g))) pathBBox(m[1], acc);
    return Number.isFinite(acc.minX) &&
      inBox(acc.minX, acc.minY) &&
      inBox(acc.maxX, acc.maxY)
      ? ''
      : g;
  });
  // 3. Paths inside the box (the logo glyphs + the block's frame lines). Matches
  //    both stroke paths (d-first) and the filled logo paths (style-first).
  out = out.replace(/<path\b[^>]*?\/>/gs, (m) => {
    const d = m.match(/\sd="([^"]+)"/s);
    return d && fitsBox(d[1]) ? '' : m;
  });
  return out;
}

function cropSvg(svg) {
  const acc = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  const pt = (x, y) => {
    if (x < acc.minX) acc.minX = x; if (y < acc.minY) acc.minY = y;
    if (x > acc.maxX) acc.maxX = x; if (y > acc.maxY) acc.maxY = y;
  };
  let m;
  const re = /\sd="([^"]+)"/g;
  while ((m = re.exec(svg))) pathBBox(m[1], acc);
  for (const r of svg.matchAll(/<rect[^>]*\sx="([-\d.]+)"[^>]*\sy="([-\d.]+)"[^>]*\swidth="([-\d.]+)"[^>]*\sheight="([-\d.]+)"/g)) {
    const [x, y, w, h] = [+r[1], +r[2], +r[3], +r[4]]; pt(x, y); pt(x + w, y + h);
  }
  for (const c of svg.matchAll(/<circle[^>]*\scx="([-\d.]+)"[^>]*\scy="([-\d.]+)"[^>]*\sr="([-\d.]+)"/g)) {
    const [x, y, rr] = [+c[1], +c[2], +c[3]]; pt(x - rr, y - rr); pt(x + rr, y + rr);
  }
  for (const t of svg.matchAll(/<text[^>]*\sx="([-\d.]+)"[^>]*\sy="([-\d.]+)"/g)) {
    pt(+t[1], +t[2]);
  }
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  if (!Number.isFinite(acc.minX)) {
    // Nothing found — leave as is, report the page size so the viewer can scale.
    return {svg, w: vb ? +vb[3] : 0, h: vb ? +vb[4] : 0};
  }
  const pad = 2; // mm
  const minX = acc.minX - pad, minY = acc.minY - pad;
  const w = acc.maxX - acc.minX + pad * 2, h = acc.maxY - acc.minY + pad * 2;
  const r4 = (v) => v.toFixed(4);
  const out = svg.replace(
    /width="[^"]*mm" height="[^"]*mm" viewBox="[^"]*"/,
    `width="${r4(w)}mm" height="${r4(h)}mm" viewBox="${r4(minX)} ${r4(minY)} ${r4(w)} ${r4(h)}"`,
  );
  return {svg: out, w, h};
}

function buildSchematic(schPath, handle) {
  const outDir = resolve(here, '..', 'public', 'schematics', handle);
  mkdirSync(outDir, {recursive: true});
  const tmp = mkdtempSync(join(tmpdir(), 'sch-'));
  try {
    execFileSync(
      KICAD_CLI,
      // Black-and-white on a transparent background: the viewer inverts it to
      // clean white "blueprint" lines on the dark page, theme-independent.
      ['sch', 'export', 'svg', '-o', tmp, '--no-background-color', '--exclude-drawing-sheet', '--black-and-white', schPath],
      {stdio: ['ignore', 'ignore', 'inherit']},
    );
    const base = basename(schPath, '.kicad_sch');
    const files = readdirSync(tmp).filter((f) => f.endsWith('.svg'));
    let descs = files.map((file) => {
      // Root sheet is "<base>.svg"; sub-sheets "<base>-<SHEET>.svg".
      const stem = basename(file, '.svg');
      const slug = stem === base ? 'root' : stem.replace(`${base}-`, '').toLowerCase();
      const raw = stripTitleBlock(readFileSync(join(tmp, file), 'utf8'));
      const {svg, w, h} = cropSvg(raw);
      return {slug, label: LABELS[slug] ?? titleCase(slug), file: `${slug}.svg`, w, h, svg};
    });
    descs.sort((a, b) => {
      const ia = ORDER.indexOf(a.slug);
      const ib = ORDER.indexOf(b.slug);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.slug.localeCompare(b.slug);
    });
    // Drop the sparse hierarchical Overview on boards where it adds nothing.
    if (DROP_OVERVIEW.has(handle)) descs = descs.filter((d) => d.slug !== 'root');
    // Clear stale sheets from a previous run (e.g. a now-dropped root.svg).
    for (const f of readdirSync(outDir)) if (f.endsWith('.svg')) rmSync(join(outDir, f));
    for (const d of descs) writeFileSync(join(outDir, d.file), d.svg);
    // Manifest carries each sheet's content size (mm) so the viewer scales all
    // sheets of a board by ONE factor — a small sheet stays small, not blown up.
    const sheets = descs.map(({slug, label, file, w, h}) => ({
      slug, label, file, w: +w.toFixed(2), h: +h.toFixed(2),
    }));
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({handle, sheets}, null, 2));
    const kb = descs.reduce((n, d) => n + Buffer.byteLength(d.svg), 0) / 1024;
    console.log(
      `Wrote ${outDir} — ${sheets.length} sheets (${(kb / 1024).toFixed(2)} MB): ${sheets.map((s) => s.label).join(', ')}`,
    );
  } finally {
    rmSync(tmp, {recursive: true, force: true});
  }
}

// Bake a content version into the bundle so the schematic viewer can bust the
// CDN's 1-year immutable cache on the (unversioned) sheet + manifest URLs.
// Oxygen serves everything under public/ with `max-age=31536000`, so an in-place
// regen never reaches returning visitors unless the request URL changes. We hash
// every exported SVG + manifest and write the digest to a TS module the viewer
// imports — it appends `?v=<digest>` to each fetch. Regenerate → digest changes
// → the JS chunk re-hashes → cached browsers refetch the new sheets. See
// app/components/SchematicViewer.tsx.
function writeVersionFile() {
  const base = resolve(here, '..', 'public', 'schematics');
  const h = createHash('sha256');
  const files = [];
  for (const handle of readdirSync(base).sort()) {
    const dir = join(base, handle);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir).sort()) {
      if (f.endsWith('.svg') || f === 'manifest.json') files.push(join(dir, f));
    }
  }
  for (const f of files) h.update(readFileSync(f));
  const v = h.digest('hex').slice(0, 12);
  const out = resolve(here, '..', 'app', 'data', 'schematics-version.ts');
  writeFileSync(
    out,
    `// AUTO-GENERATED by scripts/export-schematics.mjs — do not edit by hand.\n` +
      `// Content hash of every exported schematic SVG + manifest. The viewer\n` +
      `// appends it as ?v= to bust Oxygen's 1-year immutable asset cache when\n` +
      `// schematics are regenerated in place.\n` +
      `export const SCHEMATICS_VERSION = '${v}';\n`,
  );
  console.log(`Wrote ${out} — version ${v}`);
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  const boards = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const failures = [];
  for (const {handle, pcb} of boards) {
    const sch = pcb.replace(/\.kicad_pcb$/, '.kicad_sch');
    try {
      buildSchematic(sch, handle);
    } catch (err) {
      failures.push(`${handle}: ${err.message}`);
    }
  }
  writeVersionFile();
  if (failures.length) {
    console.error(`\n${failures.length} failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
} else if (args.length === 2) {
  buildSchematic(args[0], args[1]);
  writeVersionFile();
} else {
  console.error('Usage: export-schematics.mjs <root.kicad_sch> <handle>  |  --all');
  process.exit(2);
}
