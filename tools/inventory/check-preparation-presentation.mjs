/** Production presentation over an isolated real-scene fixture; no player saves. */
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.QA_OUTPUT??`docs/qa/artifacts/preparation-integration-2026-10-10/presentation-${Date.now()}`;assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:960,height:688},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const consoleMessages=[];page.on('console',m=>consoleMessages.push({type:m.type(),text:m.text()}));
const report={errors,consoleMessages,frames:[],checks:[],lifecycle:{normal:[],dense:[]}};
// Retain every GL reference deliberately: removing a canvas or waiting for GC
// must not be mistaken for deterministic release of the browser context quota.
await page.addInitScript(()=>{
 const records=[];window.__preparationGlAudit=records;
 const original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args){
  const gl=original.call(this,type,...args);
  if(gl&&/^(webgl2?|experimental-webgl)$/.test(type)&&!records.some(r=>r.gl===gl)){
   const record={gl,canvas:this,type,draws:0,lostEvents:0,restoredEvents:0};records.push(record);
   for(const method of ['drawArrays','drawElements']){const draw=gl[method];gl[method]=function(...drawArgs){record.draws++;return draw.apply(this,drawArgs);};}
   this.addEventListener('webglcontextlost',()=>record.lostEvents++);
   this.addEventListener('webglcontextrestored',()=>record.restoredEvents++);
  }
  return gl;
 };
});
const world=()=>page.evaluate(()=>{
 const renderer=window.__game.renderer,record=window.__preparationGlAudit.find(r=>r.gl===renderer.gl);
 return {lost:renderer.gl.isContextLost(),rendererLost:renderer.contextLost,draws:record.draws,lostEvents:record.lostEvents,restoredEvents:record.restoredEvents};
});
function assertWorld(state){assert.equal(state.lost,false);assert.equal(state.rendererLost,false);assert.equal(state.lostEvents,0);}
const retire=()=>page.evaluate(()=>{
 const panel=window.__preparationAuditPanel,veil=panel.prepareVeil,canvas=panel.prepareCanvas,gl=canvas.getContext('webgl2');
 const entry={veil,canvas,gl,frameCount:veil.getTelemetry().frameCount,veilErrors:0};
 canvas.addEventListener('veilerror',()=>entry.veilErrors++);
 window.__preparationRetired??=[];window.__preparationRetired.push(entry);
 window.__prepareReview.close();
 return {lost:gl.isContextLost(),telemetry:veil.getTelemetry(),panelRaf:panel.prepareFrame,canvasCount:document.querySelectorAll('.inventory-prepare-veil').length};
});
function assertRetired(state){assert.equal(state.lost,true);assert.equal(state.telemetry.disposed,true);assert.equal(state.telemetry.rafScheduled,false);assert.equal(state.panelRaf,0);assert.equal(state.canvasCount,0);}
const retiredAudit=()=>page.evaluate(()=>window.__preparationRetired.map((r,index)=>({index,lost:r.gl.isContextLost(),disposed:r.veil.getTelemetry().disposed,rafScheduled:r.veil.getTelemetry().rafScheduled,framesAfterClose:r.veil.getTelemetry().frameCount-r.frameCount,veilErrors:r.veilErrors,error:r.canvas.dataset.error??null})));
function assertAllRetired(states){for(const state of states){assert.equal(state.lost,true);assert.equal(state.disposed,true);assert.equal(state.rafScheduled,false);assert.equal(state.framesAfterClose,0);assert.equal(state.veilErrors,0);assert.equal(state.error,null);}}

