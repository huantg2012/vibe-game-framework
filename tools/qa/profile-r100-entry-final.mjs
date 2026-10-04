/** Read-only CPU/timeline attribution. One fixed world selected before real departure.
 * No runtime, inventory, position, outcome, clock, or presentation overrides. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const url = process.env.GAME_URL ?? 'http://127.0.0.1:3065/';
const world = process.env.QA_WORLD ?? 'fibre-silt';
const grade = process.env.QA_GRADE ?? 'severe';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i06/entry-profile-final/aligned');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({viewport:{width:1440,height:960}});
const page = await context.newPage();
const result = {world,grade,method:'Controlled world through one seed draw before departure; actual menu, grade, departure and cold resume. CPU timestamp aligned to page clock using CDP Timestamp bracket. No gameplay mutation.',errors:[],phases:[],status:'running'};
page.on('pageerror',e=>result.errors.push(String(e)));
await page.addInitScript(()=>{window.__qaLongTasks=[];new PerformanceObserver(list=>{for(const r of list.getEntries())window.__qaLongTasks.push({start:r.startTime,duration:r.duration})}).observe({entryTypes:['longtask']});});
async function profile(name,action){
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');
 const before=await page.evaluate(()=>performance.now());
 const metrics=await cdp.send('Performance.getMetrics');
 const after=await page.evaluate(()=>performance.now());
 const timestampMs=metrics.metrics.find(m=>m.name==='Timestamp').value*1000;
 const alignment={timestampMs,pageBeforeMs:before,pageAfterMs:after,offsetMs:timestampMs-(before+after)/2,errorBoundMs:(after-before)/2};
 const start=await page.evaluate(()=>performance.now());await cdp.send('Profiler.start');
 await action();
 const p=(await cdp.send('Profiler.stop')).profile;
 fs.writeFileSync(path.join(out,`${name}.cpuprofile`),JSON.stringify(p));
 const phase={name,alignment,start,longTasks:await page.evaluate(start=>window.__qaLongTasks.filter(r=>r.start>=start),start)};
 result.phases.push(phase);await cdp.detach();
}
try{
 await page.goto(url);await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await page.waitForTimeout(350);await page.keyboard.press('Enter',{delay:100});await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(2200);
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());
 const choice=page.locator(`[data-departure-grade="${grade}"]`);await choice.waitFor();await choice.click();
 result.seed=await page.evaluate(async({world,grade})=>{
  const {selectR100ProductionRecipe}=await import('/src/generation/world-study/r100-package.ts');let seed=0;
  while(seed<20000&&selectR100ProductionRecipe(seed,grade).package.id!==`r100-${world}`)seed++;
  if(seed===20000)throw Error('world disabled');
  const original=crypto.getRandomValues;crypto.getRandomValues=function(v){if(v instanceof Uint32Array&&v.length===1){crypto.getRandomValues=original;v[0]=seed;return v;}return original.call(this,v)};return seed;
 },{world,grade});
 await profile('entry',async()=>{
  await page.keyboard.press('Shift+Enter',{delay:100});await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&s.player&&s.nativeWorldPresentation&&s.devRuntime},null,{timeout:30000});await page.waitForTimeout(500);
 });
 await page.keyboard.press('Escape',{delay:100});await page.waitForTimeout(150);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));result.identity=before.riftCheckpoint.identity;
 await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await page.waitForTimeout(350);
 await profile('restore',async()=>{
  await page.keyboard.press('Enter',{delay:100});await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&s.nativeWorldPresentation&&s.devRuntime},null,{timeout:30000});await page.waitForTimeout(250);
 });
 await page.keyboard.press('Escape',{delay:100});await page.waitForTimeout(150);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));
 assert.deepEqual(after.riftCheckpoint.identity,before.riftCheckpoint.identity);
 assert.deepEqual(after.riftCheckpoint.state.player.position,before.riftCheckpoint.state.player.position);
 assert.deepEqual(result.errors,[]);
 result.status='passed';
 for(const f of ['src/managers/rift-recovery.ts','src/systems/r100-world-presentation.ts','src/scenes/rift-scene.ts']){
  const response=await fetch(new URL(f,url));assert(response.ok);result.sourceHashes??={};result.sourceHashes[f]=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
 }
}catch(error){result.status='failed';result.error=String(error);process.exitCode=1;}finally{
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));await browser.close();
}
console.log(JSON.stringify({status:result.status,phases:result.phases},null,2));
