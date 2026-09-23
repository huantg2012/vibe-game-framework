/** Isolated Phaser allocation fixture, not a player or visual acceptance run. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.env.ARTIFACT_DIR??'docs/qa/artifacts/iteration-30-r8/motion-runtime';
fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const page=await context.newPage();const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
try {
  await page.goto(process.env.I30_URL??'http://127.0.0.1:3025/');
  await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),null);
  const result=await page.evaluate(async()=>{
    const {ChamberDeviceActivity}=await import('/src/scenes/chamber-device-activity.ts');
    const scene=window.__game.scene.getScene('MainMenuScene');
    const original=Object.keys(scene.textures.list).sort();
    const iterations=[];
    for(let iteration=0;iteration<3;iteration++) {
      const manager=new ChamberDeviceActivity(scene);
      const state={core:1,storage:1,purifier:1,offeringOccupancy:0};
      manager.update(0,state);const initial=manager.getStats();
      for(let time=80;time<=30000;time+=80)manager.update(time,state);
      const idle=manager.getStats();
      state.core=.7;manager.update(30100,state);const damaged=manager.getStats();
      state.core=.5;manager.update(30200,state);const sameTier=manager.getStats();
      state.offeringOccupancy=.25;manager.update(30300,state);const occupied=manager.getStats();
      state.offeringOccupancy=.75;manager.update(30400,state);const moreOccupied=manager.getStats();
      manager.pulse('repair','core');manager.pulse('growth');manager.pulse('offering');
      for(let time=30480;time<=32500;time+=80)manager.update(time,state);
      const pulsed=manager.getStats();
      manager.pulse('offering-complete');
      manager.update(32550,state);
      const releaseStart=manager.layers.find(layer=>layer.id==='offering').frame;
      manager.update(34100,state);
      const releaseEnd=manager.layers.find(layer=>layer.id==='offering').frame;
      const keys=Object.keys(scene.textures.list).filter(key=>key.startsWith('chamber-activity-'));
      manager.destroy();manager.destroy();const destroyed=manager.getStats();
      iterations.push({initial,idle,damaged,sameTier,occupied,moreOccupied,pulsed,releaseStart,releaseEnd,keys,destroyed,
        restored:JSON.stringify(Object.keys(scene.textures.list).sort())===JSON.stringify(original)});
    }
    return {iterations,scope:'Three isolated managers on MainMenu scene; synthetic presentation states and clock. No game state or user save mutations; not normal play/visual acceptance.'};
  });
  for(const item of result.iterations) {
    assert.equal(item.initial.textures,6);assert.equal(item.initial.rebuilds,6);
    assert.equal(item.initial.pixels,630784);assert.deepEqual(item.idle,item.initial);
    assert.equal(item.damaged.rebuilds,7);assert.deepEqual(item.sameTier,item.damaged);
    assert.equal(item.occupied.rebuilds,8);assert.deepEqual(item.moreOccupied,item.occupied);
    assert.deepEqual(item.pulsed,item.occupied);assert(item.releaseStart>=24&&item.releaseStart<32);assert(item.releaseEnd<16);assert.equal(item.keys.length,6);
    assert.equal(item.destroyed.textures,0);assert.equal(item.destroyed.pixels,0);assert(item.restored);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'allocation.json'),JSON.stringify({...result,errors},null,2));
  console.log('R8 motion atlas runtime: 3 creates, 30s synthetic idle each, state/pulse cache and destruction passed.');
} finally { await context.close();await browser.close(); }