try{
await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3040'}/prepare-review.html?fixture=equipped`);
await page.waitForSelector('#inventory-panel');
await page.waitForTimeout(900);
const get=()=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).reverse().find(u=>/\/src\/ui\/dom\/inventory-panel\.ts(?:\?|$)/.test(u));const {inventoryPanel:p}=await import(url);window.__preparationAuditPanel=p;return {telemetry:p.prepareVeil?.getTelemetry(),text:p.prepareNarration?.textContent,actor:p.options?.getPreparationActorRegion?.(),paused:p.options?.isPreparationPaused?.()};});
for(const grade of ['low','medium','severe']){
 await page.locator(`[data-departure-grade=${grade}]`).click();await page.waitForTimeout(1500);
 const a=await get();await page.screenshot({path:`${out}/${grade}.png`});await page.waitForTimeout(600);const b=await get();
 assert(b.telemetry.timeSeconds>a.telemetry.timeSeconds);assert(b.telemetry.travelPixels>a.telemetry.travelPixels);assert(b.text);report.frames.push({grade,a,b});
}
await page.locator('[data-departure-grade=low]').click();await page.waitForTimeout(180);const mid=await get();assert(mid.telemetry.transitionActive);assert(mid.telemetry.currentLevel>0&&mid.telemetry.currentLevel<2);report.checks.push('continuous downward transition');
await page.locator('[data-departure-grade=severe]').click();await page.waitForTimeout(1400);await page.locator('[data-prepare-action=next]').click();await page.waitForTimeout(1300);
const equipment=await get();assert.equal(equipment.text,'');assert(equipment.telemetry.phaseSpeed<.36);await page.screenshot({path:`${out}/equipment.png`});
await page.evaluate(()=>window.__game.scene.pause('PurificationScene'));await page.waitForTimeout(100);const paused=await get();await page.waitForTimeout(500);const frozen=await get();assert.equal(frozen.telemetry.timeSeconds,paused.telemetry.timeSeconds);assert.equal(frozen.telemetry.rafScheduled,false);report.checks.push('pause freezes veil and stops its RAF');
await page.evaluate(()=>window.__game.scene.resume('PurificationScene'));await page.waitForTimeout(150);assert((await get()).telemetry.timeSeconds>frozen.telemetry.timeSeconds);
await page.locator('.inventory-prepare-back').click();await page.waitForTimeout(350);assert.equal((await get()).text,'');
await page.evaluate(()=>window.__prepareReview.close());assert.equal(await page.locator('.inventory-prepare-veil').count(),0);await page.waitForTimeout(400);await page.evaluate(()=>window.__prepareReview.open());await page.waitForTimeout(400);assert.equal((await get()).text,'');report.checks.push('read grade and close/reopen do not replay narration');
await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-departure-grade=severe]').click();await page.waitForTimeout(200);const reduced=await get();assert.equal(reduced.telemetry.motionEnabled,false);assert.equal(reduced.telemetry.currentLevel,2);await page.waitForTimeout(200);assert.equal((await get()).telemetry.timeSeconds,reduced.telemetry.timeSeconds);report.checks.push('reduced motion retains severe stable composition');
await page.emulateMedia({reducedMotion:'no-preference'});
const worldBeforeCycles=await world();assertWorld(worldBeforeCycles);
for(let i=1;i<=30;i++){
 const retired=await retire();assertRetired(retired);await page.waitForTimeout(80);
 await page.evaluate(()=>window.__prepareReview.open());await page.waitForTimeout(150);
 const state=await world();assertWorld(state);assert.equal(await page.locator('.inventory-prepare-veil').count(),1);
 assert((await get()).telemetry.frameCount>0);report.lifecycle.normal.push({cycle:i,world:state});
}
// No rendering gap between close/open pairs; queued context events must not
// resurrect a disposed veil or retire the unrelated Phaser renderer.
report.lifecycle.dense=await page.evaluate(()=>{
 const states=[];
 for(let i=1;i<=30;i++){
  const panel=window.__preparationAuditPanel,veil=panel.prepareVeil,canvas=panel.prepareCanvas,gl=canvas.getContext('webgl2');
  const entry={veil,canvas,gl,frameCount:veil.getTelemetry().frameCount,veilErrors:0};canvas.addEventListener('veilerror',()=>entry.veilErrors++);window.__preparationRetired.push(entry);
  window.__prepareReview.close();
  const closed={lost:gl.isContextLost(),telemetry:veil.getTelemetry(),panelRaf:panel.prepareFrame,canvasCount:document.querySelectorAll('.inventory-prepare-veil').length};
  window.__prepareReview.open();
  states.push({cycle:i,closed,worldLost:window.__game.renderer.gl.isContextLost(),rendererLost:window.__game.renderer.contextLost,canvasCount:document.querySelectorAll('.inventory-prepare-veil').length});
 }
 return states;
});
for(const state of report.lifecycle.dense){assertRetired(state.closed);assert.equal(state.worldLost,false);assert.equal(state.rendererLost,false);assert.equal(state.canvasCount,1);}
await page.waitForTimeout(400);report.lifecycle.retired=await retiredAudit();assertAllRetired(report.lifecycle.retired);
const closed=await retire();assertRetired(closed);const beforeResume=await world();await page.waitForTimeout(400);
report.lifecycle.afterClose=await world();assertWorld(report.lifecycle.afterClose);assert(report.lifecycle.afterClose.draws>beforeResume.draws);assert(report.lifecycle.afterClose.draws>worldBeforeCycles.draws);
await page.screenshot({path:`${out}/world-after-60-cycles.png`});
await page.evaluate(()=>window.__prepareReview.open());await page.waitForTimeout(200);assertWorld(await world());
report.checks.push('30 normal + 30 dense close/open cycles release retired contexts; world never loses context and continues drawing; retired RAFs stay stopped');
await page.locator('.inventory-prepare-veil').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.waitForTimeout(100);await page.locator('[data-prepare-action=next]').click();assert.equal(await page.locator('#inventory-panel').getAttribute('data-prepare-view'),'equipment');report.checks.push('context loss preserves equipment navigation');
// The sample imports the exact shared controller, with its capture-specific
// preserveDrawingBuffer setting. Exercise that wrapper on fresh canvases.
report.sample=await page.evaluate(async()=>{
 const {mountVeil}=await import('/docs/art/demos/preparation-threat-sample/overlay.ts');const states=[];
 for(let i=0;i<3;i++){
  const canvas=document.createElement('canvas');document.body.append(canvas);const veil=mountVeil(canvas),gl=canvas.getContext('webgl2');let errors=0;canvas.addEventListener('veilerror',()=>errors++);
  veil.setGrade(i===0?'low':i===1?'medium':'severe');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const before=veil.getTelemetry(),preserveDrawingBuffer=gl.getContextAttributes().preserveDrawingBuffer;veil.dispose();veil.dispose();const frameCount=veil.getTelemetry().frameCount;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  states.push({grade:before.targetGrade,drew:before.frameCount>0,preserveDrawingBuffer,lost:gl.isContextLost(),disposed:veil.getTelemetry().disposed,rafScheduled:veil.getTelemetry().rafScheduled,framesAfterClose:veil.getTelemetry().frameCount-frameCount,errors});canvas.remove();
 }
 return states;
});
for(const state of report.sample){assert.equal(state.drew,true);assert.equal(state.preserveDrawingBuffer,true);assert.equal(state.lost,true);assert.equal(state.disposed,true);assert.equal(state.rafScheduled,false);assert.equal(state.framesAfterClose,0);assert.equal(state.errors,0);}
report.checks.push('shared sample wrapper disposes idempotently and rebuilds on fresh canvases with capture pixels retained');
// Fail after acquiring a real context to verify partial initialization cleanup.
report.initializationFailure=await page.evaluate(async()=>{
 const {mountVeil}=await import('/src/ui/dom/preparation-veil.ts');const states=[];
 for(const kind of ['compile','uniform']){
  const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');const method=kind==='compile'?'getShaderParameter':'getUniformLocation';const original=gl[method];gl[method]=()=>kind==='compile'?false:null;
  let message=null;try{mountVeil(canvas);}catch(error){message=String(error);}finally{gl[method]=original;}
  states.push({kind,message,lost:gl.isContextLost()});
 }
 return states;
});
for(const state of report.initializationFailure){assert(state.message);assert.equal(state.lost,true);}
report.checks.push('shader compilation and required-uniform initialization failure release the acquired context');
report.lifecycle.finalWorld=await world();assertWorld(report.lifecycle.finalWorld);
assert.equal(consoleMessages.filter(m=>/Too many active WebGL contexts|Renderer disabled|WebGL Context lost/i.test(m.text)).length,0,'world context quota/loss console warning');
assert.deepEqual(errors,[]);report.status='PASS';
}catch(e){report.failure=String(e);}finally{fs.writeFileSync(`${out}/vfx-report.json`,JSON.stringify(report,null,2));await browser.close();}
if(report.failure)throw new Error(report.failure);
