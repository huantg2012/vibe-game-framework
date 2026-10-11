/** Real production worker + RiftScene; overview copies its actual material receiver below the independent fog layer. */
import assert from 'node:assert/strict';
const expectedRevision = Number(process.env.QA_ALGORITHM_REVISION ?? 7);
assert(Number.isSafeInteger(expectedRevision) && expectedRevision > 0, 'QA_ALGORITHM_REVISION must be a positive integer');
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const worlds=(process.env.QA_WORLDS??'ash-strata,cleft-tableland,crystal-fibre,rib-vault,shell-chain,hollow-wreckage,cinder-ridge,marrow-break,tension-membrane,pale-sail,shell-gel-delta,gel-rafts,monolith-sill,woven-quarters').split(',');
const grade=process.env.QA_GRADE??'medium',seed=Number(process.env.QA_SEED??20261010),base=process.env.GAME_URL??'http://127.0.0.1:3027';
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/browser');await fs.mkdir(out,{recursive:true});
assert(!(await fs.access(path.join(out,'capture.json')).then(()=>true).catch(()=>false)),'Refusing to replace existing evidence');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const snapshot=await fetch(`${base}/source-snapshot.json`).then(r=>r.ok?r.json():null).catch(()=>null);
if(process.env.QA_REQUIRE_SNAPSHOT==='1')assert(snapshot?.files,'Immutable source snapshot required');
if(snapshot)await fs.writeFile(path.join(out,'source-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
const report={status:'running',sourceSnapshot:snapshot?{createdAt:snapshot.createdAt,root:snapshot.root}:null,scope:'Actual production worker and RiftScene in isolated memory-storage gym. Normal entry screenshot, initial undiscovered exit state, and separate unfogged copy of the admitted native renderer. Not novice exploration or complete gameplay.',browser:browser.version(),cases:[],errors:[]};
const save=()=>fs.writeFile(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');
try{for(const world of worlds){
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 try{
 const started=Date.now();await page.goto(`${base}/r100-gym.html?world=${world}&grade=${grade}&seed=${seed}`);
 await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running||!document.getElementById('error')?.hidden,null,{timeout:120000});
 const state=await page.evaluate(()=>window.__r100Gym?.getState());assert(state?.runtime.running,await page.locator('#error').textContent());assert.equal(state.recipe.package.algorithmRevision,expectedRevision);
 await page.waitForTimeout(500);
 const discovery=await page.evaluate(async()=>{
  const {audioManager}=await import('/src/managers/audio-manager.ts'),scene=audioManager.game.scene.getScene('RiftScene');
  const position=window.__r100Gym.getLayout().extractionPoint.position;
  return {known:scene.minimap.exportRuntimeState().extractionDiscovered,visibility:scene.visibility.getVisibilityAt(position),glowCount:scene.visibility.glowSources.size,body:scene.probeBuildLabState()};
 });
 assert.equal(discovery.known,false,'exit leaked into initial map memory');assert.equal(discovery.visibility,0,'unknown distant exit visible at spawn');
 await page.screenshot({path:path.join(out,`${world}-${grade}-entry.png`),fullPage:true});
 await page.locator('#pause').click();
 const full=await page.evaluate(async()=>{
  const {audioManager}=await import('/src/managers/audio-manager.ts');
  const scene=audioManager.game.scene.getScene('RiftScene'),layout=window.__r100Gym.getLayout(),native=window.__r100Gym.getNative();
  // Copy the actual admitted runtime receiver below its independent fog layer.
  // No rebake, cache re-import, visibility override or second renderer.
  const canvas=document.createElement('canvas'),source=scene.devRuntime.renderer.canvas;
  canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
  const p=layout.spawnPoint;
   for(const [spawn,point]of[[true,p],[false,layout.extractionPoint.position]]){
    ctx.fillStyle='#0a0b0d';ctx.strokeStyle=spawn?'#c8cdd4':'#e0a848';ctx.lineWidth=4;ctx.beginPath();
    if(spawn)ctx.arc(point.x,point.y,13,0,Math.PI*2);else{ctx.moveTo(point.x,point.y-17);ctx.lineTo(point.x+15,point.y);ctx.lineTo(point.x,point.y+17);ctx.lineTo(point.x-15,point.y);ctx.closePath();}ctx.fill();ctx.stroke();
    ctx.font='25px -apple-system, "PingFang SC", sans-serif';const text=spawn?'出生点':'撤离点',w=ctx.measureText(text).width,x=Math.max(8,Math.min(canvas.width-w-30,point.x+20)),y=Math.max(40,point.y-32);
    ctx.fillStyle='#0a0b0d';ctx.fillRect(x-6,y-27,w+12,36);ctx.fillStyle=spawn?'#c8cdd4':'#e0a848';ctx.fillText(text,x,y);
   }
   return {png:canvas.toDataURL('image/png').split(',')[1],width:canvas.width,height:canvas.height,spawn:p,extraction:layout.extractionPoint.position,geometry:native.diagnostics.geometryFingerprint};
 });
 await fs.writeFile(path.join(out,`${world}-${grade}-full.png`),Buffer.from(full.png,'base64'));delete full.png;
 assert.deepEqual(errors,[]);report.cases.push({world,grade,seed,elapsedMs:Date.now()-started,revision:state.recipe.package.algorithmRevision,metadata:state.metadata,recipe:state.recipe,discovery,full});console.log(`PASS browser ${world}/${grade}`);
 }catch(error){report.errors.push({world,error:String(error.stack??error),pageErrors:errors});console.log(`FAIL browser ${world}: ${error.message}`);}
 finally{await context.close();await save();}
}report.status=report.errors.length?'failed':'passed';await save();if(report.errors.length)process.exitCode=1;}
finally{await browser.close();}
