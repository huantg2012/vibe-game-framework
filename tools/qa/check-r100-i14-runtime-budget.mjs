// I14 portability derivative. Parent SHA256 78d568151dee13888730d757e2e7cddb59032a2e00975e0ab91bfa61ac23f868. Original sample and budgets unchanged.
/** Reference-machine native runtime measurements. Real input, no invulnerability,
 * enemy removal, simulated clocks or visibility overrides. Not a playtest verdict. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/runtime-budget');fs.mkdirSync(out,{recursive:true});
assert(!fs.existsSync(path.join(out,'report.json')),'refusing to overwrite prior runtime evidence');
// A server handle owns only this test's Chrome process, allowing bounded cleanup
// after a wedged context close without touching a user's browser.
let server,browser,persistentContext,temporaryProfile,ownedPid;
const disableBrowserSaver=process.env.QA_DISABLE_BROWSER_BATTERY_SAVER==='1';
const power=()=>{try{return{at:new Date().toISOString(),battery:execFileSync('pmset',['-g','batt'],{encoding:'utf8'}),settings:execFileSync('pmset',['-g','custom'],{encoding:'utf8'})};}catch(error){return{unavailable:String(error)};}};
const deadline=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}: 15s cleanup deadline`)),15000);})]);}finally{clearTimeout(timer);}};
const report={scope:'Configured native severe worlds, each at least 60 seconds of real held-key movement. Normal body, sight, enemies, damage and time. No GPU driver memory claim.',exclusiveWindow:process.env.QA_EXCLUSIVE_WINDOW==='1',environment:{platform:os.platform(),cpus:os.cpus()[0]?.model,cores:os.cpus().length,memory:os.totalmem(),browser:null},cases:[],caseProgress:[],errors:[],status:'running'};
report.powerStart=power();
const worlds=(process.env.QA_WORLDS??'ash-strata,crystal-fibre,ivory-basin,cinder-ridge,pallid-membrane,silt-gel').split(',');
assert(worlds.length>0&&new Set(worlds).size===worlds.length,'unique configured world IDs required');
report.worlds=worlds;report.scope=`${worlds.length} configured native severe worlds, each at least 60 seconds of real held-key movement. Normal body, sight, enemies, damage and time. ${report.exclusiveWindow?'Operator-declared exclusive QA window.':'Shared reference machine; other activity was not excluded.'} No GPU driver memory claim.`;
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return{count:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1),over50:s.filter(v=>v>50).length/s.length};};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
try{
 const snapshot=await fetch(`${process.env.GAME_URL??'http://127.0.0.1:3060'}/source-snapshot.json`).then(r=>r.ok?r.json():null).catch(()=>null);
 if(process.env.QA_REQUIRE_SNAPSHOT==='1')assert(snapshot?.files,'immutable source snapshot required');
 if(snapshot)fs.writeFileSync(path.join(out,'source-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
 const launchOptions={headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'};
 if(disableBrowserSaver){
  temporaryProfile=fs.mkdtempSync(path.join(os.tmpdir(),'coh-spatial-runtime-profile-'));
  fs.writeFileSync(path.join(temporaryProfile,'Local State'),JSON.stringify({performance_tuning:{battery_saver_mode:{state:0}}}));
  report.browserProfilePolicy={scope:'Fresh temporary QA profile only; browser Battery Saver disabled for normal 60Hz measurement. No system or user profile changes; no frame-rate override flags.',requestedPreference:0};
  persistentContext=await chromium.launchPersistentContext(temporaryProfile,launchOptions);browser=persistentContext.browser();
  const processes=execFileSync('ps',['-ax','-o','pid=,command='],{encoding:'utf8'}).split('\n').filter(line=>line.includes(`--user-data-dir=${temporaryProfile}`)&&!line.includes(' --type='));
  assert.equal(processes.length,1,'exactly one owned main Chrome process');ownedPid=Number(processes[0].trim().split(/\s+/)[0]);
 }else{server=await chromium.launchServer(launchOptions);browser=await chromium.connect(server.wsEndpoint());}
 report.environment.browser=browser.version();
 for(const [index,world] of worlds.entries()){
 const progress={index,world,grade:'severe',seed:20261004,status:'running',startedAt:new Date().toISOString()};
 report.caseProgress.push(progress);report.currentCase=progress;save();
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(`${world}: ${e}`));
 try{
  await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3060'}/r100-gym.html?world=${world}&grade=severe&seed=20261004`);
  await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});await page.waitForTimeout(800);
  await page.evaluate(async()=>{
   const{audioManager}=await import('/src/managers/audio-manager.ts'),game=audioManager.game,s=game.scene.getScene('RiftScene');
   const frames=[],cpu=[],render=[],start=s.probeBuildLabState(),positions=[];let before=0,previous=0;
   game.events.on('prestep',()=>{const now=performance.now();if(previous)frames.push(now-previous);previous=now;before=now;});
   game.events.on('poststep',()=>{cpu.push(performance.now()-before);render.push(s.devRuntime.snapshot().lastRenderMs);});
   const gl=game.renderer.gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
   const gpu={vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,dpr:window.devicePixelRatio,logicalSize:{width:game.canvas.width,height:game.canvas.height}};
   window.__budget={frames,cpu,render,start,positions,gpu};
  });
  await page.locator('#game-container').focus();
  const keys=['d','w','a','s','d','s','a','w','d','w','a','s'];
  for(const key of keys){await page.keyboard.down(key);await page.waitForTimeout(5100);await page.keyboard.up(key);await page.evaluate(()=>window.__budget.positions.push(window.__r100Gym.getState().runtime.probe));}
  const sample=await page.evaluate(()=>({...window.__budget,end:window.__r100Gym.getState().runtime.probe}));
  const row={browserGPU:sample.gpu,world,grade:'severe',seed:20261004,frames:stats(sample.frames),cpu:stats(sample.cpu),materialSubmit:stats(sample.render),start:sample.start,end:sample.end,positions:sample.positions};
  row.duration=sample.end.elapsedMs-sample.start.elapsedMs;row.fullAliveDuration=!sample.end.ended&&row.duration>=60000;
  row.budgetPass=row.fullAliveDuration&&row.frames.p95<=20&&row.frames.p99<=33.4&&row.frames.over50<=.005&&row.cpu.p95<=12&&row.materialSubmit.p95<=3;
  report.cases.push(row);console.log(JSON.stringify({world,duration:row.duration,alive:row.fullAliveDuration,frames:row.frames,cpu:row.cpu,material:row.materialSubmit,pass:row.budgetPass}));
  progress.measurementStatus=row.budgetPass?'passed':'measured-with-failures';save();
  await page.screenshot({path:path.join(out,`${world}-end.png`)});
  progress.status=row.budgetPass?'passed':'measured-with-failures';progress.finishedAt=new Date().toISOString();
 }finally{save();await deadline(context.close(),`${world} context.close`);save();}
}assert.deepEqual(report.errors,[]);report.status=report.cases.every(c=>c.budgetPass)?'passed-reference-samples':'measured-with-failures';if(report.status!=='passed-reference-samples')process.exitCode=1;}
catch(error){report.status='failed';report.failure=String(error.stack??error);if(report.currentCase){report.currentCase.status='failed';report.currentCase.failure=report.failure;report.currentCase.finishedAt=new Date().toISOString();}save();throw error;}
finally{
 report.powerEnd=power();save();
 for(const [label,close] of [['client disconnect',()=>browser?.close()],['server process close',()=>server?.close()]]){
  try{await deadline(close(),label);}catch(error){(report.cleanupFailures??=[]).push(String(error));report.status='failed';process.exitCode=1;save();if(label==='server process close')server?.process().kill('SIGKILL');if(ownedPid){try{const command=execFileSync('ps',['-p',String(ownedPid),'-o','command='],{encoding:'utf8'});if(command.includes(`--user-data-dir=${temporaryProfile}`))process.kill(ownedPid,'SIGKILL');}catch{}}}
 }
 if(temporaryProfile){
  try{report.browserProfilePolicy.persistedPreference=JSON.parse(fs.readFileSync(path.join(temporaryProfile,'Local State'),'utf8')).performance_tuning?.battery_saver_mode?.state;assert.equal(report.browserProfilePolicy.persistedPreference,0);}catch(error){report.profilePolicyFailure=String(error);report.status='failed';process.exitCode=1;}
  save();fs.rmSync(temporaryProfile,{recursive:true,force:true});
 }
}
