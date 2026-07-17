#!/usr/bin/env node
/**
 * Quantitative performance audit for opendrone.be surfaces.
 *
 * Drives a real Chromium via Playwright + CDP, optionally CPU-throttled to
 * emulate slow hardware, walks every user-facing surface, and measures:
 *  - navigation metrics (TTFB, FCP, LCP, CLS, domInteractive)
 *  - main-thread long tasks (count, total, worst) per scenario
 *  - frame cadence (avg/p95/worst frame ms, jank counts) during scripted
 *    scrolls and interactions
 *  - input responsiveness: Event Timing entries >= 40ms
 *  - console errors
 *
 * Usage:
 *   node scripts/perf-audit.mjs [--url http://localhost:3001] [--throttle 4]
 *     [--out perf-report.json] [--headed] [--scenario home,pdp,...]
 *
 * Baseline vs fix runs: keep the JSON reports and diff the numbers.
 */
import {chromium} from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')
    ? args[i + 1]
    : dflt;
};
const BASE = argVal('url', 'http://localhost:3001').replace(/\/$/, '');
const THROTTLE = Number(argVal('throttle', '1'));
const OUT = argVal('out', '');
const HEADED = args.includes('--headed');
const ONLY = argVal('scenario', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** In-page measurement helpers, installed fresh on every navigation. */
const HARNESS = `(() => {
  if (window.__pa) return;
  const P = {longTasks: [], events: [], errors: [], cls: 0, lcp: 0};
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.longTasks.push({start: Math.round(e.startTime), dur: Math.round(e.duration)}); }).observe({type: 'longtask', buffered: true}); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration >= 40) P.events.push({name: e.name, dur: Math.round(e.duration), t: Math.round(e.startTime)}); }).observe({type: 'event', durationThreshold: 40, buffered: true}); } catch {}
  try { new PerformanceObserver((l) => { const es = l.getEntries(); if (es.length) P.lcp = Math.round(es[es.length - 1].startTime); }).observe({type: 'largest-contentful-paint', buffered: true}); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) P.cls += e.value; }).observe({type: 'layout-shift', buffered: true}); } catch {}
  P.mark = () => ({lt: P.longTasks.length, ev: P.events.length});
  P.since = (m) => {
    const lts = P.longTasks.slice(m.lt);
    return {
      longTasks: lts.length,
      longTaskTotalMs: lts.reduce((s, t) => s + t.dur, 0),
      longTaskWorstMs: lts.reduce((s, t) => Math.max(s, t.dur), 0),
      slowEvents: P.events.slice(m.ev),
    };
  };
  P.fps = (ms) => new Promise((res) => {
    const deltas = [];
    let last = 0, t0 = 0;
    const tick = (t) => {
      if (last) deltas.push(t - last);
      last = t;
      if (t - t0 < ms) requestAnimationFrame(tick);
      else {
        deltas.sort((a, b) => a - b);
        const avg = deltas.reduce((s, d) => s + d, 0) / (deltas.length || 1);
        res({
          frames: deltas.length,
          avgMs: +avg.toFixed(2),
          fps: Math.round(1000 / (avg || 1)),
          p95Ms: +(deltas[Math.floor(deltas.length * 0.95)] || 0).toFixed(1),
          worstMs: +(deltas[deltas.length - 1] || 0).toFixed(1),
          jank20: deltas.filter((d) => d > 20).length,
          jank34: deltas.filter((d) => d > 34).length,
          jank100: deltas.filter((d) => d > 100).length,
        });
      }
    };
    requestAnimationFrame((t) => { t0 = t; last = t; requestAnimationFrame(tick); });
  });
  P.sweep = (toY, ms) => new Promise((res) => {
    const fromY = window.scrollY;
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      window.scrollTo(0, fromY + (toY - fromY) * t);
      if (t < 1) requestAnimationFrame(step);
      else res('done');
    };
    requestAnimationFrame(step);
  });
  P.nav = () => {
    const n = performance.getEntriesByType('navigation')[0];
    return {
      ttfb: n ? Math.round(n.responseStart) : null,
      domInteractive: n ? Math.round(n.domInteractive) : null,
      fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
      lcp: P.lcp,
      cls: +P.cls.toFixed(4),
    };
  };
  window.__pa = P;
})();`;

/** Measure fps while an in-page action runs; returns fps + longtask delta. */
async function measure(page, label, fn, ms = 3000) {
  const m = await page.evaluate(() => window.__pa.mark());
  const fpsP = page.evaluate((d) => window.__pa.fps(d), ms);
  const t0 = Date.now();
  await fn();
  const actionMs = Date.now() - t0;
  const fps = await fpsP;
  const delta = await page.evaluate((mm) => window.__pa.since(mm), m);
  return {step: label, actionMs, ...fps, ...delta};
}

async function idle(page, ms) {
  await page.evaluate((d) => new Promise((r) => setTimeout(r, d)), ms);
}

/** Click via real input events at the element's center. */
async function click(page, selector, opts = {}) {
  const el = page.locator(selector).first();
  await el.waitFor({state: 'visible', timeout: 8000});
  await el.click({timeout: 8000, ...opts});
}

const scenarios = {
  /** Homepage: splash -> hero scroll choreography -> size toggle. */
  async home(page, report) {
    const t0 = Date.now();
    await page.goto(BASE + '/', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    // Wait for the splash to release (skip button disappears / scroll unlocks)
    await page
      .waitForFunction(() => !document.querySelector('[data-splash], .splash-dim') || document.body.style.overflow !== 'hidden', null, {timeout: 25000})
      .catch(() => {});
    await idle(page, 1200);
    report.loadWallMs = Date.now() - t0;
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    // Load-phase long tasks (model fetch/decode/merge/compile all land here)
    const loadTasks = await page.evaluate(() => window.__pa.since({lt: 0, ev: 0}));
    report.steps.push({step: 'load-phase', ...loadTasks});
    report.steps.push(
      await measure(page, 'scroll-down', () => page.evaluate(() => window.__pa.sweep(document.documentElement.scrollHeight - innerHeight, 4000)), 4200),
    );
    report.steps.push(
      await measure(page, 'scroll-up', () => page.evaluate(() => window.__pa.sweep(0, 4000)), 4200),
    );
    report.steps.push(await measure(page, 'idle-hero', async () => idle(page, 2500), 2500));
    // Size toggle: first (may build model) then back (cached)
    const has3 = await page.locator('button:has-text("3″")').count();
    if (has3) {
      report.steps.push(await measure(page, 'size-toggle-first', () => click(page, 'button:has-text("3″")'), 3500));
      await idle(page, 800);
      report.steps.push(await measure(page, 'size-toggle-back', () => click(page, 'button:has-text("5″")'), 2500));
    }
    // Build-pipeline stage timings (hero:* performance.measure marks)
    report.heroStages = await page.evaluate(() =>
      performance
        .getEntriesByType('measure')
        .filter((m) => m.name.startsWith('hero:'))
        .map((m) => ({name: m.name, ms: Math.round(m.duration)})),
    );
  },

  /** Collections + catalog interactions. */
  async collections(page, report) {
    await page.goto(BASE + '/collections/all', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 800);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    report.steps.push(
      await measure(page, 'scroll-down', () => page.evaluate(() => window.__pa.sweep(document.documentElement.scrollHeight - innerHeight, 3000)), 3200),
    );
    // Category filter chip (client-side filter)
    const chip = page.locator('a[href*="?category="], button[data-category], a[href*="category="]').first();
    if (await chip.count()) {
      report.steps.push(await measure(page, 'filter-click', () => chip.click(), 1500));
    }
    // Hover a product card (spotlight/quick-add reveal)
    const card = page.locator('a.product-card:visible, .product-card-link:visible').first();
    if (await card.count()) {
      report.steps.push(await measure(page, 'card-hover', () => card.hover(), 1200));
    }
  },

  /** PDP: gallery, variant pills, BoardArt layer rail, schematic, frame viewer. */
  async pdp(page, report) {
    await page.goto(BASE + '/products/openfc-lite', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 1200);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    report.steps.push(
      await measure(page, 'scroll-full', () => page.evaluate(() => window.__pa.sweep(document.documentElement.scrollHeight - innerHeight, 6000)), 6200),
    );
    report.steps.push(
      await measure(page, 'scroll-back-top', () => page.evaluate(() => window.__pa.sweep(0, 3000)), 3200),
    );
    // Variant pill click (server navigation)
    const pill = page.locator('[class*="option"] button, form a[href*="?"], button[aria-pressed]').first();
    if (await pill.count()) {
      report.steps.push(await measure(page, 'variant-click', () => pill.click().catch(() => {}), 2500));
    }
    // Gallery next arrow
    const arrow = page.locator('button[aria-label*="ext"], button[aria-label*="next"], button[aria-label*="Next"]').first();
    if (await arrow.count()) {
      report.steps.push(await measure(page, 'gallery-next', () => arrow.click().catch(() => {}), 1500));
    }
    // BoardArt layer rail stepping
    const layerBtn = page.locator('.board-art [class*="rail"] button, [class*="layer"] button').first();
    if (await layerBtn.count()) {
      await layerBtn.scrollIntoViewIfNeeded().catch(() => {});
      await idle(page, 600);
      report.steps.push(await measure(page, 'boardart-layer', () => layerBtn.click().catch(() => {}), 2000));
    }
  },

  /** Cart drawer + cart page. */
  async cart(page, report) {
    await page.goto(BASE + '/cart', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 800);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    report.steps.push(
      await measure(page, 'scroll', () => page.evaluate(() => window.__pa.sweep(Math.min(600, document.documentElement.scrollHeight - innerHeight), 1500)), 1700),
    );
  },

  /** Search: predictive typing latency is the key metric. */
  async search(page, report) {
    await page.goto(BASE + '/search', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 600);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    const input = page.locator('input[type="search"]:visible').first();
    if (await input.count()) {
      // Count network requests fired while typing
      let fetches = 0;
      const onReq = (req) => { if (req.url().includes('predictive') || req.url().includes('/search')) fetches += 1; };
      page.on('request', onReq);
      report.steps.push(
        await measure(page, 'predictive-type', async () => {
          await input.click();
          await input.pressSequentially('openfc lite', {delay: 90});
          await idle(page, 900);
        }, 2400),
      );
      page.off('request', onReq);
      report.steps[report.steps.length - 1].searchFetches = fetches;
    }
  },

  /** Static/content pages incl. theme toggle cost. */
  async content(page, report) {
    await page.goto(BASE + '/blogs/news', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 600);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    const toggle = page.locator('button.theme-toggle:visible').first();
    if (await toggle.count()) {
      report.steps.push(await measure(page, 'theme-toggle', () => toggle.click().catch(() => {}), 1800));
      await idle(page, 400);
      report.steps.push(await measure(page, 'theme-toggle-back', () => toggle.click().catch(() => {}), 1800));
    }
    report.steps.push(
      await measure(page, 'scroll', () => page.evaluate(() => window.__pa.sweep(Math.min(1200, document.documentElement.scrollHeight - innerHeight), 1500)), 1700),
    );
  },

  /** Cart drawer open/close from a product page. */
  async drawer(page, report) {
    await page.goto(BASE + '/products/openesc', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 1000);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    const cartBtn = page.locator('a[href="/cart"]:visible, button[aria-label*="cart" i]:visible').first();
    if (await cartBtn.count()) {
      report.steps.push(await measure(page, 'cart-hover-preview', () => cartBtn.hover(), 1200));
    }
    const themeBtn = page.locator('button.theme-toggle:visible').first();
    if (await themeBtn.count()) {
      report.steps.push(await measure(page, 'theme-toggle', () => themeBtn.click(), 1500));
      await idle(page, 400);
      report.steps.push(await measure(page, 'theme-toggle-back', () => themeBtn.click(), 1500));
    }
  },

  /** Mobile viewport: MobileHome + touch-first surfaces. */
  async mobile(page, report) {
    await page.setViewportSize({width: 390, height: 844});
    try {
      await page.goto(BASE + '/', {waitUntil: 'domcontentloaded'});
      await page.evaluate(HARNESS);
      await idle(page, 2000);
      report.nav = await page.evaluate(() => window.__pa.nav());
      report.steps = [];
      report.steps.push(
        await measure(page, 'scroll-down', () => page.evaluate(() => window.__pa.sweep(document.documentElement.scrollHeight - innerHeight, 4000)), 4200),
      );
      await page.goto(BASE + '/products/openfc-lite', {waitUntil: 'domcontentloaded'});
      await page.evaluate(HARNESS);
      await idle(page, 1200);
      report.steps.push(
        await measure(page, 'pdp-scroll', () => page.evaluate(() => window.__pa.sweep(document.documentElement.scrollHeight - innerHeight, 5000)), 5200),
      );
    } finally {
      await page.setViewportSize({width: 1440, height: 900});
    }
  },

  /** Client-side navigation between routes (SPA transitions). */
  async spanav(page, report) {
    await page.goto(BASE + '/collections/all', {waitUntil: 'domcontentloaded'});
    await page.evaluate(HARNESS);
    await idle(page, 900);
    report.nav = await page.evaluate(() => window.__pa.nav());
    report.steps = [];
    const link = page.locator('a.product-card:visible, .product-card-link:visible').first();
    if (await link.count()) {
      report.steps.push(
        await measure(page, 'spa-to-pdp', async () => {
          await link.click();
          await page.waitForURL('**/products/**', {timeout: 8000}).catch(() => {});
          await idle(page, 1200);
        }, 3200),
      );
    }
  },
};

async function main() {
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--enable-gpu', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const context = await browser.newContext({
    viewport: {width: 1440, height: 900},
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err).slice(0, 300)));

  const cdp = await context.newCDPSession(page);
  if (THROTTLE > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: THROTTLE});
  }

  const gpu = await (async () => {
    await page.goto('about:blank');
    return page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'none';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'masked';
    });
  })();

  const report = {
    base: BASE,
    throttle: THROTTLE,
    gpu,
    startedAt: new Date().toISOString(),
    scenarios: {},
  };

  const names = ONLY.length ? ONLY : Object.keys(scenarios);
  for (const name of names) {
    if (!scenarios[name]) {
      console.error(`unknown scenario: ${name}`);
      continue;
    }
    const sr = {};
    const t0 = Date.now();
    try {
      await scenarios[name](page, sr);
    } catch (err) {
      sr.error = String(err).slice(0, 400);
    }
    sr.wallMs = Date.now() - t0;
    report.scenarios[name] = sr;
    console.error(`— ${name} done in ${sr.wallMs}ms`);
  }

  report.consoleErrors = consoleErrors.slice(0, 30);
  await browser.close();

  const json = JSON.stringify(report, null, 2);
  if (OUT) fs.writeFileSync(OUT, json);
  console.log(json);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
