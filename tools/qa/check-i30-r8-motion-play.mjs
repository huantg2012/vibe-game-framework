/** Real-time, isolated production presentation capture. Synthetic save is disclosed per case. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createJourneyDriver} from './i27-journey-driver.mjs';
import {createChamberDriver,CHAMBER_TEST_POINTS as CHAMBER_QA_POINTS} from './i30-chamber-driver.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=process.env.ARTIFACT_DIR??'docs/qa/artifacts/iteration-30-r8/motion-play';
const url=process.env.I30_URL??'http://127.0.0.1:3025/';fs.mkdirSync(root,{recursive:true});
const sources=['src/art/chamber-device-motion.ts','src/scenes/chamber-device-activity.ts','src/scenes/purification-chamber-visual.ts','src/scenes/purification-chamber-lighting.ts',
 'assets/source/purification-r9/environment.ts','assets/source/purification-r9/interior.ts','assets/source/purification-r9/exterior.ts','assets/source/purification-r9/schema.ts',
 'src/systems/purification-chamber-layout.ts','src/scenes/chamber-exterior-atmosphere.ts','src/art/chamber-authored-architecture.ts'];
const fingerprints=()=>Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const manifest={started:new Date().toISOString(),sources:fingerprints(),cases:[],limitations:['The damaged save is an isolated controlled fixture, not naturally earned damage.','Frame/cache readings corroborate submitted motion and allocation, not artistic approval.','No audio evaluation. Video is muted browser output.']};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const old=JSON.parse(JSON.parse(fs.readFileSync('docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json','utf8'))['coh-save-v1']);
function fixture(){const save=structuredClone(old);save.kindlingReserve=100;save.moduleMaxHpTier=0;save.modules.forEach((mod,i)=>{mod.hp=[24,0,70][i];mod.maxHp=100;});delete save.impactForecast;delete save.checkpointChecksum;return save;}
async function snapshot(page){return page.evaluate(()=>{const s=window.__game.scene.getScene('PurificationScene'),v=s.chamber;return {time:v.time,paused:s.scene.isPaused(),stats:v.activity.getStats(),health:{...v.deviceState},layers:v.activity.layers.map(l=>({id:l.id,frame:l.frame,pulseStart:Number.isFinite(l.pulseStart)?l.pulseStart:null,alpha:l.image.alpha,key:l.texture.key})),emitters:v.lighting.emitters.map(e=>({id:e.id,energy:e.energy})),allActivityTextures:Object.keys(s.textures.list).filter(key=>key.startsWith('chamber-activity-'))};});}
try {for(const name of (process.env.I30_MOTION_CASES??'normal,damaged').split(',')) {
 const out=path.join(root,name);fs.mkdirSync(out,{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:out,size:{width:960,height:640}}});
 if(name==='damaged'){const save=fixture();fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(save,null,2));await context.addInitScript(value=>{if(!localStorage.getItem('coh-save-v1'))localStorage.setItem('coh-save-v1',JSON.stringify(value));},save);}
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
 const d=createJourneyDriver(page,out),chamber=createChamberDriver(page,d);const item={name,errors,samples:[],scope:name==='normal'?'Fresh production entry, real idle and real menu reloads.':'Controlled HP24/0/70 and 100-kindling fixture seeded before boot; actual keyboard repair transaction.'};
 try{
 await page.goto(url);await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1800);
 await d.snap('01-main');const before=await snapshot(page);const start=Date.now();
 while(Date.now()-start<31000){item.samples.push(await snapshot(page));await page.waitForTimeout(220);if(item.samples.length===48||item.samples.length===100)await page.screenshot({path:path.join(out,`idle-${item.samples.length}.png`)});}
 item.idleWallMs=Date.now()-start;const after=await snapshot(page);assert.deepEqual(after.stats,before.stats,'Real idle uses cached atlases');
 item.changedFrames=Object.fromEntries(before.layers.map(layer=>[layer.id,[...new Set(item.samples.map(s=>s.layers.find(l=>l.id===layer.id).frame))]]));
 for(const [id,frames]of Object.entries(item.changedFrames))assert(frames.length>1,`${id} has actual changing frames`);
 await d.snap('02-after-31s');
 if(name==='normal'){
  await d.press('Escape');await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').scene.isPaused());
  const paused=await snapshot(page);await page.waitForTimeout(1100);const pausedAfter=await snapshot(page);assert.deepEqual(pausedAfter,paused,'Pause freezes body and lighting state');item.pause={before:paused,after:pausedAfter};await d.press('Escape');await page.waitForTimeout(400);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);const reduced=await snapshot(page);await page.waitForTimeout(1600);const reducedAfter=await snapshot(page);
  assert.deepEqual(reducedAfter.layers,reduced.layers,'Reduced motion holds all six activity poses');assert.deepEqual(reducedAfter.emitters,reduced.emitters,'Reduced motion holds all idle device lights');item.reduced={before:reduced,after:reducedAfter};await d.snap('03-reduced');await page.emulateMedia({reducedMotion:'no-preference'});
  item.reentries=[];
  for(let n=0;n<3;n++) {await d.press('Escape');await page.locator('.pause-menu-row').filter({hasText:'载入已保存的记录'}).click();await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene'));await page.waitForTimeout(1800);const s=await snapshot(page);assert.equal(s.allActivityTextures.length,6);assert.equal(s.stats.textures,6);item.reentries.push(s);}
  await d.snap('04-third-reentry');
 } else {
  await chamber.walkFeet(...CHAMBER_QA_POINTS.core);await d.press('e');await page.locator('#allocation-panel').waitFor({state:'visible'});await page.waitForTimeout(420);
  await d.snap('03-repair-ready');const storedBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));
  await d.press('ArrowRight');await d.press('Enter',20);item.repair=[];
  const onset=Date.now();while(Date.now()-onset<2100){item.repair.push(await snapshot(page));await page.waitForTimeout(65);}
  const storedAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));assert.equal(storedAfter.modules.find(m=>m.id==='CORE').hp,28);assert.equal(storedAfter.kindlingReserve,99);
  item.repairTransaction={beforeHp:storedBefore.modules.find(m=>m.id==='CORE').hp,afterHp:28,cost:1,beforeReserve:storedBefore.kindlingReserve,afterReserve:99};
  const repairFrames=item.repair.map(s=>s.layers.find(l=>l.id==='core').frame);assert(repairFrames.some(f=>f>=16&&f<20),'Actual repair closes inlet');assert(repairFrames.some(f=>f>=20&&f<26),'Actual repair gathers');assert(repairFrames.some(f=>f>=26&&f<32),'Actual repair settles');assert(repairFrames.at(-1)<16,'Actual repair finishes');await d.snap('04-repaired');
 }
 assert.deepEqual(errors,[]);item.ok=true;
 }catch(error){item.ok=false;item.error=String(error);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}finally{
  manifest.cases.push(item);fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(item,null,2));const video=page.video();await context.close();if(video){await video.saveAs(path.join(out,`${name}.webm`));fs.unlinkSync(await video.path());item.video=`${name}/${name}.webm`;}
 }
 }}finally{manifest.finalSources=fingerprints();fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));await browser.close();}
console.log(`Chamber live motion capture completed: ${root}`);
