import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChamberPixels } from '../../src/art/purification-chamber-pixels.ts';
import { DEVICE_ACTIVITY_ATLASES, paintDeviceActivityFrame, paintRiftShell,
  sampleCoreMotion, sampleDeviceActivityFrame, sampleDeviceLight } from '../../src/art/chamber-device-motion.ts';
import type { ChamberDevice } from '../../src/systems/purification-chamber-layout.ts';
import { writePng } from '../map-preview/png.ts';

let checks=0;
const check=(pass:unknown,label:string)=>{ checks++; assert(pass,label); };
const out=process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/iteration-30-r8/motion';
mkdirSync(out,{recursive:true});
class Raster {
  fillStyle='#000000'; imageSmoothingEnabled=false;
  x=0; y=0; outside=0;
  readonly data: Buffer;
  constructor(readonly width:number,readonly height:number) { this.data=Buffer.alloc(width*height*4); }
  translate(x:number,y:number) { this.x+=x; this.y+=y; }
  fillRect(x:number,y:number,width:number,height:number) {
    const color=parseInt(this.fillStyle.slice(1),16);
    for(let yy=y+this.y;yy<y+this.y+height;yy++) for(let xx=x+this.x;xx<x+this.x+width;xx++) {
      if(xx<0||xx>=this.width||yy<0||yy>=this.height) { this.outside++; continue; }
      const offset=(yy*this.width+xx)*4;
      this.data[offset]=color>>16&255;this.data[offset+1]=color>>8&255;
      this.data[offset+2]=color&255;this.data[offset+3]=255;
    }
  }
}
function frame(id:ChamberDevice,index:number,health=1,occupied=false) {
  const spec=DEVICE_ACTIVITY_ATLASES[id];
  const r=new Raster(spec.width,spec.height);
  const p=new ChamberPixels(r as unknown as CanvasRenderingContext2D);
  p.translate(spec.originX,spec.originY);
  paintDeviceActivityFrame(p,id,index,health,occupied);
  return r;
}
function changes(a:Buffer,b:Buffer,alphaOnly=false) {
  let changed=0;
  for(let i=0;i<a.length;i+=4) if(alphaOnly ? a[i+3]!==b[i+3]
    : a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]) changed++;
  return changed;
}
const summary:Record<string,unknown>={};
for(const id of Object.keys(DEVICE_ACTIVITY_ATLASES) as ChamberDevice[]) {
  const spec=DEVICE_ACTIVITY_ATLASES[id];
  const sheet=new Raster(spec.width*8,spec.height*Math.ceil(spec.frames/8));
  const p=new ChamberPixels(sheet as unknown as CanvasRenderingContext2D);
  let activeFrames=0;
  for(let index=0;index<spec.frames;index++) {
    const r=frame(id,index,1,id==='offering');
    check(r.outside===0,`${id}/${index} fully fits its cropped frame`);
    if(r.data.some((value,i)=>i%4===3&&value>0)) activeFrames++;
    p.translate((index%8)*spec.width+spec.originX,Math.floor(index/8)*spec.height+spec.originY);
    paintDeviceActivityFrame(p,id,index,1,id==='offering');
    p.translate(-((index%8)*spec.width+spec.originX),-(Math.floor(index/8)*spec.height+spec.originY));
  }
  check(activeFrames>0,`${id} has authored activity pixels`);
  const idleA=frame(id,0,1,id==='offering').data;
  let maxChanged=0;
  for(let index=1;index<16;index++) maxChanged=Math.max(maxChanged,changes(idleA,frame(id,index,1,id==='offering').data));
  check(maxChanged>3,`${id} changes actual pixels, not an unused phase number`);
  summary[id]={frames:spec.frames,pixels:spec.width*8*spec.height*Math.ceil(spec.frames/8),maxChanged};
  writePng(join(out,`${id}-atlas.png`),sheet.data,sheet.width,sheet.height);
  const poses=new Set<number>();
  for(let time=0;time<40000;time+=60) {
    const value=sampleDeviceActivityFrame(id,time,1,false);
    check(value>=0&&value<spec.frames,`${id} sampler selects an authored frame`);
    poses.add(value);
    check(sampleDeviceActivityFrame(id,time,1,true)===sampleDeviceActivityFrame(id,0,1,true),`${id} reduced idle motion is stable`);
  }
  check(poses.size>=8,`${id} timeline reaches multiple distinct authored poses`);
}
check(changes(frame('core',0).data,frame('core',15).data,true)>45,'Core breath changes silhouette, not just brightness');
check(changes(frame('offering',0,1,false).data,frame('offering',0,1,true).data)>50,'Occupied offering has matter; empty ring has none');
for (let index=24;index<32;index++) {
  check(frame('offering',index,1,true).data.equals(frame('offering',index,1,false).data),
    'Completed offering releases only an anonymous residue regardless of slot occupancy');
}
check(frame('offering',31,1,false).data.equals(frame('offering',0,1,false).data),
  'Completion ends with empty neutral clamps, not an invented item');
for (const id of ['growth','purifier'] as const) for (let time=0;time<32000;time+=160) {
  const value=sampleDeviceLight(id,time,1);
  check(value>=.06&&value<=.125,'Secondary device lights remain below core prominence');
  check(sampleDeviceLight(id,time,1,true)===sampleDeviceLight(id,0,1,true),'Reduced secondary light is stable');
}
const rareWindows:number[]=[];
for(let time=0;time<108000;time+=60) {
  const motion=sampleCoreMotion(time,1);
  const damaged=sampleCoreMotion(time,0);
  check(damaged.light<motion.light,'Damage never produces brighter running light');
  check(sampleCoreMotion(time,1,true).shiver===0,'Reduced motion removes constraint tremor');
  if(motion.shiver!==0) rareWindows.push(time);
}
check(rareWindows.length===9,'Three three-step tremors in 108 seconds, with settled time between');
check(sampleCoreMotion(10000,1,false,100).repairStage==='close','Successful repair first closes the inlet');
check(sampleCoreMotion(10000,1,false,700).repairStage==='gather','Repair gathers the captive matter');
check(sampleCoreMotion(10000,1,false,1400).repairStage==='settle','Repair settles after gathering');
check(sampleCoreMotion(10000,1,false,1680).repairStage==='idle','Repair completes without queuing or locking');
check(sampleCoreMotion(10000,1,false,-1).repairStage==='idle','Future/absent events cannot play success');
const shell=new Raster(64,40);const shellPainter=new ChamberPixels(shell as unknown as CanvasRenderingContext2D);
shellPainter.translate(32,22);paintRiftShell(shellPainter);
check(shell.outside===0,'Reauthored Rift shell fits its declared ground bounds');
writePng(join(out,'rift-shell.png'),shell.data,64,40);
writeFileSync(join(out,'sampling.json'),JSON.stringify({checks,summary,rareWindows,scope:'Pure authored pixels and phase semantics; not in-game art acceptance.'},null,2));
console.log(`R8 device motion: ${checks} checks passed; ${out}`);
