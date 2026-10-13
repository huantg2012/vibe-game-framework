/** Focused regression: distant ring changes cannot supply a local reveal witness. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {SPATIAL_AUGMENTATION_POLICY as policy} from '../../src/generated/r100-spatial-augmentation.ts';
import {buildSpatialGeometry,createSpatialBaseline,measureSpatialCandidate,spatialReachable} from '../../src/generation/world-study/spatial-augmentation-measure.ts';
import {evaluateSpatialCandidate,findSpatialRevealWitness} from '../../src/generation/world-study/spatial-augmentation-selection.ts';
import {spatialCandidateAttempts} from '../../src/generation/world-study/spatial-augmentation-candidates.ts';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {hasLineOfSight} from '../../src/utils/grid-raycast.ts';

const output=process.argv[2];assert(output,'Supply a fresh output path');assert(!fs.existsSync(output),'Do not overwrite prior evidence');
const seed=20261013,p=policy.parameters;
const sourceFiles=['src/generation/world-study/spatial-augmentation-selection.ts','src/generation/world-study/spatial-augmentation-candidates.ts','src/generation/world-study/spatial-augmentation-measure.ts','src/generated/r100-spatial-augmentation.ts'];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const sources=sourceHashes(),results=[];
const recipe=JSON.parse(fs.readFileSync('docs/qa/artifacts/spatial-augmentation-2026-10-13/qa/r10-current/split-rib-causeway-medium-20261012.recipe.json','utf8'));
const fragmentShape={algorithmVersion:'rectilinear-fragment-v1',layoutId:'qa-local-reveal-fixture',sourceHash:'0'.repeat(64),seedMode:'run-seed',seedSalt:0,edgeSeed:seed,
  layout:{authoringFrame:[1152,896],worldScale:2,landRects:[[32,32,1088,832]],voidRects:[]}};
const compiled=compileR100FragmentShape(fragmentShape);
const definition={...recipe.nativeDefinition,id:'qa-local-reveal-fixture',cols:72,rows:56,axis:0,instances:[],erosion:compiled.erosion,terrainOutline:compiled.terrainOutline,
  fragmentShapeVersion:fragmentShape.algorithmVersion,spawn_x:100,spawn_y:100,exit_x:2100,exit_y:1600,search_x:300,search_y:300,enemy_x:1800,enemy_y:1300};
const baseline=createSpatialBaseline(buildSpatialGeometry(definition,seed),p),current=measureSpatialCandidate(baseline,baseline.geometry);
const hotspot={point:{x:1156,y:900},axis:'physical',burden:1};
const plan={definition,fragmentShape,addedSolidIds:[],addedVoidCount:0};
const solid=[...spatialCandidateAttempts(plan,[hotspot],policy,seed,0)].find(row=>row.id==='r0-h0-solid-1').candidate;assert(solid,'Fixture solid must construct');
const remoteFragment={...fragmentShape,layout:{...fragmentShape.layout,voidRects:[[160,140,80,48]]}},remoteCompiled=compileR100FragmentShape(remoteFragment);
assert.equal(remoteCompiled.erosion.length,1);
const remoteCandidate={...solid,id:'qa-local-solid-remote-void',kind:'combined',fragmentShape:remoteFragment,addedVoidCount:1,
  newVoidBoundary:remoteCompiled.erosion[0],definition:{...solid.definition,terrainOutline:remoteCompiled.terrainOutline,erosion:remoteCompiled.erosion}};
const geometry=buildSpatialGeometry(remoteCandidate.definition,seed),focus={point:hotspot.point,radius:p.hotspotRadiusPx};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function verifyWitness(witness,view,localFocus) {
  assert(witness);assert(spatialReachable(view,witness.observer));assert(spatialReachable(view,witness.hidden));assert(spatialReachable(view,witness.revealed));
  assert(distance(witness.observer,witness.hidden)<=p.occlusionRadiusPx+1e-9);assert(distance(witness.observer,witness.revealed)<=p.referenceSightPx+1e-9);
  assert.equal(hasLineOfSight(view.sight,witness.observer,witness.hidden),false);assert.equal(hasLineOfSight(view.sight,witness.observer,witness.revealed),true);
  if(localFocus)assert(distance(witness.observer,localFocus.point)<=localFocus.radius+1e-9);
  let length=0;for(let i=1;i<witness.route.length;i++){const a=witness.route[i-1],b=witness.route[i];assert.equal(view.collision.displacementFraction(a,10,10,b.x-a.x,b.y-a.y),1);length+=distance(a,b);}
  assert(Math.abs(length-witness.routeLengthPx)<1e-6);assert(length>=p.revealRouteMinPx&&length<=p.revealRouteMaxPx);
  return {observerFocusDistance:localFocus?distance(witness.observer,localFocus.point):null,hiddenDistance:distance(witness.observer,witness.hidden),revealedDistance:distance(witness.observer,witness.revealed),routeLength:length};
}
async function test(id,fn){try{results.push({id,passed:true,...await fn()});}catch(error){results.push({id,passed:false,error:error.message,cause:error.cause??null});}console.log(JSON.stringify(results.at(-1)));}

await test('L01-real-remote-witness-exists-but-local-focus-rejects-it',()=>{
  const unscoped=findSpatialRevealWitness(baseline,geometry,current.geometry);verifyWitness(unscoped,geometry);
  assert(distance(unscoped.observer,focus.point)>focus.radius,'Negative fixture witness must be outside hotspot');
  const scoped=findSpatialRevealWitness(baseline,geometry,current.geometry,focus);assert.equal(scoped,undefined,'A remote witness must not satisfy local focus');
  return {remoteObserver:unscoped.observer,observerHotspotDistance:distance(unscoped.observer,focus.point),hotspot:focus.point,radius:focus.radius};
});
await test('L02-evaluate-cannot-borrow-remote-ring-change-for-local-solid',()=>{
  const evaluated=evaluateSpatialCandidate(baseline,current,remoteCandidate,policy,seed);
  assert.deepEqual(evaluated.receipt.reasons,['no-void-reveal-witness'],JSON.stringify(evaluated.receipt));assert.equal(evaluated.state,undefined);assert.equal(evaluated.receipt.reveal,undefined);
  assert(evaluated.receipt.targetImprovement>=p.minimumImprovement);assert(evaluated.receipt.deficits.occlusion<baseline.deficits.occlusion);
  return {receipt:evaluated.receipt,note:'The candidate passes other geometry/score checks and improves local physical cost, but its optical witness is remote.'};
});
await test('L03-local-focus-keeps-208-224-and-full-body-path-positive-control',()=>{
  const unscoped=findSpatialRevealWitness(baseline,geometry,current.geometry);assert(unscoped);
  const near={point:unscoped.observer,radius:p.hotspotRadiusPx},witness=findSpatialRevealWitness(baseline,geometry,current.geometry,near);
  return {witness,measurements:verifyWitness(witness,geometry,near)};
});
await test('L04-evaluate-supplies-local-focus-for-real-local-combination',()=>{
  // r0-h1 in the original multi-hotspot fixture has a different random stream;
  // obtain that exact proposal through its real two-hotspot enumeration.
  const exact=[...spatialCandidateAttempts(plan,[hotspot,{point:{x:1380,y:900},axis:'physical',burden:1}],policy,seed,0)].find(row=>row.id==='r0-h1-combined-0').candidate;
  assert(exact);const evaluated=evaluateSpatialCandidate(baseline,current,exact,policy,seed);assert(evaluated.state,JSON.stringify(evaluated.receipt));
  const witness=evaluated.receipt.reveal;assert(witness);
  return {receipt:evaluated.receipt,measurements:verifyWitness(witness,evaluated.state.geometry,{point:exact.hotspot,radius:p.hotspotRadiusPx})};
});
await test('L05-old-hole-still-cannot-earn-new-credit-under-focus',()=>{
  const witness=findSpatialRevealWitness(baseline,geometry,current.geometry);assert(witness);
  assert.equal(findSpatialRevealWitness(baseline,geometry,geometry,{point:witness.observer,radius:p.hotspotRadiusPx}),undefined);return {passedWithoutPreviousHoleCredit:true};
});
await test('source-stability',()=>{assert.deepEqual(sourceHashes(),sources);return {sources};});
const report={scope:'Only local reveal regression; prior 25 contracts remain separately frozen, no production batches or r10 replay rerun',seed,sources,passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,results};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
