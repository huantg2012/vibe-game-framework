/** Control-flow units: injected geometry stages are labelled stubs, never map evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {NATIVE_SPATIAL_POLICY as policy} from '../../src/generated/r100-native-spatial.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const file='src/generation/world-study/native-spatial-generation.ts',sourceHash=createHash('sha256').update(fs.readFileSync(file)).digest('hex'),bundle=path.resolve(output,'controller-fixture.mjs');
const stubs={
  'native-spatial-layout':`export const nativeSpatialCountPairs=()=>[{holes:2,solids:1}];export const createNativeSpatialLayout=(...args)=>globalThis.__routeControllerFixture.plan(...args);`,
  'native-spatial-geometry':`export const buildNativeSpatialGeometry=(definition)=>globalThis.__routeControllerFixture.geometry(definition);export const createNativeSpatialActualVoidFeedback=()=>({feedback:{holes:[]}});`,
  'native-spatial-measure':`export const identifyNativeSpatialStructures=()=>({structures:[]});export const evaluateNativeSpatialGeometry=()=>globalThis.__routeControllerFixture.ground;`,
  'native-spatial-visibility':`export const evaluateNativeSpatialVisibility=()=>({accepted:true,reasons:[],metrics:{}});`,
  'native-spatial-route-feedback':`export const evaluateNativeSpatialRouteProbe=(probe,geometry,...rest)=>globalThis.__routeControllerFixture.route(probe,geometry);`,
};
await build({entryPoints:[file],outfile:bundle,bundle:true,platform:'node',format:'esm',tsconfig:'tools/contam-preview/tsconfig.json',logLevel:'silent',plugins:[{name:'labelled-control-flow-stubs',setup(b){b.onResolve({filter:/^\.\/native-spatial-/},args=>{const name=args.path.slice(2);return name in stubs?{path:name,namespace:'fixture'}:undefined;});b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js'}));}}]});
const {createNativeSpatialGeometryCandidates}=await import(pathToFileURL(bundle).href),cases=[];
const report={status:'running',scope:'Actual generator control flow with explicit injected stage stubs. Zero real geometry, deployments or map admission; real c27 gate/witness evidence is separate.',sourceHash,cases};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const check=(id,run)=>{try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}save();};
function fixture(mode){
  const attempt={geometrySeed:7,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:1,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'},calls=[];
  const ground={accepted:true,reasons:[],metrics:{holes:2,solids:1,targetCount:3,minCount:3,maxCount:3,rejectedObjects:[],reachableBodySeats:1,supportedBodySeats:1,walkAreaPx2:64,targetWalkAreaPx2:64,maxEmptyUpperPx:1,maxDeepSpanPx:1,wideRatio:1,largestWideRatio:1}};
  const routeFeedback=(probe,accepted,score)=>({probe,gate:{accepted,reasons:accepted?[]:['route:hole-share'],metrics:{}},comparable:true,comparabilityReasons:[],violations:[score],maximum:score,sum:score,witnesses:[],refinementOrdinal:0,remainingTupleBudget:48,seenTupleKeys:[]});
  const plan=(native,input,requestedSeed,seed,candidate,previous)=>{
    const feedback=previous?.routeFeedback;calls.push({candidate,previous:previous?.layout.candidate,remaining:feedback?.remainingTupleBudget,ordinal:feedback?.refinementOrdinal});
    let trace;
    if(feedback){const consumed=mode==='epoch'?(candidate===1?30:18):candidate===1?2:1,old=feedback.seenTupleKeys;
      trace={consumedTuples:consumed,nextOrdinal:feedback.refinementOrdinal+consumed,seenTupleKeys:[...old,...Array.from({length:consumed},(_,i)=>`${candidate}:${i}`)],exhausted:false};
      if(candidate===1&&(mode==='post-selection-error'||mode==='deadline')){const error=Object.assign(new Error(mode),{routeRefinement:trace});if(mode==='deadline')attempt.stopReason='deadline';throw error;}
    }
    return{candidate,countPairIndex:0,bayCountIndex:0,layoutSeed:candidate,requestedCounts:{holes:2,solids:1},definition:{fixtureCandidate:candidate},holes:[{candidate}],assemblies:[],bays:[],landJoins:[],plan:{land:[],...(trace?{refinement:{kind:'route',route:trace}}:{})}};
  };
  const geometry=definition=>({candidate:definition.fixtureCandidate,terrain:{cols:1,rows:1,matter:Uint8Array.of(1),meshes:[],roles:new Map(),definition:{terrainOutline:[],erosion:[]}},reachable:Uint8Array.of(1)});
  globalThis.__routeControllerFixture={plan,geometry,ground,route:(probe,geometry)=>routeFeedback(probe,mode!=='epoch'&&geometry.candidate>=2,geometry.candidate===1?.5:.25)};
  const generator=createNativeSpatialGeometryCandidates({}, {policy,world:{bayCountOptions:[0]},holeProfiles:[],bayProfiles:[]},7,7,attempt,()=>{if(attempt.stopReason==='deadline')throw new Error('deadline-final-checkpoint');});
  const first=generator.next();assert(!first.done);const probe={geometrySeed:7,sourceCandidate:0,sourceGeometryHash:first.value.trace.geometryHash};
  return{attempt,calls,generator,feedback:routeFeedback(probe,false,1)};
}
check('yield-consumes-feedback-and-only-passed-probe-yields-next-full-survivor',()=>{
  const f=fixture('normal'),next=f.generator.next(f.feedback);assert.equal(next.value.layout.candidate,2);assert.deepEqual(f.calls.map(c=>c.previous),[undefined,0,1]);
  assert.deepEqual(f.calls.slice(1).map(c=>c.remaining),[48,46]);assert.equal(f.attempt.routeEpochs[0].consumedTuples,3);assert.equal(f.attempt.routeEpochs[0].probeEvaluations,2);assert.equal(f.attempt.fullCandidates,1);f.generator.return();
  return{sourceCandidate:0,nextYieldCandidate:2,probeEvaluations:2,tupleConsumed:3,fullCountUnchanged:1};
});
check('new-better-base-cannot-refresh-epoch-and-fresh-loses-old-probe',()=>{
  const f=fixture('epoch'),next=f.generator.next(f.feedback);assert.equal(next.value.layout.candidate,3);assert.equal(f.calls[2].previous,1);assert.equal(f.calls[2].remaining,18);assert.equal(f.calls[2].ordinal,0);assert.equal(f.calls[3].previous,undefined);
  assert.equal(f.attempt.routeEpochs.length,1);assert.equal(f.attempt.routeEpochs[0].consumedTuples,48);assert.equal(f.attempt.routeEpochs[0].ended,'tuple-budget');assert.equal(f.attempt.fullCandidates,1);f.generator.return();
  return{newBaseRemainder:18,sharedTupleConsumed:48,newFreshProbeAbsent:true,fullCountUnchanged:1};
});
check('post-selection-and-deadline-errors-preserve-spent-tuple-ledger',()=>{
  const f=fixture('post-selection-error'),next=f.generator.next(f.feedback);assert.equal(next.value.layout.candidate,2);assert.equal(f.attempt.routeEpochs[0].consumedTuples,3);assert.equal(f.calls[2].remaining,46);assert.equal(f.calls[2].ordinal,2);assert(f.attempt.candidates.find(c=>c.candidate===1).gates.routePlanning);f.generator.return();
  const d=fixture('deadline');assert.throws(()=>d.generator.next(d.feedback),/deadline-final-checkpoint/);assert.equal(d.attempt.routeEpochs[0].consumedTuples,2);assert.equal(d.attempt.fullCandidates,1);
  return{postSelectionCharged:true,deadlineChargedBeforeRethrow:true,deadlineReplacementWithoutLayoutContextStillCharged:true};
});
delete globalThis.__routeControllerFixture;report.sourceHashAfter=createHash('sha256').update(fs.readFileSync(file)).digest('hex');report.sourcesStable=report.sourceHashAfter===sourceHash;report.status=cases.every(c=>c.passed)&&report.sourcesStable?'passed':'failed';save();console.log(JSON.stringify({status:report.status,cases},null,2));if(report.status!=='passed')process.exitCode=1;
