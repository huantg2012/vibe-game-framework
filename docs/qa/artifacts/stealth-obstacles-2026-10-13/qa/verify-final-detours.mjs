// Independently consume the final witness coordinates with the production collision query.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readStoredMap,exactHash,sha256} from '../../../../../tools/stealth-obstacles/baseline.mjs';
import {NativeBodyCollision} from '../../../../../src/generation/world-study/native-body-collision.ts';
const base='docs/qa/artifacts/stealth-obstacles-2026-10-13/code',output=process.argv[2];
assert(output&&!fs.existsSync(output));
const baseline=JSON.parse(fs.readFileSync(`${base}/after-final/baseline.json`));
const report={status:'running',cases:[],limitations:['Consumes code-selected witness paths; independent continuous collision recheck, not an independent path search.','Only supplied 13 successful object witnesses; absent object witnesses remain unverified. No player input or enemy simulation.']};
function inside(mesh,p) {
 for(let i=0;i<mesh.indices.length;i+=3) {
  const pts=Array.from(mesh.indices.slice(i,i+3),v=>({x:mesh.positions[v*3],y:mesh.positions[v*3+1]}));
  const crosses=pts.map((a,n)=>{const b=pts[(n+1)%3];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});
  if(crosses.every(c=>c>1e-7)||crosses.every(c=>c< -1e-7))return true;
 }return false;
}
for(const row of baseline.cases) {
 const id=`${row.worldId}-${row.grade}-${row.seed}`,map=readStoredMap(`${base}/after-final/${id}/map.v8.gz`);
 assert.equal(exactHash(map),row.mapHash);
 const diagnosticFile=`${base}/witnesses-final/${id}/diagnostics.json`,d=JSON.parse(fs.readFileSync(diagnosticFile));
 const body=new NativeBodyCollision(map.native,map.layout.tileMap),results=[];
 for(const detour of d.detours) {
  assert(detour.passed);const mesh=map.native.meshes.find(m=>m.spec.id===detour.objectId);
  assert(mesh&&inside(mesh,detour.solidInteriorAnchor));
  const from=detour.sideA.requestedPoints[0],to=detour.sideA.requestedPoints.at(-1),axis={x:to.x-from.x,y:to.y-from.y};
  const cross=p=>axis.x*(p.y-from.y)-axis.y*(p.x-from.x),angles=[];let segmentCount=0;
  for(const route of [detour.sideA,detour.sideB]) {
   const sign=Math.sign(cross(route.requestedPoints[1]));let length=0,angle=0;
   assert(sign!==0&&route.passed);
   for(let i=0;i<route.path.length;i++) {
    const p=route.path[i];assert(body.supports(p,10,10));assert(cross(p)*sign>=-1e-7);
    if(i) {
     const q=route.path[i-1],dx=p.x-q.x,dy=p.y-q.y;
     assert(dx*axis.x+dy*axis.y>=-1e-7);assert(body.displacementFraction(q,10,10,dx,dy)>=1-1e-9);
     length+=Math.hypot(dx,dy);segmentCount++;
     const a=detour.solidInteriorAnchor,ax=q.x-a.x,ay=q.y-a.y,bx=p.x-a.x,by=p.y-a.y;
     angle+=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
    }
   }
   assert(Math.abs(length-route.lengthPx)<1e-6);angles.push(angle);
  }
  const winding=(angles[0]-angles[1])/(Math.PI*2);
  assert(angles[0]*angles[1]<0&&Math.abs(Math.abs(winding)-1)<1e-6);
  results.push({id:detour.id,objectId:detour.objectId,verifiedSegments:segmentCount,closedLoopWinding:winding,sideALengthPx:detour.sideA.lengthPx,sideBLengthPx:detour.sideB.lengthPx});
 }
 const oldCounts={'split-rib-causeway':2,'gel-rafts':6,'sloughed-court':3};
 const notEstablished=map.native.definition.instances.filter(i=>i.id>oldCounts[row.worldId]&&!results.some(w=>w.objectId===i.id)).map(i=>i.id);
 report.cases.push({worldId:row.worldId,diagnosticSha256:sha256(fs.readFileSync(diagnosticFile)),verifiedDetours:results,addedObjectIdsWithoutEstablishedWitness:notEstablished});
}
report.status='passed';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report.cases.map(c=>({worldId:c.worldId,verified:c.verifiedDetours.length,notEstablished:c.addedObjectIdsWithoutEstablishedWitness}))));
