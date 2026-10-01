/** Fresh-context real keys through production scenes. No player teleports or
 * business mutations; steering reads projection/route for repeatable waypoints. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const out='docs/qa/artifacts/haven-exterior-2026-10-02',url='http://127.0.0.1:3027/';
await mkdir(out,{recursive:true});
const packHash=createHash('sha256').update(await readFile('public/assets/last-light/checksums.json')).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1200,height:850}}),page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)requests.push([r.status(),r.url()]);});
const samples=[];let held=[];
async function snapshot(name){await page.screenshot({path:`${out}/${name}.png`});}
async function state(){return page.evaluate(async()=>{
 const {audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('PurificationScene');
 const {getLastLightExteriorOffsets,getLastLightExteriorObserver}=await import('/src/art/last-light-exterior.ts');
 const r=s.chamber.renderer,probe=s.probeJourneyState(),time=s.chamber.renderState.exteriorSeconds;
 return {...probe,time,observer:[...r.observer],target:getLastLightExteriorObserver(s.chamber.renderState.world,r.pack.camera),offset:getLastLightExteriorOffsets(r.observer)};
});}
async function keys(next){for(const k of held)if(!next.includes(k))await page.keyboard.up(k);for(const k of next)if(!held.includes(k))await page.keyboard.down(k);held=next;}
async function walk(x,z){
 const started=Date.now();let steps=0;
 while(Date.now()-started<14000){
  const steer=await page.evaluate(async({x,z})=>{
   const {audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('PurificationScene');const p=s.locomotion.getWorldPosition();
   const {projectLastLight,sampleLastLightSurface}=await import('/src/systems/last-light-layout.ts');
   const surface=sampleLastLightSurface(s.locomotion.getRoute(),p.x,p.z);const dx=x-p.x,dz=z-p.z;
   const a=projectLastLight(p),b=projectLastLight({x,y:p.y+dx*(surface?.dx??0)+dz*(surface?.dz??0),z});
   return {distance:Math.hypot(dx,dz),sector:(Math.round(Math.atan2(b.y-a.y,b.x-a.x)/(Math.PI/4))+8)%8};
  },{x,z});
  if(steer.distance<.13){await keys([]);samples.push(await state());return;}
  await keys([['d'],['d','s'],['s'],['s','a'],['a'],['a','w'],['w'],['w','d']][steer.sector]);
  await page.waitForTimeout(50);if(++steps%8===0)samples.push(await state());
 }
 await keys([]);throw new Error(`Could not reach ${x},${z}: ${JSON.stringify(await state())}`);
}
try{
 await page.goto(url);await page.getByRole('button',{name:'开始',exact:true}).click({timeout:60000});
 await page.locator('#purif-hud').waitFor({timeout:30000});await page.locator('#menu-entry-transition').waitFor({state:'detached',timeout:30000});
 const initial=await state();await snapshot('01-entry');assert.equal(initial.nearTarget,'rest');
 await page.evaluate(()=>{
  const stream=document.querySelector('#game-container > canvas').captureStream(20),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start();window.__havenQARecording={recorder,chunks,stream};
 });
 await page.keyboard.press('e',{delay:90});await page.locator('#purification-rest-line').waitFor();await page.waitForTimeout(850);
 const sitting=await state();assert(sitting.resting);assert(Math.abs(sitting.camera.zoom/initial.camera.zoom-1.18)<.001);await snapshot('02-seated');
 await page.waitForTimeout(4000);await page.keyboard.press('Escape',{delay:90});await page.waitForTimeout(850);assert.equal((await state()).resting,false);
 await walk(3.0,2.0);await walk(2.05,.3);await walk(2,-.5);await walk(2.75,-2.25);await snapshot('03-ramp');
 await walk(3.76,-4.6);await walk(4.4,-4.2);await walk(6,-3.33);assert.equal((await state()).route,'upper');await snapshot('04-upper');
 await walk(7.6,-3.8);await walk(9.02,-3.55);assert.equal((await state()).nearTarget,'storage');
 await page.keyboard.press('e',{delay:90});await page.waitForTimeout(800);const focus=await state();assert(Math.abs(focus.camera.zoom-2.2)<.001);await snapshot('05-storage-focus');
 await page.keyboard.press('Escape',{delay:90});await page.waitForTimeout(800);assert(Math.abs((await state()).camera.zoom-initial.camera.zoom)<.001);
 await walk(7.6,-3.8);await walk(6,-3.33);await walk(4.4,-4.2);await walk(3.76,-4.6);await walk(2.75,-2.25);await walk(2,-.5);await walk(2.05,.3);await snapshot('06-return');
 // Quick reversal uses native keydown/up, then the observer settles to the
 // physical foot point. One slope climb has already exercised height changes.
 await keys(['a']);await page.waitForTimeout(220);await keys(['d']);await page.waitForTimeout(220);await keys([]);await page.waitForTimeout(850);
 const settled=await state();assert(Math.hypot(settled.observer[0]-settled.target[0],settled.observer[1]-settled.target[1])<.1);
 for(const s of samples){assert(Math.hypot(...s.offset.far)<=6.0001);assert(Math.hypot(...s.offset.middle)<=3.5001);assert.deepEqual(s.offset.near,[0,0]);}
 await page.waitForTimeout(5000);await snapshot('07-settled');
 const video=await page.evaluate(async()=>{
  const {recorder,chunks,stream}=window.__havenQARecording;await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(t=>t.stop());
  return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
 });
 await writeFile(`${out}/walk-rest-focus.webm`,Buffer.from(video.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 assert.equal(packHash,createHash('sha256').update(await readFile('public/assets/last-light/checksums.json')).digest('hex'),'Pack changed while testing');
 const report={status:'PASS',at:new Date().toISOString(),url,packHash,initial,sitting,focus,settled,samples,errors,requests,
  scope:'Fresh storage/context; real E/Esc and WASD round trip through west ramp, rest and storage focus. Read-only waypoint steering, no teleport or seek. Canvas video is naturally advancing game time; DOM text is in screenshots. Not a long-session/GPU performance benchmark.'};
 await writeFile(`${out}/result.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,samples:samples.length,output:out}));
}catch(e){await snapshot('failure');await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),state:await state(),errors,requests},null,2));throw e;}
finally{await keys([]);await context.close();await browser.close();}
