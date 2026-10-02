/** Isolated opening -> native haven verification. Never opens the user's browser
 * profile. The baseline swaps only the asset HTTP responses in a second page;
 * both pages use this same entry, browser context, camera and renderer.
 *
 * OPENING_JOINT_URL, OPENING_JOINT_OUT, PLAYWRIGHT_MODULE and
 * CHROMIUM_EXECUTABLE_PATH may be overridden. --capture-only refreshes the three
 * review frames and timing after an asset-only change, not the full UI suite.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
const playwrightModule = process.env.PLAYWRIGHT_MODULE
  ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href;
const { chromium } = await import(playwrightModule).catch(error => {
  throw new Error('Playwright runtime unavailable. Set PLAYWRIGHT_MODULE to an installed Playwright entry point.', { cause: error });
});
const url = process.env.OPENING_JOINT_URL ?? 'http://127.0.0.1:3027/docs/art/demos/opening-joint/index.html';
const origin = new URL(url).origin;
const out = process.env.OPENING_JOINT_OUT ?? 'docs/qa/artifacts/opening-joint';
const captureOnly = process.argv.includes('--capture-only');
const sources = ['docs/art/demos/opening-joint/entry.ts', 'docs/art/demos/opening-joint/title-motion.ts',
 'src/scenes/last-light-visual.ts', 'src/art/last-light-renderer.ts', 'docs/art/demos/opening-joint/assets/title/master.png',
 'docs/art/demos/opening-joint/assets/title/candidates/f.png',
 'docs/art/demos/opening-joint/assets/haven/manifest.json', 'public/assets/last-light/manifest.json'];
const fingerprint = () => Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const started = new Date().toISOString();
const sourceFingerprints = fingerprint();
const revision = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1100,height:800}});
const errors=[], failed=[], checks=[], states=[];let frameSample=null, baselineSample=null;
await mkdir(out,{recursive:true});
await context.route('**/__storage-probe',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));
const probe=await context.newPage(); await probe.goto(origin + '/__storage-probe');
await probe.evaluate(()=>localStorage.setItem('coh-save-v1','protected-original-record'));
const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
const state=async()=>page.evaluate(()=>window.__jointRead());
const wait=ms=>page.waitForTimeout(ms);
const gameKey=async key=>{await page.keyboard.down(key);await wait(90);await page.keyboard.up(key);};
async function timingSample(target) {
 await target.waitForTimeout(500);
 return target.evaluate(async()=>{
   const {audioManager}=await import('/src/managers/audio-manager.ts');
   const scene=audioManager.game.scene.getScene('PurificationScene');
   const renderer=scene.chamber.renderer;
   const original=renderer.draw;
   const submissions=[];
   renderer.draw=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{submissions.push(performance.now()-start);}};
   const intervals=[];
   const started=performance.now();let last;
   try {
     await new Promise(resolve=>{
       function tick(now){if(last!==undefined)intervals.push(now-last);last=now;
         if(now-started<5000)requestAnimationFrame(tick);else resolve();}
       requestAnimationFrame(tick);
     });
   } finally {renderer.draw=original;}
   const describe=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,
     meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...values)};};
   return {durationMs:performance.now()-started,interval:describe(intervals),cpuDrawSubmission:describe(submissions),
     renderer:scene.game.canvas.dataset.lastLightRenderer,worldPlayer:scene.probeJourneyState().worldPlayer,
     camera:scene.probeJourneyState().camera,viewport:[innerWidth,innerHeight],
     note:'CPU method duration excludes asynchronous GPU completion. RAF intervals include the browser and test host.'};
 });
}
try {
 await page.goto(url);
 await page.locator('.joint-action:enabled').waitFor({timeout:60000});
 await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');window.__jointRead=()=>audioManager.game.scene.getScene('PurificationScene').probeJourneyState();});
 await wait(400); await page.screenshot({path:path.join(out, 'title.png')});
 if (!captureOnly) {
 const m0=await page.locator('.joint-title-motion').getAttribute('data-motion-time');await wait(400);
 assert.notEqual(await page.locator('.joint-title-motion').getAttribute('data-motion-time'),m0);checks.push('title clock advances');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const m1=await page.locator('.joint-title-motion').getAttribute('data-motion-time');await wait(300);
 assert.equal(await page.locator('.joint-title-motion').getAttribute('data-motion-time'),m1);await page.keyboard.press('x');checks.push('title clock freezes on blur');
 await page.emulateMedia({reducedMotion:'reduce'});const m2=await page.locator('.joint-title-motion').getAttribute('data-motion-time');await wait(300);
 assert.equal(await page.locator('.joint-title-motion').getAttribute('data-motion-time'),m2);checks.push('reduced-motion freezes title');
 await page.emulateMedia({reducedMotion:'no-preference'});
 }
 await page.keyboard.press('Enter'); await page.waitForFunction(()=>document.body.dataset.openingPhase==='playing',null,{timeout:30000});
 assert.equal(await page.locator('#game-container > canvas').getAttribute('data-last-light-asset-root'),'/docs/art/demos/opening-joint/assets/haven/');
 assert.equal(await page.locator('#game-container > canvas').getAttribute('data-last-light-renderer'),'webgl2');
 const initial=await state();states.push({at:'spawn',...initial});
 frameSample=await timingSample(page);
 assert(frameSample.cpuDrawSubmission.count>20,'The actual renderer must draw during the sample');
 checks.push('limited 5-second stationary frame sample (not a performance acceptance)');
 await page.keyboard.down('d');await wait(300);await page.keyboard.up('d');
 const moved=await state();states.push({at:'after-right-300ms',...moved});
 assert(Math.hypot(moved.player.x-initial.player.x,moved.player.y-initial.player.y)>1);checks.push('keyboard movement changes actual coordinates');
 // Follow the visible screen-space vector to the native rest approach, with
 // ordinary WASD presses only. Diagnostics are read-only; no teleport or state edit.
 for(let i=0;i<32;i++){
   const s=await state(); if(s.nearTarget==='rest')break;
   const dx=s.rest.x-s.player.x,dy=s.rest.y-s.player.y;
   const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
   if(!keys.length)break;
   for(const k of keys)await page.keyboard.down(k);await wait(125);for(const k of keys)await page.keyboard.up(k);await wait(35);
 }
 const beforeRest=await state();states.push({at:'rest-approach',...beforeRest});
 assert.equal(beforeRest.nearTarget,'rest');await gameKey('e');await wait(850);
 const seated=await state();states.push({at:'seated',...seated});assert.equal(seated.resting,true);
 assert(await page.locator('#purification-rest-line').evaluate(async el => { const { ATMOSPHERE_LINES } = await import('/src/generated/atmosphere-copy-data.ts'); return ATMOSPHERE_LINES['haven.rest'].some(row => row.text === el.textContent); }));
 await page.screenshot({path:path.join(out, 'seated.png')});
 await gameKey('e');await wait(500);assert.equal((await state()).resting,false);checks.push('native E sit and stand, atmospheric line and modest zoom');
 if (!captureOnly) {
 await gameKey('Tab');await wait(200);assert.equal((await state()).panels.status,true);
 await gameKey('Escape');await wait(200);assert.equal((await state()).panels.status,false);checks.push('Tab opens actual report and Escape closes');
 }
 await page.screenshot({path:path.join(out, 'haven.png')});
 if (!captureOnly) {
 const saved=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));assert(saved&&saved!=='protected-original-record');
 await page.locator('#compare-frames').click();await page.waitForFunction(()=>document.body.dataset.comparisonFrame==='title');
 await page.keyboard.press('Digit2');assert((await page.locator('.joint-compare-image').getAttribute('src')).startsWith('data:image/png'));await page.keyboard.press('Escape');checks.push('live-render snapshot comparison');
 await page.locator('#return-title').click();await page.locator('.joint-action:enabled').first().waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),saved);
 assert.deepEqual(await page.locator('.joint-action').allTextContents(),['继续','重新开始']);
 await page.locator('#compare-frames').click();const cm=await page.locator('.joint-title-motion').getAttribute('data-motion-time');await wait(300);assert.equal(await page.locator('.joint-title-motion').getAttribute('data-motion-time'),cm);await page.keyboard.press('Escape');checks.push('comparison pauses title clock');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.deepEqual(await page.locator('.joint-action').allTextContents(),['保留记录，返回','确认重新开始']);await page.keyboard.press('Escape');checks.push('overwrite safe default and cancel');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.dataset.openingPhase==='playing');checks.push('actual continue after return');
 for(let i=0;i<80;i++){
  const s=await state();if(s.nearTarget==='purifier')break;
  const dx=s.devices.purifier.x-s.player.x,dy=s.devices.purifier.y-s.player.y;
  const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
  if(!keys.length)break;
  for(const k of keys)await page.keyboard.down(k);await wait(120);for(const k of keys)await page.keyboard.up(k);await wait(35);
 }
 const purifierApproach=await state();states.push({at:'purifier-approach',...purifierApproach});assert.equal(purifierApproach.nearTarget,'purifier');
 await gameKey('e');await wait(450);assert.equal((await state()).panels.allocation,true);
 await page.screenshot({path:path.join(out, 'purifier.png')});
 await gameKey('Escape');await wait(250);assert.equal((await state()).panels.allocation,false);checks.push('native purifier E allocation panel and Escape; no transaction made');
 await page.screenshot({path:path.join(out, 'haven-purifier.png')});
 }
 assert.equal(await probe.evaluate(()=>localStorage.getItem('coh-save-v1')),'protected-original-record');checks.push('production storage untouched');
 await page.close();
 // Same browser/context and entry; only the complete scene pack is replaced by
 // the existing production pack. No edits to the production files or registry.
 const baseline=await context.newPage();
 baseline.on('pageerror', e=>errors.push(`baseline: ${e}`));
 await baseline.route('**/docs/art/demos/opening-joint/assets/haven/*', async route=>{
   const requested=new URL(route.request().url());
   const response=await route.fetch({url:origin+'/assets/last-light/'+requested.pathname.split('/').at(-1)});
   await route.fulfill({response});
 });
 await baseline.goto(url);
 await baseline.locator('.joint-action:enabled').waitFor({timeout:60000});
 await baseline.keyboard.press('Enter');
 await baseline.waitForFunction(()=>document.body.dataset.openingPhase==='playing',null,{timeout:30000});
 baselineSample=await timingSample(baseline);
 assert(baselineSample.cpuDrawSubmission.count>20,'Baseline must actually render');
 assert.equal(baselineSample.renderer,'webgl2');
 await baseline.close();
 checks.push('same-context original-pack baseline, same entry and camera');
 assert.deepEqual(fingerprint(),sourceFingerprints,'Sources changed during verification; refresh evidence after the export ends.');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={ok:true,started,revision,url,captureOnly,sourceFingerprints,
   scope:'Actual joint master and complete joint haven pack; real native input and read-only diagnostics. Temporary renderer.draw wrapper measures CPU submission only.',
   limitations:['Five-second headless local samples are diagnostics, not sustained performance acceptance or a GPU timing benchmark.',
     'Art quality and continuity remain pending human review. No natural Rift sortie/recovery or browser matrix certification.'],
   checks,states,frameSample,baselineSample,errors,failed};
 console.log(JSON.stringify(report));
 await writeFile(path.join(out,captureOnly?'capture-result.json':'result.json'),JSON.stringify(report,null,2));
} catch(e){if(!page.isClosed())await page.screenshot({path:path.join(out, 'failure.png')});console.error(JSON.stringify({errors,failed,states,checks}));throw e;}finally{await browser.close();}
