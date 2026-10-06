import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildNativeVolume as now } from '/Users/yilungao/coh/src/generation/world-study/native-volume-geometry.ts';
import { buildNativeVolume as before } from '/private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-NW8fCZ/src/generation/world-study/native-volume-geometry.ts';
import { compileNativeVolumeRaster } from '/Users/yilungao/coh/src/generation/world-study/native-volume-raster.ts';
import { R100_NATIVE_WORLDS } from '/Users/yilungao/coh/src/generated/r100-native-worlds.ts';
const results=[];
for(const d of R100_NATIVE_WORLDS.find(w=>w.id==='clamped-shore')!.definitions){
 for(const it of d.instances){
  if(it.shapeProfile!=='clamp-bank')continue;
  const {role,...s}=it;
  const spec={...s,family:s.family??d.family,seed:20261005^Math.imul(s.id,104729),blocking:role==='solid'?1:0};
  const a=before(spec), b=now(spec);
  const minX=Math.floor(Math.min(a.bounds.minX,b.bounds.minX))-1,minY=Math.floor(Math.min(a.bounds.minY,b.bounds.minY))-1;
  const config={x:minX,y:minY,width:Math.ceil(Math.max(a.bounds.maxX,b.bounds.maxX))-minX+1,height:Math.ceil(Math.max(a.bounds.maxY,b.bounds.maxY))-minY+1,opticalHeight:24};
  const ar=compileNativeVolumeRaster([a],config),br=compileNativeVolumeRaster([b],config);
  let mismatch=0,oldFoot=0,newFoot=0,cut=0,fracture=0;
  for(let i=0;i<ar.matter.length;i++){
   mismatch+=ar.matter[i]!==br.matter[i]?1:0;oldFoot+=ar.matter[i]!;newFoot+=br.matter[i]!;
   cut+=br.matter[i]&&br.material[i]===1?1:0;fracture+=br.matter[i]&&br.material[i]===3?1:0;
  }
  assert.equal(mismatch,0,`${d.grade}/${s.id}: outside footprint`);
  assert(cut>100,'Visible actual cut');
  if(role==='solid')assert(fracture>0&&b.joints.length>0,'Fracture remains material and light');
  assert([...b.positions,...b.normals,...b.uv].every(Number.isFinite));
  results.push({grade:d.grade,id:s.id,role,oldFoot,newFoot,mismatch,oldTriangles:a.triangleCount,newTriangles:b.triangleCount,cutPixels:cut,fracturePixels:fracture});
 }
}
const out='/Users/yilungao/coh/docs/qa/artifacts/r100-i10-i12/b01-curved-materials/clamp-foot.json';
fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});
fs.writeFileSync(out,JSON.stringify({status:'pass',scope:'v4 clamp only, nine B01 instance/grade footprints exact against 3102; no visual qualification',sourceSha256:createHash('sha256').update(fs.readFileSync('/Users/yilungao/coh/src/generation/world-study/native-volume-ground.ts')).digest('hex'),cases:results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(results));
