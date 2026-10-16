/** Revision-13 data and exact direct execution. Never overwrites evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {createR100ProductionRecipe,createR100NativeSpatialDevelopmentRecipe,createR100DirectConstructionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {constructNativeProductionLayout} from '../../src/generation/world-study/native-construction-recipe.ts';
import {createNativeConstructionCandidate} from '../../src/generation/world-study/native-construction-generation.ts';
import {validNativeSpatialRuntimeInput} from '../../src/generation/world-study/native-spatial-recipe.ts';
import {NATIVE_CONSTRUCTION_REGISTRATIONS} from '../../src/generated/r100-native-construction.ts';
import {validR100ProductionRecipe as validFrozenRevision11} from '../../src/generation/legacy-r100-v11/executor-recovery.js';
import {createR100ProductionRecipe as createFrozenRevision11} from '../../src/generation/legacy-r100-v11/executor-revision11.js';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
const output=process.argv[2];assert(output,'Usage: check-direct-construction.mjs NEW_OUTPUT [--full WORLD GRADE SEED]');assert(!fs.existsSync(output),'Never overwrite direct construction evidence');fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],cases:[],errors:[]},start=performance.now();
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceFiles=['src/generation/world-study/native-construction-recipe.ts','src/generation/world-study/native-construction-generation.ts','src/generation/world-study/r100-package.ts','src/generation/world-study/r100-production-map.ts','src/generated/r100-native-construction.ts'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,sha(fs.readFileSync(file))]));report.sourcesBefore=hashes();save();
try {
  for(const registration of NATIVE_CONSTRUCTION_REGISTRATIONS)for(const grade of ['low','medium','severe']){
    const world=registration.worldId,recipe=createR100DirectConstructionRecipe(world,20261012,grade),copy=structuredClone(recipe);
    assert.equal(recipe.package.algorithmRevision,13);assert(validR100ProductionRecipe(recipe));assert.deepEqual(createR100DirectConstructionRecipe(world,20261012,grade),copy);
    assert.equal(recipe.surfacePixelBudget,8388608);assert.equal(recipe.enemyMaterialVersion,['crystal-fibre','ruptured-film'].includes(world)?1:undefined);
    const reviewed=R100_NATIVE_WORLDS.find(row=>row.id===world).definitions.find(row=>row.grade==='medium');
    assert.equal(recipe.nativeConstruction.sourceGrade,'medium');assert.deepEqual(recipe.nativeDefinition.instances,reviewed.instances);
    assert(recipe.nativeSpatial.assemblies.every(assembly=>assembly.grade==='all'),'Reviewed physical assemblies apply to every pollution grade');
    const ordinary=createR100ProductionRecipe(world,20261012,grade);assert.equal(ordinary.package.algorithmRevision,registration.enabled?13:11);if(!registration.enabled)assert(validFrozenRevision11(ordinary));
    const prior=createR100NativeSpatialDevelopmentRecipe(world,20261012,grade);assert.equal(prior.package.algorithmRevision,12);assert(validR100ProductionRecipe(prior));assert.equal(prior.nativeConstruction,undefined);
    const reject=change=>{const bad=structuredClone(recipe);change(bad);assert.equal(validR100ProductionRecipe(bad),false);};
    reject(bad=>delete bad.nativeConstruction);reject(bad=>delete bad.surfacePixelBudget);reject(bad=>bad.nativeConstruction.geometrySeed++);
    reject(bad=>bad.nativeConstruction.reference.csv=bad.nativeConstruction.reference.csv.replace('land,land-0','hole,land-0'));
    reject(bad=>bad.nativeConstruction.extra='unrecognized');reject(bad=>bad.nativeConstruction.seedMode='four-geometry-seeds-v1');
    reject(bad=>bad.nativeConstruction.sourceGrade='severe');reject(bad=>bad.nativeSpatial.assemblies[0].grade='medium');
    assert(recipe.nativeConstruction.contentSeeds[grade].length>=2);
    reject(bad=>bad.nativeConstruction.contentSeeds[grade]=[0]);reject(bad=>bad.nativeConstruction.contentSeedIdentities[grade]='00000000');
    reject(bad=>bad.nativeConstruction.intent.targetWalkAreaPx2++);reject(bad=>bad.nativeSpatial.policy.planningCellFactor/=2);
    const intent=recipe.nativeConstruction.intent;
    assert.equal(recipe.nativeSpatial.world.frameWidthPx,intent.frameWidthPx);assert.equal(recipe.nativeSpatial.world.frameHeightPx,intent.frameHeightPx);
    assert.equal(recipe.nativeSpatial.world.targetWalkAreaPx2,intent.targetWalkAreaPx2);assert.equal(recipe.nativeSpatial.policy.planningCellFactor,intent.planningCellFactor);
    if(intent.frameWidthPx*intent.frameHeightPx>4194304)assert.equal(validNativeSpatialRuntimeInput(recipe.nativeSpatial,recipe.nativeDefinition,world),false,'Default legacy spatial budget remains 4M');
    if(recipe.enemyMaterial){reject(bad=>bad.enemyMaterial.mid[0]^=1);reject(bad=>delete bad.enemyMaterial);reject(bad=>bad.enemyMaterialVersion=2);}
    else reject(bad=>bad.enemyMaterialVersion=1);
    for(const seed of [0,1,42,0xffffffff])assert.deepEqual(createR100DirectConstructionRecipe(world,seed,grade).nativeConstruction,recipe.nativeConstruction);
    assert.deepEqual(recipe,copy);report.cases.push({world,grade,recipeBytes:JSON.stringify(recipe).length,ordinaryRevision:ordinary.package.algorithmRevision,geometrySeed:recipe.nativeConstruction.geometrySeed,status:'passed'});
  }
  report.checks=['12 valid deterministic complete snapshots','legacy r11 public-factory/archive validation','r12 explicit development isolation','missing field and changed data rejection','frozen enemy grammar and source text receipts','reviewed physical seed independent of request content seed'];
  let retainedRecipes=0;
  for(const world of R100_NATIVE_WORLDS)for(const grade of ['low','medium','severe']){
    if(NATIVE_CONSTRUCTION_REGISTRATIONS.some(row=>row.worldId===world.id&&row.enabled))continue;
    assert.deepEqual(createR100ProductionRecipe(world.id,20261012,grade),createFrozenRevision11(world.id,20261012,grade));retainedRecipes++;
  }
  report.retainedRevision11Recipes=retainedRecipes;report.checks.push(`${retainedRecipes} ordinary recipe identities equal independent archived r11 factory`);
  if(process.argv.includes('--geometry')){
    const index=process.argv.indexOf('--geometry'),[world,grade,seedText='20261012']=process.argv.slice(index+1);assert(world&&grade);const requestedSeed=Number(seedText);
    const recipe=createR100DirectConstructionRecipe(world,requestedSeed,grade),geometrySeed=recipe.nativeConstruction.geometrySeed;fs.writeFileSync(path.join(output,'recipe.json'),JSON.stringify(recipe,null,2)+'\n');
    const trace={geometrySeed,proposalBudget:1,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
    const began=performance.now(),candidate=createNativeConstructionCandidate(recipe,trace,()=>assert(performance.now()-began<60000,'Direct geometry exceeded its deadline'));
    fs.writeFileSync(path.join(output,'layout.json'),JSON.stringify(candidate.layout,null,2)+'\n');report.geometry={world,grade,requestedSeed,geometrySeed,trace};
    assert(candidate.trace.accepted,`Direct geometry rejected: ${candidate.trace.reasons.join('; ')}`);
  }
  if(process.argv.includes('--full')){
    const index=process.argv.indexOf('--full'),[world,grade,seedText]=process.argv.slice(index+1);assert(world&&grade&&seedText);const seed=Number(seedText);
    const recipe=createR100DirectConstructionRecipe(world,seed,grade);fs.writeFileSync(path.join(output,'recipe.json'),JSON.stringify(recipe,null,2)+'\n');
    const layout=constructNativeProductionLayout(recipe);fs.writeFileSync(path.join(output,'layout.json'),JSON.stringify(layout,null,2)+'\n');
    const map=createR100ProductionMap(recipe),again=createR100ProductionMap(JSON.parse(JSON.stringify(recipe)));
    assert.deepEqual(again,map,'Cold recipe replay must reproduce the complete map');
    fs.writeFileSync(path.join(output,'map.v8.gz'),gzipSync(serialize(map)));report.full={world,grade,seed,signature:map.metadata.signature,nativeRevision:map.native.algorithmRevision,status:'passed'};
  }
  report.status='passed';
}catch(error){report.status='failed';report.errors.push({error:String(error.stack??error),diagnostics:error.diagnostics??null});}
finally{report.sourcesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourcesBefore)===JSON.stringify(report.sourcesAfter);if(!report.sourcesStable)report.status='failed';report.elapsedMs=performance.now()-start;save();console.log(JSON.stringify({status:report.status,cases:report.cases.length,full:report.full,errors:report.errors.map(error=>error.error),output}));}
if(report.status!=='passed')process.exitCode=1;
