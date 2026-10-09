/** Focus v2: remove Playwright default focus emulation, then observe native headed tab events. Original failed fixture retained. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {installI14BrowserObservations,armI14EntryObservation,readI14EntryObservation,readI14FullState,differences,validateI14Envelope} from './r100-i14-lifecycle-v2.mjs';

const root=process.cwd(),out=path.resolve('docs/qa/artifacts/r100-i14/focus/native-v2');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reference=file=>({file,sha256:sha(fs.readFileSync(file))});
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const planFile=path.join(out,'policy-freeze.json');
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planFile),'Do not overwrite the original focus freeze.');
 const parent='docs/qa/artifacts/r100-i14/continuous/recovery-v2',caseDir=`${parent}/batch-01/i14`;
 const sources=[['low',`${parent}/same-run-earned-storage.json`,'storage'],['medium',`${caseDir}/2-cold-menu-input.save.json`,'raw'],['severe',`${caseDir}/3-cold-menu-input.save.json`,'raw']];
 const cases=sources.map(([grade,file,kind])=>{const bytes=fs.readFileSync(file),data=JSON.parse(bytes),raw=kind==='raw'?bytes.toString():data.origins.flatMap(x=>x.localStorage).find(x=>x.name==='coh-save-v1').value,saved=JSON.parse(raw);
  assert(saved.riftCheckpoint.identity.recipeId.endsWith(`-${grade}`));assert.equal(saved.inventory.run.status,'active');
  return{grade,source:reference(file),sourceKind:kind,currentRawSha256:sha(raw),runId:saved.inventory.run.id,sequence:saved.riftCheckpoint.sequence,identity:saved.riftCheckpoint.identity.recipeId,seed:saved.riftCheckpoint.identity.seed};});
 fs.mkdirSync(out,{recursive:true});
 const chrome=process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const playwright=process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
 const task='docs/tasks/rift-r100-i14.md';fs.copyFileSync(task,path.join(out,'task-preregistration.md'),fs.constants.COPYFILE_EXCL);
 const plan={schemaVersion:1,createdAt:new Date().toISOString(),authorization:'Root explicitly approved three historical checkpoints in isolated headed diagnostic contexts to fill the missing native tab-focus evidence. These branches never update or count as48 main-chain sorties.',
  priorFailure:reference('docs/qa/artifacts/r100-i14/focus/report.json'),priorFreeze:reference('docs/qa/artifacts/r100-i14/focus/policy-freeze.json'),focusOverride:{operation:'Emulation.setFocusEmulationEnabled',enabled:false,reason:'Installed Playwright enables focus emulation on every main frame. Disable only this testing default; native browser events and game pause still must occur naturally.',dependency:reference('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/lib/coreBundle.js'),line:37399},
  gameUrl:'http://127.0.0.1:3035/',headless:false,maxContexts:1,maxCases:3,holdMs:700,cases,
  dependencies:['tools/qa/check-r100-i14-focus-v2.mjs','tools/qa/r100-i14-lifecycle-v2.mjs','src/main.ts','src/types/rift-checkpoint.ts','src/scenes/rift-scene.ts'].map(reference),
  sourceManifest:reference('docs/qa/artifacts/r100-i14/frozen-source/source-snapshot.json'),releaseCandidate:reference('docs/qa/artifacts/r100-i10-i12/release-candidate.json'),task:reference(path.relative(root,path.join(out,'task-preregistration.md'))),parentFreeze:reference(`${parent}/policy-freeze.json`),
  environment:{node:process.version,chrome,chromeVersion:execFileSync(chrome,['--version'],{encoding:'utf8'}).trim(),playwrightModule:reference(playwright)},
  method:['Load exact actual current save bytes in a new temporary context; normal menu Enter Continue.','Read-only capture first complete frame, inventory and full saved state.','Open about:blank tab and bringToFront, requiring trusted native blur/hidden and actual game pause.','Capture complete state/inventory/raw while paused, wait at least700ms, capture and compare all fields.','Bring game tab back, observe that it remains paused; normal Enter consumes the pause-overlay action, then verify same active run and unchanged inventory/player position.'],
  exclusions:['No synthetic event dispatch, state/clock/AI mutation, equipment or resource grant.','No new departure, movement, search, tool use, extraction or settlement.','Not OS application focus, performance sample, natural attempt or human review.','The main48 chain and all original source bytes remain untouched.']};write(planFile,plan);console.log(JSON.stringify({freeze:reference(planFile),cases}));process.exit(0);
}
assert(process.argv.includes('--run'),'Use --freeze, peer review, then --run.');
assert(!fs.existsSync(path.join(out,'report.json')),'Preserve the first actual focus attempt.');
const plan=read(planFile);for(const ref of [...plan.dependencies,plan.sourceManifest,plan.releaseCandidate,plan.task,plan.parentFreeze,plan.environment.playwrightModule,plan.priorFailure,plan.priorFreeze,plan.focusOverride.dependency,...plan.cases.map(x=>x.source)])assert.equal(reference(ref.file).sha256,ref.sha256,ref.file);
for(const[file,expected]of Object.entries(read(plan.sourceManifest.file).sources))assert.equal(reference(file).sha256,expected,file);
const{chromium}=await import(pathToFileURL(plan.environment.playwrightModule.file).href);
const report={schemaVersion:1,startedAt:new Date().toISOString(),freeze:reference(planFile),status:'running',cases:[],newSorties:0,mainChainWrites:0,syntheticEvents:0,scope:'Headed native browser-tab focus only; historical checkpoints in isolated contexts. No OS application focus, performance, human or new departure claim.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
let browser;
try{
 browser=await chromium.launch({headless:false,executablePath:plan.environment.chrome});report.browserVersion=browser.version();save();
 for(const c of plan.cases){
  const dir=path.join(out,c.grade);fs.mkdirSync(dir,{recursive:true});const source=fs.readFileSync(c.source.file),raw=c.sourceKind==='raw'?source.toString():JSON.parse(source).origins.flatMap(x=>x.localStorage).find(x=>x.name==='coh-save-v1').value;
  assert.equal(sha(raw),c.currentRawSha256);fs.writeFileSync(path.join(dir,'source-current.save.json'),raw,{flag:'wx'});const saved=JSON.parse(raw);
  const context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:[],origins:[{origin:new URL(plan.gameUrl).origin,localStorage:[{name:'coh-save-v1',value:raw}]}]}});
  const row={grade:c.grade,runId:c.runId,source:c.source,currentRawSha256:c.currentRawSha256,status:'running',errors:[],inputs:[]};report.cases.push(row);save();let page;
  const shot=async name=>{await page.screenshot({path:path.join(dir,`${name}.png`)});};
  try{
   page=await context.newPage();page.on('pageerror',e=>row.errors.push(String(e)));await installI14BrowserObservations(page);
   await page.goto(plan.gameUrl);await page.bringToFront();const focusSession=await context.newCDPSession(page);await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});row.automationFocusOverride={enabled:false,at:new Date().toISOString()};await page.waitForFunction(()=>window.__game?.scene.getScene('MainMenuScene')?.interactive(),null,{timeout:45000});
   assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),raw,'Normal menu must load exact current source');await validateI14Envelope(page,saved);await armI14EntryObservation(page,'headed-focus-checkpoint-branch');
   row.inputs.push({action:'Enter',purpose:'normal-menu-continue',at:new Date().toISOString()});await page.keyboard.press('Enter',{delay:90});
   await page.waitForFunction(()=>window.__i14EntryObservation?.firstComplete&&window.__game.scene.isActive('RiftScene'),null,{timeout:45000});
   const entry=await readI14EntryObservation(page);write(path.join(dir,'first-complete.json'),entry);assert.equal(entry.firstComplete.checkpoint.runId,c.runId);assert.deepEqual(entry.firstComplete.inventory,saved.inventory);assert.deepEqual(entry.firstComplete.checkpoint.identity,saved.riftCheckpoint.identity);
   const before=await readI14FullState(page);write(path.join(dir,'before-tab.json'),before);assert.equal(before.paused,false);await shot('before-tab');
   const alternate=await context.newPage();await alternate.goto('about:blank');const alternateSession=await context.newCDPSession(alternate);await alternateSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});await alternate.bringToFront();row.inputs.push({action:'actual-tab-bringToFront',at:new Date().toISOString()});
   await page.waitForTimeout(250);const hidden=await readI14FullState(page);write(path.join(dir,'tab-away-start.json'),hidden);
   await page.waitForTimeout(plan.holdMs);const held=await readI14FullState(page);write(path.join(dir,'tab-away-held.json'),held);
   const loss=hidden.events.slice(before.events.length).filter(e=>e.trusted&&(e.type==='blur'||e.type==='visibilitychange'&&e.hidden));
   row.nativeLossEvents=loss;row.hidden=hidden.hidden;row.focused=hidden.focused;row.paused=hidden.paused;row.heldWallMs=held.at-hidden.at;
   row.heldDifferences={checkpoint:differences(hidden.checkpoint,held.checkpoint),inventory:differences(hidden.inventory,held.inventory),rawEqual:hidden.raw===held.raw};save();
   assert(loss.length,'No trusted native tab loss; do not substitute synthetic events');assert(hidden.paused&&held.paused,'Native focus loss must pause the running game');assert(row.heldWallMs>=plan.holdMs);assert.deepEqual(row.heldDifferences.checkpoint,[]);assert.deepEqual(row.heldDifferences.inventory,[]);assert(row.heldDifferences.rawEqual);
   await page.bringToFront();const returned=await readI14FullState(page);write(path.join(dir,'returned-tab-before-key.json'),returned);assert(returned.paused,'Returning tab must not auto-resume');assert.deepEqual(returned.inventory,saved.inventory);await shot('returned-still-paused');
   row.inputs.push({action:'Enter',purpose:'dismiss-real-focus-pause-overlay',at:new Date().toISOString()});await page.keyboard.press('Enter',{delay:90});await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'));
   const resumed=await readI14FullState(page);write(path.join(dir,'after-normal-resume.json'),resumed);assert(!resumed.paused);assert.equal(resumed.checkpoint.runId,c.runId);assert.deepEqual(resumed.inventory,saved.inventory);assert.deepEqual(resumed.checkpoint.state.player.position,saved.riftCheckpoint.state.player.position);assert(resumed.checkpoint.elapsedMs>held.checkpoint.elapsedMs);assert.deepEqual(row.errors,[]);await shot('after-normal-resume');
   row.sourceToFirstSavedDifferences=differences(saved,JSON.parse(entry.firstComplete.raw));row.firstRuntimeDeltaMs=entry.firstComplete.checkpoint.elapsedMs-saved.riftCheckpoint.elapsedMs;
   row.status='native-tab-focus-pause-and-explicit-resume-pass';row.endedAt=new Date().toISOString();await alternate.close();
  }catch(error){row.status='failed';row.failure=String(error.stack??error);row.endedAt=new Date().toISOString();if(page)try{write(path.join(dir,'failure-state.json'),await readI14FullState(page));await shot('failure');}catch{}save();throw error;
  }finally{write(path.join(dir,'diagnostic-terminal-storage.json'),await context.storageState());await context.close();save();}
 }
 report.status='three-grades-native-tab-focus-pass';report.finishedAt=new Date().toISOString();
}catch(error){report.status='failed';report.failure=String(error.stack??error);report.finishedAt=new Date().toISOString();process.exitCode=1;
}finally{await browser?.close();for(const c of plan.cases)assert.equal(reference(c.source.file).sha256,c.source.sha256,'Original checkpoint source changed');report.originalCheckpointHashesStillMatch=true;save();console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({grade:c.grade,status:c.status,nativeLoss:c.nativeLossEvents?.length,holdMs:c.heldWallMs})),report:reference(path.join(out,'report.json'))}));}
