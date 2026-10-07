/** External observation only. Does not wrap browser Worker, input, timers or fetch. */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export function installObserver(browserType, record, sampleProcesses = () => {}) {
 const originalLaunch=browserType.launch;
 browserType.launch=async function(...args){
  record({event:'launch',args});
  const browser=await originalLaunch.apply(this,args);
  browser.on('disconnected',()=>record({event:'browser-disconnected'}));
  const targetSession=await browser.newBrowserCDPSession();
  for(const event of ['Target.targetCreated','Target.targetDestroyed','Target.targetCrashed','Target.targetInfoChanged'])
   targetSession.on(event,data=>record({event,data}));
  await targetSession.send('Target.setDiscoverTargets',{discover:true});
  const originalNewContext=browser.newContext;
  browser.newContext=async function(...contextArgs){
   const context=await originalNewContext.apply(this,contextArgs);
   context.on('request',request=>record({event:'request',url:request.url(),resourceType:request.resourceType(),method:request.method()}));
   context.on('requestfailed',request=>record({event:'requestfailed',url:request.url(),failure:request.failure(),resourceType:request.resourceType()}));
   context.on('response',response=>record({event:'response',url:response.url(),status:response.status(),fromServiceWorker:response.fromServiceWorker()}));
   context.on('page',page=>{
    page.on('crash',()=>{record({event:'page-crash',url:page.url()});sampleProcesses('page-crash');});
    page.on('pageerror',error=>record({event:'pageerror',message:String(error),stack:error.stack}));
    page.on('console',message=>{if(['error','warning'].includes(message.type()))record({event:'console',type:message.type(),text:message.text(),location:message.location()});});
    page.on('worker',worker=>{record({event:'worker-created',url:worker.url()});sampleProcesses('worker-created');worker.on('close',()=>record({event:'worker-closed',url:worker.url()}));});
    page.on('close',()=>record({event:'page-closed'}));
   });
   context.on('close',()=>record({event:'context-closed'}));
   return context;
  };
  record({event:'browser-ready'});sampleProcesses('browser-ready');return browser;
 };
 return()=>{browserType.launch=originalLaunch;};
}

if(process.env.QA_WORKER_OBSERVER_DIR){
 const folder=path.resolve(process.env.QA_WORKER_OBSERVER_DIR);fs.mkdirSync(folder,{recursive:true});
 const output=path.join(folder,`observer-${process.pid}.jsonl`);const fd=fs.openSync(output,'wx');
 const record=event=>fs.writeSync(fd,JSON.stringify({at:new Date().toISOString(),pid:process.pid,...event})+'\n');
 const sampleProcesses=reason=>execFile('/bin/ps',['-axo','pid,ppid,rss,%cpu,command'],{maxBuffer:4*1024*1024},(error,stdout)=>record({event:'process-snapshot',reason,error:error?String(error):null,processes:stdout.split('\n').filter(line=>/Google Chrome|r100-frozen-server|r100-revision6-journey/.test(line))}));
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');installObserver(chromium,record,sampleProcesses);
 record({event:'preload-ready',argv:process.argv,caseEnvironment:{world:process.env.QA_WORLD_ID??null,grades:process.env.QA_GRADES??null,seed:process.env.QA_SEED??null,output:process.env.QA_OUTPUT_DIR??null},scope:'CDP target discovery, Playwright network/page/worker lifecycle and read-only ps only. No Runtime evaluation, Worker wrapper, routing, interception, input, clock or launch options modified.'});
}
