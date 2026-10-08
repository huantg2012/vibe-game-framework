import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/current3121-generation/';
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const read=file=>JSON.parse(fs.readFileSync(file));
const planPath=base+'expanded-plan.json',plan=read(planPath),planReceipt=ref(planPath);
const refs=[planReceipt,plan.source,plan.executor,plan.qualificationPlan,plan.expandedSeeds,plan.preparation,plan.summaryTool,...plan.stages.map(x=>x.summaryPlan)];
const source=read(plan.source.path);
const verify=()=>{for(const r of refs)assert.equal(ref(r.path).sha256,r.sha256,r.path);for(const[file,sha]of Object.entries(source.sources))assert.equal(ref(path.join(source.temporaryRoot,file)).sha256,sha,file);};
const run=async(command,args,log)=>{
 const fd=fs.openSync(log,'wx');let error;const start=Date.now();
 const result=await new Promise(resolve=>{const child=spawn(command,args,{stdio:['ignore',fd,fd]});report.childPid=child.pid;save();child.once('error',e=>{error=String(e.stack??e);});child.once('close',(code,signal)=>resolve({code,signal}));});
 fs.closeSync(fd);delete report.childPid;return {...result,...(error?{error}:{}),elapsedSeconds:(Date.now()-start)/1000,log:ref(log)};
};
verify();for(const s of plan.stages){assert(!fs.existsSync(s.output));assert(!fs.existsSync(s.summaryOutput));}
const output=base+'expanded-execution.json';assert(!fs.existsSync(output));
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),plan:planReceipt,runner:ref(base+'run-expanded.mjs'),source:plan.source,executor:plan.executor,stages:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');save();
try{
 for(const stage of plan.stages){
  verify();report.current=stage.stage;save();
  const result=await run(stage.command,stage.args,base+stage.stage.toLowerCase()+'.log');
  const row={stage:stage.stage,cases:stage.cases,...result};report.stages.push(row);save();
  assert(!result.error);assert.equal(result.code,0,'Preserve the complete failed attempt; no automatic retry or next stage');
  verify();
  const aggregated=await run(process.execPath,[plan.summaryTool.path,'--plan',stage.summaryPlan.path,'--output',stage.summaryOutput],base+stage.stage.toLowerCase()+'-summary.log');
  row.aggregation=aggregated;save();assert.equal(aggregated.code,0);
  const summary=read(stage.summaryOutput);assert.equal(summary.status,'pass');assert.equal(summary.uniqueCases,stage.cases);assert.equal(summary.successful,stage.cases);assert.equal(summary.attempts,stage.cases);
  row.summary=ref(stage.summaryOutput);save();
 }
 verify();delete report.current;report.status='pass-additional2592';report.finishedAt=new Date().toISOString();save();
}catch(error){report.status='failed';report.error=String(error.stack??error);report.finishedAt=new Date().toISOString();save();throw error;}
