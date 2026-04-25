#!/usr/bin/env node
// Sync legal Markdown snapshots from the compliance repo into
// app/content/legal/. The storefront is the source of truth for the
// snapshot committed to git; the compliance repo is the single source of
// truth for authoring.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const ICLOUD_DEFAULT = path.join(
  process.env.HOME || '',
  // Optional default — override with COMPLIANCE_SRC env var. Looks for
  // a sibling `compliance` checkout next to this repo on the maintainer's
  // machine; falls through to a no-op when not present.
  '../compliance',
);

const SRC_ROOT = process.env.COMPLIANCE_SRC || ICLOUD_DEFAULT;

// { destBasename: relative path inside COMPLIANCE_SRC }
const FILES = {
  'algemene-voorwaarden.md': 'webshop/algemene-voorwaarden.md',
  'privacy-policy.md': 'webshop/privacy-policy.md',
  'cookie-policy.md': 'webshop/cookie-policy.md',
  'herroepingsformulier.md': 'webshop/herroepingsformulier.md',
  'peppol-e-invoicing.md': 'webshop/peppol-e-invoicing.md',
  'export-control-memo.md': 'export-sanctions/export-control-memo.md',
  'vulnerability-handling-policy.md':
    'product/vulnerability-handling-policy.md',
};

// NL is the authoritative source synced from the compliance repo.
// EN translations live in app/content/legal/en/ and are hand-authored.
const destDir = path.join(repoRoot, 'app/content/legal/nl');

async function main() {
  await fs.mkdir(destDir, {recursive: true});

  const srcAvailable = await fs
    .stat(SRC_ROOT)
    .then(() => true)
    .catch(() => false);

  if (!srcAvailable) {
    console.warn(
      `[sync-legal] Source not found: ${SRC_ROOT}\n` +
        `[sync-legal] Skipping. Existing snapshot in app/content/legal/ is preserved.`,
    );
    return;
  }

  let copied = 0;
  let missing = 0;

  for (const [destName, relSrc] of Object.entries(FILES)) {
    const src = path.join(SRC_ROOT, relSrc);
    const dest = path.join(destDir, destName);
    try {
      const content = await fs.readFile(src, 'utf8');
      await fs.writeFile(dest, content, 'utf8');
      copied++;
      console.warn(`[sync-legal] ${destName}`);
    } catch (err) {
      missing++;
      console.warn(`[sync-legal] missing ${relSrc} (${err.code || err.message})`);
    }
  }

  console.warn(`[sync-legal] done. copied=${copied} missing=${missing}`);
}

main().catch((err) => {
  console.error('[sync-legal] error:', err);
  process.exit(1);
});
