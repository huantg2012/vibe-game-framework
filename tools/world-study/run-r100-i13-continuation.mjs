/** Separately authorized I13 continuation: maximum14 sorties, maximum3 contexts.
 * Sources from the completed28 are immutable. --freeze precedes --run. Failed
 * samples are retained, never replaced. Production source/data are unchanged.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {checkPublicPolicy} from './r100-i13-continuation-policy.mjs';
const root='docs/qa/artifacts/r100-i13-continuation';
const planPath=path.join(root,'policy-freeze.json');
const journey='tools/world-study/r100-i13-continuation-journey.mjs';
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binding=file=>({file,sha256:sha(file)});
const files=[journey,'tools/world-study/r100-i13-continuation-encounters.mjs','tools/world-study/r100-i13-continuation-policy.mjs','tools/world-study/run-r100-i13-continuation.mjs','tools/qa/r100-i09-tool-slots.mjs','tools/qa/r100-observed-searches.mjs','tools/qa/i27-journey-driver.mjs'];
if(process.argv.includes('--self-check')){
 for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
 console.log(JSON.stringify({status:'pass',syntaxFiles:files.length,policy:checkPublicPolicy()}));process.exit(0);
}
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planPath),'Do not overwrite frozen execution plan');
 const preflight=read(path.join(root,'qa-preflight.json'));
 const priorRoot='docs/qa/artifacts/r100-i13';
 const sourceManifest=path.join(root,'frozen-source/source-snapshot.json'),manifest=read(sourceManifest);
 assert.equal(manifest.port,3033);
 const original=read(path.join(priorRoot,'frozen-source/source-snapshot.json'));
 assert.deepEqual(manifest.sources,original.sources,'No production change');
 const branchA=preflight.branches.find(row=>row.name==='A'),branchB=preflight.branches.find(row=>row.name==='B');
 const passive={name:'黄铜背扣'};
 const exact=(exactId,family,minimumPower)=>({exactId,exactOnly:true,family,minimumPower});
 const information={id:'new-earned-information-and-dash',active:[
  exact('CAT_5ecb5242-f2dd-4cfd-9d7b-09cf48db36b0_r100-contaminant-contested-1','survey',128),
  exact('CAT_a8cbed61-55c0-4205-9356-535531bae725_r100-contaminant-safe-1','dash',48)],passive};
 const control={id:'new-earned-control',active:[
  exact('CAT_a8cbed61-55c0-4205-9356-535531bae725_r100-contaminant-contested-1','suppress',3),
  exact('CAT_d1b034c1-0332-4467-817b-e4aeff5dd351_r100-contaminant-contested-1','solidify',2.5)],passive};
 const quiet={id:'new-earned-silence-and-dash',active:[
  exact('CAT_93e4d1e1-1ef4-4140-b7e9-148143ff7a7c_r100-contaminant-contested-1','silence',5),
  exact('CAT_71b452ce-75ff-4f77-8683-7b32f4679334_r100-contaminant-contested-1','dash',48)],passive};
 const empty={id:'actual-owned-weapon-only',active:[null,null],passive:null};
 const budget={normalPerSlot:1,protectNextPreparation:true,minimumPower:{survey:128,dash:48,suppress:3,solidify:2.5,silence:5},emergency:'Only dash against a currently observed windup/active attack within65px; record actual overspend and consequences'};
 const step=(grade,preparation,surveyDecision=false)=>({grade,preparation,surveyDecision,budget});
 const definitions=[
  {id:'a-new-directions',branch:branchA,sourceStorage:path.join(priorRoot,'r2-natural-maintenance/i13/browser-storage.json'),steps:[step('low',information,true),{...step('severe',information,true),requiredUses:[2,3]},step('low',control),step('low',control)]},
  {id:'b-service-recovery',branch:branchB,sourceStorage:path.join(priorRoot,'r2-earned-glove/i13/browser-storage.json'),steps:Array.from({length:4},()=>step('low',quiet)),stopAfterRecovery:true,recoveryFunctions:[{family:'silence',minimumPower:5},{family:'dash',minimumPower:48}],requiredDashItemId:quiet.active[1].exactId},
  ...['low','medium','severe'].map(grade=>({id:'entry-'+grade,branch:branchA,sourceStorage:path.join(priorRoot,'r2-natural-maintenance/i13/browser-storage.json'),steps:[step(grade,empty),step(grade,empty)],entryOnly:true,maxFieldMs:40000,searchLimit:2,fixedFirstWorld:'ash-strata',fixedFirstSeed:20261005}))
 ];
 const cases=definitions.map(({branch,...definition})=>{
  for(const row of branch.reports)assert.equal(sha(row.path),row.sha256,row.path);
  assert.equal(sha(branch.rawTerminal.path),branch.rawTerminal.sha256);
  const sourceStorage=read(definition.sourceStorage),entry=sourceStorage.origins[0].localStorage.find(row=>row.name==='coh-save-v1');
  assert(entry);assert.deepEqual(JSON.parse(entry.value),read(branch.rawTerminal.path));assert.equal(sourceStorage.cookies.length,0);assert.equal(sourceStorage.origins.length,1);
  const raw=entry.value;sourceStorage.origins[0].origin='http://127.0.0.1:3033';
  assert.equal(sourceStorage.origins[0].localStorage.find(row=>row.name==='coh-save-v1').value,raw);
  const input=path.join(root,definition.id+'-earned-storage.json');fs.writeFileSync(input,JSON.stringify(sourceStorage,null,2)+'\n',{flag:'wx'});
  const reports=branch.reports.map(row=>read(row.path)),trips=reports.flatMap(report=>report.realJourneyAttempts),runIds=trips.map(trip=>trip.entrySave.state.inventory.run.id),runSet=new Set(runIds),freshIds=[];
  for(const trip of trips)for(const item of trip.afterReturn.state.inventory.items)if(runSet.has(item.source?.runId)&&!freshIds.includes(item.id))freshIds.push(item.id);
  for(const one of definition.steps)for(const rule of one.preparation.active.filter(Boolean)){
   const actual=branch.publicReadyTools.find(row=>row.id===rule.exactId);assert(actual?.acquiredInThisI13Branch&&actual.public.usesRemaining>0,rule.exactId);assert.equal(actual.ability.familyId,rule.family);
  }
  return{...definition,sourceBranch:branch.name,sourceReports:branch.reports,sourceTerminal:branch.rawTerminal,sourceStorageSha256:sha(definition.sourceStorage),input,inputSha256:sha(input),initialReserve:branch.reserve,initialCycle:branch.cycle,initialModules:branch.modules,ancestorRunIds:runIds,freshItemIds:freshIds,searchLimit:definition.searchLimit??6};
 });
 const plan={version:1,createdAt:new Date().toISOString(),authorization:'User explicitly instructed continued I13 remediation; root approved A4+B4+entry6 before execution.',maxAttempts:14,maxContexts:3,gameUrl:'http://127.0.0.1:3033/',sourceManifest:binding(sourceManifest),preflight:binding(path.join(root,'qa-preflight.json')),taskContract:binding('docs/tasks/rift-r100-i13.md'),dependencies:files.map(binding),immutablePriorSources:['tools/world-study/r100-i13-r2-journey.mjs','tools/world-study/r100-i13-r2-encounters.mjs','tools/world-study/run-r100-i13-r2.mjs',path.join(priorRoot,'overall-execution-receipt.json')].map(binding),cases,limits:['No old samples overwritten, no resource/HP/time/identity grants.','A continues trueA12 and changes direction; never restores oldB7 debt.','B continues trueB7 debt19 with its own new earned glove and tape.','Each normal tool slot consumes at most1 per trip and leaves a real usable instance>=2uses in that public ability family. Only actual visible close attack permits emergency dash.','A severe requires real equipped2survey/3dash plus service51/100/51; otherwise actual low and missed severe recorded.','Entry branches first use ash-strata20261005, second continue genuine terminal with same grade and normal random world.','Entry target candidates are only normal observations within320 of spawn, max2 pickups or40seconds; no hidden kind/tier/value choice.','FIFO uses actual acquired provenance/order only; hidden contaminant definitions are never used for selection.','Budget/actual finite recovery is distinct from infinite sustainability, old-buffer capital and all inventory total recovery.']};
 fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});console.log('Frozen maximum14 continuation sorties');process.exit(0);
}
assert(process.argv.includes('--run'),'Use --self-check, --freeze or --run');
const plan=read(planPath);
for(const row of [...plan.dependencies,...plan.immutablePriorSources,plan.sourceManifest,plan.preflight])assert.equal(sha(row.file),row.sha256,row.file);
const executionPath=path.join(root,'execution.json');assert(!fs.existsSync(executionPath),'No hidden retry/replacement');
const execution={startedAt:new Date().toISOString(),planSha256:sha(planPath),status:'running',cases:plan.cases.map(row=>({...row,status:'pending'}))};
const save=()=>fs.writeFileSync(executionPath,JSON.stringify(execution,null,2)+'\n');save();
let index=0;
async function worker(){
 while(index<execution.cases.length){
  const row=execution.cases[index++];assert.equal(sha(row.input),row.inputSha256);assert.equal(sha(row.sourceStorage),row.sourceStorageSha256);
  const out=path.join(root,row.id);assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});row.status='running';row.startedAt=new Date().toISOString();save();
  const fd=fs.openSync(path.join(out,'process.log'),'wx');
  const env={...process.env,GAME_URL:plan.gameUrl,QA_OUTPUT_DIR:out,QA_STORAGE_STATE:row.input,QA_GRADES:'i13',QA_RUNS:String(row.steps.length),QA_I13_SCHEDULE:JSON.stringify(row.steps.map(step=>step.grade)),QA_I13_PREPARATION:JSON.stringify(row.steps[0].preparation),QA_I13_CONTINUATION:JSON.stringify(row),QA_SEARCH_LIMIT:String(row.searchLimit),QA_POST_RETURN_MANAGEMENT:'1',QA_ENTRY_WAIT:'600',QA_ORDINAL_START:'1',QA_WORLD_ID:'',QA_SEED:'',QA_CONTROLLED_BUILD:'',QA_REPRO_IDENTITY_FILE:'',QA_REPLAY_INPUTS:'',TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'};
  try{row.exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',journey],{env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',resolve);});}catch(error){row.error=String(error);row.exitCode=-1;}finally{fs.closeSync(fd);}
  const reportPath=path.join(out,'report.json'),report=fs.existsSync(reportPath)?read(reportPath):null;
  row.report=reportPath;row.completed=report?.realJourneyAttempts.filter(trip=>trip.status==='completed-real-input').length??0;row.plannedStop=report?.plannedStop??null;
  row.status=row.exitCode===0&&(row.completed===row.steps.length||(row.completed>0&&row.plannedStop))?'completed':'failed';row.finishedAt=new Date().toISOString();save();
  console.log(row.id,row.status,row.completed+'/'+row.steps.length);
 }
}
await Promise.all(Array.from({length:plan.maxContexts},()=>worker()));
execution.status=execution.cases.every(row=>row.status==='completed')?'completed':'has-failures';execution.finishedAt=new Date().toISOString();save();if(execution.status!=='completed')process.exitCode=1;
