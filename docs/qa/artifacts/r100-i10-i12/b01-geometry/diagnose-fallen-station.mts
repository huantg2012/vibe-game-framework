import { writeFileSync } from 'node:fs';
import { R100_NATIVE_WORLDS } from '../../../../../src/generated/r100-native-worlds';
import { POLLUTION_GRADE_DEFINITIONS } from '../../../../../src/generated/rift-pollution-grade-data';
import { createMasterWorld } from '../../../../../src/generation/world-study/r100-master-world';
import { NativeBodyCollision } from '../../../../../src/generation/world-study/native-body-collision';
const result=[];const wanted={x:590,y:425};
for(const grade of ['low','medium','severe']){
 const row=R100_NATIVE_WORLDS.find(w=>w.id==='fallen-spines')!,definition=row.definitions.find(d=>d.grade===grade)!;
 const world=createMasterWorld(definition,20261005,{profile:row.profile,grade:POLLUTION_GRADE_DEFINITIONS.find(g=>g.id===grade)!});
 const body=new NativeBodyCollision(world as any,world.layout.tileMap);let nearest:any=null,distance=Infinity;
 for(let y=4;y<768;y+=8)for(let x=4;x<1024;x+=8){if(!body.supports({x,y},10,10))continue;let d=Math.hypot(x-wanted.x,y-wanted.y);if(d<distance){distance=d;nearest={x,y};}}
 const touches=world.meshes.filter(mesh=>!new NativeBodyCollision({...world,meshes:[mesh]} as any,world.layout.tileMap).supports(wanted,10,10)).map(m=>m.spec.id);
 result.push({grade,requestedSeed:20261005,wanted,originalSupported:body.supports(wanted,10,10),nearest,distance,overlappingSolidIds:touches,space:'Inside the short middle bundle end, not a mapped outside-return destination.'});
}
writeFileSync('docs/qa/artifacts/r100-i10-i12/b01-geometry/fallen-station-diagnostic.json',JSON.stringify({status:'diagnostic-only',result},null,2)+'\n');console.log(JSON.stringify(result));
