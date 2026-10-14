/** Max-only production regression over immutable §14 geometry snapshots. No compilation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {nativeCellPoint,nativePrimitiveTree,nativePrimitiveDistance,nativeVoidPrimitives} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Usage: check-open-radius-production.mjs NEW_DIRECTORY');
const source='docs/qa/artifacts/native-spatial-2026-10-14/open-radius-calibration-round1';
const prior=JSON.parse(fs.readFileSync(`${source}/report.json`,'utf8'));
const read=file=>deserialize(gunzipSync(fs.readFileSync(file)));
const fixturePolicy=read(`${source}/c27-geometry.v8.gz`).input.policy;
const sourceFiles=['tools/native-spatial/check-open-radius-production.mjs',...['native-spatial-measure','native-spatial-geometry','native-spatial-void-identity','native-spatial-final-support','native-spatial-bay-measure'].map(name=>`src/generation/world-study/${name}.ts`),
  `${source}/report.json`,...prior.samples.flatMap(s=>[`${source}/${s.id}-geometry.v8.gz`,`${source}/${s.id}-old-measure.v8.gz`])];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=hashes(),started=performance.now();
fs.mkdirSync(output,{recursive:true});
const report={status:'running',scope:'Production G1 max-only measure over seven existing raw geometry snapshots. No buildNativeSpatialGeometry, no fresh layout, no G2/full/G4. Original fixture failures remain failures.',
  fingerprintScope:'Exact tool, measure/geometry/identity/final-support/bay modules, and immutable input snapshots. Concurrent planning-only module edits are outside this measurement scope.',sourceHashes:before,geometryCompilations:0,freshLayouts:0,fullCandidates:0,samples:[],checks:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const normalize=value=>JSON.parse(JSON.stringify(value));
const omitMax=metrics=>Object.fromEntries(Object.entries(metrics).filter(([key])=>!['maxEmptyUpperPx','worstEmptyPoint','internalMaxEmptyUpperPx','internalWorstEmptyPoint'].includes(key)));
const nonMaxReasons=reasons=>reasons.filter(reason=>reason!=='G1-largest-empty-radius');
try{
  for(const expected of prior.samples){
    const saved=read(`${source}/${expected.id}-geometry.v8.gz`),old=read(`${source}/${expected.id}-old-measure.v8.gz`),{geometry,groups,input,proposal}=saved;
    const solidTree=nativePrimitiveTree(geometry.solidPrimitives),voidTree=nativePrimitiveTree(nativeVoidPrimitives(geometry.terrain));
    geometry.solidDistance=p=>nativePrimitiveDistance(solidTree,p.x,p.y);geometry.voidDistance=p=>nativePrimitiveDistance(voidTree,p.x,p.y);
    const policy=input?.policy??fixturePolicy,world=input?.world??{targetWalkAreaPx2:geometry.supportedCount*64};
    const holeArgs=proposal?{placements:proposal.holes,profiles:input.holeProfiles}:undefined;
    const bayArgs=proposal?{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx}:undefined;
    let diagnostic;const actual=evaluateNativeSpatialGeometry(geometry,groups,policy,world,holeArgs,bayArgs,value=>{diagnostic=value;});
    const row={id:expected.id,actual,verified:false};report.samples.push(row);save();
    assert.deepEqual(normalize(actual),expected.proposedGate,'Actual production gate differs from fixed offline projection');
    assert.deepEqual(normalize(omitMax(actual.metrics)),normalize(omitMax(old.oldGate.metrics)),'A non-max metric changed');
    assert.deepEqual(nonMaxReasons(actual.reasons),nonMaxReasons(old.oldGate.reasons),'A non-max rejection changed');
    assert.deepEqual(diagnostic,old.diagnostic,'Internal distance/deep/deepBody/component/wide diagnostic changed');
    assert.equal(actual.metrics.internalMaxEmptyUpperPx,old.oldGate.metrics.maxEmptyUpperPx);
    assert.deepEqual(actual.metrics.internalWorstEmptyPoint,old.oldGate.metrics.worstEmptyPoint);
    const internalTree=nativePrimitiveTree(groups.structures.flatMap(s=>s.boundary));let checked=0,maximum=0,worst=null;
    for(let cell=0;cell<geometry.supported.length;cell++)if(geometry.supported[cell]){
      const p=nativeCellPoint(cell,geometry.terrain.cols),open=Math.min(geometry.solidDistance(p),geometry.voidDistance(p)),internal=nativePrimitiveDistance(internalTree,p.x,p.y);
      assert(open<=internal+1e-8,'Physical open radius exceeds internal structure distance');checked++;
      if(open+old.oldGate.metrics.distanceCellUpperErrorPx>maximum){maximum=open+old.oldGate.metrics.distanceCellUpperErrorPx;worst=p;}
    }
    assert.equal(actual.metrics.maxEmptyUpperPx,maximum);assert.deepEqual(actual.metrics.worstEmptyPoint,worst);
    Object.assign(row,{verified:true,supportedCentersChecked:checked,openGreaterThanInternalViolations:0,allNonMaxMetricsAndReasonsEqual:true,allInternalDiagnosticArraysEqual:true});save();
  }
  const byId=Object.fromEntries(report.samples.map(s=>[s.id,s]));
  assert(byId['large-open-ground'].actual.reasons.includes('G1-largest-empty-radius'));
  assert(byId['original-c3'].actual.reasons.includes('G1-long-deep-empty-region'));assert.equal(byId['original-c3'].actual.metrics.maxDeepSpanPx,696);
  assert(byId['long-empty-shore-band'].actual.reasons.includes('G1-long-deep-empty-region'));
  assert(!byId['short-shore-corner'].actual.reasons.includes('G1-largest-empty-radius'));
  assert(byId['short-shore-corner'].actual.reasons.includes('ineffective-spatial-objects'));
  assert(byId['same-long-band-with-structures'].actual.reasons.includes('ineffective-spatial-objects'));
  report.checks=[{id:'actual-production-matches-fixed-offline-projection-for-all-seven-snapshots',passed:true},
    {id:'all-supported-centers-open-at-most-internal-and-exact-maximum',passed:true},
    {id:'all-nonmax-metrics-reasons-and-full-diagnostic-arrays-identical',passed:true},
    {id:'true-large-circle-and-long-deep-region-negatives-remain-rejected',passed:true},
    {id:'short-shore-physical-circle-distinguished-with-invalid-fixture-qualification-retained',passed:true}];
  report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);}
finally{report.elapsedMs=performance.now()-started;report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(before)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();}
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,elapsedMs:report.elapsedMs,samples:report.samples.map(s=>({id:s.id,verified:s.verified,max:s.actual.metrics.maxEmptyUpperPx,internalMax:s.actual.metrics.internalMaxEmptyUpperPx,deep:s.actual.metrics.maxDeepSpanPx,checked:s.supportedCentersChecked})),checks:report.checks,error:report.error},null,2));
if(report.status!=='passed')process.exitCode=1;
