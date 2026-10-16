/** Promote selected A byte-for-byte; bake only detached articulated combat parts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Model} from '../../docs/art/demos/purification-last-light/model.ts';
import {buildActor,buildActorRightArm,buildActorRightHand} from '../../docs/art/demos/purification-last-light/actor.ts';
import {CAMERA,project,render} from '../../docs/art/demos/purification-last-light/render.ts';
import {lastLightWalkArm} from '../../src/art/last-light-gait.ts';
import {LAST_LIGHT_REST_ARM,LAST_LIGHT_ATTACK_SAMPLES,lastLightAttackArm,lastLightSwingSample} from '../../src/entities/player-last-light-combat.ts';
const source='docs/art/previews/rift-player-models/assets',out='public/assets/player-last-light-a';
const old=JSON.parse(await fs.readFile(`${source}/manifest.json`,'utf8')),a=old.variants.find(v=>v.id==='a');
const width=64,height=80,camera={...CAMERA,width,height,origin:[32,66],target:[0,0,0]},front=Math.atan2(19,30);
const channels=['albedo','normal','material','depth'];
const originals=Object.fromEntries(await Promise.all(channels.map(async c=>[c,await sharp(`${source}/${a.atlas[c]}`).raw().toBuffer()])));
const baseBuffers=Object.fromEntries(channels.map(c=>[c,new Uint8ClampedArray(832*640*4)]));
const attackBuffers=Object.fromEntries(channels.map(c=>[c,new Uint8ClampedArray(960*640*4)]));
const rotate=(p,yaw)=>[p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),p[1],-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)];
function actor(yaw,walk,arm){const m=new Model();buildActor(m,[0,0,0],yaw,0,walk,0,arm);for(const l of m.lights){l.power=1;l.radius=2.6;}return m;}
function part(yaw,arm,hand=false){const m=new Model();m.layer='haven';m.at([0,0,0],yaw,7,()=>hand?buildActorRightHand(m,arm):buildActorRightArm(m,arm));return m;}
function bake(model,shadowModel){const f=render(model,camera,undefined,{transparentBackground:true,skipEnergy:true,shadowModel});const depth=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++)if(f.normal[i*4+3]){const d=Math.max(1,Math.min(65535,Math.round((f.opaqueDepth[i]+80)*256)));depth.set([d>>8,d&255,4,255],i*4);}return{albedo:f.albedo,normal:f.normal,material:f.roughSpec,depth,rawDepth:f.opaqueDepth};}
function copyFrame(buffers,columns,row,column,frame){for(const c of channels)for(let y=0;y<80;y++)buffers[c].set(frame[c].subarray(y*64*4,(y+1)*64*4),((row*80+y)*columns*64+column*64)*4);}
function handPixels(yaw,arm,body){const hand=bake(part(yaw,arm,true));const pixels=[];for(let i=0;i<width*height;i++)if(hand.normal[i*4+3]&&hand.rawDepth[i]>=body.rawDepth[i]-.025)pixels.push(i);return pixels;}
function pin(yaw,arm){return{wristWorld:rotate(arm.wrist,yaw),shoulderWorld:rotate(arm.shoulder,yaw),wrist:project(rotate(arm.wrist,yaw),camera),shoulder:project(rotate(arm.shoulder,yaw),camera)};}
await fs.mkdir(out,{recursive:true});
const frames=[];
for(let row=0;row<8;row++)for(let column=0;column<13;column++){
  const yaw=front+row*Math.PI/4,walk=column?((column-1)/12*Math.PI*2):undefined;
  const original=bake(actor(yaw,walk));
  for(const c of channels)for(let y=0;y<80;y++)assert.deepEqual(Buffer.from(original[c].subarray(y*64*4,(y+1)*64*4)),originals[c].subarray(((row*80+y)*832+column*64)*4,((row*80+y)*832+column*64+64)*4),`A default changed: ${row}/${column}/${c}/${y}`);
  const unarmed=bake(actor(yaw,walk,null));copyFrame(baseBuffers,13,row,column,unarmed);
  const arm=column?lastLightWalkArm(true,(column-1)/12):LAST_LIGHT_REST_ARM;
  frames.push({...a.frames[row*13+column],...pin(yaw,arm),glovePixels:handPixels(yaw,arm,original)});
}
console.log('A104 original albedo/normal/material/depth: exact byte match');
const attackFrames=[];
for(let row=0;row<8;row++)for(let column=0;column<15;column++){
  const yaw=front+row*Math.PI/4,sample=LAST_LIGHT_ATTACK_SAMPLES[column],arm=lastLightAttackArm(sample.phase,sample.progress);
  const body=actor(yaw,undefined,arm),frame=bake(part(yaw,arm),body);copyFrame(attackBuffers,15,row,column,frame);
  attackFrames.push({key:`${row}-${sample.phase}-${sample.progress}`,yawIndex:row,yaw,pose:'attack',phase:sample.phase,progress:sample.progress,rect:[column*64,row*80,64,80],...pin(yaw,arm),sweep:lastLightSwingSample(sample.phase,sample.progress).sweep,glovePixels:handPixels(yaw,arm,frame)});
}
async function writeGroup(name,buffers,columns){const atlas={};for(const c of channels){atlas[c]=`${name}/${c}.png`;await fs.mkdir(path.join(out,name),{recursive:true});await sharp(Buffer.from(buffers[c]),{raw:{width:columns*64,height:640,channels:4}}).png().toFile(path.join(out,atlas[c]));}return atlas;}
const armless=await writeGroup('body-without-arm',baseBuffers,13),attack=await writeGroup('attack-arm',attackBuffers,15);
for(const c of [...channels,'contact']){await fs.mkdir(path.join(out,'a'),{recursive:true});await fs.copyFile(`${source}/${a.atlas[c]}`,path.join(out,a.atlas[c]));}
const manifest={version:2,frame:old.frame,variants:[{id:'a',atlas:Object.fromEntries([...channels,'contact'].map(c=>[c,a.atlas[c]])),frames}],
  bodyWithoutArm:{width:832,height:640,atlas:armless},attackArm:{width:960,height:640,atlas:attack,frames:attackFrames},
  materialEncoding:old.materialEncoding,delivery:'Selected A production body and articulated right-arm attachment; existing combat controls every clock.'};
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest));
const sourceFiles=[
  'tools/rift-player-models/export-production.mjs','src/entities/player-last-light-combat.ts',
  'src/art/last-light-gait.ts','src/art/last-light-spatial.ts',
  ...['actor.ts','model.ts','render.ts','energy.ts'].map(file=>'docs/art/demos/purification-last-light/'+file),
];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[
  file,createHash('sha256').update(await fs.readFile(file)).digest('hex'),
])));
const receipt={pass:true,unchangedBaseFrames:104,armlessFrames:104,attackArmFrames:120,
  unchangedChannels:channels,sourceHashes,files:{}};
for(const folder of ['a','body-without-arm','attack-arm'])for(const file of await fs.readdir(`${out}/${folder}`)){const p=`${folder}/${file}`;receipt.files[p]=createHash('sha256').update(await fs.readFile(`${out}/${p}`)).digest('hex');}
await fs.writeFile(`${out}/export-receipt.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({pass:true,frames:328,files:Object.keys(receipt.files).length}));
