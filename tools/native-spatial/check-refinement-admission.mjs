/** Saved receipt control regression only: no geometry or new generation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const root='docs/qa/artifacts/native-spatial-2026-10-14',source='src/generation/world-study/native-spatial-generation.ts';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHash=hash(source),files=['production-gel-route-feedback-round1.json','production-gel-route-feedback-seed0-round1.json'];
const inputs=files.map(name=>{const file=path.join(root,name),failure=JSON.parse(fs.readFileSync(file)).failures[0];return{name,file,hash:hash(file),failure,rows:failure.diagnostics.attempts.flatMap(a=>a.candidates).filter(c=>c.gates.geometry)};});
const report={status:'running',scope:'Recorded actual gates, actualVoid availability and hashes; minimal archive layout envelopes only. No geometry compile, deployment, fresh request or claim of a new successful map.',sourceHash,inputs:inputs.map(({name,hash})=>({name,hash})),cases:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const bundle=path.resolve(output,'archive.mjs');
await build({entryPoints:[source],outfile:bundle,bundle:true,platform:'node',format:'esm',tsconfig:'tools/contam-preview/tsconfig.json',logLevel:'silent'});
const {NativeSpatialGeometryArchive,nativeSpatialRefinementAdmission}=await import(pathToFileURL(bundle).href);
const check=(id,run)=>{try{report.cases.push({id,passed:true,...run()});}catch(error){report.cases.push({id,passed:false,error:String(error.stack??error)});}save();};
// Exact geometry cannot be reconstructed from these receipts. The persisted
// hash is an identity label for this scheduling test, never a new fingerprint.
const entry=row=>({layout:{candidate:row.candidate},gate:row.gates.geometry,fingerprint:{hash:row.geometryHash,canonical:`saved-receipt:${row.geometryHash}`}});
const offer=(archive,row,admission)=>{const e=entry(row);return archive.offer(e.layout,e.gate,e.fingerprint,undefined,undefined,admission);};
const admission=row=>nativeSpatialRefinementAdmission(row.gates.geometry,row.actualVoidFeedback);

check('both-recorded-chains-exclude-invalid-front-and-keep-diagnostic-ranking',()=>{
  return{receipts:inputs.map(input=>{
    const before=JSON.stringify(input.failure),policy=input.failure.recipe.nativeSpatial.policy;
    const diagnostic=new NativeSpatialGeometryArchive(policy),working=new NativeSpatialGeometryArchive(policy),accepted=[],excluded=[];
    for(const row of input.rows){
      const decision=admission(row);(decision.accepted?accepted:excluded).push(row.candidate);
      offer(diagnostic,row);offer(working,row,decision);
      assert.equal(working.best.layout.candidate,diagnostic.best.layout.candidate,'qualification must not alter diagnostic incumbent');
      assert(working.candidateIds.every(id=>admission(input.rows.find(c=>c.candidate===id)).accepted));
      assert(working.baseHistory.some(h=>h.geometryHash===row.geometryHash),'failed identity is retained in hash history');
      assert.equal(working.firstCandidate(entry(row).fingerprint),diagnostic.firstCandidate(entry(row).fingerprint));
    }
    assert(accepted.length&&excluded.length);assert.equal(JSON.stringify(input.failure),before,'receipt was mutated');
    const blockedFormerBases=input.rows.filter(row=>!admission(row).accepted&&input.rows.some(child=>child.feedbackBaseCandidate===row.candidate)).map(row=>row.candidate);
    for(const id of blockedFormerBases){const state=working.baseHistory.find(h=>h.firstCandidate===id);assert(state&&!state.refinable&&state.refinementRejectionReasons.length);}
    return{name:input.name,measured:input.rows.length,eligible:accepted.length,excluded:excluded.length,blockedFormerBases,diagnosticBest:working.best.layout.candidate,front:working.candidateIds};
  })};
});
check('actual-invalid-successors-count-once-as-stagnation-without-becoming-base',()=>{
  const input=inputs[0],base=input.rows.find(c=>c.candidate===9),bad=input.rows.filter(c=>c.candidate>=15&&c.candidate<=18),archive=new NativeSpatialGeometryArchive(input.failure.recipe.nativeSpatial.policy);
  assert(admission(base).accepted);offer(archive,base,admission(base));
  bad.forEach((row,index)=>{
    assert.equal(row.feedbackBaseCandidate,base.candidate);assert(!admission(row).accepted);
    offer(archive,row,admission(row));archive.recordRefinement(entry(base),entry(row));
    const state=archive.baseHistory.find(h=>h.firstCandidate===base.candidate);
    assert.equal(state.refinements,index+1);assert.equal(state.stagnantRefinements,index+1);assert.equal(state.lastResultCandidate,row.candidate);
    assert(!archive.candidateIds.includes(row.candidate));assert.equal(archive.nextBase?.layout.candidate,index<3?9:undefined);
  });
  assert(archive.best);assert.equal(archive.baseHistory.length,5);
  return{base:9,rejectedSuccessors:bad.map(c=>c.candidate),recordedRefinements:4,stagnantRefinements:4,failedHistoryRetained:true};
});
check('fixed-bay-support-and-final-hole-failures-use-real-receipts',()=>{
  const fixtures=[inputs[0].rows.find(c=>c.candidate===5),inputs[1].rows.find(c=>c.candidate===10),inputs[0].rows.find(c=>c.candidate===24)];
  assert(fixtures[0].gates.geometry.metrics.bayViolationCount>0);assert(fixtures[1].gates.geometry.metrics.finalSourceSupportViolationCount>0);assert(fixtures[2].gates.geometry.metrics.holeProfileViolationCount>0);
  for(const row of fixtures)assert(!admission(row).accepted);
  return{fixtures:fixtures.map(row=>({candidate:row.candidate,reasons:admission(row).reasons}))};
});
check('isolated-missing-feedback-and-ineffective-object-controls',()=>{
  const ground=inputs[0].rows.find(c=>c.candidate===0).gates.geometry;
  assert(nativeSpatialRefinementAdmission(ground,{available:true}).accepted,'valid identity with G1 failure remains refinable');
  assert(!nativeSpatialRefinementAdmission(ground,{available:false}).accepted);
  const invalid={...ground,metrics:{...ground.metrics,rejectedObjects:[{id:'explicit-unit-negative-control'}]}};
  assert(!nativeSpatialRefinementAdmission(invalid,{available:true}).accepted);
  return{realValidG1FailurePreserved:true,unitMissingFeedbackRejected:true,unitInvalidStructureRejected:true};
});
report.sourceHashAfter=hash(source);report.sourcesStable=report.sourceHashAfter===sourceHash;
report.inputsStable=inputs.every(input=>hash(input.file)===input.hash);
report.status=report.cases.every(c=>c.passed)&&report.sourcesStable&&report.inputsStable?'passed':'failed';save();
console.log(JSON.stringify({status:report.status,cases:report.cases},null,2));if(report.status!=='passed')process.exitCode=1;
