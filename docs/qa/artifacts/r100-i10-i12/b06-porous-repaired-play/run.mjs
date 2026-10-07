import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const base='docs/qa/artifacts/r100-i10-i12/b06-porous-repaired-play/';
assert(process.argv.includes('--exclusive-window'),'Launch only after the explicit Chrome handoff');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const receipt=file=>({path:file,sha256:sha(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const plan=read(base+'plan.json'),planReceipt=receipt(base+'plan.json');
const references=[planReceipt,plan.source,plan.qualificationPlan,plan.executionPlan,plan.originalPolicy,plan.originalAttempts,...plan.dependencies,...plan.sourceContinuity];
const verify=()=>{for(const r of references)assert.equal(sha(r.path),r.sha256,r.path);};
const noBrowser=()=>assert(!execFileSync('ps',['-axo','command='],{encoding:'utf8'}).split('\n').some(line=>/Google Chrome.*--headless|headless_shell/.test(line)),'Another QA browser still exists');
verify();noBrowser();assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'));
const reportPath=base+'execution.json';assert(!fs.existsSync(reportPath));
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),plan:planReceipt,source:plan.source,runner:receipt(base+'run.mjs'),stages:[]};
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');save();
try{
 for(const job of plan.jobs){
  verify();noBrowser();assert(!fs.existsSync(job.output));assert(!fs.existsSync(job.env.QA_WORKER_OBSERVER_FAILURE_FILE));
  const log=base+job.id+'.log',fd=fs.openSync(log,'wx'),start=Date.now();
  const env={...process.env,...job.env};for(const key of ['QA_CONTROLLED_BUILD','QA_REPRO_IDENTITY_FILE','QA_REPLAY_INPUTS','QA_ORDINAL_START'])delete env[key];
  const result=await new Promise((resolve,reject)=>{const child=spawn(job.command,job.args,{env,stdio:['ignore',fd,fd]});report.current=job.id;report.childPid=child.pid;save();child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
  fs.closeSync(fd);delete report.childPid;
  const stage={id:job.id,cases:job.cases,...result,elapsedSeconds:(Date.now()-start)/1000,log:receipt(log)};report.stages.push(stage);save();
  assert.equal(result.code,0,'Original failure retained; no subsequent batch or automatic retry');
  assert(!fs.existsSync(job.env.QA_WORKER_OBSERVER_FAILURE_FILE));
  const batch=read(job.output+'/batch-report.json');assert.equal(batch.attempts.length,job.cases);assert(!batch.stoppedAfterFailure);
  for(const[row,expected]of batch.attempts.map((row,i)=>[row,job.originalCases[i]])){
   assert.equal(row.exitCode,0);assert.equal(row.world,expected.world);assert.equal(row.grade,expected.grade);assert.equal(row.seed,expected.seed);
   assert.equal(row.journeys.length,1);assert.equal(row.journeys[0].status,'completed-real-input');
  }
  stage.batchReport=receipt(job.output+'/batch-report.json');verify();noBrowser();save();
 }
 report.status='completed-original11';delete report.current;report.finishedAt=new Date().toISOString();save();
}catch(error){report.status='failed';report.error=String(error.stack??error);report.finishedAt=new Date().toISOString();save();throw error;}
