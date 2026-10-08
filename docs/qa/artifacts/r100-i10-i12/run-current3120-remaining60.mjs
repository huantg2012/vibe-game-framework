import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/';
assert(process.argv.includes('--exclusive-window'),'Wait for the explicit art Chrome close/handoff');
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const read=file=>JSON.parse(fs.readFileSync(file));
const planFile=base+'current3120-remaining60-plan.json',planReceipt=ref(planFile),plan=read(planFile);
const anchors=[planReceipt,plan.source,...plan.stages.flatMap(x=>[x.runner,x.plan])];
const stable=()=>{for(const x of anchors)assert.equal(ref(x.path).sha256,x.sha256,x.path);};
const noBrowser=()=>{
 const rows=execFileSync('ps',['-axo','pid=,comm='],{encoding:'utf8'}).split('\n');
 for(const row of rows){const match=row.trim().match(/^(\d+)\s+(.+)$/);if(!match)continue;const executable=path.basename(match[2]);
  if(!['Google Chrome','headless_shell','chrome-headless-shell'].includes(executable))continue;
  const args=execFileSync('ps',['-p',match[1],'-o','command='],{encoding:'utf8'});
  assert(!(executable.includes('headless')||args.includes('--headless')),'Another QA Chrome still exists');
 }
};
const out=base+'current3120-remaining60.json';assert(!fs.existsSync(out));stable();noBrowser();
for(const stage of plan.stages)assert(!fs.existsSync(stage.output),'Do not restart a previous stage');
const previous=read(plan.predecessor.output);assert.equal(previous.status,plan.predecessor.status);assert.equal(previous.cases,plan.predecessor.cases);assert.deepEqual(previous.commands,plan.predecessor.commands);assert.equal(previous.exitCode,0);
const predecessorReceipt=ref(plan.predecessor.output);
const report={predecessor:predecessorReceipt,status:'running',pid:process.pid,startedAt:new Date().toISOString(),plan:planReceipt,runner:ref(base+'run-current3120-remaining60.mjs'),stages:[]};
const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');save();
try{
 for(const stage of plan.stages){
  stable();noBrowser();assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'),'Resource window has not been released');
  const log=base+stage.folder+'/play-queue-launch.log',fd=fs.openSync(log,'wx'),started=Date.now();
  report.current=stage.id;save();let childError;
  const result=await new Promise(resolve=>{const child=spawn(process.execPath,[stage.runner.path,...stage.args],{stdio:['ignore',fd,fd]});report.childPid=child.pid;save();child.once('error',e=>{childError=String(e.stack??e);});child.once('close',(code,signal)=>resolve({code,signal}));});
  fs.closeSync(fd);delete report.childPid;
  const row={id:stage.id,cases:stage.cases,...result,elapsedSeconds:(Date.now()-started)/1000,log:ref(log),...(childError?{childError}:{})};report.stages.push(row);save();
  assert(!childError);assert.equal(result.code,0,'Original failure retained; no later stage is launched');
  const evidence=read(stage.output);assert.equal(evidence.status,stage.completedStatus);row.execution=ref(stage.output);
  stable();noBrowser();save();
 }
 delete report.current;report.status='completed-original60';report.finishedAt=new Date().toISOString();save();
}catch(error){report.status='failed';report.error=String(error.stack??error);report.finishedAt=new Date().toISOString();save();throw error;}
