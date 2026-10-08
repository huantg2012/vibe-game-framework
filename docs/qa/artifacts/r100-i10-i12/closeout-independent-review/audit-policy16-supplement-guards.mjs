/** Independent, read-only evidence-contract adversarial checks; no game execution. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateSupplementJourney} from './controller-supplement-reviewed-889b4d9a59a8.mjs';

const base='docs/qa/artifacts/r100-i10-i12/closeout-independent-review';
const output=`${base}/policy16-supplement-guard-review-v1.json`;
assert(!fs.existsSync(output));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source=`${base}/controller-supplement-reviewed-889b4d9a59a8.mjs`;
assert.equal(sha(source),'889b4d9a59a804b57d72e47affc99babfc20f53b3a0812997e1ed9ce6aae9300');
const originalPath='docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original005-006/play/001-white-scarfield-severe-20261005/report.json';
const original=JSON.parse(fs.readFileSync(originalPath)).realJourneyAttempts[0];
const attempt={world:'white-scarfield',grade:'severe',seed:20261005};
const binding={actualPickupLimit:1,protocol:{limits:{maxRechecksPerJourney:1,maxRecheckElapsedMs:6000,maxActualPickups:3}},
  originals:new Map([['white-scarfield/severe/20261005',original]])};
const fixture=()=>{
  const journey=structuredClone(original);
  journey.boundedSearchRechecks=[{targetId:'r100-kindling-deep-1',reason:'visible-opponent-too-close',
    startedElapsedMs:47000,endedElapsedMs:48000,status:'stopped-budget',errors:[],withinTimeBound:true,
    releasedAllTrackedKeys:true,maxObservedElapsedMs:1000}];
  return journey;
};
const invoke=journey=>{try{return {accepted:true,problems:validateSupplementJourney(binding,attempt,journey,[])};}
  catch(error){return {accepted:false,error:error.message};}};
const checks=[];
assert.deepEqual(invoke(fixture()),{accepted:true,problems:[]});
checks.push({name:'Exact original identity/save with synthetically bounded metadata',status:'accepted',scope:'contract fixture only'});
for(const [name,mutate] of [
  ['Changed full identity',j=>j.identity.signature='changed'],
  ['Added starting resource',j=>j.before.state.kindlingReserve+=1],
  ['Second supplemental action',j=>j.boundedSearchRechecks.push({...j.boundedSearchRechecks[0]})],
]){const j=fixture();mutate(j);const result=invoke(j);assert.equal(result.accepted,false);checks.push({name,status:'correctly-rejected',result});}
for(const [name,mutate] of [
  ['Elapsed overrun',j=>{j.boundedSearchRechecks[0].endedElapsedMs=53001;j.boundedSearchRechecks[0].maxObservedElapsedMs=6001;}],
  ['Tracked keys unreleased',j=>j.boundedSearchRechecks[0].releasedAllTrackedKeys=false],
  ['Runtime reported error',j=>j.boundedSearchRechecks[0].errors.push('probe failure')],
]){const j=fixture();mutate(j);const result=invoke(j);assert.equal(result.accepted,true);assert(result.problems.length);checks.push({name,status:'correctly-invalid-retained',result});}
const findings=[];
for(const [id,name,mutate] of [
  ['QA-P16-01a','Nonexistent/unobserved target',j=>j.boundedSearchRechecks[0].targetId='never-observed-node'],
  ['QA-P16-01b','No refusal in current journey',j=>j.searches=[]],
  ['QA-P16-01c','Action before the actual refusal',j=>{j.boundedSearchRechecks[0].startedElapsedMs=1000;j.boundedSearchRechecks[0].endedElapsedMs=2000;}],
  ['QA-P16-02','Missing action status',j=>delete j.boundedSearchRechecks[0].status],
]){const j=fixture();mutate(j);const result=invoke(j);assert.deepEqual(result,{accepted:true,problems:[]});
  findings.push({id,name,severity:'medium',type:'evidence-contract-gap',result,action:j.boundedSearchRechecks[0],
    currentJourneySearches:j.searches.map(row=>({targetId:row.id,elapsedMs:row.elapsedMs,decision:row.searchDecision}))});}
const report={schemaVersion:1,status:'changes-required-before-candidate-approval',createdAt:new Date().toISOString(),reviewer:'i12_qa',
  authority:'Root policy16 scope: one reapproach only after visible-opponent-too-close, for the same already observed target; preserve original inputs and evidence.',
  source:{path:source,sha256:sha(source),originalPath:'tools/qa/r100-i12-controller-supplement.mjs'},
  originalReport:{path:originalPath,sha256:sha(originalPath)},checks,findings,
  recommendation:'Link each record to an explicit search index/trigger time and the same uncollected non-entry target; require a recognized status. Reject missing or prior-to-trigger records. Keep original failure and bounded deadline evidence separately.',
  limitations:['This tests only the helper predicate on synthetic metadata carrying an actual original journey','No policy16 controller, wrapper or protocol has yet been approved by this reviewer','No Chrome, game input or qualification claim','Reviewed source bytes are preserved because root may fix the live helper concurrently'],
  harness:{path:`${base}/audit-policy16-supplement-guards.mjs`,sha256:sha(`${base}/audit-policy16-supplement-guards.mjs`)}};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,checks:checks.length,findings:findings.map(row=>({id:row.id,name:row.name})),output,sha256:sha(output)}));
