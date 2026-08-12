#!/usr/bin/env node
/**
 * Move the auto-mode financial goals in content/goals.json from Shopify
 * order totals.
 *
 * For each goal with `mode: "auto"`, sums the current total of every
 * non-cancelled order created since the goal's `since` date, applies the
 * goal's `allocation_pct`, divides by `target_eur`, and floors to 5% steps.
 * The coarse rounding is the point: the public meter stays "somewhere in
 * this 5% band of an approximate target" and never resolves to a revenue
 * figure. Manual-mode goals are never touched.
 *
 * Mirrors computeAutoPct in app/lib/goals.ts (this script cannot import TS);
 * the unit test in app/lib/goals.test.ts greps this file to keep the formula
 * in step.
 *
 * Run:  npm run goals:update           (dry run, prints the result)
 *       npm run goals:update -- --write    (also writes content/goals.json)
 *
 * Env (repo .env or process env): PUBLIC_STORE_DOMAIN,
 * SHOPIFY_ADMIN_API_TOKEN (needs `read_orders`). Optional:
 * SHOPIFY_ADMIN_API_VERSION.
 *
 * The result is committed content: the community-sync workflow runs this
 * weekly and opens a PR, so the diff is always reviewed before it deploys.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_VERSION_FALLBACK = '2026-01';
const GOALS_FILE = path.join(ROOT, 'content', 'goals.json');
const AUTO_PCT_STEP = 5;

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
  query GoalOrders($cursor: String, $query: String!) {
    orders(first: 250, after: $cursor, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        cancelledAt
        currentTotalPriceSet { shopMoney { amount } }
      }
    }
  }
`;

/** Sum of non-cancelled order totals (EUR) created on/after `since`. */
async function grossSince(since) {
  let cursor = null;
  let gross = 0;
  const query = `status:any created_at:>=${since}`;
  for (;;) {
    const data = await adminGraphql(ORDERS_QUERY, {cursor, query});
    const page = data?.orders;
    if (!page) break;
    for (const order of page.nodes) {
      if (order.cancelledAt) continue;
      gross += parseFloat(
        order.currentTotalPriceSet?.shopMoney?.amount ?? '0',
      );
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return gross;
}

// Mirror of computeAutoPct in app/lib/goals.ts.
function computeAutoPct(grossEur, goal) {
  if (goal.mode !== 'auto' || !goal.target_eur || goal.target_eur <= 0) {
    return null;
  }
  const counted = Math.max(0, grossEur) * (goal.allocation_pct / 100);
  const raw = (counted / goal.target_eur) * 100;
  return Math.min(100, Math.floor(raw / AUTO_PCT_STEP) * AUTO_PCT_STEP);
}

const doc = JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8'));
let changed = false;

for (const goal of doc.goals ?? []) {
  if (goal.mode !== 'auto') {
    console.error(`  ${goal.id}: manual, skipped`);
    continue;
  }
  if (!goal.since || !goal.target_eur) {
    console.error(`  ${goal.id}: auto but missing since/target_eur, skipped`);
    continue;
  }
  const gross = await grossSince(goal.since);
  const pct = computeAutoPct(gross, goal);
  if (pct === null) continue;
  console.error(
    `  ${goal.id}: ${pct}% (was ${goal.progress_pct}%)`,
  );
  if (pct !== goal.progress_pct) {
    goal.progress_pct = pct;
    changed = true;
  }
}

if (!changed) {
  console.error('no changes');
} else if (WRITE) {
  fs.writeFileSync(GOALS_FILE, `${JSON.stringify(doc, null, 2)}\n`);
  console.error(`wrote ${path.relative(ROOT, GOALS_FILE)}; review and commit it`);
} else {
  console.error('dry run; pass --write to update content/goals.json');
}
