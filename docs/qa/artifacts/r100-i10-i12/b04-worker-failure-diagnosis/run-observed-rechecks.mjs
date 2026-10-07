/** Separate same-request diagnostics; original policy bytes and all failed attempts remain. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i10-i12/b04-worker-failure-diagnosis';
const out=base+'/observed-rechecks-v2',reportPath=out+'/execution.json';
const read=file=>JSON.parse(fs.readFileSync(file)),sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),ref=file=>({path:file,sha256:sha(file)});
const commandPath='docs/qa/artifacts/r100-i10-i12/b04-raised-qualified/preparation/commands.json',commands=read(commandPath);
const original='docs/qa/artifacts/r100-i10-i12/b04-raised-qualified/play',policy=read(original+'/policy-freeze.json');
const source=read(commands.source.path),observer=base+'/observe-worker-preload.mjs';
const originals=read(base+'/original-three-failures.json');assert.equal(originals.count,3);
const expected=[['buried-lamellae','severe',3075192741],['wedged-hide','low',3075192741],['wedged-hide','severe',3075192741]];
assert.deepEqual(originals.failures.map(row=>[row.originalAttempt.world,row.originalAttempt.grade,row.originalAttempt.seed]),expected);
assert.equal(process.env.NODE_OPTIONS??'','','Unexpected Node preloads must be disclosed separately');
assert(!fs.existsSync(out),'Original diagnostic attempts must never be overwritten');
assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'),'Resolve current browser handoff first');
const noChrome=()=>{const rows=execFileSync('ps',['-axo','pid,command'],{encoding:'utf8'}).split('\n');assert(!rows.some(row=>row.includes('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome ')&&row.includes('--headless')),'Sole QA browser window required');};
noChrome();fs.mkdirSync(out);
const anchors=[commands.source,{path:policy.harness,sha256:policy.harnessSha256},...policy.dependencies.map(row=>({path:row.file,sha256:row.sha256})),...policy.wrapperDependencies.map(row=>({path:row.file,sha256:row.sha256})),ref(observer),ref('tools/qa/r100-i07-i09-coverage.mjs'),ref(commandPath),ref(base+'/original-three-failures.json')];
const verify=()=>{for(const anchor of anchors)assert.equal(sha(anchor.path),anchor.sha256,anchor.path);for(const[file,hash]of Object.entries(source.sources))assert.equal(sha(path.join(source.temporaryRoot,file)),hash,file);};
verify();
const report={status:'running',startedAt:new Date().toISOString(),pid:process.pid,source:commands.source,anchors,runner:ref(base+'/run-observed-rechecks.mjs'),originalFailures:ref(base+'/original-three-failures.json'),cases:[],method:'Original same-source same-world/grade/seed earned-save controller; unchanged policy15/r6 adapter. External Node preload only records existing network/worker events; DEBUG pw:browser preserves browser process logs. Earlier idle-server cleanup is disclosed separately. A later pass does not establish the cause of the historical error.'};
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');save();
try{
 for(const [world,grade,seed]of expected){
  noChrome();verify();const folder=`${out}/${world}-${grade}`,observations=folder+'-observations',log=folder+'-runner.log';
  const env={...process.env,...commands.play.env,QA_WORLDS:world,QA_GRADES:grade,QA_SEEDS:String(seed),QA_OUTPUT_DIR:path.resolve(folder),QA_WORKER_OBSERVER_DIR:path.resolve(observations),NODE_OPTIONS:`--import ${path.resolve(observer)}`,DEBUG:'pw:browser'};
  const row={world,grade,seed,originalRole:'second-seed-process',folder,observations,log,status:'running',startedAt:new Date().toISOString(),environment:{NODE_OPTIONS:env.NODE_OPTIONS,DEBUG:env.DEBUG}};report.cases.push(row);save();const fd=fs.openSync(log,'wx');
  const result=await new Promise((resolve,reject)=>{const child=spawn(commands.play.command,commands.play.args,{env,stdio:['ignore',fd,fd]});row.childPid=child.pid;save();let launchError;child.once('error',error=>{launchError=error;});child.once('close',(code,signal)=>launchError?reject(launchError):resolve({code,signal}));});fs.closeSync(fd);
  row.exitCode=result.code;row.signal=result.signal;row.finishedAt=new Date().toISOString();row.logSha256=sha(log);delete row.childPid;row.status=result.code===0?'completed-original-input':'failed-original-input';save();verify();noChrome();assert.equal(result.code,0,'Stop diagnostic sequence on first repeated error; retain original and observed attempts');
 }
 report.status='completed-observed-rechecks-cause-not-inferred';
}catch(error){report.status='failed';report.error=String(error.stack??error);throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
