/** Bounded native reconstruction and owned GPU/JS lifetime, isolated browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i06/lifecycle');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-precise-memory-info']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
const repetitions=Number(process.env.QA_REBUILDS??10);
const report={scope:'One persistent Phaser Game; source-family warmups then configured identical and mixed native reconstructions. Two actual GC calls before each retained sample. Weak references never retain scene objects. No GPU driver byte/RSS claim; retained WebGL object/context ownership and main-isolate memory only.',samples:[],mixedCoverage:[],errors:[]};
assert(Number.isInteger(repetitions)&&repetitions>=1&&repetitions<=100,'bounded identical rebuild count');
page.on('pageerror',e=>report.errors.push(String(e)));
await page.addInitScript(()=>{
 const rows=[],ids=new WeakMap();
 const track=(o,kind)=>{if(o&&!ids.has(o)){const row={ref:new WeakRef(o),kind,deleted:false,lost:false};rows.push(row);ids.set(o,row);}return o;};
 const wrap=(proto,name,after)=>{const fn=proto?.[name];if(typeof fn==='function')proto[name]=function(...a){return after(Reflect.apply(fn,this,a),this,a);};};
 wrap(HTMLCanvasElement.prototype,'getContext',(o,c,a)=>{if(a[0]==='webgl2')track(o,'WebGL2');return o;});
 for(const p of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
  for(const kind of ['Texture','Buffer','Program','Shader','Framebuffer','Renderbuffer']){
   wrap(p,'create'+kind,o=>track(o,kind));wrap(p,'delete'+kind,(v,c,a)=>{const row=ids.get(a[0]);if(row)row.deleted=true;return v;});
  }
  wrap(p,'getExtension',(v,c,a)=>{if(v&&a[0]==='WEBGL_lose_context'&&!ids.has(v)){ids.set(v,{});const original=v.loseContext;v.loseContext=function(...args){const row=ids.get(c);if(row)row.lost=true;return Reflect.apply(original,this,args);};}return v;});
 }
 window.__lifetimes={read(){const result={};for(const row of rows){const s=result[row.kind]??={created:0,live:0,active:0};s.created++;if(row.ref.deref()){s.live++;if(!row.deleted&&!row.lost)s.active++;}}return result;}};
});
async function select(world,grade,seed){
 const old=await page.locator('#world').inputValue();await page.locator('#seed').fill(String(seed));
 if(old!==world)await page.locator('#world').selectOption(world);
 else if(await page.locator('#grade').inputValue()!==grade)await page.locator('#grade').selectOption(grade);
 else await page.locator('#generate').click();
 await page.waitForFunction(({world,seed})=>{const s=window.__r100Gym.getState();return s.recipe?.package.id===`r100-${world}`&&s.recipe.requestedSeed===seed&&s.runtime.running&&!s.runtime.starting;},{world,seed},{timeout:60000});
 if(await page.locator('#grade').inputValue()!==grade){await page.locator('#grade').selectOption(grade);await page.waitForFunction(grade=>window.__r100Gym.getState().runtime.running&&window.__r100Gym.getState().recipe?.nativeDefinition.grade===grade,grade,{timeout:60000});}
 await page.waitForTimeout(500);await page.locator('#pause').click();
}
async function sample(label){
 await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(50);await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(50);
 const usage=await cdp.send('Runtime.getHeapUsage'),objects=await page.evaluate(()=>window.__lifetimes.read());
 report.samples.push({label,usage,objects});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
try{
 await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3060'}/r100-gym.html?world=ash-strata&grade=severe&seed=20261004`);
 await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
 for(const world of ['ash-strata','crystal-fibre','ivory-basin','cinder-ridge','pallid-membrane','silt-gel'])await select(world,'severe',20261004);
 await select('ash-strata','severe',20261004);await sample('warmed-baseline');
 for(let n=0;n<repetitions;n++){await select('ash-strata','severe',20261004);await sample(`identical-${n+1}`);}
 const worlds=await page.locator('#world option').evaluateAll(options=>options.map(o=>o.value));
 const mixed=process.env.QA_MIXED_REBUILDS===undefined?worlds.length*3:Number(process.env.QA_MIXED_REBUILDS);
 assert(worlds.length>0&&Number.isInteger(mixed)&&mixed>=1&&mixed<=worlds.length*9,'bounded mixed rebuild count');
 report.catalogWorldIds=worlds;report.repetitions=repetitions;report.mixedRebuilds=mixed;
 for(let n=0;n<mixed;n++){
  const world=worlds[n%worlds.length],grade=['low','medium','severe'][Math.floor(n/worlds.length)%3],seed=20261004+n;
  await select(world,grade,seed);report.mixedCoverage.push({world,grade,seed});
 }
 if(mixed>=worlds.length*3)assert.equal(new Set(report.mixedCoverage.map(row=>`${row.world}/${row.grade}`)).size,worlds.length*3,'every catalog world is rebuilt at all three grades');
 await select('ash-strata','severe',20261004);await sample(`after-mixed-${mixed}`);
 const baseline=report.samples[0];
 for(const row of report.samples){
  assert.equal(row.objects.WebGL2.active,baseline.objects.WebGL2.active,'no abandoned prepared or scene GL contexts');
  for(const kind of ['Texture','Buffer','Program','Framebuffer','Renderbuffer'])assert.equal(row.objects[kind]?.active??0,baseline.objects[kind]?.active??0,`${kind} active resource count after same-world return`);
  row.usedHeapGrowth=row.usage.usedSize-baseline.usage.usedSize;
  row.backingGrowth=(row.usage.backingStorageSize??0)-(baseline.usage.backingStorageSize??0);
  assert(row.usedHeapGrowth+Math.max(0,row.backingGrowth)<10*1024*1024,'same-world retained observation growth below 10 MiB budget');
 }
 assert.deepEqual(report.errors,[]);report.status='passed-bounded-lifecycle';
}catch(error){report.status='failed';report.failure=String(error);process.exitCode=1;console.error(error);}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
