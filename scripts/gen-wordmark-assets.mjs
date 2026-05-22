#!/usr/bin/env node
// Generate per-letter SVG paths for the OpenDrone wordmark from SF Pro
// (SFNS.ttf, weight 700). Each letter is emitted as its own <path> with
// a stable id so the HeroWordmark component can animate them
// independently. Uses fontkit because it actually applies variable-font
// axes to the outline data — opentype.js 2.0 stores the axis values
// but doesn't deform the glyphs, so weight 700 came out looking like 400.
//
// Inputs (env or default):
//   FONT_PATH   /System/Library/Fonts/SFNS.ttf
//   FONT_SIZE   1000 (logical units; large for precision)
//   WEIGHT      700  (mapped to the wght axis on the variable font)
//   TRACKING    -0.03 (em — matches the existing PNG's letter-spacing)
//   OUT         public/opendrone-wordmark.svg
//   OUT_TS      app/data/wordmark.ts
//
// Run: node scripts/gen-wordmark-assets.mjs

import fs from 'node:fs';
import path from 'node:path';
import * as fontkit from 'fontkit';

// Default to SFCompact.ttf rather than SFNS.ttf — SF Pro encodes lowercase
// 'e' (and a few others) as a single self-intersecting contour, which is
// fine for filled rendering but draws ugly internal "bridge" lines when
// stroked as wireframe. SF Compact uses proper 2-contour encoding for
// the same glyphs and looks nearly identical at this size.
const FONT_PATH = process.env.FONT_PATH || '/System/Library/Fonts/SFCompact.ttf';
const FONT_SIZE = Number(process.env.FONT_SIZE || 1000);
const WEIGHT = Number(process.env.WEIGHT || 700);
const TRACKING = Number(process.env.TRACKING || -0.03);
const OUT = process.env.OUT || 'public/opendrone-wordmark.svg';
const OUT_TS = process.env.OUT_TS || 'app/data/wordmark.ts';

const TEXT = 'OpenDrone';
const SPLIT_AT = 4; // "Open" | "Drone"
const COLOR_OPEN = '#e5e5e5';
const COLOR_DRONE = '#b8922e';

const baseFont = fontkit.openSync(FONT_PATH);

// SFNS has a 'wght' axis (1..1000). Apply the requested weight via a
// variation instance — fontkit deforms the outlines for us.
const font = baseFont.variationAxes?.wght
  ? baseFont.getVariation({wght: WEIGHT})
  : baseFont;

// Layout the full string so we get kerning + advance widths. We then
// post-apply our em-relative letter-spacing on top of fontkit's
// positions, since fontkit doesn't have a built-in tracking knob.
const run = font.layout(TEXT);

const scale = FONT_SIZE / font.unitsPerEm;
const trackingPx = TRACKING * FONT_SIZE;

let pen = 0;
const letters = [];
let minY = Infinity;
let maxY = -Infinity;
let minX = Infinity;
let maxX = -Infinity;

for (let i = 0; i < run.glyphs.length; i++) {
  const glyph = run.glyphs[i];
  const pos = run.positions[i];
  const ch = TEXT[i];

  const xOff = (pos.xOffset || 0) * scale;
  const yOff = (pos.yOffset || 0) * scale;
  // fontkit path coords are in font units, y-up. Build a transform that
  // scales to FONT_SIZE and flips Y so we match SVG's y-down space.
  const dx = pen + xOff;
  const dy = -yOff; // y-down

  // fontkit emits long command names (moveTo, quadraticCurveTo, ...);
  // SVG path data wants single letters (M, Q, ...). Map them, then
  // transform args (font units y-up → SVG y-down, scaled, positioned).
  const CMD_MAP = {
    moveTo: 'M',
    lineTo: 'L',
    quadraticCurveTo: 'Q',
    bezierCurveTo: 'C',
    closePath: 'Z',
  };

  const cmds = glyph.path.commands.map((c) => {
    const args = c.args.map((v, idx) => {
      const isX = idx % 2 === 0;
      return isX ? dx + v * scale : dy - v * scale;
    });
    const letter = CMD_MAP[c.command];
    if (!letter) throw new Error(`Unknown fontkit command: ${c.command}`);
    return {command: letter, args};
  });

  const fmt = (v) => {
    const s = v.toFixed(2);
    return s.replace(/\.?0+$/, '');
  };

  const d = cmds
    .map((c) => {
      if (c.command === 'Z') return 'Z';
      // Space-separate args; prefix first arg of each segment with the
      // letter. Leading minus signs serve as separators between numbers
      // too, but a leading space is always safe.
      return c.command + c.args.map(fmt).join(' ');
    })
    .join(' ');

  // Bounding box for the viewBox calc.
  const bb = glyph.bbox;
  // bbox is in font units, y-up. Transform corners.
  const tx = [bb.minX, bb.maxX].map((x) => dx + x * scale);
  const ty = [bb.minY, bb.maxY].map((y) => dy - y * scale);
  const x1 = Math.min(...tx);
  const x2 = Math.max(...tx);
  const y1 = Math.min(...ty);
  const y2 = Math.max(...ty);
  if (Number.isFinite(y1)) minY = Math.min(minY, y1);
  if (Number.isFinite(y2)) maxY = Math.max(maxY, y2);
  if (Number.isFinite(x1)) minX = Math.min(minX, x1);
  if (Number.isFinite(x2)) maxX = Math.max(maxX, x2);

  letters.push({
    ch,
    d,
    group: i < SPLIT_AT ? 'open' : 'drone',
    index: i,
  });

  // Advance the pen by the glyph's natural advance plus tracking.
  pen += (pos.xAdvance || glyph.advanceWidth) * scale + trackingPx;
}

