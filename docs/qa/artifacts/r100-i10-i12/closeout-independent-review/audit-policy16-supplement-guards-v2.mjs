/** Independent fresh review of corrected trigger/target/action guards. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateSupplementJourney} from './controller-supplement-reviewed-e1c9b33dcfd4.mjs';
const base='docs/qa/artifacts/r100-i10-i12/closeout-independent-review';
const output=`${base}/policy16-supplement-guard-review-v2.json`;
assert(!fs.existsSync(output));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source=`${base}/controller-supplement-reviewed-e1c9b33dcfd4.mjs`;
assert.equal(sha(source),'e1c9b33dcfd43e0f1714b339f10051fbf1861f07ad37abac11ac8ddd529c45a8');
const originalPath='docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original005-006/play/001-white-scarfield-severe-20261005/report.json';
const original=JSON.parse(fs.readFileSync(originalPath)).realJourneyAttempts[0];
const attempt={world:'white-scarfield',grade:'severe',seed:20261005};
const binding={actualPickupLimit:1,protocol:{limits:{maxRechecksPerJourney:1,maxRecheckElapsedMs:6000,maxActualPickups:3,minimumNonEntryDistance:320}},
  originals:new Map([['white-scarfield/severe/20261005',original]])};
const fixture=()=>{
  const journey=structuredClone(original);
  journey.boundedSearchRechecks=[{targetId:'r100-kindling-deep-1',reason:'visible-opponent-too-close',
    startedElapsedMs:47000,endedElapsedMs:48000,status:'completed',errors:[],withinTimeBound:true,
    originalSearchIndex:0,triggerElapsedMs:journey.searches[0].elapsedMs,
    releasedAllTrackedKeys:true,maxObservedElapsedMs:1000}];
  return journey;
};
const invoke=(journey,pickups=[])=>{try{return {accepted:true,problems:validateSupplementJourney(binding,attempt,journey,pickups)};}
  catch(error){return {accepted:false,error:error.message};}};
const checks=[];
for(const [name,mutate] of [
  ['Same original identity/save and actual refusal before one bounded action',()=>{}],
  ['No supplemental action when the controller did not use its allowance',j=>j.boundedSearchRechecks=[]],
  ['Exact 6000ms with released keys is within the explicit bound',j=>{Object.assign(j.boundedSearchRechecks[0],{status:'game-time-budget',endedElapsedMs:53000,maxObservedElapsedMs:6000});}],
]){const j=fixture();mutate(j);const result=invoke(j);assert.deepEqual(result,{accepted:true,problems:[]});checks.push({name,status:'accepted',result});}
for(const [name,mutate] of [
  ['QA-P16-01a nonexistent/unobserved target',j=>j.boundedSearchRechecks[0].targetId='never-observed-node'],
  ['QA-P16-01b no refusal in current journey',j=>j.searches=[]],
  ['QA-P16-01c action before triggering refusal',j=>{j.boundedSearchRechecks[0].startedElapsedMs=1000;j.boundedSearchRechecks[0].endedElapsedMs=2000;}],
  ['QA-P16-02 missing status',j=>delete j.boundedSearchRechecks[0].status],
  ['Unknown status',j=>j.boundedSearchRechecks[0].status='arbitrary'],
  ['Trigger index outside actual search rows',j=>j.boundedSearchRechecks[0].originalSearchIndex=8],
  ['Trigger timestamp altered',j=>j.boundedSearchRechecks[0].triggerElapsedMs-=1],
  ['Later refusal cannot stand in for the first',j=>{j.searches.unshift({...j.searches[0],elapsedMs:j.searches[0].elapsedMs-1000});j.boundedSearchRechecks[0].originalSearchIndex=1;}],
  ['Exactly320px remains ineligible',j=>{const n=j.entryState.nodes.find(n=>n.id==='r100-kindling-deep-1');n.pos={x:j.entryState.pos.x+320,y:j.entryState.pos.y};}],
  ['Already collected entry target',j=>j.entryState.nodes.find(n=>n.id==='r100-kindling-deep-1').collected=true],
  ['Action beyond terminal time',j=>j.boundedSearchRechecks[0].endedElapsedMs=j.fieldResult.elapsedMs+1],
  ['Changed full generation identity',j=>j.identity.generation.package.dependencyHash='changed'],
  ['Changed earned starting save',j=>j.before.state.kindlingReserve+=1],
  ['Second supplemental action',j=>j.boundedSearchRechecks.push({...j.boundedSearchRechecks[0]})],
]){const j=fixture();mutate(j);const result=invoke(j);assert.equal(result.accepted,false);checks.push({name,status:'rejected',result});}
for(const [name,mutate] of [
  ['6000.001ms overrun remains invalid',j=>{Object.assign(j.boundedSearchRechecks[0],{endedElapsedMs:53000.001,maxObservedElapsedMs:6000.001});}],
  ['Observed maximum overrides shorter claimed end',j=>j.boundedSearchRechecks[0].maxObservedElapsedMs=6001],
  ['Tracked keys remain held',j=>j.boundedSearchRechecks[0].releasedAllTrackedKeys=false],
  ['Runtime caught an action error',j=>j.boundedSearchRechecks[0].errors.push('probe')],
  ['Failed action status',j=>j.boundedSearchRechecks[0].status='failed'],
  ['Unproven time bound',j=>j.boundedSearchRechecks[0].withinTimeBound=false],
]){const j=fixture();mutate(j);const result=invoke(j);assert(result.accepted&&result.problems.length);checks.push({name,status:'invalid-retained',result});}
assert.equal(invoke(fixture(),[{},{}]).accepted,false);
checks.push({name:'Two actual pickups exceed original limit1 despite general cap3',status:'rejected'});
const report={schemaVersion:1,status:'pass-for-helper-predicate-scope-only',createdAt:new Date().toISOString(),reviewer:'i12_qa',
  source:{path:source,sha256:sha(source),originalPath:'tools/qa/r100-i12-controller-supplement.mjs'},
  originalReport:{path:originalPath,sha256:sha(originalPath)},
  supersedes:{path:`${base}/policy16-supplement-guard-review-v1.json`,sha256:sha(`${base}/policy16-supplement-guard-review-v1.json`),findingDisposition:'QA-P16-01a/b/c and QA-P16-02 rejected by fresh source'},
  checks,limitations:['Synthetic evidence-contract tests only; no policy16 gameplay or approval','Actual deadline enforcement inside all nested controller inputs still requires candidate review','Whole supplemental scheduler/summary linkage is separate from this leaf-helper receipt','Original failures and the first failed helper review remain untouched'],
  harness:{path:`${base}/audit-policy16-supplement-guards-v2.mjs`,sha256:sha(`${base}/audit-policy16-supplement-guards-v2.mjs`)}};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,checks:checks.length,output,sha256:sha(output)}));
