/** One saved c27 single scan preserving each incumbent with exact G1 upper-bound pruning. */
import assert from 'node:assert/strict';
import {nativeSpatialG1HoleFootprints} from '../../src/generation/world-study/native-spatial-g1-field.ts';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createNativeSpatialLayout,nativeSpatialPlanningWideRatio,nativeSpatialPlanningCoverage} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback,nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {NativeSpatialWideDomain,compareNativeSpatialConstraintScores} from '../../src/generation/world-study/native-spatial-wide-domain.ts';

const out=process.argv[2];assert(out&&!fs.existsSync(out),'Supply a NEW directory');fs.mkdirSync(out,{recursive:true});
const source='docs/qa/artifacts/native-spatial-2026-10-14/wide-bias-replay/candidate-27.json';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const snapshot=()=>Object.fromEntries([...walk('src').filter(p=>/\.(ts|tsx|js|json)$/.test(p)),...walk('data').filter(p=>p.endsWith('.csv')),source,'tools/native-spatial/check-g1-incumbent-c27.mjs'].sort().map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes=snapshot(),saved=JSON.parse(fs.readFileSync(source,'utf8')),input=saved.input,seed=20261012;
const evidence={stage:'native-definition'};
try{
const native=createR100ProductionRecipe('gel-rafts',seed,'medium').nativeDefinition;
function compile(proposal){
  const geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
  const gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  return{geometry,groups,gate,hash:nativeSpatialGeometryFingerprint(geometry,proposal).hash};
}
evidence.stage='before-compile';
const before=compile(saved.proposal);evidence.before={hash:before.hash,gate:before.gate};assert.equal(before.hash,'1100442b556caf23','Saved c27 geometry must replay exactly');
evidence.stage='actual-cache';
const cache=createNativeSpatialActualVoidFeedback(before.geometry,before.groups,saved.proposal.holes);assert(cache.feedback,cache.reason);
const holeSources=saved.proposal.plan.objects.filter(o=>o.kind==='hole').map((o,index)=>({holeId:`hole-${index}`,site:o.site})),localH=nativeSpatialG1HoleFootprints(cache.feedback,holeSources);
const predictedH=layout=>layout.plan.objects.filter(o=>o.kind==='hole').map((o,index)=>({id:`hole-${index}`,kind:'hole',boundary:localH.get(`hole-${index}`).map(p=>nativePrimitive(p.points.map((v,i)=>v+(i%2?o.site.y:o.site.x)),p.objectId))}));
const cachedTree=nativePrimitiveTree(predictedH(saved.proposal).flatMap(s=>s.boundary)),actualTree=nativePrimitiveTree(before.groups.structures.filter(s=>s.kind==='hole').flatMap(s=>s.boundary));let originalPositionQueries=0,maxOriginalPositionError=0;
for(let cell=0;cell<before.geometry.supported.length;cell++)if(before.geometry.supported[cell]){const x=(cell%before.geometry.terrain.cols+.5)*8,y=(Math.floor(cell/before.geometry.terrain.cols)+.5)*8;maxOriginalPositionError=Math.max(maxOriginalPositionError,Math.abs(nativePrimitiveDistance(cachedTree,x,y)-nativePrimitiveDistance(actualTree,x,y)));originalPositionQueries++;}
assert.equal(maxOriginalPositionError,0);
let holeIndex=0;
const objects=saved.proposal.plan.objects.map(o=>{
  const ids=new Set(o.instances.filter(i=>i.role==='solid').map(i=>i.id));
  const blocking=before.geometry.solidPrimitives.filter(p=>ids.has(p.objectId)).map(p=>nativePrimitive(p.points.map((v,i)=>v-(i%2?o.site.y:o.site.x)),p.objectId));
  return{site:o.site,blocking,...(o.kind==='hole'?{holeId:`hole-${holeIndex++}`}:{})};
});
const baseDomain=new NativeSpatialWideDomain(cache.feedback,objects,input.policy.wideRadiusPx),baseline=baseDomain.measure(),bodyCount=before.gate.metrics.supportedBodySeats;
assert.equal(baseline.wideCount,10072);assert.equal(bodyCount,18632);
assert.equal(nativeSpatialPlanningWideRatio(0,0,baseline,bodyCount),before.gate.metrics.wideRatio);
// This finite instrument observes the existing single-candidate callback; it
// does not introduce positions or invoke a second scan.
const originalEvaluate=NativeSpatialWideDomain.prototype.evaluate,singleEvaluations=[];
NativeSpatialWideDomain.prototype.evaluate=function(index,site){const measurement=originalEvaluate.call(this,index,site);singleEvaluations.push({index,site:{...site},...measurement,ratio:measurement.wideCount/bodyCount});return measurement;};
let proposal,operatorMs;
evidence.stage='single-refinement';
try{const started=performance.now();proposal=createNativeSpatialLayout(native,input,seed,seed,28,{layout:saved.proposal,gate:before.gate,actualVoid:cache.feedback});operatorMs=performance.now()-started;}
finally{NativeSpatialWideDomain.prototype.evaluate=originalEvaluate;}
evidence.refinement=proposal.plan.refinement;evidence.proposal=proposal;evidence.operatorMs=operatorMs;evidence.stage='single-contracts';
assert.equal(proposal.plan.refinement.kind,'single');
const evaluationCounts=singleEvaluations.reduce((counts,e)=>(counts[e.index]=(counts[e.index]??0)+1,counts),{});
assert(Object.values(evaluationCounts).every(n=>n<=12));
const firstSites=Object.keys(evaluationCounts).map(key=>{const index=Number(key),first=singleEvaluations.find(e=>e.index===index);assert.deepEqual(first.site,saved.proposal.plan.objects[index].site,'Each legal incumbent must be evaluated first');return{index,site:first.site,count:evaluationCounts[index]};});
assert(compareNativeSpatialConstraintScores(proposal.plan.refinement.after,proposal.plan.refinement.before)<=0,'Single scan cannot worsen its complete objective');
const fieldTrace=proposal.plan.g1Field,pruning={fullScanEquivalentQueries:fieldTrace.maximumEvaluations*(fieldTrace.gridPointCount+fieldTrace.assessmentPointsAdded),actualQueries:fieldTrace.maximumDistanceQueries,cachedQueries:fieldTrace.cachedDistanceQueries};
pruning.savedQueries=pruning.fullScanEquivalentQueries-pruning.actualQueries;
evidence.stage='after-compile';
const after=compile(proposal),prediction=proposal.plan.wideEstimate;
evidence.after={hash:after.hash,gate:after.gate};evidence.stage='after-contracts';
assert.equal(prediction.source,'actual-void-fixed-body');assert.equal(prediction.supportedBodySeats,bodyCount);
assert.equal(prediction.correctedRatio,prediction.wideCount/bodyCount);
function pointAudit(compiled,layout,point){
  const raw=nativeSpatialPlanningCoverage(layout,seed),nearest=(structures,kind)=>structures.filter(s=>s.kind===kind).map(s=>({id:s.id,distance:nativePrimitiveDistance(nativePrimitiveTree(s.boundary),point.x,point.y)})).sort((a,b)=>a.distance-b.distance)[0]??null;
  return{point,predictedH:nearest(predictedH(layout),'hole'),rawH:nearest(raw,'hole'),rawS:nearest(raw,'solid'),finalH:nearest(compiled.groups.structures,'hole'),finalS:nearest(compiled.groups.structures,'solid')};
}
const g1Audit={beforeAtHistoricalWorst:pointAudit(before,saved.proposal,{x:948,y:524}),afterAtHistoricalWorst:pointAudit(after,proposal,{x:948,y:524}),beforeAtActualWorst:pointAudit(before,saved.proposal,before.gate.metrics.worstEmptyPoint),afterAtActualWorst:pointAudit(after,proposal,after.gate.metrics.worstEmptyPoint)};
const sourceHashesAfter=snapshot(),report={scope:'One saved c27 single refinement: legal incumbent is first of at most twelve unique complete trials, only strict score improvements replace it. G1 upper-bound pruning is mathematically exact; actual-H translation remains prediction only. Raw support/rough/deep/mean, G3, candidate quotas and actual gates unchanged. Not production admission.',sourceHashes,sourceHashesAfter,sourcesStable:JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter),operatorMs,firstSites,pruning,originalPositionQueries,maxOriginalPositionError,g1Field:proposal.plan.g1Field,g1Audit,before:{hash:before.hash,gate:before.gate,measurement:baseline,prediction:baseline.wideCount/bodyCount},after:{hash:after.hash,gate:after.gate,prediction,actualBodySeats:after.gate.metrics.supportedBodySeats,actualWideCount:Math.round(after.gate.metrics.wideRatio*after.gate.metrics.supportedBodySeats),predictionMinusActual:prediction.correctedRatio-after.gate.metrics.wideRatio},refinement:proposal.plan.refinement,evaluationCounts,singleEvaluations};
assert(report.sourcesStable);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(out+'/proposal.json',JSON.stringify({input,proposal,gate:after.gate},null,2)+'\n');
console.log(JSON.stringify({sourcesStable:report.sourcesStable,operatorMs,firstSites,pruning,refinement:proposal.plan.refinement,beforeHash:before.hash,afterHash:after.hash,originalPositionQueries,maxOriginalPositionError,g1Field:proposal.plan.g1Field,g1Audit,beforeWide:before.gate.metrics.wideRatio,afterWide:after.gate.metrics.wideRatio,prediction,actualBodySeats:after.gate.metrics.supportedBodySeats,predictionMinusActual:report.after.predictionMinusActual,max:after.gate.metrics.maxEmptyUpperPx,deep:after.gate.metrics.maxDeepSpanPx,largest:after.gate.metrics.largestWideRatio,reasons:after.gate.reasons,evaluationCounts},null,2));

}catch(error){
  const sourceHashesAfter=snapshot(),{proposal,...progress}=evidence;
  const failure={scope:'Only authorized fixed c27 attempt; failed attempts are retained and must not be retried automatically.',...progress,error:{name:error?.name??'Error',message:String(error?.message??error),stack:error?.stack},sourceHashes,sourceHashesAfter,sourcesStable:JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter)};
  fs.writeFileSync(out+'/failure.json',JSON.stringify(failure,null,2)+'\n');
  if(proposal)fs.writeFileSync(out+'/failed-proposal.json',JSON.stringify({input,proposal},null,2)+'\n');
  console.error(JSON.stringify(failure.error));process.exitCode=1;
}
