/** Actual report / preparation / field collection flow; isolated Chromium save. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors=[]; page.on('pageerror', error=>errors.push(error.message));
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000/');
  await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  await page.evaluate(async()=>{
    window.productionModule=async path=>import(performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname===path).name);
    (await window.productionModule('/src/managers/session.ts')).beginNewExpedition(window.__game.scene.getScene('MainMenuScene'));
  });
  await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene')&&!window.__game.scene.getScene('PurificationScene').menuEntry);
  assert.equal(await page.locator('#purif-inventory-entry').count(),0);
  assert.doesNotMatch(await page.locator('#purif-hud').innerText(),/负重|16\.0|B 随身/);
  await page.keyboard.press('b',{delay:70}); assert.equal(await page.locator('#inventory-panel').count(),0);
  await page.evaluate(async()=>{
    const {inventoryStore}=await window.productionModule('/src/systems/inventory-store.ts');
    inventoryStore.addContaminant({id:'ui-q',type:'solidify',rarity:'common',stage:'tool',usesRemaining:3,impactCharges:3});
    inventoryStore.addContaminant({id:'ui-f',type:'solidify',rarity:'common',stage:'tool',usesRemaining:6,impactCharges:3});
    inventoryStore.addContaminant({id:'ui-offer',type:'muffle',rarity:'fine',stage:'defense',usesRemaining:0,impactCharges:0});
  });
  assert.ok(await page.evaluate(async()=>{
    const {projectInventoryItem}=await window.productionModule('/src/ui/inventory-presenter.ts');
    const {WEAPON_DATA}=await window.productionModule('/src/generated/weapon-data.ts');
    const definition=WEAPON_DATA.crowbar_plain,original=definition.offeringCharges;
    try { definition.offeringCharges=9;
      return projectInventoryItem({id:'threshold-probe',kind:'weapon',location:{kind:'stash'},weapon:{id:'threshold-probe',definitionId:'crowbar_plain',stage:'defense',impactCharges:2,usesRemaining:0}},'catalog').stats.some(stat=>stat.label==='供奉积累'&&stat.value==='2 / 9');
    } finally {definition.offeringCharges=original;}
  }), 'weapon offering threshold must come from its CSV definition');
  await page.locator('#purif-report-entry').click();
  await page.waitForSelector('#status-panel');
  await page.locator('.crt-tab[data-tab="1"]').click();
  await page.waitForSelector('#status-inventory-host #inventory-panel');
  assert.equal(await page.locator('.inventory-item').count(),4);
  assert.ok(await page.locator('.inventory-list[data-lane="main"]').evaluate(list=>{const frame=list.getBoundingClientRect();return [...list.querySelectorAll('.inventory-item')].every(item=>{const row=item.getBoundingClientRect();return row.top>=frame.top-1&&row.bottom<=frame.bottom+1;});}), 'all four catalog rows must be visible without misleading position text');
  assert.doesNotMatch(await page.locator('#status-panel').innerText(),/负重|换到在手|装到 工具|3\.0 \/ 16/);
  assert.ok(await page.locator('.inventory-item-image img').count()===4);
  assert.ok(await page.locator('.inventory-detail-uses').evaluate(node=>{const r=node.getBoundingClientRect(),p=node.closest('.inventory-detail').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;}), 'weapon remaining uses must be visible before scrolling');
  await page.locator('[data-item-id="ui-q"]').click();
  assert.match(await page.locator('.inventory-detail').innerText(), /停滞4秒，受伤解除/);
  const beforeExplanation=await page.evaluate(async()=>(await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.getEquipment());
  await page.locator('.inventory-explanation summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.inventory-explanation[open]').count(),1);
  assert.match(await page.locator('.inventory-explanation[open]').innerText(), /阻止移动、感知与攻击。受到伤害后提前解除/);
  assert.deepEqual(await page.evaluate(async()=>(await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.getEquipment()),beforeExplanation);
  await page.locator('[data-item-id="ui-offer"]').click();
  assert.match(await page.locator('.inventory-detail').innerText(), /供奉：.*成熟后/);
  assert.equal(await page.locator('.inventory-explanation').count(),2);
  assert.equal(await page.locator('.inventory-detail').evaluate(node=>node.scrollTop),0);

  await page.getByRole('button',{name:'前往供奉台',exact:true}).click();
  await page.waitForSelector('#defense-panel');
  assert.equal(await page.locator('#status-panel').count(),0); assert.equal(await page.locator('#inventory-panel').count(),0);
  await page.keyboard.press('Escape',{delay:70}); await page.waitForSelector('#defense-panel',{state:'detached'}); await page.waitForTimeout(240);
  await page.keyboard.press('Tab',{delay:70}); await page.waitForSelector('#status-panel');
  await page.locator('.crt-tab[data-tab="1"]').click();
  if(process.env.SCREENSHOT_DIR) await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/inventory-report-base.png`});
  await page.keyboard.press('Tab',{delay:70}); await page.waitForSelector('#status-panel',{state:'detached'});
  console.log('PASS one Tab catalog, no base burden/equipment editing, real icons and offering navigation');

  await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift()); await page.waitForSelector('#inventory-panel.is-prepare');
  assert.equal(await page.locator('.inventory-player-portrait').count(),1);
  assert.equal(await page.locator('.inventory-slot').count(),4);
  assert.doesNotMatch(await page.locator('#inventory-panel').innerText(),/负重/);
  await page.locator('[data-item-id="ui-q"]').click(); await page.getByRole('button',{name:'装到 工具 Q',exact:true}).click();
  await page.locator('[data-item-id="ui-f"]').click(); await page.getByRole('button',{name:'装到 工具 F',exact:true}).click();
  await page.evaluate(async()=>{
    const {CONTAMINANT_DATA}=await window.productionModule('/src/generated/contaminant-data.ts');
    const {inventoryStore}=await window.productionModule('/src/systems/inventory-store.ts');
    window.detailFixtureState=inventoryStore.getState();
    const state=inventoryStore.getState();
    state.items.find(item=>item.id==='ui-f').contaminant.type=Object.values(CONTAMINANT_DATA).filter(def=>def.toolType==='active').sort((a,b)=>b.descriptionTool.length-a.descriptionTool.length)[0].id;
    if(!inventoryStore.loadState(state))throw Error('longest-description fixture invalid');
  });
  const footerBefore=await page.locator('.inventory-bottom').boundingBox();
  await page.locator('.inventory-explanation summary').click();
  assert.deepEqual(await page.locator('.inventory-bottom').boundingBox(),footerBefore,'expanded skill explanation must not move the fixed departure action');
  assert.ok(await page.locator('#inventory-panel').evaluate(panel=>{
    const p=panel.getBoundingClientRect();
    return ['.inventory-title','.inventory-detail-uses','.inventory-primary'].every(selector=>{const b=panel.querySelector(selector).getBoundingClientRect();return b.top>=p.top&&b.bottom<=p.bottom&&b.top>=0&&b.bottom<=innerHeight;});
  }), 'title, uses and departure must remain inside panel and viewport with longest skill description expanded');
  await page.evaluate(async()=>{(await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.loadState(window.detailFixtureState);});
  await page.locator('.inventory-explanation summary').click();
  if(process.env.SCREENSHOT_DIR) await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/inventory-report-prepare.png`});
  await page.keyboard.press('Shift+Enter',{delay:70}); await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'));
  await page.evaluate(()=>window.__game.scene.getScene('RiftScene').probeReviewProtection(true));
  assert.equal(await page.locator('.rift-equipment-row').count(),4);
  assert.match(await page.locator('.rift-equipment-row[data-slot-id="weapon"]').innerText(),/60/);
  await page.evaluate(async()=>{(await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.consumeTool('ui-f');});
  assert.equal(await page.locator('.rift-equipment-row[data-item-id="ui-f"] .rift-equipment-uses').innerText(),'5');
  assert.equal(await page.locator('.rift-equipment-row[data-item-id="ui-q"] .rift-equipment-uses').innerText(),'3');
  await page.keyboard.press('b',{delay:70}); assert.equal(await page.locator('#inventory-panel').count(),0);
  await page.locator('#rift-hud-burden').click(); await page.waitForSelector('#inventory-panel.is-rift');
  assert.equal(await page.locator('.inventory-title').innerText(),'本趟拾获'); assert.equal(await page.locator('.inventory-item').count(),0);
  assert.equal(await page.locator('.inventory-equipment').isVisible(),false); assert.match(await page.locator('.inventory-message').innerText(),/已装配占 7/);
  const before=await page.evaluate(()=>window.__game.scene.getScene('RiftScene').time.now); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(value=>window.__game.scene.getScene('RiftScene').time.now>value,before));
  await page.keyboard.press('Tab',{delay:70}); await page.waitForSelector('#inventory-panel',{state:'detached'}); await page.waitForTimeout(170);
  await page.keyboard.press('Tab',{delay:70}); await page.waitForSelector('#inventory-panel');
  await page.keyboard.press('w',{delay:70}); await page.waitForSelector('#inventory-panel',{state:'detached'}); await page.waitForTimeout(170);
  console.log('PASS preparation is sole equipment editor; complete ID-based equipment HUD; Tab collection excludes carried-out gear and keeps world live');
  await page.evaluate(async()=>{
    const scene=window.__game.scene.getScene('RiftScene');
    const {inventoryStore}=await window.productionModule('/src/systems/inventory-store.ts');
    inventoryStore.revealBatch('ui-loot',[{id:'ui-acquired',kind:'contaminant',contaminant:{id:'ui-acquired',type:'solidify',rarity:'common',stage:'defense',impactCharges:0,usesRemaining:0}}],scene.player.getPosition());
  });
  await page.keyboard.press('Tab',{delay:70}); await page.waitForSelector('#inventory-panel');
  assert.equal(await page.locator('.inventory-item').count(),1); assert.equal(await page.locator('.inventory-item').getAttribute('data-item-id'),'ui-acquired');
  if(process.env.SCREENSHOT_DIR) await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/inventory-report-rift.png`});
  assert.deepEqual(errors,[]); console.log('PASS field report lists only newly acquired objects');
}finally{await browser.close();}
