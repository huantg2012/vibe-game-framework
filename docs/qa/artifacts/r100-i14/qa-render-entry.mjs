/** Bounded formal entry/cold observations for the actor-mask-only source delta. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
import {installI14BrowserObservations,armI14EntryObservation,readI14EntryObservation,readI14FullState,differences,validateI14Envelope} from '../../../../tools/qa/r100-i14-lifecycle-v2.mjs';
const base='docs/qa/artifacts/r100-i14',out=`${base}/render-entry`,planFile=`${out}/policy-freeze.json`;
const arg=key=>{const i=process.argv.indexOf(key);return i<0?null:process.argv[i+1];};
const sha=v=>createHash('sha256').update(v).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))}),read=f=>JSON.parse(fs.readFileSync(f)),write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function rawOf(c){const b=fs.readFileSync(c.source.file);return c.kind==='raw'?b.toString():JSON.parse(b).origins.flatMap(x=>x.localStorage).find(x=>x.name==='coh-save-v1').value;}
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planFile));const source=arg('--source-manifest'),delta=arg('--delta-freeze'),url=arg('--game-url');assert(source&&delta&&url,'Explicit new source, delta authorization and current isolated server required.');
 const coldDir=`${base}/continuous/recovery-v2/batch-01/i14`,cold=[['low',`${base}/continuous/recovery-v2/same-run-earned-storage.json`,'storage'],['medium',`${coldDir}/2-cold-menu-input.save.json`,'raw'],['severe',`${coldDir}/3-cold-menu-input.save.json`,'raw']];
 const earned='docs/qa/artifacts/r100-i13-continuation/a-target-recovery/a-same-run-recovery/i13/browser-storage.json';
 const cases=[...cold.map(([grade,file,kind])=>({id:`cold-${grade}`,mode:'cold',grade,kind,source:ref(file)})),...['low','medium','severe'].map(grade=>({id:`new-${grade}`,mode:'new',grade,kind:'storage',source:ref(earned)}))].map(c=>{const raw=rawOf(c),s=JSON.parse(raw);assert.equal(s.inventory.run.status,c.mode==='cold'?'active':'settled');if(c.mode==='cold')assert(s.riftCheckpoint.identity.recipeId.endsWith(`-${c.grade}`));return{...c,currentRawSha256:sha(raw),sourceRun:s.inventory.run.id,sourceCycle:s.cycle,identity:c.mode==='cold'?s.riftCheckpoint.identity:null};});
 fs.mkdirSync(out,{recursive:true});const chrome=process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',pw=process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
 const plan={schemaVersion:1,createdAt:new Date().toISOString(),authorization:'Root approved three historical checkpoints and three real formal diagnostic departures for the actor-mask-only delta. No main-chain writes; these six observations contribute zero to the48 denominator.',sourceManifest:ref(source),deltaFreeze:ref(delta),parentRelease:ref('docs/qa/artifacts/r100-i10-i12/release-candidate.json'),finalCandidate:'pending independent verification and Director source bridge',
  tools:[ref(import.meta.filename),ref('tools/qa/r100-i14-lifecycle-v2.mjs')],gameUrl:url,cases,maxConcurrentContexts:1,headless:true,viewport:{width:1440,height:1000},budgets:{singleEntryTargetMs:5000,longTaskMs:50},
  environment:{node:process.version,chrome,chromeVersion:execFileSync(chrome,['--version'],{encoding:'utf8'}).trim(),playwrightModule:ref(pw)},
  method:['Load original actual current-save bytes in temporary isolated contexts.','Cold cases use actual MainMenu Enter Continue. New cases use actual MainMenu Continue into the earned base, open production prepare via its normal enterRift method, click the public grade and press Shift+Enter.','Capture the first complete normal runtime frame and every longtask; retain source/full saved/runtime state differences. No route, search, tool, combat, extraction or base settlement.','Only three diagnostic new departures occur. Fixed destinations are not injected or rerolled; historical three cold identities remain frozen.','Compare cold persisted game record entirely; sequence/checksum recommit allowed only with checksum validation. Identity, inventory and player position remain exact; natural first-frame clock/AI/Host differences are fully retained.','Keep webpage/MainMenu longtasks separate from armed Rift transition. These are individual target comparisons, never a three-sample population p95.'],
  limits:['No headful focus/OS focus, audio playback, visual-fatigue or weak-device claim.','Read-only onPostUpdate observer uses the existing lifecycle helper and adds observation overhead; no synthetic game time or movement.','No existing evidence or source storage is edited. Final release needs the explicit source-delta bridge; parent RC is provenance only.']};write(planFile,plan);console.log(JSON.stringify({freeze:ref(planFile),cases:cases.map(c=>({id:c.id,sourceRun:c.sourceRun}))}));process.exit(0);
}
assert(process.argv.includes('--run'),'Freeze exact new source before --run.');assert(!fs.existsSync(`${out}/report.json`),'Preserve previous attempts.');const plan=read(planFile);
for(const r of [plan.sourceManifest,plan.deltaFreeze,plan.parentRelease,...plan.tools,plan.environment.playwrightModule,...plan.cases.map(c=>c.source)])assert.equal(ref(r.file).sha256,r.sha256,r.file);
const sourceEntries=Object.entries(read(plan.sourceManifest.file).sources);assert(sourceEntries.length>=1397);for(const[f,h]of sourceEntries)assert.equal(ref(f).sha256,h,f);
const report={schemaVersion:1,startedAt:new Date().toISOString(),freeze:ref(planFile),status:'running',cases:[],diagnosticNewDepartureInputs:0,diagnosticNewDepartures:0,historicalColdContinueInputs:0,historicalColdContinues:0,mainChainWrites:0,addedToNatural48:0,failures:[]};
const save=()=>fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');save();let browser;
try{
 const{chromium}=await import(pathToFileURL(plan.environment.playwrightModule.file).href);browser=await chromium.launch({headless:plan.headless,executablePath:plan.environment.chrome});report.browserVersion=browser.version();save();
 for(const c of plan.cases){
  const dir=`${out}/${c.id}`;fs.mkdirSync(dir,{recursive:true});const raw=rawOf(c),saved=JSON.parse(raw);assert.equal(sha(raw),c.currentRawSha256);fs.writeFileSync(`${dir}/source-current.save.json`,raw,{flag:'wx'});
  const context=await browser.newContext({viewport:plan.viewport,storageState:{cookies:[],origins:[{origin:new URL(plan.gameUrl).origin,localStorage:[{name:'coh-save-v1',value:raw}]}]}}),page=await context.newPage();
  const row={id:c.id,mode:c.mode,grade:c.grade,source:c.source,status:'running',errors:[],inputs:[]};report.cases.push(row);save();page.on('pageerror',e=>row.errors.push(String(e)));
  try{
   await installI14BrowserObservations(page);await page.goto(plan.gameUrl);await page.waitForFunction(()=>window.__game?.scene.getScene('MainMenuScene')?.interactive(),null,{timeout:45000});assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),raw);
   if(c.mode==='cold')await validateI14Envelope(page,saved);
   else{
    row.inputs.push({action:'Enter',purpose:'normal-menu-continue-earned-base'});await page.keyboard.press('Enter',{delay:90});await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'),null,{timeout:45000});await page.waitForTimeout(2200);
    const beforePrepare=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));fs.writeFileSync(`${dir}/base-before-prepare.save.json`,beforePrepare,{flag:'wx'});assert.deepEqual(JSON.parse(beforePrepare),saved,'No mutations before opening public prepare.');
    await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());row.inputs.push({action:'PurificationScene.enterRift',purpose:'open normal production preparation; no teleport or resource mutation'});
    await page.locator(`[data-departure-grade="${c.grade}"]`).click();row.inputs.push({action:'public-grade-click',grade:c.grade});
   }
   await armI14EntryObservation(page,c.mode==='cold'?'cached-mask-cold-continue':'cached-mask-formal-departure');const started=Date.now();const key=c.mode==='cold'?'Enter':'Shift+Enter';row.inputs.push({action:key,purpose:c.mode});if(c.mode==='cold')report.historicalColdContinueInputs++;else report.diagnosticNewDepartureInputs++;await page.keyboard.press(key,{delay:90});
   await page.waitForFunction(()=>window.__i14EntryObservation?.firstComplete&&window.__game.scene.isActive('RiftScene'),null,{timeout:45000});row.readyWallMs=Date.now()-started;
   // Deliver pending observer entries without advancing any game input.
   await page.waitForTimeout(80);const observation=await readI14EntryObservation(page),first=observation.firstComplete,firstSaved=JSON.parse(first.raw);write(`${dir}/first-complete.json`,observation);await validateI14Envelope(page,firstSaved);
   row.firstCompleteMs=first.at-observation.requestedAt;row.longTasks=observation.longTasks;row.transitionLongTasks=observation.longTasks.filter(t=>t.start<first.at);row.afterReadyLongTasks=observation.longTasks.filter(t=>t.start>=first.at);row.webpageLongTasks=await page.evaluate(()=>window.__i14LongTasks);
   row.runId=first.checkpoint.runId;row.identity=first.checkpoint.identity;row.sourceToFirstSavedDifferences=differences(saved,firstSaved);assert.equal(firstSaved.inventory.run.status,'active');assert.equal(firstSaved.riftCheckpoint.identity.generation.nativeDefinition.grade,c.grade);
   row.cache=await page.evaluate(()=>{const f=window.__game.scene.getScene('RiftScene').devRuntime.actorOcclusionField;return{byteLength:f.byteLength,width:f.width,height:f.height};});assert.equal(row.cache.byteLength,row.cache.width*row.cache.height*4);
   if(c.mode==='cold'){
    report.historicalColdContinues++;assert.equal(row.runId,c.sourceRun);assert.deepEqual(first.checkpoint.identity,saved.riftCheckpoint.identity);assert.deepEqual(first.inventory,saved.inventory);assert.deepEqual(first.checkpoint.state.player.position,saved.riftCheckpoint.state.player.position);
    assert(row.sourceToFirstSavedDifferences.every(d=>['riftCheckpoint.sequence','checkpointChecksum'].includes(d.path)),'Cold persisted commitment may only recommit sequence/checksum.');
    row.sourceToFirstRuntimeDifferences=differences(saved.riftCheckpoint,first.checkpoint);row.firstFrameDeltaMs=first.checkpoint.elapsedMs-saved.riftCheckpoint.elapsedMs;assert(row.firstFrameDeltaMs>=0);
   }else{report.diagnosticNewDepartures++;assert.notEqual(row.runId,c.sourceRun);assert.equal(firstSaved.cycle,saved.cycle+1);}
   write(`${dir}/after-first-frame.json`,await readI14FullState(page));await page.screenshot({path:`${dir}/normal-entry.png`});assert.deepEqual(row.errors,[]);
   row.budgets={single5s:row.firstCompleteMs<=plan.budgets.singleEntryTargetMs,noRiftTaskOver50:row.transitionLongTasks.every(t=>t.duration<=plan.budgets.longTaskMs)};
   row.status=Object.values(row.budgets).every(Boolean)?'bounded-entry-observed-pass':'entry-budget-failure';if(row.status!=='bounded-entry-observed-pass')report.failures.push({case:c.id,budgets:row.budgets});
  }catch(error){row.status='failed';row.failure=String(error.stack??error);report.failures.push({case:c.id,failure:row.failure});try{write(`${dir}/failure-state.json`,await readI14FullState(page));}catch{}try{await page.screenshot({path:`${dir}/failure.png`});}catch{}}
  finally{write(`${dir}/diagnostic-terminal-storage.json`,await context.storageState());await context.close();row.finishedAt=new Date().toISOString();save();}
 }
 report.status=report.failures.length?'bounded-render-entry-has-failures':'six-bounded-render-entry-observations-pass';report.finishedAt=new Date().toISOString();if(report.failures.length)process.exitCode=1;
}catch(error){report.status='failed';report.failure=String(error.stack??error);report.finishedAt=new Date().toISOString();process.exitCode=1;}
finally{
 await browser?.close();const drift=[];
 for(const c of plan.cases){const actual=ref(c.source.file).sha256;if(actual!==c.source.sha256)drift.push({file:c.source.file,expected:c.source.sha256,actual,kind:'original-input'});}
 for(const[f,expected]of sourceEntries){const actual=ref(f).sha256;if(actual!==expected)drift.push({file:f,expected,actual,kind:'production-source'});}
 report.originalInputSourcesUnchanged=!drift.some(d=>d.kind==='original-input');report.productionSourceCount=sourceEntries.length;report.productionSourcesUnchanged=!drift.some(d=>d.kind==='production-source');report.sourceDrift=drift;
 if(drift.length){report.status='failed-source-drift';report.failures.push(...drift);process.exitCode=1;}
 save();console.log(JSON.stringify({status:report.status,diagnosticNewDepartures:report.diagnosticNewDepartures,historicalColdContinues:report.historicalColdContinues,report:ref(`${out}/report.json`)}));
}
