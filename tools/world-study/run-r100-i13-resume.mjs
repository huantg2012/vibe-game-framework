/** Resume the preserved target trial; never creates a replacement severe run. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {advanceMovementStuck} from './r100-i13-resume-encounters.mjs';
const parent='docs/qa/artifacts/r100-i13-continuation',root=path.join(parent,'a-target-recovery');
const planPath=path.join(root,'policy-freeze.json'),journey='tools/world-study/r100-i13-resume-journey.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),binding=file=>({file,sha256:sha(file)});
const dependencies=[journey,'tools/world-study/r100-i13-resume-encounters.mjs','tools/world-study/run-r100-i13-resume.mjs'];
function selfCheck(){
 for(const file of dependencies){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 const source=fs.readFileSync(journey,'utf8');
 assert(source.includes('if(!controlled.handled||controlled.moved)'));
 assert(!source.includes('stuck=lastPosition'));
 const advance=advanceMovementStuck;
 let count=0;for(let i=0;i<31;i++)count=advance(count,false,0);assert.equal(count,0,'31 intentional refusals are not physical blockage');
 count=advance(count,true,0);assert.equal(count,1);count=advance(count,true,8);assert.equal(count,0);
 return{status:'pass',syntaxFiles:3,noInputRefusalCount:31,countAfterRefusals:0,actualBlockedInputCounted:true,movedInputResets:true};
}
if(process.argv.includes('--self-check')){console.log(JSON.stringify(selfCheck()));process.exit(0);}
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planPath));selfCheck();
 const priorPath=path.join(parent,'a-target-selection/policy-freeze.json'),prior=read(priorPath);
 const qaPath=path.join(parent,'qa-a-target-recovery-preflight.json'),qa=read(qaPath);
 assert.equal(qa.status,'same-active-run-last-complete-frame-preflight-pass');assert(qa.lastCompleteRawExact&&qa.sameInventory&&qa.samePosition);
 for(const row of [qa.sourceStorage,qa.sourceReport,qa.rejectedDiagnostic,qa.originalEntry])assert.equal(sha(row.path),row.sha256);
 for(const row of [...prior.dependencies,...prior.immutablePriorSources,prior.preflight,prior.sourceManifest,prior.taskContract])assert.equal(sha(row.file),row.sha256,row.file);
 const manifest=read(prior.sourceManifest.file);for(const [file,hash]of Object.entries(manifest.sources))assert.equal(sha(file),hash,file);
 const original=read(qa.sourceReport.path).realJourneyAttempts[0];assert.equal(original.status,'failed');
 const storage=read(qa.sourceStorage.path),raw=storage.origins[0].localStorage.find(x=>x.name==='coh-save-v1').value,save=JSON.parse(raw);
 assert.equal(createHash('sha256').update(raw).digest('hex'),qa.sourceRawSha256);assert.equal(save.inventory.run.id,qa.runId);assert.equal(save.riftCheckpoint.sequence,112);
 const journalPath=path.join(path.dirname(qa.sourceStorage.path),'journey.jsonl');const logs=fs.readFileSync(journalPath,'utf8').trim().split('\n').map(JSON.parse);
 const slots=new Map(),roles=new Map(),acceptedControls=[],dashWindows=[];
 for(const e of logs){if(e.event==='tool-budget-actual')slots.set(e.slot,e.total);if(e.event==='paid-solidify-role-window'){for(const [role,count]of e.roles)roles.set(role,count);for(const effect of e.accepted)acceptedControls.push({...effect,role:e.controlIntent.role});}if(e.event==='paid-dash-actual-window')dashWindows.push(e);}
 assert.equal(slots.get(0),1);assert.equal(slots.get(1),1);assert.equal(roles.get('search'),1);
 fs.mkdirSync(root,{recursive:true});const input=path.join(root,'earned-storage.json');fs.copyFileSync(qa.sourceStorage.path,input,fs.constants.COPYFILE_EXCL);
 const taskCopy=path.join(root,'task-preregistration.md');fs.writeFileSync(taskCopy,fs.readFileSync('docs/tasks/rift-r100-i13.md'),{flag:'wx'});
 const row={...prior.cases[0],id:'a-same-run-recovery',sourceStorage:qa.sourceStorage.path,sourceStorageSha256:qa.sourceStorage.sha256,input,inputSha256:sha(input),interruptedReport:qa.sourceReport.path,autosaveBeforeDiagnosticMs:qa.unsavedIntervalMs,priorSegmentToolBudget:{slots:[...slots].map(([slot,used])=>({slot,used})),controlRoles:[...roles].map(([role,used])=>({role,used})),acceptedControls,dashWindows}};
 const plan={version:1,createdAt:new Date().toISOString(),gameUrl:prior.gameUrl,maxContexts:1,maxAttempts:3,maxNewDepartures:2,resumedRunId:qa.runId,preflight:binding(qaPath),dependencies:[...dependencies.map(binding),...prior.dependencies],immutablePriorSources:[...prior.immutablePriorSources,binding(priorPath),prior.taskContract,prior.preflight,binding(qa.sourceStorage.path),binding(qa.sourceReport.path),binding(qa.rejectedDiagnostic.path),binding(journalPath)],sourceManifest:prior.sourceManifest,taskContract:binding(taskCopy),originalTaskAtFreeze:binding('docs/tasks/rift-r100-i13.md'),cases:[row],authorization:'Root explicitly approved same-run production Continue from saved sequence112; fix only actual-movement stuck accounting. Retain original failed segment and99.99ms normal autosave gap. No replacement severe, no search after resume, inherited Qsearch1/Fnormal1 budget; after real settlement at most original two low with ordinary recovery early stop.',limits:prior.limits};
 fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});console.log('Frozen same-run cold recovery with at most two subsequent low departures');process.exit(0);
}
assert(process.argv.includes('--run'));const plan=read(planPath);for(const row of [...plan.dependencies,...plan.immutablePriorSources,plan.preflight,plan.sourceManifest,plan.taskContract])assert.equal(sha(row.file),row.sha256,row.file);
const row=plan.cases[0],executionPath=path.join(root,'execution.json');assert(!fs.existsSync(executionPath));assert.equal(sha(row.input),row.inputSha256);
const out=path.join(root,row.id);fs.mkdirSync(out);const execution={startedAt:new Date().toISOString(),planSha256:sha(planPath),status:'running',sameRunContinuation:true,cases:[{...row,status:'running'}]};const save=()=>fs.writeFileSync(executionPath,JSON.stringify(execution,null,2)+'\n');save();
const env={...process.env,GAME_URL:plan.gameUrl,QA_OUTPUT_DIR:out,QA_STORAGE_STATE:row.input,QA_GRADES:'i13',QA_RUNS:String(row.steps.length),QA_I13_SCHEDULE:JSON.stringify(row.steps.map(x=>x.grade)),QA_I13_PREPARATION:JSON.stringify(row.steps[0].preparation),QA_I13_CONTINUATION:JSON.stringify(row),QA_SEARCH_LIMIT:'6',QA_POST_RETURN_MANAGEMENT:'1',QA_ENTRY_WAIT:'600',QA_ORDINAL_START:'1',QA_WORLD_ID:'',QA_SEED:'',QA_CONTROLLED_BUILD:'',QA_REPRO_IDENTITY_FILE:'',QA_REPLAY_INPUTS:'',TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'};
const check=spawnSync(process.execPath,['--import','tsx',journey,'--check-return-policy'],{env,encoding:'utf8'});fs.writeFileSync(path.join(root,'code-verification.json'),JSON.stringify({selfCheck:selfCheck(),returnPolicy:{exitCode:check.status,stdout:check.stdout,stderr:check.stderr},productionChecks:'Same1397 I12 source; earlier successful tsc/runtime checks remain applicable. No lint npm script; syntax is not lint.'},null,2)+'\n',{flag:'wx'});assert.equal(check.status,0,check.stderr);
const fd=fs.openSync(path.join(out,'process.log'),'wx');const result=execution.cases[0];try{result.exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',journey],{env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',resolve);});}catch(e){result.exitCode=-1;result.error=String(e);}finally{fs.closeSync(fd);}
result.report=path.join(out,'report.json');const report=fs.existsSync(result.report)?read(result.report):null;result.completed=report?.realJourneyAttempts.filter(x=>x.status==='completed-real-input').length??0;result.plannedStop=report?.plannedStop??null;result.status=result.exitCode===0&&(result.completed===3||result.plannedStop)?'completed':'failed';execution.status=result.status;execution.finishedAt=new Date().toISOString();save();console.log(row.id,result.status,result.completed+'/3 including resumed original run');if(result.status!=='completed')process.exitCode=1;
