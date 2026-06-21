import {chromium, devices} from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],colorScheme:'dark'});const p=await ctx.newPage();
await p.goto('http://localhost:3001/products/openfc-lite',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2200);
// prime lazy board
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);});
await p.waitForTimeout(800);
const targets=[0.12,0.45,0.6,0.85];
for(const t of targets){
  await p.evaluate((prog)=>{
    const el=document.querySelector('.chapter:has(.board-art)');
    const vh=window.innerHeight; const range=vh*1.15; const STICKY=78;
    // want (STICKY - top)/range = prog  => top = STICKY - prog*range
    const wantTop = STICKY - prog*range;
    const cur = el.getBoundingClientRect().top;
    window.scrollBy(0, cur - wantTop);
  }, t);
  await p.waitForTimeout(700);
  const info=await p.evaluate(()=>{
    const railHidden=getComputedStyle(document.querySelector('.board-folder-rail')).display==='none';
    const hdrOpacity=getComputedStyle(document.querySelector('.site-header')).opacity;
    const svg=document.querySelector('.board-art .board-sheet.is-active svg');
    const shapes=svg?svg.querySelectorAll('.board-highlight-shape').length:0;
    const slug=document.querySelector('.board-art .board-folder-tabs button.is-active')?.getAttribute('data-slug');
    return {activeSlug:slug, railHidden, hdrOpacity, shapeCount:shapes};
  });
  console.log(JSON.stringify({progress:t, ...info}));
  await p.screenshot({path:`.mobile-audit/shots/choreo-${String(t).replace('.','_')}.png`, fullPage:false});
}
await b.close();
