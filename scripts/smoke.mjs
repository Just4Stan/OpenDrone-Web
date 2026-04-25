#!/usr/bin/env node
// Smoke test for OpenDrone web — hits the most important routes against
// a running dev or preview server and asserts status, headers, and a
// few content invariants. Default base URL: http://localhost:3000.
//
//   node scripts/smoke.mjs               # local dev
//   BASE=https://opendrone.be node scripts/smoke.mjs
//
// Exits non-zero on the first failure. Designed to run in CI or before
// a deploy without spinning up a test framework.

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');

const cases = [
  {
    path: '/',
    expectStatus: 200,
    expectInBody: ['OpenDrone', 'Open Source Drone Parts'],
  },
  {path: '/healthz', expectStatus: 200, expectInBody: ['ok']},
  {path: '/robots.txt', expectStatus: 200, expectInBody: ['User-agent']},
  {path: '/sitemap.xml', expectStatus: 200, expectInBody: ['<?xml']},
  {
    path: '/.well-known/security.txt',
    expectStatus: 200,
    expectInBody: ['Contact:'],
  },
  {path: '/contact', expectStatus: 200, expectInBody: ['Contact', 'Discord']},
  {path: '/support', expectStatus: 200, expectInBody: ['Support']},
  {path: '/releases', expectStatus: 200, expectInBody: ['Release']},
  {path: '/releases.rss', expectStatus: 200, expectInBody: ['<rss', 'channel']},
  {path: '/open-source', expectStatus: 200, expectInBody: ['Open']},
  {path: '/firmware-partners', expectStatus: 200, expectInBody: ['Partner']},
  {path: '/legal', expectStatus: 200, expectInBody: ['Legal']},
  // Legal redirects: unprefixed lands on /en/* and renders the doc.
  {path: '/privacy', expectStatus: 200, expectInBody: ['Privacy']},
  {path: '/terms', expectStatus: 200, expectInBody: ['Terms']},
  {path: '/cookies', expectStatus: 200, expectInBody: ['Cookie']},
  // Newsletter GET should redirect — not 404.
  {path: '/newsletter', expectStatus: 200, expectRedirect: '/releases'},
  // Cart and search load fine without items.
  {path: '/cart', expectStatus: 200, expectInBody: ['Cart']},
  {path: '/search', expectStatus: 200, expectInBody: ['Search']},
  {path: '/collections/all', expectStatus: 200, expectInBody: ['Products']},
  // 404 path returns 404, not 500.
  {path: '/this-route-does-not-exist-xyz', expectStatus: 404},
];

function fail(label, detail) {
  console.error(`FAIL ${label}: ${detail}`);
  process.exitCode = 1;
}

async function run() {
  let ok = 0;
  let bad = 0;
  for (const tc of cases) {
    const url = `${BASE}${tc.path}`;
    let res;
    try {
      res = await fetch(url, {redirect: 'follow', headers: {'user-agent': 'opendrone-smoke/1'}});
    } catch (err) {
      bad++;
      fail(tc.path, `network: ${err.message}`);
      continue;
    }
    const body = await res.text().catch(() => '');
    if (tc.expectStatus !== undefined && res.status !== tc.expectStatus) {
      bad++;
      fail(tc.path, `status ${res.status}, expected ${tc.expectStatus}`);
      continue;
    }
    if (tc.expectRedirect && !res.url.includes(tc.expectRedirect)) {
      bad++;
      fail(tc.path, `expected redirect to ${tc.expectRedirect}, got ${res.url}`);
      continue;
    }
    let missed = false;
    for (const needle of tc.expectInBody || []) {
      if (!body.toLowerCase().includes(needle.toLowerCase())) {
        bad++;
        fail(tc.path, `missing "${needle}" in response body`);
        missed = true;
        break;
      }
    }
    if (missed) continue;
    ok++;
    console.log(`ok   ${tc.path}  (${res.status})`);
  }
  console.log(`\n${ok} passed, ${bad} failed`);
  if (bad > 0) process.exit(1);
}

run();
