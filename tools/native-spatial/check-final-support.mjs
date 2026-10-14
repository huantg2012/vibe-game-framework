/** Real-constructor regression plus analytic triangle interiors on the real support raster. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {evaluateNativeSpatialFinalSupport} from '../../src/generation/world-study/native-spatial-final-support.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {NATIVE_SPATIAL_POLICY as policy} from '../../src/generated/r100-native-spatial.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
const old=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-spatial-2026-10-14/static-final-support-counterexample.json','utf8')),cases=[];
const g=buildNativeSpatialGeometry(old.definition,old.seed),support=evaluateNativeSpatialFinalSupport(g),groups=identifyNativeSpatialStructures(g,[{assemblyId:'counterexample-source',instanceIds:[13],maxSpanPx:512}],policy),gate=evaluateNativeSpatialGeometry(g,groups,policy,{targetWalkAreaPx2:g.supportedCount*64});
assert(!support.accepted);assert(gate.reasons.includes('final-source-footprint-unsupported'));cases.push({id:'qa-real-free-edge-source-regression-rejected',passed:true,support});
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
function fixture(hole,role='solid',edge=false){
 const geometry=buildNativeSpatialGeometry({...old.definition,instances:[],erosion:hole?[hole]:[],terrainOutline:rect(32,32,960,704),spawn_x:100,spawn_y:100},old.seed);
 const positions=new Float32Array(edge?[256,256,0,512,256,0,256,512,0,0,0,-4,16,0,-4,0,16,-4]:[256,256,0,512,256,0,256,512,0]);
 const mesh={spec:{id:1},positions,indices:new Uint32Array(edge?[0,1,2,3,4,5]:[0,1,2]),triangleCount:edge?2:1,...(edge?{groundEdgeStart:{triangle:1}}:{})};
 return{...geometry,terrain:{...geometry.terrain,definition:{...geometry.terrain.definition,instances:[{id:1,role}]},roles:new Map([[1,role]]),meshes:[mesh]}};
}
for(const role of ['solid','relief']){
 const geometry=fixture(rect(344,320,32,32),role);for(const [x,y]of[[256,256],[512,256],[256,512]])assert(geometry.terrain.matterAt(x,y),'All source vertices are deliberately supported');
 const gate=evaluateNativeSpatialFinalSupport(geometry);assert(!gate.accepted);assert.equal(gate.metrics.unsupportedSources[0].role,role);cases.push({id:`${role}-triangle-interior-crosses-void-despite-supported-vertices`,passed:true,gate});
}
const outside=fixture(rect(456,456,16,16)),outsideGate=evaluateNativeSpatialFinalSupport(outside);assert(outsideGate.accepted,'A void in the bounding box but outside the triangle must not falsely reject');cases.push({id:'triangle-test-does-not-reject-empty-bounding-box-corner',passed:true});
const edgeGate=evaluateNativeSpatialFinalSupport(fixture(null,'solid',true));assert(edgeGate.accepted,'Dedicated generated ground edge is not an authored floating source');cases.push({id:'generated-ground-edge-range-excluded',passed:true});
const sourceFiles=['src/generation/world-study/native-spatial-final-support.ts','src/generation/world-study/native-spatial-measure.ts'],sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'passed',createdAt:new Date().toISOString(),sourceHashes,cases,scope:'Five final footprint contracts. One uses the actual constructor/fragment regression; the others use analytic triangles over real 8px terrain. No full-map admission.'};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:cases.map(row=>row.id)}));
