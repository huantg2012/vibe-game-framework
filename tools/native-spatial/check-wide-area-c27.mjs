/** One existing single scan on saved c27. No fresh generation or retry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createNativeSpatialLayout,nativeSpatialPlanningWideRatio} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback,nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {NativeSpatialWideDomain} from '../../src/generation/world-study/native-spatial-wide-domain.ts';

const out=process.argv[2];assert(out&&!fs.existsSync(out),'Supply a NEW directory');fs.mkdirSync(out,{recursive:true});
const source='docs/qa/artifacts/native-spatial-2026-10-14/wide-bias-replay/candidate-27.json';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const snapshot=()=>Object.fromEntries([...walk('src').filter(p=>/\.(ts|tsx|js|json)$/.test(p)),...walk('data').filter(p=>p.endsWith('.csv')),source,'tools/native-spatial/check-wide-area-c27.mjs'].sort().map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes=snapshot(),saved=JSON.parse(fs.readFileSync(source,'utf8')),input=saved.input,seed=20261012;
const native=createR100NativeSpatialDevelopmentRecipe('gel-rafts',seed,'medium').nativeDefinition;
function compile(proposal){
  const geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
  const gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  return{geometry,groups,gate,hash:nativeSpatialGeometryFingerprint(geometry,proposal).hash};
}
const before=compile(saved.proposal);assert.equal(before.hash,'1100442b556caf23','Saved c27 geometry must replay exactly');
const cache=createNativeSpatialActualVoidFeedback(before.geometry,before.groups,saved.proposal.holes);assert(cache.feedback,cache.reason);
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
try{const started=performance.now();proposal=createNativeSpatialLayout(native,input,seed,seed,28,{layout:saved.proposal,gate:before.gate,actualVoid:cache.feedback});operatorMs=performance.now()-started;}
finally{NativeSpatialWideDomain.prototype.evaluate=originalEvaluate;}
assert.equal(proposal.plan.refinement.kind,'single');
const evaluationCounts=singleEvaluations.reduce((counts,e)=>(counts[e.index]=(counts[e.index]??0)+1,counts),{});
assert(Object.values(evaluationCounts).every(n=>n<=12));
const after=compile(proposal),prediction=proposal.plan.wideEstimate;
assert.equal(prediction.source,'actual-void-fixed-body');assert.equal(prediction.supportedBodySeats,bodyCount);
assert.equal(prediction.correctedRatio,prediction.wideCount/bodyCount);
const sourceHashesAfter=snapshot(),report={scope:'One saved c27 single refinement; fixed old denominator is prediction, final gate uses newly compiled body domain. Not production admission.',sourceHashes,sourceHashesAfter,sourcesStable:JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter),operatorMs,before:{hash:before.hash,gate:before.gate,measurement:baseline,prediction:baseline.wideCount/bodyCount},after:{hash:after.hash,gate:after.gate,prediction,actualBodySeats:after.gate.metrics.supportedBodySeats,actualWideCount:Math.round(after.gate.metrics.wideRatio*after.gate.metrics.supportedBodySeats),predictionMinusActual:prediction.correctedRatio-after.gate.metrics.wideRatio},refinement:proposal.plan.refinement,evaluationCounts,singleEvaluations};
assert(report.sourcesStable);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(out+'/proposal.json',JSON.stringify({input,proposal,gate:after.gate},null,2)+'\n');
console.log(JSON.stringify({sourcesStable:report.sourcesStable,operatorMs,beforeHash:before.hash,afterHash:after.hash,beforeWide:before.gate.metrics.wideRatio,afterWide:after.gate.metrics.wideRatio,prediction,actualBodySeats:after.gate.metrics.supportedBodySeats,predictionMinusActual:report.after.predictionMinusActual,max:after.gate.metrics.maxEmptyUpperPx,deep:after.gate.metrics.maxDeepSpanPx,largest:after.gate.metrics.largestWideRatio,reasons:after.gate.reasons,evaluationCounts},null,2));
