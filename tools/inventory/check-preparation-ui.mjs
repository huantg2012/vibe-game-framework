/** Bounded integration over the real PurificationScene + inventoryPanel.
 * Fresh Chromium contexts, DEV BuildLabMemoryStorage; no user browser or save.
 * Five fixture cases + three genuine preparation/entry cases, no outcome replay.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out=process.env.QA_OUTPUT??`docs/qa/artifacts/preparation-flow-2026-10-09/run-${Date.now()}`;
assert.ok(!fs.existsSync(out),`Refusing to replace evidence: ${out}`); fs.mkdirSync(out,{recursive:true});
const sourceFiles=['tools/inventory/check-preparation-ui.mjs','src/ui/dom/inventory-panel.ts','src/ui/dom/inventory-panel-styles.ts','src/ui/inventory-presenter.ts','src/dev/prepare-review.ts','prepare-review.html','src/scenes/purification-scene.ts','docs/specs/system-field-inventory.md'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources=()=>sourceFiles.map(file=>({file,sha256:sha(file)}));
const report={startedAt:new Date().toISOString(),status:'running',scope:'Five declared fixtures, real catalogue parity, and three isolated two-step departures; no economic or release acceptance.',sourceBefore:sources(),cases:[],failures:[],screenshots:[]};
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
async function returnMemory(page){await page.locator('.inventory-prepare-back').click();assert.equal(await view(page),'pollution');await page.locator('[data-prepare-action=next]').click();assert.equal(await view(page),'equipment');await stable(page);}
async function positionHint(page){
  const result=await page.locator('.inventory-list[data-lane=main]').evaluate(list=>{const box=list.getBoundingClientRect();const all=[...list.querySelectorAll('.inventory-item')];const includePartial=list.closest('#inventory-panel').classList.contains('is-prepare');const visible=all.map((node,i)=>({index:i+1,rect:node.getBoundingClientRect()})).filter(item=>item.rect.bottom>box.top+.5&&(includePartial?item.rect.top<box.bottom-.5:item.rect.bottom<=box.bottom+.5));return {count:all.length,first:visible[0]?.index??0,last:visible.at(-1)?.index??0,hint:list.parentElement.querySelector('.inventory-position').textContent};});
  if(result.count) {const numbers=result.hint.match(/\d+/g)?.map(Number);assert.deepEqual(numbers,[result.first,result.last,result.count],`Visible position must count the actual single column: ${JSON.stringify(result)}`);}return result;
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
    await capture(page,`${name}-pollution`);
    assert.equal(await view(page),'pollution');assert.equal(await page.locator('.inventory-item:visible').count(),0);
    assert.equal(await page.locator('.inventory-detail:visible').count(),0);await commonLayout(page,record);
    await callback(page,record);
    record.storage=await isolated(page);assert.deepEqual(errors,[]);record.status='passed';
  }catch(error){record.status='failed';record.failure={message:error.message,stack:error.stack};report.failures.push({case:name,...record.failure});await capture(page,`${name}-failure`).catch(()=>{});try{record.failureState=await state(page);record.storage=await isolated(page);}catch(storageError){record.secondaryFailure=storageError.message;}}
  finally{await context.close();record.finishedAt=new Date().toISOString();write();console.log(`${record.status.toUpperCase()} ${name}${record.failure?`: ${record.failure.message}`:''}`);}
}
async function firstStepGate(page){
  const before=await state(page);
  assert.equal(await view(page),'pollution');assert.equal(await page.locator('.inventory-slot:visible,.inventory-list:visible,.inventory-detail:visible,[data-prepare-action=depart]:visible,.inventory-prepare-conditions:visible').count(),0);
  assert.equal(await page.locator('[data-prepare-action=next]').isDisabled(),false);
  for(const selector of ['[data-departure-grade][aria-pressed=true]','[data-prepare-action=next]']){await page.locator(selector).focus();await page.keyboard.down('Shift');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await page.keyboard.up('Shift');assert.equal(await view(page),'pollution');}
  await page.locator('[data-departure-grade][aria-pressed=true]').focus();for(const key of ['Enter','Space']){await page.keyboard.down(key);await page.keyboard.down(key);await page.keyboard.up(key);assert.equal(await view(page),'pollution');}
  const stops=[];for(let i=0;i<7;i++){await page.keyboard.press('Tab');stops.push(await page.evaluate(()=>({className:document.activeElement.className,action:document.activeElement.dataset.prepareAction??null,visible:document.activeElement.getClientRects().length>0})));}
  assert.ok(stops.every(s=>s.visible&&s.action!=='depart'&&!/inventory-slot|inventory-item/.test(s.className)));
  const after=await state(page);assert.equal(after.cycle,before.cycle);assert.deepEqual(after.run,before.run);assert.deepEqual(after.inventory,before.inventory);
  return stops;
}
async function singleColumn(page){
 const list=page.locator('.inventory-list[data-lane=main]');const rows=list.locator('.inventory-item');const ids=await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.itemId));assert.ok(ids.length>8);
 const geometry=await rows.evaluateAll(nodes=>nodes.slice(0,8).map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,height:r.height,cssHeight:getComputedStyle(n).height};}));assert.ok(geometry.every(g=>g.cssHeight==='48px'));assert.ok(geometry.every(g=>Math.abs(g.x-geometry[0].x)<.1));assert.ok(geometry.slice(1).every((g,i)=>g.y>geometry[i].y));
 await rows.first().click();const equipment=(await state(page)).equipment;await rows.nth(1).hover();assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),ids[0],'Hover must not select');await rows.nth(1).click();assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),ids[1]);assert.deepEqual((await state(page)).equipment,equipment,'Click selects, never silently equips');
 await rows.nth(2).focus();assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),ids[2]);
 const steps=[['Home',0],['ArrowDown',1],['ArrowRight',1],['ArrowLeft',1],['ArrowUp',0],['PageDown',6],['PageUp',0],['End',ids.length-1],['Home',0]];for(const [key,index]of steps){await page.keyboard.press(key);assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),ids[index],key);}
 await list.hover();await page.mouse.wheel(0,850);await page.waitForTimeout(180);const scroll=await list.evaluate(n=>n.scrollTop);assert.ok(scroll>200);assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),ids[0],'Wheel must not retarget old selected object');return {geometry,steps,scroll,selected:ids[0],count:ids.length};
}
try{
 await test('starter','starter',async(page,record)=>{
   record.pollutionFocusStops=await firstStepGate(page);const before=await state(page);assert.ok(before.equipment.weaponId);assert.ok(before.equipment.toolIds.every(id=>id===null));
   await page.locator('[data-prepare-action=next]').focus();await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await view(page),'equipment');assert.deepEqual((await state(page)).run,before.run);assert.equal(await page.locator('[data-prepare-action=depart]').isDisabled(),false);await noOrdinaryDeparture(page);await commonLayout(page,record);
   await page.locator('.inventory-slot').filter({hasText:'未装配'}).first().click();assert.equal(await page.locator('.inventory-filter.is-current').innerText(),'污染物');assert.match(await page.locator('.inventory-message').innerText(),/空工具位不妨碍出发/);
   await page.keyboard.press('Escape');assert.equal(await view(page),'pollution');const trace=()=>page.evaluate(()=>{const s=window.__game.scene.getScene('PurificationScene'),t=s.interactionFocusTween;return {wall:performance.now(),sceneTime:s.time.now,focused:document.hasFocus(),hidden:document.hidden,inputEnabled:s.player.exportRuntimeState().inputEnabled,camera:s.probeJourneyState().camera,tween:t?{progress:t.progress,elapsed:t.elapsed}:null};});record.exitFocus=[await trace()];await page.keyboard.press('Escape');await page.waitForSelector('#inventory-panel',{state:'detached'});await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').player.exportRuntimeState().inputEnabled);record.exitFocus.push(await trace());assert.equal(record.exitFocus.at(-1).tween,null);assert.equal((await state(page)).activeScene,'PurificationScene');
   await page.evaluate(()=>window.__prepareReview.open());await opened(page);await page.locator('[data-prepare-action=next]').click();await page.locator('.inventory-close').click();await page.waitForSelector('#inventory-panel',{state:'detached'});await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').player.exportRuntimeState().inputEnabled);
 });
 await test('equipped','equipped',async(page,record)=>{
   record.pollutionFocusStops=await firstStepGate(page);const start=await state(page);record.gradeChecks=[];
   for(const grade of ['low','medium','severe']){await page.locator(`[data-departure-grade=${grade}]`).click();await page.waitForTimeout(180);assert.equal((await state(page)).grade,grade);assert.equal(await page.locator('[data-departure-grade][tabindex="0"]').count(),1);await capture(page,`pollution-${grade}`);record.gradeChecks.push({grade,text:await page.locator('.inventory-grade-facts').innerText()});}
   await page.locator('[data-departure-grade=low]').hover();assert.equal((await state(page)).grade,'severe');await page.locator('[data-departure-grade=severe]').focus();for(const [key,grade]of [['ArrowDown','severe'],['Home','low'],['ArrowUp','low'],['ArrowDown','medium'],['Space','medium'],['End','severe'],['Enter','severe']]){await page.keyboard.press(key);assert.equal((await state(page)).grade,grade);assert.equal(await view(page),'pollution');}
   const after=await state(page);assert.deepEqual(after.inventory,start.inventory);assert.deepEqual(after.base,start.base);assert.deepEqual(after.journey.camera,start.journey.camera);
   await page.locator('[data-prepare-action=next]').focus();await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');assert.equal(await view(page),'equipment');assert.equal(await page.locator('[data-departure-grade]:visible,.inventory-grade-facts:visible,.inventory-departure-conditions:visible').count(),0);assert.match(await page.locator('.inventory-context').innerText(),/重度污染/);assert.equal(await page.locator('.inventory-slot').count(),4);await commonLayout(page,record);await noOrdinaryDeparture(page);await capture(page,'equipment-four');
   await page.locator('[data-item-id="prepare-fixture-4"]').click();const unknown=await page.locator('.inventory-detail').innerText();assert.doesNotMatch(unknown,/无门灯笼|doorless_lantern/);assert.match(unknown,/揭晓/);assert.equal(await page.locator('.inventory-detail-uses').count(),0);record.unknownDetail=unknown;
   const runPassive=start.inventory.find(item=>item.useUnit==='趟');await page.locator(`[data-item-id="${runPassive.id}"]`).click();assert.match(await page.locator('.inventory-detail-uses').innerText(),/剩余趟数/);assert.match(await page.locator('.inventory-slot').last().innerText(),/余趟/);
 });
 await test('expanded','expanded',async(page,record)=>{
   await firstStepGate(page);await page.locator('[data-prepare-action=next]').click();assert.equal(await page.locator('.inventory-slot').count(),5);await commonLayout(page,record);await capture(page,'equipment-five');
   for(const slot of await page.locator('.inventory-slot').evaluateAll(nodes=>nodes.map(n=>n.dataset.slotId))){await page.locator(`[data-slot-id="${slot}"]`).click();assert.equal(await view(page),'equipment');assert.equal(await page.locator('.inventory-filter.is-current').innerText(),slot==='weapon'?'武器':'污染物');assert.ok(await page.locator('.inventory-item.is-looking').count());}await noOrdinaryDeparture(page);
 });
 await test('long','long',async(page,record)=>{
   await page.locator('[data-prepare-action=next]').click();await stable(page);await commonLayout(page,record);record.prepareColumn=await singleColumn(page);record.preparePosition=await positionHint(page);const list=page.locator('.inventory-list[data-lane=main]');await returnMemory(page);assert.equal(await list.evaluate(n=>n.scrollTop),record.prepareColumn.scroll);assert.equal(await page.locator('.inventory-item.is-looking').getAttribute('data-item-id'),record.prepareColumn.selected);
   await page.locator('[data-item-id="prepare-fixture-22"]').click();const preEquipScroll=await list.evaluate(n=>n.scrollTop);await page.getByRole('button',{name:'装到 工具 Q',exact:true}).click();assert.equal((await state(page)).equipment.toolIds[0],'prepare-fixture-22');assert.equal(await list.evaluate(n=>n.scrollTop),preEquipScroll);await page.locator('.inventory-prepare-back').click();await page.locator('[data-departure-grade=medium]').click();await page.locator('[data-prepare-action=next]').click();assert.equal((await state(page)).equipment.toolIds[0],'prepare-fixture-22');assert.equal(await list.evaluate(n=>n.scrollTop),preEquipScroll);assert.match(await page.locator('.inventory-context').innerText(),/中污染/);record.equippedReturn={id:'prepare-fixture-22',scroll:preEquipScroll};
   await page.getByRole('button',{name:'污染物',exact:true}).click();await page.locator('.inventory-sort').selectOption('name');const items=(await state(page)).inventory.filter(i=>i.kind==='contaminant'&&i.usesRemaining!==undefined);const longest=items.sort((a,b)=>((b.explanations??[]).reduce((s,x)=>s+x.text.length,0)+(b.description??'').length)-((a.explanations??[]).reduce((s,x)=>s+x.text.length,0)+(a.description??'').length))[0];await page.locator(`[data-item-id="${longest.id}"]`).click();for(const summary of await page.locator('.inventory-explanation summary').all())await summary.click();await stable(page);
   const detail=page.locator('.inventory-detail');const overflow=await detail.evaluate(n=>({height:n.clientHeight,scroll:n.scrollHeight}));assert.ok(overflow.scroll>overflow.height);assert.match(await page.locator('.inventory-detail-hint').innerText(),/滚动|向上/);await detail.hover();await page.mouse.wheel(0,500);await page.waitForTimeout(150);const memory={detail:await detail.evaluate(n=>n.scrollTop),list:await list.evaluate(n=>n.scrollTop),selected:await page.locator('.inventory-item.is-looking').getAttribute('data-item-id')};assert.ok(memory.detail>0);await returnMemory(page);assert.equal(await detail.evaluate(n=>n.scrollTop),memory.detail);assert.equal(await list.evaluate(n=>n.scrollTop),memory.list);assert.equal(await page.locator('.inventory-sort').inputValue(),'name');assert.equal(await page.locator('.inventory-filter.is-current').innerText(),'污染物');record.detailReturn=memory;await commonLayout(page,record);await capture(page,'equipment-long-selected');
   await page.locator('.inventory-close').click();await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').player.exportRuntimeState().inputEnabled);await page.keyboard.press('Tab',{delay:70});await page.waitForSelector('#status-panel');await page.locator('.crt-tab[data-tab="1"]').click();await page.waitForSelector('#status-inventory-host #inventory-panel');assert.ok(await page.locator('#inventory-panel.inventory-catalog').count());await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.inventory-sort').selectOption('kept');record.actualCatalogueColumn=await singleColumn(page);record.cataloguePosition=await positionHint(page);assert.deepEqual(record.actualCatalogueColumn.steps,record.prepareColumn.steps);await capture(page,'actual-base-catalogue');
 });
 await test('blocked','blocked',async(page,record)=>{
   assert.equal((await state(page)).equipment.weaponId,null);await firstStepGate(page);assert.equal(await page.locator('[data-prepare-action=next]').isDisabled(),false);assert.doesNotMatch(await page.locator('.inventory-message').innerText(),/请先装|尚无可用/);await page.locator('[data-prepare-action=next]').click();assert.equal(await view(page),'equipment');assert.equal(await page.locator('[data-prepare-action=depart]').isDisabled(),true);assert.match(await page.locator('.inventory-message').innerText(),/武器|撬棍/);const before=await state(page);await page.keyboard.press('Shift+Enter');assert.equal((await state(page)).activeScene,'PurificationScene');assert.equal((await state(page)).cycle,before.cycle);await page.locator('[data-slot-id=weapon]').click();assert.equal(await page.locator('.inventory-filter.is-current').innerText(),'武器');await commonLayout(page,record);await capture(page,'blocked-weapon');
 });
 for(const [i,grade]of ['low','medium','severe'].entries())await test(`departure-${grade}`,'starter',async(page,record)=>{
   await firstStepGate(page);await page.locator(`[data-departure-grade=${grade}]`).click();assert.equal(await view(page),'pollution');await page.keyboard.press('Shift+Enter');assert.equal(await view(page),'pollution');await page.locator('[data-prepare-action=next]').click();assert.equal(await view(page),'equipment');await noOrdinaryDeparture(page);const before=await state(page);
   if(i===0)await page.locator('[data-prepare-action=depart]').click();else{await page.keyboard.down('Shift');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');await page.keyboard.up('Shift');}
   await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'),{},{timeout:30000});await stable(page);const entry=await page.evaluate(async()=>{const load=async p=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p).name);const {saveManager}=await load('/src/managers/save-manager.ts');return {state:window.__prepareReview.getState(),save:saveManager.captureLoadSnapshot()};});const identity=entry.save.checkpoint?.identity??entry.save.departure?.identity;assert.ok(identity);assert.equal(identity.generation.nativeDefinition.grade,grade);assert.equal(entry.state.cycle,before.cycle+1);assert.ok(entry.state.run?.runId??entry.state.run?.id);record.entry=entry;await capture(page,`rift-${grade}`);await page.waitForTimeout(180);assert.equal((await state(page)).cycle,entry.state.cycle);
 });
}finally{await browser.close();report.sourceAfter=sources();if(JSON.stringify(report.sourceBefore)!==JSON.stringify(report.sourceAfter))report.failures.push({case:'source-binding',message:'Source changed during run; result is not a stable source acceptance.'});report.finishedAt=new Date().toISOString();report.status=report.failures.length?'failed':'passed-bounded-preparation-flow';write();}
if(report.failures.length)process.exitCode=1;
console.log(JSON.stringify({status:report.status,cases:report.cases.length,failures:report.failures.length,output:out}));
