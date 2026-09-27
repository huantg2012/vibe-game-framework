import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=process.cwd(),dir=path.join(root,'public/assets/last-light');
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const checksums=JSON.parse(await fs.readFile(path.join(dir,'checksums.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.status,'complete');assert.equal(manifest.source.riftOpeningScale,.52);
assert.deepEqual(manifest.canvas,{width:960,height:640});
// Scene provenance is the recipe used for the last scene bake. An actor-only
// bake must preserve it, even when the actor/tool source has since changed.
const actorOnlySourceChanges=new Set(['docs/art/demos/purification-last-light/actor.ts','src/art/last-light-gait.ts','tools/last-light/export.mjs']);
assert.deepEqual(checksums.actorSources,manifest.actor.sourceHashes,'Actor provenance must agree with manifest');
for(const [file,value] of Object.entries(checksums.actorSources??{}))assert.equal(hash(await fs.readFile(path.join(root,file))),value,`Stale actor source ${file}`);
assert.ok(manifest.exteriorFields,'Per-layer exterior light/material contract missing');
assert.deepEqual(checksums.exteriorSources,manifest.exteriorFields.sourceHashes,'Exterior provenance must agree with manifest');
for(const [file,value] of Object.entries(checksums.exteriorSources??{}))assert.equal(hash(await fs.readFile(path.join(root,file))),value,`Stale exterior source ${file}`);
for(const [file,value] of Object.entries(checksums.sources)){
 if(actorOnlySourceChanges.has(file)&&checksums.actorSources?.[file])continue;
 assert.equal(hash(await fs.readFile(path.join(root,file))),value,`Stale scene source ${file}`);
}
for(const [file,value] of Object.entries(checksums.outputs))assert.equal(hash(await fs.readFile(path.join(dir,file))),value,`Stale output ${file}`);
const required=new Set([...Object.values(manifest.textures),...Object.values(manifest.actor.textures),...manifest.exteriorLayers.map(x=>x.color)]);
const images=new Map();
for(const file of required){const {data,info}=await sharp(path.join(dir,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});images.set(file,{data,info});assert.equal(info.channels,4);assert.ok(data.length>0);}
const pixels=key=>images.get(manifest.textures[key]);
for(const name of ['base','haven','background','normal','albedo','roughSpec','depth','motion','objects','pollution','coreLight','furnace','storageLight','purifierLight']){
 const {info}=pixels(name);assert.equal(info.width,960,name);assert.equal(info.height,640,name);
}
for(const layer of manifest.exteriorLayers){const {info}=images.get(layer.color);assert.equal(info.width,layer.width);assert.equal(info.height,layer.height);assert.deepEqual(layer.offset,[-32,-32]);}
const exteriorMetadata=JSON.parse(await fs.readFile(path.join(dir,manifest.exteriorFields.metadata),'utf8'));
assert.deepEqual(exteriorMetadata.sourceHashes,manifest.exteriorFields.sourceHashes);
assert.deepEqual(exteriorMetadata.columns,['far','middle','near','haven']);
assert.deepEqual(exteriorMetadata.rows,['otherPollution','core','storage','purifier','furnace','motion','normal']);
assert.equal(manifest.textures.exteriorFields,exteriorMetadata.texture);
const exteriorPixels=pixels('exteriorFields');
assert.equal(exteriorPixels.info.width,4096);assert.equal(exteriorPixels.info.height,4928);
assert.equal(hash(await fs.readFile(path.join(dir,exteriorMetadata.texture))),exteriorMetadata.textureHash);
const ids=new Set(),objects=pixels('objects').data,depth=pixels('depth').data,normal=pixels('normal').data;
let coverage=0;
for(let i=0;i<objects.length;i+=4){ids.add(objects[i]);if(depth[i+3]){coverage++;assert.equal(normal[i+3],255,'Opaque pixel lost its normal');assert.ok(depth[i]+depth[i+1]>0);}}
assert.ok(!ids.has(7),'Standing reference actor remains baked in the fixed scene');
for(const id of [1,2,3,4,5,6,8])assert.ok(ids.has(id),`Missing station/rest ${id}`);
assert.ok(coverage>100000,'Scene geometry coverage unexpectedly low');
assert.ok(manifest.lights.every(l=>l.kind!=='shoulder'),'Shoulder must follow the runtime actor, not the reference position');
assert.equal(manifest.lights.filter(l=>l.id.startsWith('core-')).length,7);
assert.equal(manifest.lights.filter(l=>l.id.startsWith('rift-')).length,3);
assert.ok(manifest.lights.some(l=>l.id==='haven-furnace'));
const energy=pixels('coreEnergy');assert.equal(energy.info.width,3840);assert.equal(energy.info.height,1280);
let additiveHalo=0;for(let i=0;i<energy.data.length;i+=4)if(!energy.data[i+3]&&(energy.data[i]||energy.data[i+1]||energy.data[i+2]))additiveHalo++;
assert.ok(additiveHalo>100,'Core radiance at zero alpha must survive export');
const a=manifest.actor,atlas=images.get(a.textures.color),ad=images.get(a.textures.depth),an=images.get(a.textures.normal);
assert.equal(a.gait.cycleFrames,12);assert.equal(a.gait.settleStages,2);assert.equal(a.gait.strideMetres,1.05);
const walkingRows=a.gait.cycleFrames*(1+a.gait.settleStages),actorRows=2+walkingRows+1;
assert.equal(a.frames.length,actorRows*8);assert.equal(atlas.info.width,512);assert.equal(atlas.info.height,actorRows*80);
const frameChecks=[];
for(const frame of a.frames){
 assert.equal(frame.shadowCapsules.length,11,`Incomplete pose shadow rig ${frame.pose}/${frame.direction}/${frame.frame}`);
 for(const capsule of frame.shadowCapsules){assert.equal(capsule.length,7);assert.ok(capsule.every(Number.isFinite));assert.ok(capsule[6]>.03&&capsule[6]<.3);}
 const {x,y,width,height}=frame.rect;const bytes=[];let n=0;
 for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
  const offset=((y+yy)*a.width+x+xx)*4;
  if(atlas.data[offset+3]){n++;assert.ok(xx>0&&xx<width-1&&yy>0&&yy<height-1,`Actor clipped ${frame.pose}/${frame.direction}/${frame.frame}`);assert.equal(ad.data[offset+3],255);assert.equal(an.data[offset+3],255);}
  bytes.push(...atlas.data.subarray(offset,offset+4));
 }
 assert.ok(n>140&&n<1500,`Unexpected actor silhouette ${n}`);
 frameChecks.push({pose:frame.pose,direction:frame.direction,frame:frame.frame,pixels:n,hash:hash(Buffer.from(bytes))});
}
for(let direction=0;direction<8;direction++){
 const gait=frameChecks.filter(f=>f.direction===direction&&f.pose==='walk');assert.equal(gait.length,walkingRows);
 const stride=gait.filter(f=>f.frame<a.gait.cycleFrames);
 assert.equal(new Set(stride.map(f=>f.hash)).size,a.gait.cycleFrames,`Collapsed walk poses for direction ${direction}`);
 assert.equal(frameChecks.filter(f=>f.direction===direction&&f.pose==='sit').length,1);
 const idle=frameChecks.filter(f=>f.direction===direction&&f.pose==='idle');assert.equal(new Set(idle.map(f=>f.hash)).size,2,`Idle breathing collapsed for direction ${direction}`);
}
const occluders=JSON.parse(await fs.readFile(path.join(dir,manifest.occluders.url),'utf8'));
assert.equal(occluders.triangles.length,occluders.count*9);assert.ok(occluders.count>45000);assert.ok(occluders.triangles.every(Number.isFinite));
const stats={status:'PASS',width:960,height:640,riftOpeningScale:.52,opaquePixels:coverage,sourceLights:manifest.lights.length,coreEmitters:7,riftEmitters:3,additiveHaloPixels:additiveHalo,staticOccluders:occluders.count,actorFrames:frameChecks.map(({hash,...f})=>f),checksums:hash(await fs.readFile(path.join(dir,'checksums.json')))};
if(process.argv.includes('--write')){const out='docs/qa/artifacts/last-light-production/assets.json';await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(stats,null,2)+'\n');}
console.log(JSON.stringify({...stats,actorFrames:a.frames.length},null,2));
