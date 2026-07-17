import {chromium} from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const logs = [];
p.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0,200)}`));
p.on('pageerror', e => logs.push('[pageerror] ' + String(e).slice(0,300)));
await p.goto('http://localhost:3001/', {waitUntil: 'domcontentloaded'});
await p.waitForTimeout(9000);
const info = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  return {canvas: !!c, w: c?.width, h: c?.height,
    measures: performance.getEntriesByType('measure').filter(m=>m.name.startsWith('hero:')).map(m=>m.name+'='+Math.round(m.duration))};
});
console.error(JSON.stringify(info, null, 1));
console.error(logs.filter(l=>/error|warn|fail|hero|three|webgl/i.test(l)).slice(0,20).join('\n'));
await b.close();
