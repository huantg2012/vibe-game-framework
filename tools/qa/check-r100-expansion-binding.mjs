/** Small adversarial accounting checks. No invented full runtime pass or ledger writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateAccountingScopes, validateInheritance, validateRuntimeBinding, assertPlaySummaryExact, validateBoundedPlayContinuity} from './r100-bind-i10-i12.mjs';
import {validateFinalReport} from './r100-i09-final-probe.mjs';

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
const verify=value=>validateRuntimeBinding(value,'production',plan,source,['one'],()=>Buffer.from('tool'));
check('runtime binding shape baseline, not real HTTP evidence',()=>verify(binding));
for(const [name,mutate] of [
  ['same report cannot bind contaminated served source',x=>x.afterServedHashes['src/one.ts']=sha('different runtime')],
  ['missing source byte cannot be covered by verification flag',x=>delete x.beforeServedHashes['data/one.csv']],
  ['source-binding cannot target another frozen source',x=>x.finalSource.sha256=sha('other source')],
])check(name,()=>{const x=structuredClone(binding);mutate(x);assert.throws(()=>verify(x));});
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
