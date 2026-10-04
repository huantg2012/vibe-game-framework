/** Current frozen production, controlled starting equipment, real Q/Esc and cold Continue. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/native-body-fix/current-dash-save');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage({viewport:{width:1440,height:960}});
const report={status:'running',base:process.env.GAME_URL??'http://127.0.0.1:3073/',method:'Isolated current immutable production source; one explicitly granted/matured catalog dash item through real inventory APIs, equipped through actual preparation UI. Real Q key activates and Esc pauses. No changes to source, player position, physics clock or saved bytes. Cold reload and formal Continue must preserve that paid active skill. This is targeted QA, not a natural journey.',errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(report.base);await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await page.waitForTimeout(350);await page.keyboard.press('Enter',{delay:50});await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene'));await page.waitForTimeout(1900);
 const id=await page.evaluate(async()=>{const{inventoryStore}=await import('/src/systems/inventory-store.ts'),{createCatalogContaminant}=await import('/src/systems/contaminant-catalog.ts');const item=createCatalogContaminant({id:'qa-legacy-dash',definitionId:'split_heel_boot',appearanceId:'wax_parcel',offeringProfileId:'resist_35',quality:'ordinary',acquiredOrdinal:0});for(const r of[inventoryStore.addContaminant(item),inventoryStore.slotOffering(item.id,0),inventoryStore.finishOfferingImpact([item.id],3,{},'qa-legacy-dash-mature')])if(!r.ok)throw Error(JSON.stringify(r));return item.id;});
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());await page.locator(`[role="option"][data-item-id="${id}"]`).click();await page.getByRole('button',{name:'装到 工具 Q',exact:true}).click();await page.keyboard.press('Shift+Enter',{delay:50});await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'));await page.waitForFunction(()=>{const s=window.__game.scene.getScene('RiftScene');return !s.nativeEntryFence?.isActive()&&!s.entryView.active&&s.toolInputAllowed;});
 await page.evaluate(async()=>{const{saveManager}=await import('/src/managers/save-manager.ts');const original=saveManager.prepareRiftCommit;window.__legacySaved=[];saveManager.prepareRiftCommit=function(checkpoint,...args){const commit=original.call(this,checkpoint,...args);window.__legacySaved.push(structuredClone(checkpoint));return commit;};});
 await page.keyboard.press('q',{delay:10});await page.waitForTimeout(Number(process.env.QA_DASH_PAUSE_MS??55));await page.keyboard.press('Escape',{delay:20});await page.waitForFunction(()=>window.__game.scene.isPaused('RiftScene'));
 const sample=await page.evaluate(()=>({save:JSON.parse(localStorage.getItem('coh-save-v1')),candidates:window.__legacySaved,runtime:window.__game.scene.getScene('RiftScene').captureRuntimeCheckpoint(999)}));
 fs.writeFileSync(path.join(out,'actual-current-save.json'),JSON.stringify(sample.save,null,2));fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(sample,null,2));
 const cp=sample.save.riftCheckpoint,p=cp.state.player;report.delta={x:p.bodyPosition.x+10-p.position.x,y:p.bodyPosition.y+10-p.position.y};report.elapsed=cp.elapsedMs;report.catalog=cp.state.tools.catalog;report.nativeDefinition=cp.identity.generation.nativeDefinition.id;
 report.consumedItem=sample.save.inventory.items.find(i=>i.id===id);
 assert.deepEqual(report.delta,{x:0,y:0},'paid active dash must save with the real collider offset in the same frame');
 assert(report.catalog.effects.some(e=>e.resolvedParams.familyId==='dash'),'actual Q produced a paid active dash');
 await page.screenshot({path:path.join(out,'01-active-dash-paused.png')});
 await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await page.evaluate(async()=>{const{saveManager}=await import('/src/managers/save-manager.ts');const original=saveManager.prepareRiftCommit;window.__coldCandidates=[];saveManager.prepareRiftCommit=function(checkpoint,...args){const commit=original.call(this,checkpoint,...args);window.__coldCandidates.push(structuredClone(checkpoint));return commit;};});
 await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&!s.nativeEntryFence?.isActive()&&window.__coldCandidates?.length;},null,{timeout:60000});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__game.scene.isPaused('RiftScene'));
 const cold=await page.evaluate(()=>({save:JSON.parse(localStorage.getItem('coh-save-v1')),candidates:window.__coldCandidates}));
 const initial=cold.candidates.find(c=>c.elapsedMs===cp.elapsedMs);
 assert(initial,'cold entry saved zero-time restored picture before live simulation');
 assert.deepEqual(initial.state.player.position,cp.state.player.position);assert.deepEqual(initial.state.player.bodyPosition,cp.state.player.bodyPosition);
 assert.deepEqual(initial.identity,cp.identity);assert.deepEqual(initial.state.tools.catalog,cp.state.tools.catalog);
 assert.deepEqual(cold.save.inventory.items.find(i=>i.id===id),report.consumedItem,'restore cannot repay or consume another use');
 fs.writeFileSync(path.join(out,'cold-samples.json'),JSON.stringify(cold,null,2));report.cold={identityPreserved:true,zeroTimeStatePreserved:true,paidItemPreserved:true};
 await page.screenshot({path:path.join(out,'02-active-dash-cold-continued.png')});assert.deepEqual(report.errors,[]);report.status='pass';
}catch(e){report.status='failed';report.error=String(e);report.text=await page.locator('body').innerText();process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({status:report.status,error:report.error,delta:report.delta,elapsed:report.elapsed,effect:report.catalog?.effects?.map(e=>({family:e.resolvedParams.familyId,remaining:e.remainingTime}))},null,2));
