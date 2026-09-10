/** Isolated actual purification allocation UI, bonus preview, durable repair and rollback. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000/');
  await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  await page.evaluate(async()=>{
    window.productionModule=async path=>import(performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname===path).name);
    const {beginNewExpedition}=await window.productionModule('/src/managers/session.ts');
    beginNewExpedition(window.__game.scene.getScene('MainMenuScene'));
  });
  await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene')&&!window.__game.scene.getScene('PurificationScene').menuEntry);
  await page.evaluate(async()=>{
    const {gameState}=await window.productionModule('/src/managers/game-state.ts');
    const {saveManager}=await window.productionModule('/src/managers/save-manager.ts');
    gameState.addKindling(10);gameState.applyDamage('CORE',10);gameState.grantRepairBonus(6);saveManager.save();
    window.__game.scene.getScene('PurificationScene').openWorldInteraction('CORE');
  });
  await page.waitForSelector('#allocation-panel');
  assert.match(await page.locator('#allocation-panel').innerText(),/下次注入另修复至多 6 完整度（仅一次）/);
  await page.locator('#alloc-plus').click();
  assert.match(await page.locator('.core-repair-preview').innerText(),/修复至 70/);
  const snapshot=()=>page.evaluate(async()=>({game:(await window.productionModule('/src/managers/game-state.ts')).gameState.getState(),saved:localStorage.getItem('coh-save-v1')}));
  const before=await snapshot();
  await page.evaluate(()=>{window.realStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='coh-save-v1')throw Error('simulated quota');return window.realStorageSet.call(this,key,value);};});
  await page.locator('#alloc-confirm').click();
  assert.match(await page.locator('.core-reason').innerText(),/记录未能保存，注入未扣除/);
  assert.deepEqual(await snapshot(),before);
  await page.evaluate(()=>{Storage.prototype.setItem=window.realStorageSet;});
  await page.locator('#alloc-confirm').click();
  await page.waitForSelector('#allocation-panel',{state:'detached'});
  const after=await snapshot();assert.equal(after.game.kindlingReserve,before.game.kindlingReserve-1);
  assert.equal(after.game.repairBonusHp,0);assert.equal(after.game.modules.find(mod=>mod.id==='CORE').hp,70);
  assert.equal(JSON.parse(after.saved).repairBonusHp,0);
  await page.evaluate(async()=>{if(!(await window.productionModule('/src/managers/save-manager.ts')).saveManager.load())throw Error('failed reload');});
  assert.deepEqual((await snapshot()).game,after.game);
  assert.deepEqual(errors,[]);
  console.log('PASS real allocation UI shows finite allowance and accurate preview; quota failure restores all state; retry persists one injection and reload keeps consumption');
}finally{await browser.close();}
