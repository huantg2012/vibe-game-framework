import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/',read=p=>JSON.parse(fs.readFileSync(p));
const ref=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const frozen=read(base+'qualification-plan.json'),expanded=read(base+'current3121-generation/expanded-plan.json');
const prior=read(base+'b10-current-qualified/commands.json'),runner=fs.readFileSync(base+'b10-current-qualified/run-generation.mjs','utf8');
assert.deepEqual(expanded.qualificationPlan,ref(base+'qualification-plan.json'));assert.deepEqual(ref(expanded.executor.path),expanded.executor);
const stages=[];
for(const batch of frozen.batches.filter(row=>row.iteration==='R100-I12')){
 const folder=base+batch.id.toLowerCase()+'-current-qualified';fs.mkdirSync(folder,{recursive:true});
 const commands={schemaVersion:1,status:'prepared-awaiting-repaired-normal-review',worlds:batch.worlds,wholeBatchReady:false,source:expanded.source,qualificationPlan:expanded.qualificationPlan,executor:expanded.executor,originalPreparation:expanded.preparation,requiredAdmission:folder+'/normal-admission.json',generation:structuredClone(prior.generation),scope:'Original base48 only: 32 ordinary + 8 boundary + original8 holdout. Additional8 already executed separately. No current art or actual-play approval follows from this plan.'};
 for(const [i,step]of commands.generation.entries()){
  step.args[0]=expanded.executor.path;step.args[step.args.indexOf('--executor')+1]=expanded.executor.path;
  step.args[step.args.indexOf('--worlds')+1]=batch.worlds.join(',');
  step.args[step.args.indexOf('--report')+1]=path.resolve(folder+`/generation-${i?'holdout':'full'}/report.json`);
 }
 write(folder+'/commands-template.json',commands);
 write(folder+'/generation-summary-plan.json',{version:1,worlds:batch.worlds,groups:[{id:batch.id+'-current3121-all-four',worlds:batch.worlds,attempts:[folder+'/generation-full',folder+'/generation-holdout']}]});
 const adapted=runner.replaceAll('b10-current-qualified',batch.id.toLowerCase()+'-current-qualified').replace('B10 original576',batch.id+' original576');
 fs.writeFileSync(folder+'/run-generation.mjs',adapted,{flag:'wx'});
 stages.push({batch:batch.id,worlds:batch.worlds,expectedGeneration:576,expectedActual:24,template:ref(folder+'/commands-template.json'),runner:ref(folder+'/run-generation.mjs'),requiredAdmission:commands.requiredAdmission,expectedPlaySource:expanded.source});
}
write(base+'current3121-generation/base-batches-plan.json',{status:'prepared-not-executed-awaiting-normal-review',qualificationPlan:expanded.qualificationPlan,source:expanded.source,executor:expanded.executor,stages,order:'B11→B12→B13→B14, one heavy worker; stop and retain original report on failure. Actual24 per batch is a separate sole-Chrome stage after the earlier original processes. Never enable the pool from this plan.'});console.log('Prepared4×576 base cases and original24 scopes without launching');
