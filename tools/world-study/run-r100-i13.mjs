/** Predeclared finite I13 economic input sample. Never grants resources or edits save bytes.
 * --freeze records the full 21-attempt plan; --batch first|remaining|natural runs once.
 * All cases preserve original failures. A second execution cannot overwrite an attempt. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=path.resolve(process.env.QA_I13_OUTPUT??'docs/qa/artifacts/r100-i13');
const planPath=path.join(root,'policy-freeze.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceStorage='docs/qa/artifacts/r100-i10-i12/continuous-final108/alternating/alternating/browser-storage.json';
const baselineReport='docs/qa/artifacts/r100-i10-i12/continuous-final108/alternating/report.json';
const controller='tools/world-study/r100-i13-journey.mjs';
const preparationA={id:'A',active:['冷灰烟斗','停摆怀表'],passive:'黄铜背扣'};
const preparationB={id:'B',active:['盲针罗盘','断跟短靴'],passive:'黄铜背扣'};
const mainSave=s=>{assert.equal(s.origins.length,1);assert.equal(s.cookies.length,0);const entries=s.origins[0].localStorage.filter(entry=>entry.name==='coh-save-v1');assert.equal(entries.length,1);return entries[0].value;};
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planPath),'Do not overwrite frozen plan');
 const gameUrl=process.env.GAME_URL;assert(gameUrl,'GAME_URL required');
 const sourceManifest=process.env.QA_SOURCE_MANIFEST;assert(sourceManifest&&fs.existsSync(sourceManifest));
 const storage=read(sourceStorage),raw=mainSave(storage),initial=JSON.parse(raw),prior=read(baselineReport).realJourneyAttempts.at(-1);
 assert.equal(prior.status,'completed-real-input');assert.deepEqual(initial,prior.afterPreparation.state);
 storage.origins[0].origin=new URL(gameUrl).origin;assert.equal(mainSave(storage),raw,'Only origin changes, all earned save bytes exact');
 fs.mkdirSync(root,{recursive:true});const mappedStorage=path.join(root,'earned-storage.json');fs.writeFileSync(mappedStorage,JSON.stringify(storage,null,2)+'\n');
 const cases=['ash-strata','fibre-silt','white-scarfield'].flatMap((world,index)=>['low','medium','severe'].map(grade=>({id:`paired-${world}-${grade}`,kind:'fixed-world-diagnostic',batch:index===0?'first':'remaining',world,seed:20261005,schedule:[grade],preparation:preparationA}))).concat([
  {id:'natural-maintenance',kind:'normal-random-continuation',batch:'natural',world:null,schedule:['low','medium','low','medium','low','medium'],preparation:preparationA},
  {id:'natural-prepared-recovery',kind:'normal-random-continuation',batch:'natural',world:null,schedule:['low','severe','severe','low','low','low'],preparation:preparationB},
 ]);
 const dependencies=[controller,'tools/world-study/derive-r100-i13-journey.mjs','tools/world-study/run-r100-i13.mjs','tools/qa/r100-revision6-journey.mjs','tools/qa/r100-i09-costed-encounters.mjs','tools/qa/r100-i09-tool-slots.mjs','tools/qa/r100-observed-searches.mjs','tools/qa/i27-journey-driver.mjs'];
 const plan={version:1,createdAt:new Date().toISOString(),gameUrl,sourceManifest,sourceManifestSha256:sha(sourceManifest),sourceStorage,sourceStorageSha256:sha(sourceStorage),baselineReport,baselineReportSha256:sha(baselineReport),mappedStorage,mappedStorageSha256:sha(mappedStorage),initialSaveSha256:createHash('sha256').update(raw).digest('hex'),initialCycle:initial.cycle,initialReserve:initial.kindlingReserve,initialModules:initial.modules,initialEquipment:initial.inventory.equipment,controller,dependencies:dependencies.map(file=>({file,sha256:sha(file)})),cases,totalAttempts:21,searchLimit:6,limits:['Shared earned ancestor; fixed worlds are diagnostics, not independent natural supply.','Grade pairs hold initial save/world/requested seed/preparation policy, not layout or movement transcript.','Public declared preparation only; same-name genuine stock may replace depleted pieces; missing tools remain empty, never granted.','Policy15 keeps modules at 50; this QA threshold is not a design maintenance standard. Account service-capital loss separately.','Geometry-assisted expert routing; no human fun, global economics or performance claim.','No replacement after gameplay death/empty return; stop the affected branch on technical failure.']};
 fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');console.log(`Frozen ${cases.length} cases / 21 actual attempts; earned cycle ${initial.cycle}`);process.exit(0);
}
const batch=process.argv[process.argv.indexOf('--batch')+1];assert(['first','remaining','natural'].includes(batch),'--batch first|remaining|natural required');
const plan=read(planPath);for(const dependency of plan.dependencies)assert.equal(sha(dependency.file),dependency.sha256,dependency.file);
assert.equal(sha(plan.sourceManifest),plan.sourceManifestSha256);assert.equal(sha(plan.mappedStorage),plan.mappedStorageSha256);
const executionPath=path.join(root,`execution-${batch}.json`);assert(!fs.existsSync(executionPath),'Batch already attempted; preserve failures and request an explicit bounded continuation');
const execution={startedAt:new Date().toISOString(),batch,policySha256:sha(planPath),status:'running',cases:plan.cases.filter(row=>row.batch===batch).map(row=>({...row,status:'pending'}))};
const write=()=>fs.writeFileSync(executionPath,JSON.stringify(execution,null,2)+'\n');write();
async function run(row){
 const folder=path.join(root,row.id);assert(!fs.existsSync(folder));fs.mkdirSync(folder,{recursive:true});row.startedAt=new Date().toISOString();row.status='running';write();
 const env={...process.env,GAME_URL:plan.gameUrl,QA_OUTPUT_DIR:folder,QA_STORAGE_STATE:plan.mappedStorage,QA_GRADES:'i13',QA_RUNS:String(row.schedule.length),QA_I13_SCHEDULE:JSON.stringify(row.schedule),QA_I13_PREPARATION:JSON.stringify(row.preparation),QA_SEARCH_LIMIT:String(plan.searchLimit),QA_POST_RETURN_MANAGEMENT:'1',QA_ENTRY_WAIT:'600',QA_ORDINAL_START:'1',QA_WORLD_ID:row.world??'',QA_SEED:String(row.seed??0),QA_CONTROLLED_BUILD:'',QA_REPRO_IDENTITY_FILE:'',QA_REPLAY_INPUTS:'',TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'};
 const fd=fs.openSync(path.join(folder,'process.log'),'wx');
 try{row.exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',plan.controller],{env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',resolve);});}
 catch(error){row.error=String(error);row.exitCode=-1;}finally{fs.closeSync(fd);}
 const reportFile=path.join(folder,'report.json');const report=fs.existsSync(reportFile)?read(reportFile):null;
 row.report=reportFile;row.completed=report?.realJourneyAttempts.filter(r=>r.status==='completed-real-input').length??0;row.status=row.exitCode===0&&row.completed===row.schedule.length?'completed':'failed';row.finishedAt=new Date().toISOString();write();console.log(row.id,row.status,row.completed+'/'+row.schedule.length);return row;
}
// At most three contexts. No performance claim is drawn from this concurrent run.
for(let index=0;index<execution.cases.length;index+=3)await Promise.all(execution.cases.slice(index,index+3).map(run));
execution.finishedAt=new Date().toISOString();execution.status=execution.cases.every(row=>row.status==='completed')?'completed':'has-failures';write();if(execution.status!=='completed')process.exitCode=1;
