/** Finite synthetic capacity/transaction checks. No map compile or sampling. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {createNativeSpatialInitialPlacement,solveNativeSpatialInitialMatching} from '../../src/generation/world-study/native-spatial-initial-placement.ts';
import {createNativeSpatialGeometryWorkBudget} from '../../src/generation/world-study/native-spatial-generation.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output));
const paths=['src/generation/world-study/native-spatial-initial-placement.ts','src/generation/world-study/native-spatial-layout.ts','src/generation/world-study/native-spatial-generation.ts','src/generation/world-study/native-spatial-types.ts','tools/native-spatial/check-initial-placement.mjs'];
const snapshot=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));const sourceHashes=snapshot(),cases=[];
function check(id,run){try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify(cases.at(-1)));}
const rectangle=(cx,id)=>[nativePrimitive([cx-4,-4,cx+4,-4,cx+4,4],id),nativePrimitive([cx-4,-4,cx+4,4,cx-4,4],id)];
const object=(id,cx=0)=>({id,kind:'solid',support:rectangle(cx,id.charCodeAt(0)),blocking:rectangle(cx,id.charCodeAt(0))});
const ground={contains:()=>true,margin:()=>1000,supportsFootprint:()=>true},score={maximum:0,sum:0,mean:0};
const context=(objects,field,gapPx=8)=>({objects,field,ground,gapPx,firstAnchorIndex:0,checkpoint:()=>{},evaluate:placements=>{assert.equal(placements.length,objects.length);assert.equal(new Set(placements.map(p=>p.id)).size,objects.length);return score;}});
check('bottleneck-before-squared-sum-and-alias-ban',()=>{
  const matrix=[[1,2],[2,100]].map((row,i)=>row.map((cost,region)=>({objectId:String(i),region,site:{x:region*8,y:0},cost})));
  const result=solveNativeSpatialInitialMatching(matrix,new Set(),()=>{});assert.deepEqual(result.map(e=>e.region),[1,0]);
  const aliases=matrix.map(row=>row.map(e=>({...e,site:{x:0,y:0}})));
  assert.equal(solveNativeSpatialInitialMatching(aliases,new Set(['0@0,0']),()=>{}),undefined);return{assignment:[1,0],allPoseAliasesForbidden:true};
});
check('conflicting-best-reassigns-all-objects-before-commit',()=>{
  const ctx=context([object('a',100),object('b')],[{x:0,y:0},{x:200,y:0}],120),result=createNativeSpatialInitialPlacement(ctx);
  assert(result.trace.states.some(s=>s.conflict));assert.deepEqual(result.placements,[{id:'a',site:{x:200,y:0}},{id:'b',site:{x:0,y:0}}]);
  assert(result.trace.counts.matchingStates<=12);return{states:result.trace.states.length,placements:result.placements};
});
check('object-array-order-cannot-change-id-assignment',()=>{
  const ctx=context([object('a',100),object('b')],[{x:0,y:0},{x:200,y:0}],120),a=createNativeSpatialInitialPlacement(ctx),b=createNativeSpatialInitialPlacement({...ctx,objects:[...ctx.objects].reverse()});
  assert.deepEqual(a.placements,b.placements);assert.deepEqual(a.trace.objectIds,b.trace.objectIds);return{stable:true};
});
check('empty-independent-support-domain-rejects-whole-plan',()=>{
  let failure;try{createNativeSpatialInitialPlacement({...context([object('a')],[{x:0,y:0}]),ground:{...ground,supportsFootprint:()=>false}});}catch(error){failure=error;}
  assert.equal(failure.initialPlacement.status,'empty-domain');assert.equal(failure.initialPlacement.domains[0].count,0);assert.equal(failure.initialPlacement.states.length,0);return{status:failure.initialPlacement.status};
});
check('matching-and-update-share-twelve-state-cap',()=>{
  let failure;const objects=['a','b','c','d'].map(id=>object(id)),field=[0,200,400,600].map(x=>({x,y:0}));
  try{createNativeSpatialInitialPlacement(context(objects,field,1000));}catch(error){failure=error;}
  assert.equal(failure.initialPlacement.status,'state-budget');assert.equal(failure.initialPlacement.states.length,12);assert.equal(failure.initialPlacement.counts.updateStates,0);assert.equal(failure.initialPlacement.counts.globalScores,0);
  const ctx=context([object('a'),object('b')],[{x:0,y:0},{x:64,y:0},{x:128,y:0}]);
  const result=createNativeSpatialInitialPlacement({...ctx,evaluate:()=>({maximum:1,sum:1,mean:0})});assert(result.trace.states.length<=12);assert.equal(result.trace.counts.matchingStates,1);assert.equal(result.trace.counts.updateStates,3);assert(result.trace.counts.localScores<=ctx.objects.length*12);
  assert.deepEqual(result.trace.states.filter(s=>s.kind==='update').map(s=>s.alpha),[1,.5,.25]);return{unresolvedStates:12,legalBaselineStates:result.trace.states.length,t0Reused:true};
});
check('pure-checkpoint-does-not-spend-geometry-work',()=>{
  const attempt={geometrySeed:1,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};let checkpoints=0;
  const budget=createNativeSpatialGeometryWorkBudget(attempt,72,()=>{if(++checkpoints===3)throw new Error('finite-deadline');});
  assert.throws(()=>createNativeSpatialInitialPlacement({...context([object('a'),object('b')],[{x:0,y:0},{x:200,y:0}]),checkpoint:budget.checkpoint}),/finite-deadline/);assert.equal(attempt.geometryEvaluations,0);return{checkpoints,geometryWork:0};
});
const sourceHashesAfter=snapshot(),report={scope:'Synthetic finite initial assignment, no map sampling.',sourceHashes,sourceHashesAfter,sourcesStable:JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter),cases};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');assert(report.sourcesStable);assert(cases.every(c=>c.passed));
