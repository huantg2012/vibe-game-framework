import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {validateExpansionExecutionPlan} from '../../../../../tools/qa/check-r100-expansion-plan.mjs';

const folder='docs/qa/artifacts/r100-i10-i12/b04-raised-qualified';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=file=>({path:file,sha256:hash(fs.readFileSync(file))});
const read=file=>JSON.parse(fs.readFileSync(file));
const commandsPath=folder+'/preparation/commands.json',readinessPath=folder+'/readiness.json';
const commands=read(commandsPath),ready=read(readinessPath);
assert.equal(ready.status,'ready-for-fixed-qualification');assert.deepEqual(ready.source,commands.source);
const references=[commands.source,commands.qualificationPlan,ready.executionPlan,...ready.rootReviews,...ready.unaffectedWorldContinuity];
const verify=()=>{for(const ref of references)assert.equal(receipt(ref.path).sha256,ref.sha256,ref.path);};
verify();validateExpansionExecutionPlan(read(ready.executionPlan.path),{batch:'B04'});
assert.deepEqual(commands.play.env.QA_WORLDS.split(','),commands.worlds);assert.equal(commands.play.cases,24);
assert.equal(commands.play.env.QA_CONCURRENCY,'1');assert(!fs.existsSync(folder+'/play'));
const reportPath=folder+'/play-execution.json',log=folder+'/play-execution.log';
assert(!fs.existsSync(reportPath));assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'),'Resolve the existing resource handoff first');
const report={status:'running',pid:process.pid,source:commands.source,readiness:receipt(readinessPath),commands:receipt(commandsPath),runner:receipt(folder+'/run-play.mjs'),startedAt:new Date().toISOString(),cases:24,log,method:'Original two-seed real keyboard controller on3110; one browser; resource pause only between complete trips.'};
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
save();const fd=fs.openSync(log,'wx'),began=Date.now();
try{
 const result=await new Promise((resolve,reject)=>{const child=spawn(commands.play.command,commands.play.args,{env:{...process.env,...commands.play.env},stdio:['ignore',fd,fd]});report.childPid=child.pid;save();let launchError;child.once('error',error=>{launchError=error;});child.once('close',(code,signal)=>launchError?reject(launchError):resolve({code,signal}));});
 fs.closeSync(fd);report.exitCode=result.code;report.signal=result.signal;report.elapsedSeconds=(Date.now()-began)/1000;report.logSha256=receipt(log).sha256;report.finishedAt=new Date().toISOString();delete report.childPid;
 verify();assert.equal(result.code,0,'Original failure retained; no automatic seed retry');const batch=read(folder+'/play/batch-report.json');assert.equal(batch.attempts.length,24);assert(batch.attempts.every(row=>row.exitCode===0));
 report.status='completed-script';save();console.log(JSON.stringify({status:report.status,code:result.code,elapsedSeconds:report.elapsedSeconds}));
}catch(error){try{fs.closeSync(fd);}catch{}report.status='failed';report.error=String(error.stack??error);save();throw error;}
