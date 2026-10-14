/** Finite refinement selection and shared-budget checks. No map generation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {selectNativeSpatialSite} from '../../src/generation/world-study/native-spatial-layout.ts';
import {nativeSpatialConstraintScore} from '../../src/generation/world-study/native-spatial-wide-domain.ts';
import {createNativeSpatialGeometryWorkBudget} from '../../src/generation/world-study/native-spatial-generation.ts';
import {NativeSpatialGeometryWorkBudgetError} from '../../src/generation/world-study/native-spatial-types.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
const files=['src/generation/world-study/native-spatial-layout.ts','src/generation/world-study/native-spatial-types.ts','src/generation/world-study/native-spatial-generation.ts','src/generation/world-study/native-spatial-hole-qualification.ts','tools/native-spatial/check-refinement-hole-qualification.mjs'];
const snapshot=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=snapshot(),cases=[],incumbent={x:100,y:0},score=n=>nativeSpatialConstraintScore([n],n);
const accepted={accepted:true,reasons:[],invalidHoleIds:[]},rejected={accepted:false,reasons:['hole-profile-final-identity'],invalidHoleIds:['hole-3']};
const attempt=()=>({geometrySeed:1,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'});
const sites=values=>values.map(x=>({x,y:0}));
function check(id,run){try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify(cases.at(-1)));}

check('score-order-first-qualified-strict-improvement',()=>{
  const calls=[];
  const result=selectNativeSpatialSite(sites([3,1,2,4]),p=>score(p.x===100?5:p.x),incumbent,p=>{calls.push(p.x);return p.x===1?rejected:accepted;});
  assert.deepEqual(result,{x:2,y:0});assert.deepEqual(calls,[1,2]);
  return{qualifiedInOrder:calls,selected:result};
});
check('all-qualified-rejections-retain-measured-incumbent',()=>{
  const calls=[];const result=selectNativeSpatialSite(sites([3,1,2]),p=>score(p.x===100?5:p.x),incumbent,p=>{calls.push(p.x);return rejected;});
  assert.deepEqual(result,incumbent);assert.deepEqual(calls,[1,2,3]);
  return{checks:calls.length,selected:result};
});
check('equal-and-worse-scores-never-compile',()=>{
  let checks=0;const result=selectNativeSpatialSite(sites([5,6,7]),p=>score(p.x===100?5:p.x),incumbent,()=>{checks++;return accepted;});
  assert.deepEqual(result,incumbent);assert.equal(checks,0);
  return{checks};
});
check('incumbent-one-of-twelve-no-refill-after-identity-rejection',()=>{
  const evaluations=[],checks=[];
  const candidates=[incumbent,...sites(Array.from({length:20},(_,i)=>i+1)).flatMap(p=>[p,p])];
  const result=selectNativeSpatialSite(candidates,p=>{evaluations.push(p.x);return score(p.x===100?30:p.x);},incumbent,p=>{checks.push(p.x);return p.x===12?accepted:rejected;});
  assert.deepEqual(evaluations,[100,...Array.from({length:11},(_,i)=>i+1)]);
  assert.deepEqual(checks,Array.from({length:11},(_,i)=>i+1));assert.deepEqual(result,incumbent);
  return{fullScores:evaluations.length,checks:checks.length,unvisitedPassingSite:12};
});
check('no-unmeasured-or-illegal-incumbent-fallback',()=>{
  let checks=0;assert.throws(()=>selectNativeSpatialSite(sites([1]),()=>score(1),undefined,()=>{checks++;return accepted;}),/requires a valid incumbent/);
  assert.throws(()=>selectNativeSpatialSite(sites([1]),p=>p.x===100?undefined:score(1),incumbent,()=>{checks++;return accepted;}),/incumbent is no longer legal/);
  assert.equal(checks,0);return{checks};
});
check('refinement-checks-share-final-budget-exhaustion-propagates',()=>{
  const trace=attempt(),budget=createNativeSpatialGeometryWorkBudget(trace,2,()=>{});let actualChecks=0;
  assert.throws(()=>budget.run({kind:'final-geometry',candidate:1},()=>{
    selectNativeSpatialSite(sites([1,2]),p=>score(p.x===100?5:p.x),incumbent,site=>budget.run({kind:'refinement-hole-identity',candidate:1,objectIndex:3,site},()=>{actualChecks++;return rejected;}));
    return accepted;
  }),error=>error instanceof NativeSpatialGeometryWorkBudgetError);
  assert.equal(actualChecks,1);assert.equal(trace.geometryEvaluations,2);assert.equal(trace.stopReason,'geometry-work-budget');
  assert.deepEqual(trace.geometryWork.map(row=>row.kind),['final-geometry','refinement-hole-identity']);
  assert.deepEqual(trace.geometryWork.map(row=>row.outcome),['exception','rejected']);
  return{actualChecks,workSpent:trace.geometryEvaluations,trace:trace.geometryWork};
});
check('deadline-during-qualification-is-not-a-rejected-site-or-refund',()=>{
  const trace=attempt(),expiredError=new Error('fixture deadline');let expired=false,checks=0;
  const budget=createNativeSpatialGeometryWorkBudget(trace,72,()=>{if(expired)throw expiredError;});
  assert.throws(()=>selectNativeSpatialSite(sites([1,2]),p=>score(p.x===100?5:p.x),incumbent,site=>budget.run({kind:'refinement-hole-identity',candidate:1,objectIndex:3,site},()=>{checks++;expired=true;return rejected;})),error=>error===expiredError);
  assert.equal(checks,1);assert.equal(trace.geometryEvaluations,1);assert.equal(trace.geometryWork[0].deadlineExceeded,true);
  return{checks,workSpent:trace.geometryEvaluations};
});
check('production-H-only-complete-sources-and-catch-budget-escape',()=>{
  const code=fs.readFileSync(files[0],'utf8');
  const start=code.indexOf("const qualify=objects[i]!.kind==='hole'?");assert(start>=0);
  const end=code.indexOf('const after=evaluate([]);refinement={kind:\'single\'',start);assert(end>start);
  const block=code.slice(start,end);
  assert(block.includes('objects.map((source,index)=>index===i?{...source,site}:source)'));
  assert(block.includes("kind:'refinement-hole-identity'"));assert(block.includes('holePlacements(sources),counts.holes'));
  assert(block.includes('}:undefined;'));assert(block.includes('objects[i]!.site,undefined,qualify)'));
  const rethrow=block.indexOf('if(error instanceof NativeSpatialGeometryWorkBudgetError)throw error');
  assert(rethrow>=0&&block.indexOf('geometryWork.checkpoint()',rethrow)>rethrow);
  assert.deepEqual(selectNativeSpatialSite(sites([3,1,2]),p=>score(p.x===100?5:p.x),incumbent),{x:1,y:0});
  return{scope:'Static integration plus unqualified S selector regression; no fragment compiled.',HUsesCompleteCurrentSources:true,SHasNoQualification:true};
});

const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(c=>c.passed)&&sourcesStable?'passed':'failed',scope:'Eight finite pure selector/shared-work fixtures. No fragment, layout, geometry or new seed was generated.',sourceHashes:before,sourceHashesAfter:after,sourcesStable,cases};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
