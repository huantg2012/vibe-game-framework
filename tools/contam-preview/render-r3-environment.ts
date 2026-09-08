import sharp from 'sharp';
import { mkdir,writeFile } from 'node:fs/promises';
import { paintYiSkin } from '../../src/entities/form-renderers/d/yi-paint';
import { yiRecipeFromForm,faceNormal } from '../../src/entities/form-renderers/d/yi-recipe';
import { dingRecipeFromForm } from '../../src/entities/form-renderers/d/ding-recipe';
import { paintDingFrame } from '../../src/entities/form-renderers/d/ding-paint';
import { bakePaintGenome } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintSurfaceMaterial } from '../../src/entities/form-renderers/d/paint-genome/material';
import { paintPaintGenomeLive } from '../../src/entities/form-renderers/d/paint-genome/live';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import type { FormAttachContext,FormVisualPose } from '../../src/entities/form-renderers/form-renderer';
const out='docs/art/iteration-18-r3-environment-evidence'; await mkdir(out,{recursive:true});
const tiers=['infiltrate','rewrite','overwrite'] as const;
const families=['doorframe','wall_rust','fungal_mat','oil_film','ash_veil','sound_echo','light_scatter','space_interval'];
const phases=['rest','waking','idle','windup','strike','recover'];
const size=144;
function draw(family:string,tier:typeof tiers[number],phase:string,time:number,facing:FormVisualPose['facing4']='down',variant=3):Uint8ClampedArray {
 const occupancy=family==='doorframe'||family==='wall_rust'?'wall':family==='fungal_mat'||family==='oil_film'||family==='ash_veil'?'paint':'volume';
 const form={substrate:family,coverage:tier,continuity:occupancy==='paint'?'colony':'monolith',portfolio:occupancy==='wall'?'yi':occupancy==='paint'?'bing':'ding',occupancy,lexemes:{motion:'motion_anchor',sense:'sense_touch',rhythm:'rhythm_open',contact:'contact_step'}} as ContaminationForm;
 const p:FormVisualPose={x:72,y:72,facing4:facing,moving:false,visibility:1,signal:'idle',deltaMs:16,activity:{phase:phase==='rest'?'rest':phase==='waking'?'waking':'active',progress:phase==='waking'?.5:1},attack:{phase:phase==='windup'?'windup':phase==='strike'?'strike':phase==='recover'?'recover':'idle',progress:.7}};
 const pixels=new Uint8ClampedArray(size*size*4);
 if(occupancy==='wall') {
  let ink=0;
  const g={clear(){pixels.fill(0);},fillStyle(c:number){ink=c;return this;},fillRect(x:number,y:number,w:number,h:number){for(let j=0;j<h;j++)for(let i=0;i<w;i++){const xx=Math.round(x+i)+72,yy=Math.round(y+j)+72;if(xx<0||yy<0||xx>=size||yy>=size)throw Error('wall frame clips');const o=(yy*size+xx)*4;pixels[o]=(ink>>16)&255;pixels[o+1]=(ink>>8)&255;pixels[o+2]=ink&255;pixels[o+3]=255;}return this;}};
  const n=faceNormal(facing);paintYiSkin(g as never,yiRecipeFromForm(form,7),p,time,n.nx,n.ny);
 } else if(occupancy==='paint') {
  const b=bakePaintGenome({...form,seed:7,veinVariant:family==='oil_film'?variant as 3:undefined});
  const frame=new Uint8ClampedArray(b.canvasW*b.canvasH*4),scratch=new Float32Array(b.field.length);
  paintPaintGenomeLive({rest:b.field,scratch,out:frame,w:b.canvasW,h:b.canvasH,elapsedMs:time,inflated:phase==='strike',ramp:b.ramp,growth:b.growth});
  p.signal=phase==='strike'?'inflated':'idle';paintSurfaceMaterial(frame,scratch,b.canvasW,b.canvasH,family,tier,7,time,p);
  for(let y=0;y<b.canvasH;y++)for(let x=0;x<b.canvasW;x++){const o=((y+(size-b.canvasH)/2)*size+x+(size-b.canvasW)/2)*4;pixels.set(frame.subarray((y*b.canvasW+x)*4,(y*b.canvasW+x)*4+4),o);}
 } else paintDingFrame(pixels,size,size,dingRecipeFromForm(form,{form,seed:7} as FormAttachContext),p,time,{cx:72,cy:72,rx:60,ry:44,breath:1,morphMs:time});
 return pixels;
}
async function sheet(name:string,cols:number,rows:number,cells:{x:number;y:number;p:Uint8ClampedArray}[]){
 const pngs=await Promise.all(cells.map(async c=>({input:await sharp(Buffer.from(c.p),{raw:{width:size,height:size,channels:4}}).png().toBuffer(),left:c.x*size,top:c.y*size})));
 const png=await sharp({create:{width:size*cols,height:size*rows,channels:4,background:'#252a28'}}).composite(pngs).png().toBuffer();
 await writeFile(`${out}/${name}.png`,png);await sharp(png).resize(size*cols*2,size*rows*2,{kernel:'nearest'}).toFile(`${out}/${name}-2x.png`);
}
const report=[];
for(const f of families){
 const cells=tiers.flatMap((tier,y)=>phases.map((phase,x)=>({x,y,p:draw(f,tier,phase,500)})));
 await sheet(f,6,3,cells);
 const hashes=new Set(cells.map(c=>Buffer.from(c.p).toString('base64')));if(hashes.size<6)throw Error(`${f} insufficient structural/state variation`);
 let frames=0;for(const t of tiers)for(const phase of phases)for(let time=0;time<2400;time+=100){const p=draw(f,t,phase,time);if(!p.some((v,i)=>i%4===3&&v))throw Error('empty');frames++;}
 if(f==='doorframe'||f==='wall_rust')await sheet(`${f}-directions`,4,3,tiers.flatMap((tier,y)=>(['down','left','up','right'] as const).map((face,x)=>({x,y,p:draw(f,tier,'strike',500,face)}))));
 report.push({family:f,frames,stateTierHashes:hashes.size});
}
await sheet('oil-variants',3,3,tiers.flatMap((tier,y)=>[3,4,5].map((v,x)=>({x,y,p:draw('oil_film',tier,'idle',500,'down',v)}))));
await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
