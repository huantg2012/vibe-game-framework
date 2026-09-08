import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { bakeHumanModel, type HumanPhase } from '../../src/entities/form-renderers/d/human-model';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data';
import type { PaintBuf } from '../../src/entities/form-renderers/d/genome/buffer';
const out='docs/art/iteration-17-evidence';
const tiers:CoverageId[]=['infiltrate','rewrite','overwrite'];
const facings=['down','left','up','right'] as const;
const phases:HumanPhase[]=['idle','walk','alert','windup','strike','recover'];
await mkdir(out,{recursive:true});
const png=(b:PaintBuf)=>sharp(Buffer.from(b.data),{raw:{width:b.w,height:b.h,channels:4}}).png().toBuffer();
async function sheet(name:string,columns:number,rows:number,cells:{b:PaintBuf;x:number;y:number}[]):Promise<void>{
  const raw=await sharp({create:{width:columns*64,height:rows*64,channels:4,background:'#252829'}}).composite(await Promise.all(cells.map(async c=>({input:await png(c.b),left:c.x*64,top:c.y*64})))).png().toBuffer();
  await writeFile(`${out}/${name}-native.png`,raw);
  await sharp(raw).resize(columns*64*4,rows*64*4,{kernel:'nearest'}).png().toFile(`${out}/${name}-4x.png`);
}
await sheet('human-directions',4,3,tiers.flatMap((coverage,y)=>facings.map((facing4,x)=>({x,y,b:bakeHumanModel({coverage,facing4,seed:37,phase:'idle',phase01:0}).buf}))));
for(const facing4 of facings)await sheet(`human-${facing4}-phases`,6,3,tiers.flatMap((coverage,y)=>phases.map((phase,x)=>({x,y,b:bakeHumanModel({coverage,facing4,seed:37,phase,phase01:phase==='strike'?0:phase==='recover'?.5:.75}).buf}))));
for(const coverage of tiers)await sheet(`human-${coverage}-walk`,8,4,facings.flatMap((facing4,y)=>Array.from({length:8},(_,x)=>({x,y,b:bakeHumanModel({coverage,facing4,seed:37,phase:'walk',phase01:x/8}).buf}))));
let frames=0,minPixels=Infinity,maxPixels=0,minMargin=Infinity;
const colors=new Set<string>();
const bounds={minX:64,minY:64,maxX:0,maxY:0};
for(const seed of [0,1,2,7,37,1337,65535,4294967295])for(const coverage of tiers)for(const facing4 of facings)for(const phase of phases)for(let f=0;f<8;f++){
  const request={coverage,facing4,seed,phase,phase01:f/7};
  const {buf,canvas}=bakeHumanModel(request);
  if(canvas.originX!==32||canvas.originY!==42||canvas.collision!==20)throw Error('registration mismatch');
  if(!Buffer.from(buf.data).equals(Buffer.from(bakeHumanModel(request).buf.data)))throw Error('nondeterministic');
  let pixels=0;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const i=(y*64+x)*4,a=buf.data[i+3];
    if(a!==0&&a!==255)throw Error('non-binary alpha');
    if(!a)continue;
    pixels++;minMargin=Math.min(minMargin,x,y,63-x,63-y);
    bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);
    bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);
    colors.add(`${buf.data[i]},${buf.data[i+1]},${buf.data[i+2]}`);
  }
  if(pixels<80)throw Error('empty or implausibly small pose');
  if(minMargin<2)throw Error('insufficient canvas margin');
  minPixels=Math.min(minPixels,pixels);maxPixels=Math.max(maxPixels,pixels);frames++;
}
for(const coverage of tiers)for(const facing4 of facings){
  for(const phase of ['idle','walk'] as const){
    const req={coverage,facing4,seed:37,phase};
    if(!Buffer.from(bakeHumanModel({...req,phase01:0}).buf.data).equals(Buffer.from(bakeHumanModel({...req,phase01:1}).buf.data)))throw Error(`${phase} seam`);
  }
  const req={coverage,facing4,seed:37};
  if(!Buffer.from(bakeHumanModel({...req,phase:'strike',phase01:1}).buf.data).equals(Buffer.from(bakeHumanModel({...req,phase:'recover',phase01:0}).buf.data)))throw Error('strike/recover seam');
  if(!Buffer.from(bakeHumanModel({...req,phase:'recover',phase01:1}).buf.data).equals(Buffer.from(bakeHumanModel({...req,phase:'idle',phase01:0}).buf.data)))throw Error('recover/idle seam');
}
console.log(JSON.stringify({frames,minPixels,maxPixels,minMargin,bounds,uniqueShadedColors:colors.size,deterministic:true,binaryAlpha:true,loopSeams:0,attackRecoverySeams:0},null,2));
