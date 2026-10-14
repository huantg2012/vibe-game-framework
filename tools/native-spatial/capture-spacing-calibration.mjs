/** Bounded, non-production density calibration through the real searcher.
 * Usage: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx
 * tools/native-spatial/capture-spacing-calibration.mjs NEW_DIRECTORY [--spacing 320|288|352]
 * No generator duplication, deployment, recipe mutation, or CSV writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {validNativeSpatialRuntimeInput} from '../../src/generation/world-study/native-spatial-recipe.ts';
import {nativeSpatialCountPairs} from '../../src/generation/world-study/native-spatial-layout.ts';
import {createNativeSpatialGeometryCandidates} from '../../src/generation/world-study/native-spatial-generation.ts';

const args=process.argv.slice(2),output=args.shift();
assert(output,'A new output directory is required');
assert(args.length===0||args.length===2&&args[0]==='--spacing','Only optional --spacing NUMBER is supported');
assert(!fs.existsSync(output),'Never overwrite an earlier diagnostic');
const worldId='gel-rafts',grade='medium',requestedSeed=20261012,geometrySeed=20261012,deadlineMs=60000;
const recipe=createR100NativeSpatialDevelopmentRecipe(worldId,requestedSeed,grade),originalRecipe=JSON.stringify(recipe),base=recipe.nativeSpatial;
assert(base,'The registered world must have native spatial authoring');
const registered=[base.policy.spacingPx,...base.policy.comparisonSpacingsPx];
assert.equal(base.policy.spacingPx,320);assert.deepEqual([...base.policy.comparisonSpacingsPx].sort((a,b)=>a-b),[288,352]);
assert.equal(base.policy.maxGeometryEvaluations,72);assert.equal(base.policy.maxFullCandidates,2);
const spacings=args.length?[Number(args[1])]:[...registered].sort((a,b)=>a-b);
assert(spacings.every(value=>Number.isFinite(value)&&registered.includes(value)),'Spacing must be a current CSV-registered value: 320, 288 or 352');
assert.equal(new Set(spacings).size,spacings.length,'Each spacing may run only once in this capture');
function sourceFiles(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);if(entry.isDirectory())return sourceFiles(file);
  assert(entry.isFile(),`Unsupported non-file source entry: ${file}`);return[file];
});}
const tool='tools/native-spatial/capture-spacing-calibration.mjs';
const hashes=()=>Object.fromEntries([tool,...sourceFiles('src'),...sourceFiles('data')].sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.mkdirSync(output,{recursive:true});
const report={status:'prepared',startedAt:new Date().toISOString(),node:process.version,worldId,grade,requestedSeed,geometrySeed,registeredSpacings:registered,requestedSpacings:spacings,
  limits:{attemptsPerSpacing:1,geometryWork:72,deadlineMs,maxFullCandidates:2,actualDeploymentCalls:0},
  scope:'Diagnostic G1/G2/G3 calibration only. A yielded geometry is not a deployed or production-approved map.',sourceHashes:hashes(),cases:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
for(const spacingPx of spacings){
  const folder=path.join(output,`spacing-${spacingPx}`);fs.mkdirSync(folder);
  const input=structuredClone(base);input.policy={...input.policy,spacingPx};
  assert(validNativeSpatialRuntimeInput(input,recipe.nativeDefinition,worldId),'Diagnostic input must pass the production runtime schema');
  const calibrationOverride={kind:'csv-registered-diagnostic-selection',sourceSpacingPx:base.policy.spacingPx,spacingPx,registeredComparison:spacingPx!==base.policy.spacingPx};
  const frozenInput=JSON.stringify(input),configurationSha256=createHash('sha256').update(frozenInput).digest('hex'),overrideSha256=createHash('sha256').update(JSON.stringify(calibrationOverride)).digest('hex');
  fs.writeFileSync(path.join(folder,'input.json'),JSON.stringify({worldId,grade,requestedSeed,geometrySeed,calibrationOverride,configurationSha256,overrideSha256,sourceHashMeaning:'Unchanged fingerprint of the six authoring CSV sources; this runtime selection is not a new production recipe.',input},null,2)+'\n',{flag:'wx'});
  const sourceHashes=hashes();
  assert.deepEqual(sourceHashes,report.sourceHashes,'Sources changed before this attempt; refuse mixed-version calibration');
  const attempt={geometrySeed,proposalBudget:input.policy.maxGeometryEvaluations,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
  const row={spacingPx,calibrationOverride,configurationSha256,overrideSha256,policySourceHash:input.policy.sourceHash,status:'running',stop:null,measured:[],observerMs:0,attempt,sourceHashes};report.cases.push(row);report.status='running';save();
  let observerError;let generator;const started=performance.now();
  const checkpoint=()=>{
    // The same stored observer error aborts every subsequent checkpoint, so a
    // caught proposal exception cannot continue sampling after an I/O failure.
    if(observerError)throw observerError;
    if(performance.now()-started>=deadlineMs){attempt.stopReason='deadline';throw new Error('Density calibration attempt exceeded its 60s deadline');}
  };
  const onMeasured=snapshot=>{
    const at=performance.now();
    try{
      const filename=`candidate-${String(snapshot.layout.candidate).padStart(3,'0')}.json`;
      fs.writeFileSync(path.join(folder,filename),JSON.stringify({spacingPx,inputFile:'input.json',proposal:snapshot.layout,gate:snapshot.gate,geometryHash:snapshot.geometryHash},null,2)+'\n',{flag:'wx'});
      row.measured.push({candidate:snapshot.layout.candidate,countPairIndex:snapshot.layout.countPairIndex,bayCountIndex:snapshot.layout.bayCountIndex,requestedCounts:snapshot.layout.requestedCounts,geometryHash:snapshot.geometryHash,accepted:snapshot.gate.accepted,reasons:snapshot.gate.reasons,file:filename});
    }catch(error){observerError=error instanceof Error?error:new Error(String(error));}
    finally{row.observerMs+=performance.now()-at;}
  };
  try{
    generator=createNativeSpatialGeometryCandidates(recipe.nativeDefinition,input,requestedSeed,geometrySeed,attempt,checkpoint,onMeasured);
    const result=generator.next();
    if(!result.done){
      // First yield already passed G1/G2/G3. Never resume, deploy, or increment
      // fullCandidates for a geometry-only observation.
      row.status='geometry-admitted';row.stop='geometry-admitted-diagnostic';row.admittedCandidate=result.value.layout.candidate;row.admittedTrace=result.value.trace;
    }else{row.status='no-admission';row.stop=attempt.stopReason;}
  }catch(error){
    row.status=observerError?'diagnostic-failed':attempt.stopReason==='deadline'?'deadline':'diagnostic-failed';
    row.stop=observerError?'observer-failure':attempt.stopReason;row.error=String(error.stack??error);
  }finally{generator?.return();row.elapsedMs=performance.now()-started;}
  if(observerError){row.status='diagnostic-failed';row.stop='observer-failure';row.observerError=String(observerError.stack??observerError);}
  row.sourceHashesAfter=hashes();row.sourcesStable=JSON.stringify(sourceHashes)===JSON.stringify(row.sourceHashesAfter);
  row.inputUnchanged=JSON.stringify(input)===frozenInput;row.recipeUnchanged=JSON.stringify(recipe)===originalRecipe;
  row.domainCoverage=nativeSpatialCountPairs(input).flatMap((counts,countPairIndex)=>input.world.bayCountOptions.map((bayCount,bayCountIndex)=>({countPairIndex,bayCountIndex,counts,bayCount,completedTraceCandidates:attempt.candidates.filter(c=>c.countPairIndex===countPairIndex&&c.bayCountIndex===bayCountIndex).map(c=>c.candidate),measuredCandidates:row.measured.filter(c=>c.countPairIndex===countPairIndex&&c.bayCountIndex===bayCountIndex).map(c=>c.candidate)})));
  row.budgetRespected=attempt.geometryEvaluations<=input.policy.maxGeometryEvaluations&&attempt.fullCandidates<=input.policy.maxFullCandidates;
  if(!row.sourcesStable||!row.inputUnchanged||!row.recipeUnchanged||!row.budgetRespected)row.status='diagnostic-failed';
  fs.writeFileSync(path.join(folder,'trace.json'),JSON.stringify(row,null,2)+'\n');save();
  console.log(`${spacingPx}: ${row.status}; ${attempt.geometryEvaluations}/72 work, ${row.measured.length} measured, ${(row.elapsedMs/1000).toFixed(2)}s`);
  if(row.status==='diagnostic-failed')break;
}
report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);
report.status=report.cases.some(row=>row.status==='diagnostic-failed')||!report.sourcesStable?'diagnostic-failed':'complete';report.finishedAt=new Date().toISOString();save();
if(report.status==='diagnostic-failed')process.exitCode=1;
