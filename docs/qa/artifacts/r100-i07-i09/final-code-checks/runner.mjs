import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const root='/Users/yilungao/coh', out=path.join(root,'docs/qa/artifacts/r100-i07-i09/final-code-checks');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const receipt=file=>({path:file,sha256:hash(fs.readFileSync(path.join(root,file)))});
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):entry.isFile()?[`${dir}/${entry.name}`]:[]);
const materialSuffix=text=>text.slice(text.indexOf('export const R100_MATERIAL_DEPENDENCIES:'));
const manifest='src/generated/r100-package-manifest.ts';
const original=fs.readFileSync(path.join(root,manifest),'utf8');
fs.writeFileSync(path.join(out,'package-manifest-before.ts'),original,{flag:'wx'});
const sourceFiles=[...['src','data','public'].flatMap(walk),...walk('tools').filter(file=>/\.(?:ts|mjs|js|json)$/.test(file)),
  'package.json','package-lock.json','tsconfig.json','vite.config.ts'].filter(file=>fs.existsSync(path.join(root,file))).sort();
const snapshot=()=>Object.fromEntries(sourceFiles.map(file=>[file,receipt(file).sha256]));
const originalSource=snapshot();
fs.writeFileSync(path.join(out,'source-before.json'),JSON.stringify(originalSource,null,2)+'\n',{flag:'wx'});
fs.copyFileSync('/tmp/r100-final-code-checks.mjs',path.join(out,'runner.mjs'),fs.constants.COPYFILE_EXCL);
const commands=[
 ['01-package-receipt','node',['tools/world-study/codegen-r100-packages.mjs'],['tools/world-study/codegen-r100-packages.mjs']],
 ['02-build','npm',['run','build'],['package.json','tsconfig.json','vite.config.ts']],
 ['03-rift-recovery','npm',['run','check:rift-recovery'],['package.json','tools/recovery/check.mjs',...walk('tools/recovery').filter(file=>/\.(?:ts|mjs)$/.test(file))]],
 ['04-world-history','node',['--import','tsx','tools/inventory/check-world-history.ts'],['tools/inventory/check-world-history.ts','tools/contam-preview/tsconfig.json']],
 ['05-save-migration','npm',['run','check:inventory-save'],['package.json','tools/inventory/check-save-migration.ts','tools/contam-preview/tsconfig.json']],
 ['06-world-selection','node',['--import','tsx','tools/world-study/check-r100-world-selection.ts','--out',path.join(out,'selection')],['tools/world-study/check-r100-world-selection.ts','tools/contam-preview/tsconfig.json']],
 ['07-worlds-codegen','node',['tools/world-study/codegen-r100-worlds.mjs','--check'],['tools/world-study/codegen-r100-worlds.mjs']],
 ['08-appearance-codegen','node',['--import','tsx','tools/world-study/codegen-r100-appearance.ts','--check'],['tools/world-study/codegen-r100-appearance.ts']],
 ['09-remains-codegen','node',['tools/world-study/generate-search-remains.mjs','--check'],['tools/world-study/generate-search-remains.mjs']],
 ['10-selection-codegen','node',['tools/world-study/codegen-r100-selection.mjs','--check'],['tools/world-study/codegen-r100-selection.mjs']],
 ['11-package-receipt-check','node',['tools/world-study/codegen-r100-packages.mjs','--check'],['tools/world-study/codegen-r100-packages.mjs']],
];
const report={status:'running',scope:'Current52 candidate source; original20 enabled, new32 disabled. Sequential build/recovery/history/migration/selection/codegen checks only. No browser, full world qualification or sampling replacement.',startedAt:new Date().toISOString(),node:process.version,
 runnerSha256:hash(fs.readFileSync('/tmp/r100-final-code-checks.mjs')),sourceBefore:'source-before.json',checks:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
 for(const [id,exe,args,inputs] of commands){
  const row={id,command:[exe,...args],environment:{TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'},startedAt:new Date().toISOString(),sources:inputs.filter(file=>fs.existsSync(path.join(root,file))).map(receipt),log:`${id}.log`};
  report.checks.push(row);save();console.log(`START ${id}`);
  const fd=fs.openSync(path.join(out,row.log),'wx');
  await new Promise((resolve,reject)=>{const child=spawn(exe,args,{cwd:root,env:{...process.env,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'},stdio:['ignore',fd,fd]});
   child.once('error',error=>{row.spawnError=String(error);reject(error);});child.once('close',(code,signal)=>{fs.closeSync(fd);row.exitCode=code;row.signal=signal;resolve();});});
  row.endedAt=new Date().toISOString();row.logSha256=hash(fs.readFileSync(path.join(out,row.log)));save();
  console.log(`END ${id} exit=${row.exitCode}`);assert.equal(row.exitCode,0,`${id} failed; original log retained`);
  if(id==='01-package-receipt'){
   const updated=fs.readFileSync(path.join(root,manifest),'utf8');assert.equal(materialSuffix(updated),materialSuffix(original),'Material dependency receipt must remain byte-identical');
   fs.writeFileSync(path.join(out,'package-manifest-after.ts'),updated,{flag:'wx'});
   report.materialDependencies={byteIdentical:true,sha256:hash(materialSuffix(updated)),beforeManifestSha256:hash(original),afterManifestSha256:hash(updated)};
   const candidate=fs.readFileSync(path.join(root,'data/rift-native-worlds.csv'),'utf8').trim().split(/\r?\n/).map(row=>row.split(','));const header=candidate.shift();const enabledAt=header.indexOf('enabled');
   report.candidate={worlds:candidate.length,enabled:candidate.filter(row=>row[enabledAt]==='true').length,disabled:candidate.filter(row=>row[enabledAt]==='false').length};
   assert.deepEqual(report.candidate,{worlds:52,enabled:20,disabled:32});save();
  }
 }
 const after=snapshot();fs.writeFileSync(path.join(out,'source-after.json'),JSON.stringify(after,null,2)+'\n',{flag:'wx'});
 report.changedSourceFiles=Object.keys(originalSource).filter(file=>originalSource[file]!==after[file]);
 assert.deepEqual(report.changedSourceFiles,[manifest],'Only the authorized package receipt may change during checks');
 report.status='pass';
}catch(error){report.status='failed';report.failure=String(error);process.exitCode=1;console.error(error);}
finally{report.endedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,report:path.join(out,'report.json')}));}
