import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const artifact='docs/qa/artifacts/r100-spatial-rollout-2026-10-10/runtime-lifecycle-blank.json';
assert(!fs.existsSync(artifact),'Do not replace prior evidence');
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const deadline=async(p,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline')),15000);})]);}finally{clearTimeout(timer);}};
const power=()=>({battery:execFileSync('pmset',['-g','batt'],{encoding:'utf8'}),settings:execFileSync('pmset',['-g','custom'],{encoding:'utf8'})});
const report={startedAt:new Date().toISOString(),scope:'One blank about:blank page; lifecycle and requestAnimationFrame scheduling control, never a game performance qualification',source:{path:'tools/qa/check-r100-i14-runtime-budget.mjs',sha256:crypto.createHash('sha256').update(fs.readFileSync('tools/qa/check-r100-i14-runtime-budget.mjs')).digest('hex')},powerBefore:power(),budgetQualification:false,errors:[]};
let server,browser;
try{
 server=await chromium.launchServer({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const child=server.process();report.ownedPid=child.pid;
 const exitPromise=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 browser=await chromium.connect(server.wsEndpoint());report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(String(error)));
 await page.goto('about:blank');
 report.raf=await page.evaluate(()=>new Promise(resolve=>{
  const intervals=[],began=performance.now();let previous;
  const sample=now=>{if(previous!==undefined)intervals.push(now-previous);previous=now;if(now-began>=15000){const s=[...intervals].sort((a,b)=>a-b);resolve({durationMs:now-began,visibility:document.visibilityState,intervals,count:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1)});}else requestAnimationFrame(sample);};
  requestAnimationFrame(sample);
 }));
 await deadline(context.close(),'context.close');report.contextClosed=true;
 await deadline(browser.close(),'client disconnect');report.clientDisconnected=!browser.isConnected();
 report.serverAliveAfterDisconnect=child.exitCode===null&&child.signalCode===null;
 assert(report.clientDisconnected&&report.serverAliveAfterDisconnect,'Connected client close is not server process exit');
 await deadline(server.close(),'server.close');report.serverExit=await deadline(exitPromise,'server exit');
 assert(child.exitCode!==null||child.signalCode!==null,'Owned server process must actually exit');
 report.serverExited=true;assert.deepEqual(report.errors,[]);report.status='passed-lifecycle-and-scheduling-control';
}catch(error){report.status='failed';report.failure=String(error.stack??error);process.exitCode=1;}
finally{
 for(const[label,close]of[['client disconnect',()=>browser?.close()],['server process close',()=>server?.close()]]){
  try{await deadline(close(),label);}catch(error){(report.cleanupFailures??=[]).push(String(error));report.status='failed';process.exitCode=1;if(label==='server process close')server?.process().kill('SIGKILL');}
 }
 report.powerAfter=power();report.finishedAt=new Date().toISOString();fs.writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({...report,raf:report.raf?{...report.raf,intervals:'preserved in artifact'}:undefined,powerBefore:undefined,powerAfter:undefined}));
