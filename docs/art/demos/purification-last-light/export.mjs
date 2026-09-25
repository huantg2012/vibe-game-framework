import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { renderDensePlayerFrame } from '../../../../src/entities/player-sprite-dense.ts';
import { buildHaven } from './scene.ts';
import { CAMERA, project, render } from './render.ts';
import { Model } from './model.ts';
import { ACTOR_POSITION, ACTOR_FACING, ACTOR_HEIGHT, ACTOR_OBJECT_ID, actorLampAnchor } from './actor.ts';
import { WALK_SURFACES } from './environment.ts';
const here=path.dirname(fileURLToPath(import.meta.url));
const output=process.argv[2]?path.resolve(process.argv[2]):path.join(here,'assets');
await fs.mkdir(output,{recursive:true});
const {model,stations}=buildHaven();
console.log(`Scene: ${model.triangles.length} triangles, ${stations.length} stations, ${model.lights.length} emitters in three source families.`);
const result=render(model,CAMERA,console.log);
const format={raw:{width:CAMERA.width,height:CAMERA.height,channels:4}};
const save=(name,data)=>sharp(Buffer.from(data),format).png().toFile(path.join(output,name));
await save('haven.png',result.rgba);
await sharp(path.join(output,'haven.png')).resize(1920,1280,{kernel:'nearest'}).png().toFile(path.join(output,'haven-2x.png'));
for(const kind of ['pollution','furnace','shoulder'])await save(`light-${kind}.png`,result.lightFields[kind]);
await save('motion-map.png',result.motion);
await save('haven-energy-base.png',result.energyBase);
// Eight premultiplied radiance/density frames in a 4 × 2 atlas. Copy raw
// channels: RGB can contain halo even at zero alpha and must survive unchanged.
if(result.energyFrames.length!==8)throw new Error('Core energy renderer must supply exactly eight frames.');
const energyWidth=CAMERA.width*4,energyHeight=CAMERA.height*2,energyAtlas=new Uint8ClampedArray(energyWidth*energyHeight*4);
for(const [frameIndex,frame] of result.energyFrames.entries()){
  if(frame.length!==CAMERA.width*CAMERA.height*4)throw new Error(`Incorrect core energy frame dimensions: ${frameIndex}`);
  for(let row=0;row<CAMERA.height;row++){
    const from=row*CAMERA.width*4,to=((Math.floor(frameIndex/4)*CAMERA.height+row)*energyWidth+(frameIndex%4)*CAMERA.width)*4;
    energyAtlas.set(frame.subarray(from,from+CAMERA.width*4),to);
  }
}
await sharp(Buffer.from(energyAtlas),{raw:{width:energyWidth,height:energyHeight,channels:4}}).png().toFile(path.join(output,'core-energy-atlas.png'));
const emptyHaven=new Model();
emptyHaven.triangles.push(...model.triangles.filter(t=>t.object!==ACTOR_OBJECT_ID));
emptyHaven.lights.push(...model.lights.filter(l=>l.kind!=='shoulder'));
emptyHaven.volumes.push(...model.volumes);
await save('haven-clean.png',render(emptyHaven,CAMERA).rgba);
const depthImage=new Uint8ClampedArray(CAMERA.width*CAMERA.height*4),objectImage=depthImage.slice();
for(let i=0;i<result.depth.length;i++){
  const value=Number.isFinite(result.depth[i])?Math.max(0,Math.min(65535,Math.round((result.depth[i]+80)*256))):0;
  depthImage.set([value>>8,value&255,result.layers[i],255],i*4);
  objectImage.set([result.objects[i],0,0,255],i*4);
}
await save('depth-layers.png',depthImage);await save('object-ids.png',objectImage);
function getBounds(object){
  const vertices=model.triangles.filter(t=>t.object===object).flatMap(t=>[t.a,t.b,t.c]).map(p=>project(p));
  const left=Math.floor(Math.min(...vertices.map(v=>v[0])))-7,top=Math.floor(Math.min(...vertices.map(v=>v[1])))-7;
  const right=Math.ceil(Math.max(...vertices.map(v=>v[0])))+7,bottom=Math.ceil(Math.max(...vertices.map(v=>v[1])))+7;
  const x=Math.max(0,left),y=Math.max(0,top),width=Math.min(CAMERA.width,right)-x,height=Math.min(CAMERA.height,bottom)-y;
  if(width<=0||height<=0)throw new Error(`Object outside camera: ${object}`);
  return {x,y,width,height};
}
const projected=stations.map(station=>({...station,screen:project(station.position),approachScreen:project(station.approach),bounds:getBounds(station.id),triangles:model.triangles.filter(t=>t.object===station.id).length}));
const actor={id:ACTOR_OBJECT_ID,key:'actor',name:'归来者',position:ACTOR_POSITION,screen:project(ACTOR_POSITION),facing:ACTOR_FACING,height:ACTOR_HEIGHT,lamp:actorLampAnchor(),bounds:getBounds(ACTOR_OBJECT_ID),source:'actor.ts',riftSource:'src/entities/player-sprite-dense.ts',description:'同一位戴圆顶护帽、负背包、携侧肩灯的归来者。据点用同源构型和混合光照塑造，裂隙内保留原低精度角色。',triangles:model.triangles.filter(t=>t.object===ACTOR_OBJECT_ID).length};
// A close fixed pixel grid reveals construction; it never replaces the actual
// scene-scale crop alongside it in the viewer.
for(const object of [...projected,actor]){
  const isolated=new Model();isolated.triangles.push(...model.triangles.filter(t=>t.object===object.id));isolated.lights.push(...model.lights);isolated.volumes.push(...model.volumes.filter(v=>v.object===object.id));
  const points=isolated.triangles.flatMap(t=>[t.a,t.b,t.c]).map(p=>project(p,{...CAMERA,scale:1,origin:[0,0]}));
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const scale=Math.min(object.id===7?154:74,278/Math.max(maxX-minX,maxY-minY));
  const camera={...CAMERA,width:384,height:384,scale,origin:[192-(minX+maxX)/2*scale,192-(minY+maxY)/2*scale]};
  const portrait=render(isolated,camera);
  for(let i=0;i<portrait.objects.length;i++)if(!portrait.objects[i])portrait.rgba[i*4+3]=0;
  object.modelAsset=`model-${object.key}.png`;object.modelCamera=camera;
  await sharp(Buffer.from(portrait.rgba),{raw:{width:384,height:384,channels:4}}).png().toFile(path.join(output,object.modelAsset));
  console.log(`Exported ${object.key} model.`);
}
await sharp(Buffer.from(renderDensePlayerFrame('up','idle',0)),{raw:{width:32,height:32,channels:4}}).png().toFile(path.join(output,'rift-actor.png'));
const lightStats={};
for(const kind of ['pollution','furnace','shoulder']){
  let receivingPixels=0,maximum=0;const objects=new Set();
  for(let i=0;i<result.objects.length;i++){const strength=Math.max(...result.lightFields[kind].subarray(i*4,i*4+3));maximum=Math.max(maximum,strength);if(strength>1){receivingPixels++;objects.add(result.objects[i]);}}
  lightStats[kind]={receivingPixels,maximum,objects:[...objects].sort()};
}
const manifest={reference:'public/assets/art/menu-last-light.png',baseline:'35f17ba',method:'Authored geometry rasterized at 960×640. Shared materials, source-tested shadows, ambient occlusion and transparent layers. Three additive source families drive live light/erosion/air/deep-presence motion. No generated image sampled as scene artwork.',camera:CAMERA,actor,stations:projected,walkSurfaces:WALK_SURFACES,triangles:model.triangles.length,lights:model.lights.map(l=>({...l,screen:project(l.position)})),lightStats,depthEncoding:'RG = round((cameraDepth + 80) * 256), B = far 1 / middle 2 / near 3 / haven 4; zero RG is empty.',motionEncoding:'R layer 0..4; G object 0..7; B source material 0 none / 1 pollution / 2 furnace / 3 shoulder; A stable material phase. Additive surface-light PNGs already occur once in haven-energy-base.png; animate with field × (factor - 1).',energyEncoding:'core-energy-atlas.png: 8 frames, 4 columns × 2 rows, 960×640 each; RGB premultiplied emission plus additive halo, A opacity. Keep RGB at A=0. Interpolate over 4.8 seconds and composite base × (1-alpha) + emission. haven.png is the static frame-0 composite.',status:'ART-REVISION / BASELINE-HUMAN-APPRECIATED / NEW-REVISION-REVIEW-PENDING / NOT-PRODUCTION-INTEGRATED'};
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const checksums={method:'SHA-256',sources:{},outputs:{},unchangedRift:{}};
for(const filename of ['model.ts','render.ts','energy.ts','environment.ts','devices.ts','actor.ts','scene.ts','export.mjs','viewer.ts','motion.ts','index.html','check.mjs']){
  try{checksums.sources[filename]=createHash('sha256').update(await fs.readFile(path.join(here,filename))).digest('hex');}catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const filename of (await fs.readdir(output)).filter(f=>f.endsWith('.png')||f==='manifest.json'))checksums.outputs[filename]=createHash('sha256').update(await fs.readFile(path.join(output,filename))).digest('hex');
for(const filename of ['src/entities/player-sprite-dense.ts','src/entities/player-sprite.ts'])checksums.unchangedRift[filename]=createHash('sha256').update(await fs.readFile(filename)).digest('hex');
await fs.writeFile(path.join(output,'checksums.json'),JSON.stringify(checksums,null,2)+'\n');
console.log(`Exported art, actor, seven models and three source fields to ${output}.`);
