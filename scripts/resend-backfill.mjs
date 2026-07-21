#!/usr/bin/env node
// Resend contact backfill — one-shot sync of every consented subscriber
// from Shopify into Resend contacts + notify-<handle> segments.
//
// Why this exists: upsertContact in app/lib/growth/resend.ts silently
// failed from launch until 2026-07-21 (wrong POST /contacts payload
// shape), so welcome emails went out but no contacts were ever created.
// Shopify (customer + notify tag + marketing consent) is the durable
// record of every signup; this script replays it into Resend so
// Broadcasts (launch blast, back-in-stock) have a real audience.
//
// Usage:
//   node scripts/resend-backfill.mjs           dry run (default): print the delta
//   node scripts/resend-backfill.mjs --live    write contacts + memberships
//
// Safe to re-run: existing contacts fall back to a plain membership add,
// and `unsubscribed` is never sent, so an opt-out always survives.
//
// Env (repo .env): RESEND_API_KEY, PUBLIC_STORE_DOMAIN,
// SHOPIFY_ADMIN_API_TOKEN, optional SHOPIFY_ADMIN_API_VERSION.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RESEND_API = 'https://api.resend.com';

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
const LIVE = process.argv.includes('--live');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resend(method, apiPath, body) {
  const res = await fetch(`${RESEND_API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // empty body
  }
  return {ok: res.ok, status: res.status, json};
}

// --- Shopify: every customer with explicit marketing consent ---------------

async function fetchShopifyAudience() {
  const shop = env.PUBLIC_STORE_DOMAIN;
  const token = env.SHOPIFY_ADMIN_API_TOKEN;
  if (!shop || !token) {
    throw new Error('PUBLIC_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN missing');
  }
  const version = env.SHOPIFY_ADMIN_API_VERSION || '2026-01';
  const endpoint = `https://${shop}/admin/api/${version}/graphql.json`;
  const query = `
    query BackfillAudience($cursor: String) {
      customers(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          email
          tags
          emailMarketingConsent { marketingState }
        }
      }
    }
  `;
  const subscribed = new Map(); // email -> Set<handle>
  let cursor = null;
  for (let i = 0; i < 200; i++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables: {cursor}}),
    });
    const json = await res.json();
    if (json.errors) {
      throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors)}`);
    }
    const page = json.data.customers;
    for (const c of page.nodes) {
      if (!c.email) continue;
      if (c.emailMarketingConsent?.marketingState !== 'SUBSCRIBED') continue;
      const handles = new Set(
        (c.tags ?? [])
          .filter((t) => t.startsWith('notify-'))
          .map((t) => t.slice('notify-'.length)),
      );
      subscribed.set(c.email.toLowerCase(), handles);
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return subscribed;
}

// --- Resend: current segments + membership ---------------------------------

async function listSegments() {
  const segments = new Map(); // name -> id
  let after = null;
  for (let i = 0; i < 20; i++) {
    const q = after
      ? `?limit=100&after=${encodeURIComponent(after)}`
      : '?limit=100';
    const r = await resend('GET', `/segments${q}`);
    if (!r.ok) throw new Error(`list segments failed: ${r.status}`);
    const items = r.json?.data ?? [];
    for (const s of items) segments.set(s.name, s.id);
    if (!r.json?.has_more || items.length === 0) break;
    after = items[items.length - 1]?.id ?? null;
    if (!after) break;
  }
  return segments;
}

async function listSegmentEmails(segmentId) {
  const emails = new Set();
  let after = null;
  for (let i = 0; i < 200; i++) {
    const q = after
      ? `?limit=100&after=${encodeURIComponent(after)}`
      : '?limit=100';
    const r = await resend('GET', `/segments/${segmentId}/contacts${q}`);
    if (!r.ok) throw new Error(`list segment contacts failed: ${r.status}`);
    const items = r.json?.data ?? [];
    for (const c of items) {
      if (c.email) emails.add(c.email.toLowerCase());
    }
    if (!r.json?.has_more || items.length === 0) break;
    after = items[items.length - 1]?.id ?? null;
    if (!after) break;
  }
  return emails;
}

// --- sync -------------------------------------------------------------------

// Returns null when the segment can't be created (free plan caps
// segments at 3) — callers fall back to plain contacts so the addresses
// at least exist in Resend.
async function ensureSegment(segments, name) {
  const existing = segments.get(name);
  if (existing) return existing;
  const created = await resend('POST', '/segments', {name});
  if (!created.ok) {
    console.warn(
      `  ! cannot create segment ${name} (${created.status}: ${created.json?.message ?? ''}) — falling back to plain contacts`,
    );
    return null;
  }
  segments.set(name, created.json.id);
  console.log(`  created segment ${name}`);
  return created.json.id;
}

// Create with membership; existing contacts fall back to a plain segment
// add. segments must be objects ([{id}], not [id]) — strings 422.
async function addToSegment(email, segmentId) {
  const created = await resend('POST', '/contacts', {
    email,
    segments: [{id: segmentId}],
  });
  if (created.ok) return true;
  const added = await resend(
    'POST',
    `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
  );
  return added.ok;
}

async function createPlainContact(email) {
  const created = await resend('POST', '/contacts', {email});
  // Non-ok here almost always means "already exists", which is success
  // for a backfill.
  return created.ok || created.status === 409;
}

async function main() {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing in .env');
  console.log(`\n[resend-backfill] mode: ${LIVE ? 'LIVE' : 'DRY RUN'}`);

  const shopify = await fetchShopifyAudience();
  console.log(`  Shopify subscribed customers: ${shopify.size}`);

  const segments = await listSegments();
  const handles = new Set(
    [...shopify.values()].flatMap((set) => [...set]),
  );

  let writes = 0;
  let failures = 0;

  // Per-handle segment membership.
  for (const handle of [...handles].sort()) {
    const name = `notify-${handle}`;
    const wanted = [...shopify.entries()]
      .filter(([, tags]) => tags.has(handle))
      .map(([email]) => email);
    const segmentId = segments.get(name);
    const current = segmentId ? await listSegmentEmails(segmentId) : new Set();
    const delta = wanted.filter((e) => !current.has(e));
    console.log(
      `  ${name}: ${wanted.length} in Shopify, ${current.size} in Resend, ${delta.length} to sync`,
    );
    if (!LIVE || delta.length === 0) continue;
    const id = await ensureSegment(segments, name);
    for (const email of delta) {
      const ok = id ? await addToSegment(email, id) : await createPlainContact(email);
      if (ok) {
        writes++;
      } else {
        failures++;
        console.warn(`  ! failed: ${email} -> ${name}`);
      }
      await sleep(600); // stay under Resend's default 2 req/s
    }
  }

  // Plain contacts for subscribers with no notify tag (general newsletter).
  const general = [...shopify.entries()]
    .filter(([, tags]) => tags.size === 0)
    .map(([email]) => email);
  console.log(`  general (no notify tag): ${general.length} subscribers`);
  if (LIVE) {
    for (const email of general) {
      if (await createPlainContact(email)) {
        writes++;
      } else {
        failures++;
        console.warn(`  ! failed: ${email}`);
      }
      await sleep(600);
    }
  }

  if (LIVE) {
    console.log(`\n✓ Backfill done: ${writes} writes, ${failures} failures.\n`);
  } else {
    console.log('\n✓ Dry run — nothing written. Re-run with --live.\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
