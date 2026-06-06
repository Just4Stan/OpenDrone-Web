#!/usr/bin/env node
/**
 * Export each sheet of a hierarchical KiCad schematic as an SVG, for the paged
 * schematic viewer in the "Open for learning" chapter.
 *
 *   node scripts/export-schematics.mjs <root.kicad_sch> <handle>
 *   node scripts/export-schematics.mjs --all     # every board in boards.config.json
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
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
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

const titleCase = (s) =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
    const sheets = files.map((file) => {
      // Root sheet is "<base>.svg"; sub-sheets "<base>-<SHEET>.svg".
      const stem = basename(file, '.svg');
      const slug = stem === base ? 'root' : stem.replace(`${base}-`, '').toLowerCase();
      copyFileSync(join(tmp, file), join(outDir, `${slug}.svg`));
      return {slug, label: LABELS[slug] ?? titleCase(slug), file: `${slug}.svg`};
    });
    sheets.sort((a, b) => {
      const ia = ORDER.indexOf(a.slug);
      const ib = ORDER.indexOf(b.slug);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.slug.localeCompare(b.slug);
    });
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({handle, sheets}, null, 2));
    const kb = sheets.reduce(
      (n, s) => n + readFileSync(join(outDir, s.file)).length,
      0,
    ) / 1024;
    console.log(
      `Wrote ${outDir} — ${sheets.length} sheets (${(kb / 1024).toFixed(2)} MB): ${sheets.map((s) => s.label).join(', ')}`,
    );
  } finally {
    rmSync(tmp, {recursive: true, force: true});
  }
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
  if (failures.length) {
    console.error(`\n${failures.length} failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
} else if (args.length === 2) {
  buildSchematic(args[0], args[1]);
} else {
  console.error('Usage: export-schematics.mjs <root.kicad_sch> <handle>  |  --all');
  process.exit(2);
}
