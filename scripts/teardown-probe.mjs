// Touch-emulation probe for the teardown component highlight.
//   node scripts/teardown-probe.mjs <route> [scheme] [device]
// Emulates a real phone (mobile UA, hasTouch, DPR), scrolls to the teardown,
// TAPS the first part row, then reports a screenshot + DOM diagnostics on the
// injected highlight group. This is the touch code path resized-Chrome can't hit.
import {chromium, devices} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3001';
const [route = '/products/openfc-lite', scheme = 'dark', devName = 'iPhone 13'] =
  process.argv.slice(2);
const OUT = path.resolve('.mobile-audit/shots');
await mkdir(OUT, {recursive: true});

const b = await chromium.launch();
const ctx = await b.newContext({...devices[devName], colorScheme: scheme});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 160)));
await p.goto(BASE + route, {waitUntil: 'domcontentloaded', timeout: 30000});
await p.waitForTimeout(2000);

// Step down to trigger lazy board render, then settle at the teardown.
await p.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 80));
  }
  window.scrollTo(0, 0);
});
await p.waitForTimeout(800);

const pin = await p.$('.teardown-pin-hoverable');
if (!pin) {
  console.log('NO teardown pin found');
  await b.close();
  process.exit(1);
}
// Bring the teardown into view, then position so the part row sits in the lower
// clear band (below the sticky board, below the fixed header) before tapping.
await pin.scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
const box = await pin.boundingBox();
const want = p.viewportSize().height - 55;
if (box) await p.evaluate((dy) => window.scrollBy(0, dy), Math.round(box.y - want));
await p.waitForTimeout(500);
const box2 = await pin.boundingBox();
if (box2) await p.touchscreen.tap(box2.x + box2.width / 2, box2.y + box2.height / 2);
await p.waitForTimeout(900);

const diag = await p.evaluate(() => {
  const active = document.querySelector('.board-art .board-sheet.is-active');
  const svg = active?.querySelector('svg');
  const hilite = svg?.querySelector('g.board-hilite');
  const shapes = svg?.querySelectorAll('.board-highlight-shape') ?? [];
  const cs = hilite ? getComputedStyle(hilite) : null;
  const activePin = document.querySelector('.teardown-pin-hoverable.is-active');
  const boardRect = document.querySelector('.board-art')?.getBoundingClientRect();
  const pinRect = activePin?.getBoundingClientRect();
  return {
    activeSlug: active?.querySelector('[data-slug]')?.getAttribute('data-slug') ||
      document.querySelector('.board-folder-tabs button.is-active')?.getAttribute('data-slug') || null,
    hasHiliteGroup: !!hilite,
    hiliteClass: hilite?.getAttribute('class') || null,
    hiliteOpacity: cs?.opacity ?? null,
    hiliteDisplay: cs?.display ?? null,
    shapeCount: shapes.length,
    pinIsActive: !!activePin,
    // Are board and the active pin both within the viewport at once?
    viewportH: window.innerHeight,
    boardTop: boardRect ? Math.round(boardRect.top) : null,
    boardBottom: boardRect ? Math.round(boardRect.bottom) : null,
    pinTop: pinRect ? Math.round(pinRect.top) : null,
  };
});

const file = path.join(OUT, `teardown-tap-${scheme}.png`);
await p.screenshot({path: file, fullPage: false});
console.log(JSON.stringify(diag, null, 2));
console.log(`wrote ${file}${errs.length ? '  ERRORS: ' + errs.slice(0, 4).join(' | ') : '  (no errors)'}`);
await b.close();
