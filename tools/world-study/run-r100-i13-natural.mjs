/** I13 natural continuation version: retain initial service targets before growth.
 * Derives the QA controller without changing production code or prior paired evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const root=path.resolve('docs/qa/artifacts/r100-i13');
const basePlanPath=path.join(root,'policy-freeze.json');
const planPath=path.join(root,'natural-policy-freeze-v2.json');
const sourcePath='tools/world-study/r100-i13-journey.mjs';
const targetPath='tools/world-study/r100-i13-natural-journey.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=file=>hash(fs.readFileSync(file));
const base=read(basePlanPath);
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planPath),'Natural plan already frozen');
 assert.equal(sha(sourcePath),base.dependencies.find(x=>x.file===sourcePath).sha256);
 let source=fs.readFileSync(sourcePath,'utf8');
 const targets=Object.fromEntries(base.initialModules.map(module=>[module.type,Math.min(100,module.hp)]));
 const before="for(const type of ['PURIFIER','CORE','STORAGE']){const m=current.modules.find(m=>m.type===type);if(m.hp<50)await repair(m,50);}";
 const after="const serviceTargets="+JSON.stringify(targets)+";\n  for(const type of ['PURIFIER','CORE','STORAGE']){const m=current.modules.find(m=>m.type===type);if(m.hp<serviceTargets[type])await repair(m,serviceTargets[type]);}";
 assert.equal(source.split(before).length,2);source=source.replace(before,after);
 const canGrow='if(current.modules.every(m=>m.hp>=50)&&current.kindlingReserve>receipt.management.investmentReserve){';
 assert.equal(source.split(canGrow).length,2);source=source.replace(canGrow,'if(current.modules.every(m=>m.hp>=serviceTargets[m.type])&&current.kindlingReserve>receipt.management.investmentReserve){');
 const description="managementPolicy:'Keep core/purifier/storage at least 50, pay currently public growth with 2 kindling retained before storage100; afterward keep a recent actual maintenance reserve and invest current nodes. No unseen future item or growth reads.'";
 assert.equal(source.split(description).length,2);source=source.replace(description,"managementPolicy:'Pay actual repairs toward earned entry service targets CORE51/PURIFIER51/STORAGE100 before growth. Only then invest publicly available growth with actual maintenance reserve. Funds or tools are never granted.'");
 const admissionAnchor="    await page.locator(`[data-departure-grade=\"${grade}\"]`).click();";
 const admission=`    if(schedule[ordinal-ordinalStart]==='severe'){
      const owned=await ownedForPreparation(),equipped=new Set(owned.equipment.toolIds.filter(Boolean));
      const tools=preparation.active.map(name=>{const item=owned.items.find(item=>item.name===name&&equipped.has(item.id)&&item.canEquip);return{name,id:item?.id??null,uses:item?.usesRemaining??0};});
      const moduleFacts=receipt.before.state.modules.map(m=>({type:m.type,hp:m.hp,required:Math.min(100,initialSave.modules.find(a=>a.type===m.type).hp)}));
      const eligible=tools.every(item=>item.uses>=1)&&moduleFacts.every(m=>m.hp>=m.required);
      receipt.gradeDecision={plannedGrade:grade,actualGrade:eligible?grade:'low',eligible,tools,moduleFacts,reason:eligible?'Declared two-function natural preparation available':'Insufficient declared preparation or service capital; actual low recovery, not severe completion'};
      if(!eligible)grade='low';receipt.grade=grade;
    }
`+admissionAnchor;
 assert.equal(source.split(admissionAnchor).length,2);source=source.replace(admissionAnchor,admission);
 source='// Natural maintenance version: fixed earned service targets before growth; paired source remains unchanged.\n'+source;
 fs.writeFileSync(targetPath,source);
 const plan={version:2,supersedesUnexecutedPlan:path.join(root,'natural-policy-freeze.json'),admission:'Requested severe requires both equipped declared active tools with at least one use and service targets met; otherwise actual low, never counted severe',createdAt:new Date().toISOString(),basePlan:basePlanPath,basePlanSha256:sha(basePlanPath),sourceController:{file:sourcePath,sha256:sha(sourcePath)},controller:{file:targetPath,sha256:sha(targetPath)},operator:{file:'tools/world-study/run-r100-i13-natural.mjs',sha256:sha('tools/world-study/run-r100-i13-natural.mjs')},serviceTargets:targets,cases:base.cases.filter(row=>row.batch==='natural'),totalAttempts:12,changes:['Actual repair target changes from QA floor50 to initial usable service floor51/100/51; growth waits for all targets.','All route, timing, visibility, actual-item selection and settlement logic match paired I13 controller.'],limitations:['Same earned ancestor, two disclosed branches; no population or causal claim.','Underfunded repairs retain actual loss; this does not guarantee sustainability.','Declared preparation shortages stay empty; no resetting after loss.']};
 fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n');console.log('Frozen natural controller: service targets '+JSON.stringify(targets));process.exit(0);
}
assert(process.argv.includes('--run'),'Use --freeze or --run');
const plan=read(planPath);assert.equal(sha(basePlanPath),plan.basePlanSha256);
for(const row of [plan.sourceController,plan.controller,plan.operator])assert.equal(sha(row.file),row.sha256);
assert.equal(sha(base.mappedStorage),base.mappedStorageSha256);
const executionPath=path.join(root,'execution-natural-service.json');assert(!fs.existsSync(executionPath),'Preserve original attempt; no implicit retry');
const execution={startedAt:new Date().toISOString(),planSha256:sha(planPath),status:'running',cases:plan.cases.map(row=>({...row,status:'pending'}))};
const write=()=>fs.writeFileSync(executionPath,JSON.stringify(execution,null,2)+'\n');write();
await Promise.all(execution.cases.map(async row=>{
 const folder=path.join(root,row.id);assert(!fs.existsSync(folder));fs.mkdirSync(folder,{recursive:true});
 row.status='running';row.startedAt=new Date().toISOString();write();const fd=fs.openSync(path.join(folder,'process.log'),'wx');
 const env={...process.env,GAME_URL:base.gameUrl,QA_OUTPUT_DIR:folder,QA_STORAGE_STATE:base.mappedStorage,QA_GRADES:'i13',QA_RUNS:String(row.schedule.length),QA_I13_SCHEDULE:JSON.stringify(row.schedule),QA_I13_PREPARATION:JSON.stringify(row.preparation),QA_SEARCH_LIMIT:String(base.searchLimit),QA_POST_RETURN_MANAGEMENT:'1',QA_ENTRY_WAIT:'600',QA_ORDINAL_START:'1',QA_WORLD_ID:'',QA_SEED:'',QA_CONTROLLED_BUILD:'',QA_REPRO_IDENTITY_FILE:'',QA_REPLAY_INPUTS:'',TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'};
 try{row.exitCode=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',plan.controller.file],{env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',resolve);});}catch(error){row.exitCode=-1;row.error=String(error);}finally{fs.closeSync(fd);}
 const reportFile=path.join(folder,'report.json'),report=fs.existsSync(reportFile)?read(reportFile):null;row.report=reportFile;row.completed=report?.realJourneyAttempts.filter(r=>r.status==='completed-real-input').length??0;row.status=row.exitCode===0&&row.completed===row.schedule.length?'completed':'failed';row.finishedAt=new Date().toISOString();write();console.log(row.id,row.status,row.completed+'/'+row.schedule.length);
}));
execution.status=execution.cases.every(row=>row.status==='completed')?'completed':'has-failures';execution.finishedAt=new Date().toISOString();write();if(execution.status!=='completed')process.exitCode=1;
