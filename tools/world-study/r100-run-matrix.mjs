/** Runs the preregistered 36 actual-input cases. Each case owns isolated storage;
 * mature ordinary loadouts and world seeds are disclosed controlled fixtures.
 * This is not novice navigation or the 90-run natural supply study.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/matrix');
fs.mkdirSync(out,{recursive:true});
const worlds=['ash-strata','crystal-fibre','ivory-basin'];
const cases=worlds.flatMap(world=>['low','medium','severe'].flatMap(grade=>[20261004,20261005].flatMap(seed=>['resist-suppress','survey-lure'].map(build=>({id:`${world}-${grade}-${seed}-${build}`,world,grade,seed,build,status:'pending'})))));
const report={startedAt:new Date().toISOString(),sourceSnapshot:process.env.QA_SOURCE_SNAPSHOT??null,scope:'36 controlled ordinary two-build actual-input expeditions; complete-map read-only routing. Does not establish novice-navigation value, human approval, GPU budget or natural supply.',cases};
const write=()=>fs.writeFileSync(path.join(out,'matrix-report.json'),JSON.stringify(report,null,2));write();
let cursor=0;
async function worker(){while(cursor<cases.length){const item=cases[cursor++],folder=path.join(out,item.id),file=path.join(folder,'report.json');
 if(fs.existsSync(file)){const prior=JSON.parse(fs.readFileSync(file,'utf8'));if(prior.status==='completed-limited-real-input'){item.status='completed-real-input';item.reusedRecordedCase=true;write();continue;}}
 const runFolder=fs.existsSync(file)?path.join(folder,`retry-${Date.now()}`):folder;
 item.status='running';item.output=path.relative(process.cwd(),runFolder);write();
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,['--import','tsx','tools/world-study/r100-real-journeys.mjs'],{env:{...process.env,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json',QA_OUTPUT_DIR:runFolder,QA_WORLD_ID:item.world,QA_SEED:String(item.seed),QA_CONTROLLED_BUILD:item.build,QA_GRADES:item.grade,QA_RUNS:'1',QA_SEARCH_LIMIT:'10'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{output+=chunk});child.on('close',exit=>{fs.mkdirSync(runFolder,{recursive:true});fs.writeFileSync(path.join(runFolder,'process.log'),output);resolve(exit);});
 });
 const receipt=fs.existsSync(path.join(runFolder,'report.json'))?JSON.parse(fs.readFileSync(path.join(runFolder,'report.json'),'utf8')):null;
 item.status=code===0&&receipt?.status==='completed-limited-real-input'?'completed-real-input':'failed';item.exitCode=code;
 item.outcome=receipt?.realJourneyAttempts[0]?.outcome??null;item.failure=receipt?.realJourneyAttempts[0]?.failure??null;
 write();console.log(`${cases.filter(c=>c.status==='completed-real-input').length}/36 ${item.id}: ${item.status}`);
 }}
await Promise.all(Array.from({length:Number(process.env.QA_PARALLEL??2)},worker));
report.finishedAt=new Date().toISOString();report.completed=cases.filter(c=>c.status==='completed-real-input').length;report.status=report.completed===36?'completed-controlled-input-matrix':'has-incomplete-cases';write();
if(report.completed!==36)process.exitCode=1;
