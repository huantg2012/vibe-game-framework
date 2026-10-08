/** Bounded offline candidate review. Never imports the browser entry/wrapper. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRecheckBudget,guardRecheckDriver} from '../../../../../tools/qa/r100-i12-recheck-budget.mjs';
import {createJourneyDriver} from '../../../../../tools/qa/i27-journey-driver.mjs';
const base='docs/qa/artifacts/r100-i10-i12/closeout-independent-review';
const out=`${base}/policy16-candidate-independent-review.json`;
assert(!fs.existsSync(out));
const digest=value=>createHash('sha256').update(value).digest('hex');
const sha=file=>digest(fs.readFileSync(file));
const ref=file=>({path:file,sha256:sha(file)});
const candidatePath='docs/qa/artifacts/r100-i10-i12/p42-policy16-preparation/candidate.json';
assert.equal(sha(candidatePath),'2ccb5fad11fc9c644776290d090c1db68876dbffdedc37d5f839feb0c2ff23aa');
const candidate=JSON.parse(fs.readFileSync(candidatePath));
const inputs=[ref(candidatePath)];
for(const row of [...candidate.files,...candidate.diffs.flatMap(row=>[row.original,row.candidate,row.diff]),
  candidate.boundaryTests,candidate.syntaxChecks,candidate.protocolCandidate,candidate.executionPlan]){
  assert.equal(sha(row.path),row.sha256);inputs.push(row);
}
const protocol=JSON.parse(fs.readFileSync(candidate.protocolCandidate.path));
const execution=JSON.parse(fs.readFileSync(candidate.executionPlan.path));
assert.equal(protocol.status,'candidate-awaiting-independent-review-and-root-approval');assert.equal(protocol.reviewer,null);
for(const row of [protocol.qualificationPlan,protocol.source,protocol.storage,protocol.originalPolicy,protocol.executor,protocol.wrapper,
  ...protocol.cases.map(row=>row.originalReport),execution.executionPlan]){assert.equal(sha(row.path),row.sha256);inputs.push(row);}
for(const row of protocol.dependencies){assert.equal(sha(row.file),row.sha256);inputs.push({path:row.file,sha256:row.sha256});}
assert.deepEqual(protocol.cases.map(({world,grade,seed})=>({world,grade,seed})),[20261005,3075192741].map(seed=>({world:'white-scarfield',grade:'severe',seed})));
assert.equal(execution.env.QA_STOP_ON_FAILURE,'1');assert.equal(execution.env.QA_CONCURRENCY,'1');
const originalEncounters=fs.readFileSync('tools/qa/r100-i09-costed-encounters.mjs','utf8');
const newEncounters=fs.readFileSync('tools/qa/r100-i12-recheck-encounters.mjs','utf8').split('\n').slice(2).join('\n');
assert.equal(newEncounters,originalEncounters.replaceAll("e.attack==='active'","e.attack==='strike'"));
const child=spawnSync(process.execPath,['tools/qa/r100-i12-recheck-budget.test.mjs'],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
assert.equal(child.status,0,child.stderr);const boundary=JSON.parse(child.stdout);assert.equal(boundary.status,'pass');assert.equal(boundary.checks,14);
const testPath=`${base}/policy16-boundary-independent-rerun.json`;
fs.writeFileSync(testPath,JSON.stringify({command:[process.execPath,'tools/qa/r100-i12-recheck-budget.test.mjs'],exitCode:child.status,stdout:boundary,stderr:child.stderr},null,2)+'\n',{flag:'wx'});
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'coh-policy16-independent-'));
const additional=[];
const meta={targetId:'observed',reason:'visible-opponent-too-close',originalSearchIndex:0,triggerElapsedMs:10000};
function fixture({down=()=>{},up=()=>{},wait=()=>{}}={}){
  const state={scene:'rift',active:true,paused:false,ended:false,hp:100,chaos:20,elapsedMs:10000,nodes:[{id:'observed',collected:false}]};
  const events=[],held=new Set(),read=async()=>structuredClone(state);
  const raw={keyboard:{
    async down(key){events.push({kind:'down',key,elapsedMs:state.elapsedMs});held.add(key);await down(state,key);},
    async up(key){events.push({kind:'up',key,elapsedMs:state.elapsedMs});await up(state,key);held.delete(key);},
    async press(key,{delay=0}={}){await this.down(key);state.elapsedMs+=delay;await this.up(key);},
  },evaluate:read,async waitForTimeout(ms){state.elapsedMs+=ms;await wait(state,ms);}};
  const budget=createRecheckBudget(raw,read,()=>{});
  return {state,events,held,budget,driver:guardRecheckDriver(createJourneyDriver(budget.page,folder),read,budget)};
}
try{
  {
    const f=fixture({up:(state)=>{state.elapsedMs+=1600;}});
    const result=await f.budget.run(meta,async()=>{await f.budget.page.keyboard.down('e');f.state.elapsedMs=14900;await f.budget.checkpoint();});
    assert.equal(result.receipt.status,'failed');assert.equal(result.receipt.elapsedMs,6500);assert.equal(result.receipt.withinTimeBound,false);assert.equal(f.held.size,0);
    additional.push({name:'Slow cleanup time belongs to the actual bound',receipt:result.receipt,events:f.events});
  }
  {
    const f=fixture({down:state=>{state.elapsedMs+=6100;}});
    const result=await f.budget.run(meta,async()=>{await f.driver.hold(['w','d'],65);});
    assert.equal(result.receipt.status,'failed');assert.deepEqual(f.events.filter(row=>row.kind==='down').map(row=>row.key),['w']);assert.equal(f.held.size,0);
    additional.push({name:'First key stall prevents the second key and releases the chord',receipt:result.receipt,events:f.events});
  }
  {
    const f=fixture({wait:(state,ms)=>{state.elapsedMs+=ms;}});
    const result=await f.budget.run(meta,async()=>{f.state.elapsedMs=14000;await f.driver.hold(['d'],400);await f.driver.press('q');});
    assert.equal(result.receipt.status,'game-time-budget');assert.equal(result.receipt.elapsedMs,4800);assert.equal(result.receipt.withinTimeBound,true);
    assert.deepEqual(f.events.filter(row=>row.kind==='down').map(row=>row.key),['d']);assert.equal(f.held.size,0);
    additional.push({name:'Game clock advancing faster than requested wall wait stops follow-up input',receipt:result.receipt,events:f.events});
  }
  {
    const f=fixture();
    const result=await f.budget.run(meta,async()=>{f.state.elapsedMs=14700;await f.budget.page.keyboard.down('e');await f.budget.page.waitForTimeout(150);});
    assert.equal(result.receipt.status,'game-time-budget');assert.equal(result.receipt.elapsedMs,4700);assert.equal(f.held.size,0);
    assert.deepEqual(f.events.map(row=>row.kind),['down','up']);
    additional.push({name:'Insufficient remaining E-channel time releases E before another wait',receipt:result.receipt,events:f.events});
  }
}finally{fs.rmSync(folder,{recursive:true,force:true});}
for(const row of candidate.files)assert.equal(sha(row.path),row.sha256,'Candidate changed during independent review');
const report={schemaVersion:1,status:'pass-for-controlled-supplement-preflight-only',createdAt:new Date().toISOString(),reviewer:'i12_qa',
  candidate:ref(candidatePath),inputs,boundaryRerun:ref(testPath),additionalBoundaryChecks:additional,
  staticChecks:[
    'Private encounter copy differs only in its header and the two active-to-strike comparisons; original bytes remain unchanged.',
    'The journey fixes one further return-threat strike comparison and restricts white-scarfield/severe, original seed pair, one journey and one actual pickup.',
    'Nested driver movement, direct E keyboard input, keyboard press, waits and snapshots share the same actual-clock guard; return reserve is rechecked around its asynchronous calculation.',
    'The guard latches stops, always allows key-up, measures cleanup and reports overruns/errors as failed. It begins conservative stopping at5000ms with250ms action reserve.',
    'The wrapper hashes original source/earned save/controller/dependencies/reports; same full identity and starting-save checks are rerun on actual completed journeys.',
    'Original refusal is retained as its own search row and the supplement references that index and timestamp; fixed one target is passed back through existing caution/route/search.',
    'No new hidden AI/loot reads, product changes, resources, reward/HP/time/position setters were introduced by the reviewed delta.',
  ],
  disposition:'No blocking candidate defect found within the reviewed scope. Root may make its explicit bounded two-original-seed execution decision; this reviewer does not grant gameplay qualification.',
  limitations:[
    'Asynchronous browser stalls can physically exceed6000ms before control returns; such attempts are explicitly failed and cannot qualify. The candidate is not a hard realtime guarantee.',
    'Actual report identity/save equality, input timing, pickups and settled extraction remain to be examined after execution.',
    'Approved root protocol has not been created by this audit and no candidate Chrome was run.',
    'P42 white-scarfield and P43 ochre-folds original severe qualification failures remain open; this review does not expand the supplement to ochre-folds.',
  ],harness:ref(`${base}/audit-policy16-candidate.mjs`)};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,output:out,sha256:sha(out),boundaryChecks:14,independentAdditionalChecks:additional.length}));
