import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const artifact='docs/qa/artifacts/r100-spatial-rollout-2026-10-10/runtime-blank-battery-saver-control.json';
assert(!fs.existsSync(artifact),'Preserve previous evidence');
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const deadline=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline')),15000);})]);}finally{clearTimeout(timer);}};
const power=()=>({battery:execFileSync('pmset',['-g','batt'],{encoding:'utf8'}),settings:execFileSync('pmset',['-g','custom'],{encoding:'utf8'})});
const report={startedAt:new Date().toISOString(),scope:'One isolated temporary QA Chrome profile; same blank page before/after its own battery saver preference. No user browser or OS preference modification; no fps-limit/time flags.',budgetQualification:false,powerBefore:power(),sources:[
'https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/performance_manager/user_tuning/battery_saver_mode_manager.cc',
'https://raw.githubusercontent.com/chromium/chromium/main/components/performance_manager/public/user_tuning/prefs.h',
'https://raw.githubusercontent.com/chromium/chromium/main/components/performance_manager/user_tuning/prefs.cc',
'https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/api/settings_private/prefs_util.cc'],samples:[]};
let server,browser,page,originalPref;
const getPref=()=>page.evaluate(()=>new Promise((resolve,reject)=>chrome.settingsPrivate.getPref('performance_tuning.battery_saver_mode.state',pref=>chrome.runtime.lastError?reject(Error(chrome.runtime.lastError.message)):resolve(pref))));
const setPref=value=>page.evaluate(value=>new Promise((resolve,reject)=>chrome.settingsPrivate.setPref('performance_tuning.battery_saver_mode.state',value,'',ok=>chrome.runtime.lastError?reject(Error(chrome.runtime.lastError.message)):resolve(ok))),value);
const settings=async()=>{await page.goto('chrome://settings/performance');await page.waitForFunction(()=>typeof chrome.settingsPrivate?.getPref==='function',null,{timeout:10000});};
const sample=async(label)=>{await page.goto('about:blank');await page.waitForTimeout(800);const raf=await page.evaluate(()=>new Promise(resolve=>{
 const intervals=[],began=performance.now();let previous;
 const tick=now=>{if(previous!==undefined)intervals.push(now-previous);previous=now;if(now-began>=15000){const s=[...intervals].sort((a,b)=>a-b);resolve({durationMs:now-began,visibility:document.visibilityState,intervals,count:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1)});}else requestAnimationFrame(tick);};requestAnimationFrame(tick);
 }));report.samples.push({label,...raf});fs.writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');};
try{
 server=await chromium.launchServer({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 report.ownedPid=server.process().pid;report.defaultTemporaryUserDataDir=server.process().spawnargs.find(arg=>arg.startsWith('--user-data-dir='));
 assert(report.defaultTemporaryUserDataDir?.includes('playwright_chromiumdev_profile-'),'Require a Playwright-owned temporary profile');
 browser=await chromium.connect(server.wsEndpoint());report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
 await settings();originalPref=await getPref();report.originalPref=originalPref;assert.equal(originalPref.value,1,'Control requires default threshold mode');
 await sample('same-browser default battery saver preference 1');
 await settings();assert(await setPref(0),'Set disabled returned false');report.disabledReadback=await getPref();assert.equal(report.disabledReadback.value,0);
 await sample('same-browser battery saver preference disabled 0');
 await settings();assert(await setPref(originalPref.value),'Restore failed');report.restoredReadback=await getPref();assert.equal(report.restoredReadback.value,originalPref.value);
 await sample('same-browser restored battery saver preference 1');
 report.status='completed-controlled-scheduling-diagnostic';
}catch(error){report.status='failed';report.failure=String(error.stack??error);process.exitCode=1;}
finally{
 if(page&&originalPref&&report.restoredReadback?.value!==originalPref.value){try{await settings();await setPref(originalPref.value);report.restoredReadback=await getPref();}catch(error){report.restoreFailure=String(error);}}
 for(const[label,close]of[['client disconnect',()=>browser?.close()],['server process close',()=>server?.close()]]){
  try{await deadline(close(),label);}catch(error){(report.cleanupFailures??=[]).push(String(error));report.status='failed';process.exitCode=1;if(label==='server process close')server?.process().kill('SIGKILL');}
 }
 if(server)report.serverExit={code:server.process().exitCode,signal:server.process().signalCode};
 report.powerAfter=power();report.finishedAt=new Date().toISOString();fs.writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({...report,samples:report.samples.map(({intervals,...sample})=>sample),powerBefore:undefined,powerAfter:undefined}));
