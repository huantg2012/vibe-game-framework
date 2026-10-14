/** One first legal tuple, actual geometry and official fixed-route probe. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deserialize,serialize} from 'node:v8';
import {gunzipSync,gzipSync} from 'node:zlib';
import {build} from 'esbuild';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const base='docs/qa/artifacts/native-spatial-2026-10-14';
const snapshot=`${base}/extra-travel-c17-round1/complete-runtime.v8.gz`,receipt=`${base}/production-gel-extra-travel-round1.json`,domainPath=`${base}/route-domain-c17-round1/report.json`;
const saved=deserialize(gunzipSync(fs.readFileSync(snapshot))),formal=JSON.parse(fs.readFileSync(receipt)),domain=JSON.parse(fs.readFileSync(domainPath));
const original=formal.failures[0],oldAttempt=original.diagnostics.attempts[0],prefix=oldAttempt.geometryWork.filter(w=>w.candidate<=17);
const prefixFinalMs=prefix.filter(w=>w.kind==='final-geometry').reduce((n,w)=>n+w.elapsedMs,0);
const allFinalMs=original.diagnostics.attempts.flatMap(a=>a.geometryWork??[]).filter(w=>w.kind==='final-geometry').reduce((n,w)=>n+w.elapsedMs,0);
const conservativePriorElapsedMs=prefixFinalMs+Math.max(0,original.elapsedMs-allFinalMs);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const files=[...walk('src'),...walk('data'),snapshot,receipt,domainPath,'tools/native-spatial/check-route-first-c17.mjs','tools/contam-preview/tsconfig.json','tools/contam-preview/phaser-stub.ts'];
const hashes=()=>Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'preparing',scope:'Only the first newly ranked legal tuple on saved actual c17. Counterfactual continuation from its original work/full prefix, not a fresh request, production admission, or retry of a second tuple. Original failed request is retained.',sourceHashes:hashes(),sourceCandidate:17,candidate:18,operations:{geometryCompiles:0,probeEvaluations:0,fullCandidatesAdded:0,freshRequests:0},budget:{limitWork:72,limitFull:2,limitMs:60000,originalPrefixWork:prefix.length,originalPrefixFull:1,prefixFinalMs,allUnallocatedOriginalMs:Math.max(0,original.elapsedMs-allFinalMs),conservativePriorElapsedMs,timeScope:'Original prefix inclusive final work plus ALL original request time outside final work is deducted conservatively; this is not an exact wall-clock process resume.'}};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const normalize=v=>JSON.parse(JSON.stringify(v));
function persist(value,name){
  const seen=new WeakMap();function copy(v){if(v===null||typeof v!=='object')return typeof v==='function'?undefined:v;if(seen.has(v))return seen.get(v);if(ArrayBuffer.isView(v))return v.slice();if(v instanceof Map){const out=new Map();seen.set(v,out);for(const[k,item]of v)out.set(k,copy(item));return out;}if(v instanceof Set){const out=new Set();seen.set(v,out);for(const item of v)out.add(copy(item));return out;}const out=Array.isArray(v)?[]:{};seen.set(v,out);for(const[k,item]of Object.entries(v))if(typeof item!=='function')out[k]=copy(item);return out;}
  fs.writeFileSync(path.join(output,name),gzipSync(serialize(copy(value))));
}
let started;
try{
  const root=path.resolve('src/generation/world-study'),bundle=path.resolve(output,'check.mjs');
  await build({stdin:{contents:`
export {createNativeSpatialLayout} from '${root}/native-spatial-layout.ts';
export {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback} from '${root}/native-spatial-geometry.ts';
export {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '${root}/native-spatial-measure.ts';
export {evaluateNativeSpatialVisibility} from '${root}/native-spatial-visibility.ts';
export {evaluateNativeSpatialRouteProbe} from '${root}/native-spatial-route-feedback.ts';
export {nativeSpatialGeometryFingerprint,createNativeSpatialGeometryWorkBudget} from '${root}/native-spatial-generation.ts';`,resolveDir:process.cwd(),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',target:'node22',tsconfig:'tools/contam-preview/tsconfig.json',alias:{phaser:path.resolve('tools/contam-preview/phaser-stub.ts')},logLevel:'silent'});
  const api=await import(pathToFileURL(bundle).href),recipe=saved.recipe,input=recipe.nativeSpatial,seed=recipe.requestedSeed,old=saved.candidate,expected=domain.steps[0];
  assert.equal(seed,20261012);assert.equal(prefix.length,62);assert.equal(input.policy.maxGeometryEvaluations,72);assert.equal(input.policy.maxFullCandidates,2);
  assert.equal(api.nativeSpatialGeometryFingerprint(old.geometry,old.layout).hash,'a2d4a4c15a186ba9');assert(old.trace.gates.geometry.accepted&&old.trace.gates.visibility.accepted);assert(saved.feedback.comparable&&!saved.gate.accepted);
  const actualVoid=api.createNativeSpatialActualVoidFeedback(old.geometry,old.groups,old.layout.holes);assert(actualVoid.feedback,actualVoid.reason);
  report.before={hash:old.trace.geometryHash,geometry:old.trace.gates.geometry,visibility:old.trace.gates.visibility,routes:saved.gate,feedback:{comparable:saved.feedback.comparable,maximum:saved.feedback.maximum,sum:saved.feedback.sum}};
  const attempt={geometrySeed:seed,proposalBudget:72,layoutProposals:18,geometryEvaluations:prefix.length,finalGeometryEvaluations:prefix.filter(w=>w.kind==='final-geometry'&&w.finalMeasurementStarted).length,geometryWork:structuredClone(prefix),fullCandidates:1,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
  report.attempt=attempt;report.routeEpoch={sourceCandidate:17,sourceGeometryHash:old.trace.geometryHash,tupleLimit:48,consumedTuples:0,probeEvaluations:0};save();
  started=performance.now();const checkpoint=()=>{if(conservativePriorElapsedMs+performance.now()-started>=60000)throw new Error('Fixed first tuple exceeded conservative original shared deadline');};
  const work=api.createNativeSpatialGeometryWorkBudget(attempt,72,checkpoint);
  const previous={layout:old.layout,gate:old.trace.gates.geometry,actualVoid:actualVoid.feedback,routeFeedback:{...saved.feedback,refinementOrdinal:0,remainingTupleBudget:48,seenTupleKeys:[]}};
  const charge=trace=>{report.routeEpoch.consumedTuples=trace.consumedTuples;report.routeTrace=trace;save();assert(trace.consumedTuples<=48);assert.equal(new Set(trace.seenTupleKeys).size,trace.consumedTuples);};
  const measured=work.run({kind:'final-geometry',candidate:18},()=>{
    let layout;try{layout=api.createNativeSpatialLayout(recipe.nativeDefinition,input,seed,seed,18,previous,old.layout.countPairIndex,old.layout.bayCountIndex,work);}catch(error){if(error.routeRefinement)charge(error.routeRefinement);throw error;}
    fs.writeFileSync(path.join(output,'proposal.json'),JSON.stringify({input,proposal:layout})+'\n');charge(layout.plan.refinement.route);
    assert.equal(layout.plan.refinement.kind,'route');assert.deepEqual(normalize(layout.plan.refinement.route),expected,'Production first tuple differs from frozen pure-helper result');
    checkpoint();attempt.finalGeometryEvaluations++;report.operations.geometryCompiles++;
    const geometry=api.buildNativeSpatialGeometry(layout.definition,seed),groups=api.identifyNativeSpatialStructures(geometry,layout.assemblies,input.policy),fingerprint=api.nativeSpatialGeometryFingerprint(geometry,layout);
    const ground=api.evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:layout.holes,profiles:input.holeProfiles},{landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
    const actual=api.createNativeSpatialActualVoidFeedback(geometry,groups,layout.holes);
    persist({recipe,sourceProbe:saved.probe,layout,geometry,groups,ground,geometryHash:fingerprint.hash,actualVoid:actual},'actual-geometry.v8.gz');
    report.after={hash:fingerprint.hash,geometry:ground,actualVoid:{available:!!actual.feedback,reason:actual.reason}};save();
    return{accepted:ground.accepted,reasons:ground.reasons,layout,geometry,groups,ground,fingerprint};
  });
  const {layout,geometry,groups,ground}=measured;
  if(ground.accepted){checkpoint();report.after.visibility=api.evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy);save();}
  if(ground.accepted&&report.after.visibility?.accepted){
    report.operations.probeEvaluations++;report.routeEpoch.probeEvaluations++;
    const feedback=api.evaluateNativeSpatialRouteProbe(saved.probe,geometry,groups,ground,input.policy,checkpoint);
    persist({recipe,layout,geometry,groups,ground,visibility:report.after.visibility,probe:saved.probe,feedback},'actual-route-runtime.v8.gz');
    report.after.routes=feedback.gate;report.after.feedback={comparable:feedback.comparable,comparabilityReasons:feedback.comparabilityReasons,maximum:feedback.maximum,sum:feedback.sum,violations:feedback.violations,witnessCount:feedback.witnesses.length};
    report.status=feedback.comparable&&feedback.gate.accepted?'fixed-probe-passed-not-full-admission':'fixed-probe-rejected';
  }else report.status='geometry-or-visibility-regressed-probe-skipped';
  checkpoint();save();assert.equal(report.operations.geometryCompiles,1);assert.equal(attempt.geometryEvaluations,63);assert.equal(attempt.fullCandidates,1);assert.equal(report.routeEpoch.consumedTuples,25);
}catch(error){report.status='failed';report.error=String(error.stack??error);if(error.routeRefinement)report.partialRouteTrace=error.routeRefinement;}
finally{report.elapsedMs=started===undefined?null:performance.now()-started;report.budget.conservativeElapsedMs=conservativePriorElapsedMs+(report.elapsedMs??0);report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();}
const compact=gate=>gate?{accepted:gate.accepted,reasons:gate.reasons,metrics:Object.fromEntries(['holes','solids','maxEmptyUpperPx','maxDeepSpanPx','wideRatio','largestWideRatio','holeProfileViolationCount','bayViolationCount','finalSourceSupportViolationCount'].filter(k=>k in gate.metrics).map(k=>[k,gate.metrics[k]]))}:null;
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,elapsedMs:report.elapsedMs,operations:report.operations,budget:report.budget,before:compact(report.before?.geometry),after:compact(report.after?.geometry),visibility:report.after?.visibility?{accepted:report.after.visibility.accepted,reasons:report.after.visibility.reasons}:null,routeReasons:report.after?.routes?.reasons,feedback:report.after?.feedback,error:report.error},null,2));
if(report.status==='failed'||report.status==='invalid-source-changed')process.exitCode=1;
