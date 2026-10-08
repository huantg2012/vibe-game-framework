import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/';
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const read=file=>JSON.parse(fs.readFileSync(file));
const input=read(base+'current3121-generation/preparation/commands.json');
const policy=read(input.qualificationPlan.path);assert.equal(policy.status,'frozen');
const stages=['I11','I12'].map(stage=>{
 const folder=base+'expanded-holdout-'+stage.toLowerCase();
 const summary=read(folder+'/summary-plan.json');assert.equal(summary.seedPolicy.stage,stage);assert.equal(summary.groups.length,1);
 const worlds=summary.worlds,cases=worlds.length*3*8;assert.equal(cases,stage==='I11'?2208:384);
 assert.deepEqual(summary.seedPolicy.qualificationPlan,input.qualificationPlan);
 return {stage,cases,worlds,summaryPlan:ref(folder+'/summary-plan.json'),output:folder+'/generation',summaryOutput:folder+'/summary.json',
  command:process.execPath,args:[input.executor.path,'--executor',input.executor.path,'--worlds',worlds.join(','),'--concurrency','1','--compact-report','--holdout',policy.generation.expandedHoldout.path,'--report',folder+'/generation/report.json']};
});
const plan={schemaVersion:1,status:'authorized-expanded-holdout-only',source:input.source,executor:input.executor,
 qualificationPlan:input.qualificationPlan,expandedSeeds:ref(policy.generation.expandedHoldout.path),preparation:ref(base+'current3121-generation/preparation/source-snapshot.json'),
 summaryTool:ref('tools/qa/r100-qualification-summary.mjs'),stages,
 authorization:'Root authorizes the frozen3121 CPU sequence I11 92×3×additional8 then I12 last16×3×additional8. Original qualification-plan seed file is unchanged. Single heavy CPU alongside one nonperformance Chrome. No base48, normal-view, actual-play or final runtime approval is inherited by this run.',
 deferred:'B11–B14 base48 will run separately only after repaired normal-view approval; final production pool stays disabled until all admission gates pass.'};
const file=base+'current3121-generation/expanded-plan.json';assert(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');
