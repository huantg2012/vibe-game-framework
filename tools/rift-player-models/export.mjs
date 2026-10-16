/** Bake the review candidates with the production Haven rasterizer, never UI art.
 * node --import tsx tools/rift-player-models/export.mjs [--idle-only]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { Model } from '../../docs/art/demos/purification-last-light/model.ts';
import { CAMERA, project, render } from '../../docs/art/demos/purification-last-light/render.ts';
import { ACTOR_HEIGHT, actorLampAnchor } from '../../docs/art/demos/purification-last-light/actor.ts';
import { renderDensePlayerFrame } from '../../src/entities/player-sprite-dense.ts';
import { LAST_LIGHT_STRIDE_METRES } from '../../src/art/last-light-gait.ts';
import { buildCandidateActor } from './model.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'docs/art/previews/rift-player-models/assets');
const idleOnly=process.argv.includes('--idle-only');
const width=64,height=80,foot=[32,66],columns=13,rows=8;
const camera={...CAMERA,width,height,origin:foot,target:[0,0,0]};
const frontYaw=Math.atan2(CAMERA.direction[0],CAMERA.direction[2]);
const views=[{id:'front',yawIndex:0,yaw:frontYaw},{id:'lamp-side',yawIndex:6,yaw:frontYaw+Math.PI*1.5},{id:'back',yawIndex:4,yaw:frontYaw+Math.PI}];
const reviewLighting={position:[1.5,3,2.5],color:[.96,.97,1],power:6,radius:8,description:'Shared neutral inspection key; review pass only. No production source or material change.'};
const channels=['review','rgba','albedo','normal','material','depth','contact'];
const round=n=>Math.round(n*1e6)/1e6;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=['tools/rift-player-models/model.ts','tools/rift-player-models/export.mjs',...['actor.ts','model.ts','render.ts','energy.ts'].map(p=>'docs/art/demos/purification-last-light/'+p),'src/art/last-light-gait.ts'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await fs.readFile(path.join(root,p)))])));
await fs.mkdir(output,{recursive:true});
const imageHashes={};
async function save(relative,data,w=width,h=height){
  const filename=path.join(output,relative);await fs.mkdir(path.dirname(filename),{recursive:true});
  const bytes=await sharp(Buffer.from(data),{raw:{width:w,height:h,channels:4}}).png().toBuffer();
  await fs.writeFile(filename,bytes);imageHashes[relative]=hash(bytes);
}
function bake(id,yaw,phase,pose){
  const model=new Model();buildCandidateActor(model,id,[0,0,0],yaw,0,pose==='walk'?phase:undefined);
  // Exact production fallback light convention. Runtime should relight G-buffers.
  for(const light of model.lights){light.power=1;light.radius=2.6;}
  const frame=render(model,camera,undefined,{transparentBackground:true,skipEnergy:true});
  model.light(reviewLighting.position,reviewLighting.color,reviewLighting.power,reviewLighting.radius,{kind:'shoulder',id:'review-neutral-key'});
  const review=render(model,camera,undefined,{transparentBackground:true,skipEnergy:true}).rgba;
  for(let i=0;i<width*height;i++)if(!frame.normal[i*4+3])review.fill(0,i*4,i*4+4);
  const depth=new Uint8ClampedArray(width*height*4),contact=new Uint8ClampedArray(width*height*4);
  const bounds=[width,height,-1,-1];let pixels=0;
  for(let i=0;i<width*height;i++){
    if(!frame.normal[i*4+3]){frame.rgba.fill(0,i*4,i*4+4);continue;}
    const x=i%width,y=Math.floor(i/width);pixels++;
    bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);
    const d=Math.max(1,Math.min(65535,Math.round((frame.opaqueDepth[i]+80)*256)));
    depth.set([d>>8,d&255,4,255],i*4);
  }
  for(const t of model.triangles)for(const p of [t.a,t.b,t.c])if(p[1]<.25){
    const q=project([p[0],0,p[2]],camera),strength=Math.max(0,1-p[1]/.25)*.24;
    for(let dy=-2;dy<=2;dy++)for(let dx=-3;dx<=3;dx++){
      const x=Math.round(q[0])+dx,y=Math.round(q[1])+dy;if(x<0||y<0||x>=width||y>=height)continue;
      const i=(y*width+x)*4;contact[i+3]=Math.max(contact[i+3],255*strength*Math.exp(-(dx*dx/5+dy*dy/2)));
    }
  }
  const lampWorld=actorLampAnchor([0,0,0],yaw,0,pose==='walk'?phase:undefined);
  return {images:{review,rgba:frame.rgba,albedo:frame.albedo,normal:frame.normal,material:frame.roughSpec,depth,contact},bounds,pixels,lampWorld,lamp:project(lampWorld,camera).slice(0,2).map(round),triangles:model.triangles.length};
}
await save('old-rift.png',renderDensePlayerFrame('down','idle',0),32,32);
const variants=[];
for(const [id,label] of [['a','短摆工装'],['b','长襟行者'],['c','覆肩负重'],['haven','净化点母型']]){
  const atlas=Object.fromEntries(channels.map(key=>[key,`${id}/${key}.png`]));
  const buffers=Object.fromEntries(channels.map(key=>[key,new Uint8ClampedArray(width*columns*height*rows*4)]));
  const frames=[],threeViews={};
  for(let yawIndex=0;yawIndex<rows;yawIndex++)for(let column=0;column<(idleOnly?1:columns);column++){
    const pose=column===0?'idle':'walk',phase=column===0?0:(column-1)/12*Math.PI*2,yaw=frontYaw+yawIndex/rows*Math.PI*2;
    const baked=bake(id,yaw,phase,pose),rect=[column*width,yawIndex*height,width,height];
    for(const key of channels)for(let y=0;y<height;y++)buffers[key].set(baked.images[key].subarray(y*width*4,(y+1)*width*4),((rect[1]+y)*width*columns+rect[0])*4);
    frames.push({key:`${yawIndex}-${pose}-${column===0?0:column-1}`,yawIndex,yaw:round(yaw),pose,phase:round(phase),rect,foot,lamp:baked.lamp,lampWorld:baked.lampWorld.map(round),bounds:baked.bounds,pixels:baked.pixels,triangles:baked.triangles});
    const view=column===0?views.find(v=>v.yawIndex===yawIndex):undefined;
    if(view){
      threeViews[view.id]={};
      for(const key of channels){const p=`${id}/${view.id}${key==='rgba'?'':'-'+key}.png`;await save(p,baked.images[key]);threeViews[view.id][key]=p;}
    }
  }
  for(const key of channels)await save(atlas[key],buffers[key],width*columns,height*rows);
  variants.push({id,label,atlas,rows,columns,frames,threeViews});
  console.log(`${id}: ${frames.length} frames, ${views.length} same-source views`);
}
const manifest={version:1,status:idleOnly?'idle-review':'candidate-assets',delivery:'dev-candidate-not-production',frame:{width,height,foot,scale:CAMERA.scale,cameraDirection:CAMERA.direction,worldHeight:ACTOR_HEIGHT},views,variants,reviewLighting,gait:{cycleFrames:12,strideMetres:LAST_LIGHT_STRIDE_METRES,progress:'Distance-driven 12-frame walk inherited from last-light-gait. Review idle is phase zero; full production settle/action/idle states are not claimed.'},materialEncoding:{rgba:'Production fallback self-light only; no outside-alpha bloom.',normal:'RGB world-space normal encoded from [-1,1] to [0,255]; A opaque coverage.',material:'R roughness, G specular, B AO, A emission/2 (not coverage).',depth:'RG uint16 big-endian, decode value/256-80. B=4, A opaque coverage. Depth is relative to actor origin.',contact:'Black RGB / soft local contact alpha; directional shadows require pose geometry.'},mount:{origin:[foot[0]/width,foot[1]/height],rotation:0,collision:'Retain existing gameplay collider; never infer from image bounds.',presentation:'Use externalPresentation anchor. Legacy 32px weaponRig is not compatible and is not included.',productionCoverage:'Idle phase zero and twelve walk samples × eight world yaws only; no attack/hurt/death/settle integration.'},sourceHashes,imageHashes};
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(path.relative(root,path.join(output,'manifest.json')));
