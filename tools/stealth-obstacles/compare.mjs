/** Compare complete saved geometry and measurements on both current and common support domains. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readStoredMap, exactHash} from './baseline.mjs';
import {TileType} from '../../src/types/game-types.ts';

const [beforeDirectory, afterDirectory, beforeDiagnostics, afterDiagnostics, output] = process.argv.slice(2);
assert(output && !fs.existsSync(output), 'Usage: compare.mjs BEFORE_MAPS AFTER_MAPS BEFORE_DIAGNOSTICS AFTER_DIAGNOSTICS NEW_REPORT.json');
const before = JSON.parse(fs.readFileSync(path.join(beforeDirectory,'baseline.json'),'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(afterDirectory,'baseline.json'),'utf8'));
assert.equal(before.status,'passed'); assert.equal(after.status,'passed');
const cases=after.cases.filter(row=>row.grade==='medium'); assert(cases.length>0 && cases.length<=5);
function metrics(values) {
  const sorted=[...values].sort((a,b)=>a-b);
  return {samples:values.length,p50Px:sorted[Math.ceil(sorted.length*.5)-1]??null,p90Px:sorted[Math.ceil(sorted.length*.9)-1]??null,
    maxPx:sorted.at(-1)??null,ratioAbove224:values.length?values.filter(n=>n>224).length/values.length:null};
}
const reports=cases.map(row=>{
  const id=`${row.worldId}-${row.grade}-${row.seed}`;
  const oldRow=before.cases.find(r=>r.worldId===row.worldId && r.grade===row.grade && r.seed===row.seed); assert(oldRow);
  const b=readStoredMap(path.join(beforeDirectory,id,'map.v8.gz')), a=readStoredMap(path.join(afterDirectory,id,'map.v8.gz'));
  assert.equal(exactHash(b),oldRow.mapHash); assert.equal(exactHash(a),row.mapHash);
  const read=(dir,file)=>file.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(dir,id,file),'utf8')):readStoredMap(path.join(dir,id,file));
  const bd=read(beforeDiagnostics,'diagnostics.json'),ad=read(afterDiagnostics,'diagnostics.json');
  const bf=read(beforeDiagnostics,'field.v8.gz'),af=read(afterDiagnostics,'field.v8.gz');
  assert.equal(bf.cols,af.cols);assert.equal(bf.rows,af.rows);
  const beforeSolid=[],afterSolid=[],beforeVoid=[],afterVoid=[];
  for(let i=0;i<bf.reachable.length;i++)if(bf.reachable[i] && af.reachable[i]){
    beforeSolid.push(bf.solidDistance[i]);afterSolid.push(af.solidDistance[i]);beforeVoid.push(bf.voidDistance[i]);afterVoid.push(af.voidDistance[i]);
  }
  const oldIds=new Set(b.native.definition.instances.map(i=>i.id));
  const originalInstancesEqual=exactHash(b.native.definition.instances)===exactHash(a.native.definition.instances.filter(i=>oldIds.has(i.id)));
  const originalMeshesEqual=exactHash(b.native.meshes)===exactHash(a.native.meshes.filter(m=>oldIds.has(m.spec.id)));
  const terrainVoidMaskEqual=b.layout.tileMap.tiles.every((tiles,y)=>tiles.every((tile,x)=>(tile===TileType.VOID)===(a.layout.tileMap.tiles[y][x]===TileType.VOID)));
  const commonCenterVoidDistanceEqual=exactHash(beforeVoid)===exactHash(afterVoid);
  return {worldId:row.worldId,seed:row.seed,grade:row.grade,originalInstancesEqual,originalMeshesEqual,terrainVoidMaskEqual,commonCenterVoidDistanceEqual,
    originalObjectCount:oldIds.size,newObjectCount:a.native.definition.instances.length-oldIds.size,
    before:bd.metrics,after:ad.metrics,regions:ad.regions.map(region=>({id:region.id,bounds:region.bounds,before:bd.regions.find(r=>r.id===region.id)?.metrics,after:region.metrics})),
    commonReachableCenters:{solidBefore:metrics(beforeSolid),solidAfter:metrics(afterSolid),voidBefore:metrics(beforeVoid),voidAfter:metrics(afterVoid)},
    openComponents:{before:bd.openComponents,after:ad.openComponents}};
});
const status=reports.every(r=>r.originalInstancesEqual && r.originalMeshesEqual && r.terrainVoidMaskEqual && r.commonCenterVoidDistanceEqual)?'passed':'failed';
fs.writeFileSync(output,JSON.stringify({status,definitions:'Distances use true solid footprint; VOID and solid remain separate. Current-domain distributions change their sample denominator when new solids remove body support. Common-domain distributions isolate distance changes on identical reachable body centers.',cases:reports},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status,cases:reports.map(r=>({worldId:r.worldId,originalInstancesEqual:r.originalInstancesEqual,originalMeshesEqual:r.originalMeshesEqual,terrainVoidMaskEqual:r.terrainVoidMaskEqual,newObjectCount:r.newObjectCount,commonCenterVoidDistanceEqual:r.commonCenterVoidDistanceEqual}))}));
if(status==='failed')process.exitCode=1;
