/** Small adversarial accounting checks. No invented full runtime pass or ledger writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateAccountingScopes, validateInheritance, validateRuntimeBinding, assertPlaySummaryExact, validateBoundedPlayContinuity, validateFinalRuntimeBindings, validateShaderReview, validateHistoricalGenerationSources, validateGenerationHarnessSources} from './r100-bind-i10-i12.mjs';
import {validateFinalReport, summarizeWorkerEvents} from './r100-i09-final-probe.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const frozenPath = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const frozen = read(frozenPath), old = frozen.baseline.worlds, added = frozen.batches.flatMap(row => row.worlds);
const i11 = [...old, ...frozen.batches.filter(row => row.iteration !== 'R100-I12').flatMap(row => row.worlds)];
const i12 = frozen.batches.filter(row => row.iteration === 'R100-I12').flatMap(row => row.worlds);
const grades = ['low', 'medium', 'severe'];
const generation = (worlds, seeds, stage) => ({status:'pass',successful:worlds.length*3*seeds,
  uniqueCases:worlds.length*3*seeds,expectedCases:worlds.length*3*seeds,missing:[],unresolved:[],groups:[{worlds}],
  ...(stage ? {seedPolicy:{mode:'expanded-holdout-only',stage}} : {})});
const play = (worlds, revision) => ({status:'pass',qualifiedGradePairs:worlds.length*3,
  completedSeedProcesses:worlds.length*6,expectedSeeds:worlds.length*6,
  pairs:worlds.flatMap(world=>grades.map(grade=>({world,grade}))),sources:[{algorithmRevision:revision}]});
const accounting = () => ({generations:{historicalGeneration:generation(old,48),generation:generation(added,48),
  expandedHoldoutI11:generation(i11,8,'I11'),expandedHoldoutI12:generation(i12,8,'I12')},
  plays:{historicalPlay:play(old,5),play:play(added,6)}});
const checks=[];
const check=(name,run)=>{run();checks.push({name,status:'pass'});};
const historicalPlan=read('docs/qa/artifacts/r100-i07-i09/final-binding/plan.json');
const supplement=read('docs/qa/artifacts/r100-i10-i12/closeout-independent-review/historical-generation-harness-supplement.json');
const historicalGeneration=read(supplement.historicalGeneration.path);
const validateSupplement=value=>{
  const sources=validateHistoricalGenerationSources(value,historicalPlan.generationSources);
  for(const entry of sources){
    const group=historicalGeneration.groups.find(row=>row.id===entry.groupId);
    validateGenerationHarnessSources(entry,group.dependencies.filter(row=>row.path.startsWith('tools/')),file=>fs.readFileSync(file));
  }
};
check('all11 historical QA source supplements preserve original identities and executed bytes',()=>validateSupplement(supplement.historicalGenerationSources));
for(const [name,mutate] of [
  ['missing historical QA source group',x=>x.pop()],
  ['duplicate historical QA group hides another source',x=>x[1]=structuredClone(x[0])],
  ['historical QA supplement cannot replace source path',x=>x[0].path=x[1].path],
  ['historical QA supplement cannot reseal different source SHA',x=>x[0].sha256=sha('other source')],
  ['historical QA supplement cannot omit executed dependency',x=>x[0].harnessSources=[]],
  ['historical QA supplement cannot add unrelated dependency',x=>x[0].harnessSources.push(structuredClone(x[0].harnessSources[0]))],
  ['historical QA supplement cannot reseal newer executor bytes',x=>{
    x[0].harnessSources[0].path='tools/world-study/check-r100-library.ts';
    x[0].harnessSources[0].sha256=sha(fs.readFileSync(x[0].harnessSources[0].path));
  }],
])check(name,()=>{const x=structuredClone(supplement.historicalGenerationSources);mutate(x);assert.throws(()=>validateSupplement(x));});
check('original r5 summary schema only omits verified 5/13 metadata',()=>{
  const old={sources:[{folder:'fixture'}],result:'unchanged'};
  const current={...old,algorithmRevisions:[5],sources:[{folder:'fixture',algorithmRevision:5,controllerPolicyRevision:13}]};
  assertPlaySummaryExact(old,current,true);
  for(const bad of [{...current,result:'changed'}, {...current,algorithmRevisions:[6]},
    {...current,sources:[{folder:'fixture',algorithmRevision:6,controllerPolicyRevision:15}]}])
    assert.throws(()=>assertPlaySummaryExact(old,bad,true));
});
check('separate base48 and additional8 scopes accepted as accounting only',()=>{
  const f=accounting();assert.equal(validateAccountingScopes(frozen,f.generations,f.plays).ids.length,108);
});
for(const [name,mutate] of [
  ['missing world despite claimed complete total',f=>f.generations.generation.groups[0].worlds=f.generations.generation.groups[0].worlds.slice(1)],
  ['duplicate grade concealing missing grade',f=>f.plays.play.pairs[1]={...f.plays.play.pairs[0]}],
  ['historical execution relabeled revision6',f=>f.plays.historicalPlay.sources[0].algorithmRevision=6],
  ['additional holdout mistaken for base48',f=>delete f.generations.expandedHoldoutI11.seedPolicy],
]) check(name,()=>{const f=structuredClone(accounting());mutate(f);assert.throws(()=>validateAccountingScopes(frozen,f.generations,f.plays));});

// Real already reviewed inheritance documents: negatives reseal semantic claims
// in memory, so a mere old enclosing hash cannot be what catches the defect.
const reviewPath='docs/qa/artifacts/r100-i10-i12/old52-r6-inheritance/independent-review.json';
const review=read(reviewPath),candidate=read(review.candidate.path);
const ref=value=>({path:value.path,sha256:value.sha256});
const inheritancePlan={qualificationPlan:ref(candidate.qualificationPlan),historicalGeneration:ref(candidate.historicalGeneration),historicalPlay:ref(candidate.historicalFixedPlay)};
check('actual approved inheritance field contract',()=>validateInheritance(candidate,review,frozen,inheritancePlan));
for(const [name,mutate] of [
  ['author-only inheritance cannot replace root decision',(c,r)=>r.reviewer='author'],
  ['inheritance of an unreviewed source',(c,r)=>{c.after.sha256='0'.repeat(64);}],
  ['old runtime samples falsely labeled revision6',(c,r)=>{c.historicalGeneration.executedAlgorithmRevision=6;r.historicalGeneration.executedAlgorithmRevision=6;}],
]) check(name,()=>{const c=structuredClone(candidate),r=structuredClone(review);mutate(c,r);assert.throws(()=>validateInheritance(c,r,frozen,inheritancePlan));});

const boundedPath='docs/qa/artifacts/r100-i10-i12/ground-edge-production-continuity/independent-review.json';
const bounded=read(boundedPath),behavior=read(bounded.behaviorReport.path);
check('six actual-play behavior identities admitted only by explicit root scope',()=>validateBoundedPlayContinuity(bounded,behavior,frozen));
for(const [name,mutate] of [
  ['unreviewed behavior source', (r,b)=>b.after.sha256='0'.repeat(64)],
  ['duplicate play identity hides missing seed', (r,b)=>b.cases[1]=structuredClone(b.cases[0])],
  ['different deployed content cannot inherit a played seed', (r,b)=>b.cases[0].after.exact.production='0'.repeat(64)],
  ['extra favorable seed not in original plan', (r,b)=>{r.identities[0].seed=1;b.cases[0].seed=1;b.cases[0].before.seed=1;b.cases[0].after.seed=1;}],
])check(name,()=>{const r=structuredClone(bounded),b=structuredClone(behavior);mutate(r,b);assert.throws(()=>validateBoundedPlayContinuity(r,b,frozen));});

const source={temporaryRoot:'/synthetic/frozen',sources:{'src/one.ts':sha('runtime'),'data/one.csv':sha('data')}};
const plan={finalSource:{path:'synthetic-source.json',sha256:sha('source')},production:{path:'synthetic-report.json',sha256:sha('report')}};
const wrapper='tools/qa/r100-i09-final-probe.mjs';
const binding={status:'pass',kind:'production',finalSource:plan.finalSource,report:plan.production,
  beforeRuntimeVerified:true,afterRuntimeVerified:true,servedSourceVerified:true,exitCode:0,
  harness:{path:'synthetic-harness',sha256:sha('tool')},wrapper:{path:wrapper,sha256:sha('tool')},
  beforeServedHashes:source.sources,afterServedHashes:source.sources,
  beforeFiles:{nodeWorkingDirectory:process.cwd(),frozenDirectory:source.temporaryRoot,files:2},worldIds:['one']};
binding.afterFiles=binding.beforeFiles;
const event=(name, extra={})=>({event:name,pid:1,browserId:1,...extra});
const observedEvents=[event('preload-ready'),event('launch'),...grades.flatMap((_,i)=>[
  event('context-created',{contextId:i+1}),event('worker-created',{contextId:i+1,workerId:i+1}),
  event('worker-closed',{contextId:i+1,workerId:i+1}),event('network-summary',{contextId:i+1,reason:'context-closed',requests:3,responses:3,urls:[1]}),
  event('context-closed',{contextId:i+1}),]),event('browser-disconnected')];
const memory=new Map(), rawPath='synthetic-worker.jsonl', observationPath='synthetic-worker-summary.json';
function installObservedEvents(value, events) {
  const raw=Buffer.from(events.map(row=>JSON.stringify(row)).join('\n')+'\n');memory.set(rawPath,raw);
  const report=Buffer.from(JSON.stringify({...summarizeWorkerEvents(events,3),files:[{path:rawPath,sha256:sha(raw)}]}));
  memory.set(observationPath,report);value.workerObservation={path:observationPath,sha256:sha(report)};
}
binding.probeOptions={stopOnFailure:true,observeWorkers:true};
binding.dependencies=[{path:'tools/qa/r100-worker-observer.mjs',sha256:sha('tool')}];
binding.workerObservationStatus='pass-observed-events';installObservedEvents(binding,observedEvents);
const verify=value=>validateRuntimeBinding(value,'production',plan,source,['one'],file=>memory.get(file)??Buffer.from('tool'));
check('runtime binding shape baseline, not real HTTP evidence',()=>verify(binding));
for(const [name,mutate] of [
  ['same report cannot bind contaminated served source',x=>x.afterServedHashes['src/one.ts']=sha('different runtime')],
  ['missing source byte cannot be covered by verification flag',x=>delete x.beforeServedHashes['data/one.csv']],
  ['source-binding cannot target another frozen source',x=>x.finalSource.sha256=sha('other source')],
  ['missing observation cannot be substituted by passed gameplay',x=>delete x.workerObservation],
  ['missing explicit failure stop',x=>x.probeOptions.stopOnFailure=false],
  ['changed observer implementation',x=>x.dependencies[0].sha256=sha('other observer')],
])check(name,()=>{const x=structuredClone(binding);mutate(x);assert.throws(()=>verify(x));});
for(const [name,events]of [
  ['caught Worker failure despite successful case, resealed raw', [...observedEvents,event('console',{type:'error',text:'Generation worker failed'})]],
  ['missing context despite claimed complete coverage, resealed raw',observedEvents.filter(row=>row.contextId!==3)],
])check(name,()=>{const x=structuredClone(binding);installObservedEvents(x,events);assert.throws(()=>verify(x));installObservedEvents(binding,observedEvents);});
check('false clean observation summary cannot hide original raw failure',()=>{
  const x=structuredClone(binding);installObservedEvents(x,[...observedEvents,event('pageerror',{message:'original error'})]);
  const fake=JSON.parse(memory.get(observationPath));fake.status='pass-observed-events';fake.issues=[];
  const raw=Buffer.from(JSON.stringify(fake));memory.set(observationPath,raw);x.workerObservation.sha256=sha(raw);
  assert.throws(()=>verify(x));installObservedEvents(binding,observedEvents);
});
// Audit all four runtime methods without inventing any final108 execution.
const runtimeKinds=['production','equivalence','budget','lifecycle'];
const runtimePlan=structuredClone(plan), auditMemory=new Map();
for(const kind of runtimeKinds){
  runtimePlan[kind]={path:`synthetic-${kind}-report.json`,sha256:sha(kind)};
  const audit={...structuredClone(binding),kind,report:runtimePlan[kind]};
  const raw=Buffer.from(JSON.stringify(audit)), file=`synthetic-${kind}-binding.json`;
  auditMemory.set(file,raw);(runtimePlan.runtimeBindings??=[]).push({path:file,sha256:sha(raw)});
}
const auditReader={bytes:file=>memory.get(file)??Buffer.from('tool'),receipt:ref=>{
  const raw=auditMemory.get(ref.path);assert.equal(sha(raw),ref.sha256);return JSON.parse(raw);
}};
check('four distinct runtime-source audits required, metadata only',()=>validateFinalRuntimeBindings(runtimePlan,source,['one'],auditReader));
for(const [name,mutate] of [
  ['missing budget report cannot grant final qualification',p=>delete p.budget],
  ['missing lifecycle report cannot grant final qualification',p=>delete p.lifecycle],
  ['missing lifecycle source audit',p=>p.runtimeBindings.pop()],
  ['duplicate source audit hides budget',p=>p.runtimeBindings[2]=p.runtimeBindings[1]],
  ['budget receipt bound to wrong report bytes',p=>p.budget.sha256=sha('changed-budget')],
])check(name,()=>{const p=structuredClone(runtimePlan);mutate(p);assert.throws(()=>validateFinalRuntimeBindings(p,source,['one'],auditReader));});

const lifecyclePath='docs/qa/artifacts/r100-i09/lifecycle-final52/report.json';
const originalLifecycle=fs.readFileSync(lifecyclePath), lifecycle=JSON.parse(originalLifecycle);
const shader={status:'bounded-independent-shader-pass',reviewer:'root',finalSource:runtimePlan.finalSource,
  report:runtimePlan.lifecycle,sourceBinding:runtimePlan.runtimeBindings[3],
  scope:'Synthetic review fixture for the existing 12 real samples; not an actual approval.',
  ownershipConclusion:'Fixture text only; real ownership review remains required.',limitations:'No final108 lifecycle execution.',
  reviewedShaderSamples:lifecycle.samples.map(row=>({label:row.label,...row.objects.Shader}))};
const verifyShader=x=>validateShaderReview(x,runtimePlan,lifecycle,runtimePlan.runtimeBindings[3]);
check('Shader evidence binds all original12 counts, review metadata only',()=>verifyShader(shader));
for(const [name,mutate] of [
  ['missing independent Shader review',()=>undefined],
  ['author cannot sign root Shader review',x=>({...x,reviewer:'author'})],
  ['Shader review concerns another final source',x=>({...x,finalSource:{...x.finalSource,sha256:sha('other')}})],
  ['Shader review concerns another lifecycle report',x=>({...x,report:{...x.report,sha256:sha('other')}})],
  ['Shader review concerns another source audit',x=>({...x,sourceBinding:{...x.sourceBinding,sha256:sha('other')}})],
  ['Shader last-sample growth cannot hide under old review',x=>{x.reviewedShaderSamples[11].active+=100;return x;}],
  ['Shader ownership conclusion missing',x=>({...x,ownershipConclusion:''})],
])check(name,()=>assert.throws(()=>verifyShader(mutate(structuredClone(shader)))));
assert(fs.readFileSync(lifecyclePath).equals(originalLifecycle),'Historical lifecycle bytes changed');
const formal={status:'passed',loadedSourceHashes:{'synthetic-url':sha('runtime')},cases:grades.map(grade=>({world:'one',grade,status:'passed',errors:[],
  coldIdentityPreserved:true,worldHistoryPreserved:true,historyBeforeDeparture:{version:1,visits:[]},
  committedWorldHistory:{version:1,visits:[{worldId:'one',grade}]},bodyGeometry:{version:1,fullBodyCheckpointAdmitted:true,coldBodyPositionPreserved:true},controlledSeed:1,
  identity:{generation:{requestedSeed:1,package:{id:'r100-one',grade,algorithmRevision:6}}}}))};
check('missing formal grade rejected independently of totals',()=>{validateFinalReport('production',formal,['one'],[],6);formal.cases[1]=formal.cases[0];assert.throws(()=>validateFinalReport('production',formal,['one'],[],6));});
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Fresh report path required');
fs.mkdirSync(path.dirname(output),{recursive:true});
const receipt=file=>({path:file,sha256:sha(fs.readFileSync(file))});
fs.writeFileSync(output,JSON.stringify({status:'pass',scope:'Small accounting and binding predicates only. Real inheritance references plus synthetic metadata; no final108 runtime execution, full binder proposal, game sample or ledger mutation.',
  binder:receipt('tools/qa/r100-bind-i10-i12.mjs'),harness:receipt('tools/qa/check-r100-expansion-binding.mjs'),
  qualificationPlan:receipt(frozenPath),review:receipt(reviewPath),checks,pending:'Full dry proposal and targeted real-evidence corruptions after actual108 reports exist.'},null,2)+'\n',{flag:'wx'});
console.log(`PASS ${checks.length} expansion binding contracts; zero game executions`);
