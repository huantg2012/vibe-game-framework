/** Cooperative scheduling only: the running field is never paused or signalled. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const folder='docs/qa/artifacts/r100-i10-i12/b05-refined-qualified';
const pause='/tmp/coh-r100-i10-i12.pause',output=folder+'/between-case-guard.json';
const batchFile=folder+'/play/batch-report.json',policyFile=folder+'/play/policy-freeze.json';
const policy=JSON.parse(fs.readFileSync(policyFile));assert.equal(policy.resourcePauseFile,pause);assert.equal(policy.parallelism,1);
assert(!fs.existsSync(output));
const token=randomUUID(),owned=JSON.stringify({owner:'b05-between-case-guard',token,pid:process.pid});
const report={status:'running',startedAt:new Date().toISOString(),pid:process.pid,token,policy:{path:policyFile,sha256:createHash('sha256').update(fs.readFileSync(policyFile)).digest('hex')},method:'Reserve the existing cooperative pause file while a trip runs; only release after that trip completes successfully and the original coverage runner reports resourceWait, which occurs after its browser process closed. Failure holds the next-trip boundary. Foreign pause contents are never removed. No process signals or field clock/input changes.',events:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const owns=()=>fs.existsSync(pause)&&fs.readFileSync(pause,'utf8')===owned;
const remove=()=>{if(owns())fs.unlinkSync(pause);};
const event=(type,details={})=>{report.events.push({at:new Date().toISOString(),type,...details});save();};
let reserved=null,released=null;save();
try{
 for(;;){
  let batch;try{batch=JSON.parse(fs.readFileSync(batchFile,'utf8'));}catch(error){if(error instanceof SyntaxError){await new Promise(r=>setTimeout(r,100));continue;}throw error;}
  const failed=batch.attempts.find(row=>row.exitCode!==undefined&&row.exitCode!==0);
  if(failed){if(!fs.existsSync(pause))fs.writeFileSync(pause,owned,{flag:'wx'});report.status='failure-boundary-held';event('failed-case-retained',{index:failed.index,dir:failed.dir,exitCode:failed.exitCode});break;}
  if(batch.status!=='running'){remove();report.status='completed-original-batch';event('batch-ended',{status:batch.status,attempts:batch.attempts.length});break;}
  const current=batch.attempts.at(-1);
  if(current?.status==='running'&&current.index!==reserved){
   if(!fs.existsSync(pause)){fs.writeFileSync(pause,owned,{flag:'wx'});reserved=current.index;event('reserved-next-boundary',{current:current.index});}
  }
  if(current?.status==='completed-script'&&batch.resourceWait&&owns()&&current.index!==released){
   assert.equal(current.exitCode,0);assert(current.journeys?.length&&current.journeys.every(row=>row.matchesPlan&&!row.accountingError),'Do not release an identity/accounting failure');
   remove();released=current.index;event('released-after-closed-success',{index:current.index});
  }
  await new Promise(r=>setTimeout(r,200));
 }
}catch(error){report.status='guard-error-held';report.error=String(error.stack??error);if(!fs.existsSync(pause))fs.writeFileSync(pause,owned,{flag:'wx'});throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
