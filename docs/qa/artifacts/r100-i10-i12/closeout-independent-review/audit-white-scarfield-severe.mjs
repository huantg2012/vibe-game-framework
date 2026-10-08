/** Read-only rule assessment of the two original severe journeys; no controller execution. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectI09SearchReceipts} from '../../../../../tools/qa/r100-i09-search-receipts.mjs';

const base='docs/qa/artifacts/r100-i10-i12';
const batchFolder=`${base}/b13-network-recheck/original005-006/play`;
const out=`${base}/closeout-independent-review/white-scarfield-severe-rule-assessment.json`;
assert(!fs.existsSync(out));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs=new Map();
function read(file,expected){const raw=fs.readFileSync(file),sha256=digest(raw);if(expected)assert.equal(sha256,expected,file);inputs.set(file,{path:file,sha256});return JSON.parse(raw);}
function exactFile(file,expected){const raw=fs.readFileSync(file),sha256=digest(raw);assert.equal(sha256,expected,file);inputs.set(file,{path:file,sha256});}
const frozen=read(`${base}/qualification-plan.json`,'d493aeb9d26b4758c90434c8c5a8cdfb74fb581800a2c37a50ae3b2eb91f0c25');
const policy=read(`${batchFolder}/policy-freeze.json`),batch=read(`${batchFolder}/batch-report.json`);
const originalPolicy=read(`${base}/b13-current-qualified/play/policy-freeze.json`);
assert.equal(batch.status,'completed-fixed-attempts-pending-review');
for(const key of ['manifest','manifestSha256','storageSource','storageSourceSha256','harnessSha256','wrapperSha256','controllerPolicyRevision','algorithmRevision','actualPickupLimit'])assert.deepEqual(policy[key],originalPolicy[key],key);
assert.deepEqual(policy.dependencies,originalPolicy.dependencies);
read(policy.manifest,policy.manifestSha256);
exactFile(`${batchFolder}/journey-source.mjs`,policy.harnessSha256);
exactFile(`${batchFolder}/coverage-source.mjs`,policy.wrapperSha256);
for(const row of [...policy.dependencies,...policy.wrapperDependencies])exactFile(row.file,row.sha256);
const originalStorage=read(policy.storageSource,policy.storageSourceSha256),isolatedStorage=read(policy.storage,policy.storageSha256);
assert.equal(originalStorage.origins.length,1);assert.equal(isolatedStorage.origins.length,1);
isolatedStorage.origins[0].origin=originalStorage.origins[0].origin;assert.deepEqual(isolatedStorage,originalStorage);
assert.equal(policy.algorithmRevision,6);assert.equal(policy.controllerPolicyRevision,15);
assert.deepEqual(policy.cases.map(row=>row.seed),frozen.actualPlay.seeds);
const rows=[];
for(const attempt of batch.attempts){
  const folder=`${batchFolder}/${attempt.dir}`,file=`${folder}/report.json`,report=read(file),j=report.realJourneyAttempts[0];
  assert.equal(report.realJourneyAttempts.length,1);assert.equal(report.policyRevision,15);
  assert.equal(report.harnessSha256,policy.harnessSha256);assert.deepEqual(report.harnessDependencies,policy.dependencies);
  assert.equal(report.controlledBuild,null);assert.equal(report.fixedDefectIdentity,null);assert.equal(report.controlledWorld,'white-scarfield');
  assert.equal(j.identity.generation.package.id,'r100-white-scarfield');assert.equal(j.identity.generation.package.grade,'severe');
  assert.equal(j.identity.generation.package.algorithmRevision,6);assert.equal(j.identity.generation.requestedSeed,attempt.seed);
  const before=read(`${folder}/severe/1-before.save.json`),entry=read(`${folder}/severe/1-entry.save.json`),returned=read(`${folder}/severe/1-returned.save.json`);
  assert.deepEqual(before,j.before.state);assert.deepEqual(entry,j.entrySave.state);assert.deepEqual(returned,j.afterReturn.state);
  const beforeRun=entry.inventory.run,afterRun=returned.inventory.run;
  const settled=Boolean(beforeRun.id&&beforeRun.status==='active'&&afterRun.id===beforeRun.id&&afterRun.status==='settled'&&afterRun.baseSettled&&afterRun.outcome===j.outcome);
  const independentTransitions=j.fieldResult.nodes.filter(node=>node.collected===true&&j.entryState.nodes.find(start=>start.id===node.id)?.collected===false);
  const measuredTransitions=independentTransitions.map(node=>({id:node.id,kind:node.kind,distanceFromEntry:Math.hypot(node.pos.x-j.entryState.pos.x,node.pos.y-j.entryState.pos.y)}));
  const helper=collectI09SearchReceipts(j);assert.deepEqual(helper,[]);assert.deepEqual(independentTransitions,[]);
  const problems=[...(j.errors??[]),...(j.consoleErrors??[])];if(j.navigationWarning)problems.push(j.navigationWarning);if(j.failure)problems.push(j.failure);
  const processComplete=attempt.exitCode===0&&j.status==='completed-real-input'&&settled&&['extract','death'].includes(j.outcome)&&j.fieldResult.elapsedMs>=10000&&problems.length===0;
  const searchAndExtract=processComplete&&j.outcome==='extract'&&measuredTransitions.some(row=>row.distanceFromEntry>frozen.actualPlay.nonEntryDistanceExclusive);
  rows.push({originalIndex:attempt.seed===20261005?5:6,seed:attempt.seed,report:inputs.get(file),status:j.status,processComplete,searchAndExtract,
    outcome:j.outcome,elapsedMs:j.fieldResult.elapsedMs,hp:j.fieldResult.hp,chaos:j.fieldResult.chaos,carried:j.fieldResult.carried,
    actualPickups:helper.length,nonEntryPickups:measuredTransitions.filter(row=>row.distanceFromEntry>320).length,
    independentEntryToTerminalTransitions:measuredTransitions,
    observedSearchDecisions:j.searches.map(row=>({nodeId:row.id,collected:row.collected,...row.searchDecision})),
    sameRunSettlement:{runId:beforeRun.id,baseSettled:afterRun.baseSettled,status:afterRun.status,outcome:afterRun.outcome},
    identity:{signature:j.identity.signature,fullIdentitySha256:digest(JSON.stringify(j.identity)),fullGenerationSha256:digest(JSON.stringify(j.identity.generation)),
      beforeStateSha256:digest(JSON.stringify(before)),entryPosition:j.entryState.pos},problems});
}
assert.equal(rows.length,2);assert(rows.every(row=>row.processComplete));assert(rows.every(row=>!row.searchAndExtract));
const report={schemaVersion:1,status:'qualification-failed-no-nonentry-extraction',createdAt:new Date().toISOString(),reviewer:'i12_qa',featureIds:['COH-F052','COH-F013'],
  world:'white-scarfield',grade:'severe',rule:frozen.actualPlay.requirement,source:{path:policy.manifest,sha256:policy.manifestSha256},
  originalPolicy:inputs.get(`${base}/b13-current-qualified/play/policy-freeze.json`),currentPolicy:inputs.get(`${batchFolder}/policy-freeze.json`),
  decisions:{bothOriginalProcessesComplete:true,atLeastOneNonEntrySettledExtraction:false,qualifiedGradePair:false,
    deathCount:1,genuineEmptyReturnCount:1,actualPickupCount:0,originalFailurePreserved:true,originalPolicyAndEarnedStorageUnchanged:true},
  attempts:rows,
  interpretation:'Two valid pressure outcomes remain original evidence, but neither is a successful non-entry search. completed-script, completed-real-input and exitCode0 only show completion; they cannot close this grade-pair gate. The report establishes the gate failure, not a product/AI/navigation root cause.',
  recheckRequirements:[
    'Diagnose and separately review a concrete defect before any repair recheck. Do not rerun repeatedly for a favorable outcome.',
    'Append in a fresh directory; preserve both original reports, inputs, death/empty return, costs, source and controller byte identities.',
    'Keep world white-scarfield, grade severe, the relevant original seed, full saved generation recipe and signature, earned-storage contents, loadout/resources/budgets. Merely matching world/seed labels is insufficient.',
    'For a controller repair, bind old/new harness and dependency hashes, exact intended behavior delta, root disposition and affected coverage. A changed controller must not be called byte-identical policy or silently replace its frozen derivation.',
    'For product or authored-map repair that changes generation, invalidate affected qualifications and record a new source/recipe identity with its actual required regression. Do not claim full-identity conservation when the content changed.',
    'At least one original seed must actually produce an uncollected→collected non-entry node at distance strictly greater than320px and extract; reconcile the node with same-run settled kindling or inventory receipts. Do not lower the bound or reinterpret near-entry/empty/death as pickup success.',
    'Recompute final raw accounting with original and supplementary attempts retained. The original death and empty return remain outcomes even if a later repaired execution passes.',
  ],
  limitations:['No browser launched; no route replay or game execution','No visual/audio/physics-root-cause judgment','No supplemental attempt authorized or scheduled by this report','No changes to the frozen plan, original reports, product or ledger'],
  inputs:[...inputs.values()],tools:[...['tools/qa/r100-play-qualification.mjs','tools/qa/r100-i09-search-receipts.mjs','tools/qa/r100-observed-searches.mjs',`${base}/closeout-independent-review/audit-white-scarfield-severe.mjs`].map(file=>({path:file,sha256:digest(fs.readFileSync(file))}))]};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,decisions:report.decisions,attempts:rows.map(({seed,outcome,elapsedMs,hp,chaos,actualPickups})=>({seed,outcome,elapsedMs,hp,chaos,actualPickups})),report:{path:out,sha256:digest(fs.readFileSync(out))}},null,2));
