/** Fixed missing-seed real-input coverage; no production changes or retries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const out=process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-second-seed-severe';
const sourceList=process.env.QA_MISSING_FILE??path.join(out,'missing-before.json');
const filter=(process.env.QA_COVERAGE_GRADES??'severe').split(',');
const storage='docs/qa/artifacts/r100-p13/natural-low-final/low-growth/browser-storage.json';
const harness='tools/world-study/r100-p13-continuous-exploration.mjs';
const manifest='docs/qa/artifacts/r100-i03-i06-completion/final-source/source-snapshot.json';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dependencies=['tools/world-study/r100-p13-costed-encounters.mjs','tools/qa/i27-journey-driver.mjs','src/systems/last-light-locomotion.ts','src/systems/last-light-layout.ts'];
fs.mkdirSync(out,{recursive:true});
const cases=JSON.parse(fs.readFileSync(sourceList)).filter(c=>filter.includes(c.grade)).map((c,i)=>({...c,index:i+1,dir:`${String(i+1).padStart(2,'0')}-${c.world}-${c.grade}-${c.seed}`}));
assert(cases.length>0);for(const c of cases)assert(!c.existingSeeds.includes(c.seed),'must be a different seed');
const freeze=path.join(out,'policy-freeze.json');assert(!fs.existsSync(freeze),'Never overwrite policy or repeat an attempt');
const policy={version:1,frozenAt:new Date().toISOString(),featureId:'COH-F052',cases,gameUrl:'http://127.0.0.1:3086',storage,storageSha256:sha(storage),manifest,manifestSha256:sha(manifest),harness,harnessSha256:sha(harness),wrapperSha256:sha(new URL(import.meta.url)),dependencies:dependencies.map(file=>({file,sha256:sha(file)})),parallelism:2,seedPolicy:'Exact independent missing-seed list; each cell one attempt; do not repeat deaths/empty returns/errors.',method:'Same earned low30 original storage per case. Public owned-gear preparation, no granted tools. Actual WASD, E search/extraction, R return. Full static geometry macro routing is disclosed; enemies/Hosts only observed positions or bounded 5s memory; hidden loot type/tier/value not used to pick targets. Reviewed continuous-exploration policy10, limit2 (outer maximum8 observed approaches).',scope:'Second distinct-seed meaningful normal-view process, pressure/failure/different route allowed. A short entry screenshot alone cannot pass. Not natural economy, first-sight play, stable success rate, or performance measurement.'};
fs.writeFileSync(freeze,JSON.stringify(policy,null,2)+'\n');
const report={version:1,status:'running',policy:'policy-freeze.json',startedAt:new Date().toISOString(),attempts:[]};let cursor=0;
const save=()=>fs.writeFileSync(path.join(out,'batch-report.json'),JSON.stringify(report,null,2)+'\n');save();
async function worker(){for(;;){const i=cursor++;if(i>=cases.length)return;const c=cases[i],dir=path.join(out,c.dir);fs.mkdirSync(dir,{recursive:true});
assert.equal(sha(harness),policy.harnessSha256);for(const d of policy.dependencies)assert.equal(sha(d.file),d.sha256);assert.equal(sha(storage),policy.storageSha256);assert.equal(sha(manifest),policy.manifestSha256);
const row={...c,status:'running',startedAt:new Date().toISOString()};report.attempts.push(row);save();console.log('START',c.dir);
const env={...process.env,GAME_URL:policy.gameUrl,QA_GRADES:c.grade,QA_WORLD_ID:c.world,QA_SEED:String(c.seed),QA_RUNS:'1',QA_SEARCH_LIMIT:'2',QA_STORAGE_STATE:storage,QA_OUTPUT_DIR:dir,TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json'};
for(const key of ['QA_CONTROLLED_BUILD','QA_REPRO_IDENTITY_FILE','QA_REPLAY_INPUTS','QA_ORDINAL_START'])delete env[key];
const fd=fs.openSync(path.join(dir,'runner.log'),'wx');await new Promise(resolve=>{const child=spawn(process.execPath,['--import','tsx',harness],{cwd:process.cwd(),env,stdio:['ignore',fd,fd]});child.on('error',e=>{row.spawnError=String(e)});child.on('close',(code,signal)=>{fs.closeSync(fd);row.exitCode=code;row.signal=signal;resolve()})});
row.endedAt=new Date().toISOString();row.status=row.exitCode===0?'completed-script':'failed-script';const file=path.join(dir,'report.json');if(fs.existsSync(file)){const raw=JSON.parse(fs.readFileSync(file));row.journeys=raw.realJourneyAttempts.map(r=>({status:r.status,outcome:r.outcome??null,identity:r.identity?{world:r.identity.generation.profile.id,grade:r.identity.generation.package.grade,seed:r.identity.seed,revision:r.identity.generation.package.algorithmRevision}:null,collected:r.searches.filter(x=>x.collected).length,elapsedMs:r.fieldResult?.elapsedMs??r.exploration?.state?.elapsedMs??null,entryPosition:r.entryState?.pos??null,lastPosition:r.fieldResult?.pos??null,hp:r.fieldResult?.hp??null,chaos:r.fieldResult?.chaos??null,kindling:r.afterReturn?.state?.inventory?.run?.kindlingGained??null,baseSettled:r.afterReturn?.state?.inventory?.run?.baseSettled??false,runId:r.afterReturn?.state?.inventory?.run?.id??null,returnedIds:r.afterReturn?.state?.inventory?.run?.returnedIds??[],failure:r.failure??null,navigationWarning:r.navigationWarning??null}));}
save();console.log('END',c.dir,row.exitCode,row.journeys?.map(j=>[j.outcome,j.collected,Math.round((j.elapsedMs??0)/1000)]));}}
await Promise.all([worker(),worker()]);report.status='completed-bounded-attempts-pending-process-review';report.endedAt=new Date().toISOString();save();console.log('DONE',cases.length,'fixed attempts; no automatic pass assigned');
