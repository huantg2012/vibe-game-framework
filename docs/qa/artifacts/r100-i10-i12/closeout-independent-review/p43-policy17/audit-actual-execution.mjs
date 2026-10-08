import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateFacingControllerSupplement,validateFacingSupplementJourney} from '../../../../../../tools/qa/r100-i12-facing-supplement.mjs';
import {collectI09SearchReceipts} from '../../../../../../tools/qa/r100-i09-search-receipts.mjs';
import {isWorkerObservationFailure} from '../../../../../../tools/qa/r100-worker-observer.mjs';
const own=path.dirname(fileURLToPath(import.meta.url));
const base='docs/qa/artifacts/r100-i10-i12/p43-policy17-recheck',folder=base+'/play';
const read=file=>JSON.parse(fs.readFileSync(file)),sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({path:file,sha256:sha(file)}),jsonl=file=>fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const policy=read(folder+'/policy-freeze.json'),batch=read(folder+'/batch-report.json'),execution=read(base+'/execution.json');
const protocol=read(policy.controllerSupplement.path);
assert.equal(sha(policy.controllerSupplement.path),policy.controllerSupplement.sha256);
assert.equal(policy.controllerSupplement.sha256,'d88c904ce2c95d2c0be396016fda6f7db1ed82788781a90b6ab98792feb72ce6');
assert.equal(execution.exitCode,0);assert.equal(batch.status,'completed-fixed-attempts-pending-review');
for(const [file,expected]of Object.entries(execution.preflightHashes))assert.equal(sha(file),expected,`Preflight input changed: ${file}`);
for(const dependency of [...policy.dependencies,...policy.wrapperDependencies])assert.equal(sha(dependency.file),dependency.sha256);
const summaryPlan={controllerSupplements:[policy.controllerSupplement],batches:[folder,...new Set(protocol.cases.map(row=>path.dirname(path.dirname(row.originalReport.path))))]};
const binding=validateFacingControllerSupplement(policy.controllerSupplement,policy,batch,summaryPlan,file=>fs.readFileSync(file));
const source=read(protocol.source.path);assert.deepEqual(source.patches,[]);assert.equal(source.verifiedCopyHashes,true);
for(const [file,expected]of Object.entries(source.sources))assert.equal(sha(path.join(source.temporaryRoot,file)),expected,`Executed frozen source changed: ${file}`);
const originalStorage=read(policy.storageSource),mapped=read(policy.storage);originalStorage.origins[0].origin=new URL(policy.gameUrl).origin;
assert.deepEqual(mapped,originalStorage);assert.equal(sha(policy.storage),policy.storageSha256);
const rows=[];
for(const attempt of batch.attempts){
  const reportFile=`${folder}/${attempt.dir}/report.json`,report=read(reportFile),logFile=`${folder}/${attempt.dir}/${attempt.grade}/journey.jsonl`,log=jsonl(logFile);
  assert.equal(report.realJourneyAttempts.length,1);const j=report.realJourneyAttempts[0];
  assert.equal(attempt.exitCode,0);assert.equal(report.policyRevision,17);assert.equal(j.status,'completed-real-input');
  assert.equal(report.harnessSha256,policy.harnessSha256);assert.deepEqual(report.harnessDependencies,policy.dependencies);
  assert.equal(report.controlledBuild,null);assert.equal(report.fixedDefectIdentity,null);assert.equal(report.controlledWorld,'ochre-folds');
  assert.deepEqual(j.errors,[]);assert.deepEqual(j.consoleErrors,[]);assert(!j.failure);assert(!j.navigationWarning);
  const actual=collectI09SearchReceipts(j);assert.deepEqual(validateFacingSupplementJourney(binding,attempt,j,actual,log),[]);
  const originalCase=protocol.cases.find(r=>r.seed===attempt.seed),original=read(originalCase.originalReport.path).realJourneyAttempts[0];
  assert.equal(sha(originalCase.originalReport.path),originalCase.originalReport.sha256);assert.equal(original.outcome,'death');
  assert(original.fieldResult.nodes.every(n=>!n.collected));assert.deepEqual(j.identity,original.identity);assert.deepEqual(j.before,original.before);
  const initial=new Map(j.entryState.nodes.map(n=>[n.id,n]));
  const changed=j.fieldResult.nodes.filter(n=>n.collected&&initial.get(n.id)?.collected===false);
  assert.equal(changed.length,1);assert.equal(actual.length,1);assert.equal(actual[0].id,changed[0].id);
  const distance=Math.hypot(changed[0].pos.x-j.entryState.pos.x,changed[0].pos.y-j.entryState.pos.y);assert(distance>320);
  assert.equal(j.outcome,'extract');assert.equal(j.fieldResult.ended,true);assert(j.fieldResult.elapsedMs>=10000);
  const beforeRun=j.entrySave.state.inventory.run,afterRun=j.afterReturn.state.inventory.run;
  assert.equal(beforeRun.status,'active');assert.equal(afterRun.id,beforeRun.id);assert.equal(afterRun.status,'settled');
  assert.equal(afterRun.outcome,'extract');assert.equal(afterRun.baseSettled,true);
  assert(j.fieldResult.carried>0);assert.equal(afterRun.kindlingGained,j.fieldResult.carried);
  assert.equal(j.afterReturn.state.kindlingReserve-j.before.state.kindlingReserve,afterRun.kindlingGained);
  const geometries=j.facingChecks.flatMap(r=>[...r.segments.map(s=>s.before),...(r.finalCheck?[r.finalCheck]:[])]);
  let observedGeometryBindings=0;
  for(const g of geometries){
    const observation=log.find(row=>row.event==='visible-encounter-observation'&&row.elapsedMs===g.observedElapsedMs
      &&row.facing===g.player.facing&&row.position.x===g.player.pos.x&&row.position.y===g.player.pos.y);
    assert(observation,'A real raw visible observation must support every recorded geometry');
    assert.equal(observation.hp,g.hp);assert.equal(observation.chaos,g.chaos);assert.equal(observation.ended,g.ended);
    const enemy=observation.enemies.find(e=>e.id===g.targetId);
    if(g.visible){assert(enemy);assert.deepEqual(enemy.position,g.enemy.pos);assert.equal(enemy.attack,g.enemy.attack);}
    else assert(!enemy);
    observedGeometryBindings++;
  }
  const allowed=j.facingChecks.filter(r=>r.status==='allowed'),abandoned=j.facingChecks.filter(r=>r.status==='abandoned');
  assert(j.facingChecks.every(r=>r.status!=='failed'&&r.errors.length===0&&r.releasedAllTrackedKeys));
  rows.push({seed:attempt.seed,report:ref(reportFile),inputLog:ref(logFile),originalReport:originalCase.originalReport,
    originalOutcomePreserved:original.outcome,fullIdentityExact:true,earnedBeforeExact:true,outcome:j.outcome,fieldElapsedMs:j.fieldResult.elapsedMs,
    terminalNodeChanges:changed.map(n=>({id:n.id,kind:n.kind,from:false,to:true,distanceFromEntry:distance})),actualPickupCount:actual.length,
    runId:afterRun.id,sameRunSettled:true,kindlingCarried:j.fieldResult.carried,kindlingGained:afterRun.kindlingGained,
    kindlingBefore:j.before.state.kindlingReserve,kindlingAfter:j.afterReturn.state.kindlingReserve,
    facing:{count:j.facingChecks.length,allowed:allowed.length,abandoned:abandoned.map(r=>({index:r.index,reason:r.reason,phase:r.finalCheck?.enemy?.attack,elapsedMs:r.elapsedMs})),
      actualSpaceEvents:log.filter(r=>r.event==='key'&&r.key==='Space').length,observedGeometryBindings,
      maximumWholeElapsedMs:Math.max(...j.facingChecks.map(r=>r.maxObservedElapsedMs)),maximumRequestedTurnMs:Math.max(...j.facingChecks.map(r=>r.turnInputMs)),
      finalAllowedAngles:allowed.map(r=>r.finalCheck.errorDegrees),finalAllowedDistances:allowed.map(r=>r.finalCheck.distance)}});
}
const observations=[];let contexts=0;
for(const name of fs.readdirSync(base+'/worker-observations').filter(n=>n.endsWith('.jsonl')).sort()){
  const file=base+'/worker-observations/'+name,log=jsonl(file);assert.deepEqual(log.filter(isWorkerObservationFailure),[]);
  if(log.some(r=>r.event==='launch')){
    contexts++;for(const event of['launch','browser-ready','context-created','context-closed','browser-disconnected'])assert.equal(log.filter(r=>r.event===event).length,1);
    const created=log.filter(r=>r.event==='worker-created').map(r=>r.workerId).sort();assert(created.length>0);
    assert.deepEqual(created,log.filter(r=>r.event==='worker-closed').map(r=>r.workerId).sort());
    const networks=log.filter(r=>r.event==='network-summary'&&r.reason==='context-closed');assert.equal(networks.length,1);assert.deepEqual(networks[0].pending,[]);
  }observations.push(ref(file));
}
assert.equal(contexts,2);
const result={schema:'coh.qa.policy17-actual-execution-independent.v1',status:'pass-bounded-two-original-seed-processes',
  scope:'P43 ochre-folds severe supplementary policy17 on the two original seeds only; original deaths remain immutable failed attempts.',
  protocol:ref(policy.controllerSupplement.path),execution:ref(base+'/execution.json'),policy:ref(folder+'/policy-freeze.json'),batch:ref(folder+'/batch-report.json'),
  inputGuard:ref('tools/qa/r100-i12-facing-supplement.mjs'),frozenSource:protocol.source,frozenSourceFilesRehashed:Object.keys(source.sources).length,
  storageExactExceptOrigin:true,originalFailuresRetained:true,actualOriginalSeeds:rows.map(r=>r.seed),bothProcessesCompleted:true,bothNonEntrySearchAndExtract:true,
  rows,workerObservation:{status:'pass',contexts,files:observations},
  limitations:['No enemy HP or contact-frame hit proof was logged; this receipt makes no hit or causal success-rate claim.','Controlled same-source/save/world/seeds; no natural48, final108, visual, audio, performance or overall I10-I12 acceptance.','Main aggregate summary must still count both original failed reports and these two approved supplemental reports.']};
const output=path.join(own,'actual-execution-review.json');fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(output),status:result.status,sourceFiles:result.frozenSourceFilesRehashed,rows:rows.map(r=>({seed:r.seed,outcome:r.outcome,pickups:r.actualPickupCount,space:r.facing.actualSpaceEvents,geometryBindings:r.facing.observedGeometryBindings}))}));
