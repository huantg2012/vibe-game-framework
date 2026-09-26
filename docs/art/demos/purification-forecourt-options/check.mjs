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
  const {model,route,stop}= (await import(`./option-${id}.ts`)).buildOption();
  assert.deepEqual(model.lights.map(({position,...l})=>l),baseline.lights.map(({position,...l})=>l),'Source parameters must not drift');
  for(let i=0;i<baseline.triangles.length;i++)if(id!=='c'||baseline.triangles[i].object!==1)assert.deepEqual(model.triangles[i],baseline.triangles[i],`${id} modified an unrelated original triangle`);
  for(let i=0;i<baseline.lights.length;i++)if(id!=='c'||!baseline.lights[i].id.startsWith('core-'))assert.deepEqual(model.lights[i],baseline.lights[i],`${id} moved an unrelated light`);
  for(const t of model.triangles)assert([...t.a,...t.b,...t.c,...t.normal,t.tint].every(Number.isFinite));
  assert([...route.flat(),...stop].every(Number.isFinite));
  report.options[id]={triangles:model.triangles.length,added:model.triangles.length-baseline.triangles.length,lights:model.lights.length,originalUnrelatedObjectsUnchanged:true};
}
for(const id of ['current','a','b','c']){
  const file=path.join(here,'assets',`${id}.png`),meta=await sharp(file).metadata();
  assert.equal(meta.width,960);assert.equal(meta.height,640);
  report.outputs[`${id}.png`]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
const current=await sharp(path.join(here,'assets/current.png')).raw().toBuffer();
const accepted=await sharp(path.join(here,'../purification-last-light/assets/rest/haven.png')).raw().toBuffer();
assert(current.equals(accepted),'Current comparison must exactly match the accepted seated source image');
report.currentPixelExact=true;
for(const name of ['shared.ts','option-a.ts','option-b.ts','option-c.ts','export.mjs','viewer.js','viewer.css','index.html'])report.sources[name]=createHash('sha256').update(await fs.readFile(path.join(here,name))).digest('hex');
await fs.writeFile(path.join(here,'assets/check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.options));
console.log('Strict TS, source invariance, finite geometry, image dimensions and pixel-exact current baseline passed.');
