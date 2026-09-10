/** Actual base → equip → Rift → return scene flow in an isolated browser storage context. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
try {
 const page = await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[]; page.on('pageerror', e => errors.push(e.message));
 await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000/');
 await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await page.evaluate(async()=>{
   window.productionModule = async path => import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name ?? path);
   const {beginNewExpedition}=await window.productionModule('/src/managers/session.ts');
   beginNewExpedition(window.__game.scene.getScene('MainMenuScene'));
 });
 await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene') && !window.__game.scene.getScene('PurificationScene').menuEntry);
 await page.evaluate(async()=>{
   const {inventoryStore}=await window.productionModule('/src/systems/inventory-store.ts');
   const {createWeaponInstance}=await window.productionModule('/src/systems/weapon-loot.ts');
   const {gameState}=await window.productionModule('/src/managers/game-state.ts');
   const {impactSystem}=await window.productionModule('/src/systems/impact-system.ts');
   window.testInventory=inventoryStore;
   const state=inventoryStore.getState();
   const weapon=createWeaponInstance('crowbar_good_standard',false,'offered-weapon');weapon.impactCharges=2;
   state.items.push({id:weapon.id,kind:'weapon',weapon,location:{kind:'stash'}});
   state.items.push({id:'offered-skill',kind:'contaminant',location:{kind:'stash'},contaminant:{id:'offered-skill',type:'solidify',rarity:'common',stage:'defense',impactCharges:2,usesRemaining:0}});
   if(!inventoryStore.loadState(state))throw Error('offering fixture invalid');
   if(inventoryStore.prepareWeapon(weapon.id).ok)throw Error('unoffered weapon equipped');
   if(gameState.getCycle()===0)gameState.incrementCycle();
   const original=impactSystem.run.bind(impactSystem);
   impactSystem.run=(...args)=>{const result=original(...args);window.lastActualImpact=result;return result;};
   window.__game.scene.getScene('PurificationScene').openDefensePanel();
 });
 await page.locator('#defense-panel').waitFor();
 await page.locator('.defense-equip-tile[data-id="offered-weapon"]').click();
 await page.locator('.defense-equip-tile[data-id="offered-skill"]').click();
 assert.equal(await page.locator('.defense-unslot-btn').count(),2);
 assert.equal(await page.locator('#defense-panel img').count()>=2,true);
 await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').offeringStand.tier===2);
 await page.screenshot({path:process.env.OFFERING_SCREENSHOT ?? '/tmp/unified-offering.png'});
 await page.keyboard.press('Escape',{delay:80});await page.waitForTimeout(230);
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());
 await page.locator('#inventory-panel').waitFor();
 await page.keyboard.press('Shift+Enter',{delay:80});
 await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'));
 await page.evaluate(()=>{
   const scene=window.__game.scene.getScene('RiftScene');
   scene.runController.endRun('extract');scene.runController.restart();
 });
 await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene'));
 const result=await page.evaluate(()=>({
   impact:window.lastActualImpact,
   weapon:window.testInventory.getItem('offered-weapon'),skill:window.testInventory.getItem('offered-skill'),
   slots:window.testInventory.getOfferingItems(),
 }));
 assert.equal(result.impact.skipped,false);
 assert.equal(result.impact.defenseResult.slotDisclosures.some(slot=>slot.contaminantId==='offered-skill'),true,'last offering charge must still defend');
 assert.equal(result.weapon.weapon.stage,'tool');assert.equal(result.weapon.weapon.usesRemaining,75);
 assert.equal(result.skill.contaminant.stage,'tool');assert.equal(result.skill.contaminant.usesRemaining,5);
 assert.equal(result.weapon.location.kind,'stash');assert.equal(result.skill.location.kind,'stash');
 assert.equal(result.slots.filter(Boolean).length,0);
 await page.waitForFunction(()=>window.__game.scene.getScene('PurificationScene').offeringStand.tier===0);
 assert.deepEqual(errors,[]);
 console.log('PASS real offering UI accepts weapon+skill, raw equip blocked, last-impact defense executes before both mature, slots clear without duplicate items');
} finally {await browser.close();}
