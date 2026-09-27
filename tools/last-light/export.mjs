/** Production-only resource bake. Runtime must not import the authoring models. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildOption} from '../../docs/art/demos/purification-forecourt-options/option-a.ts';
import {Model} from '../../docs/art/demos/purification-last-light/model.ts';
import {CAMERA,project,render} from '../../docs/art/demos/purification-last-light/render.ts';
import {ACTOR_HEIGHT,ACTOR_OBJECT_ID,buildActor,buildSeatedActor,actorLampAnchor,seatedActorLampAnchor,actorShadowCapsules} from '../../docs/art/demos/purification-last-light/actor.ts';
import {LAST_LIGHT_STRIDE_METRES,LAST_LIGHT_WALK_FRAMES,LAST_LIGHT_SETTLE_STAGES,LAST_LIGHT_STANCE_FRACTION} from '../../src/art/last-light-gait.ts';
import {REST_OBJECT_ID,REST_POSITION,REST_YAW,REST_SEAT_HEIGHT,REST_APPROACH} from '../../docs/art/demos/purification-last-light/rest.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'public/assets/last-light');
await fs.mkdir(output,{recursive:true});
const actorsOnly=process.argv.includes('--actors-only'),sceneOnly=process.argv.includes('--scene-only');
const W=CAMERA.width,H=CAMERA.height,OVER=32;
const WALK_ROWS=LAST_LIGHT_WALK_FRAMES*(1+LAST_LIGHT_SETTLE_STAGES);
const FW=64,FH=80,COLS=8,ROWS=2+WALK_ROWS+1,AW=FW*COLS,AH=FH*ROWS,ANCHOR=[32,66];
const DEPTH_OFFSET=80,DEPTH_SCALE=256;
const AUTHOR_SOURCES=[
  ...['option-a.ts','rift-a.ts','shared.ts'].map(f=>`docs/art/demos/purification-forecourt-options/${f}`),
  ...['model.ts','render.ts','energy.ts','environment.ts','devices.ts','actor.ts','rest.ts','scene.ts'].map(f=>`docs/art/demos/purification-last-light/${f}`),
  'tools/last-light/export.mjs',
  'src/art/last-light-gait.ts',
];
const ACTOR_SOURCES=['actor.ts','model.ts','render.ts'].map(f=>`docs/art/demos/purification-last-light/${f}`).concat(['src/art/last-light-gait.ts','tools/last-light/export.mjs']);
const save=(name,data,width=W,height=H)=>sharp(Buffer.from(data),{raw:{width,height,channels:4}}).png().toFile(path.join(output,name));
const round=n=>Math.round(n*1e5)/1e5;
const author=buildOption();
const world=new Model();
world.triangles.push(...author.model.triangles.filter(t=>t.object!==ACTOR_OBJECT_ID));
world.lights.push(...author.model.lights.filter(l=>l.kind!=='shoulder'));
world.volumes.push(...author.model.volumes);
const layerNumber={far:1,middle:2,near:3,haven:4};

function encodeDepth(frame,depth=frame.opaqueDepth){
  const out=new Uint8ClampedArray(depth.length*4);
  for(let i=0;i<depth.length;i++){
    if(!Number.isFinite(depth[i]))continue;
    const d=Math.max(1,Math.min(65535,Math.round((depth[i]+DEPTH_OFFSET)*DEPTH_SCALE)));
    out.set([d>>8,d&255,frame.layers[i],255],i*4);
  }
  return out;
}
function bounds(id){
  const vertices=world.triangles.filter(t=>t.object===id).flatMap(t=>[t.a,t.b,t.c]).map(p=>project(p));
  if(!vertices.length)return {x:0,y:0,width:0,height:0};
  const x=Math.max(0,Math.floor(Math.min(...vertices.map(p=>p[0])))-3),y=Math.max(0,Math.floor(Math.min(...vertices.map(p=>p[1])))-3);
  const right=Math.min(W,Math.ceil(Math.max(...vertices.map(p=>p[0])))+3),bottom=Math.min(H,Math.ceil(Math.max(...vertices.map(p=>p[1])))+3);
  return {x,y,width:right-x,height:bottom-y};
}
const frames=[];
for(let row=0;row<ROWS;row++)for(let direction=0;direction<8;direction++){
  const yaw=direction*Math.PI/4;
  const pose=row<2?'idle':row<2+WALK_ROWS?'walk':'sit',frame=row<2?row:row<2+WALK_ROWS?row-2:0;
  const stepFrame=frame<LAST_LIGHT_WALK_FRAMES?frame:Math.floor((frame-LAST_LIGHT_WALK_FRAMES)/LAST_LIGHT_SETTLE_STAGES);
  const settle=pose==='walk'&&frame>=LAST_LIGHT_WALK_FRAMES?((frame-LAST_LIGHT_WALK_FRAMES)%LAST_LIGHT_SETTLE_STAGES+1)/LAST_LIGHT_SETTLE_STAGES:0;
  const phase=pose==='walk'?stepFrame/LAST_LIGHT_WALK_FRAMES*Math.PI*2:pose==='idle'?Math.PI/2+frame*Math.PI:0;
  const lamp=pose==='sit'?seatedActorLampAnchor([0,0,0],yaw,REST_SEAT_HEIGHT)
    :actorLampAnchor([0,0,0],yaw,pose==='idle'?phase:0,pose==='walk'?phase:undefined,settle);
  frames.push({pose,direction,frame,yaw,phase,settle,rect:{x:direction*FW,y:row*FH,width:FW,height:FH},anchor:ANCHOR,lamp,
    shadowCapsules:actorShadowCapsules(pose,yaw,phase,settle,REST_SEAT_HEIGHT)});
}
const actor={id:7,width:AW,height:AH,frameWidth:FW,frameHeight:FH,anchor:ANCHOR,worldHeight:ACTOR_HEIGHT,seatHeight:REST_SEAT_HEIGHT,
  textures:{color:'actor-color.png',albedo:'actor-albedo.png',normal:'actor-normal.png',roughSpec:'actor-rough-spec.png',depth:'actor-depth.png',contact:'actor-contact.png'},
  frames,fps:{idle:2,sit:1},gait:{strideMetres:LAST_LIGHT_STRIDE_METRES,cycleFrames:LAST_LIGHT_WALK_FRAMES,settleStages:LAST_LIGHT_SETTLE_STAGES,stanceFraction:LAST_LIGHT_STANCE_FRACTION,
    progress:'Walk frames 0..11 advance by actual XZ displacement / strideMetres, never by elapsed time. Frames 12..35 lower the suspended foot at each cycle pose in two stages; planted-foot XZ remains fixed.'},
  depth:'Same RG encoding as scene, but camera depth relative to the actor world origin. Add dot(actorWorld-camera.target,cameraBack).',
  shadowEncoding:'Per-frame shadowCapsules contain [ax,ay,az,bx,by,bz,radius]. Endpoints are yaw-rotated world-axis offsets from actor origin; add world position without another rotation.',
  contact:'Local floor-contact alpha only; not a replacement for directional shadows. Relative-depth atlas can reconstruct the full pose caster.',
};
let manifest={version:1,status:'exporting',canvas:{width:W,height:H},camera:CAMERA,
  textures:{base:'base-before-energy.png',haven:'haven.png',background:'background.png',albedo:'albedo.png',normal:'normal.png',roughSpec:'rough-spec.png',depth:'depth.png',volumeDepth:'energy-depth.png',motion:'motion.png',objects:'objects.png',coreEnergy:'core-energy.png',pollution:'light-pollution.png',coreLight:'light-core.png',storageLight:'light-storage.png',purifierLight:'light-purifier.png',furnace:'light-furnace.png',exteriorDepth:'exterior-depth.png'},
  exteriorLayers:[['far',.06],['middle',.18],['near',.38]].map(([id,parallax],i)=>({id,color:`exterior-${id}.png`,parallax,width:W+2*OVER,height:H+2*OVER,offset:[-OVER,-OVER],depthRect:{x:0,y:i*(H+2*OVER),width:W+2*OVER,height:H+2*OVER}})),
  exteriorDepthSize:{width:W+2*OVER,height:(H+2*OVER)*4},
  havenDepthRect:{x:OVER,y:3*(H+2*OVER)+OVER,width:W,height:H},
  depthEncoding:{offset:DEPTH_OFFSET,scale:DEPTH_SCALE,empty:0,channels:'RG uint16 big-endian; B layer 1 far / 2 middle / 3 near / 4 haven; A opaque coverage. Larger decoded depth is nearer.'},
  surfaceEncoding:{normal:'RGB = (world normal * .5 + .5) * 255; A opaque coverage',albedo:'RGB = sampled material color before illumination; A opaque coverage',roughSpec:'R roughness, G specular, B AO, A clamp(emission / 2), all byte-normalized'},
  layerEncoding:'Premultiplied geometry RGB plus additive air; composite layer.rgb + behind*(1-layer.a). Preserve RGB at alpha=0, decode without alpha premultiplication or color conversion.',
  energy:{frames:8,columns:4,rows:2,frameWidth:W,frameHeight:H,period:4.8,composite:'base*(1-a)+rgb; RGB includes zero-alpha halo. Core source is a subset of pollution; never double-add. Existing base contains fixed sources at factor=1.'},
  actor,lights:world.lights.map(l=>({...l,screen:project(l.position)})),
  shoulder:{color:[1,.83,.55],power:3.2,radius:6.2},
  stations:author.stations.map(s=>({...s,screen:project(s.position),approachScreen:project(s.approach),bounds:bounds(s.id)})),
  rest:{id:REST_OBJECT_ID,position:REST_POSITION,yaw:REST_YAW,seatHeight:REST_SEAT_HEIGHT,approach:REST_APPROACH,screen:project(REST_POSITION),bounds:bounds(REST_OBJECT_ID)},
  occluders:{url:'occluders.json',encoding:'triangles is flat XYZ vertices: nine float values per triangle. Exact authored static opaque triangles; actor geometry excluded.'},
  source:{entry:'docs/art/demos/purification-forecourt-options/option-a.ts',triangles:world.triangles.length,riftOpeningScale:.52},
};
manifest.source.hashes={};
for(const filename of AUTHOR_SOURCES)manifest.source.hashes[filename]=createHash('sha256').update(await fs.readFile(path.join(root,filename))).digest('hex');
actor.sourceHashes={};
for(const filename of ACTOR_SOURCES)actor.sourceHashes[filename]=createHash('sha256').update(await fs.readFile(path.join(root,filename))).digest('hex');
if(actorsOnly)manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));

if(!actorsOnly){
  console.log(`Baking A world: ${world.triangles.length} static triangles, ${world.lights.length} source lights; no actor or shoulder lamp.`);
  const scene=render(world,CAMERA,message=>console.log(`[scene] ${message}`));
  await save('base-before-energy.png',scene.energyBase);
  await save('reference.png',scene.rgba);
  for(const [name,data] of [['albedo.png',scene.albedo],['normal.png',scene.normal],['rough-spec.png',scene.roughSpec],['motion.png',scene.motion],['light-pollution.png',scene.lightFields.pollution],['light-core.png',scene.coreLight],['light-storage.png',scene.storageLight],['light-purifier.png',scene.purifierLight],['light-furnace.png',scene.lightFields.furnace]])await save(name,data);
  await save('depth.png',encodeDepth(scene));
  const energyDepth=new Float32Array(scene.depth.length).fill(-Infinity);
  for(let i=0;i<energyDepth.length;i++)if(scene.depth[i]>scene.opaqueDepth[i]+.01)energyDepth[i]=scene.depth[i];
  await save('energy-depth.png',encodeDepth(scene,energyDepth));
  const objects=new Uint8ClampedArray(W*H*4);
  for(let i=0;i<scene.objects.length;i++)objects.set([scene.objects[i],0,0,255],i*4);
  await save('objects.png',objects);
  manifest.statistics={objects:[...new Set(scene.objects)].sort((a,b)=>a-b),actorPixels:[...scene.objects].filter(v=>v===7).length,shoulderLights:world.lights.filter(l=>l.kind==='shoulder').length,triangles:world.triangles.length,lights:world.lights.length,actorFrames:frames.length};
  const energy=new Uint8ClampedArray(W*4*H*2*4);
  for(let f=0;f<8;f++)for(let y=0;y<H;y++){
    const from=y*W*4,to=((Math.floor(f/4)*H+y)*W*4+(f%4)*W)*4;
    energy.set(scene.energyFrames[f].subarray(from,from+W*4),to);
  }
  await save('core-energy.png',energy,W*4,H*2);
  const empty=render(new Model(),CAMERA,undefined,{skipEnergy:true});
  await save('background.png',empty.rgba);
  const exteriorDepth=new Uint8ClampedArray((W+2*OVER)*(H+2*OVER)*4*4);
  for(const layer of ['haven','far','middle','near']){
    const plate=new Model();plate.triangles.push(...world.triangles.filter(t=>t.layer===layer));plate.lights.push(...world.lights);
    if(layer==='haven')plate.volumes.push(...world.volumes);
    const camera=layer==='haven'?CAMERA:{...CAMERA,width:W+2*OVER,height:H+2*OVER,origin:[CAMERA.origin[0]+OVER,CAMERA.origin[1]+OVER]};
    console.log(`Rendering complete ${layer} plate, with all-world shadow casters.`);
    const result=render(plate,camera,undefined,{shadowModel:world,transparentBackground:true,skipEnergy:true,sampleOffset:layer==='haven'?[0,0]:[OVER,OVER]});
    await save(layer==='haven'?'haven.png':`exterior-${layer}.png`,result.energyBase,camera.width,camera.height);
    if(layer!=='haven')exteriorDepth.set(encodeDepth(result),(layerNumber[layer]-1)*(W+2*OVER)*(H+2*OVER)*4);
    else{
      const encoded=encodeDepth(result);
      for(let y=0;y<H;y++)exteriorDepth.set(encoded.subarray(y*W*4,(y+1)*W*4),((3*(H+2*OVER)+y+OVER)*(W+2*OVER)+OVER)*4);
    }
  }
  await save('exterior-depth.png',exteriorDepth,W+2*OVER,(H+2*OVER)*4);
  const occluders=world.triangles.filter(t=>t.material!=='glass'&&t.material!=='liquid'&&t.material!=='energy');
  await fs.writeFile(path.join(output,'occluders.json'),JSON.stringify({version:1,count:occluders.length,triangles:occluders.flatMap(t=>[...t.a,...t.b,...t.c].map(round))})+'\n');
  manifest.status='scene-ready';
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Scene pack + schema ready; generating actor atlas next.');
}

if(!sceneOnly){
  const buffers=Object.fromEntries(['color','albedo','normal','roughSpec','depth','contact'].map(k=>[k,new Uint8ClampedArray(AW*AH*4)]));
  const camera={...CAMERA,width:FW,height:FH,origin:ANCHOR,target:[0,0,0]};
  const paste=(target,source,rect)=>{for(let y=0;y<FH;y++)target.set(source.subarray(y*FW*4,(y+1)*FW*4),((rect.y+y)*AW+rect.x)*4);};
  for(const entry of frames){
    const model=new Model();
    if(entry.pose==='sit')buildSeatedActor(model,[0,0,0],entry.yaw,REST_SEAT_HEIGHT);
    else buildActor(model,[0,0,0],entry.yaw,entry.pose==='idle'?entry.phase:0,entry.pose==='walk'?entry.phase:undefined,entry.settle);
    // A stable self-lamp keeps the fallback readable; runtime uses material maps
    // and the actual world source positions rather than this fixed frame lighting.
    for(const light of model.lights){light.power=1.0;light.radius=2.6;}
    const frame=render(model,camera,undefined,{transparentBackground:true,skipEnergy:true});
    const depth=encodeDepth(frame),contact=new Uint8ClampedArray(FW*FH*4);
    const caster=[];
    for(const t of model.triangles)for(const p of [t.a,t.b,t.c])if(p[1]<.25)caster.push(p);
    for(const p of caster){
      const q=project([p[0],0,p[2]],camera),strength=Math.max(0,1-p[1]/.25)*.24;
      for(let dy=-2;dy<=2;dy++)for(let dx=-3;dx<=3;dx++){
        const x=Math.round(q[0])+dx,y=Math.round(q[1])+dy;if(x<0||y<0||x>=FW||y>=FH)continue;
        const i=(y*FW+x)*4,alpha=255*strength*Math.exp(-(dx*dx/5+dy*dy/2));
        contact[i+3]=Math.max(contact[i+3],alpha);
      }
    }
    // A transparent sprite must not carry the isolated renderer's light halo;
    // its world-space lamp scattering is composed separately at runtime.
    for(let i=0;i<FW*FH;i++)if(!frame.normal[i*4+3])frame.rgba.fill(0,i*4,i*4+4);
    paste(buffers.color,frame.rgba,entry.rect);paste(buffers.albedo,frame.albedo,entry.rect);
    paste(buffers.normal,frame.normal,entry.rect);paste(buffers.roughSpec,frame.roughSpec,entry.rect);
    paste(buffers.depth,depth,entry.rect);paste(buffers.contact,contact,entry.rect);
    if(entry.direction===7)console.log(`Actor ${entry.pose} frame ${entry.frame}: eight native-scale facings complete.`);
  }
  for(const [key,data] of Object.entries(buffers))await save(actor.textures[key],data,AW,AH);
  // Merge at write time so an actor bake cannot replace newer scene metadata.
  if(actorsOnly)manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));
  manifest.actor=actor;manifest.status='complete';manifest.statistics.actorFrames=frames.length;
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
if(sceneOnly){
  try{await fs.access(path.join(output,actor.textures.depth));manifest.status='complete';await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');}catch{}
}
const checksums=actorsOnly?JSON.parse(await fs.readFile(path.join(output,'checksums.json'),'utf8')):{sources:{},outputs:{}};
if(!actorsOnly)for(const filename of AUTHOR_SOURCES)checksums.sources[filename]=createHash('sha256').update(await fs.readFile(path.join(root,filename))).digest('hex');
checksums.actorSources=actor.sourceHashes;
for(const filename of await fs.readdir(output))if(filename!=='checksums.json')checksums.outputs[filename]=createHash('sha256').update(await fs.readFile(path.join(output,filename))).digest('hex');
await fs.writeFile(path.join(output,'checksums.json'),JSON.stringify(checksums,null,2)+'\n');
console.log(`Production pack ${manifest.status}: ${output}`);
