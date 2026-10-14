/** Independent recipe-boundary review; no geometry acceptance is inferred. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {NATIVE_SPATIAL_POLICY,NATIVE_SPATIAL_WORLDS,NATIVE_SPATIAL_ASSEMBLIES,NATIVE_SPATIAL_BAY_PROFILES} from '../../src/generated/r100-native-spatial.ts';
import {createR100ProductionRecipe,createR100NativeSpatialDevelopmentRecipe,selectR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionRecipe as createRevision11Recipe} from '../../src/generation/legacy-r100-v11/executor-revision11.js';
import {validWorldProductionRecipe} from '../../src/generation/world-study/production-recipe.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {executeRiftGeneration} from '../../src/generation/rift-generation-execute.ts';
import {validNativeSpatialRuntimeInput} from '../../src/generation/world-study/native-spatial-recipe.ts';

const output=process.argv[2];assert(output,'Usage: check-qa-recipes.mjs NEW_REPORT.json');assert(!fs.existsSync(output),'Retain previous evidence');
const csvFiles=['policy','worlds','hole-profiles','bay-profiles','assemblies','subordinate-profiles'].map(name=>`data/rift-native-spatial-${name}.csv`);
const oldRecipeFile='docs/qa/artifacts/native-spatial-2026-10-14/safe-node-c17-capture-round1/recipe.json';
const files=['tools/native-spatial/check-qa-recipes.mjs','src/generation/world-study/r100-package.ts','src/dev/r100-gym.ts','src/generation/world-study/production-recipe.ts','src/generation/world-study/native-spatial-recipe.ts','src/generation/world-study/native-spatial-validation.ts','src/generation/world-study/r100-production-map.ts','src/generation/rift-generation-execute.ts','src/generated/r100-native-spatial.ts','src/generation/legacy-r100-v11/executor-revision11.js',oldRecipeFile,...csvFiles];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=hashes(),cases=[],grades=['low','medium','severe'];
async function check(id,run){let evidence={};const began=performance.now();try{await run(value=>{evidence=value;});cases.push({id,passed:true,...evidence,elapsedMs:performance.now()-began});}catch(error){cases.push({id,passed:false,...evidence,error:String(error.stack??error),elapsedMs:performance.now()-began});}const {results,...summary}=cases.at(-1);console.log(JSON.stringify({...summary,...(results?{resultCount:results.length}:{})}));}
const base=createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium');
function rejectAtPublicBoundaries(recipe,name){
  assert.equal(validR100ProductionRecipe(recipe),false,name);assert.equal(validWorldProductionRecipe(recipe),false,name);
  assert.throws(()=>createR100ProductionMap(recipe),undefined,`${name}: map must reject, never fall back`);
  assert.throws(()=>executeRiftGeneration({kind:'departure',generation:recipe}),undefined,`${name}: Worker executor must reject`);
}
await check('policy-v2-freezes-all-six-csv-sources',record=>{
  assert.equal(base.nativeSpatial.policy.version,2);
  const sourceHash=createHash('sha256').update(csvFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n')).digest('hex');
  assert.equal(base.nativeSpatial.policy.sourceHash,sourceHash);
  record({policyVersion:2,sourceHash,sourceFiles:csvFiles});
});
await check('normal-factories-r11-only-and-explicit-development-r12',record=>{
  const reviewed=new Set(NATIVE_SPATIAL_WORLDS.filter(row=>row.enabled&&row.annotationStatus==='reviewed').map(row=>row.worldId));
  const results=[];for(const world of R100_NATIVE_WORLDS)for(const grade of grades){
    const recipe=createR100ProductionRecipe(world.id,20261012,grade),revision=recipe.package.algorithmRevision;
    assert.equal(revision,11,`${world.id}/${grade}: normal departure selected an experimental revision`);
    assert(validR100ProductionRecipe(recipe),`${world.id}/${grade}: own factory recipe rejected`);
    assert(validWorldProductionRecipe(recipe),`${world.id}/${grade}: public validator rejected`);
    assert(!Object.hasOwn(recipe,'nativeSpatial'));
    if(reviewed.has(world.id)){
      assert.deepEqual(recipe,createRevision11Recipe(world.id,20261012,grade),'Normal recipe differs from frozen r11 factory identity');
      const development=createR100NativeSpatialDevelopmentRecipe(world.id,20261012,grade);assert.equal(development.package.algorithmRevision,12);assert(validR100ProductionRecipe(development));assert(validWorldProductionRecipe(development));assert.equal(development.nativeSpatial.world.worldId,world.id);assert(!Object.hasOwn(development,'spatialPolicy'));assert(!Object.hasOwn(development,'augmentationPolicy'));
    }
    results.push({world:world.id,grade,revision,bytes:JSON.stringify(recipe).length});
  }
  for(const seed of [0,1,17,42,20261012,0xffffffff])for(const grade of grades){const selected=selectR100ProductionRecipe(seed,grade);assert.equal(selected.package.algorithmRevision,11);assert(validR100ProductionRecipe(selected));}
  assert.throws(()=>createR100NativeSpatialDevelopmentRecipe('cinder-ridge',20261012,'medium'),/development is unavailable/);
  record({count:results.length,normalRevision12:0,normalRevision11:results.length,developmentRevision12:reviewed.size*grades.length,selectionCases:18,unavailableDevelopmentFails:true,results});
});
await check('existing-r12-snapshot-still-valid-and-integrity-checked',record=>{
  const saved=JSON.parse(fs.readFileSync(oldRecipeFile)),before=JSON.stringify(saved);assert.equal(saved.package.algorithmRevision,12);assert(validR100ProductionRecipe(saved));assert(validWorldProductionRecipe(saved));
  const edited=structuredClone(saved);edited.package.dependencyHash='00000000';assert(!validR100ProductionRecipe(edited));assert(!validWorldProductionRecipe(edited));assert.equal(JSON.stringify(saved),before);
  record({source:oldRecipeFile,dependencyHash:saved.package.dependencyHash,oldSnapshotUnchanged:true,valid:true,editedChecksumRejected:true,replayExecutionUnchangedNotRun:true});
});
await check('r12-integrity-and-unknown-revision-fail-before-map-or-worker-generation',record=>{
  const mutations=[['missing-native-input',r=>{delete r.nativeSpatial;}],['legacy-spatial-field',r=>{r.spatialPolicy={};}],['legacy-augmentation-field',r=>{r.augmentationPolicy={};}],['world-mismatch',r=>{r.nativeSpatial.world.worldId='sloughed-court';}],['deleted-policy',r=>{delete r.nativeSpatial.policy;}],['edited-hole-size',r=>{r.nativeSpatial.holeProfiles[0].maxSpanPx+=8;}],['edited-target-area',r=>{r.nativeSpatial.world.targetWalkAreaPx2+=64;}],['edited-assembly',r=>{r.nativeSpatial.assemblies[0].sourceInstanceIds=[9999];}],['duplicate-assembly',r=>{r.nativeSpatial.assemblies.push(structuredClone(r.nativeSpatial.assemblies[0]));}],['extra-policy-key',r=>{r.nativeSpatial.policy.unrecognized=true;}],['nan-policy',r=>{r.nativeSpatial.policy.spacingPx=NaN;}],['infinite-extraction',r=>{r.nativeSpatial.extraction.minPathDistancePx=Infinity;}],['missing-deployment',r=>{delete r.nativeSpatial.deployment;}],['relabel-to-r11',r=>{r.package.algorithmRevision=11;}],...[-1,0,13,NaN].map(revision=>[`unknown-revision-${revision}`,r=>{r.package.algorithmRevision=revision;}])];
  const results=[];for(const [name,mutate] of mutations){const recipe=structuredClone(base);mutate(recipe);rejectAtPublicBoundaries(recipe,name);results.push(name);}record({rejected:results});
});
await check('bay-and-core-shoulder-schema-fail-closed-without-live-defaults',record=>{
  const fields=['bayGrammar','bayProfileIds','bayCountOptions','landCoreMinCount','landCoreMaxCount','landShoulderMinCount','landShoulderMaxCount','landShoulderMinSpanPx','landShoulderMaxSpanPx','landShoulderMinThicknessPx','landShoulderMaxThicknessPx','landShoulderMinExtensionPx','landShoulderMaxExtensionPx','landShoulderAttachment'];
  const mutations=fields.map(field=>[`missing-${field}`,r=>{delete r.nativeSpatial.world[field];}]);
  mutations.push(['missing-bayProfiles',r=>{delete r.nativeSpatial.bayProfiles;}],['policy-v1-with-v2-data',r=>{r.nativeSpatial.policy.version=1;}],['unknown-bay-profile-reference',r=>{r.nativeSpatial.world.bayProfileIds=['no-such-bay'];}],['duplicate-bay-profile',r=>{r.nativeSpatial.bayProfiles.push(structuredClone(r.nativeSpatial.bayProfiles[0]));}],['bay-count-outside-frozen-domain',r=>{r.nativeSpatial.world.bayCountOptions=[3];}],['bay-depth-inverted',r=>{r.nativeSpatial.bayProfiles[0].minDepthPx=r.nativeSpatial.bayProfiles[0].maxDepthPx+1;}],['bay-throat-nonfinite',r=>{r.nativeSpatial.bayProfiles[0].minFinalThroatPx=Infinity;}],['shoulder-role-count-exceeds-total',r=>{r.nativeSpatial.world.landCoreMaxCount=7;}],['shoulder-too-thin-for-320px-join',r=>{r.nativeSpatial.world.landShoulderMinThicknessPx=319;}],['shoulder-extension-cannot-fit-author-span',r=>{r.nativeSpatial.world.landShoulderMinExtensionPx=500;r.nativeSpatial.world.landShoulderMaxExtensionPx=512;}],['unknown-shoulder-attachment',r=>{r.nativeSpatial.world.landShoulderAttachment='any-edge';}]);
  const rejected=[];for(const [name,mutate] of mutations){const recipe=structuredClone(base);mutate(recipe);assert.equal(validNativeSpatialRuntimeInput(recipe.nativeSpatial,recipe.nativeDefinition,'gel-rafts'),false,`${name}: schema must reject independently of checksum`);rejectAtPublicBoundaries(recipe,name);rejected.push(name);}record({rejected});
});
await check('valid-range-bay-and-shoulder-edits-break-frozen-integrity',record=>{
  const mutations=[['bay-depth',r=>{r.nativeSpatial.bayProfiles[0].maxDepthPx-=8;}],['bay-count-options',r=>{r.nativeSpatial.world.bayCountOptions=[0,1];}],['core-count',r=>{r.nativeSpatial.world.landCoreMaxCount=4;}],['shoulder-extension',r=>{r.nativeSpatial.world.landShoulderMaxExtensionPx-=8;}]];
  const rejected=[];for(const [name,mutate] of mutations){const recipe=structuredClone(base);mutate(recipe);assert(validNativeSpatialRuntimeInput(recipe.nativeSpatial,recipe.nativeDefinition,'gel-rafts'),`${name}: test must remain structurally valid`);rejectAtPublicBoundaries(recipe,name);rejected.push(name);}record({rejected,reason:'Values remain in allowed schema ranges but differ from the frozen dependency receipt.'});
});
await check('frozen-recipe-does-not-share-author-data-or-revalidate-against-todays-policy',record=>{
  const originalSpacing=NATIVE_SPATIAL_POLICY.spacingPx,originalId=NATIVE_SPATIAL_ASSEMBLIES.find(row=>row.worldId==='gel-rafts').sourceInstanceIds[0];
  const originalJson=JSON.stringify(base),assembly=NATIVE_SPATIAL_ASSEMBLIES.find(row=>row.worldId==='gel-rafts');let invalidFactoryRejected=false;
  try{
    NATIVE_SPATIAL_POLICY.spacingPx=288;assembly.sourceInstanceIds[0]=9999;
    assert.equal(JSON.stringify(base),originalJson,'Factory must deep copy author records');
    assert(validR100ProductionRecipe(base),'Saved recipe must not rebind to current author table');
    assert(validNativeSpatialRuntimeInput(base.nativeSpatial,base.nativeDefinition,'gel-rafts'));
    assert.throws(()=>createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium'),/Invalid reviewed native spatial intent/);invalidFactoryRejected=true;
    assert.equal(createR100ProductionRecipe('gel-rafts',20261012,'medium').package.algorithmRevision,11);
  }finally{NATIVE_SPATIAL_POLICY.spacingPx=originalSpacing;assembly.sourceInstanceIds[0]=originalId;}
  assert(validR100ProductionRecipe(createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium')));
  record({oldSnapshotUnchanged:true,oldSnapshotRemainsValid:true,malformedReviewedAuthorDataThrowsInsteadOfR11:invalidFactoryRejected,authorDataRestoredInProcess:true});
});
await check('saved-bay-and-core-shoulder-ignore-todays-author-values',record=>{
  const world=NATIVE_SPATIAL_WORLDS.find(row=>row.worldId==='gel-rafts'),bay=NATIVE_SPATIAL_BAY_PROFILES.find(row=>row.id===world.bayProfileIds[0]);
  const original={depth:bay.maxDepthPx,core:world.landCoreMaxCount,extension:world.landShoulderMaxExtensionPx,countOptions:world.bayCountOptions},originalJson=JSON.stringify(base);
  try{
    bay.maxDepthPx-=8;world.landCoreMaxCount=4;world.landShoulderMaxExtensionPx-=8;
    assert.equal(JSON.stringify(base),originalJson);assert(validR100ProductionRecipe(base));
    const changed=createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium');assert(validR100ProductionRecipe(changed));assert.notEqual(changed.package.dependencyHash,base.package.dependencyHash);
    assert.equal(changed.nativeSpatial.bayProfiles[0].maxDepthPx,bay.maxDepthPx);assert.equal(changed.nativeSpatial.world.landCoreMaxCount,4);assert.equal(changed.nativeSpatial.world.landShoulderMaxExtensionPx,world.landShoulderMaxExtensionPx);
    world.bayCountOptions=[3];assert.throws(()=>createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium'),/Invalid reviewed native spatial intent/);assert(validR100ProductionRecipe(base));
  }finally{bay.maxDepthPx=original.depth;world.landCoreMaxCount=original.core;world.landShoulderMaxExtensionPx=original.extension;world.bayCountOptions=original.countOptions;}
  assert.equal(JSON.stringify(createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium')),originalJson);
  record({oldSnapshotUnchanged:true,newDepartureConsumesNewValues:true,newDepartureIntegrityChanges:true,malformedNewBayDomainRejected:true,authorDataRestoredInProcess:true});
});
const after=hashes(),stable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(row=>row.passed)&&stable?'passed':'failed',createdAt:new Date().toISOString(),sourceHashes:before,sourceHashesAfter:after,sourcesStable:stable,cases,limitations:['Factory validation and malformed-input rejection only; no successful r12 map, rendering, recovery, Worker message transfer, timing, AI or gameplay acceptance.','In-memory author mutation is confined to this process and restored in finally; no CSV or generated file is changed.','Checksum is an integrity receipt, not an anti-cheat signature; no deliberate re-signing attack is claimed.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
