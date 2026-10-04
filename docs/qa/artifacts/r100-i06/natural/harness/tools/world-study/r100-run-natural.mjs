/** Three independent real starting saves, 30 consecutive outings each.
 * No mature-gear/resource/world/clock grants. Visible owned tools are prepared
 * and consumed; offering and repairs are actual UI actions. Full-map routing
 * is disclosed and cannot establish novice decision quality or game balance.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i06/natural');fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),sourceSnapshot:process.env.QA_SOURCE_SNAPSHOT??null,
 method:'Three isolated new records, 30 real-input returns each; read-only whole-map routing, no seed or resource injection, no resets after loss. Repair target 70; owned mature tools chosen from public projection; immature supply actually offered. Grade selection depends on actual equipped usable tools, reserve, module HP and post-death recovery, not fixed grade quotas. No growth purchases and no melee optimization; these limits matter for economic interpretation.',
 policies:['conservative','gradual','repeat-risk'].map(policy=>({policy,status:'pending',requiredReturns:30})),status:'running'};
const write=()=>fs.writeFileSync(path.join(out,'natural-report.json'),JSON.stringify(report,null,2));write();
await Promise.all(report.policies.map(async item=>{
 item.status='running';write();const folder=path.join(out,item.policy);fs.mkdirSync(folder,{recursive:true});
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,['--import','tsx','tools/world-study/r100-real-journeys.mjs'],{env:{...process.env,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json',QA_OUTPUT_DIR:folder,QA_NATURAL_PREPARATION:'1',QA_GRADES:item.policy,QA_RUNS:'30',QA_SEARCH_LIMIT:'10',QA_WORLD_ID:'',QA_CONTROLLED_BUILD:'',QA_REPRO_IDENTITY_FILE:'',QA_STORAGE_STATE:'',QA_REPLAY_INPUTS:'',QA_ORDINAL_START:'1',QA_ENTRY_WAIT:'600'},stdio:['ignore','pipe','pipe']});
  const log=fs.createWriteStream(path.join(folder,'process.log'));child.stdout.on('data',chunk=>{log.write(chunk);process.stdout.write(`[${item.policy}] ${chunk}`)});child.stderr.on('data',chunk=>{log.write(chunk);process.stderr.write(`[${item.policy}] ${chunk}`)});child.on('close',exit=>{log.end();resolve(exit)});
 });
 const file=path.join(folder,'report.json'),receipt=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 item.exitCode=code;item.recordedReturns=receipt?.realJourneyAttempts.filter(row=>row.status==='completed-real-input').length??0;
 item.status=code===0&&item.recordedReturns===30?'completed-continuous-real-input':'incomplete';item.failure=receipt?.realJourneyAttempts.find(row=>row.status==='failed')?.failure??null;write();
}));
report.finishedAt=new Date().toISOString();report.recordedReturns=report.policies.reduce((n,item)=>n+item.recordedReturns,0);
report.status=report.recordedReturns===90?'completed-natural-input-records':'has-incomplete-records';write();if(report.recordedReturns!==90)process.exitCode=1;
