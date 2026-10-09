/** Bounded integration over the real PurificationScene + inventoryPanel.
 * Fresh Chromium contexts, DEV BuildLabMemoryStorage; no user browser or save.
 * Five fixture cases + three genuine preparation/entry cases, no outcome replay.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out=process.env.QA_OUTPUT??`docs/qa/artifacts/preparation-ui-2026-10-09/run-${Date.now()}`;
assert.ok(!fs.existsSync(out),`Refusing to replace evidence: ${out}`); fs.mkdirSync(out,{recursive:true});
const sourceFiles=['tools/inventory/check-preparation-ui.mjs','src/ui/dom/inventory-panel.ts','src/ui/dom/inventory-panel-styles.ts','src/ui/inventory-presenter.ts','src/dev/prepare-review.ts','prepare-review.html','src/scenes/purification-scene.ts','docs/specs/system-field-inventory.md'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources=()=>sourceFiles.map(file=>({file,sha256:sha(file)}));
const report={startedAt:new Date().toISOString(),status:'running',scope:'Five declared UI fixtures and three real isolated departures; no natural economic or release acceptance.',sourceBefore:sources(),cases:[],failures:[],screenshots:[]};
fs.copyFileSync(import.meta.filename,path.join(out,'test-source.mjs'));
const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));write();
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});report.browser=browser.version();
const url=process.env.GAME_URL??'http://127.0.0.1:3027';
const state=page=>page.evaluate(()=>window.__prepareReview.getState());
const view=page=>page.locator('#inventory-panel').getAttribute('data-prepare-view');
const capture=async(page,name)=>{const file=`${name}.png`;await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);};
async function stable(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function opened(page){await page.waitForFunction(()=>window.__prepareReview?.getState().ready&&document.querySelector('#inventory-panel.is-prepare'));await page.waitForFunction(()=>!window.__game.scene.getScene('PurificationScene').interactionFocusTween);await page.waitForTimeout(180);}
async function isolated(page){
  const probe=await page.evaluate(()=>window.__qaStorageProbe.sample());
  assert.deepEqual(probe.values,probe.seed,'DEV must not change formal localStorage sentinels');
  assert.deepEqual(probe.calls.filter(call=>call.method==='clear'||call.key?.startsWith('coh-save')||call.key==='qa-preparation-sentinel'),[],'DEV must not read or write formal localStorage save keys');
  assert.deepEqual(probe.calls,[],'The DEV page must isolate preference and atmosphere storage too, before module imports');
  return probe;
}
async function commonLayout(page,record){
  const result=await page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const panel=document.querySelector('#inventory-panel'),primary=panel.querySelector('.inventory-primary'),b=primary.getBoundingClientRect();
    const h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
    return {panel:rect(panel),footer:rect(panel.querySelector('.inventory-bottom')),primary:rect(primary),reachable:!!h&&primary.contains(h),overlay:!!panel.closest('#dom-ui-root'),horizontalOverflow:panel.scrollWidth>panel.clientWidth+1,viewportOverflow:(()=>{const v=panel.querySelector('.inventory-prepare-viewport');return v.scrollWidth>v.clientWidth+1||v.scrollHeight>v.clientHeight+1;})(),slots:[...panel.querySelectorAll('.inventory-slot')].map(slot=>({id:slot.dataset.slotId,rect:rect(slot),parts:[...slot.children].filter(n=>n.className!=='inventory-slot-icon').map(n=>({className:n.className,text:n.textContent,rect:rect(n),scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}))}))};
  });
  record.layouts??=[];record.layouts.push({view:await view(page),...result});
  assert.ok(result.overlay,'The game panel must mount in the production overlay root');
  assert.equal(result.horizontalOverflow,false);assert.equal(result.viewportOverflow,false);
  assert.ok(result.reachable,'Footer action must remain reachable');assert.ok(result.primary.x>=0&&result.primary.y>=0&&result.primary.right<=960.5&&result.primary.bottom<=640.5);
  const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
  for(const slot of result.slots){for(let i=0;i<slot.parts.length;i++){const p=slot.parts[i];assert.ok(p.rect.bottom<=slot.rect.bottom+.5,`${slot.id} ${p.className} exceeds slot`);for(const q of slot.parts.slice(i+1))assert.equal(overlap(p.rect,q.rect),false,`${slot.id}: ${p.className} overlaps ${q.className}`);}}
  for(let i=1;i<result.slots.length;i++)assert.equal(overlap(result.slots[i-1].rect,result.slots[i].rect),false,'Adjacent slots must not overlap');
  assert.equal(await page.locator('.inventory-player-portrait').count(),0);
  assert.ok(await page.evaluate(()=>!!window.__game.scene.getScene('PurificationScene').player));
}
async function noOrdinaryDeparture(page){
  const before=await state(page);await page.locator('.inventory-primary').focus();
  for(const key of ['Enter','Space']){await page.keyboard.down(key);await page.keyboard.down(key);await page.keyboard.up(key);}
  await stable(page);const after=await state(page);assert.equal(after.activeScene,'PurificationScene');assert.deepEqual(after.run,before.run);assert.equal(after.cycle,before.cycle);assert.deepEqual(after.equipment,before.equipment);
}
async function returnMemory(page){await page.locator('.inventory-prepare-back').click();assert.equal(await view(page),'overview');await page.locator('.inventory-prepare-edit').click();assert.equal(await view(page),'equipment');await stable(page);}
async function positionHint(page){
  const result=await page.locator('.inventory-list[data-lane=main]').evaluate(list=>{const box=list.getBoundingClientRect();const all=[...list.querySelectorAll('.inventory-item')];const visible=all.map((node,i)=>({index:i+1,rect:node.getBoundingClientRect()})).filter(item=>item.rect.bottom>box.top+.5&&item.rect.top<box.bottom-.5);return {count:all.length,first:visible[0]?.index??0,last:visible.at(-1)?.index??0,hint:list.parentElement.querySelector('.inventory-position').textContent};});
  if(result.count) {const numbers=result.hint.match(/\d+/g)?.map(Number);assert.deepEqual(numbers,[result.first,result.last,result.count],`Visible position must count both columns: ${JSON.stringify(result)}`);}return result;
}
async function test(name,fixture,callback){
  const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:1});
  await context.addInitScript(()=>{
    const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem,clear=proto.clear,nativeStorage=localStorage;
    const seed={'coh-save-v1':'qa-save-sentinel-never-load','coh-save-v1:previous':'qa-previous-sentinel-never-load','qa-preparation-sentinel':'qa-preparation-opaque','coh.atmosphere.v1':'qa-atmosphere-never-load','coh.locale.v1':'qa-locale-never-load'};
    for(const [key,value]of Object.entries(seed))set.call(nativeStorage,key,value);
    const calls=[];for(const [method,fn]of [['getItem',get],['setItem',set],['removeItem',remove],['clear',clear]])proto[method]=function(...args){if(this===nativeStorage)calls.push({method:method==='clear'?'clear':method,key:args[0]??null});return fn.apply(this,args);};
    window.__qaStorageProbe={sample:()=>({seed,values:Object.fromEntries(Object.keys(seed).map(key=>[key,get.call(nativeStorage,key)])),calls:[...calls]})};
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const record={name,fixture,status:'running',errors};report.cases.push(record);
  try{
    await page.goto(`${url}/prepare-review.html?fixture=${fixture}`);await opened(page);
    record.initial=await state(page);
    if(!report.environment)report.environment=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},gpu:ext?{vendor:gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}:null};});
    await capture(page,`${name}-overview`);
    assert.equal(await view(page),'overview');assert.equal(await page.locator('.inventory-item:visible').count(),0);
    assert.equal(await page.locator('.inventory-detail:visible').count(),0);await commonLayout(page,record);
    await callback(page,record);
    record.storage=await isolated(page);assert.deepEqual(errors,[]);record.status='passed';
  }catch(error){record.status='failed';record.failure={message:error.message,stack:error.stack};report.failures.push({case:name,...record.failure});await capture(page,`${name}-failure`).catch(()=>{});try{record.failureState=await state(page);record.storage=await isolated(page);}catch(storageError){record.secondaryFailure=storageError.message;}}
  finally{await context.close();record.finishedAt=new Date().toISOString();write();console.log(`${record.status.toUpperCase()} ${name}${record.failure?`: ${record.failure.message}`:''}`);}
}
try{
 await test('starter','starter',async(page,record)=>{
   const s=await state(page);assert.ok(s.equipment.weaponId);assert.ok(s.equipment.toolIds.every(id=>id===null));assert.equal(await page.locator('.inventory-primary').isDisabled(),false);await noOrdinaryDeparture(page);
   const empty=page.locator('.inventory-slot').filter({hasText:'未装配'}).first();await empty.click();assert.equal(await view(page),'equipment');assert.equal(await page.locator('.inventory-filter.is-current').innerText(),'污染物');assert.match(await page.locator('.inventory-message').innerText(),/空工具位不妨碍出发/);await commonLayout(page,record);await noOrdinaryDeparture(page);
   await page.keyboard.press('Escape');assert.equal(await view(page),'overview');
   const focusTrace=()=>page.evaluate(()=>{const s=window.__game.scene.getScene('PurificationScene'),t=s.interactionFocusTween;return {wall:performance.now(),sceneTime:s.time.now,focused:document.hasFocus(),hidden:document.hidden,sceneActive:s.scene.isActive(),inputEnabled:s.player.exportRuntimeState().inputEnabled,camera:s.probeJourneyState().camera,tween:t?{progress:t.progress,totalProgress:t.totalProgress,elapsed:t.elapsed,playing:t.isPlaying()}:null};});
   record.exitFocus=[await focusTrace()];await page.keyboard.press('Escape');await page.waitForSelector('#inventory-panel',{state:'detached'});await page.waitForTimeout(260);record.exitFocus.push(await focusTrace());await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').player.exportRuntimeState().inputEnabled);record.exitFocus.push(await focusTrace());assert.equal(record.exitFocus.at(-1).tween,null,'Input resumes only after production focus return completes');
   record.closed=await state(page);assert.equal(record.closed.activeScene,'PurificationScene');assert.equal(record.closed.journey.panels.inventory,false);assert.ok(await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').player.exportRuntimeState().inputEnabled));
   await page.evaluate(()=>window.__prepareReview.open());await opened(page);await page.locator('.inventory-prepare-edit').click();await page.locator('.inventory-close').click();await page.waitForSelector('#inventory-panel',{state:'detached'});assert.equal((await state(page)).activeScene,'PurificationScene');
 });
 await test('equipped','equipped',async(page,record)=>{
   const start=await state(page);record.gradeChecks=[];
   for(const grade of ['low','medium','severe']){await page.locator(`[data-departure-grade=${grade}]`).click();await page.waitForTimeout(180);assert.equal((await state(page)).grade,grade);assert.equal(await page.locator('[data-departure-grade][tabindex="0"]').count(),1);await capture(page,`overview-${grade}`);record.gradeChecks.push({grade,text:await page.locator('.inventory-grade-facts').innerText()});}
   await page.locator('[data-departure-grade=low]').hover();assert.equal((await state(page)).grade,'severe');
   await page.locator('[data-departure-grade=severe]').focus();await page.keyboard.press('ArrowDown');assert.equal((await state(page)).grade,'severe');await page.keyboard.press('Home');assert.equal((await state(page)).grade,'low');await page.keyboard.press('ArrowUp');assert.equal((await state(page)).grade,'low');await page.keyboard.press('ArrowDown');assert.equal((await state(page)).grade,'medium');await page.keyboard.press('Space');assert.equal((await state(page)).grade,'medium');await page.keyboard.press('End');assert.equal((await state(page)).grade,'severe');await page.keyboard.press('Enter');assert.equal((await state(page)).grade,'severe');
   const after=await state(page);assert.deepEqual(after.inventory,start.inventory);assert.deepEqual(after.base,start.base);assert.deepEqual(after.run,start.run);assert.deepEqual(after.journey.camera,start.journey.camera);
   const footer=await page.locator('.inventory-bottom').boundingBox();assert.equal(await page.locator('.inventory-prepare-conditions').getAttribute('open'),null);await page.locator('.inventory-prepare-conditions summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.inventory-prepare-conditions[open]').count(),1);assert.deepEqual(await page.locator('.inventory-bottom').boundingBox(),footer);assert.equal(await page.locator('.inventory-departure-conditions>div').count(),3);await capture(page,'conditions-expanded');await noOrdinaryDeparture(page);
   await page.locator('.inventory-prepare-edit').click();await stable(page);await commonLayout(page,record);record.position=await positionHint(page);await noOrdinaryDeparture(page);
   await page.locator('[data-item-id="prepare-fixture-4"]').click();const unknown=await page.locator('.inventory-detail').innerText();assert.doesNotMatch(unknown,/无门灯笼|doorless_lantern|照明\d|探查\d/);assert.match(unknown,/揭晓/);assert.equal(await page.locator('.inventory-detail-uses').count(),0);record.unknownDetail=unknown;
   const runPassive=start.inventory.find(item=>item.useUnit==='趟');assert.ok(runPassive,'Equipped fixture must exercise a genuine run-scope passive');await page.locator(`[data-item-id="${runPassive.id}"]`).click();assert.match(await page.locator('.inventory-detail-uses').innerText(),/剩余趟数/);assert.match(await page.locator('.inventory-slot').last().innerText(),/余趟/);
   await page.evaluate(async()=>{const module=async p=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name);const {inventoryStore}=await module('/src/systems/inventory-store.ts');inventoryStore.addContaminant({id:'qa-legacy-event-passive',type:'muffle',rarity:'common',stage:'tool',usesRemaining:3,impactCharges:3});});
   await page.locator('[data-item-id="qa-legacy-event-passive"]').click();await page.getByRole('button',{name:'装到 被动',exact:true}).click();assert.match(await page.locator('.inventory-slot').last().innerText(),/余次 3/);assert.doesNotMatch(await page.locator('.inventory-slot').last().innerText(),/余趟/);assert.match(await page.locator('.inventory-detail-uses').innerText(),/剩余次数/);assert.doesNotMatch(await page.locator('.inventory-detail').innerText(),/整趟被动|剩余趟数/);record.consumptionUnits={catalogRunPassive:runPassive.id,legacyEventPassive:'qa-legacy-event-passive'};
 });
 await test('expanded','expanded',async(page,record)=>{
   assert.equal(await page.locator('.inventory-slot').count(),5);await capture(page,'expanded');
   for(const slot of (await page.locator('.inventory-slot').evaluateAll(nodes=>nodes.map(n=>n.dataset.slotId)))){await page.locator(`[data-slot-id="${slot}"]`).click();assert.equal(await view(page),'equipment');assert.equal(await page.locator('.inventory-filter.is-current').innerText(),slot==='weapon'?'武器':'污染物');assert.ok(await page.locator('.inventory-item.is-looking').count());await commonLayout(page,record);await page.keyboard.press('Escape');}
   assert.equal(await view(page),'overview');
 });
 await test('long','long',async(page,record)=>{
   await page.locator('.inventory-prepare-edit').click();await stable(page);await commonLayout(page,record);record.position=await positionHint(page);
   const list=page.locator('.inventory-list[data-lane=main]');const ids=await list.locator('.inventory-item').evaluateAll(nodes=>nodes.map(n=>n.dataset.itemId));assert.ok(ids.length>=60);
   await list.locator('.inventory-item').first().click();for(const [key,index]of [['ArrowRight',1],['ArrowDown',3],['ArrowLeft',2],['ArrowUp',0],['PageDown',6],['PageUp',0],['End',ids.length-1],['Home',0]]){await page.keyboard.press(key);assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),ids[index],key);}
   const selected=await page.locator('.inventory-item.is-looking').getAttribute('data-item-id');await list.hover();await page.mouse.wheel(0,850);await page.waitForTimeout(180);const scrolled=await list.evaluate(n=>n.scrollTop);assert.ok(scrolled>200);assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),selected);await returnMemory(page);assert.equal(await list.evaluate(n=>n.scrollTop),scrolled,'Wheel-only list position must survive overview→editor without jumping to the old selection');assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),selected);record.wheelReturn={selected,scroll:scrolled};
   await page.getByRole('button',{name:'污染物',exact:true}).click();await page.locator('.inventory-sort').selectOption('name');const items=(await state(page)).inventory.filter(i=>i.kind==='contaminant'&&i.usesRemaining!==undefined);const longest=items.sort((a,b)=>((b.explanations??[]).reduce((s,x)=>s+x.text.length,0)+(b.description??'').length)-((a.explanations??[]).reduce((s,x)=>s+x.text.length,0)+(a.description??'').length))[0];await page.locator(`[data-item-id="${longest.id}"]`).click();
   for(const summary of await page.locator('.inventory-explanation summary').all())await summary.click();await stable(page);
   const detail=page.locator('.inventory-detail');const overflow=await detail.evaluate(n=>({height:n.clientHeight,scroll:n.scrollHeight,top:n.scrollTop}));assert.ok(overflow.scroll>overflow.height,'Declared long fixture must actually overflow detail');assert.match(await page.locator('.inventory-detail-hint').innerText(),/滚动|向上/,'Actual overflow must expose a scroll hint');await detail.hover();await page.mouse.wheel(0,500);await page.waitForTimeout(150);
   const memory={detail:await detail.evaluate(n=>n.scrollTop),list:await list.evaluate(n=>n.scrollTop),selected:await page.locator('.inventory-item.is-looking').getAttribute('data-item-id')};assert.ok(memory.detail>0);await returnMemory(page);assert.equal(await detail.evaluate(n=>n.scrollTop),memory.detail);assert.equal(await list.evaluate(n=>n.scrollTop),memory.list);assert.equal(await page.locator('.inventory-sort').inputValue(),'name');assert.equal(await page.locator('.inventory-filter.is-current').innerText(),'污染物');assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),memory.selected);record.detailReturn=memory;await commonLayout(page,record);await capture(page,'long-editor');
 });
 await test('blocked','blocked',async(page,record)=>{
   assert.equal((await state(page)).equipment.weaponId,null);assert.equal(await page.locator('.inventory-primary').isDisabled(),true);assert.match(await page.locator('.inventory-message').innerText(),/武器|撬棍/);const before=await state(page);await page.keyboard.press('Shift+Enter');assert.equal((await state(page)).activeScene,'PurificationScene');assert.equal((await state(page)).cycle,before.cycle);await page.locator('[data-slot-id=weapon]').click();assert.equal(await page.locator('.inventory-filter.is-current').innerText(),'武器');assert.equal(await view(page),'equipment');await commonLayout(page,record);await capture(page,'blocked-weapon');
 });
 for(const [i,grade]of ['low','medium','severe'].entries())await test(`departure-${grade}`,'starter',async(page,record)=>{
   await page.locator(`[data-departure-grade=${grade}]`).click();if(i===1)await page.locator('.inventory-prepare-edit').click();await noOrdinaryDeparture(page);const before=await state(page);
   if(i===0)await page.locator('.inventory-primary').click();else{await page.keyboard.down('Shift');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await page.keyboard.up('Shift');}
   await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'),{},{timeout:30000});await stable(page);
   const entry=await page.evaluate(async()=>{const load=async p=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name);const {saveManager}=await load('/src/managers/save-manager.ts');return {state:window.__prepareReview.getState(),save:saveManager.captureLoadSnapshot()};});
   const identity=entry.save.checkpoint?.identity??entry.save.departure?.identity;assert.ok(identity,'Genuine Rift entry must commit identity');assert.equal(identity.generation.nativeDefinition.grade,grade);assert.equal(entry.state.cycle,before.cycle+1);assert.ok(entry.state.run?.runId??entry.state.run?.id);record.entry=entry;await capture(page,`rift-${grade}`);await page.waitForTimeout(180);assert.equal((await state(page)).cycle,entry.state.cycle,'Repeated ShiftEnter must not create a second departure');
 });
}finally{await browser.close();report.sourceAfter=sources();if(JSON.stringify(report.sourceBefore)!==JSON.stringify(report.sourceAfter))report.failures.push({case:'source-binding',message:'Source changed during run; result is not a stable source acceptance.'});report.finishedAt=new Date().toISOString();report.status=report.failures.length?'failed':'passed-bounded-preparation-ui';write();}
if(report.failures.length)process.exitCode=1;
console.log(JSON.stringify({status:report.status,cases:report.cases.length,failures:report.failures.length,output:out}));
