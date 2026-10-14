/** G3 counts body centres, while G1 keeps its conservative continuous-cell bound. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NATIVE_SPATIAL_POLICY as policy} from '../../src/generated/r100-native-spatial.ts';
import {buildNativeSpatialGeometry,nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';

const output=process.argv[2];assert(output,'Usage: check-wide-centers.mjs NEW_REPORT.json');assert(!fs.existsSync(output),'Preserve earlier evidence');
const source='src/generation/world-study/native-spatial-measure.ts',sourceHash=createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const recipe=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-generation-2026-10-14/recovery/split-rib-causeway-medium-20261012.recipe.json','utf8'));
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const base={...recipe.nativeDefinition,id:'wide-center-contract',cols:32,rows:24,instances:[],terrainOutline:rect(32,32,960,704),spawn_x:100,spawn_y:100,exit_x:920,exit_y:680,search_x:200,search_y:200,enemy_x:800,enemy_y:600};delete base.fragmentShapeVersion;
const cases=[];
for(const withHole of [false,true]){
  const geometry=buildNativeSpatialGeometry({...base,erosion:withHole?[rect(400,280,128,160)]:[]},20261014);
  const groups=identifyNativeSpatialStructures(geometry,[],policy);
  const gate=evaluateNativeSpatialGeometry(geometry,groups,policy,{targetWalkAreaPx2:geometry.supportedCount*64});
  let expectedWide=0,excludedByWrongCellError=0,expectedEmptyUpper=0;
  for(let cell=0;cell<geometry.supported.length;cell++)if(geometry.supported[cell]){
    const {x,y}=nativeCellPoint(cell,geometry.terrain.cols);
    // Independent analytic rectangle distances, not production BVH queries.
    const shore=Math.min(x-32,992-x,y-32,736-y);
    const hole=withHole?Math.hypot(Math.max(400-x,0,x-528),Math.max(280-y,0,y-440)):Infinity;
    const distance=Math.min(shore,hole);
    if(distance>=48){expectedWide++;if(distance<48+Math.SQRT2*4)excludedByWrongCellError++;}
    if(withHole)expectedEmptyUpper=Math.max(expectedEmptyUpper,hole+Math.SQRT2*4);
  }
  const expectedRatio=expectedWide/geometry.supportedCount;
  const row={id:withHole?'internal-void-and-coast-center-clearance':'open-rectangle-center-clearance',supported:geometry.supportedCount,expectedWide,excludedByWrongCellError,expectedRatio,actualRatio:gate.metrics.wideRatio};
  try{
    if(!withHole)assert.equal(geometry.supportedCount,118*86,'Analytic 20px body domain');
    assert(excludedByWrongCellError>0,'Fixture must exercise the 48–53.656px centre band');
    assert.equal(gate.metrics.wideRatio,expectedRatio,'G3 must count centres at ≥48px, without G1 cell-radius error');
    if(withHole){assert(Math.abs(gate.metrics.maxEmptyUpperPx-expectedEmptyUpper)<1e-7,'G1 continuous-cell conservative error remains');row.g1ExpectedUpperPx=expectedEmptyUpper;row.g1ActualUpperPx=gate.metrics.maxEmptyUpperPx;}
    row.passed=true;
  }catch(error){row.passed=false;row.error=String(error.message);}
  cases.push(row);console.log(JSON.stringify(row));
}
const report={status:cases.every(row=>row.passed)?'passed':'failed',createdAt:new Date().toISOString(),sourceHash,cases,scope:'Two analytic real-geometry fixtures; no full-map or gameplay acceptance.'};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
