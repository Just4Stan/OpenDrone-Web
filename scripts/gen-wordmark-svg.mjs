// Emit a standalone single-color SVG of the OpenDrone wordmark for KiCad
// silkscreen import. Reads the same traced paths used by HeroWordmark.
// Usage: node scripts/gen-wordmark-svg.mjs > public/opendrone-wordmark.svg
import {
  WORDMARK_VIEWBOX,
  WORDMARK_GROUP_TRANSFORM,
  WORDMARK_LETTERS,
} from '../app/data/wordmark.ts';

const paths = WORDMARK_LETTERS.map(
  (l) => `    <path d="${l.d.replace(/\n/g, ' ')}"/>`,
).join('\n');

process.stdout.write(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEWBOX}">\n` +
    `  <g transform="${WORDMARK_GROUP_TRANSFORM}" fill="#000000">\n` +
    `${paths}\n` +
    `  </g>\n` +
    `</svg>\n`,
);