if (!Number.isFinite(minY)) {
  const asc = (font.ascent ?? font['OS/2']?.typoAscender ?? 1980) * scale;
  const desc = (font.descent ?? font['OS/2']?.typoDescender ?? -432) * scale;
  minY = -asc;
  maxY = -desc;
}

const pad = 40;
const vbX = Math.floor(minX) - pad;
const vbY = Math.floor(minY) - pad;
const vbW = Math.ceil(maxX - minX) + pad * 2;
const vbH = Math.ceil(maxY - minY) + pad * 2;

const pathsXml = letters
  .map(
    ({ch, d, group, index}) =>
      `    <path id="letter-${index}" class="hw-letter hw-letter--${group}" data-char="${ch}" d="${d}" />`,
  )
  .join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  OpenDrone wordmark — generated from SF Pro 700.
  Regenerate with: node scripts/gen-wordmark-assets.mjs
  Each letter is a discrete <path id="letter-N"> so the hero animation
  can stroke-draw and fill them independently.
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${vbX} ${vbY} ${vbW} ${vbH}"
  role="img"
  aria-label="OpenDrone"
  preserveAspectRatio="xMidYMid meet"
>
  <style>
    .hw-letter { fill: currentColor; }
    .hw-letter--open  { color: ${COLOR_OPEN}; }
    .hw-letter--drone { color: ${COLOR_DRONE}; }
  </style>
  <g class="hw-group hw-group--open">
${pathsXml
  .split('\n')
  .filter((line) => line.includes('hw-letter--open'))
  .join('\n')}
  </g>
  <g class="hw-group hw-group--drone">
${pathsXml
  .split('\n')
  .filter((line) => line.includes('hw-letter--drone'))
  .join('\n')}
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, svg);

const ts = `// AUTO-GENERATED by scripts/gen-wordmark-assets.mjs — do not edit.
// Regenerate: node scripts/gen-wordmark-assets.mjs

export const WORDMARK_VIEWBOX = '${vbX} ${vbY} ${vbW} ${vbH}';
export const WORDMARK_FILL_OPEN = '${COLOR_OPEN}';
export const WORDMARK_FILL_DRONE = '${COLOR_DRONE}';

export type WordmarkLetter = {
  ch: string;
  d: string;
  group: 'open' | 'drone';
  index: number;
};

export const WORDMARK_LETTERS: WordmarkLetter[] = [
${letters
  .map(
    (l) =>
      `  {ch: ${JSON.stringify(l.ch)}, group: ${JSON.stringify(l.group)}, index: ${l.index}, d: ${JSON.stringify(l.d)}},`,
  )
  .join('\n')}
];
`;

fs.mkdirSync(path.dirname(OUT_TS), {recursive: true});
fs.writeFileSync(OUT_TS, ts);

console.log(`Wrote ${OUT}`);
console.log(`Wrote ${OUT_TS}`);
console.log(`viewBox: ${vbX} ${vbY} ${vbW} ${vbH}`);
console.log(`Letters: ${letters.map((l) => l.ch).join('')}`);
console.log(`Weight axis applied: ${WEIGHT}`);
