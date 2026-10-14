/** Pure successful-trace projection checks; no fabricated map admission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativeSpatialReplayAttempts} from '../../src/generation/world-study/r100-production-map.ts';
import {checkpointChecksum} from '../../src/types/rift-checkpoint.ts';
import {exactHash} from '../stealth-obstacles/baseline.mjs';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW receipt path');
const files=['src/generation/world-study/r100-production-map.ts','src/generation/world-study/native-spatial-generation.ts','src/generation/world-study/native-spatial-initial-placement.ts','src/types/rift-checkpoint.ts','tools/native-spatial/check-complete-candidate-replay-trace.mjs','tools/stealth-obstacles/baseline.mjs'];
const snapshot=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=snapshot(),cases=[];
const fixture=()=>[{
  geometrySeed:20261012,proposalBudget:72,layoutProposals:2,geometryEvaluations:3,geometryWorkBudget:72,finalGeometryEvaluations:2,fullCandidates:1,feedbackBases:[],stopReason:'selected',
  geometryWork:[{kind:'final-geometry',candidate:1,ordinal:3,outcome:'accepted',elapsedMs:12.25,reasons:[],finalMeasurementStarted:true}],
  candidates:[{candidate:1,geometrySeed:20261012,layoutSeed:123,geometryHash:'frozen-geometry-a',requestedCounts:{holes:11,solids:5},accepted:true,reasons:[],gates:{geometry:{accepted:true,reasons:[],metrics:{maxEmptyUpperPx:159,wideRatio:.56}}},
    initialPlacement:{status:'selected',field:[{x:100,y:100}],objectIds:['H0'],anchors:[],responsibilities:[],domains:[],matrix:[],states:[],localCandidates:[],selectedState:0,
      timings:{domainMs:11,matrixMs:2,matchingMs:4,localMs:8,globalMs:3},counts:{supportChecks:500,matrixDistanceChecks:12,matchingStates:1,updateStates:1,legalStates:1,localScores:12,globalScores:1}}}],
  deploymentRejections:[{candidate:0,stage:'routes',reason:'fixture prior failure',diagnostics:{deployment:{patrolWindows:[{id:'node-1',startMs:0,durationMs:2400}]}}}],
}];
function check(id,run){try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify(cases.at(-1)));}
const identity=(attempts,geometry='measured-geometry-a')=>({recipe:{requestedSeed:20261012},geometry,content:{enemyCount:4},nativeSpatial:{selectedCandidate:1,attempts:nativeSpatialReplayAttempts(attempts)}});
check('different-runtime-performance-has-identical-complete-projected-data-and-signature',()=>{
  const first=fixture(),second=structuredClone(first);
  second[0].geometryWork[0].elapsedMs=9999.75;
  for(const key of Object.keys(second[0].candidates[0].initialPlacement.timings))second[0].candidates[0].initialPlacement.timings[key]+=12345;
  second[0].candidates[0].initialPlacement.counts.supportChecks+=321;
  const a=identity(first),b=identity(second);
  assert.deepEqual(a,b);assert.equal(exactHash(a),exactHash(b));assert.equal(checkpointChecksum(a),checkpointChecksum(b));
  const syntheticMap=payload=>({sample:{seed:20261012},layout:{spawnPoint:{x:100,y:100},extractionPoint:{position:{x:900,y:700}}},
    native:{algorithmRevision:12,diagnostics:{nativeSpatial:payload.nativeSpatial}},metadata:{signature:checkpointChecksum(payload)}});
  assert.deepEqual(syntheticMap(a),syntheticMap(b));assert.equal(exactHash(syntheticMap(a)),exactHash(syntheticMap(b)));
  assert(!Object.hasOwn(a.nativeSpatial.attempts[0].geometryWork[0],'elapsedMs'));
  assert(!Object.hasOwn(a.nativeSpatial.attempts[0].candidates[0].initialPlacement,'timings'));
  assert(!Object.hasOwn(a.nativeSpatial.attempts[0].candidates[0].initialPlacement,'counts'));
  return{scope:'The exact production projection/checksum on pure trace data and a synthetic map envelope, not a generated map.',projectedDataHash:exactHash(a),syntheticMapHash:exactHash(syntheticMap(a)),signature:checkpointChecksum(a)};
});
check('changed-real-geometry-and-gates-remain-part-of-identity',()=>{
  const original=fixture(),changed=structuredClone(original);changed[0].candidates[0].geometryHash='frozen-geometry-b';
  assert.notEqual(exactHash(identity(original)),exactHash(identity(changed)));
  assert.notEqual(checkpointChecksum(identity(original)),checkpointChecksum(identity(changed)));
  assert.notEqual(checkpointChecksum(identity(original)),checkpointChecksum(identity(original,'measured-geometry-b')));
  const gateChanged=structuredClone(original);gateChanged[0].candidates[0].gates.geometry.metrics.maxEmptyUpperPx=150;
  assert.notEqual(exactHash(nativeSpatialReplayAttempts(original)),exactHash(nativeSpatialReplayAttempts(gateChanged)));
  assert.notEqual(checkpointChecksum(identity(original)),checkpointChecksum(identity(gateChanged)));
  return{geometryFingerprintRetained:true,realGateMetricsRetained:true};
});
check('live-failure-ledger-and-gameplay-duration-remain-untouched',()=>{
  const original=fixture(),frozen=structuredClone(original),projected=nativeSpatialReplayAttempts(original);
  assert.deepEqual(original,frozen);assert.equal(original[0].geometryWork[0].elapsedMs,12.25);
  assert.equal(original[0].candidates[0].initialPlacement.timings.domainMs,11);
  assert.equal(projected[0].deploymentRejections[0].diagnostics.deployment.patrolWindows[0].durationMs,2400);
  assert.equal(projected[0].geometryEvaluations,3);assert.equal(projected[0].fullCandidates,1);assert.equal(projected[0].geometryWork[0].ordinal,3);
  projected[0].geometryWork[0].reasons.push('mutated detached snapshot');projected[0].candidates[0].initialPlacement.field[0].x=999;
  assert.deepEqual(original,frozen);
  return{failureTimingRetained:true,detached:true,gameplayDurationMs:2400,workAndFullCountersRetained:true};
});
check('production-uses-projection-before-serialization-and-checksum',()=>{
  const source=fs.readFileSync(files[0],'utf8'),project=source.indexOf('attempts:nativeSpatialReplayAttempts(attempts)'),serialize=source.indexOf('const native=serializeR100MasterWorld(',project),checksum=source.indexOf('signature:checkpointChecksum(',serialize);
  assert(project>=0&&serialize>project&&checksum>serialize);
  assert(source.slice(checksum,checksum+180).includes('nativeSpatial:diagnostics.nativeSpatial'));
  assert(source.includes("diagnostics:{algorithm:'native-joint-layout-v1',attempts,rejected}"),'Failed request retains original live attempt diagnostics');
  return{staticWiring:true,fullMapHashComparatorUnchanged:true};
});
const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(row=>row.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),scope:'Pure trace projection and exact hash/signature regression; zero geometry, content deployment, map or replay requests.',sourceHashes:before,sourceHashesAfter:after,sourcesStable,cases};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
