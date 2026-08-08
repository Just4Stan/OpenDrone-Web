/**
 * One-shot: lift LEGAL_LABELS out of app/lib/i18n.ts into
 * content/copy/legal-labels.json so the studio can edit it. Kept in the repo
 * so the move is reproducible rather than a thing that happened once.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const m = await import(path.join(root, 'app/lib/i18n.ts'));
const out = path.join(root, 'content/copy/legal-labels.json');
fs.writeFileSync(
  out,
  `${JSON.stringify({$title: 'Legal page titles', ...m.LEGAL_LABELS}, null, 2)}\n`,
);
console.warn(`Wrote ${Object.keys(m.LEGAL_LABELS).length} legal slugs to ${path.relative(root, out)}`);
