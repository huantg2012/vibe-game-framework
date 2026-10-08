// Read-only postprocessing of the two actual policy17 attempts. No browser or input.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isWorkerObservationFailure} from '../../../../../tools/qa/r100-worker-observer.mjs';
import {collectI09SearchReceipts} from '../../../../../tools/qa/r100-i09-search-receipts.mjs';

const base='docs/qa/artifacts/r100-i10-i12/p43-policy17-recheck';
const protocolFile='docs/qa/artifacts/r100-i10-i12/p43-policy17-preparation/approved-protocol.json';
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const events=file=>fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const protocol=read(protocolFile),policy=read(path.join(base,'play/policy-freeze.json'));
const batch=read(path.join(base,'play/batch-report.json')),execution=read(path.join(base,'execution.json'));
assert.equal(protocol.policyRevision,17);
assert.equal(policy.controllerSupplement.sha256,ref(protocolFile).sha256);
const problems=[],rows=[];
const check=(label,fn)=>{try{fn();return true;}catch(error){problems.push({label,error:String(error.stack??error)});return false;}};
check('All original fixed cases completed',()=>{assert.equal(execution.exitCode,0);assert.equal(batch.attempts.length,2);});
for(const attempt of batch.attempts){
  const originalCase=protocol.cases.find(row=>row.world===attempt.world&&row.grade===attempt.grade&&row.seed===attempt.seed);
  assert(originalCase,'Actual case must exist in the approved original scope');
  const reportFile=path.join(base,'play',attempt.dir,'report.json');
  if(!fs.existsSync(reportFile)){problems.push({label:attempt.dir,error:'Missing actual report'});continue;}
  const report=read(reportFile),journey=report.realJourneyAttempts[0],original=read(originalCase.originalReport.path).realJourneyAttempts[0];
  const checks={
    originalFailureRetained:check(`${attempt.dir}: original report hash`,()=>assert.equal(ref(originalCase.originalReport.path).sha256,originalCase.originalReport.sha256)),
    fullIdentityExact:check(`${attempt.dir}: complete identity`,()=>assert.deepEqual(journey.identity,original.identity)),
    beforeSaveExact:check(`${attempt.dir}: before save`,()=>assert.deepEqual(journey.before,original.before)),
    harnessAndDependenciesExact:check(`${attempt.dir}: harness`,()=>{assert.equal(report.policyRevision,17);assert.equal(report.harnessSha256,policy.harnessSha256);assert.deepEqual(report.harnessDependencies,policy.dependencies);}),
    completedCleanly:check(`${attempt.dir}: runtime`,()=>{assert.equal(attempt.exitCode,0);assert.equal(journey.status,'completed-real-input');assert.deepEqual(journey.errors,[]);assert.deepEqual(journey.consoleErrors,[]);assert(!journey.failure);assert(!journey.navigationWarning);assert(!attempt.journeys.some(row=>row.accountingError));}),
    sameRunSettled:check(`${attempt.dir}: settlement`,()=>{assert.equal(journey.entrySave.state.inventory.run.id,journey.afterReturn.state.inventory.run.id);assert.equal(journey.afterReturn.state.inventory.run.baseSettled,true);}),
  };
  let pickups=[];check(`${attempt.dir}: actual pickups`,()=>{pickups=collectI09SearchReceipts(journey);assert(pickups.length<=1);});
  const logFile=path.join(base,'play',attempt.dir,attempt.grade,'journey.jsonl'),log=events(logFile),facing=journey.facingChecks;
  checks.facingReportMatchesOriginalLog=check(`${attempt.dir}: facing log`,()=>assert.deepEqual(log.filter(row=>row.event==='bounded-melee-facing-check').map(({at,event,...record})=>record),facing));
  checks.everySpaceHasFacingRecord=check(`${attempt.dir}: actual Space`,()=>assert.equal(log.filter(row=>row.event==='key'&&row.key==='Space').length,facing.filter(row=>row.spaceInput?.issued).length));
  const nonEntry=pickups.filter(row=>row.eligibleNonEntry);
  rows.push({case:originalCase,report:ref(reportFile),inputLog:ref(logFile),checks,outcome:journey.outcome,actualPickups:pickups,
    nonEntryExtraction:journey.outcome==='extract'&&nonEntry.length>0&&checks.sameRunSettled,
    fieldElapsedMs:journey.fieldResult?.elapsedMs,hp:journey.fieldResult?.hp,chaos:journey.fieldResult?.chaos,
    facingChecks:{count:facing.length,allowed:facing.filter(row=>row.status==='allowed').length,abandoned:facing.filter(row=>row.status==='abandoned').length,failed:facing.filter(row=>row.status==='failed').length,
      issuedSpace:facing.filter(row=>row.spaceInput?.issued).length,maximumWholeElapsedMs:Math.max(0,...facing.map(row=>row.maxObservedElapsedMs))}});
}
const earnedStorageExactExceptOrigin=check('Earned storage changed only origin',()=>{
  const original=read(policy.storageSource),mapped=read(policy.storage);
  assert.equal(original.origins.length,1);original.origins[0].origin=new URL(policy.gameUrl).origin;assert.deepEqual(mapped,original);
});
const observationFiles=[],contexts=[],eventCounts={},observationErrors=[];
for(const name of fs.readdirSync(path.join(base,'worker-observations')).sort()){
  if(!name.endsWith('.jsonl'))continue;
  const file=path.join(base,'worker-observations',name),log=events(file);observationFiles.push(ref(file));
  for(const row of log){eventCounts[row.event]=(eventCounts[row.event]??0)+1;if(isWorkerObservationFailure(row))observationErrors.push({...row,file});}
  if(!log.some(row=>row.event==='launch'))continue;
  const complete=check(`${name}: context lifecycle`,()=>{
    for(const event of ['launch','browser-ready','context-created','context-closed','browser-disconnected'])assert.equal(log.filter(row=>row.event===event).length,1);
    const created=log.filter(row=>row.event==='worker-created').map(row=>row.workerId).sort();
    assert(created.length>0);assert.deepEqual(created,log.filter(row=>row.event==='worker-closed').map(row=>row.workerId).sort());
    const networks=log.filter(row=>row.event==='network-summary'&&row.reason==='context-closed');assert.equal(networks.length,1);assert.deepEqual(networks[0].pending,[]);
  });
  contexts.push({file:ref(file),complete,workers:log.filter(row=>row.event==='worker-created').length,network:log.find(row=>row.event==='network-summary'&&row.reason==='context-closed')});
}
check('Two clean observer contexts',()=>{assert.equal(contexts.length,2);assert.deepEqual(observationErrors,[]);});
write(path.join(base,'worker-observation-summary.json'),{status:observationErrors.length||contexts.length!==2||contexts.some(row=>!row.complete)?'incomplete-or-failed-observation':'complete-observation',contexts,files:observationFiles,eventCounts,errors:observationErrors});
write(path.join(base,'reconciliation.json'),{status:problems.length?'technical-or-identity-problems':rows.some(row=>row.nonEntryExtraction)?'completed-with-at-least-one-nonentry-extraction':'completed-without-nonentry-extraction',
  protocol:ref(protocolFile),execution:ref(path.join(base,'execution.json')),policy:ref(path.join(base,'play/policy-freeze.json')),batch:ref(path.join(base,'play/batch-report.json')),
  observations:ref(path.join(base,'worker-observation-summary.json')),postprocessor:ref(path.relative(process.cwd(),fileURLToPath(import.meta.url))),earnedStorageExactExceptOrigin,rows,problems,
  limitations:'Two appended controlled original identities. Preserved original deaths remain failures; no hit, causal improvement, success-rate, natural48, or final production claim.'});
console.log(JSON.stringify({reconciliation:ref(path.join(base,'reconciliation.json')),observations:ref(path.join(base,'worker-observation-summary.json')),outcomes:rows.map(row=>[row.case.seed,row.outcome,row.actualPickups.length]),problems:problems.length}));
if(problems.length)process.exitCode=1;
