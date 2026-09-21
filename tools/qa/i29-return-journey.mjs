/** Two fresh-save confirmed-abandon returns and six physical interactions. Read-only geometry routing,
 * genuine keyboard input. No inventory grants, teleport, forced results or clock. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';
import { createEconomyCycle } from './i27-economy-cycle.mjs';
const out='docs/qa/artifacts/iteration-29/return-journey';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
const errors=[],result={method:'fresh newContext; real keys for six hub interactions and two confirmed-abandon returns; no state mutations or balance/extraction claim',interactions:[],returns:[]};
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
const d=createJourneyDriver(page,out),c=createCycleInputs(page,d),e=createEconomyCycle(page,d,c);
try {
 await page.goto(process.env.I29_URL??'http://127.0.0.1:3025/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1600);
 const stations=[
  ['core',[{x:224,y:216}],'#allocation-panel'],
  ['growth',[{x:160,y:238},{x:112,y:216}],'#growth-panel'],
  ['offering',[{x:128,y:242}],'#defense-panel'],
  ['purifier',[{x:180,y:246},{x:180,y:276},{x:224,y:276}],'#allocation-panel'],
  ['storage',[{x:280,y:250},{x:336,y:216}],'#allocation-panel'],
  ['rift',[{x:272,y:224},{x:272,y:112},{x:248,y:96},{x:224,y:88}],'#inventory-panel'],
 ];
 for(const [name,path,selector]of stations){
  for(const pt of path)assert((await c.baseTo(pt)).ok,`path to ${name}`);
  await d.press('e');await page.waitForTimeout(550);await d.snap(`visit-${name}`);
  const panel=page.locator(selector);assert(await panel.count(),name+' panel');
  result.interactions.push({name,ok:true});await d.press('Escape');await page.waitForTimeout(550);
 }
 for(let n=1;n<=2;n++){
  if(n===1){
   // Already beside the entrance after the six-station walk; no perimeter detour.
   await d.press('e');await page.waitForTimeout(400);await d.press('Shift+Enter');await page.waitForTimeout(1200);
   const state=await d.state();assert(state.scene==='rift'&&!state.ended);await d.press('Escape');await page.waitForTimeout(250);
  }else assert((await c.depart(`return-${n}`)).ok,'departure');
  // Use the actual two-step abandonment menu; no state setter or forced outcome.
  // This exercises both immunity and damaging-return qualification even on death/abandon.
  assert((await d.state()).paused);
  await d.press('ArrowDown');await d.press('Enter');await page.waitForTimeout(180);
  await d.snap(`return-${n}-abandon-confirm`);
  await d.press('ArrowDown');await d.press('Enter');await page.waitForTimeout(600);
  assert((await d.state()).ended,'confirmed abandonment ends the run');
  result.returns.push({n,route:'real pause menu -> confirm abandonment -> result -> return'});
  assert((await c.returnBase(`return-${n}`)).ok,'base return');
  if((await d.state()).panels?.impact){await d.press('Enter');await page.waitForTimeout(550);}
  const save=await e.readSave();result.returns.at(-1).save=save;
  assert.equal(save.inventory.run.baseSettled,true);
  assert.equal(save.growth.progression.impactExperienced,n===2);
  assert.equal(save.growth.progression.offeringCompleted,false);
  assert.equal(save.growth.progression.toolRevealed,false);
  assert.equal(save.impactForecast.nextIntensity,save.tide.currentIntensity);
  await d.ledger(`after-return-${n}`);
 }
 assert.deepEqual(errors,[]);result.ok=true;
}catch(err){result.ok=false;result.error=String(err);await d.snap('failure');throw err;}
finally{result.errors=errors;fs.writeFileSync(out+'/manifest.json',JSON.stringify(result,null,2));await browser.close();}
console.log('I29: six physical interactions and two confirmed-abandon returns PASS');
