import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateExpansionExecutionPlan} from '../../../../tools/qa/check-r100-expansion-plan.mjs';
const base='docs/qa/artifacts/r100-i10-i12/',folder=base+'b06-porous-repaired-play';
assert(!fs.existsSync(folder));fs.mkdirSync(folder);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const receipt=file=>({path:file,sha256:sha(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const qualification=base+'qualification-plan.json',execution=read(qualification);
execution.executionSource=receipt(qualification);execution.executionWorlds=['marrow-break','pore-bank'];
validateExpansionExecutionPlan(execution,{batch:'B06'});write(folder+'/execution-plan.json',execution);
const originalPolicy=base+'b06-porous-qualified/play/policy-freeze.json',original=read(originalPolicy);
assert.equal(original.cases.length,12);
const completed=read(base+'b06-porous-qualified/play/batch-report.json');assert.equal(completed.attempts.length,2);
assert.equal(completed.attempts[0].exitCode,0);assert.notEqual(completed.attempts[1].exitCode,0);
const source=receipt(base+'p34-and-b09-b10-refined-source/source-snapshot.json');
const deps=['tools/qa/r100-i07-i09-coverage.mjs','tools/qa/check-r100-expansion-plan.mjs','tools/qa/r100-worker-observer.mjs','tools/qa/r100-i09-final-probe.mjs'].map(receipt);
const jobs=[
 {id:'original002-low-second',worlds:['marrow-break'],grades:['low'],seeds:[3075192741],originalOrdinals:[2]},
 {id:'remaining-marrow-upper',worlds:['marrow-break'],grades:['medium','severe'],seeds:[20261005,3075192741],originalOrdinals:[3,4,5,6]},
 {id:'remaining-pore-all',worlds:['pore-bank'],grades:['low','medium','severe'],seeds:[20261005,3075192741],originalOrdinals:[7,8,9,10,11,12]},
].map(job=>{
 const cases=job.worlds.flatMap(world=>job.grades.flatMap(grade=>job.seeds.map(seed=>({world,grade,seed}))));
 assert.deepEqual(cases,job.originalOrdinals.map(n=>{const{world,grade,seed}=original.cases[n-1];return{world,grade,seed};}));
 const out=folder+'/'+job.id;
 return{...job,cases:cases.length,originalCases:job.originalOrdinals.map(n=>original.cases[n-1]),output:out,
  command:process.execPath,args:['tools/qa/r100-i07-i09-coverage.mjs'],env:{GAME_URL:'http://127.0.0.1:3120/',QA_SOURCE_MANIFEST:source.path,
   QA_EXPANSION_PLAN:path.resolve(folder+'/execution-plan.json'),QA_BATCH_ID:'B06',QA_WORLDS:job.worlds.join(','),QA_GRADES:job.grades.join(','),QA_SEEDS:job.seeds.join(','),QA_CONCURRENCY:'1',QA_RESOURCE_PAUSE_FILE:'/tmp/coh-r100-i10-i12.pause',QA_OUTPUT_DIR:path.resolve(out),QA_STOP_ON_FAILURE:'1',
   QA_WORKER_OBSERVER_DIR:path.resolve(out+'-worker-observations'),QA_WORKER_OBSERVER_FAILURE_FILE:path.resolve(out+'-first-error.json'),NODE_OPTIONS:'--import '+path.resolve('tools/qa/r100-worker-observer.mjs'),DEBUG:'pw:browser'}};
});
assert.equal(jobs.reduce((n,j)=>n+j.cases,0),11);
write(folder+'/plan.json',{status:'prepared-awaiting-exclusive-browser',source,qualificationPlan:receipt(qualification),executionPlan:receipt(folder+'/execution-plan.json'),originalPolicy:receipt(originalPolicy),originalAttempts:receipt(base+'b06-porous-qualified/play/batch-report.json'),preservedSuccessfulOrdinal:1,replayedFailedOrdinal:2,notYetExecutedOriginalOrdinals:Array.from({length:10},(_,i)=>i+3),dependencies:deps,jobs,
 sourceContinuity:[receipt(base+'old52-r6-inheritance/porous-b06-to-b12.json'),receipt(base+'old52-r6-inheritance/explicit-and-reviewed-transport-92.json'),receipt(base+'qa-tool-contract/reviewed-startup-material-independent-shapes.json')],
 method:'Same original world/grade/requested seed and earned ancestor, now on explicit repaired3120 source. Original001 success and002 failure remain untouched. No world/seed replacements, no hidden network flags, no automatic test retry. Observer errors stop after the current child fully closes.',
 bookkeeping:'The one-seed coverage sub-batch labels its first item search-and-extract; originalCases preserves its original second-seed-process label. This label is report metadata only and is not passed to the input controller. Qualification still requires both original processes and at least one real non-entry extraction per grade.'});
console.log('Prepared exactly11 original porous cases; no browser launched');
