/** Offline actual-pigment sample only; this never claims normal-light approval. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { mapWorldPigment, paintedToneRange } from '../../src/generation/world-study/world-material-pigment';

const base=process.env.QA_ATOM_DIR??'docs/qa/artifacts/r100-i10-i12/material-organization/source-v2';
const horizontal=process.env.QA_HORIZONTAL==='1';
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const results=[];
for(const [id,family,world,worldSize] of [['short-fibre','membrane-rim','pallid-membrane',320],['porous-marrow','granular-ridge','cinder-ridge',192]] as const){
 const old=PAINTED_MATERIALS.find(row=>row.family===family)!.solid;
 const appearance=R100_WORLD_APPEARANCES.find(row=>row.worldId===world)!;
 const sources=[{path:`public${old.source}`,size:old.world_size,regions:old.regions},{path:`${base}/${id}-solid.png`,size:horizontal?384:worldSize,regions:horizontal?{skin:{x:.025,y:.025,width:.95,height:.40},cleaved:{x:.025,y:.55,width:.95,height:.42}}:{skin:{x:.025,y:.025,width:.55,height:.95},cleaved:{x:.69,y:.025,width:.28,height:.95}}}];
 const pixels=await Promise.all(sources.map(s=>sharp(s.path).resize(512,512).ensureAlpha().raw().toBuffer()));
 const before=pixels.map(sha),ranges=pixels.map(p=>paintedToneRange({pixels:new Uint8ClampedArray(p)}));
 const width=256,height=256,out=new Uint8Array(width*height*4),mapped=new Float32Array(3),field={secondary:0,tone:0,detail:1};
 const mirror=(n:number,size:number)=>{const a=((Math.floor(n)%(size*2))+size*2)%(size*2);return a<size?a:size*2-a-1;};
 for(let material=0;material<2;material++)for(let face=0;face<2;face++)for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const source=sources[material]!,patch=face?source.regions.cleaved:source.regions.skin;
  const sx=Math.round(patch.x*512)+mirror(x*512/source.size+7,Math.round(patch.width*512));
  const sy=Math.round(patch.y*512)+mirror(y*512/source.size+11,Math.round(patch.height*512)),q=(sy*512+sx)*4,p=pixels[material]!;
  mapWorldPigment(appearance,face?'cleaved':'solid',p[q]!,p[q+1]!,p[q+2]!,ranges[material]!,field,0,mapped);
  const j=((y+face*128)*width+x+material*128)*4;out[j]=mapped[0]!;out[j+1]=mapped[1]!;out[j+2]=mapped[2]!;out[j+3]=255;
 }
 const file=`${base}/${id}-native128.png`;await sharp(out,{raw:{width,height,channels:4}}).png().toFile(file);
 results.push({organization:id,appearance:world,materialSources:sources.map((s,i)=>({...s,sha256:sha(readFileSync(s.path)),preparedRgbaSha256:before[i],pixelsUnchanged:before[i]===sha(pixels[i]!)})),file,sha256:sha(readFileSync(file)),columns:['existing atom','dedicated candidate atom'],rows:['skin','exposed cut'],logicalPanelSize:128,lighting:'unlit albedo; no camera or light comparison',scope:'Source pigment and scale review only; no geometry pores, collision or material approval.'});
}
writeFileSync(`${base}/native128-report.json`,JSON.stringify({status:'candidate-preview-not-art-pass',results},null,2)+'\n');
