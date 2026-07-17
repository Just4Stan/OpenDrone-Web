import {chromium} from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2})).newPage();
await p.goto('http://localhost:3001/', {waitUntil: 'domcontentloaded'});
await p.waitForTimeout(9000);
const dir = '/private/tmp/claude-501/-Users-stan-OpenDrone-Web/478ae943-acec-4c5e-95b0-477deb3b5ea5/scratchpad';
await p.screenshot({path: dir + '/hero-top.png'});
// mid-scroll: second card reveal zone
await p.evaluate(() => window.scrollTo(0, innerHeight * 0.5));
await p.waitForTimeout(1200);
await p.screenshot({path: dir + '/hero-mid.png'});
await p.evaluate(() => window.scrollTo(0, innerHeight * 0.95));
await p.waitForTimeout(1200);
await p.screenshot({path: dir + '/hero-end.png'});
await b.close();
console.error('shots done');
