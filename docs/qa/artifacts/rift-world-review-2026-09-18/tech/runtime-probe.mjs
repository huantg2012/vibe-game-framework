import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
const path = new URL('runtime-probe.json', import.meta.url);
const result = { reviewer:'root, informed D-stage audit', measuredAt:new Date().toISOString(), purpose:'Exploratory current-device cost measurement; no product performance budget supplied and no pass/fail claim.', environment:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,memoryGiB:os.totalmem()/1024**3,viewport:'1600x1040 DPR1',browser:'headless local Chrome, Vite development server'}, errors:[], regenerations:[] };
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1040},deviceScaleFactor:1});
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.addInitScript(()=>{
    window.__review={active:false,last:0,frames:[],tasks:[]};
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.__review.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
    function loop(t){const s=window.__review;if(s.active && s.last)s.frames.push(t-s.last);s.last=s.active?t:0;requestAnimationFrame(loop);}requestAnimationFrame(loop);
  });
  const started=performance.now();
  await page.goto('http://127.0.0.1:3011/rift-worlds.html?world=crystal-fibre&space=fracture-fields&seed=175150&view=walk&field=1');
  await page.waitForFunction(()=>window.__worldStudy?.getState().ready);
  result.initialNavigationToReadyMs=performance.now()-started;
  result.initial=await page.evaluate(()=>({state:window.__worldStudy.getState(),tasks:window.__review.tasks.slice(),userAgent:navigator.userAgent}));
  await page.waitForTimeout(300);
  await page.evaluate(()=>{window.__review.frames=[];window.__review.active=true;});
  for(const key of ['d','w','a','s']){await page.keyboard.down(key);await page.waitForTimeout(1500);await page.keyboard.up(key);}
  result.movement=await page.evaluate(()=>{window.__review.active=false;const frames=window.__review.frames.slice().sort((a,b)=>a-b);return {durationApproxSeconds:6,frames:frames.length,medianMs:frames[Math.floor(frames.length*.5)],p95Ms:frames[Math.floor(frames.length*.95)],maxMs:frames.at(-1),over33_4ms:frames.filter(v=>v>33.4).length,state:window.__worldStudy.getState()};});
  for(const world of ['ash-strata','ivory-basin','crystal-fibre']) {
    const sample=await page.evaluate(async world=>{const start=performance.now();await window.__worldStudy.regenerate(world,'channels',175150,'fracture-fields');const end=performance.now();await new Promise(r=>requestAnimationFrame(()=>r()));await new Promise(r=>setTimeout(r,50));return {world,seed:175150,space:'fracture-fields',regenerateCallToReturnMs:end-start,longTasks:window.__review.tasks.filter(t=>t.start>=start && t.start<=end),state:window.__worldStudy.getState()};},world);
    result.regenerations.push(sample);
  }
} finally {
  await browser.close();result.closedAt=new Date().toISOString();writeFileSync(path,JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify(result));
