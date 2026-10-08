/** Independent original-failure evidence audit; does not execute a browser or retry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base='docs/qa/artifacts/r100-i10-i12',out=`${base}/closeout-independent-review/production-environment-review/review.json`;
assert(!fs.existsSync(out));
const hash=data=>createHash('sha256').update(data).digest('hex'),inputs=new Map();
const ref=file=>({path:path.relative(process.cwd(),path.resolve(file)),sha256:hash(fs.readFileSync(file))});
function bytes(item){const raw=fs.readFileSync(item.path);assert.equal(hash(raw),item.sha256,item.path);inputs.set(item.path,item);return raw;}
const read=item=>JSON.parse(bytes(item));
const diagnosisRef={path:`${base}/production-first-failure-runtime/diagnosis.json`,sha256:'ac11fbc01df424fbb45ba24afac4f7cda589cb8e2e8d0221b4c4b1b252d242e8'};
const diagnosis=read(diagnosisRef),report=read(diagnosis.originalReport),binding=read(diagnosis.sourceBinding),execution=read(diagnosis.execution);
const source=read(binding.finalSource),qualification=read(ref(`${base}/qualification-plan.json`));
assert.equal(binding.finalSource.sha256,'e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af');
assert.equal(report.status,'failed');assert.equal(binding.status,'failed');assert.equal(binding.exitCode,1);assert.equal(execution.exitCode,1);
assert.deepEqual(binding.report,diagnosis.originalReport);assert.deepEqual(execution.source,binding.finalSource);
const worlds=[...qualification.baseline.worlds,...qualification.batches.flatMap(row=>row.worlds)],grades=['low','medium','severe'];
const keys=worlds.flatMap(world=>grades.map(grade=>`${world}/${grade}`));assert.equal(keys.length,324);
assert.deepEqual(report.cases.map(row=>`${row.world}/${row.grade}`),keys.slice(0,152));
assert.equal(report.cases.length,152);assert.equal(new Set(report.cases.map(row=>`${row.world}/${row.grade}`)).size,152);
const rowIdentities=[];
for(const [index,row]of report.cases.slice(0,151).entries()){
  assert.equal(row.status,'passed');assert.deepEqual(row.errors,[]);assert(row.coldIdentityPreserved&&row.worldHistoryPreserved);
  assert.deepEqual(row.bodyGeometry,{version:1,fullBodyCheckpointAdmitted:true,coldBodyPositionPreserved:true});
  assert.deepEqual(row.historyBeforeDeparture,{version:1,visits:[]});
  assert.deepEqual(row.committedWorldHistory,{version:1,visits:[{worldId:row.world,grade:row.grade}]});
  assert.equal(row.identity.generation.package.id,`r100-${row.world}`);assert.equal(row.identity.generation.package.grade,row.grade);
  assert.equal(row.identity.generation.package.algorithmRevision,6);assert.equal(row.identity.generation.requestedSeed,row.controlledSeed);
  rowIdentities.push({ordinal:index+1,key:keys[index],controlledSeed:row.controlledSeed,identitySha256:hash(JSON.stringify(row.identity)),originalRowSha256:hash(JSON.stringify(row))});
}
const failed=report.cases[151];assert.equal(failed.status,'failed');assert.deepEqual(failed.errors,[]);
assert.equal(failed.world,'silt-colonnade');assert.equal(failed.grade,'medium');assert.equal(failed.controlledSeed,340);
assert.equal(failed.failure,'TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.');assert.equal(failed.departureMs,undefined);
const saveBytes=bytes(diagnosis.failedSave);assert.equal(saveBytes.toString(),failed.diagnostic.saved);
const save=JSON.parse(saveBytes),identity=read(diagnosis.failedIdentity);assert.deepEqual(identity,save.riftCheckpoint.identity);
assert.equal(identity.generation.requestedSeed,340);assert.equal(identity.seed,1500724393);assert.equal(identity.signature,'028dc1bf');
assert.equal(identity.generation.package.algorithmRevision,6);assert.equal(identity.generation.package.dependencyHash,'0c93f504');
assert.equal(save.riftCheckpoint.elapsedMs,0);assert.equal(save.riftCheckpoint.state.phase,'active');assert.equal(save.riftCheckpoint.state.combat.health,100);
assert.deepEqual(failed.diagnostic.active,['RiftScene']);bytes(diagnosis.failureFrame);
for(const item of[binding.harness,binding.wrapper,...binding.dependencies]){
  bytes(item);bytes({path:`${base}/production-final108/sources/${item.path}`,sha256:item.sha256});
}
const harness=bytes(binding.harness).toString();assert(harness.includes('s.player && s.nativeWorldPresentation && s.devRuntime && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive()'));
assert.equal((harness.match(/\{ timeout: 30000 \}/g)??[]).length,2);
const expectedServed=Object.fromEntries(Object.entries(source.sources).filter(([file])=>/^(src|data|public)\//.test(file)));
assert.deepEqual(binding.beforeServedHashes,expectedServed);assert.deepEqual(binding.afterServedHashes,expectedServed);
assert.equal(Object.keys(expectedServed).length,1393);
for(const flag of['beforeRuntimeVerified','afterRuntimeVerified','servedSourceVerified'])assert.equal(binding[flag],true);
assert.equal(binding.beforeFiles.files,1397);assert.deepEqual(binding.afterFiles,binding.beforeFiles);
assert.deepEqual(binding.worldIds,worlds);assert(binding.probeOptions.stopOnFailure&&binding.probeOptions.observeWorkers);
const events=bytes(diagnosis.observer).toString().trim().split('\n').map(JSON.parse),counts={};
const workersCreated=new Set(),workersClosed=new Set(),contextsCreated=new Set(),contextsClosed=new Set();
const workerKey=row=>`${row.pid}/${row.browserId}/${row.contextId}/${row.workerId}`;
const contextKey=row=>`${row.pid}/${row.browserId}/${row.contextId}`;
const bad=[];
for(const event of events){counts[event.event]=(counts[event.event]??0)+1;
  for(const[name,set,key]of[['worker-created',workersCreated,workerKey],['worker-closed',workersClosed,workerKey],['context-created',contextsCreated,contextKey],['context-closed',contextsClosed,contextKey]])if(event.event===name){assert(!set.has(key(event)));set.add(key(event));}
  if(['requestfailed','http-error','pageerror','page-crash','Target.targetCrashed'].includes(event.event)||event.event==='console'&&event.type==='error')bad.push(event);
}
assert.deepEqual([...workersCreated].sort(),[...workersClosed].sort());assert.equal(workersCreated.size,606);
assert.deepEqual([...contextsCreated].sort(),[...contextsClosed].sort());assert.equal(contextsCreated.size,152);assert.deepEqual(bad,[]);
const observer=read(binding.workerObservation);assert.deepEqual(observer.counts,counts);assert.equal(observer.status,'failed');
assert.deepEqual(observer.issues,[{issue:'Incomplete observed context coverage',expectedContexts:324,actual:152}]);
const observation=read(diagnosis.contextObservation);
const failedEvents=events.filter(row=>row.contextId===152&&['context-created','page-created','page-navigation','worker-created','worker-closed','page-closed','context-closed'].includes(row.event));
assert.deepEqual(observation.events,failedEvents);
const network=events.find(row=>row.event==='network-summary'&&row.contextId===152);
assert.equal(network.pending.length,29);assert.equal(network.failed,0);assert.equal(network.requests,999);assert.equal(network.responses,978);
assert.deepEqual(observation.network.pending.map(({url,...rest})=>rest),network.pending);
const previousNetwork=events.find(row=>row.event==='network-summary'&&row.contextId===151);assert.deepEqual(previousNetwork.pending,[]);
const ownCapture=read(ref(`${base}/closeout-independent-review/production-environment-review/system-log-capture.json`));
const systemText=bytes(ownCapture.output).toString(),originalSystem=bytes(diagnosis.systemSleepExcerpt).toString();
for(const line of originalSystem.trimEnd().split('\n'))assert(systemText.includes(line.trimEnd()));
assert(systemText.includes("2026-10-07 23:34:53 +0800 Sleep"));assert(systemText.includes("'Idle Sleep'"));assert(systemText.includes('1216 secs'));
assert(systemText.includes('2026-10-07 23:55:09 +0800 Wake'));assert(systemText.includes('slow(1531 ms)'));
const start=failedEvents.find(row=>row.event==='context-created').at,lastWorker=failedEvents.filter(row=>row.event==='worker-closed').at(-1).at;
const close=failedEvents.find(row=>row.event==='context-closed').at,sleep='2026-10-07T15:34:53.000Z',wake='2026-10-07T15:55:09.000Z';
assert(Date.parse(start)<Date.parse(sleep)&&Date.parse(close)>Date.parse(wake));assert.equal((Date.parse(wake)-Date.parse(sleep))/1000,1216);
const result={schema:'coh.qa.production-environment-failure-review.v1',status:'external-interruption-corroborated-original-failure-retained',at:new Date().toISOString(),reviewer:'i12_qa',
  auditor:ref(fileURLToPath(import.meta.url)),diagnosis:diagnosisRef,originalReport:diagnosis.originalReport,originalSourceBinding:diagnosis.sourceBinding,
  originalExecution:diagnosis.execution,finalSource:binding.finalSource,rawObserver:diagnosis.observer,independentSystemCapture:ref(`${base}/closeout-independent-review/production-environment-review/system-log-capture.json`),
  actualOriginal:{plannedKeys:324,attempted:152,passed:151,failed:1,neverStarted:172,exactOriginalSchedulePrefix:true,originalPassedIdentities:rowIdentities,
    failedKey:'silt-colonnade/medium',failedOrdinal:152,requestedSeed:340,resolvedSeed:identity.seed,signature:identity.signature,
    failedIdentity:diagnosis.failedIdentity,fullIdentityJsonSha256:hash(JSON.stringify(identity)),failedSave:diagnosis.failedSave,rawSaveExactlyExtracted:true,
    readyDeadlineMs:30000,coldReloadNotReached:true,savedElapsedMs:0,savedPhase:'active',savedHp:100,
    sourceFilesCheckedByOriginalBeforeAfter:1397,exactServedHashEntries:1393,contextsCreatedAndClosed:152,workersCreatedAndClosed:606,
    observedErrorEvents:0,failedContextPendingNetworkRequests:29,observerStatusRetained:'failed-incomplete324-coverage'},
  timeline:{contextStartedUtc:start,sleepAnnouncedUtc:sleep,wakeUtc:wake,announcedSleepSeconds:1216,sleepAcknowledgementDelayMs:1531,
    lastWorkerClosedUtc:lastWorker,contextClosedUtc:close,workerCloseToContextCloseSeconds:(Date.parse(close)-Date.parse(lastWorker))/1000,
    wakeToContextCloseSeconds:(Date.parse(close)-Date.parse(wake))/1000},
  visualCheck:{frame:diagnosis.failureFrame.path,sha256:diagnosis.failureFrame.sha256,inspectedBy:'i12_qa',observation:'World/player/HUD are drawn; HP100/100, chaos15 and ordinary crowbar60/60 are visible; no pause/result overlay. This after-timeout frame cannot establish earlier readiness/fence subconditions.'},
  assessment:{environmentalInterruption:'Strong direct system-log evidence of automatic Idle Sleep during the original case152 window; observer silence spans the sleep and closes1.871s after wake.',
    causalLimit:'Not proof that sleep was the only cause, that readiness had already succeeded, or that any particular fence/rAF/document visibility condition was false. Worker-closed means lifetime ended, not a verified successful worker response.',
    productDisposition:'Original case152 and original full-run status remain failed. The remaining172 original keys have no original execution result. No source or game defect is established or ruled out by this sleep evidence.'},
  fullRecheckRecommendation:{status:'acceptable-for-root-approval-with-conditions-not-executed',strategy:'One complete324-key matrix in a fresh output directory; no segmented aggregation.',
    rationale:'An independently corroborated external sleep interruption invalidated the continuous original run. A complete one-time repetition preserves the existing unmodified canonical324 validation and avoids inventing completed original cases.',
    requiredConditions:[
      'Root signs an immutable protocol bound to this review, the original failure/report/source binding/fullidentity and a new never-existing output path before execution.',
      'Use exactly the original frozen final source e4477ea3, original harness078e4527, wrapper00d0d75f, observer3081221d and dependency bytes; preserve both30000ms readiness deadlines, expected108 worlds/revision6, stop-on-failure and observe-workers.',
      'Run only one full324-key schedule with the original catalog order, all3grades, deterministic first-enabled seed-selection algorithm and fresh ordinary isolated records. No added seed/world overrides or partial selection.',
      'Wrap the unchanged utility command with /usr/bin/caffeinate -i only for that process lifetime; record command/PID/assertion creation and release. Do not change permanent power settings, clocks, timeouts, product code or browser options. Idle prevention is not protection from forced sleep or shutdown.',
      'Retain original151 pass rows, original failed152, raw observer, failure image, raw saved bytes and source audits unchanged. New failed attempts also remain immutable. Any new failure immediately stops; no automatic second repetition.',
      'Only a complete new single-run324 report with its own passing source binding and original worker/network checks may become canonical. Keep four runtime-method source bindings; production references the new single-run binding, with the original failed attempt and protocol separately retained.',
      'Compare every originally observed152 world/grade/controlledSeed against its matching new row; fullidentity deep equality for all available original identities including the separately extracted original case152. A different run UUID or starter item UUID is normal for fresh records and must not be forged to simulate an identical save.',
      'Final accounting is original152 actual attempts plus at most new324 = at most476. If complete, canonical qualification is324 unique new-run keys; original151 are historical passes, not extra canonical coverage. This supersedes the abandoned segmented325-attempt proposal.',
      'Production completion does not imply budget/lifecycle, equivalent342 identities, natural48 journeys, GPU performance, art quality or audio listening. Those original gates remain separate.'
    ],localManualReviewed:'The local caffeinate(8) manual states -i prevents system idle sleep and utility-scoped assertions persist for the utility execution duration; caffeinate itself was not run by this audit.',
    noExecutionAuthorizationClaimedByThisReceipt:true},
  limitations:['Only evidence and the proposed full rerun conditions were reviewed; no browser, generation, gameplay or new assertion was started.','Existing full-source checks are verified as immutable original receipts; this read-only review did not rehash all1397 runtime payloads.'],
  inputs:[...inputs.values()]};
for(const item of result.inputs)assert.equal(hash(fs.readFileSync(item.path)),item.sha256,'Input changed during independent review');
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,review:ref(out),proposed:'one-fresh-complete324-recheck',maximumAllAttempts:476}));
