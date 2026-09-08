/** R3 evidence uses the actual six production bakers, no alternate art path. */
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {bakeInsectModel} from '../../src/entities/form-renderers/d/insect-model';
import {bakeHumanModel} from '../../src/entities/form-renderers/d/human-model';
import {bakeBeastModel,beastVariantOf} from '../../src/entities/form-renderers/d/beast-model';
import {bakeWormModel,wormVariantOf} from '../../src/entities/form-renderers/d/worm-model';
import {bakeRemnantModel,remnantVariantOf} from '../../src/entities/form-renderers/d/remnant-model';
import {bakeGrowthModel,growthVariantOf} from '../../src/entities/form-renderers/d/growth-model';
import type {CreatureModelRequest,CreatureModelResult} from '../../src/entities/form-renderers/d/model-raster';
const out='docs/art/iteration-18-r3-floor-evidence';
const tiers=['infiltrate','rewrite','overwrite'] as const;
const directions=['down','left','up','right'] as const;
const phases=['idle','walk','alert','windup','strike','recover'] as const;
const families: {id:string;bake:(req:CreatureModelRequest)=>CreatureModelResult;variant?:(seed:number)=>number}[]=[
 {id:'insect',bake:bakeInsectModel},{id:'human',bake:bakeHumanModel},
 {id:'beast',bake:bakeBeastModel,variant:beastVariantOf},{id:'worm',bake:bakeWormModel,variant:wormVariantOf},
 {id:'remnant',bake:bakeRemnantModel,variant:remnantVariantOf},{id:'growth',bake:bakeGrowthModel,variant:growthVariantOf},
];
await mkdir(out,{recursive:true});
const image=(b:CreatureModelResult['buf'])=>sharp(Buffer.from(b.data),{raw:{width:b.w,height:b.h,channels:4}}).png().toBuffer();
async function sheet(name:string,cols:number,rows:number,cells:{r:CreatureModelResult;x:number;y:number}[]) {
 const raw=await sharp({create:{width:cols*72,height:rows*72,channels:4,background:'#252829'}}).composite(await Promise.all(cells.map(async c=>({input:await image(c.r.buf),left:c.x*72+36-c.r.canvas.originX,top:c.y*72+48-c.r.canvas.originY})))).png().toBuffer();
 await writeFile(`${out}/${name}-native.png`,raw);
 await sharp(raw).resize(cols*72*3,rows*72*3,{kernel:'nearest'}).png().toFile(`${out}/${name}-3x.png`);
}
const overview=[];
const reports=[];
for (const [row,family] of families.entries()) {
 const seeds:number[]=[];
 for(let seed=0;seeds.filter(s=>s!==undefined).length<(family.variant?3:1);seed++){const v=family.variant?.(seed)??0;if(seeds[v]===undefined)seeds[v]=seed;}
 for(const [x,coverage] of tiers.entries())overview.push({x,y:row,r:family.bake({seed:seeds[0]!,coverage,facing4:'down',phase:'idle',phase01:0})});
 await sheet(`${family.id}-directions`,4,seeds.length*3,seeds.flatMap((seed,variant)=>tiers.flatMap((coverage,tier)=>directions.map((facing4,x)=>({x,y:variant*3+tier,r:family.bake({seed,coverage,facing4,phase:'idle',phase01:0})})))));
 await sheet(`${family.id}-phases`,6,seeds.length*3,seeds.flatMap((seed,variant)=>tiers.flatMap((coverage,tier)=>phases.map((phase,x)=>({x,y:variant*3+tier,r:family.bake({seed,coverage,facing4:'right',phase,phase01:phase==='strike'?0:.8})})))));
 if(process.argv.includes('--sheets-only'))continue;
 const equal=(a:CreatureModelResult,b:CreatureModelResult)=>Buffer.from(a.buf.data).equals(Buffer.from(b.buf.data));
 let frames=0,minPixels=Infinity,maxPixels=0,minMargin=Infinity;
 const colors=new Set<string>();
 for(const seed of [...new Set([...seeds,1,7,37,65535,4294967295])])for(const coverage of tiers)for(const facing4 of directions)for(const phase of phases)for(let frame=0;frame<8;frame++)for(const restAmount of [0,.5,1]){
  const req={seed,coverage,facing4,phase,phase01:frame/7,restAmount};const result=family.bake(req),b=result.buf;
  if(!equal(result,family.bake(req)))throw Error(`${family.id} non-deterministic`);
  if(result.canvas.originX!==(family.id==='insect'?24:32)||result.canvas.originY!==(family.id==='insect'?24:42))throw Error(`${family.id} origin changed`);
  let pixels=0;
  for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const i=(y*b.w+x)*4,a=b.data[i+3];if(a!==0&&a!==255)throw Error(`${family.id} alpha`);if(!a)continue;pixels++;minMargin=Math.min(minMargin,x,y,b.w-1-x,b.h-1-y);colors.add(`${b.data[i]},${b.data[i+1]},${b.data[i+2]}`);}
  if(pixels<60)throw Error(`${family.id} empty pose`);
  minPixels=Math.min(minPixels,pixels);maxPixels=Math.max(maxPixels,pixels);frames++;
 }
 for(const seed of seeds)for(const coverage of tiers)for(const facing4 of directions)for(const restAmount of [0,.5,1]){
  const req={seed,coverage,facing4,restAmount};
  for(const phase of ['idle','walk','alert'] as const)if(!equal(family.bake({...req,phase,phase01:0}),family.bake({...req,phase,phase01:1})))throw Error(`${family.id}/${phase} loop seam`);
  if(!equal(family.bake({...req,phase:'strike',phase01:1}),family.bake({...req,phase:'recover',phase01:0})))throw Error(`${family.id} attack seam`);
  if(!equal(family.bake({...req,phase:'recover',phase01:1}),family.bake({...req,phase:'idle',phase01:0})))throw Error(`${family.id} recovery seam`);
 }
 if(minMargin<1)throw Error(`${family.id} canvas edge`);
 if(colors.size>12)throw Error(`${family.id} unbounded ink palette ${colors.size}`);
 reports.push({family:family.id,seeds,frames,minPixels,maxPixels,minMargin,colors:colors.size,loopSeams:0,attackRecoverySeams:0,deterministic:true,restAmounts:[0,.5,1]});
}
await sheet('six-family-coverage',3,6,overview);
if(reports.length){await writeFile(`${out}/checks.json`,JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));}
