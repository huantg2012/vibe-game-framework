import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createVolumePresenceFrame,updateVolumePresenceFrame,volumeTimeAtPhase,getVolumeProfile,sampleVolumeDensity,isVolumeDangerousAt,type VolumePhase} from '../../src/systems/volume-presence';
import {paintVolumePresence} from '../../src/entities/form-renderers/d/volume-paint';
const out='docs/art/iteration-18-r4-dust-remake-evidence';await mkdir(out,{recursive:true});
const families=['dust_swarm'];
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

// Continuous 6-second production animation, including the cycle boundary.
// Fixed material palette and full-frame GIF intermediate preserve hard pixels;
// libvips decodes it into a lossless animated WebP without browser automation.
const animationFrame=createVolumePresenceFrame(),animationPixels=new Uint8ClampedArray(size*size*4);
const palette:number[][]=[[36,41,39]];
for(const ink of [[43,46,39],[75,79,64],[110,113,90],[148,144,114],[179,169,135],[83,134,106],[28,51,43],[102,176,139]])
 for(let level=1;level<=16;level++)palette.push(ink.map((v,c)=>Math.round(v*level/16+palette[0]![c]!*(1-level/16))));
while(palette.length<256)palette.push([0,0,0]);
const bytes:number[]=[];
const word=(v:number)=>{bytes.push(v&255,v>>>8&255);};
bytes.push(...Buffer.from('GIF89a'));word(size);word(size);bytes.push(0xf7,0,0,...palette.flat());
bytes.push(0x21,0xff,11,...Buffer.from('NETSCAPE2.0'),3,1,1,0,0);
const quantized=new Map<number,number>();
for(let frameIndex=0;frameIndex<120;frameIndex++){
 updateVolumePresenceFrame(animationFrame,{substrate:'dust_swarm',coverage:'rewrite',elapsedMs:frameIndex*50,rect,active:true});
 paintVolumePresence(animationPixels,size,size,animationFrame,7,3);
 const indices=new Uint8Array(size*size);
 for(let p=0;p<indices.length;p++){
  const o=p*4,a=animationPixels[o+3]!/255;
  const r=Math.round(animationPixels[o]!*a+36*(1-a)),g=Math.round(animationPixels[o+1]!*a+41*(1-a)),b=Math.round(animationPixels[o+2]!*a+39*(1-a));
  const key=r*65536+g*256+b;let best=quantized.get(key);
  if(best===undefined){let distance=Infinity;best=0;for(let i=0;i<129;i++){const c=palette[i]!,d=(r-c[0]!)**2+(g-c[1]!)**2+(b-c[2]!)**2;if(d<distance){distance=d;best=i;}}quantized.set(key,best);}
  indices[p]=best;
 }
 bytes.push(0x21,0xf9,4,4,5,0,0,0,0x2c);word(0);word(0);word(size);word(size);bytes.push(0,8);
 // Frequent clear codes keep every literal at exactly nine bits, avoiding
 // dictionary width ambiguities while retaining a tiny dependency-free encoder.
 const data:number[]=[];let bits=0,bitCount=0;
 const code=(n:number)=>{bits|=n<<bitCount;bitCount+=9;while(bitCount>=8){data.push(bits&255);bits>>>=8;bitCount-=8;}};
 for(let p=0;p<indices.length;p++){if(p%200===0)code(256);code(indices[p]!);}code(257);if(bitCount)data.push(bits&255);
 for(let p=0;p<data.length;p+=255){const block=data.slice(p,p+255);bytes.push(block.length,...block);}bytes.push(0);
}
bytes.push(0x3b);
const gif=Buffer.from(bytes);
await sharp(gif,{animated:true}).webp({lossless:true,loop:1,delay:50}).toFile(`${out}/dust-rewrite-continuous-6s.webp`);
const animated=await sharp(`${out}/dust-rewrite-continuous-6s.webp`,{animated:true}).metadata();
if(animated.pages!==120||animated.pageHeight!==size||animated.delay?.reduce((a,b)=>a+b,0)!==6000)throw Error('animation lost frames or timing');
console.log(JSON.stringify({animationFrames:animated.pages,durationMs:6000,worldSize:size}));
