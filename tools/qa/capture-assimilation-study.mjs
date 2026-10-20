/** Bounded real-scene art capture. Uses isolated DEV storage, never user saves. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/assimilation-appearance-2026-10-20');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={browser:await browser.version(),scope:'Isolated art scenes; CPU submission and actual-render intervals, not GPU execution or overall release performance.',worlds:[],errors:[]};
const persist=()=>fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
try{
 for(const world of (process.env.QA_WORLDS??'crystal-fibre,ruptured-film,haven').split(',')){
  const row={world,checks:[],images:[],performance:[]};report.worlds.push(row);
  const context=await browser.newContext({viewport:{width:1360,height:1160},deviceScaleFactor:1});
  await context.addInitScript(()=>{
   window.__saveWrites=[];
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){window.__saveWrites.push(key);return original.call(this,key,value);};
  });
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push({world,error:error.message}));
  try{
   console.log('START',world);
   await page.goto(`http://127.0.0.1:3027/docs/art/previews/assimilation-appearance-study/?world=${world}&amount=.85&fibre=.5`);
   await page.waitForFunction(()=>window.__assimilationStudy?.snapshot().ready||!document.getElementById('error').hidden,null,{timeout:90000});
   assert(await page.evaluate(()=>window.__assimilationStudy?.snapshot().ready),await page.locator('#error').textContent());
   await page.waitForTimeout(world==='haven'?2200:1400);
   row.checks.push('actual scene + renderer ready');
   for(const [name,amount,fibre]of[['baseline',0,.5],['fibre',.9,1],['membrane',.9,0],['mixed',.9,.5]]){
    await page.evaluate(([a,f])=>window.__assimilationStudy.set(a,f,true),[amount,fibre]);
    await page.waitForTimeout(200);
    const filename=`${world}-${name}.png`;
    await page.locator('.view').screenshot({path:path.join(output,filename)});
    row.images.push(filename);
   }
   await page.evaluate(()=>window.__assimilationStudy.face(Math.PI/2));
   await page.waitForTimeout(150);
   await page.locator('.view').screenshot({path:path.join(output,`${world}-mixed-side.png`)});
   row.images.push(`${world}-mixed-side.png`);
   await page.locator('#game-container').click({position:{x:450,y:320}});
   const moveBefore=await page.evaluate(()=>window.__assimilationStudy.snapshot().player);
   await page.keyboard.down('s');await page.waitForTimeout(300);await page.keyboard.up('s');
   const moveAfter=await page.evaluate(()=>window.__assimilationStudy.snapshot().player);
   assert(Math.hypot(moveAfter.x-moveBefore.x,moveAfter.y-moveBefore.y)>1,'real movement');
   row.checks.push('actual movement with material active');
   if(world!=='haven'){await page.keyboard.press('Space');await page.waitForTimeout(100);row.checks.push('actual held-tool attack smoke');}
   const before=await page.evaluate(()=>window.__assimilationStudy.snapshot());
   await page.waitForTimeout(2300);
   const after=await page.evaluate(()=>window.__assimilationStudy.snapshot());
   assert(after.state.seconds>before.state.seconds+1,'live material time advances');
   row.checks.push('live continuous material clock');
   await page.evaluate(()=>window.__assimilationStudy.pause(true));
   const frozen=await page.evaluate(()=>window.__assimilationStudy.snapshot());
   await page.waitForTimeout(350);
   assert.equal((await page.evaluate(()=>window.__assimilationStudy.snapshot())).state.seconds,frozen.state.seconds);
   row.checks.push('pause freezes material time');
   await page.evaluate(()=>{window.__assimilationStudy.pause(false);window.__assimilationStudy.inspector(false);});
   // Alternate paired intervals; same camera/geometry. Detail readback disabled.
   for(const a of[0,.9,0,.9]){
    await page.evaluate(a=>{window.__assimilationStudy.set(a,.5,true);window.__assimilationStudy.clearSamples();},a);
    await page.waitForTimeout(400);
    const start=await page.evaluate(()=>window.__assimilationStudy.snapshot());
    await page.waitForTimeout(2000);
    const end=await page.evaluate(()=>window.__assimilationStudy.snapshot());
    const count=end.metrics.count-start.metrics.count;
    row.performance.push({amount:a,count,meanCpuMs:count?(end.metrics.totalMs-start.metrics.totalMs)/count:null,
     cpuP95Ms:end.cpuP95,frameMedianMs:end.frameP50,frameP95Ms:end.frameP95,maskBytes:end.metrics.maskBytes,preparedFrames:end.metrics.preparedFrames});
   }
   await page.evaluate(()=>{window.__assimilationStudy.inspector(true);window.__assimilationStudy.set(.9,.5,true);});
   await page.waitForTimeout(100);
   await page.screenshot({path:path.join(output,`${world}-page.png`),fullPage:true});
   row.snapshot=await page.evaluate(()=>window.__assimilationStudy.snapshot());
   row.browserWrites=await page.evaluate(()=>window.__saveWrites);
   assert.equal(row.browserWrites.length,0,`no browser storage writes: ${row.browserWrites.join(',')}`);
   row.checks.push('zero browser storage writes');
   console.log('PASS',world,JSON.stringify(row.performance));
  }catch(error){row.failure=String(error);console.error('FAIL',world,error);await page.screenshot({path:path.join(output,`${world}-failure.png`)});}
  finally{await persist();await context.close();}
 }
}finally{await browser.close();await persist();}
if(report.errors.length||report.worlds.some(w=>w.failure))process.exitCode=1;
