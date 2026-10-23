/** Production classifier + G4 replay from persisted mesh/graph data.
 * Reconstructs query objects only. No map compiler, geometry build or deployment. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {classifyNativeRouteHoleShare,evaluateNativeSpatialRoutes} from '../../src/generation/world-study/native-spatial-routes.ts';
import {nativePrimitiveTree,nativePrimitiveDistance} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Usage: check-route-share-production.mjs NEW_DIRECTORY');
const root='docs/qa/artifacts/native-spatial-2026-10-14',captureFile=`${root}/extra-travel-c17-round1/complete-runtime.v8.gz`,designFile=`${root}/route-share-calibration/report.json`;
const runtimeFile='src/generation/world-study/native-spatial-routes.ts';
const files=[runtimeFile,'src/generation/world-study/native-spatial-geometry.ts','src/generation/world-study/native-body-collision.ts','src/generation/world-study/native-spatial-visibility.ts','src/utils/grid-raycast.ts','src/config/constants.ts','data/rift-native-spatial-policy.csv',captureFile,designFile,'tools/native-spatial/check-route-share-production.mjs'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=hashes(),captured=deserialize(gunzipSync(fs.readFileSync(captureFile))),design=JSON.parse(fs.readFileSync(designFile,'utf8')),policy=captured.recipe.nativeSpatial.policy;
const report={status:'running',scope:'Same-source pure count rules plus official G4 over saved graph/triangles and exact deployed endpoints. Query objects restored, no geometry compilation/full chain/fresh generation.',sourceHashes:before,geometryCompilations:0,fullCandidates:0,tests:[]};
fs.mkdirSync(output,{recursive:true});const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
  const [header,row]=fs.readFileSync('data/rift-native-spatial-policy.csv','utf8').trim().split(/\r?\n/),csv=Object.fromEntries(header.split(',').map((key,i)=>[key,row.split(',')[i]]));
  assert.equal(policy.holeToSolidRatio,Number(csv.hole_to_solid_ratio));assert.equal(policy.minRouteHoleShare,Number(csv.min_route_hole_share));assert.equal(policy.maxRouteHoleShare,Number(csv.max_route_hole_share));
  let integerChecks=0;const added=[],removed=[];
  for(const entry of design.integerDomains)for(let h=entry.checkedHFrom;h<=entry.checkedHThrough;h++){
    const result=classifyNativeRouteHoleShare(h,entry.total,policy);integerChecks++;assert.equal(result.accepted,entry.calibrated.includes(h));assert.equal(result.continuousAccepted,entry.previous.includes(h));
    if(result.accepted&&!result.continuousAccepted)added.push({total:entry.total,holes:h});if(!result.accepted&&result.continuousAccepted)removed.push({total:entry.total,holes:h});
  }assert.equal(integerChecks,540);assert.deepEqual(added,design.added);assert.deepEqual(removed,[]);report.tests.push({id:'independent-design-540-integer-counts',passed:true,integerChecks,added,removed});
  const classifyWord=word=>{const holes=[...word].filter(c=>c==='H').length,result=classifyNativeRouteHoleShare(holes,word.length,policy),windows=[];for(let i=0;i+policy.windowSize<=word.length;i++)if([...word.slice(i,i+policy.windowSize)].filter(c=>c==='H').length<policy.minWindowHoles)windows.push(i);return{...result,windowFailures:windows,combinedAccepted:result.accepted&&windows.length===0};};
  for(const sample of design.phaseCases){const actual=classifyWord(sample.word);assert(actual.phaseAccepted&&actual.combinedAccepted);}
  for(const sample of design.significantNegatives)assert.equal(classifyWord(sample.word).accepted,false);
  for(const key of ['windowCounterexample','sameCountPositive','legacyNonPeriodic']){const sample=design[key],actual=classifyWord(sample.word);assert.equal(actual.combinedAccepted,sample.combinedAccepted);assert.deepEqual(actual.windowFailures,sample.windowFailures);}
  assert.equal(classifyWord(design.legacyNonPeriodic.word).basis,'continuous-band');assert.equal(classifyWord('SHHSHHS').basis,'periodic-phase');report.tests.push({id:'81-phases-negatives-and-independent-six-windows',passed:true,phaseChecks:design.phaseCases.length});
  for(const [h,n,p]of [[-1,7,policy],[8,7,policy],[1.5,7,policy],[4,0,policy],[4,7.5,policy],[NaN,7,policy],[4,Infinity,policy],[4,7,{...policy,minRouteHoleShare:NaN}],[4,7,{...policy,maxRouteHoleShare:2}],[4,7,{...policy,minRouteHoleShare:.8}],[4,7,{...policy,holeToSolidRatio:0}],[4,7,{...policy,holeToSolidRatio:1.5}],[4,Number.MAX_SAFE_INTEGER,policy]])assert.throws(()=>classifyNativeRouteHoleShare(h,n,p));
  const alternate={...policy,minRouteHoleShare:0,maxRouteHoleShare:0,holeToSolidRatio:3};assert.equal(classifyNativeRouteHoleShare(5,8,alternate).phaseAccepted,false);assert.equal(classifyNativeRouteHoleShare(6,8,alternate).phaseAccepted,true);report.tests.push({id:'invalid-inputs-fail-and-frozen-ratio-not-hardcoded',passed:true,invalidCases:13});

  const saved=captured.candidate.geometry,{cols,rows,matter}=saved.terrain;
  const geometry={...saved,collision:new NativeBodyCollision({definition:saved.terrain.definition,meshes:saved.terrain.meshes},saved.terrain.tileMap),sight:{cols,rows,tileSize:8,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!matter[y*cols+x]}};
  // G4 only queries solidDistance and per-structure distance. Restore these
  // exact closures from saved actual primitives, never rectangle proxies.
  const solidTree=nativePrimitiveTree(saved.solidPrimitives);geometry.solidDistance=p=>nativePrimitiveDistance(solidTree,p.x,p.y);
  const structures=captured.candidate.groups.structures.map(s=>{const tree=nativePrimitiveTree(s.boundary);return{...s,distance:p=>nativePrimitiveDistance(tree,p.x,p.y)};});
  const actual=JSON.parse(JSON.stringify(evaluateNativeSpatialRoutes(geometry,structures,policy,captured.deployed.layout))),previous=JSON.parse(JSON.stringify(captured.gate));
  assert.deepEqual(actual.reasons,[]);assert.equal(actual.accepted,true);
  assert.deepEqual(actual.qualityDiagnostics,previous.reasons.map(reason=>reason.replace(/:narrow-transverse-opening$/,':narrow-ratio')));
  const projection=structuredClone(actual.metrics);delete projection.overallEncounters;delete projection.transverseAdmission;assert.deepEqual(projection,previous.metrics,'Every path, encounter, window, transverse result and regional metric must remain exactly unchanged');
  assert.equal(actual.metrics.overallEncounters.holes,82);assert.equal(actual.metrics.overallEncounters.solids,38);assert.equal(actual.metrics.overallEncounters.holeShare,82/120);
  assert(actual.metrics.routes.every(r=>r.transverse.maxNarrowOrUncertainRunPx<=policy.maxNarrowRunPx));
  for(const r of actual.metrics.routes)if(!r.eligible)assert.equal(r.holeShareAdmission,null,'Noneligible sample cannot be promoted');
  report.tests.push({id:'saved-c17-exact-measurements-quality-separated-from-hard-admission',passed:true,routeCount:actual.metrics.routes.length,previousReasons:previous.reasons,currentReasons:actual.reasons,qualityDiagnostics:actual.qualityDiagnostics,overallEncounters:actual.metrics.overallEncounters,maxNarrowRunPx:Math.max(...actual.metrics.routes.map(r=>r.transverse.maxNarrowOrUncertainRunPx))});
  const stricterShare={...policy,maxRouteHoleShare:.65};
  const legacyShare=evaluateNativeSpatialRoutes(geometry,structures,stricterShare,captured.deployed.layout);
  const qualityShare=evaluateNativeSpatialRoutes(geometry,structures,stricterShare,captured.deployed.layout,{encounterShareQualityOnly:true});
  assert(legacyShare.reasons.includes('overall-route-hole-share'));
  assert(qualityShare.accepted);assert(qualityShare.qualityDiagnostics.includes('overall-route-hole-share'));
  assert.deepEqual(qualityShare.metrics,legacyShare.metrics,'Quality classification cannot change measured encounters or paths');
  report.tests.push({id:'r14-share-quality-only-with-exact-measurements-and-legacy-rejection',passed:true});
  report.updatedGate=actual;report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);}
report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(before)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,tests:report.tests,geometryCompilations:0,fullCandidates:0,error:report.error},null,2));if(report.status!=='passed')process.exitCode=1;
