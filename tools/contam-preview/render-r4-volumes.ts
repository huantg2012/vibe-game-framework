import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createVolumePresenceFrame,updateVolumePresenceFrame,volumeTimeAtPhase,getVolumeProfile,sampleVolumeDensity,isVolumeDangerousAt,type VolumePhase} from '../../src/systems/volume-presence';
import {paintVolumePresence} from '../../src/entities/form-renderers/d/volume-paint';
const out='docs/art/iteration-18-r4-volume-evidence';await mkdir(out,{recursive:true});
const families=['gas_mass','mist_bank','dust_swarm'];
const tiers=['infiltrate','rewrite','overwrite'];
const phases:[VolumePhase,number][]=[['rest',.5],['gather',.75],['release',.1],['release',.7],['disperse',.6],['disperse',.95]];
const size=192,rect={x:32,y:48,w:160,h:128};
const reports=[];
for(const family of families){
 const f=createVolumePresenceFrame(),pixels=new Uint8ClampedArray(size*size*4),cells=[];
 const hashes=new Set<string>();let scanned=0,dangerPixels=0;
 for(let row=0;row<tiers.length;row++)for(let col=0;col<phases.length;col++){
  const [phase,progress]=phases[col]!;
  updateVolumePresenceFrame(f,{substrate:family,coverage:tiers[row]!,elapsedMs:volumeTimeAtPhase(family,phase,progress),rect,active:true});
  paintVolumePresence(pixels,size,size,f,7,3);
  hashes.add(Buffer.from(pixels).toString('base64'));
  const input=await sharp(Buffer.from(pixels),{raw:{width:size,height:size,channels:4}}).png().toBuffer();
  cells.push({input,left:col*size,top:row*size});
 }
 const png=await sharp({create:{width:size*phases.length,height:size*tiers.length,channels:4,background:'#242927'}}).composite(cells).png().toBuffer();
 await writeFile(`${out}/${family}.png`,png);await sharp(png).resize(size*phases.length*2,size*tiers.length*2,{kernel:'nearest'}).toFile(`${out}/${family}-2x.png`);
 if(hashes.size!==18)throw Error(`${family} repeated tier/action frames ${hashes.size}`);
 // Sample full periods, with and without walls/void. Check actual density, not painter implementation details.
 const p=getVolumeProfile(family),cycle=p.restMs+p.gatherMs+p.releaseMs+p.disperseMs;
 for(const clipped of [false,true])for(const coverage of tiers)for(let time=0;time<cycle;time+=137){
  updateVolumePresenceFrame(f,{substrate:family,coverage,elapsedMs:time,rect,active:true,isWalkableFloor:clipped?(c,r)=>c!==3&&r!==4:undefined});
  paintVolumePresence(pixels,size,size,f,7,3);
  const original=Buffer.from(pixels);paintVolumePresence(pixels,size,size,f,7,3);
  if(!original.equals(Buffer.from(pixels)))throw Error('nondeterministic frame');
  const ox=rect.x+rect.w/2-size/2,oy=rect.y+rect.h/2-size/2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const wx=ox+x+.5,wy=oy+y+.5,a=pixels[(y*size+x)*4+3]!;
   if(a&&sampleVolumeDensity(f,wx,wy)===0)throw Error(`${family} ink outside real field`);
   if(isVolumeDangerousAt(f,wx,wy)){dangerPixels++;if(a<48)throw Error(`${family} invisible dangerous pixel`);}
   if((x===0||y===0||x===size-1||y===size-1)&&a)throw Error('canvas clipped');
  }
  if(f.hasPresence&&sampleVolumeDensity(f,f.coreX,f.coreY)<f.dangerThreshold)throw Error('unreachable core');
  scanned++;
 }
 const timings=[];
 for(const canvas of [192,384]){
  const frame=createVolumePresenceFrame(),buffer=new Uint8ClampedArray(canvas*canvas*4),times:number[]=[];
  const area={x:0,y:0,w:canvas-32,h:canvas-48};
  for(let i=0;i<180;i++){
   updateVolumePresenceFrame(frame,{substrate:family,coverage:'overwrite',elapsedMs:i*33,rect:area,active:true,isWalkableFloor:(c,r)=>c!==1||r!==1});
   const start=performance.now();paintVolumePresence(buffer,canvas,canvas,frame,7,3);const ms=performance.now()-start;
   if(i>=30)times.push(ms);
  }
  times.sort((a,b)=>a-b);timings.push({canvas,p50Ms:+times[75]!.toFixed(3),p95Ms:+times[142]!.toFixed(3),maxMs:+times[149]!.toFixed(3)});
 }
 reports.push({family,frames:scanned,distinctSheetFrames:hashes.size,dangerPixels,timings});
}
await writeFile(`${out}/checks.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
