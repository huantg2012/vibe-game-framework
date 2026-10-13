/** Bounded production/replay gate for revision 11. Saves reusable temporary maps, not image payloads. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {SPATIAL_AUGMENTATION_POLICY} from '../../src/generated/r100-spatial-augmentation.ts';
import {TileType} from '../../src/types/game-types.ts';
import {mix32} from '../../src/generation/seed-fork.ts';
const output=process.env.QA_REPORT??'docs/qa/artifacts/spatial-augmentation-2026-10-13/code/r11-production-attempt1.json';
const cache=process.env.QA_MAP_CACHE??'/tmp/coh-spatial-augmentation-maps';
assert(!fs.existsSync(output),'Never overwrite prior evidence');fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(cache,{recursive:true});
const worlds=(process.env.QA_WORLDS??'split-rib-causeway,gel-rafts,sloughed-court,ash-strata,black-lacuna').split(',');assert(worlds.length>0&&worlds.length<=5&&new Set(worlds).size===worlds.length);
const grades=(process.env.QA_GRADES??'medium').split(',');assert(grades.length>0&&grades.length<=3&&new Set(grades).size===grades.length&&grades.every(grade=>['low','medium','severe'].includes(grade)));
const seedTokens=(process.env.QA_SEEDS??'20261012').split(',');assert(seedTokens.every(token=>/^[0-9]+$/.test(token)));const seeds=seedTokens.map(Number);assert(seeds.length>0&&seeds.length<=2&&new Set(seeds).size===seeds.length&&seeds.every(seed=>Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff));
const productionCases=worlds.flatMap(worldId=>grades.flatMap(grade=>seeds.map(seed=>({worldId,grade,seed}))));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function exactHash(value){const h=createHash('sha256');function visit(v){if(ArrayBuffer.isView(v)){h.update(`typed:${v.constructor.name}:${v.byteLength}:`).update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));return;}if(Array.isArray(v)){h.update(`array:${v.length}[`);for(const c of v)visit(c);h.update(']');return;}if(v&&typeof v==='object'){h.update('{');for(const k of Object.keys(v)){visit(k);visit(v[k]);}h.update('}');return;}assert.notEqual(typeof v,'function');const s=v===undefined?'undefined':JSON.stringify(v);h.update(`${typeof v}:${s.length}:${s}`);}visit(value);return h.digest('hex');}
const sourcePaths=['data/rift-spatial-augmentation-policy.csv','data/rift-spatial-augmentation-profiles.csv','src/generation/world-study/native-terrain.ts','src/generation/world-study/r100-master-world.ts','src/generation/world-study/r100-native-data.ts','src/generation/world-study/search-site-placement.ts','src/generation/world-study/r100-package.ts','src/generation/world-study/r100-production-map.ts','src/generation/world-study/r100-spatial-world.ts','src/generated/r100-spatial-augmentation.ts',...fs.readdirSync('src/generation/world-study').filter(name=>name.startsWith('spatial-augmentation-')).map(name=>`src/generation/world-study/${name}`)];
const sourceHashes=()=>Object.fromEntries(sourcePaths.map(file=>[file,hash(fs.readFileSync(file))]));
const report={status:'running',startedAt:new Date().toISOString(),node:process.version,scope:{worlds,grades,seeds},sourceHashes:sourceHashes(),recipeValidation:null,cases:[],failures:[],limits:['Only the explicitly scoped worlds/grades/seeds; complete deployed map replay is exact.','All 324 recipes are structurally checked only; not all worlds are fully generated.','Offline generation timings are not browser FPS or end-to-end loading measurements.']};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');save();
try {
  const frozenTemplate=structuredClone(SPATIAL_AUGMENTATION_POLICY);let largestBytes=0,count=0;
  for(const world of R100_NATIVE_WORLDS)for(const grade of ['low','medium','severe']){const recipe=createR100ProductionRecipe(world.id,20261012,grade);assert.equal(recipe.package.algorithmRevision,11);assert(validR100ProductionRecipe(recipe),`${world.id}/${grade}: fresh recipe rejected`);largestBytes=Math.max(largestBytes,JSON.stringify(recipe).length);count++;}
  const recipe=createR100ProductionRecipe(worlds[0],20261012,'medium');const corruptions=[
    ['missing-policy',r=>{delete r.augmentationPolicy;}],['unknown-algorithm',r=>{r.augmentationPolicy.algorithm='future';}],['unknown-version',r=>{r.augmentationPolicy.version=2;}],
    ['parameter-change',r=>{r.augmentationPolicy.parameters.physicalRadiusPx+=8;}],['bad-budget',r=>{r.augmentationPolicy.parameters.maxRounds=1000;}],
    ['extra-field',r=>{r.augmentationPolicy.unfrozenField=1;}],['source-drift',r=>{r.augmentationPolicy.sourceHash='0'.repeat(64);}],
    ['profile-change',r=>{r.augmentationPolicy.profiles[0].maxLengthPx+=1;}],['unknown-revision',r=>{r.package.algorithmRevision=12;}],
  ];
  for(const [name,mutate]of corruptions){const bad=structuredClone(recipe);mutate(bad);assert(!validR100ProductionRecipe(bad),name);assert.throws(()=>createR100ProductionMap(bad),/Invalid or unavailable/,name);}
  recipe.augmentationPolicy.parameters.physicalRadiusPx+=8;assert.deepEqual(SPATIAL_AUGMENTATION_POLICY,frozenTemplate,'Saved policy aliases today\'s generated object');
  report.recipeValidation={count,largestBytes,corruptions:corruptions.map(row=>row[0]),templateUnchanged:true};save();
}catch(error){report.failures.push({phase:'recipe',error:error.stack??String(error)});save();}
if(!report.failures.length)for(const {worldId,grade,seed} of productionCases){
  try {
    const recipe=createR100ProductionRecipe(worldId,seed,grade),started=performance.now(),map=createR100ProductionMap(recipe),generationMs=performance.now()-started;
    assert.equal(map.native.algorithmRevision,11);assert.equal(map.metadata.bodySize,20);assert.equal(map.metadata.supportTileSize,8);assert.equal(map.metadata.hostTileSize,32);assert(map.metadata.attempt<8);
    const before=exactHash(map),replayStarted=performance.now();let replay=createR100ProductionMap(JSON.parse(JSON.stringify(recipe)));const replayMs=performance.now()-replayStarted;assert.equal(exactHash(replay),before,'Full r11 saved map changed');replay=null;global.gc?.();
    const hydrated=hydrateR100MasterWorld(map.native,map.layout),tiles=map.layout.tileMap;let voidCells=0,transparentSolidCells=0;
    for(let row=0;row<tiles.rows;row++)for(let col=0;col<tiles.cols;col++){const missing=tiles.tiles[row][col]===TileType.VOID;assert.equal(hydrated.sight.isOpaque(col,row),missing);assert.equal(hydrated.matterAt(col*8+4,row*8+4),!missing);if(missing)voidCells++;if(tiles.tiles[row][col]===TileType.WALL){assert(!hydrated.sight.isOpaque(col,row));transparentSolidCells++;}}
    assert(voidCells>0&&transparentSolidCells>0);assert.equal(map.native.searchSites.length,map.layout.kindlingNodes.length+map.layout.contaminantNodes.length);
    const augmentation=map.native.diagnostics.spatialAugmentation;assert.equal(augmentation.geometrySeed,map.metadata.effectiveSeed);assert.equal(augmentation.candidateSeed,mix32(recipe.requestedSeed,`spatial-completion:${recipe.spatialPolicy.worldId}:${recipe.augmentationPolicy.algorithm}:${recipe.augmentationPolicy.version}:${recipe.augmentationPolicy.sourceHash}:${map.metadata.effectiveSeed}`));
    const candidateConstructionErrors=[...augmentation.candidates.flatMap(candidate=>candidate.reasons),...map.metadata.rejected.map(rejection=>rejection.reason)].filter(reason=>reason.includes('Authored erosion requires construction 4'));
    assert.equal(candidateConstructionErrors.length,0,'Authored-fragment template capability rejection must never consume a spatial candidate');
    const deployment=map.native.diagnostics.spatialAugmentationDeployment;assert([0,1].includes(deployment.selectedCandidate));assert(deployment.rejectedCandidates.length<=1);
    const id=`${worldId}-${grade}-${seed}`;assert(!fs.existsSync(path.join(cache,`${id}.map.v8.gz`)),'Refusing to replace a previously cached production map');fs.writeFileSync(path.join(cache,`${id}.map.v8.gz`),gzipSync(serialize(map)));fs.writeFileSync(path.join(cache,`${id}.recipe.json`),JSON.stringify(recipe,null,2)+'\n');
    const item={worldId,grade,requestedSeed:seed,effectiveSeed:map.metadata.effectiveSeed,attempt:map.metadata.attempt,rejected:map.metadata.rejected,mapHash:before,generationMs,replayMs,voidCells,transparentSolidCells,searchSites:map.native.searchSites.length,augmentation:map.native.diagnostics.spatialAugmentation,deployment,geometryFingerprint:map.native.diagnostics.geometryFingerprint,cacheBase:path.join(cache,id),candidateConstructionErrors,selectedSolidCount:augmentation.addedSolidIds.length,selectedVoidCount:augmentation.addedVoidCount,noop:augmentation.addedSolidIds.length===0&&augmentation.addedVoidCount===0};report.cases.push(item);console.log(JSON.stringify({worldId,grade,seed,status:'passed',generationMs,replayMs,attempt:item.attempt,selectedCandidate:deployment.selectedCandidate,selectedSolidCount:item.selectedSolidCount,selectedVoidCount:item.selectedVoidCount,noop:item.noop,stopReason:item.augmentation?.status}));
  }catch(error){report.failures.push({worldId,grade,seed,error:error.stack??String(error)});console.error(error);}
  save();global.gc?.();
}
try{assert.deepEqual(sourceHashes(),report.sourceHashes,'Sources changed during r11 execution');}catch(error){report.failures.push({phase:'source-stability',error:error.message});}
report.status=report.failures.length?'failed':'passed';report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,cases:report.cases.length,failures:report.failures.length,output}));if(report.failures.length)process.exitCode=1;
