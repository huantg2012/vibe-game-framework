import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const artifact='docs/qa/artifacts/r100-spatial-rollout-2026-10-10/runtime-blank-battery-pref-profiles-v2.json';
assert(!fs.existsSync(artifact),'Preserve previous evidence');
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const deadline=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline')),15000);})]);}finally{clearTimeout(timer);}};
const power=()=>({battery:execFileSync('pmset',['-g','batt'],{encoding:'utf8'}),settings:execFileSync('pmset',['-g','custom'],{encoding:'utf8'})});
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const report={startedAt:new Date().toISOString(),scope:'Two independently owned mkdtemp QA Chrome profiles; local Battery Saver preference 1 then 0. Blank-page scheduling only. No system/user Chrome settings or frame-rate flags.',budgetQualification:false,powerBefore:power(),samples:[],sources:[
'https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/performance_manager/user_tuning/battery_saver_mode_manager.cc',
'https://raw.githubusercontent.com/chromium/chromium/main/components/performance_manager/public/user_tuning/prefs.h',
'https://raw.githubusercontent.com/chromium/chromium/main/components/performance_manager/user_tuning/prefs.cc']};
const save=()=>fs.writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');
try{
 for(const state of [1,0]){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'coh-spatial-qa-battery-pref-'));
  const localState=path.join(profile,'Local State');
  fs.writeFileSync(localState,JSON.stringify({performance_tuning:{battery_saver_mode:{state}}}));
  const sample={requestedPreference:state,temporaryProfile:profile,startedAt:new Date().toISOString()};report.samples.push(sample);save();
  let context,ownedPid;
  try{
   context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000}});
   const lines=execFileSync('ps',['-axo','pid=,args='],{encoding:'utf8'}).split('\n').filter(line=>line.includes(`--user-data-dir=${profile}`)&&!line.includes(' --type='));
   assert.equal(lines.length,1,'Exactly one Chrome process must own this unique temporary user-data-dir');
   ownedPid=Number(lines[0].trim().match(/^\d+/)[0]);sample.ownedPid=ownedPid;sample.launchCommand=lines[0].trim();
   sample.browser=context.browser()?.version();
   sample.localStateAfterLaunch=JSON.parse(fs.readFileSync(localState,'utf8')).performance_tuning?.battery_saver_mode?.state;
   assert.equal(sample.localStateAfterLaunch,state,'Browser local-state preference readback');
   const page=context.pages()[0]??await context.newPage();await page.goto('about:blank');await page.waitForTimeout(800);
   sample.raf=await page.evaluate(()=>new Promise(resolve=>{
    const intervals=[],began=performance.now();let previous;
    const tick=now=>{if(previous!==undefined)intervals.push(now-previous);previous=now;if(now-began>=15000){const s=[...intervals].sort((a,b)=>a-b);resolve({durationMs:now-began,visibility:document.visibilityState,intervals,count:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1)});}else requestAnimationFrame(tick);};requestAnimationFrame(tick);
   }));save();
  }finally{
   try{if(context)await deadline(context.close(),'persistent context.close');}catch(error){sample.cleanupFailure=String(error);if(ownedPid)process.kill(ownedPid,'SIGKILL');throw error;}
   sample.ownedProcessExited=ownedPid?!alive(ownedPid):null;
   sample.localStateAfterClose=JSON.parse(fs.readFileSync(localState,'utf8')).performance_tuning?.battery_saver_mode?.state;
   sample.finishedAt=new Date().toISOString();save();
   if(ownedPid)assert.equal(sample.ownedProcessExited,true,'Persistent context close must exit its owned Chrome');
   assert.equal(sample.localStateAfterClose,state,'Persisted preference remained exactly the requested value');
  }
 }
 report.status='completed-controlled-scheduling-diagnostic';
}catch(error){report.status='failed';report.failure=String(error.stack??error);process.exitCode=1;}
finally{report.powerAfter=power();report.finishedAt=new Date().toISOString();save();}
console.log(JSON.stringify({...report,powerBefore:undefined,powerAfter:undefined,samples:report.samples.map(sample=>({...sample,raf:sample.raf?{...sample.raf,intervals:undefined}:undefined}))}));
