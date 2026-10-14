/** No map sampling: exercise the same finite work wrapper used by production. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeSpatialGeometryWorkBudget} from '../../src/generation/world-study/native-spatial-generation.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
const files=['src/generation/world-study/native-spatial-generation.ts','src/generation/world-study/native-spatial-types.ts','tools/native-spatial/check-geometry-work-budget.mjs'];
const snapshot=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=snapshot(),cases=[];
function attempt(){return{geometrySeed:1,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};}
function check(id,run){try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify(cases.at(-1)));}
check('nested-prechecks-and-final-share-one-budget-before-work',()=>{
  const trace=attempt(),budget=createNativeSpatialGeometryWorkBudget(trace,3,()=>{});let invoked=0,forbidden=0;
  assert.throws(()=>budget.run({kind:'final-geometry',candidate:0},()=>{
    assert.equal(trace.geometryEvaluations,1,'final reservation must precede layout/fragment compilation');
    for(let i=0;i<3;i++)budget.run({kind:'initial-hole-identity',candidate:0,objectIndex:4,site:{x:i*8,y:16}},()=>{invoked++;return{accepted:false,reasons:['identity-failed'],invalidHoleIds:['H-fixture']};});
    forbidden++;return{accepted:true,reasons:[]};
  }),/budget exhausted/);
  assert.equal(trace.geometryEvaluations,3);assert.equal(invoked,2);assert.equal(forbidden,0);assert.equal(trace.stopReason,'geometry-work-budget');
  assert.equal(trace.finalGeometryEvaluations,0);assert.equal(trace.geometryWork[0].finalMeasurementStarted,false);
  assert.deepEqual(trace.geometryWork.map(row=>row.outcome),['exception','rejected','rejected']);
  assert.throws(()=>budget.run({kind:'final-geometry',candidate:1},()=>{forbidden++;return{accepted:true,reasons:[]};}),/budget exhausted/);assert.equal(forbidden,0);assert.equal(trace.geometryWork.length,3);
  return{slots:3,identityExecutions:2,blockedExecutions:0,trace:trace.geometryWork};
});
check('real-final-measurement-is-separate-from-total-work-slots',()=>{
  const trace=attempt(),budget=createNativeSpatialGeometryWorkBudget(trace,2,()=>{});let compile=0;
  budget.run({kind:'final-geometry',candidate:7},()=>{
    budget.run({kind:'initial-hole-identity',candidate:7,objectIndex:8,site:{x:16,y:24}},()=>({accepted:true,reasons:[]}));
    trace.finalGeometryEvaluations++;compile++;return{accepted:false,reasons:['G1-largest-empty-radius']};
  });
  assert.equal(trace.geometryEvaluations,2);assert.equal(trace.finalGeometryEvaluations,1);assert.equal(compile,1);
  assert.equal(trace.geometryWork[0].finalMeasurementStarted,true);assert.equal(trace.geometryWork[0].outcome,'rejected');assert.equal(trace.geometryWork[1].outcome,'accepted');
  assert(trace.geometryWork.every(row=>Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0));
  return{totalWork:2,finalMeasurementAttempts:1,failedFinalNotRefunded:true};
});
check('work-exception-keeps-reservation-and-error-evidence',()=>{
  const trace=attempt(),budget=createNativeSpatialGeometryWorkBudget(trace,1,()=>{});
  assert.throws(()=>budget.run({kind:'final-geometry',candidate:0},()=>{throw new Error('layout failed before fragment');}),/layout failed/);
  assert.equal(trace.geometryEvaluations,1);assert.equal(trace.geometryWork[0].outcome,'exception');assert.equal(trace.geometryWork[0].error,'layout failed before fragment');assert.equal(trace.geometryWork[0].finalMeasurementStarted,false);
  return{conservativeFinalReservation:1,finalMeasurementAttempts:0};
});
check('deadline-before-or-during-work-does-not-run-or-refund',()=>{
  const beforeTrace=attempt();let invoked=0;
  const beforeBudget=createNativeSpatialGeometryWorkBudget(beforeTrace,2,()=>{beforeTrace.stopReason='deadline';throw new Error('deadline');});
  assert.throws(()=>beforeBudget.run({kind:'final-geometry',candidate:0},()=>{invoked++;return{accepted:true,reasons:[]};}),/deadline/);assert.equal(invoked,0);assert.equal(beforeTrace.geometryEvaluations,0);
  const duringTrace=attempt();let expired=false;const duringBudget=createNativeSpatialGeometryWorkBudget(duringTrace,2,()=>{if(expired){duringTrace.stopReason='deadline';throw new Error('deadline');}});
  assert.throws(()=>duringBudget.run({kind:'initial-hole-identity',candidate:0,objectIndex:1,site:{x:8,y:8}},()=>{invoked++;expired=true;return{accepted:false,reasons:['identity-failed']};}),/deadline/);
  assert.equal(duringTrace.geometryEvaluations,1);assert.equal(duringTrace.geometryWork[0].deadlineExceeded,true);assert.equal(duringTrace.geometryWork[0].outcome,'rejected');assert.equal(invoked,1);
  assert.throws(()=>duringBudget.run({kind:'final-geometry',candidate:1},()=>{invoked++;return{accepted:true,reasons:[]};}),/deadline/);assert.equal(invoked,1);assert.equal(duringTrace.geometryEvaluations,1);
  return{expiredBeforeCalls:0,expiredDuringCalls:1,spentSlotAfterDeadline:1};
});
check('production-wraps-layout-before-compilation-and-final-build',()=>{
  const code=fs.readFileSync(files[0],'utf8'),start=code.indexOf("const measured=geometryWork.run({kind:'final-geometry',candidate}");assert(start>=0);
  const create=code.indexOf('proposal=createNativeSpatialLayout(',start),build=code.indexOf('const geometry=buildNativeSpatialGeometry(',start),counter=code.indexOf('attempt.finalGeometryEvaluations!++',start);
  assert(start<create&&create<counter&&counter<build);assert(code.slice(create,counter).includes('bayCountIndex,geometryWork)'));
  assert(code.includes("if(attempt.stopReason==='geometry-work-budget')return"));
  return{scope:'Static integration assertion, not a generated map.',layoutInsideReservedFinalWork:true,nestedContextForwarded:true,finalMeasurementCounterBeforeBuild:true};
});
const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(row=>row.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),scope:'Finite callback/exception/deadline fixtures. No native layout, fragment, geometry, seed or full candidate was generated.',sourceHashes:before,sourceHashesAfter:after,sourcesStable,cases};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
