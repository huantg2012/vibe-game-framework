import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateFacingControllerSupplement} from '../../../../../../tools/qa/r100-i12-facing-supplement.mjs';
const own=path.dirname(fileURLToPath(import.meta.url));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({path:file,sha256:sha(file)}),read=file=>JSON.parse(fs.readFileSync(file)),copy=value=>structuredClone(value);
const candidateFile='docs/qa/artifacts/r100-i10-i12/p43-policy17-preparation/candidate-v2.json';
assert.equal(sha(candidateFile),'7b84d3bbdc8cbe89f1066eabd30aafa2086e9e88b5c9cc4c9665aef46b2fde33');
const candidate=read(candidateFile),verified=new Map();
function verifyReferences(value){
  if(!value||typeof value!=='object')return;
  const file=value.path??value.file;
  if(typeof file==='string'&&typeof value.sha256==='string'){
    assert.equal(sha(file),value.sha256,`Reference changed: ${file}`);verified.set(file,value.sha256);
  }
  for(const child of Object.values(value))verifyReferences(child);
}
verifyReferences(candidate);
const protocol=read(candidate.protocolCandidate.path);verifyReferences(protocol);
const archive=read(candidate.sourceArchive.path),archived=[];
for(const item of archive.files){assert.equal(sha(item.copy),item.source.sha256);assert.equal(sha(item.source.path),item.source.sha256);
  archived.push({source:item.source,copy:item.copy});}
const prior=read(candidate.previousCandidate.path),unchanged=[];
for(const item of candidate.files){if(item.path.endsWith('/r100-i12-turn-coverage.mjs'))continue;
  assert.equal(prior.files.find(row=>row.path===item.path)?.sha256,item.sha256);unchanged.push(item);}
