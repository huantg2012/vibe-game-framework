// A scheduling receipt only. The existing final96 runner owns all launch guards.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
const base='docs/qa/artifacts/r100-i10-i12/';
const ref=path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
const read=path=>JSON.parse(fs.readFileSync(path));
const predecessor=base+'current3120-remaining60.json';
const runner=ref(base+'run-current3121-final96.mjs');
const plan=ref(base+'current3121-final96-plan.json');
const chain=read(plan.path).chainPredecessor;
const output=base+'continuation-after-current60.json';
const report={status:'waiting-for-current60',startedAt:new Date().toISOString(),pid:process.pid,runner,plan,predecessor};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
try {
  for (;;) {
    const previous=read(predecessor);
    assert.deepEqual(previous.plan,chain.plan,'Predecessor plan changed');
    if(previous.status===chain.status) {
      assert.deepEqual(previous.stages.map(row=>row.id),chain.stages);
      assert(previous.stages.every(row=>row.code===0));
      report.predecessor=ref(predecessor); break;
    }
    assert.equal(previous.status,'running','Previous failure is preserved; do not advance');
    const command=execFileSync('ps',['-p',String(previous.pid),'-o','command='],{encoding:'utf8'});
    assert(command.includes('run-current3120-remaining60.mjs --exclusive-window'),'Original predecessor is not active');
    await new Promise(resolve=>setTimeout(resolve,15000));
  }
  assert.deepEqual(ref(runner.path),runner);
  assert.deepEqual(ref(plan.path),plan);
  report.status='running-original-final96';save();
  console.log('Current60 complete; starting the existing guarded final96 runner.');
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[runner.path,'--exclusive-window'],{stdio:'inherit'});
    report.childPid=child.pid;save();child.once('error',reject);child.once('close',resolve);
  });
  delete report.childPid;report.exitCode=code;assert.equal(code,0);
  report.final96=ref(base+'current3121-final96.json');
  assert.equal(read(report.final96.path).status,'completed-original96');
  report.status='complete-before-enable';report.finishedAt=new Date().toISOString();save();
  console.log('Final96 complete. Activation and all final runtime gates remain pending.');
} catch(error) {
  report.status='failed';report.error=String(error.stack??error);report.finishedAt=new Date().toISOString();save();throw error;
}
