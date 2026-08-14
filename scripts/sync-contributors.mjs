#!/usr/bin/env node
/**
 * Snapshot each product's GitHub contributors into content/contributors.json.
 *
 * The PDP fetches contributors live, but Oxygen shares its egress IP with the
 * rest of the platform, so the unauthenticated GitHub ceiling (60 calls an
 * hour, per IP) is spent long before a visitor arrives: the wall came up
 * empty on most product pages and showed only the "+ you" tile. This file is
 * the floor under that fetch. Live data still wins when it comes back; the
 * snapshot is what the page falls back to instead of nothing.
 *
 * Run:  npm run sync:contributors            (dry run, prints the roster)
 *       npm run sync:contributors -- --write (also writes the file)
 *
 * Env: GITHUB_TOKEN optional locally (repo .env), required in CI, where the
 * workflow's own token is enough. Without one the script runs against the
 * same 60/hr ceiling as the site and will usually 403 — it then exits
 * non-zero rather than committing an empty roster over a good one.
 *
 * Repos come from `repoUrl` in content/products/*.json, top level plus every
 * variant, which is the same set app/routes/products.$handle.tsx feeds to
 * fetchContributors. Committed content: review the diff before it ships.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'content', 'products');
const OUT_FILE = path.join(ROOT, 'content', 'contributors.json');
/** Matches the live fetch's cap in app/lib/github.ts. */
const LIMIT = 12;

function loadEnv() {
  const env = {};
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = {...loadEnv(), ...process.env};
const WRITE = process.argv.includes('--write');
const TOKEN = env.GITHUB_TOKEN || '';

/** handle → repo URLs, mirroring the loader's own repo set. */
function productRepos() {
  const out = {};
  for (const file of fs.readdirSync(PRODUCTS_DIR).sort()) {
    if (!file.endsWith('.json') || file.startsWith('_')) continue;
    const handle = file.slice(0, -'.json'.length);
    const content = JSON.parse(
      fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8'),
    );
    const urls = [];
    if (content.repoUrl) urls.push(content.repoUrl);
    for (const v of Object.values(content.variants ?? {})) {
      if (v.repoUrl) urls.push(v.repoUrl);
    }
    if (urls.length) out[handle] = [...new Set(urls)];
  }
  return out;
}

/** github.com/owner/repo → {owner, repo}; mirrors parseRepoUrl in lib/github. */
function parseRepoUrl(url) {
  const m = String(url).match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i,
  );
  if (!m) return null;
  return {owner: m[1], repo: m[2].replace(/\.git$/, '')};
}

async function api(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'opendrone-web-sync-contributors',
      ...(TOKEN ? {Authorization: `Bearer ${TOKEN}`} : {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return {res, body, status: res.status};
}

async function contributorsOf(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  // A product whose repo is not public yet points `repoUrl` at the org itself
  // (OpenFrame does). Nothing to fetch, and not an error: the wall shows its
  // invitation tile alone until the repo is published.
  if (!parsed) return null;
  // The site is public and a sync token may well be able to read private
  // repos, so confirm this one is public before publishing who works on it.
  const meta = await api(`/repos/${parsed.owner}/${parsed.repo}`);
  if (meta.status === 404) return null;
  if (!meta.res.ok) {
    throw new Error(`${parsed.owner}/${parsed.repo}: HTTP ${meta.res.status}`);
  }
  if (meta.body?.private) {
    console.log(`  - ${parsed.owner}/${parsed.repo} is private, skipping`);
    return null;
  }
  const {res, body} = await api(
    `/repos/${parsed.owner}/${parsed.repo}/contributors?per_page=30`,
  );
  // 204 is GitHub's "repo exists, no contributors yet", not a failure.
  if (res.status === 204) return [];
  if (!res.ok) {
    throw new Error(`${parsed.owner}/${parsed.repo}: HTTP ${res.status}`);
  }
  return Array.isArray(body) ? body : [];
}

const repos = productRepos();
const roster = {};
let failed = 0;

for (const [handle, urls] of Object.entries(repos)) {
  const merged = new Map();
  for (const url of urls) {
    let rows;
    try {
      rows = await contributorsOf(url);
    } catch (err) {
      console.error(`  ! ${err.message}`);
      failed += 1;
      continue;
    }
    // null: no public repo behind this URL. Recorded as an empty roster.
    for (const row of rows ?? []) {
      if (!row.login || !row.avatar_url || !row.html_url) continue;
      if (row.type === 'Bot' || row.login.endsWith('[bot]')) continue;
      const prev = merged.get(row.login);
      if (prev) {
        prev.contributions += row.contributions ?? 0;
      } else {
        merged.set(row.login, {
          login: row.login,
          avatarUrl: row.avatar_url,
          htmlUrl: row.html_url,
          contributions: row.contributions ?? 0,
        });
      }
    }
  }
  roster[handle] = [...merged.values()]
    .sort((a, b) => b.contributions - a.contributions || a.login.localeCompare(b.login))
    .slice(0, LIMIT);
  console.log(
    `${handle.padEnd(14)} ${roster[handle].length} contributor(s): ` +
      roster[handle].map((c) => `${c.login} (${c.contributions})`).join(', '),
  );
}

if (failed) {
  console.error(
    `${failed} repo fetch(es) failed${TOKEN ? '' : '; set GITHUB_TOKEN to lift the 60/hr unauthenticated limit'}. ` +
      'Not writing a partial roster over a good one.',
  );
  process.exit(1);
}

const snapshot = {
  $comment:
    'Contributor roster per product handle. Written by scripts/sync-contributors.mjs from the GitHub API; read by app/lib/contributors-snapshot.ts as the fallback when the live fetch is rate-limited.',
  updated: new Date().toISOString().slice(0, 10),
  products: roster,
};

if (WRITE) {
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, OUT_FILE)}; review and commit it`);
} else {
  console.log('dry run; pass --write to update content/contributors.json');
}
