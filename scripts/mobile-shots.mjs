// Mobile rendering audit harness.
// Loads each route under real device emulation (viewport + DPR + UA + touch)
// and captures full-page screenshots, horizontal-overflow offenders, and console errors.
//
// Usage:
//   node scripts/mobile-shots.mjs                 # all routes, iphone + pixel
//   node scripts/mobile-shots.mjs home products   # only matching route names
//   BASE=http://localhost:3001 node scripts/mobile-shots.mjs
import {chromium, devices} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3001';
const OUT = path.resolve('.mobile-audit');

const DEVICES = [
  ['iphone13', devices['iPhone 13']],
  ['pixel7', devices['Pixel 7']],
];

const ROUTES = [
  ['home', '/'],
  ['collections', '/collections'],
  ['catalog', '/collections/all'],
  ['product-openframe', '/products/openframe'], // FrameViewer (touch drag)
  ['product-openfc', '/products/openfc'], // BoardArt + FirmwareSplit
  ['product-battery-strap', '/products/battery-strap'], // simple product
  ['cart', '/cart'],
  ['search', '/search?q=esc'],
  ['support', '/support'],
  ['contact', '/contact'],
  ['newsletter', '/newsletter'],
  ['legal', '/legal'],
  ['open-source', '/open-source'],
  ['firmware-partners', '/firmware-partners'],
];

// In-page: find elements that overflow the viewport horizontally.
const OVERFLOW_PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const docW = document.documentElement.scrollWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString && el.className.toString().slice(0, 60)) || '',
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  }
  // Keep widest offenders, de-dupe by class+tag.
  const seen = new Set();
  const top = offenders
    .sort((a, b) => b.right - a.right)
    .filter((o) => { const k = o.tag + o.cls; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 12);
  return {vw, docW, horizontalScroll: docW > vw + 1, offenders: top};
})()`;

const filter = process.argv.slice(2);
const routes = filter.length
  ? ROUTES.filter(([name]) => filter.some((f) => name.includes(f)))
  : ROUTES;

const report = {};

const browser = await chromium.launch();
for (const [devName, devCfg] of DEVICES) {
  await mkdir(path.join(OUT, devName), {recursive: true});
  const ctx = await browser.newContext({...devCfg});
  for (const [name, route] of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
    const key = `${devName}/${name}`;
    try {
      await page.goto(BASE + route, {waitUntil: 'domcontentloaded', timeout: 30000});
      await page.waitForTimeout(2500); // settle: fonts, hydration, intersection observers
      const probe = await page.evaluate(OVERFLOW_PROBE);
      await page.screenshot({path: path.join(OUT, devName, name + '.png'), fullPage: true});
      report[key] = {route, ...probe, errors};
      const flag = probe.horizontalScroll ? `OVERFLOW docW=${probe.docW} vw=${probe.vw}` : 'ok';
      console.log(`${key.padEnd(34)} ${flag}  errs=${errors.length}`);
    } catch (e) {
      report[key] = {route, error: String(e).slice(0, 200)};
      console.log(`${key.padEnd(34)} FAILED ${String(e).slice(0, 120)}`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('\nWrote screenshots + report.json to', OUT);
