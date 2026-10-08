import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
import {buildGenerationSummary} from '../../../../../tools/qa/r100-qualification-summary.mjs';
const base='docs/qa/artifacts/r100-i10-i12/',read=p=>JSON.parse(fs.readFileSync(p));
const ref=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const planPath=base+'current3121-generation/base-batches-plan.json',plan=read(planPath);
const rootFiles=['late-low-surfaces-refined-medium/independent-review.json','late-low-surfaces-refined-grades/independent-review.json','b11-current-medium/independent-review.json','b12-current-medium/independent-review.json','b14-current-medium/independent-review.json','late-passed-grades/independent-review.json','earlier-passed-grades/independent-review.json'];
const reviews=rootFiles.map(file=>({reference:ref(base+file),value:read(base+file)}));
assert(reviews.every(x=>x.value.reviewer==='root'));
const currentGrade=reviews[1];assert.equal(currentGrade.value.status,'bounded-independent-art-pass');assert.deepEqual(currentGrade.value.sourceManifest,plan.source);
const authorFiles=['late-low-surfaces-refined-medium/author-art-review.json','late-low-surfaces-refined-grades/author-art-review.json'];
const authors=authorFiles.map(file=>({reference:ref(base+file),value:read(base+file)}));
for(const author of authors){assert(author.value.status.includes('pass'));assert.deepEqual(author.value.sourceManifest,plan.source);assert.equal(author.value.machineResult.errors.length,0);assert.equal(author.value.machineResult.browserClosed,true);}
assert.equal(authors[1].value.machineResult.completedCases,22);
const specialFile=base+'ochre-near-tear-medium/independent-review.json',special=read(specialFile);assert.equal(special.reviewer,'root');assert.equal(special.status,'bounded-independent-visual-pass');
const bridgeFile=base+'old52-r6-inheritance/current3120-to3121-unselected97-binding-fix.json',bridge=read(bridgeFile);assert.equal(bridge.status,'pass');assert.deepEqual(bridge.after,plan.source);
const proofFile=base+'qa-tool-contract/settled-projection-binding-fix-execution.json';assert.equal(read(proofFile).status,'pass');
const references=[ref(planPath),plan.source,plan.executor,plan.qualificationPlan,...reviews.map(x=>x.reference),...authors.map(x=>x.reference),ref(specialFile),ref(bridgeFile),ref(proofFile)];
const stable=()=>{for(const r of references)assert.deepEqual(ref(r.path),r,r.path);};stable();
const stages=[];
for(const stage of plan.stages){
 assert.deepEqual(ref(stage.template.path),stage.template);assert.deepEqual(ref(stage.runner.path),stage.runner);
 const folder=path.dirname(stage.template.path),admitted=[];
 for(const worldId of stage.worlds)for(const grade of ['low','medium','severe']){
  const matches=reviews.flatMap(({reference,value})=>(value.worlds??[]).filter(x=>x.worldId===worldId&&(x.grade??'medium')===grade&&x.status==='bounded-independent-art-pass').map(x=>({review:reference,source:value.sourceManifest,status:x.status})));
  if(worldId==='ochre-folds'&&grade==='medium')matches.push({review:ref(specialFile),source:special.sourceManifest,status:special.status});
  assert.equal(matches.length,1,`One passing original conclusion ${worldId}/${grade}`);
  if(matches[0].source.sha256!==plan.source.sha256)assert(bridge.worlds.some(x=>x.worldId===worldId),'Changed world requires current source images');
  admitted.push({worldId,grade,...matches[0]});
 }
 const admission={status:'bounded-normal-ready-for-generation',source:plan.source,worlds:stage.worlds,admitted,authorReceipts:authors.map(x=>x.reference),unchangedWorldBridge:ref(bridgeFile),scope:'The referenced authors/root reviews are limited normal-frame conclusions; no actual play, final enabled entry, performance, human or audio approval is created.'};
 write(stage.requiredAdmission,admission);
 const commands=read(stage.template.path);commands.status='authorized-original-base48';commands.rootReview=ref(stage.requiredAdmission);commands.additionalReceipts=references;
 write(folder+'/commands.json',commands);stages.push({...stage,commands:ref(folder+'/commands.json'),summaryPlan:ref(folder+'/generation-summary-plan.json'),output:folder+'/generation-execution.json',summary:folder+'/generation-summary.json'});
}
const output=base+'current3121-generation/base-execution.json';assert(!fs.existsSync(output));
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),plan:ref(planPath),runner:ref(base+'current3121-generation/run-base-batches.mjs'),source:plan.source,stages:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');save();
try{for(const stage of stages){stable();const folder=path.dirname(stage.output),log=folder+'/queue-launch.log',fd=fs.openSync(log,'wx');report.current=stage.batch;save();let spawnError;
 const start=Date.now(),result=await new Promise(resolve=>{const child=spawn(process.execPath,[stage.runner.path],{stdio:['ignore',fd,fd]});report.childPid=child.pid;save();child.once('error',e=>{spawnError=String(e.stack??e);});child.once('close',(code,signal)=>resolve({code,signal}));});
 fs.closeSync(fd);delete report.childPid;const row={batch:stage.batch,...result,elapsedSeconds:(Date.now()-start)/1000,log:ref(log),...(spawnError?{spawnError}:{})};report.stages.push(row);save();assert(!spawnError);assert.equal(result.code,0,'Original failed stage retained; do not launch later batches');
 const resultReport=read(stage.output);assert.equal(resultReport.status,'pass');const summary=buildGenerationSummary(stage.summaryPlan.path);assert.equal(summary.status,'pass');assert.equal(summary.expectedCases,576);assert.equal(summary.successful,576);write(stage.summary,summary);row.execution=ref(stage.output);row.summary=ref(stage.summary);stable();save();console.log(stage.batch,'576/576 original base48 pass');
 }report.status='passed';delete report.current;report.finishedAt=new Date().toISOString();save();}catch(error){report.status='failed';report.error=String(error.stack??error);save();throw error;}
