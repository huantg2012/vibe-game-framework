/** Real-raster counterexamples: input rectangles alone cannot qualify final holes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NATIVE_SPATIAL_POLICY as policy} from '../../src/generated/r100-native-spatial.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialHoleProfiles} from '../../src/generation/world-study/native-spatial-measure.ts';
const output=process.argv[2];assert(output,'Usage: check-hole-profiles.mjs NEW_REPORT.json');assert(!fs.existsSync(output),'Preserve earlier evidence');
const recipe=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-generation-2026-10-14/recovery/split-rib-causeway-medium-20261012.recipe.json','utf8'));
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const base={...recipe.nativeDefinition,id:'hole-profile-contract',cols:32,rows:24,instances:[],terrainOutline:rect(32,32,960,704),spawn_x:100,spawn_y:100,exit_x:920,exit_y:680,search_x:200,search_y:200,enemy_x:800,enemy_y:600};delete base.fragmentShapeVersion;
const profiles=[{id:'small',maxSpanPx:144,maxAreaPx2:14000},{id:'medium',maxSpanPx:192,maxAreaPx2:22000}],placement=(holeId,profileId,rects)=>({holeId,profileId,rects}),one=placement('hole-a','small',[[408,288,128,80]]),cases=[];
const sources=['tools/native-spatial/check-hole-profiles.mjs','src/generation/world-study/native-spatial-measure.ts','src/generation/world-study/native-spatial-structures.ts'];
const hashes=()=>Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));const sourceHashes=hashes();
function test(id,erosion,placements,check){
  const geometry=buildNativeSpatialGeometry({...base,erosion},20261014),groups=identifyNativeSpatialStructures(geometry,[],policy),gate=evaluateNativeSpatialHoleProfiles(geometry,groups,placements,profiles);
  try{check(gate);cases.push({id,passed:true,gate});}catch(error){cases.push({id,passed:false,error:String(error.message),gate});}console.log(JSON.stringify({id,passed:cases.at(-1).passed,reasons:gate.reasons}));
}
test('legal-final-hole', [rect(408,288,128,80)],[one],gate=>{assert(gate.accepted);assert.equal(gate.metrics.holeProfileMeasurements[0].finalAreaPx2,128*80);});
test('final-area-beyond-cap-with-legal-input',[rect(400,280,136,104)],[one],gate=>{assert(gate.reasons.includes('hole-profile-area'));const row=gate.metrics.holeProfileMeasurements[0];assert(row.sourceAreaPx2<14000&&row.sourceSpanPx<=144&&row.finalSpanPx<=144);});
test('final-span-beyond-cap-with-legal-input',[rect(400,280,152,80)],[one],gate=>{assert(gate.reasons.includes('hole-profile-span'));assert(gate.metrics.holeProfileMeasurements[0].finalAreaPx2<14000);});
test('actual-void-area-not-only-contour-area',[rect(401,283,142,98)],[one],gate=>{const row=gate.metrics.holeProfileMeasurements[0];assert(row.contourAreaPx2<14000&&row.finalAreaPx2>14000);assert(gate.reasons.includes('hole-profile-area'));});
test('final-contour-span-not-only-raster-span',[rect(401,280,145,80)],[one],gate=>{const row=gate.metrics.holeProfileMeasurements[0];assert(row.finalSpanPx<=144&&row.contourSpanPx>144);assert(gate.reasons.includes('hole-profile-span'));});
test('unassigned-final-hole-cannot-escape-profile-caps',[rect(408,288,128,80),rect(700,480,96,96)],[one],gate=>{assert(gate.reasons.includes('hole-profile-unassigned-final-hole'));assert.equal(gate.metrics.orphanHoleLabels.length,1);});
test('body-inseparable-holes-cannot-keep-two-profile-identities',[rect(320,240,128,160),rect(464,240,128,160)],[placement('hole-a','medium',[[320,240,128,160]]),placement('hole-b','medium',[[464,240,128,160]])],gate=>{assert(gate.reasons.includes('hole-profile-merged-identity'));assert(gate.metrics.holeProfileMeasurements.every(row=>row.finalAreaPx2===128*160*2));});
const sourceHashesAfter=hashes(),sourcesStable=JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter),report={status:cases.every(row=>row.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),sourceHashes,sourceHashesAfter,sourcesStable,cases,scope:'Seven independent final-hole size/identity contracts using actual geometry; no production map admission.'};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
