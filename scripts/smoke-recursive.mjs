#!/usr/bin/env node
// Recursive smoke test — crawls a base URL up to MAX_DEPTH, reports
// every same-host link's status + Content-Type. Asserts: no 4xx/5xx,
// no broken images, all internal links resolvable.
//
//   BASE=https://opendrone.be node scripts/smoke-recursive.mjs

const BASE_URL = (process.env.BASE || 'https://opendrone.be').replace(/\/$/, '');
const HOST = new URL(BASE_URL).host;
const MAX_DEPTH = Number(process.env.MAX_DEPTH || 2);
const CONCURRENCY = 4;

const visited = new Map();
const failures = [];

function normalize(href) {
  try {
    const url = new URL(href, BASE_URL);
    if (url.host !== HOST) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function extractLinks(html) {
  const out = new Set();
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const n = normalize(m[1]);
    if (n) out.add(n);
  }
  return Array.from(out);
}

async function fetchOne(url) {
  try {
    const r = await fetch(url, {
      headers: {'user-agent': 'opendrone-smoke-recursive/1'},
      redirect: 'manual',
    });
    let body = '';
    const ct = r.headers.get('content-type') || '';
    if (r.status >= 200 && r.status < 300 && ct.includes('text/html')) {
      body = await r.text();
    } else {
      // drain to allow keep-alive reuse
      await r.arrayBuffer().catch(() => {});
    }
    return {status: r.status, ct, body, location: r.headers.get('location')};
  } catch (err) {
    return {status: 0, ct: '', body: '', error: err.message};
  }
}

async function crawl() {
  const queue = [{url: BASE_URL, depth: 0}];
  let inflight = 0;
  await new Promise((resolve) => {
    const tick = () => {
      while (inflight < CONCURRENCY && queue.length) {
        const {url, depth} = queue.shift();
        if (visited.has(url)) continue;
        visited.set(url, 'fetching');
        inflight++;
        fetchOne(url).then((res) => {
          visited.set(url, res);
          const ok =
            res.status >= 200 && res.status < 400 && !res.error;
          const tag = ok ? 'ok ' : 'BAD';
          console.log(
            `${tag} ${res.status} ${url}${res.location ? ' → ' + res.location : ''}`,
          );
          if (!ok) {
            failures.push({url, status: res.status, error: res.error});
          }
          if (ok && res.body && depth < MAX_DEPTH) {
            for (const link of extractLinks(res.body)) {
              if (!visited.has(link)) queue.push({url: link, depth: depth + 1});
            }
          }
          inflight--;
          if (queue.length === 0 && inflight === 0) resolve();
          else tick();
        });
      }
      if (queue.length === 0 && inflight === 0) resolve();
    };
    tick();
  });
}

await crawl();
console.log(`\nVisited ${visited.size} URLs.`);
if (failures.length) {
  console.error(`\n${failures.length} FAILURES:`);
  for (const f of failures) {
    console.error(`  ${f.status || 'ERR'} ${f.url} ${f.error || ''}`);
  }
  process.exit(1);
} else {
  console.log('all clean.');
}
