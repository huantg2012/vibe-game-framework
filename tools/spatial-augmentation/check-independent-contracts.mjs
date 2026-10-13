/** Independent, small real-geometry fixtures. No material bake or production data edits. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SPATIAL_AUGMENTATION_POLICY} from '../../src/generated/r100-spatial-augmentation.ts';
import {buildSpatialGeometry,createSpatialBaseline,measureSpatialCandidate,spatialReachable} from '../../src/generation/world-study/spatial-augmentation-measure.ts';
import {augmentSpatialTerrain,evaluateSpatialCandidate,findSpatialRevealWitness} from '../../src/generation/world-study/spatial-augmentation-selection.ts';
import {spatialCandidateAttempts,deriveSpatialAugmentationSeed} from '../../src/generation/world-study/spatial-augmentation-candidates.ts';
import {validSpatialAugmentationPolicy} from '../../src/generation/world-study/spatial-augmentation-types.ts';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {hasLineOfSight} from '../../src/utils/grid-raycast.ts';

const destination=process.argv[2]??'docs/qa/artifacts/spatial-augmentation-2026-10-13/qa/independent-attempt1.json';
assert(!fs.existsSync(destination),'Do not overwrite prior QA evidence');
const sources=['src/generation/world-study/spatial-augmentation-types.ts','src/generation/world-study/spatial-augmentation-measure.ts','src/generation/world-study/spatial-augmentation-candidates.ts','src/generation/world-study/spatial-augmentation-selection.ts','src/generation/world-study/native-terrain.ts','src/generated/r100-spatial-augmentation.ts','data/rift-spatial-augmentation-policy.csv','data/rift-spatial-augmentation-profiles.csv'];
const sourceHashes=()=>Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const initialSourceHashes=sourceHashes();
const seed=20261013, policy=structuredClone(SPATIAL_AUGMENTATION_POLICY), p=policy.parameters;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const recipe=JSON.parse(fs.readFileSync('docs/qa/artifacts/spatial-augmentation-2026-10-13/qa/r10-current/split-rib-causeway-medium-20261012.recipe.json','utf8'));
const definition={...recipe.nativeDefinition,id:'qa-open-fixture',cols:32,rows:24,axis:0,instances:[],erosion:[],terrainOutline:rect(32,32,960,704),
  spawn_x:100,spawn_y:100,exit_x:900,exit_y:680,search_x:300,search_y:300,enemy_x:800,enemy_y:500};
delete definition.fragmentShapeVersion;
const fragmentShape={algorithmVersion:'rectilinear-fragment-v1',layoutId:'qa-open-fixture',sourceHash:'0'.repeat(64),seedMode:'run-seed',seedSalt:0,edgeSeed:seed,
  layout:{authoringFrame:[512,384],worldScale:2,landRects:[[16,16,480,352]],voidRects:[]}};
const profile=policy.profiles.find(row=>row.family===definition.family);
function solid(id,x,y,role='solid',overrides={}) {
  return {id,role,family:profile.family,x,y,rotation:profile.rotationOffsetRad,length:(profile.minLengthPx+profile.maxLengthPx)/2,
    width:(profile.minWidthPx+profile.maxWidthPx)/2,height:(profile.minHeightPx+profile.maxHeightPx)/2,thickness:profile.thicknessPx,
    fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion,
    constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,...overrides};
}
function candidate(next,{id='qa-candidate',kind='void',axis='physical',newSolidIds=[],newVoidBoundary=[],addedSolidIds=newSolidIds,addedVoidCount=kind==='solid'?0:1,hotspot={x:516,y:388}}={}) {
  return {id,kind,axis,definition:next,fragmentShape,newSolidIds,newVoidBoundary,addedSolidIds,addedVoidCount,hotspot};
}
function summary(state) {
  return {deficits:state.deficits,removedBaseRatio:state.removedBaseRatio,addedSolidRatio:state.addedSolidRatio,bodyCenterLossRatio:state.bodyCenterLossRatio,
    wideCoreRetainedRatio:state.wideCoreRetainedRatio,largestOpenCoreRetainedRatio:state.largestOpenCoreRetainedRatio,anchorsConnected:state.anchorsConnected,
    bodyReachableRatio:state.geometry.reachableCount/state.geometry.supportedCount,survivingProbes:state.survivingProbes.filter(Boolean).length};
}
function freeze(value) {if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
const results=[];
async function test(id,fn) {const start=performance.now();try {const evidence=await fn();results.push({id,passed:true,elapsedMs:Math.round(performance.now()-start),...evidence});}
  catch(error){results.push({id,passed:false,elapsedMs:Math.round(performance.now()-start),error:error.message,details:error.cause??null});}console.log(JSON.stringify(results.at(-1)));}
const baseline=createSpatialBaseline(buildSpatialGeometry(definition,seed),p),initial=measureSpatialCandidate(baseline,baseline.geometry);

await test('J01-solid-blocks-body-does-not-improve-occlusion',()=>{
  const next={...definition,instances:[solid(1,580,388)]},geometry=buildSpatialGeometry(next,seed),state=measureSpatialCandidate(baseline,geometry);
  assert(state.deficits.physical<baseline.deficits.physical);assert.equal(state.deficits.occlusion,baseline.deficits.occlusion);
  const mesh=geometry.terrain.meshes[0];let witness;
  for(let face=0;face<mesh.triangleCount&&!witness;face++){
    const indices=[0,1,2].map(i=>mesh.indices[face*3+i]*3),q={x:indices.reduce((s,i)=>s+mesh.positions[i],0)/3,y:indices.reduce((s,i)=>s+mesh.positions[i+1],0)/3};
    const a={x:q.x-100,y:q.y},b={x:q.x+100,y:q.y};
    if(!geometry.collision.supports(q,10,10)&&hasLineOfSight(geometry.sight,a,b))witness={point:q,a,b};
  }
  assert(witness,'No true solid-body / transparent-ray witness');
  return {baseline:baseline.deficits,candidate:summary(state),witness};
});
await test('J01-relief-does-not-claim-solid-gain',()=>{
  const geometry=buildSpatialGeometry({...definition,instances:[solid(1,580,388,'relief')]},seed),state=measureSpatialCandidate(baseline,geometry);
  assert.deepEqual(state.deficits,baseline.deficits);assert.equal(state.addedSolidRatio,0);return {candidate:summary(state)};
});
await test('J02-missing-fixed-probes-and-endpoints-preserve-cost',()=>{
  const reach=new Uint8Array(baseline.geometry.reachable),probe=baseline.probes.find(row=>row.physicalCost>.4&&row.pairs.length>=8);
  assert(probe);const cols=baseline.geometry.terrain.cols;
  reach[probe.cell]=0;for(const pair of probe.pairs)reach[Math.floor(pair.endpoint.y/8)*cols+Math.floor(pair.endpoint.x/8)]=0;
  const geometry={...baseline.geometry,reachable:reach},state=measureSpatialCandidate(baseline,geometry);
  assert.deepEqual(state.deficits,baseline.deficits);assert(state.bodyCenterLossRatio>0);
  return {removedPoint:probe.point,removedEndpointCount:probe.pairs.length,baseline:baseline.deficits,candidate:summary(state),
    note:'Only reachability is removed in this adversarial fixture. Matter/triangles/rays remain unchanged, isolating denominator handling.'};
});
await test('J02-real-void-deletion-retains-each-lost-probe-cost',()=>{
  const hole=rect(416,288,192,160),geometry=buildSpatialGeometry({...definition,erosion:[hole]},seed),state=measureSpatialCandidate(baseline,geometry);
  const lost=[];baseline.probes.forEach((probe,index)=>{if(!state.survivingProbes[index]){assert.equal(state.physicalCosts[index],probe.physicalCost);assert.equal(state.occlusionCosts[index],probe.occlusionCost);lost.push(index);}});
  assert(lost.length>0);assert.equal(state.physicalCosts.length,baseline.probes.length);assert(state.removedBaseRatio>0);
  return {lostProbeCount:lost.length,fixedProbeCount:baseline.probes.length,candidate:summary(state)};
});
await test('J03-body-connected-narrow-bridge-loses-wide-core',()=>{
  const points=[[32,32],[480,32],[480,352],[544,352],[544,32],[992,32],[992,736],[544,736],[544,384],[480,384],[480,736],[32,736]].map(([x,y])=>({x,y}));
  const next={...definition,terrainOutline:points},geometry=buildSpatialGeometry(next,seed),state=measureSpatialCandidate(baseline,geometry);
  assert.equal(geometry.reachableCount,geometry.supportedCount,'Fixture must still connect full 20px bodies');
  assert.equal(state.anchorsConnected,false,'Wide-core anchors must not accept the 32px bridge');
  const evaluation=evaluateSpatialCandidate(baseline,initial,candidate(next),policy,seed);
  assert(!evaluation.state);assert(evaluation.receipt.reasons.includes('fixed-anchor-lost'));
  return {candidate:summary(state),reasons:evaluation.receipt.reasons,baselineWideGroups:baseline.wideAnchorGroups.length,baselineAnchors:baseline.wideAnchors.length};
});
await test('J03-no-core-is-not-applicable',()=>{
  const next={...definition,terrainOutline:rect(32,80,960,40),spawn_x:100,spawn_y:100},small=createSpatialBaseline(buildSpatialGeometry(next,seed),p),state=measureSpatialCandidate(small,small.geometry);
  assert.equal(small.wideCoreCount,0);assert.equal(state.wideCoreRetainedRatio,null);assert.equal(state.largestOpenCoreRetainedRatio,null);
  return {candidate:summary(state),probeCount:small.probes.length};
});
await test('J04-source-instance-mutation-rejected-without-input-mutation',()=>{
  const input=freeze({...definition,instances:[solid(1,580,388)]}),base=createSpatialBaseline(buildSpatialGeometry(input,seed),p),current=measureSpatialCandidate(base,base.geometry),before=hash(input);
  const bad=candidate({...input,instances:[{...input.instances[0],length:90}]},{kind:'solid',newSolidIds:[],addedSolidIds:[]});
  const receipt=evaluateSpatialCandidate(base,current,bad,policy,seed).receipt;
  assert(receipt.reasons.includes('source-instance-mutated'));assert.equal(hash(input),before);return {reasons:receipt.reasons,inputHash:before};
});
await test('J04-existing-relief-ground-cut-is-rejected',()=>{
  const item=solid(1,580,388,'relief'),base=createSpatialBaseline(buildSpatialGeometry({...definition,instances:[item]},seed),p),current=measureSpatialCandidate(base,base.geometry);
  const hole=rect(544,356,72,64),next={...base.geometry.terrain.definition,erosion:[hole]},receipt=evaluateSpatialCandidate(base,current,candidate(next,{axis:'occlusion',newVoidBoundary:hole}),policy,seed).receipt;
  const protectedReason=receipt.reasons.find(reason=>/existing.*(?:solid|instance|relief)|(?:solid|instance|relief).*ground|source.*support|ground-cut/.test(reason));
  assert(protectedReason,new Error('Original relief support was not guarded',{cause:{reasons:receipt.reasons}}).message);
  return {reasons:receipt.reasons,protectedReason};
});
await test('J06-exception-then-identical-evaluation-is-pure',()=>{
  const inputHash=hash({definition,fragmentShape,policy}),geometryHash=hash({matter:[...baseline.geometry.terrain.matter],reach:[...baseline.geometry.reachable],probes:baseline.probes});
  const next={...definition,instances:[solid(1,580,388)]},c=candidate(next,{kind:'solid',newSolidIds:[1]});
  const a=evaluateSpatialCandidate(baseline,initial,c,policy,seed);
  evaluateSpatialCandidate(baseline,initial,candidate({...definition,terrainOutline:[]}),policy,seed);
  const b=evaluateSpatialCandidate(baseline,initial,c,policy,seed);
  assert.deepEqual(a.receipt,b.receipt);assert.equal(hash({definition,fragmentShape,policy}),inputHash);
  assert.equal(hash({matter:[...baseline.geometry.terrain.matter],reach:[...baseline.geometry.reachable],probes:baseline.probes}),geometryHash);
  return {receipt:a.receipt,inputHash,geometryHash,note:'Candidate geometry rollback/purity only. Final content-deployment fallback belongs to integration gate.'};
});
await test('J07-policy-schema-rejects-invalid-budgets',()=>{
  const cases=[['maxRounds',0],['maxRounds',-1],['maxRounds',1.5],['maxRounds',NaN],['maxCandidatesPerRound',Infinity],['maxAddedVoids',5]];
  for(const [key,value]of cases)assert.equal(validSpatialAugmentationPolicy({...policy,parameters:{...p,[key]:value}}),false,`${key}=${value}`);
  assert(validSpatialAugmentationPolicy(policy));return {rejectedCases:cases.map(([key,value])=>`${key}=${value}`)};
});
await test('J07-no-budget-is-not-targets-met-and-is-deterministic',()=>{
  const compiled=compileR100FragmentShape(fragmentShape),next={...definition,terrainOutline:compiled.terrainOutline,erosion:compiled.erosion,fragmentShapeVersion:fragmentShape.algorithmVersion};
  const noAdd=freeze({...policy,parameters:{...p,maxAddedSolids:0,maxAddedVoids:0}}),request=freeze({definition:next,fragmentShape,policy:noAdd,seed}),before=hash(request);
  const first=augmentSpatialTerrain(request),second=augmentSpatialTerrain(request);
  assert.deepEqual(first,second);assert.equal(hash(request),before);assert.equal(first[0].trace.status,'no-feasible-improvement');assert.equal(first[0].trace.acceptedCandidateIds.length,0);
  assert(first[0].trace.baselineDeficits.occlusion>0);assert(first[0].trace.evaluatedCandidates<=p.maxCandidatesPerRound*p.maxRounds);
  return {resultHash:hash(first),trace:first[0].trace};
});
await test('J05-normalized-clone-is-rejected-away-from-original',()=>{
  const plan={definition,fragmentShape,addedSolidIds:[],addedVoidCount:0},hotspot={point:{x:516,y:388},axis:'physical',burden:1};
  const first=[...spatialCandidateAttempts(plan,[hotspot],policy,seed,0)].find(row=>row.id==='r0-h0-solid-0');assert(first.candidate);
  const secondPlan={...first.candidate,addedGroups:first.candidate.addedGroups};
  const other={...hotspot,point:{x:200,y:180}};
  const second=[...spatialCandidateAttempts(secondPlan,[other],policy,seed,0)].find(row=>row.id==='r0-h0-solid-0');
  assert.equal(second.rejection,'repeated-normalized-geometry');return {originalGroup:first.candidate.addedGroups[0],newHotspot:other.point,rejection:second.rejection};
});
await test('J05-three-kinds-have-real-constructible-candidates',()=>{
  const plan={definition,fragmentShape,addedSolidIds:[],addedVoidCount:0},hotspot={point:{x:516,y:388},axis:'physical',burden:1};
  const attempts=[...spatialCandidateAttempts(freeze(plan),[hotspot],freeze(structuredClone(policy)),seed,0)],counts={};
  for(const kind of ['solid','void','combined']){const matching=attempts.filter(row=>row.kind===kind);assert.equal(matching.length,2);counts[kind]=matching.filter(row=>row.candidate).length;assert(counts[kind]>0,`${kind} has only errors: ${matching.map(row=>row.rejection).join(', ')}`);}
  assert(!attempts.some(row=>/known required numeric fields/.test(row.rejection??'')),'A swallowed programmer schema error must not masquerade as a geometric rejection');
  return {counts,note:'Constructibility only; each constructed candidate still requires full geometry evaluation.'};
});
await test('J05-third-equal-spaced-group-rejected-for-all-kinds',()=>{
  const plan={definition,fragmentShape,addedSolidIds:[],addedVoidCount:0},hotspot={point:{x:600,y:388},axis:'physical',burden:1};
  const prototypes=[...spatialCandidateAttempts(plan,[hotspot],policy,seed,0)],evidence=[];
  for(const kind of ['solid','void','combined']) {
    const id=`r0-h0-${kind}-0`,prototype=prototypes.find(row=>row.id===id);assert(prototype.candidate,prototype.rejection);
    const group=prototype.candidate.addedGroups.at(-1),prior=[320,160].map((offset,index)=>({...group,kind:index?'solid':'void',shape:'different',center:{x:group.center.x-offset,y:group.center.y}}));
    const attempts=[...spatialCandidateAttempts({...plan,addedGroups:prior},[hotspot],policy,seed,0)],result=attempts.find(row=>row.id===id);
    assert.equal(result.rejection,'repeated-equal-spacing-row');evidence.push({kind,centers:[...prior.map(row=>row.center),group.center],rejection:result.rejection});
  }
  return {evidence,note:'Direct generation seam isolates newly accepted-group repetition; it does not pretend these metadata-only prior groups are a deployed map.'};
});
await test('J05-existing-source-row-does-not-trigger-new-group-array-rule',()=>{
  const blank={definition,fragmentShape,addedSolidIds:[],addedVoidCount:0,addedGroups:[]},hotspots=[{point:{x:520,y:388},axis:'physical',burden:1}];
  const at=[...spatialCandidateAttempts(blank,hotspots,policy,seed,0)].find(row=>row.id==='r0-h0-solid-0').candidate.addedGroups.at(-1).center;
  const plan={...blank,definition:{...definition,instances:[solid(1,at.x-320,at.y),solid(2,at.x-160,at.y)]}};
  const result=[...spatialCandidateAttempts(plan,hotspots,policy,seed,0)].find(row=>row.id==='r0-h0-solid-0');
  assert(result.candidate,result.rejection);return {candidateCenter:result.candidate.addedGroups.at(-1).center,note:'Candidate creation only; ordinary footprint/core gates still must run.'};
});
await test('J01-real-void-reveal-has-true-ray-and-full-body-route',()=>{
  const geometry=buildSpatialGeometry({...definition,erosion:[rect(416,288,192,160)]},seed),witness=findSpatialRevealWitness(baseline,geometry);assert(witness);
  assert(spatialReachable(geometry,witness.observer));assert(spatialReachable(geometry,witness.hidden));assert(spatialReachable(geometry,witness.revealed));
  assert.equal(hasLineOfSight(geometry.sight,witness.observer,witness.hidden),false);assert.equal(hasLineOfSight(geometry.sight,witness.observer,witness.revealed),true);
  let length=0;for(let i=1;i<witness.route.length;i++){const a=witness.route[i-1],b=witness.route[i];assert.equal(geometry.collision.displacementFraction(a,10,10,b.x-a.x,b.y-a.y),1);length+=Math.hypot(b.x-a.x,b.y-a.y);}
  assert(Math.abs(length-witness.routeLengthPx)<1e-6);assert(length>=p.revealRouteMinPx&&length<=p.revealRouteMaxPx);
  assert(Math.hypot(witness.hidden.x-witness.observer.x,witness.hidden.y-witness.observer.y)<=p.occlusionRadiusPx+1e-9);
  assert(Math.hypot(witness.revealed.x-witness.observer.x,witness.revealed.y-witness.observer.y)<=p.referenceSightPx+1e-9,'A clear ray outside the reference sight range is not a reveal witness');
  return {witness,initialDistance:Math.hypot(witness.hidden.x-witness.observer.x,witness.hidden.y-witness.observer.y),revealedDistance:Math.hypot(witness.revealed.x-witness.observer.x,witness.revealed.y-witness.observer.y),note:'Static shared VOID ray plus body route only; no enemy perception state or player input is exercised. Revealed endpoint distance is separately recorded, not assumed within visual range.'};
});
await test('J01-existing-hole-cannot-supply-new-reveal-credit',()=>{
  const geometry=buildSpatialGeometry({...definition,erosion:[rect(416,288,192,160)]},seed);
  assert(findSpatialRevealWitness(baseline,geometry));assert.equal(findSpatialRevealWitness(baseline,geometry,geometry),undefined);
  return {newHoleWitnessExists:true,identicalPreviousGeometryWitness:false};
});
await test('J08-candidate-rng-is-scoped-to-frozen-identity-and-attempt',()=>{
  const first=deriveSpatialAugmentationSeed(seed,'qa-open-fixture',policy,seed),again=deriveSpatialAugmentationSeed(seed,'qa-open-fixture',structuredClone(policy),seed);
  assert.equal(first,again);
  const independent={first,otherWorld:deriveSpatialAugmentationSeed(seed,'qa-second-fixture',policy,seed),otherRequestedSeed:deriveSpatialAugmentationSeed(seed+1,'qa-open-fixture',policy,seed),
    otherPolicyHash:deriveSpatialAugmentationSeed(seed,'qa-open-fixture',{...policy,sourceHash:'1'.repeat(64)},seed),otherGeometryAttempt:deriveSpatialAugmentationSeed(seed,'qa-open-fixture',policy,seed+1)};
  assert.equal(new Set(Object.values(independent)).size,Object.values(independent).length);
  const blank=freeze({definition,fragmentShape,addedSolidIds:[],addedVoidCount:0}),hotspots=[{point:{x:516,y:388},axis:'physical',burden:1}];
  const a=[...spatialCandidateAttempts(blank,hotspots,policy,seed,0,first)],b=[...spatialCandidateAttempts(blank,hotspots,policy,seed,0,first)],c=[...spatialCandidateAttempts(blank,hotspots,policy,seed,0,independent.otherWorld)];
  assert.deepEqual(a,b);assert.notEqual(hash(a),hash(c));
  return {candidateSeeds:independent,sameAttemptCandidateHash:hash(a),otherWorldCandidateHash:hash(c),
    note:'Different existing geometry attempts are allowed to remeasure; this checks deterministic separate candidate RNG without changing the mesh/evaluation seed.'};
});
await test('J07-disabled-retains-residual-without-claiming-completion',()=>{
  const result=augmentSpatialTerrain({definition,fragmentShape,policy:{...policy,enabled:false},seed})[0];
  assert.equal(result.trace.status,'disabled');assert.equal(result.trace.evaluatedCandidates,0);assert.deepEqual(result.trace.remainingDeficits,result.trace.baselineDeficits);
  return {trace:result.trace};
});
await test('J07-no-deficit-does-not-create-fake-gain',()=>{
  const next={...definition,terrainOutline:rect(80,80,48,48),spawn_x:100,spawn_y:100},result=augmentSpatialTerrain({definition:next,fragmentShape,policy,seed})[0];
  assert.deepEqual(result.trace.baselineDeficits,{physical:0,occlusion:0});assert.equal(result.trace.status,'policy-targets-met');assert.equal(result.trace.evaluatedCandidates,0);assert.equal(result.trace.addedSolidIds.length,0);assert.equal(result.trace.addedVoidCount,0);
  return {trace:result.trace,note:'No valid four-endpoint optical sample; this case claims no measured deficit, not good stealth.'};
});
await test('J07-positive-deficit-budget-exhaustion-is-not-completion',()=>{
  const compiled=compileR100FragmentShape(fragmentShape),next={...definition,terrainOutline:compiled.terrainOutline,erosion:compiled.erosion,fragmentShapeVersion:fragmentShape.algorithmVersion};
  const oneRound={...policy,parameters:{...p,maxRounds:1}},first=augmentSpatialTerrain({definition:next,fragmentShape,policy:oneRound,seed}),second=augmentSpatialTerrain({definition:next,fragmentShape,policy:oneRound,seed});
  assert.deepEqual(first,second);const trace=first[0].trace;
  assert(trace.evaluatedCandidates<=p.maxCandidatesPerRound);assert.notEqual(trace.status,'policy-targets-met');
  assert(trace.remainingDeficits.occlusion>trace.baselineDeficits.occlusion*(1-p.targetOcclusionReduction)||trace.remainingDeficits.physical>trace.baselineDeficits.physical*(1-p.targetPhysicalReduction));
  return {resultHash:hash(first),status:trace.status,trace,establishedBudgetExhaustion:trace.status==='budget-exhausted',
    note:trace.status==='budget-exhausted'?'Positive budget-exhaustion witness':'No accepted candidate in this fixture; no-feasible is honest but budget exhaustion remains unestablished.'};
});
await test('J07-both-pending-axes-receive-their-own-candidate-slots',()=>{
  const compiled=compileR100FragmentShape(fragmentShape),next={...definition,terrainOutline:compiled.terrainOutline,erosion:compiled.erosion,fragmentShapeVersion:fragmentShape.algorithmVersion};
  const trace=augmentSpatialTerrain({definition:next,fragmentShape,policy:{...policy,parameters:{...p,maxRounds:1,maxAddedSolids:0,maxAddedVoids:0}},seed})[0].trace;
  const counts=Object.fromEntries(['physical','occlusion'].map(axis=>[axis,trace.candidates.filter(row=>row.axis===axis).length]));
  assert(trace.baselineDeficits.physical>0&&trace.baselineDeficits.occlusion>0);assert(counts.physical>=6&&counts.occlusion>=6);assert.equal(trace.evaluatedCandidates,18);
  for(const axis of ['physical','occlusion'])assert.deepEqual([...new Set(trace.candidates.filter(row=>row.axis===axis).map(row=>row.kind))].sort(),['combined','solid','void']);
  return {counts,status:trace.status,note:'Proves unsuccessful primary-axis candidates do not suppress evaluation of the other pending axis.'};
});
await test('J07-large-open-positive-selection-is-budget-exhausted-not-complete',()=>{
  const largeFragment={...fragmentShape,layout:{authoringFrame:[1152,896],worldScale:2,landRects:[[32,32,1088,832]],voidRects:[]}};
  const compiled=compileR100FragmentShape(largeFragment),next={...definition,cols:72,rows:56,terrainOutline:compiled.terrainOutline,erosion:compiled.erosion,fragmentShapeVersion:fragmentShape.algorithmVersion};
  const oneRound={...policy,parameters:{...p,maxRounds:1}},request=freeze({definition:next,fragmentShape:largeFragment,policy:oneRound,seed});
  const first=augmentSpatialTerrain(request),second=augmentSpatialTerrain(request);assert.deepEqual(first,second);
  const trace=first[0].trace;assert(trace.acceptedCandidateIds.length>0,'Positive fixture has no accepted candidate');assert.equal(trace.status,'budget-exhausted');
  assert(trace.evaluatedCandidates<=18);assert.equal(first.length,2);assert.equal(first[1].trace.fallback,true);assert.deepEqual(first[1].definition,request.definition);assert.deepEqual(first[1].fragmentShape,request.fragmentShape);
  return {resultHash:hash(first),status:trace.status,baseline:trace.baselineDeficits,remaining:trace.remainingDeficits,selected:trace.candidates.filter(row=>row.accepted),fallback:summary(measureSpatialCandidate(createSpatialBaseline(buildSpatialGeometry(next,seed),p),buildSpatialGeometry(first[1].definition,seed)))};
});
await test('J01-solid-only-can-be-selected-but-occlusion-remains-unmet',()=>{
  const largeFragment={...fragmentShape,layout:{authoringFrame:[1152,896],worldScale:2,landRects:[[32,32,1088,832]],voidRects:[]}};
  const compiled=compileR100FragmentShape(largeFragment),next={...definition,cols:72,rows:56,terrainOutline:compiled.terrainOutline,erosion:compiled.erosion,fragmentShapeVersion:fragmentShape.algorithmVersion};
  const result=augmentSpatialTerrain({definition:next,fragmentShape:largeFragment,policy:{...policy,parameters:{...p,maxRounds:1,maxAddedVoids:0}},seed})[0],trace=result.trace;
  assert(trace.addedSolidIds.length>0,'Positive fixture selected no solid');assert.equal(trace.addedVoidCount,0);assert.equal(trace.remainingDeficits.occlusion,trace.baselineDeficits.occlusion);assert.notEqual(trace.status,'policy-targets-met');
  return {status:trace.status,baseline:trace.baselineDeficits,remaining:trace.remainingDeficits,selected:trace.candidates.filter(row=>row.accepted)};
});

await test('source-stability',()=>{assert.deepEqual(sourceHashes(),initialSourceHashes);return {sources:initialSourceHashes};});
const report={scope:'Independent small geometry contracts; not full generation, old r10, real enemy perception or UI play',seed,policySourceHash:policy.sourceHash,
  sources:initialSourceHashes,
  passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,results};
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({destination,passed:report.passed,failed:report.failed}));process.exitCode=report.failed?1:0;
