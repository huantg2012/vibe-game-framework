import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const out='docs/qa/artifacts/r100-i10-i12/b04-three-qualified';
const commandPath=out+'/commands.json',bytes=fs.readFileSync(commandPath),commands=JSON.parse(bytes);
const sha=b=>createHash('sha256').update(b).digest('hex');
const verify=()=>{assert(fs.readFileSync(commandPath).equals(bytes));for(const r of [commands.source,commands.executor,commands.qualificationPlan,commands.rootReview,commands.originalPreparation])assert.equal(sha(fs.readFileSync(r.path)),r.sha256,r.path);const source=JSON.parse(fs.readFileSync(commands.source.path));for(const [f,h]of Object.entries(source.sources))assert.equal(sha(fs.readFileSync(path.join(source.temporaryRoot,f))),h,f);};
const reportPath=out+'/generation-execution.json';assert(!fs.existsSync(reportPath));
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),runner:{path:out+'/run-generation.mjs',sha256:sha(fs.readFileSync(out+'/run-generation.mjs'))},commands:{path:commandPath,sha256:sha(bytes)},source:commands.source,worlds:commands.worlds,wholeBatchReady:false,stages:[]};
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const child=(command,args,log)=>new Promise((resolve,reject)=>{const fd=fs.openSync(log,'wx');const task=spawn(command,args,{stdio:['ignore',fd,fd]});report.childPid=task.pid;save();let launchError;task.once('error',e=>{launchError=e;});task.once('close',(code,signal)=>{fs.closeSync(fd);delete report.childPid;if(launchError)reject(launchError);else resolve({code,signal});});});
try{verify();save();for(const [i,step]of commands.generation.entries()){verify();const stage=i?'holdout':'full',log=out+`/generation-${stage}.log`,start=Date.now();assert(!fs.existsSync(path.dirname(step.args.at(-1))));const result=await child(step.command,step.args,log);report.stages.push({stage,cases:step.cases,exitCode:result.code,signal:result.signal,elapsedSeconds:(Date.now()-start)/1000,log,logSha256:sha(fs.readFileSync(log))});save();assert.equal(result.code,0,`Original ${stage} failure retained; do not continue`);const rows=fs.readFileSync(out+`/generation-${stage}/cases.jsonl`,'utf8').trim().split('\n').map(JSON.parse);assert.equal(rows.length,step.cases);assert(rows.every(r=>r.ok===true));console.log(`${stage}: ${rows.length}/${step.cases} pass`);}verify();report.status='pass';report.finishedAt=new Date().toISOString();save();console.log('B04 three-world original432 complete');}catch(e){report.status='failed';report.error=String(e.stack??e);save();throw e;}
