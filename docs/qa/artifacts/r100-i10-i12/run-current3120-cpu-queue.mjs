/** Serial continuation of the authorized CPU-only batches. No browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const receipt=file=>({path:file,sha256:hash(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const previous=base+'b08-current-qualified/generation-execution.json';
const initial=read(previous);assert(['running','pass'].includes(initial.status));
const stages=['b09-current-qualified','b10-current-qualified','b06-short-fibre-qualified'].map(folder=>({folder,runner:receipt(base+folder+'/run-generation.mjs'),commands:receipt(base+folder+'/commands.json')}));
const reportFile=base+'current3120-cpu-queue.json';assert(!fs.existsSync(reportFile));
const report={status:'waiting-for-original-B08',pid:process.pid,startedAt:new Date().toISOString(),predecessor:{path:previous,pid:initial.pid,runner:initial.runner,commands:initial.commands},stages,completed:[],limits:'Pure fixed generation only. Original B08 process is never restarted; every following batch awaits child close and a complete pass report. No browser, normal-view approval or actual-play result is created.'};
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
const verify=ref=>assert.equal(hash(ref.path),ref.sha256,ref.path);
save();
try{
 let prior;
 for(;;){prior=read(previous);assert.equal(prior.pid,initial.pid);assert.deepEqual(prior.runner,initial.runner);assert.deepEqual(prior.commands,initial.commands);verify(initial.runner);verify(initial.commands);if(prior.status!=='running')break;process.kill(initial.pid,0);await new Promise(r=>setTimeout(r,1000));}
 assert.equal(prior.status,'pass','Original B08 failure is retained and stops this continuation');
 assert.deepEqual(prior.stages.map(s=>[s.cases,s.exitCode]),[[480,0],[96,0]]);
 report.predecessor.completed=receipt(previous);save();
 for(const stage of stages){
  verify(stage.runner);verify(stage.commands);assert(!fs.existsSync(base+stage.folder+'/generation-execution.json'));
  report.status='running';report.current=stage.folder;save();
  const fd=fs.openSync(base+stage.folder+'/queue-launch.log','wx');
  const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[stage.runner.path],{stdio:['ignore',fd,fd]});report.childPid=child.pid;save();child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
  fs.closeSync(fd);delete report.childPid;assert.equal(result.code,0,`${stage.folder} failed; remaining batches will not start`);
  const file=base+stage.folder+'/generation-execution.json',done=read(file),commands=read(stage.commands.path);assert.equal(done.status,'pass');assert.deepEqual(done.stages.map(s=>[s.cases,s.exitCode]),commands.generation.map(s=>[s.cases,0]));
  verify(stage.runner);verify(stage.commands);report.completed.push({folder:stage.folder,execution:receipt(file)});save();
 }
 report.status='pass';delete report.current;report.finishedAt=new Date().toISOString();save();
}catch(error){report.status='failed';report.error=String(error.stack??error);report.finishedAt=new Date().toISOString();save();throw error;}
