/**
 * How much of the site is editable in the studio, per file.
 *
 * Answers the question nobody could answer while the migration was in flight:
 * which pages still have words baked into the code. Run it any time:
 *
 *   npm run studio:coverage
 *
 * The heuristic is deliberately crude and errs toward over-reporting. It counts
 * text that sits between JSX tags and looks like prose, and it cannot tell a
 * heading from a CSS class that happens to contain a space. Treat a non-zero
 * count as "worth a look", not as a defect. The numbers are useful as a
 * direction of travel and for spotting a page nobody has touched at all.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** Text between `>` and `<` that reads like a sentence rather than markup. */
const JSX_TEXT = />([^<>{}\n][^<>{}]{2,})</g;

/**
 * Things that look like prose to the regex but are not copy.
 * Kept explicit so the report can be trusted rather than argued with.
 */
const NOT_COPY = [
  /^[\s.,:;·—–|/\\-]+$/, // punctuation and separators
  /^[A-Z_]+$/, // SCREAMING_CONSTANTS
  /^\d[\d\s.,:%×x+-]*$/, // numbers, dimensions, percentages
  /^(https?:|\/|#|mailto:)/, // urls and hrefs
  /^\{.*\}$/, // an interpolation the regex half-caught
  /^&[a-z]+;$/, // a lone entity
];

const isCopy = (s) => {
  const t = s.trim();
  if (t.length < 3) return false;
  if (NOT_COPY.some((r) => r.test(t))) return false;
  // Needs at least one run of letters to be words rather than symbols.
  return /[A-Za-z]{3}/.test(t);
};

function scan(file) {
  const src = fs.readFileSync(file, 'utf8');
  // Strip comments first: a sentence in a docblock is not shipped copy, and
  // this file has a lot of prose in comments.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const editable = (code.match(/<Txt\b/g) ?? []).length;
  const copyText = (code.match(/\bcopyText\(/g) ?? []).length;

  const hard = [];
  let m;
  JSX_TEXT.lastIndex = 0;
  while ((m = JSX_TEXT.exec(code))) {
    if (isCopy(m[1])) hard.push(m[1].trim().replace(/\s+/g, ' ').slice(0, 60));
  }
  return {editable: editable + copyText, hard};
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'studio') continue; // the tool itself is not site copy
      walk(abs, out);
    } else if (e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx')) {
      // Not site copy: the studio itself, the component that renders copy, and
      // API routes, whose strings are protocol rather than prose.
      if (e.name === 'studio.tsx' || e.name === 'Txt.tsx') continue;
      if (e.name.startsWith('api.') || e.name.startsWith('[')) continue;
      out.push(abs);
    }
  }
  return out;
}

const files = [
  ...walk(path.join(root, 'app/routes')),
  ...walk(path.join(root, 'app/components')),
].sort();

const rows = files
  .map((f) => ({file: path.relative(root, f), ...scan(f)}))
  .filter((r) => r.editable > 0 || r.hard.length > 0);

const done = rows.filter((r) => r.hard.length === 0 && r.editable > 0);
const partial = rows.filter((r) => r.hard.length > 0 && r.editable > 0);
const untouched = rows.filter((r) => r.editable === 0);

const show = (label, list) => {
  if (!list.length) return;
  console.warn(`\n${label} (${list.length})`);
  for (const r of list.sort((a, b) => b.hard.length - a.hard.length)) {
    console.warn(`  ${String(r.hard.length).padStart(4)} left  ${r.file}`);
  }
};

console.warn('Studio coverage. "left" = strings that still look hardcoded.');
show('FULLY EDITABLE', done);
show('PARTLY MIGRATED', partial);
show('NOT MIGRATED', untouched);

const totalHard = rows.reduce((a, r) => a + r.hard.length, 0);
const totalEditable = rows.reduce((a, r) => a + r.editable, 0);
console.warn(
  `\n${totalEditable} editable bindings, ~${totalHard} strings still in code across ${rows.length} files.`,
);

if (process.argv.includes('--detail')) {
  console.warn('\nRemaining strings:');
  for (const r of [...partial, ...untouched]) {
    if (!r.hard.length) continue;
    console.warn(`\n${r.file}`);
    for (const h of r.hard.slice(0, 12)) console.warn(`  ${h}`);
    if (r.hard.length > 12) console.warn(`  ... ${r.hard.length - 12} more`);
  }
}
