/** Source-only contracts for the specifically reviewed transport/material edge. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {assertReviewedStartupRepair,assertUnusedMaterialExtension,STARTUP_REPAIR_FILES,STARTUP_HELPER} from './r100-reviewed-startup-continuity.mjs';
const base='docs/qa/artifacts/r100-i10-i12',output=process.argv[2];
assert(output&&!fs.existsSync(output),'Require a new report path');
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({path:file,sha256:sha(fs.readFileSync(file))});
const beforePath=base+'/b14-source/source-snapshot.json',afterPath=base+'/p34-and-b09-b10-refined-source/source-snapshot.json';
const before=JSON.parse(fs.readFileSync(beforePath)),after=JSON.parse(fs.readFileSync(afterPath));
const read=(source,file)=>{const b=fs.readFileSync(path.join(source.temporaryRoot,file));assert.equal(sha(b),source.sources[file]);return b.toString();};
const files=[...Object.keys(STARTUP_REPAIR_FILES),'src/generation/rift-generation-protocol.ts','src/generation/rift-generation-worker.ts','src/systems/r100-world/surface-preparation.ts','src/systems/r100-world/surface-preparation-worker.ts','src/generated/r100-material-organizations.ts','src/generation/world-study/r100-world-appearance.ts'];
const old=Object.fromEntries(files.map(file=>[file,read(before,file)]));
const current=Object.fromEntries([...files,STARTUP_HELPER].map(file=>[file,read(after,file)]));
const review=JSON.parse(fs.readFileSync(base+'/worker-startup-retry/independent-pipeline-review.json'));
function literal(text,name){const ast=ts.createSourceFile('literal.ts',text,ts.ScriptTarget.Latest,true);for(const s of ast.statements)if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)if(d.name.getText(ast)===name){let n=d.initializer;while(ts.isAsExpression(n)||ts.isSatisfiesExpression(n))n=n.expression;return JSON.parse(n.getText(ast));}throw Error('Missing '+name);}
const transport=(a=old,b=current,r=review)=>assertReviewedStartupRepair({before:f=>a[f],after:f=>b[f],review:r});
const materials=(a=old,b=current,appearances=[{worldId:'fixture',materialOrganization:'porous-marrow'}])=>assertUnusedMaterialExtension({before:f=>a[f],after:f=>b[f],appearances,literal:(side,file,name)=>literal((side==='before'?a:b)[file],name)});
const checks=[],report={status:'running',before:receipt(beforePath),after:receipt(afterPath),tool:receipt('tools/qa/r100-reviewed-startup-continuity.mjs'),harness:receipt('tools/qa/check-r100-reviewed-startup-continuity.mjs'),checks,scope:'Real frozen repair text and negative source mutations, plus small public-gate metadata fixtures. No browser, map, RGBA or runtime performance execution.'};
try{
 report.transport=transport();checks.push('exact reviewed transport plus unchanged pure executors');
 report.materials=materials();checks.push('old organization definitions and unselected appended material');
 for(const[name,mutate]of[
  ['prior client gains arbitrary branch',(a)=>{a['src/generation/rift-generation-client.ts']+='\nthrow Error("changed");';}],
  ['new client widens retry',(a,b)=>{b['src/generation/rift-generation-client.ts']+='\nthrow Error("changed");';}],
  ['helper changes deadline',(a,b)=>{b[STARTUP_HELPER]=b[STARTUP_HELPER].replace('timeoutMs);','timeoutMs * 2);');}],
  ['pure generation hydration changes',(a,b)=>{b['src/generation/rift-generation-protocol.ts']+='\nMath.random();';}],
  ['surface execution changes',(a,b)=>{b['src/systems/r100-world/surface-preparation.ts']+='\nMath.random();';}],
  ['worker adds work after ack',(a,b)=>{b['src/generation/rift-generation-worker.ts']=b['src/generation/rift-generation-worker.ts'].replace('started: true });','started: true }); Math.random();');}],
  ['worker ack moved out of first statement',(a,b)=>{b['src/generation/rift-generation-worker.ts']=b['src/generation/rift-generation-worker.ts'].replace('try { worker.postMessage','try { Math.random(); worker.postMessage');}],
  ['review omits a source',(a,b,r)=>{r.reviewedSource.pop();}],
 ]){const a={...old},b={...current},r=structuredClone(review);mutate(a,b,r);assert(a!==old);assert.throws(()=>transport(a,b,r),undefined,name);checks.push(name);}
 for(const[name,mutate,selected]of[
  ['selected new material cannot inherit',()=>{},[{worldId:'fixture',materialOrganization:'short-fibre-loose'}]],
  ['old material source changed',(a,b)=>{b['src/generated/r100-material-organizations.ts']=b['src/generated/r100-material-organizations.ts'].replace('porous-marrow-ground-source.png','wrong.png');}],
  ['new generated table executes code',(a,b)=>{b['src/generated/r100-material-organizations.ts']+='\nMath.random();';}],
  ['appearance validator changed',(a,b)=>{b['src/generation/world-study/r100-world-appearance.ts']=b['src/generation/world-study/r100-world-appearance.ts'].replace('row.version !== 1','row.version !== 2');}],
  ['enum changes existing selection',(a,b)=>{b['src/generation/world-study/r100-world-appearance.ts']=b['src/generation/world-study/r100-world-appearance.ts'].replace("['short-fibre', 'porous-marrow', 'short-fibre-loose']","['short-fibre', 'different', 'short-fibre-loose']");}],
 ]){const a={...old},b={...current};mutate(a,b);assert.throws(()=>materials(a,b,selected),undefined,name);checks.push(name);}
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'coh-startup-source-contract-'));
 try{
  const val=(name,value)=>`export const ${name} = ${JSON.stringify(value)} as const;`;
  const world={id:'fixture',enabled:false,definitions:[{family:'tension-surface',instances:[{constructionVersion:3,shapeProfile:'pleated-sheet'}]}]};
  const common={'src/generated/r100-native-worlds.ts':val('R100_NATIVE_WORLDS',[world]),'src/generated/r100-world-appearance.ts':val('R100_WORLD_APPEARANCES',[{worldId:'fixture'}]),'src/generated/rift-search-remains.ts':val('SEARCH_REMAINS',[{worldId:'fixture',grammar:'same'}]),'src/generated/r100-package-manifest.ts':val('R100_MATERIAL_DEPENDENCIES',{'tension-surface':{definition:'same',surface:'same',solid:'same'}}),'src/other.ts':'export const same = 1;'};
  const candidate='src/generation/world-study/native-volume-compressed-felt.ts';
  const a={...common,...old,[candidate]:'export function unregistered() {}'};
  const b={...common,...current,...Object.fromEntries(report.materials.addedFiles.map(f=>[f,'unselected asset fixture']))};
  const snapshot=(label,entries)=>{const dir=path.join(temp,label),sources={};for(const[file,text]of Object.entries(entries)){const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);sources[file]=sha(text);}const p=path.join(dir,'source.json');fs.writeFileSync(p,JSON.stringify({temporaryRoot:dir,sources}));return p;};
  for(const[name,mutate,flag,success,error]of[
   ['public exact migration',()=>{},true,true],
   ['public mode required',()=>{},false,false,/Unreviewed runtime change/],
   ['extra retry consumer',(x,y)=>{y['src/other.ts']="import {requestWorker} from './utils/worker-request';";},true,false,/only be consumed/],
   ['removed candidate still referenced',(x,y)=>{x['src/other.ts']="const target = 'native-volume-compressed-felt';";},true,false,/still referenced/],
   ['unreviewed gameplay mutation',(x,y)=>{y['src/other.ts']='export const same = 2;';},true,false,/Unreviewed runtime change/],
   ['unexpected new source',(x,y)=>{y['src/new-runtime.ts']='export const value=1;';},true,false,/Unexpected new source/],
  ]){const x={...a},y={...b};mutate(x,y);const pa=snapshot(name+'-before',x),pb=snapshot(name+'-after',y),dest=path.join(temp,name+'.json');const args=['tools/qa/r100-source-continuity.mjs','--from',pa,'--to',pb,'--worlds','fixture','--output',dest];if(flag)args.push('--reviewed-startup-material-change');const r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status===0,success,`${name}: ${r.stderr}`);assert.equal(fs.existsSync(dest),success);if(error)assert.match(r.stderr,error);checks.push(name);}
  // The direct edge bypasses the intermediate unregistered candidate entirely.
  // Each proof must still check its own exact files; the addition sets are disjoint.
  const earlierPath=base+'/b12-source/source-snapshot.json',earlier=JSON.parse(fs.readFileSync(earlierPath));
  report.combinedEarlierSource=receipt(earlierPath);
  const combinedOld={...a},combinedNew={...b};delete combinedOld[candidate];
  for(const name of ['native-volume-expansion.ts','native-volume-ground.ts','native-volume-geometry.ts']){
   const f='src/generation/world-study/'+name;combinedOld[f]=read(earlier,f);combinedNew[f]=read(after,f);
  }
  for(const name of ['native-volume-pleated-tear.ts','native-volume-settled-sheet.ts']){
   const f='src/generation/world-study/'+name;combinedNew[f]=read(after,f);
  }
  for(const[name,mutate,success,error]of[
   ['combined disjoint proof sets',()=>{},true],
   ['combined selected new profile',(x,y)=>{for(const v of [x,y])v['src/generated/r100-native-worlds.ts']=v['src/generated/r100-native-worlds.ts'].replace('pleated-sheet','pleated-tear');},false,/Selected world uses/],
   ['combined unrelated runtime mutation',(x,y)=>{y['src/other.ts']='export const same = 2;';},false,/Unreviewed runtime change/],
   ['combined candidate cannot be added',(x,y)=>{y[candidate]='export function candidate() {}';},false,/Unexpected new source files/],
  ]){const x={...combinedOld},y={...combinedNew};mutate(x,y);const pa=snapshot(name+'-before',x),pb=snapshot(name+'-after',y),dest=path.join(temp,name+'.json');const r=spawnSync(process.execPath,['tools/qa/r100-source-continuity.mjs','--from',pa,'--to',pb,'--worlds','fixture','--unused-explicit-profiles','--reviewed-startup-material-change','--output',dest],{encoding:'utf8'});assert.equal(r.status===0,success,`${name}: ${r.stderr}`);assert.equal(fs.existsSync(dest),success);if(error)assert.match(r.stderr,error);checks.push(name);}
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 report.bindingTool=receipt('tools/qa/r100-source-continuity.mjs');report.status='pass';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(`${report.status}: ${checks.length} reviewed migration source contracts`);
