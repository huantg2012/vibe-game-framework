/** Rebuild already-qualified recipes after the local witness correction.
 * Compares exact full output separately from geometry/content/presentation
 * inputs; never bakes another material image or replaces earlier evidence. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {deserialize,serialize} from 'node:v8';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
const reports=process.argv.slice(2);assert(reports.length>0,'Supply completed production report paths');
const output=process.env.QA_REPORT??'docs/qa/artifacts/spatial-augmentation-2026-10-13/algorithm/reveal-focus-replay.json';
assert(!fs.existsSync(output),'Never overwrite previous evidence');
const finalCache=process.env.QA_MAP_CACHE??'/tmp/coh-spatial-augmentation-maps-focus-final';fs.mkdirSync(finalCache,{recursive:true});
const exactHash=value=>{const h=createHash('sha256');function visit(v){if(ArrayBuffer.isView(v)){h.update(`typed:${v.constructor.name}:${v.byteLength}:`).update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));return;}if(Array.isArray(v)){h.update(`array:${v.length}[`);for(const c of v)visit(c);h.update(']');return;}if(v&&typeof v==='object'){h.update('{');for(const k of Object.keys(v)){visit(k);visit(v[k]);}h.update('}');return;}assert.notEqual(typeof v,'function');const s=v===undefined?'undefined':JSON.stringify(v);h.update(`${typeof v}:${s.length}:${s}`);}visit(value);return h.digest('hex');};
const cases=reports.flatMap(file=>{const value=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(value.status,'passed');return value.cases;});
assert(new Set(cases.map(c=>c.cacheBase)).size===cases.length);
const sourcePaths=['src/generation/world-study/spatial-augmentation-selection.ts','src/generation/world-study/spatial-augmentation-candidates.ts','src/generation/world-study/spatial-augmentation-measure.ts','src/generation/world-study/r100-spatial-world.ts','data/rift-spatial-augmentation-policy.csv','data/rift-spatial-augmentation-profiles.csv'];
const sources=()=>Object.fromEntries(sourcePaths.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'running',reports,sourceHashes:sources(),cases:[],failures:[],limits:['Existing frozen recipes only, no fresh policy or authoring substitution.','A changed trace changes the full map hash; geometry/content/presentation hashes are reported separately.','Identical presentation inputs reuse previous material evidence; this run does not rebake surfaces.']};
const save=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};save();
const components=map=>{
  const {diagnostics:_diagnostics,...native}=map.native;
  return {geometryHash:exactHash({definition:native.definition,meshes:native.meshes,tileMap:map.layout.tileMap}),layoutHash:exactHash(map.layout),
    presentationInputsHash:exactHash({native,layout:map.layout,sample:map.sample,hostTileMap:map.hostTileMap}),traceHash:exactHash(map.native.diagnostics.spatialAugmentation),fullMapHash:exactHash(map)};
};
for(const item of cases) {
  try {
    let prior=deserialize(gunzipSync(fs.readFileSync(`${item.cacheBase}.map.v8.gz`)));
    assert.equal(exactHash(prior),item.mapHash,'Cached map does not match immutable report');
    const before=components(prior),priorSelected=prior.native.diagnostics.spatialAugmentation.acceptedCandidateIds;prior=null;global.gc?.();
    const recipe=JSON.parse(fs.readFileSync(`${item.cacheBase}.recipe.json`,'utf8')),start=performance.now();let afterMap=createR100ProductionMap(recipe);
    const elapsedMs=performance.now()-start,after=components(afterMap),trace=afterMap.native.diagnostics.spatialAugmentation;
    for(const receipt of trace.candidates)if(receipt.reveal)assert(Math.hypot(receipt.reveal.observer.x-receipt.hotspot.x,receipt.reveal.observer.y-receipt.hotspot.y)<=recipe.augmentationPolicy.parameters.hotspotRadiusPx+1e-9,'Final witness is outside candidate focus');
    const changed=Object.fromEntries(Object.keys(before).map(key=>[key,before[key]!==after[key]]));
    const cacheBase=path.join(finalCache,`${item.worldId}-${item.grade}-${item.requestedSeed}`);
    assert(!fs.existsSync(`${cacheBase}.map.v8.gz`),'Never overwrite a final cache map');fs.writeFileSync(`${cacheBase}.map.v8.gz`,gzipSync(serialize(afterMap)));fs.writeFileSync(`${cacheBase}.recipe.json`,JSON.stringify(recipe,null,2)+'\n');
    report.cases.push({worldId:item.worldId,grade:item.grade,requestedSeed:item.requestedSeed,effectiveSeed:afterMap.metadata.effectiveSeed,cacheBase,mapHash:after.fullMapHash,deployment:afterMap.native.diagnostics.spatialAugmentationDeployment,elapsedMs,before,after,changed,priorSelected,selected:trace.acceptedCandidateIds,
      status:trace.status,remainingDeficits:trace.remainingDeficits,revealReceipts:trace.candidates.filter(c=>c.reveal).map(c=>({id:c.id,accepted:c.accepted,observerDistanceFromHotspot:Math.hypot(c.reveal.observer.x-c.hotspot.x,c.reveal.observer.y-c.hotspot.y)}))});
    console.log(JSON.stringify({worldId:item.worldId,grade:item.grade,seed:item.requestedSeed,changed,elapsedMs}));afterMap=null;
  }catch(error){report.failures.push({worldId:item.worldId,grade:item.grade,requestedSeed:item.requestedSeed,error:error.stack??String(error)});}
  save();global.gc?.();
}
try{assert.deepEqual(sources(),report.sourceHashes,'Production sources changed during replay');}catch(error){report.failures.push({phase:'source-stability',error:error.message});}
report.status=report.failures.length?'failed':'passed';report.summary={cases:report.cases.length,failures:report.failures.length,changed:Object.fromEntries(['geometryHash','layoutHash','presentationInputsHash','traceHash','fullMapHash'].map(key=>[key,report.cases.filter(c=>c.changed[key]).length]))};save();
if(!report.failures.length){const renderFile=output.replace(/\.json$/,'-render-medium.json');assert(!fs.existsSync(renderFile));fs.writeFileSync(renderFile,JSON.stringify({status:'passed',sourceReport:output,cases:report.cases.filter(row=>row.grade==='medium'&&row.requestedSeed===20261012).map(({worldId,grade,requestedSeed,effectiveSeed,cacheBase,mapHash,deployment,elapsedMs})=>({worldId,grade,requestedSeed,effectiveSeed,cacheBase,mapHash,deployment,generationMs:elapsedMs}))},null,2)+'\n');}
console.log(JSON.stringify({status:report.status,...report.summary,output}));if(report.failures.length)process.exitCode=1;
