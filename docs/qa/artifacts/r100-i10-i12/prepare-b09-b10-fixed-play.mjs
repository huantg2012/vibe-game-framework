import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateExpansionExecutionPlan} from '../../../../tools/qa/check-r100-expansion-plan.mjs';
const base='docs/qa/artifacts/r100-i10-i12/', read=file=>JSON.parse(fs.readFileSync(file));
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const template=read(base+'b07-refined-qualified/play-commands.json');
const templateRunner=fs.readFileSync(base+'b07-refined-qualified/run-play.mjs','utf8');
const roots=['b09-b10-medium-independent-review.json','p34-and-b09-b10-refined-medium/independent-review.json','b09-b10-and-b08-refined-grades/independent-review.json','earlier-passed-grades/independent-review.json'];
const reviews=roots.map(file=>({reference:ref(base+file),value:read(base+file)}));
assert(reviews.every(row=>row.value.reviewer==='root'));
const prepared=[];
for(const batch of ['B09','B10']){
 const folder=base+batch.toLowerCase()+'-current-qualified',execution=read(base+'qualification-plan.json');
 const worlds=execution.batches.find(row=>row.id===batch).worlds;
 const admitted=[];
 for(const world of worlds) for(const grade of ['low','medium','severe']){
  const matches=reviews.flatMap(({reference,value})=>value.worlds.filter(row=>row.worldId===world&&(row.grade??'medium')===grade&&row.status.includes('pass')).map(row=>({reference,row})));
  assert.equal(matches.length,1,`Exactly one current bounded root conclusion: ${world}/${grade}`);
  admitted.push({worldId:world,grade,review:matches[0].reference,status:matches[0].row.status});
 }
 execution.executionSource=ref(base+'qualification-plan.json');execution.batches.find(row=>row.id===batch).status='ready';
 const validation=validateExpansionExecutionPlan(execution,{batch});
 write(folder+'/execution-plan.json',execution);write(folder+'/execution-plan-check.json',validation);
 const commands=structuredClone(template);
 commands.worlds=worlds;commands.executionPlan=ref(folder+'/execution-plan.json');commands.executionPlanCheck=ref(folder+'/execution-plan-check.json');
 commands.generationSummary=ref(folder+'/generation-summary.json');assert.equal(read(commands.generationSummary.path).status,'pass');
 commands.rootReviews=reviews.map(row=>row.reference);
 commands.play.env.QA_EXPANSION_PLAN=path.resolve(commands.executionPlan.path);commands.play.env.QA_BATCH_ID=batch;
 commands.play.env.QA_WORLDS=worlds.join(',');commands.play.env.QA_OUTPUT_DIR=path.resolve(folder+'/play');
 commands.play.env.QA_WORKER_OBSERVER_DIR=path.resolve(folder+'/worker-observations');commands.play.env.QA_WORKER_OBSERVER_FAILURE_FILE=path.resolve(folder+'/worker-observation-first-error.json');
 for(const dep of commands.dependencies)assert.deepEqual(ref(dep.path),dep);
 write(folder+'/play-commands.json',commands);
 let runner=templateRunner.replaceAll('b07-refined-qualified',batch.toLowerCase()+'-current-qualified').replaceAll('B07',batch);
 const exact=JSON.stringify(template.worlds);assert(runner.includes(exact));runner=runner.replace(exact,JSON.stringify(worlds));
 fs.writeFileSync(folder+'/run-play.mjs',runner,{flag:'wx'});
 prepared.push({batch,worlds,admitted,commands:ref(folder+'/play-commands.json'),runner:ref(folder+'/run-play.mjs')});
}
write(base+'b09-b10-fixed-play-preparation.json',{status:'prepared-not-executed',createdAt:new Date().toISOString(),source:template.source,qualificationPlan:template.qualificationPlan,prepared,tool:ref(base+'prepare-b09-b10-fixed-play.mjs'),method:'Only selected readiness changes in an exact frozen plan copy. Original earned save/policy15/three grades/two seeds; failures retained and stop after child closure. Earlier mixed root receipt includes rejected rows; each admitted world-grade is checked against its unique later passing conclusion. Full runtime continuity is a separate source bridge.'});
console.log('B09/B10 original24 each prepared, no browser launched');
