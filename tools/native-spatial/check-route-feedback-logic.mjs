/** Real saved c27 route feedback plus pure archive/qualification counterexamples. No new geometry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';
import {nativePrimitiveTree,nativePrimitiveDistance,nativeVoidPrimitives} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {evaluateNativeSpatialRoutes} from '../../src/generation/world-study/native-spatial-routes.ts';
import {freezeNativeSpatialRouteProbe,assessNativeSpatialRouteFeedback,evaluateNativeSpatialRouteProbe,nativeSpatialRouteViolationVector} from '../../src/generation/world-study/native-spatial-route-feedback.ts';
import {NativeSpatialGeometryArchive} from '../../src/generation/world-study/native-spatial-generation.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const root='docs/qa/artifacts/native-spatial-2026-10-14',capture=`${root}/complete-candidate-c27-capture-round2/rejected-runtime.v8.gz`;
const files=['tools/native-spatial/check-route-feedback-logic.mjs',...['native-spatial-route-feedback','native-spatial-routes','native-spatial-generation','native-spatial-geometry','native-body-collision'].map(name=>`src/generation/world-study/${name}.ts`),capture];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const sourceHashes=hashes(),data=deserialize(gunzipSync(fs.readFileSync(capture))),policy=data.recipe.nativeSpatial.policy,saved=data.candidate.geometry;
const {cols,rows,matter}=saved.terrain,solidTree=nativePrimitiveTree(saved.solidPrimitives),voidTree=nativePrimitiveTree(nativeVoidPrimitives(saved.terrain));
const geometry={...saved,collision:new NativeBodyCollision({definition:saved.terrain.definition,meshes:saved.terrain.meshes},saved.terrain.tileMap),
  solidDistance:p=>nativePrimitiveDistance(solidTree,p.x,p.y),voidDistance:p=>nativePrimitiveDistance(voidTree,p.x,p.y),
  sight:{cols,rows,tileSize:8,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!matter[y*cols+x]}};
const groups={...data.candidate.groups,structures:data.candidate.groups.structures.map(s=>{const tree=nativePrimitiveTree(s.boundary);return{...s,distance:p=>nativePrimitiveDistance(tree,p.x,p.y)};})};
const report={status:'running',scope:'Current official G4 and feedback on immutable c27 actual geometry/content. Query closures restored; zero geometry compilation, full deployment or fresh layout. Archive cases are pure logic, not synthetic world admission.',sourceHashes,geometryCompilations:0,fullCandidates:0,freshLayouts:0,cases:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const check=(id,run)=>{try{report.cases.push({id,passed:true,...run()});}catch(error){report.cases.push({id,passed:false,error:String(error.stack??error)});}save();};
let gate,probe,feedback;
check('actual-c27-five-rejections-and-recomputed-frozen-family',()=>{
  gate=evaluateNativeSpatialRoutes(geometry,groups.structures,policy,data.deployed.layout);
  const old=JSON.parse(fs.readFileSync(`${root}/route-share-production-round1/report.json`,'utf8')).updatedGate;
  assert.deepEqual(JSON.parse(JSON.stringify(gate)),old);assert.equal(gate.reasons.length,5);
  probe=freezeNativeSpatialRouteProbe(20261012,28,'9faebdbd40a92649',data.deployed.layout,gate);
  let checkpoints=0;feedback=evaluateNativeSpatialRouteProbe(probe,geometry,groups,data.candidate.trace.gates.geometry,policy,()=>{checkpoints++;});
  report.actualProbe=probe;report.actualFeedback=feedback;save();
  assert.deepEqual(feedback.gate,gate);assert(feedback.comparable);assert.equal(probe.nodes.length,8);assert.equal(checkpoints,3);
  assert(Object.isFrozen(probe)&&Object.isFrozen(probe.nodes)&&Object.isFrozen(probe.nodes[0].position));
  assert.deepEqual(probe.baselineEligibleRouteIds,gate.metrics.routes.filter(r=>r.eligible).map(r=>r.id));
  return{actualReasons:gate.reasons,routeCount:gate.metrics.routes.length,nodeCount:8,eligibleCount:probe.baselineEligibleRouteIds.length,checkpoints};
});
check('actual-type-events-map-to-complete-H-and-S-identities',()=>{
  const holeIds=new Set(data.candidate.layout.holes.map(h=>h.holeId)),solidIds=new Set(data.candidate.layout.assemblies.map(a=>a.assemblyId));
  const type=feedback.witnesses.filter(w=>w.kind==='hole-share');assert.equal(type.length,3);
  for(const w of type){assert(w.events.length>=6);for(const event of w.events){assert(event.objectIds.length);for(const id of event.objectIds)assert((event.kind==='hole'?holeIds:solidIds).has(id));assert(Number.isFinite(event.point.x)&&Number.isFinite(event.point.y));}}
  return{typeWitnessCount:type.length,events:type.map(w=>({routeId:w.routeId,events:w.events.map(e=>({kind:e.kind,structureId:e.structureId,objectIds:e.objectIds,at:e.at}))}))};
});
check('actual-narrow-witnesses-use-owned-closed-sections',()=>{
  const narrow=feedback.witnesses.filter(w=>w.kind==='narrow');assert.equal(narrow.length,2);
  const sections=narrow.flatMap(w=>w.crossSections??[]);assert(sections.length,'Saved c27 must expose an actual owned closed section');
  for(const section of sections){assert(section.closed);assert(section.widthLowerPx<policy.narrowWidthPx);for(const hit of section.hits){if(hit.owner.kind!=='exterior')assert(hit.owner.objectIds.length);assert(Number.isFinite(hit.point.x)&&Number.isFinite(hit.point.y));}}
  return{narrowWitnesses:narrow.map(w=>({routeId:w.routeId,ownedClosedSections:w.crossSections.length,minimum:w.crossSections[0]??null}))};
});
check('lost-eligibility-region-and-node-seat-never-score-improvement',()=>{
  const eligible=probe.baselineEligibleRouteIds[0],region=probe.baselineExploreRouteIds[0],node=`node:${probe.nodes[0].id}`;
  for(const mode of ['eligible','region','node']){const changed=structuredClone(gate);if(mode==='eligible')changed.metrics.routes.find(r=>r.id===eligible).eligible=false;else changed.metrics.routes=changed.metrics.routes.filter(r=>r.id!==(mode==='region'?region:node));
    const score=nativeSpatialRouteViolationVector(probe,changed,policy);assert(score.comparabilityReasons.length);const result=assessNativeSpatialRouteFeedback(probe,changed,geometry,groups,data.candidate.trace.gates.geometry,policy);assert(!result.comparable);assert.equal(result.maximum,Infinity);}
  const lost=assessNativeSpatialRouteFeedback(probe,gate,{...geometry,collision:{supports:()=>false}},groups,data.candidate.trace.gates.geometry,policy);assert(!lost.comparable);assert(lost.comparabilityReasons.includes('spawn:lost-body-support'));assert(lost.comparabilityReasons.includes('exit:lost-body-support'));
  return{guardCases:4};
});
check('node-centres-do-not-replace-official-interaction-seats',()=>{
  const endpoints=new Set([probe.spawnPoint,probe.exitPoint]);
  const result=assessNativeSpatialRouteFeedback(probe,gate,{...geometry,collision:{supports:p=>endpoints.has(p)}},groups,data.candidate.trace.gates.geometry,policy);
  assert(result.comparable);return{nodeSeatRule:'Actual official G4 route exists; only spawn and exit require endpoint body support'};
});
check('route-archive-uses-actual-vector-not-ground-mean-and-deduplicates-geometry',()=>{
  const archive=new NativeSpatialGeometryArchive(policy),ground=data.candidate.trace.gates.geometry;
  const base={...data.candidate.layout,candidate:100},better={...base,candidate:101},fp={hash:'base',canonical:'base'},next={hash:'better',canonical:'better'};
  const a={...feedback,violations:[1,.5]},b={...feedback,violations:[.9,.5]},worseMean={...ground,metrics:{...ground.metrics,maxEmptyUpperPx:159,internalMeanDistancePx:100000}};
  archive.offer(base,ground,fp,undefined,a);const before=archive.nextBase;archive.offer(better,worseMean,next,undefined,b);archive.recordRefinement(before,{layout:better,gate:worseMean,fingerprint:next,routeFeedback:b});
  assert.equal(archive.nextBase.layout.candidate,101);archive.offer({...better,candidate:102},ground,next,undefined,{...feedback,violations:[0,0]});assert.equal(archive.nextBase.layout.candidate,101);
  assert.throws(()=>archive.offer({...better,candidate:103},ground,{hash:'invalid',canonical:'invalid'},undefined,{...feedback,comparable:false}));
  archive.advanceRouteDomain(archive.nextBase,3,['a','b']);assert.equal(archive.nextBase.routeFeedback.refinementOrdinal,3);assert.deepEqual(archive.nextBase.routeFeedback.seenTupleKeys,['a','b']);
  archive.retire(archive.nextBase);assert(!archive.candidateIds.includes(101));return{betterRouteWithWorseGroundMeanSelected:true,repeatedGeometryDidNotReset:true};
});
report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(sourceHashes)===JSON.stringify(report.sourceHashesAfter);report.status=report.cases.every(c=>c.passed)&&report.sourcesStable?'passed':'failed';save();
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,cases:report.cases,geometryCompilations:0,fullCandidates:0},null,2));if(report.status!=='passed')process.exitCode=1;
