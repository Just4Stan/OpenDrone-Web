#!/usr/bin/env node
/**
 * Tally the community vote from Shopify orders into content/votes.json.
 *
 * Each order may carry a `_vote_rank` custom attribute (set by the cart
 * ballot, validated by the cart action): up to three roadmap ids joined by
 * `>`, ranked. Scoring is 3/2/1 by rank, one ballot per order. Ids that are
 * no longer votable still count if they are still on the roadmap; ids that
 * left the roadmap are dropped.
 *
 * Run:  npm run votes:tally          (dry run, prints the tally)
 *       npm run votes:tally -- --write   (also writes content/votes.json)
 *
 * Env (repo .env): PUBLIC_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN. The token
 * needs the `read_orders` scope; note the default custom-app token used for
 * newsletter tagging may not have it, grant it in the app's Admin API scopes.
 * Optional: SHOPIFY_ADMIN_API_VERSION (defaults below).
 *
 * The result is committed content: review the diff (or the studio's Goals
 * tab) before pushing, like any other edit. Run it on whatever rhythm feels
 * right; the roadmap page shows the `updated` date.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_VERSION_FALLBACK = '2026-01';
const VOTES_FILE = path.join(ROOT, 'content', 'votes.json');

// Mirrors app/lib/votes.ts (VOTE_ATTR_KEY / weights / separator). This
// script cannot import the TS module, so the codec rules are restated; the
// unit test in app/lib/votes.test.ts greps this file to keep them in step.
const VOTE_ATTR_KEY = '_vote_rank';
const WEIGHTS = [3, 2, 1];
const SEPARATOR = '>';

/** Every roadmap id, hand-mirrored from app/lib/roadmap-data.ts. */
const ROADMAP_IDS = new Set([
  'openfc_lite_30',
  'openfc_lite_mini_20',
  'openesc_20',
  'openesc_30',
  'openrx_lite',
  'openrx_lite_ufl',
  'openrx_mono',
  'openrx_gemini',
  'openframe',
  'motors',
  'openvtx',
  'openremoteid',
  'openaio',
  'charger',
]);

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

if (!env.PUBLIC_STORE_DOMAIN || !env.SHOPIFY_ADMIN_API_TOKEN) {
  console.error(
    'PUBLIC_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN must be set in .env',
  );
  process.exit(1);
}

async function adminGraphql(query, variables) {
  const version = env.SHOPIFY_ADMIN_API_VERSION || API_VERSION_FALLBACK;
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${version}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_API_TOKEN,
      },
      body: JSON.stringify({query, variables}),
    },
  );
  if (!res.ok) throw new Error(`Admin API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Admin API: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  return json.data;
}

const ORDERS_QUERY = `
  query VoteOrders($cursor: String) {
    orders(first: 250, after: $cursor, query: "status:any") {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        cancelledAt
        customAttributes { key value }
      }
    }
  }
`;

function parseVoteRank(value) {
  if (typeof value !== 'string' || value.length > 64) return [];
  const out = [];
  for (const raw of value.split(SEPARATOR)) {
    const id = raw.trim();
    if (!id || out.includes(id) || !ROADMAP_IDS.has(id)) continue;
    out.push(id);
    if (out.length === WEIGHTS.length) break;
  }
  return out;
}

// MERGE, never recount from scratch: without read_all_orders the Admin API
// only returns the last 60 days, so a full recount would silently drop
// every older ballot on each weekly run. Ballots are therefore persisted
// per order name in votes.json (ballots_by_order) and each run overlays
// the fetch window onto that record: orders inside the window update or
// (when cancelled/cleared) remove their entry, orders outside it keep the
// recorded ballot forever.
let prior = {};
try {
  prior =
    JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8')).ballots_by_order ?? {};
} catch {
  // First run, or a pre-merge votes.json: start from nothing recorded.
}

let cursor = null;
let orders = 0;
const merged = {...prior};

for (;;) {
  const data = await adminGraphql(ORDERS_QUERY, {cursor});
  const page = data?.orders;
  if (!page) break;
  for (const order of page.nodes) {
    orders += 1;
    const attr = order.customAttributes?.find((a) => a.key === VOTE_ATTR_KEY);
    const rank = order.cancelledAt ? [] : parseVoteRank(attr?.value);
    if (rank.length) merged[order.name] = rank;
    else delete merged[order.name];
  }
  if (!page.pageInfo.hasNextPage) break;
  cursor = page.pageInfo.endCursor;
}

let ballots = 0;
const points = {};
const mentions = {};
for (const rank of Object.values(merged)) {
  ballots += 1;
  rank.forEach((id, i) => {
    if (!ROADMAP_IDS.has(id)) return;
    points[id] = (points[id] ?? 0) + WEIGHTS[i];
    mentions[id] = (mentions[id] ?? 0) + 1;
  });
}

const tally = {
  $comment:
    'Community vote tally. Written by scripts/tally-votes.mjs from order attributes; reviewable and correctable in the studio’s Goals tab. Read by app/lib/votes.ts.',
  updated: new Date().toISOString().slice(0, 10),
  ballots,
  points: Object.fromEntries(
    Object.entries(points).sort(([, a], [, b]) => b - a),
  ),
  mentions: Object.fromEntries(
    Object.entries(mentions).sort(([, a], [, b]) => b - a),
  ),
  // The per-order record the merge above overlays onto. Keep it in the
  // file: deleting it turns the next run back into a 60-day recount.
  ballots_by_order: merged,
};

console.log(`${orders} orders scanned, ${ballots} ballots`);
for (const [id, p] of Object.entries(tally.points)) {
  console.log(`  ${id.padEnd(20)} ${p}`);
}

if (WRITE) {
  fs.writeFileSync(VOTES_FILE, `${JSON.stringify(tally, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, VOTES_FILE)}; review and commit it`);
} else {
  console.log('dry run; pass --write to update content/votes.json');
}
