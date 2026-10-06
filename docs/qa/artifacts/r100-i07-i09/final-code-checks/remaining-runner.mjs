import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const root='/Users/yilungao/coh',out=path.join(root,'docs/qa/artifacts/r100-i07-i09/final-code-checks');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const commands=[
 ['04-world-history','node',['--import','tsx','tools/inventory/check-world-history.ts']],
 ['05-save-migration','npm',['run','check:inventory-save']],
 ['06-world-selection','node',['--import','tsx','tools/world-study/check-r100-world-selection.ts','--out',path.join(out,'selection')]],
 ['07-worlds-codegen','node',['tools/world-study/codegen-r100-worlds.mjs','--check']],
 ['08-appearance-codegen','node',['--import','tsx','tools/world-study/codegen-r100-appearance.ts','--check']],
 ['09-remains-codegen','node',['tools/world-study/generate-search-remains.mjs','--check']],
 ['10-selection-codegen','node',['tools/world-study/codegen-r100-selection.mjs','--check']],
 ['11-package-receipt-check','node',['tools/world-study/codegen-r100-packages.mjs','--check']],
];
fs.copyFileSync('/tmp/r100-final-code-remaining.mjs',path.join(out,'remaining-runner.mjs'),fs.constants.COPYFILE_EXCL);
const report={status:'running',scope:'Independent remaining checks after preserved stale future-revision negative test failure. No failure erased, no product changes.',original:'report.json',startedAt:new Date().toISOString(),checks:[]};
const save=()=>fs.writeFileSync(path.join(out,'remaining-report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
 for(const[id,exe,args]of commands){
  const inputs=[...args.filter(a=>/\.(?:ts|mjs)$/.test(a)),'package.json','tools/contam-preview/tsconfig.json'];
  if(id==='05-save-migration')inputs.push('tools/inventory/check-save-migration.ts');
  const row={id,command:[exe,...args],environment:{TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'},sources:inputs.map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(root,file)))})),startedAt:new Date().toISOString(),log:`${id}.log`};
  report.checks.push(row);save();console.log(`START ${id}`);const fd=fs.openSync(path.join(out,row.log),'wx');
  await new Promise((resolve,reject)=>{const child=spawn(exe,args,{cwd:root,env:{...process.env,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',(code,signal)=>{fs.closeSync(fd);row.exitCode=code;row.signal=signal;resolve();});});
  row.endedAt=new Date().toISOString();row.logSha256=hash(fs.readFileSync(path.join(out,row.log)));save();console.log(`END ${id} exit=${row.exitCode}`);assert.equal(row.exitCode,0,`${id} failed; retain original log`);
 }
 report.status='pass';
}catch(error){report.status='failed';report.failure=String(error);process.exitCode=1;console.error(error);}
finally{report.endedAt=new Date().toISOString();save();}