assert.equal(unchanged.length,4);
const code=fs.readFileSync('tools/qa/r100-i12-turn-coverage.mjs','utf8');
assert.equal((code.match(/validateFacingControllerSupplement\(/g)??[]).length,2);
assert.equal((code.match(/validateFacingSupplementJourney\(binding,row,journey,pickups,events\)/g)??[]).length,1);
assert(code.includes("path.join(folder, row.grade, 'journey.jsonl')"));
assert(!/validateControllerSupplement\(|validateSupplementJourney\(|r100-i12-controller-supplement\.mjs/.test(code));
const helper='tools/qa/r100-i12-facing-supplement.mjs';
assert.equal(sha(helper),'b21c89be8dc1e6d86a1d2d0337afaf1b641aed2891effc9d0834ec06c8f31672');
const oldPolicy=read(protocol.originalPolicy.path),checks=[];
function protocolCheck(mutateProtocol=()=>{},mutatePolicy=()=>{},mutatePlan=()=>{},mutateBatch=()=>{}){
  // Synthetic approval fields exercise metadata only. The actual candidate
  // protocol remains unsigned on disk and cannot authorize a browser run.
  const p={...copy(protocol),status:'approved-bounded-visible-facing-input',reviewer:'root'};mutateProtocol(p);
  const raw=Buffer.from(JSON.stringify(p)),reference={path:'synthetic-policy17-protocol-for-independent-test.json',sha256:createHash('sha256').update(raw).digest('hex')};
  const policy={...copy(oldPolicy),controllerPolicyRevision:17,algorithmRevision:6,
    harnessSha256:protocol.executor.sha256,wrapperSha256:protocol.wrapper.sha256,dependencies:copy(protocol.dependencies),cases:copy(protocol.cases)};
  mutatePolicy(policy);const plan={controllerSupplements:[reference],batches:[...new Set(protocol.cases.map(row=>path.dirname(path.dirname(row.originalReport.path))))]};mutatePlan(plan);
  const batch={attempts:copy(protocol.cases)};mutateBatch(batch);
  return validateFacingControllerSupplement(reference,policy,batch,plan,file=>file===reference.path?raw:fs.readFileSync(file));
}
function check(name,fn){fn();checks.push(name);}
check('candidate metadata with synthetic approval binds exact two original identities',()=>{
  const binding=protocolCheck();assert.equal(binding.originals.size,2);assert.equal(binding.actualPickupLimit,1);
  for(const row of protocol.cases){const original=read(row.originalReport.path).realJourneyAttempts[0];
    assert.deepEqual(binding.originals.get(`${row.world}/${row.grade}/${row.seed}`),original);}
});
check('actual unapproved candidate status cannot authorize execution',()=>assert.throws(()=>protocolCheck(p=>{p.status=protocol.status;p.reviewer=protocol.reviewer;})));
check('source bytes cannot change',()=>assert.throws(()=>protocolCheck(p=>p.source.sha256='0'.repeat(64))));
check('earned storage bytes cannot change',()=>assert.throws(()=>protocolCheck(p=>p.storage.sha256='0'.repeat(64))));
check('original failed report bytes cannot change',()=>assert.throws(()=>protocolCheck(p=>p.cases[0].originalReport.sha256='0'.repeat(64))));
check('the original pickup limit one cannot be increased',()=>assert.throws(()=>protocolCheck(()=>{},p=>p.actualPickupLimit=2)));
check('duplicate fixed seed cannot replace the second original seed',()=>assert.throws(()=>protocolCheck(p=>p.cases[1]=copy(p.cases[0]))));
check('world scope cannot expand to white-scarfield',()=>assert.throws(()=>protocolCheck(p=>p.cases[0].world='white-scarfield')));
check('missing original batch is rejected',()=>assert.throws(()=>protocolCheck(()=>{},()=>{},p=>p.batches=[])));
check('missing explicit summary supplement reference is rejected',()=>assert.throws(()=>protocolCheck(()=>{},()=>{},p=>p.controllerSupplements=[])));
check('one-seed execution batch is rejected',()=>assert.throws(()=>protocolCheck(()=>{},()=>{},()=>{},b=>b.attempts.pop())));
check('same seed scheduled twice is rejected',()=>assert.throws(()=>protocolCheck(()=>{},()=>{},()=>{},b=>b.attempts[1]=copy(b.attempts[0]))));
check('controller dependency bytes cannot change',()=>assert.throws(()=>protocolCheck(p=>p.dependencies[0].sha256='0'.repeat(64))));
check('executor or wrapper identity cannot change',()=>{
  assert.throws(()=>protocolCheck(p=>p.executor.sha256='0'.repeat(64)));assert.throws(()=>protocolCheck(p=>p.wrapper.sha256='0'.repeat(64)));
});
assert.equal(sha(helper),'b21c89be8dc1e6d86a1d2d0337afaf1b641aed2891effc9d0834ec06c8f31672');
const evidence=name=>ref(path.relative(process.cwd(),path.join(own,name)));
const report={schema:'coh.qa.policy17-candidate-independent-review.v2',status:'pass-pre-execution-independent-review',
  candidate:ref(candidateFile),scope:'Only root approval readiness for two original ochre-folds severe supplemental executions. No game was run by this review.',
  verifiedReferenceCount:verified.size,verifiedReferences:[...verified].map(([path,sha256])=>({path,sha256})),archivalVerification:{status:'pass',exactCopies:archived.length,files:archived},
  inheritedUnchangedCode:unchanged,
  boundaryReview:{evidence:evidence('boundary-review.json'),checks:22,status:'pass',inheritedBecause:'Alignment, encounter integration, journey and boundary-test files are byte-identical to reviewed V1.'},
  wrapperReview:{status:'pass',evidence:evidence('wrapper-v2-protection-review.json'),fixed:'V1 wrong-validator defect repaired: all three calls use policy17, its dependency is frozen, and actual case/grade JSONL events are passed.',
    originalFailedCandidate:evidence('candidate-v1-review.json')},
  qualificationGuard:{status:'pass',implementation:ref(helper),evidence:evidence('guard-review-v2.json'),checks:18,
    originalGaps:evidence('guard-review-v1.json')},
  protocolChecks:{status:'pass',count:checks.length,checks,scope:'Synthetic metadata only; approval fields set only in memory for positive test, on-disk candidate remains unapproved.'},
  staticFindings:{newDirectionInputSites:2,sameVisibleTargetOnly:true,hiddenAiReadAdded:false,newSearchRetryAdded:false,originalOnePickupLimitRetained:true,
    originalBeforeAndCompleteIdentityRequired:true,sourceAndStorageExact:true,pursuer550msOpportunityGateRetained:true,corneredHasNoNew550msGate:true,
    inputSemantics:'At most3 issued direction-wait requests of60ms,total<=180ms. Actual dispatch/read/release time may exceed that request total; complete action/Space/cleanup<=1000ms real game clock,750ms early stop with100ms reserve.',
    rechecks:['actual facing <=25degrees after10-decimal float normalization','same target currently visible','original <=37px pursuer / <40px cornered range','not enemy windup or strike','original health,chaos,scene and return-reserve checks'],
    originalPolicy15Preserved:true,approvedPolicy16NotModifiedByV2:true},
  remaining:['Root must sign exact protocol and authorize execution before the sole browser runs.','Both original fixed seeds must actually execute once with preserved failures, source, save and identity.','Only original qualification rules can close P43: at least one actual non-entry pickup and settled extraction, with both processes accounted.'],
  limitations:['Mock rotation does not establish hit rate, enemy damage or game success.','The1000ms deadline is verified from actual game-clock readings and late cleanup invalidates evidence; no claim of hard real-time CDP scheduling.','This is no substitute for final enabled108 browser/compatibility/performance/visual or natural48 acceptance.']};
const output=path.join(own,'candidate-v2-review.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(output),status:report.status,verifiedReferences:verified.size,exactArchiveCopies:archived.length,protocolChecks:checks.length}));
