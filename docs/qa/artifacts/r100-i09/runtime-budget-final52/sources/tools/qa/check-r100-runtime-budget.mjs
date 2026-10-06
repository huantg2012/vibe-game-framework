/** Reference-machine native runtime measurements. Real input, no invulnerability,
 * enemy removal, simulated clocks or visibility overrides. Not a playtest verdict. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/runtime-budget');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={scope:'Configured native severe worlds, each at least 60 seconds of real held-key movement. Normal body, sight, enemies, damage and time. No GPU driver memory claim.',exclusiveWindow:process.env.QA_EXCLUSIVE_WINDOW==='1',environment:{platform:os.platform(),cpus:os.cpus()[0]?.model,cores:os.cpus().length,memory:os.totalmem(),browser:browser.version()},cases:[],errors:[]};
const worlds=(process.env.QA_WORLDS??'ash-strata,crystal-fibre,ivory-basin,cinder-ridge,pallid-membrane,silt-gel').split(',');
assert(worlds.length>0&&new Set(worlds).size===worlds.length,'unique configured world IDs required');
report.worlds=worlds;report.scope=`${worlds.length} configured native severe worlds, each at least 60 seconds of real held-key movement. Normal body, sight, enemies, damage and time. ${report.exclusiveWindow?'Operator-declared exclusive QA window.':'Shared reference machine; other activity was not excluded.'} No GPU driver memory claim.`;
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return{count:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1),over50:s.filter(v=>v>50).length/s.length};};
try{for(const world of worlds){
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
   window.__budget={frames,cpu,render,start,positions};
  });
  await page.locator('#game-container').focus();
  const keys=['d','w','a','s','d','s','a','w','d','w','a','s'];
  for(const key of keys){await page.keyboard.down(key);await page.waitForTimeout(5100);await page.keyboard.up(key);await page.evaluate(()=>window.__budget.positions.push(window.__r100Gym.getState().runtime.probe));}
  const sample=await page.evaluate(()=>({...window.__budget,end:window.__r100Gym.getState().runtime.probe}));
  const row={world,grade:'severe',seed:20261004,frames:stats(sample.frames),cpu:stats(sample.cpu),materialSubmit:stats(sample.render),start:sample.start,end:sample.end,positions:sample.positions};
  row.duration=sample.end.elapsedMs-sample.start.elapsedMs;row.fullAliveDuration=!sample.end.ended&&row.duration>=60000;
  row.budgetPass=row.fullAliveDuration&&row.frames.p95<=20&&row.frames.p99<=33.4&&row.frames.over50<=.005&&row.cpu.p95<=12&&row.materialSubmit.p95<=3;
  report.cases.push(row);console.log(JSON.stringify({world,duration:row.duration,alive:row.fullAliveDuration,frames:row.frames,cpu:row.cpu,material:row.materialSubmit,pass:row.budgetPass}));
  await page.screenshot({path:path.join(out,`${world}-end.png`)});
 }finally{await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}assert.deepEqual(report.errors,[]);report.status=report.cases.every(c=>c.budgetPass)?'passed-reference-samples':'measured-with-failures';if(report.status!=='passed-reference-samples')process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
