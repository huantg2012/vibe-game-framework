/** Sequential real-browser integration on an immutable source snapshot. */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const cwd=process.cwd(),snapshot=process.env.QA_SNAPSHOT_ROOT,base=process.env.GAME_URL,output=process.env.QA_OUTPUT_DIR;
assert(snapshot&&base&&output,'QA_SNAPSHOT_ROOT, GAME_URL and QA_OUTPUT_DIR required');
const cases=(process.env.QA_RUNTIME_CASES??'crystal-fibre:severe:gym,ivory-basin:low:gym,porcelain-maw:medium:gym,pleated-hide:medium:gym,pressed-dunes:severe:gym,wax-tongues:low:formal').split(',').map(s=>s.split(':'));
assert(cases.length<=6&&cases.every(c=>c.length===3&&['gym','formal'].includes(c[2])));
fs.mkdirSync(output,{recursive:true});assert(!fs.existsSync(path.join(output,'runtime-batch.json')),'Do not overwrite evidence');
const server=spawn(process.execPath,[path.join(cwd,'node_modules/vite/bin/vite.js'),'--config','vite.config.mjs'],{cwd:snapshot,stdio:'ignore'});
const results=[];
try{
 let ready=false;for(let n=0;n<100;n++){if(await fetch(`${base}/source-snapshot.json`).then(r=>r.ok).catch(()=>false)){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert(ready,'Snapshot server did not become ready');
 for(const[world,grade,mode]of cases){const code=await new Promise(resolve=>{const p=spawn(process.execPath,['tools/pickup-grounding/capture-runtime.mjs'],{cwd,env:{...process.env,QA_ALGORITHM_REVISION:'10',QA_WORLD:world,QA_GRADE:grade,QA_SEED:'20261012',QA_FORMAL:mode==='formal'?'1':'0',QA_FRAME_INPUT:'1',QA_STANDOFF:'1',QA_VISUAL_SWEEP:'1',QA_REQUIRE_SNAPSHOT:'1',QA_OUTPUT_DIR:path.join(output,`${world}-${grade}-${mode}`)},stdio:'inherit'});p.on('exit',resolve);});results.push({world,grade,mode,code});fs.writeFileSync(path.join(output,'runtime-batch.json'),JSON.stringify({snapshot,base,results},null,2));}
}finally{server.kill('SIGTERM');}
if(results.some(r=>r.code!==0))process.exitCode=1;
