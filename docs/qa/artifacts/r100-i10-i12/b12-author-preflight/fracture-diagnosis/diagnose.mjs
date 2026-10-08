import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMasterWorld,POLLUTION_GRADE_DEFINITIONS} from '../body12/executor.mjs';
const source='../body12/report.json',report=JSON.parse(fs.readFileSync(new URL(source,import.meta.url))),results=[];
for(const id of ['double-return','pinched-fan']){
 const row=report.results.find(r=>r.id===id&&r.grade==='medium');
 const world=createMasterWorld(row.definition,report.seed,{profile:row.definition.profile,grade:POLLUTION_GRADE_DEFINITIONS.find(g=>g.id==='medium')});
 const objects=[];
 for(const objectId of id==='double-return'?[4]:[5,6]){
  const mesh=world.meshes.find(m=>m.spec.id===objectId), triangles=[],pixels=new Map();
  for(let f=0;f<mesh.triangleCount;f++)if(mesh.materials[f]===3){
   const p=[0,1,2].map(c=>Array.from(mesh.positions.slice(mesh.indices[f*3+c]*3,mesh.indices[f*3+c]*3+3)));
   const [[ax,ay],[bx,by],[cx,cy]]=p, area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-7)continue;
   triangles.push({face:f,points:p,xyArea:Math.abs(area)/2});
   for(let y=Math.ceil(Math.min(ay,by,cy)-.5);y<=Math.floor(Math.max(ay,by,cy)-.5);y++)for(let x=Math.ceil(Math.min(ax,bx,cx)-.5);x<=Math.floor(Math.max(ax,bx,cx)-.5);x++){
    const px=x+.5,py=y+.5,wa=((bx-px)*(cy-py)-(by-py)*(cx-px))/area,wb=((cx-px)*(ay-py)-(cy-py)*(ax-px))/area,wc=1-wa-wb;
    if(Math.min(wa,wb,wc)<-1e-6)continue;
    const i=y*1024+x;pixels.set(i,{x,y,jointHeight:wa*p[0][2]+wb*p[1][2]+wc*p[2][2],actualHeight:world.raster.heightField[i],actualObject:world.raster.objectId[i],actualMaterial:world.raster.material[i],matter:world.matterAt(x,y)});
   }
  }
  objects.push({id:objectId,spec:mesh.spec,joints:mesh.joints,xyFractureArea:triangles.reduce((n,t)=>n+t.xyArea,0),triangles,projectedPixelCount:pixels.size,projectedPixels:[...pixels.values()],visiblePixels:[...pixels.values()].filter(p=>p.actualObject===objectId&&p.actualMaterial===3&&p.matter).length});
 }
 results.push({id,grade:'medium',objects});
}
const output=new URL('./report.json',import.meta.url);assert(!fs.existsSync(output));
fs.writeFileSync(output,JSON.stringify({scope:'Two original actual Master maps only; projected fracture triangles checked against their real highest-Z raster. No author or runtime changes.',source:{path:new URL(source,import.meta.url).pathname,sha256:createHash('sha256').update(fs.readFileSync(new URL(source,import.meta.url))).digest('hex')},results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({id:r.id,objects:r.objects.map(o=>({id:o.id,xyFractureArea:o.xyFractureArea,projectedPixelCount:o.projectedPixelCount,visiblePixels:o.visiblePixels,occluders:[...new Set(o.projectedPixels.map(p=>p.actualObject))]}))})),null,2));
