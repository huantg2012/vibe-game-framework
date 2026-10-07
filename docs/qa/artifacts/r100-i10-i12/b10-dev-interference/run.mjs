import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const folder='docs/qa/artifacts/r100-i10-i12/b10-dev-interference';
const read=p=>JSON.parse(fs.readFileSync(p));
const ref=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const planRef=ref(folder+'/plan.json'),plan=read(planRef.path);
const references=[planRef,plan.originalCommand,plan.originalFailure,plan.diagnosis,plan.source,...plan.references];
const verify=()=>{for(const item of references)assert.deepEqual(ref(item.path),item);};
const noBrowser=()=>{const rows=execFileSync('ps',['-axo','pid=,comm='],{encoding:'utf8'}).split('\n');for(const row of rows){const m=row.trim().match(/^(\d+)\s+(.+)$/);if(!m)continue;const executable=path.basename(m[2]);if(!['Google Chrome','headless_shell','chrome-headless-shell'].includes(executable))continue;const args=execFileSync('ps',['-p',m[1],'-o','command='],{encoding:'utf8'});assert(!(executable.includes('headless')||args.includes('--headless')),'QA browser still active');}};
verify();noBrowser();
const output=folder+'/execution.json';
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),plan:planRef,runner:ref(folder+'/run.mjs'),stages:[]};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
try {
  for(const stage of plan.stages){
    verify();noBrowser();assert(!fs.existsSync(stage.folder));assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'));
    fs.mkdirSync(stage.folder);const log=stage.folder+'/execution.log',fd=fs.openSync(log,'wx');
    report.current=stage.id;save();console.log('START '+stage.id);
    const env={...process.env,...stage.env};for(const key of ['QA_CONTROLLED_BUILD','QA_REPRO_IDENTITY_FILE','QA_REPLAY_INPUTS','QA_ORDINAL_START'])delete env[key];
    const result=await new Promise((resolve,reject)=>{const child=spawn(stage.command,stage.args,{env,stdio:['ignore',fd,fd]});report.childPid=child.pid;save();child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
    fs.closeSync(fd);delete report.childPid;const row={id:stage.id,...result,log:ref(log)};report.stages.push(row);save();
    assert.equal(result.code,0,'Keep failure; no later stage or automatic retry');
    const batchPath=stage.folder+'/play/batch-report.json',batch=read(batchPath);
    assert.equal(batch.status,'completed-fixed-attempts-pending-review');assert.equal(batch.attempts.length,stage.cases);assert(batch.attempts.every(x=>x.exitCode===0));assert(!batch.stoppedAfterFailure);assert(!fs.existsSync(stage.env.QA_WORKER_OBSERVER_FAILURE_FILE));
    row.batch=ref(batchPath);verify();noBrowser();save();console.log('END '+stage.id);
  }
  delete report.current;report.status='completed-recheck-and-original12';report.finishedAt=new Date().toISOString();save();
}catch(error){report.status='failed';report.error=String(error.stack??error);report.finishedAt=new Date().toISOString();save();throw error;}
