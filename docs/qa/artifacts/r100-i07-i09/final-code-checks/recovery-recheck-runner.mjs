import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const root='/Users/yilungao/coh',out=path.join(root,'docs/qa/artifacts/r100-i07-i09/final-code-checks');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(out,file),'utf8'));
fs.copyFileSync('/tmp/r100-final-code-recovery-recheck.mjs',path.join(out,'recovery-recheck-runner.mjs'),fs.constants.COPYFILE_EXCL);
fs.copyFileSync(path.join(root,'tools/recovery/check-native-generation-revision.ts'),path.join(out,'native-generation-after.ts'),fs.constants.COPYFILE_EXCL);
const report={status:'running',scope:'One authorized QA-only correction: future revision is current+1, and PASS copy names revision5. Preserve initial whole-suite failure; rerun failed item30 and previously unexecuted item31, without rerunning original29 passes.',startedAt:new Date().toISOString(),checks:[]};
const save=()=>fs.writeFileSync(path.join(out,'recovery-recheck-report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
 for(const name of ['native-generation-revision','generation-worker']){
  const file=`tools/recovery/check-${name}.ts`,args=['--import','tsx','--import','./tools/recovery/register-css.mjs',file];
  const inputs=[file,'tools/recovery/register-css.mjs','tools/contam-preview/tsconfig.json'];
  const row={name,command:[process.execPath,...args],sources:inputs.map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))})),startedAt:new Date().toISOString(),log:`12-${name}.log`};report.checks.push(row);save();console.log(`START ${name}`);
  const fd=fs.openSync(path.join(out,row.log),'wx');
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'},stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',(code,signal)=>{fs.closeSync(fd);row.exitCode=code;row.signal=signal;resolve();});});
  row.endedAt=new Date().toISOString();row.logSha256=hash(fs.readFileSync(path.join(out,row.log)));save();console.log(`END ${name} exit=${row.exitCode}`);assert.equal(row.exitCode,0,`${name} failed; preserve original`);
 }
 const before=read('source-before.json'),after=Object.fromEntries(Object.keys(before).map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
 fs.writeFileSync(path.join(out,'source-after.json'),JSON.stringify(after,null,2)+'\n',{flag:'wx'});
 const changed=Object.keys(before).filter(file=>before[file]!==after[file]);
 const runtimeChanges=changed.filter(file=>/^(?:src|data|public)\//.test(file));
 assert.deepEqual(runtimeChanges,['src/generated/r100-package-manifest.ts']);
 const first=read('report.json'),remaining=read('remaining-report.json');assert.equal(first.status,'failed');assert.equal(remaining.status,'pass');
 const script=fs.readFileSync(path.join(root,'tools/recovery/check.mjs'),'utf8');
 const cases=JSON.parse(script.match(/const checks = (\[[^;]+\]);/)[1].replaceAll("'",'"'));assert.equal(cases.length,31);assert.equal(cases[29],'native-generation-revision');assert.equal(cases[30],'generation-worker');
 const summary={status:'pass-after-QA-test-correction',scope:'Current52 disabled-candidate code checks. Original suite failure remains failed; recovery31 coverage aggregates29 original passes plus corrected item30 and first execution item31. No original world qualification samples rerun.',
  firstAttempt:{report:'report.json',suiteExitCode:1,failure:'stale QA negative case assigned current revision5 and expected rejection',passedRecoveryCases:cases.slice(0,29),failedCase:cases[29],notExecutedCase:cases[30]},
  correction:{productRuntimeChanged:false,test:'tools/recovery/check-native-generation-revision.ts',before:'native-generation-before.ts',after:'native-generation-after.ts',method:'future = current.package.algorithmRevision + 1; revision5 PASS copy'},
  recheck:'recovery-recheck-report.json',remaining:'remaining-report.json',recoveryUniquePassed:cases.length,candidate:first.candidate,materials:first.materialDependencies,
  changedSourceFiles:changed,runtimeChanges,sourceBefore:'source-before.json',sourceAfter:'source-after.json',allLogsPreserved:true,
  build:{exitCode:first.checks.find(c=>c.id==='02-build').exitCode,log:'02-build.log',warning:'Existing large-chunk build warning retained; not a performance verdict'},
  checks:[...first.checks, ...remaining.checks, ...report.checks]};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});report.status='pass';
}catch(error){report.status='failed';report.failure=String(error);process.exitCode=1;console.error(error);}
finally{report.endedAt=new Date().toISOString();save();}
