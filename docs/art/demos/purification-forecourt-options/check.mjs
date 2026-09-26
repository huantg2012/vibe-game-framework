import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import {base} from './shared.ts';

const here=path.dirname(fileURLToPath(import.meta.url));
const files=(await fs.readdir(here)).filter(x=>x.endsWith('.ts')).map(x=>path.join(here,x));
const program=ts.createProgram(files,{strict:true,noEmit:true,noUnusedLocals:true,noUnusedParameters:true,noUncheckedIndexedAccess:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,lib:['lib.es2022.d.ts','lib.dom.d.ts'],skipLibCheck:true});
const diagnostics=ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
const baseline=base().model;
const report={scope:'COH-F042: isolated visual alternatives; no production movement or human art acceptance claimed',strictTypecheck:true,options:{},sources:{},outputs:{}};
for(const id of ['a','b','c']){
  const option=(await import(`./option-${id}.ts`)).buildOption();
  const {model,route,stop}=option;
  const changed=new Set(option.changedObjects??[]);
  assert.deepEqual(model.lights.map(({position,...l})=>l),baseline.lights.map(({position,...l})=>l),'Source parameters must not drift');
  for(const object of [1,2,3,4,5,6,7,8])if(!changed.has(object))assert.deepEqual(model.triangles.filter(t=>t.object===object),baseline.triangles.filter(t=>t.object===object),`${id} modified unrelated object ${object}`);
  assert.deepEqual(model.triangles.filter(t=>t.layer!=='haven'),baseline.triangles.filter(t=>t.layer!=='haven'),'Exterior may not drift');
  const keys={1:'core',2:'storage',3:'purifier',4:'offering',5:'growth',6:'rift',7:'shoulder'};
  for(let i=0;i<baseline.lights.length;i++)if(![...changed].some(n=>keys[n]&&baseline.lights[i].id.startsWith(`${keys[n]}-`)))assert.deepEqual(model.lights[i],baseline.lights[i],`${id} moved an unrelated light`);
  for(const t of model.triangles)assert([...t.a,...t.b,...t.c,...t.normal,t.tint].every(Number.isFinite));
  assert([...route.flat(),...stop].every(Number.isFinite));
  const floor=model.triangles.filter(t=>t.layer==='haven'&&t.object===0&&Math.abs(t.normal[1])>.55).map(t=>({...t,minX:Math.min(t.a[0],t.b[0],t.c[0]),maxX:Math.max(t.a[0],t.b[0],t.c[0]),minZ:Math.min(t.a[2],t.b[2],t.c[2]),maxZ:Math.max(t.a[2],t.b[2],t.c[2])}));
  const height=(t,x,z)=>{
    if(x<t.minX-1e-6||x>t.maxX+1e-6||z<t.minZ-1e-6||z>t.maxZ+1e-6)return null;
    const [a,b,c]=[t.a,t.b,t.c],det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(det)<1e-9)return null;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
    return Math.min(u,v,w)>=-1e-6?u*a[1]+v*b[1]+w*c[1]:null;
  };
  let samples=0;const failures=[];
  for(const r of option.routes??[])for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i],n=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))/.12));
    for(let j=0;j<=n;j++){
      const p=a.map((v,k)=>v+(b[k]-v)*j/n);samples++;
      for(const [dx,dz] of [[0,0],[.22,0],[-.22,0],[0,.22],[0,-.22]]){
        const supported=floor.some(t=>{const y=height(t,p[0]+dx,p[2]+dz);return y!==null&&Math.abs(y-p[1])<.24;});
        if(!supported){failures.push({route:r.label,point:p});break;}
      }
    }
  }
  assert.equal(failures.length,0,`${id} routes lack physical supporting ground: ${JSON.stringify(failures.slice(0,8))}`);
  report.options[id]={triangles:model.triangles.length,lights:model.lights.length,unchangedExteriorAndUnrelatedObjects:true,routeSupportSamples:samples,footRadius:.22,heightTolerance:.24,routeSupport:true,routeLimit:'support at 0.12m samples, not complete collision or player experience approval'};
}
for(const id of ['current','a','b','c']){
  const file=path.join(here,'assets',`${id}.png`),meta=await sharp(file).metadata();
  assert.equal(meta.width,960);assert.equal(meta.height,640);
  report.outputs[`${id}.png`]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
const current=await sharp(path.join(here,'assets/current.png')).raw().toBuffer();
const accepted=await sharp(path.join(here,'../purification-last-light/assets/haven.png')).raw().toBuffer();
assert(current.equals(accepted),'Current comparison must exactly match the unchanged standing source image');
report.currentPixelExact=true;
for(const name of ['shared.ts','option-a.ts','option-b.ts','option-c.ts','export.mjs','viewer.js','viewer.css','index.html'])report.sources[name]=createHash('sha256').update(await fs.readFile(path.join(here,name))).digest('hex');
await fs.writeFile(path.join(here,'assets/check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.options));
console.log('Strict TS, source invariance, finite geometry, image dimensions and pixel-exact current baseline passed.');
