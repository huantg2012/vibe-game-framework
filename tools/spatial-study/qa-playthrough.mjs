/** Public URL setup + real keyboard/mouse + read-only production observations. No world manipulation. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const mode=process.env.CASE??'r1-b',view=mode.endsWith('-a')?'a':'b',revision2=mode.startsWith('v2-');
const dir=path.join(process.env.ARTIFACT_DIR??'docs/qa/artifacts/iteration-21-spatial',...(revision2?['r2-volume',mode]:[mode]));await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir,size:{width:1080,height:720}}});
assert.deepEqual(await context.storageState(),{cookies:[],origins:[]});
const page=await context.newPage(),held=new Set();const evidence={mode,method:'Empty incognito setup; real keys only; read-only world/projection/phase samples; natural clock.',observations:[],checks:[],errors:[]};
page.on('pageerror',e=>evidence.errors.push(e.message));
const base=process.env.GAME_URL??'http://127.0.0.1:3000';
await page.goto(base+'/spatial-study.html?autostart=0');
await page.evaluate(()=>{if(localStorage.getItem('coh-save-v1')!==null)throw Error('Refuse to overwrite existing save');localStorage.setItem('coh-save-v1','spatial-qa-isolated-original-record');});
async function observe(label){const s=await page.evaluate(()=>window.__spatialStudy.getState());if(label)evidence.observations.push({label,...s});return s;}
async function release(){for(const k of held)await page.keyboard.up(k);held.clear();}
async function key(k,ms=100){await page.keyboard.down(k);await page.waitForTimeout(ms);await page.keyboard.up(k);}
async function move(axis,target,timeout=13000){const s=await observe(),sign=target>s.snapshot.player[axis]?1:-1;const k=axis==='x'?sign>0?'d':'a':sign>0?'s':'w';await page.keyboard.down(k);held.add(k);let end=Date.now()+timeout;try{while(Date.now()<end){const q=await observe();if(q.snapshot.ended)throw Error('Run ended during walk');if(sign*(target-q.snapshot.player[axis])<=2)return;await page.waitForTimeout(55);}throw Error('Blocked '+axis+'='+target+' '+JSON.stringify((await observe()).snapshot.player));}finally{await release();}}
async function cap(label){await observe(label);await page.screenshot({path:path.join(dir,label+'.png')});}
async function until(predicate,label,timeout=13000){const end=Date.now()+timeout;while(Date.now()<end){const s=await observe();if(predicate(s))return s;await page.waitForTimeout(35);}throw Error('Timed out '+label);}
async function safeWater(){await until(s=>s.spatial.water.phase==='quiet','safe water window');}
async function sentinel(label){assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),'spatial-qa-isolated-original-record');evidence.checks.push('save intact: '+label);}
async function settle(){await move('y',880);await key('e',1700);await until(s=>s.inventory.run?.status==='settled','real settlement',4000);await page.waitForTimeout(100);assert.equal((await observe()).inventory.run.outcome,'extract');await cap('90-extracted');await sentinel('extract');}
async function attackExistingEnemy(){
 for(let i=0;i<12&&(await observe()).snapshot.enemies.length;i++){const q=(await observe()).snapshot;const d={x:q.enemies[0].position.x-q.player.x,y:q.enemies[0].position.y-q.player.y};const keys=[];if(Math.abs(d.x)>Math.abs(d.y)*.42)keys.push(d.x>0?'d':'a');if(Math.abs(d.y)>Math.abs(d.x)*.42)keys.push(d.y>0?'s':'w');for(const k of keys){await page.keyboard.down(k);held.add(k);}await page.waitForTimeout(450);await release();await key('Space');await page.waitForTimeout(650);}
 assert.equal((await observe()).snapshot.enemies.length,0,'Real attack must kill production enemy');
}
async function runRevision2(){
 const q=await observe();assert.equal(q.spatial.water.definition.footprint,'ellipse');assert.equal(q.spatial.water.definition.width,144);assert.equal(q.spatial.water.definition.depth,88);assert.deepEqual(q.spatial.sea.reef,{x:816,y:528,height:310});assert.equal(q.spatial.projection.compression,view==='b'?.52:1);assert.equal((await page.evaluate(()=>window.__spatialStudy.getRecords()))[0].gameplay.metadata.presentationRevision,'r2-volume-rework');
 if(mode.startsWith('v2-death')){await until(s=>s.spatial.water.phase==='falling','death contact');await move('y',544);await until(s=>s.snapshot.ended,'real R2 water death',45000);await page.waitForFunction(()=>window.__spatialStudy.getRecords().some(r=>r.gameplay.outcome==='death'),null,{timeout:5000});await cap('90-water-death');assert.equal((await observe()).inventory.items.length,0);await sentinel('death');return;}
 if(mode.startsWith('v2-visual')){
   evidence.visualVerdict='NOT-REVIEWED: script completion is not visual approval';await cap('03-stationary-body-start');await page.waitForTimeout(20500);await cap('04-stationary-two-cycles');
   await move('x',920);await move('y',624);await cap('05-reef-front');await move('x',872);await move('y',440);await move('x',816);await cap('06-reef-behind');await move('x',760);await move('y',600);await move('x',816);await cap('07-reef-front-return');
   await move('x',720);await move('y',336);await move('x',528);await move('y',208);await cap('08-deep-cover');
   await page.locator('#abort').click();await sentinel('visual route abort');return;
 }
 if(mode.startsWith('v2-reef')){
   let s=await observe();const e=s.snapshot.enemies[0].position;const t=(570-528)/(570-e.y);const px=(816-t*e.x)/(1-t);assert(px>816&&px<950);await move('x',px);await move('y',570);await cap('03-reef-south-occlusion');s=await observe();evidence.reefOcclusionGeometry=s.snapshot.enemies.map(e=>({id:e.id,visible:e.visible,atReefY:s.snapshot.player.x+(e.position.x-s.snapshot.player.x)*(528-s.snapshot.player.y)/(e.position.y-s.snapshot.player.y)}));
   await move('x',872);await move('y',464);await move('x',816);await cap('04-reef-north');await move('x',760);await move('y',600);await move('x',816);await cap('05-reef-south-return');
   evidence.visualVerdict='NOT-REVIEWED: inspect physical occlusion and target visibility, do not infer from script';await page.locator('#abort').click();return;
 }
 // Same authoritative world, now open without the former parallel walls. No stale x816 reef crossing.
 await move('x',652);await move('y',580);await until(s=>s.spatial.water.phase==='falling','ellipse corner active');const before=(await observe()).spatial.water.committedHits;await page.waitForTimeout(400);await cap('03-old-rectangle-corner-safe');assert.equal((await observe()).spatial.water.inside,false);assert.equal((await observe()).spatial.water.committedHits,before);
 await move('y',624);await move('x',592);await safeWater();await move('y',440);await cap('04-safe-crossing');assert.equal((await observe()).spatial.water.committedHits,0);
 await move('y',380);await attackExistingEnemy();await cap('05-combat');await move('y',336);await move('x',816);await key('e',1800);await move('x',528);await move('y',208);await key('e',1800);await cap('06-deep-loot');
 for(let i=0;i<3;i++){await move('x',496);await move('x',560);}await cap('07-deep-lateral');
 await move('x',720);await move('y',624);await move('x',592);await until(s=>s.spatial.water.phase==='falling','actual contact phase');await move('y',544);await until(s=>s.spatial.water.committedHits>0,'actual elliptical contact');await cap('08-actual-contact');await move('x',712);const hitCount=(await observe()).spatial.water.committedHits;await move('y',736);await cap('09-dry-bypass');assert.equal((await observe()).spatial.water.committedHits,hitCount);
 await move('x',592);await settle();assert((await observe()).inventory.run.returnedIds.length>0);
}
try{
 await page.goto(`${base}/spatial-study.html?view=${view}&seed=7`);await page.waitForFunction(()=>window.__spatialStudy?.getState().snapshot?.enemies?.length);
 await page.locator('#game-container canvas').click();await cap('01-spawn');await sentinel('boot');
 await page.evaluate(()=>{window.__qaFrames=[];let last;function frame(t){if(last!==undefined&&window.__qaFrames.length<12000)window.__qaFrames.push(t-last);last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await move('y',revision2?660:600);await cap('02-sea-edge');
 if(revision2){await runRevision2();}else if(mode.startsWith('r1')){
   await until(s=>s.spatial.water.phase==='falling','visible falling');await cap('03-observed-danger');await safeWater();await move('y',440);await cap('04-safe-crossing');assert.equal((await observe()).spatial.water.committedHits,0);
   await move('y',380);await cap('05-before-combat');
   for(let i=0;i<12&&(await observe()).snapshot.enemies.length;i++){const q=(await observe()).snapshot;const d={x:q.enemies[0].position.x-q.player.x,y:q.enemies[0].position.y-q.player.y};const keys=[];if(Math.abs(d.x)>Math.abs(d.y)*.42)keys.push(d.x>0?'d':'a');if(Math.abs(d.y)>Math.abs(d.x)*.42)keys.push(d.y>0?'s':'w');for(const k of keys){await page.keyboard.down(k);held.add(k);}await page.waitForTimeout(450);await release();await key('Space');await page.waitForTimeout(650);}
   await cap('06-after-real-attacks');assert.equal((await observe()).snapshot.enemies.length,0,'Actual weapon must kill the production enemy');
   await move('y',336);await move('x',816);await key('e',1800);await move('x',528);await move('y',208);await key('e',1800);await cap('07-deep-loot');assert((await observe()).spatial.sea.underProjectedCover);
   for(let i=0;i<3;i++){await move('x',496);await move('x',560);}await cap('08-deep-lateral');
   const p=(await observe()).spatial;const boundary=p.sea.frontY-p.sea.bottomHeight*p.projection.heightProjection;
   for(let i=0;i<3;i++){await move('y',boundary+14);await move('y',boundary-14);}await cap('09-cover-return');
   await move('x',592);await move('y',480);await safeWater();await move('y',600);await settle();
   assert((await observe()).inventory.run.returnedIds.length>0,'Actual contaminant must return');
 }else{
   await until(s=>s.spatial.water.phase==='falling','active curtain');await move('y',544);await until(s=>s.spatial.water.committedHits>0,'actual environmental damage',3500);await cap('03-hazard-contact');
   if(mode.startsWith('death')){
     await until(s=>s.snapshot.ended,'actual environmental death',45000);await page.waitForFunction(()=>window.__spatialStudy.getRecords().some(r=>r.gameplay.outcome==='death'),null,{timeout:5000});await page.waitForTimeout(250);await cap('90-water-death');const s=await observe();assert.equal(s.inventory.run.outcome,'death');assert.equal(s.inventory.items.length,0);await sentinel('death');
   }else{
     await move('y',736);const hits=(await observe()).spatial.water.committedHits;
     await move('x',384);await move('y',440);await cap('04-dry-bypass');assert.equal((await observe()).spatial.water.committedHits,hits,'Dry bypass must not receive curtain damage');
     await move('y',208);await cap('05-covered-unknown');assert((await observe()).spatial.targets.every(t=>t.visibility===0),'Far enemy must remain unknown under cut');
     await move('x',528);await key('e',1800);await cap('06-real-loot');await move('x',656);await move('y',280);await cap('07-legal-visible');assert((await observe()).spatial.targets.some(t=>t.visibility>0),'Near enemy must become legally visible');
     await move('y',208);await move('x',128);await cap('08-returned-unknown');assert((await observe()).spatial.targets.every(t=>t.visibility===0),'Enemy must disappear again after moving away');
     await move('y',736);await move('x',592);await settle();assert((await observe()).inventory.run.returnedIds.length>0);
   }
 }
 await sentinel('final');
 if(mode==='r2-a'||mode==='v2-death-b'){
   evidence.routeRecords=await page.evaluate(()=>window.__spatialStudy.getRecords());evidence.routeFrameTimes=await page.evaluate(()=>window.__qaFrames??[]);
   await key('r');await until(s=>!s.running,'return config',3000);await sentinel('R return');
   await page.locator('#view').selectOption(mode==='v2-death-b'?'a':'b');await page.locator('#start').click();await until(s=>s.running&&s.snapshot?.elapsedMs>50,'switch A to B');await sentinel('switch/restart');if(mode==='v2-death-b'){assert.equal((await observe()).spatial.projection.heightProjection,0);await cap('93-true-top-down');}
   await page.locator('#game-container canvas').click();await key('Escape');await until(s=>s.paused,'pause');const t=(await observe()).snapshot.elapsedMs;await page.waitForTimeout(300);assert.equal((await observe()).snapshot.elapsedMs,t);await sentinel('pause');await key('Escape');
   await page.locator('#abort').click();await until(s=>!s.running,'abort');await sentinel('abort');
   await page.locator('#start').click();await until(s=>s.running,'restart');await sentinel('restart');
   await page.reload();await page.waitForFunction(()=>window.__spatialStudy?.getState().snapshot);await sentinel('refresh');await cap('95-lifecycle-refreshed');
 }
 if(revision2){const records=evidence.routeRecords??await page.evaluate(()=>window.__spatialStudy.getRecords());for(const record of records)for(const sample of record.space){const b=sample.footprint;assert.equal(b.width,20);assert.equal(b.height,20);assert(Math.abs(sample.player.groundY-sample.player.y-10)<.0001);assert(!(b.x<832-.0001&&b.x+b.width>800+.0001&&b.y<544-.0001&&b.y+b.height>512+.0001),'Actual player footprint cannot overlap solid reef');}evidence.checks.push('all recorded player footprints preserve body and avoid solid reef');}
 assert.deepEqual(evidence.errors,[]);evidence.passed=true;
}catch(e){evidence.passed=false;evidence.failure=String(e.stack??e);console.error(evidence.failure);}
finally{
 await release().catch(()=>{});evidence.lifecycleRecords=await page.evaluate(()=>window.__spatialStudy?.getRecords()).catch(()=>null);evidence.records=evidence.routeRecords??evidence.lifecycleRecords;
 evidence.frameTimes=evidence.routeFrameTimes??await page.evaluate(()=>window.__qaFrames??[]).catch(()=>[]);
 const sorted=evidence.frameTimes.slice().sort((a,b)=>a-b);evidence.performance={sampleCount:sorted.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),over50ms:sorted.filter(x=>x>50).length,scope:'headless Chrome on current development host, recording enabled; not representative hardware certification'};
 await page.screenshot({path:path.join(dir,'99-final.png')}).catch(()=>{});await writeFile(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));
 const video=page.video();await context.close();if(video)await rename(await video.path(),path.join(dir,'continuous.webm'));await browser.close();
 console.log(JSON.stringify({mode,passed:evidence.passed,failure:evidence.failure,performance:evidence.performance,summary:evidence.records?.map(r=>({outcome:r.gameplay.outcome,metrics:r.gameplay.metrics,run:r.gameplay.finalInventory.run,water:r.space.at(-1)?.water}))}));if(!evidence.passed)process.exitCode=1;
}
