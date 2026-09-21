/** Same-source diagnostic evidence. Isolated browser stores; real movement and UI inputs.
 * Fixture states are controlled snapshots, not naturally earned long-term play. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';
const root='docs/qa/artifacts/iteration-29/runtime';
fs.mkdirSync(root,{recursive:true});
const source='docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json';
const storage=JSON.parse(fs.readFileSync(source));
const seed=JSON.parse(storage['coh-save-v1']);
const cases=(process.env.I29_CASES??'fresh,investment,damaged,capped').split(',');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const manifest={method:'newContext, controlled saves except fresh; actual keyboard movement and panel actions; read-only scene diagnostics used for routing, not novice navigation',cases:[]};
const milestones={version:1,impactExperienced:true,offeringCompleted:true,toolRevealed:true,crestExperienced:true};
try {
 for(const name of cases){
  const out=path.join(root,name);fs.mkdirSync(out,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  if(name!=='fresh'){
   const save=structuredClone(seed);save.kindlingReserve=400;
   save.modules.forEach(m=>m.hp=100);
   save.growth.progression={...milestones};
   save.cycle=7;save.tide={tideNumber:2,phase:'rise',cycleInPhase:0,currentIntensity:1.2};
   delete save.impactForecast;delete save.checkpointChecksum;
   if(name==='damaged')save.modules.forEach((m,i)=>m.hp=[15,22,8][i]);
   if(name==='capped'){
    save.growth.upgrades={growth_chaos_resist:5,growth_kindling_affinity:3,growth_vitality:4,growth_sortie_slot:1,growth_defense_slot:1,growth_forecast_clarity:3};
    save.moduleMaxHpTier=3;save.modules.forEach(m=>{m.hp=145;m.maxHp=145;});
   }
   fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(save,null,2));
   await context.addInitScript(s=>{ if (!localStorage.getItem('coh-save-v1')) localStorage.setItem('coh-save-v1',JSON.stringify(s)); },save);
  }
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
  try{
   await page.goto(process.env.I29_URL??'http://127.0.0.1:3025/');
   await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
   await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1800);
   await d.snap('01-hub');
   for(const pt of [{x:160,y:238},{x:112,y:216}])assert((await c.baseTo(pt)).ok);
   await d.press('e');await page.waitForTimeout(450);await d.snap('02-growth');
   assert(await page.locator('#growth-panel').count());
   if(name==='fresh'){
    assert.equal(await page.locator('.upgrade-card[data-id="growth_forecast_clarity"]').count(),0);
    assert.equal(await page.locator('.upgrade-card[data-id="pending"]').count(),1);
    await page.locator('.upgrade-card[data-id="pending"]').hover();await d.snap('03-pending');
    await d.press('Enter');
   }
   if(name==='investment'){
    const before=JSON.parse(await page.evaluate(()=>localStorage.getItem('coh-save-v1')));
    for(const id of ['growth_forecast_clarity','growth_forecast_clarity','growth_forecast_clarity','growth_sortie_slot','growth_defense_slot']){
      await page.locator(`.upgrade-card[data-id="${id}"]`).hover();
      await d.press('Enter');await page.waitForTimeout(120);
    }
    await d.snap('03-invested');
    await page.locator('.upgrade-card[data-id="thicken"]').hover();await page.waitForTimeout(2200);await d.snap('04-thicken-preview');
    assert(await page.locator('[data-thicken-consequence="refill"]').evaluate(el=>{
      const a=el.getBoundingClientRect(),b=el.closest('.decision-aside').getBoundingClientRect();
      return a.top>=b.top&&a.bottom<=b.bottom;
    }),'refill warning must be visible without scrolling');
    const text=await page.locator('#growth-panel').innerText();assert(text.includes('0 → 7'));assert(text.includes('至少 12 薪柴'));
    await d.press('Enter');await page.waitForTimeout(450);await d.snap('05-thickened');
    const after=JSON.parse(await page.evaluate(()=>localStorage.getItem('coh-save-v1')));
    assert.equal(after.growth.upgrades.growth_forecast_clarity,3);assert.equal(after.growth.upgrades.growth_sortie_slot,1);assert.equal(after.growth.upgrades.growth_defense_slot,1);
    assert.equal(after.moduleMaxHpTier,1);assert.equal(after.kindlingReserve,before.kindlingReserve-147);
    assert(after.modules.every(m=>m.hp===100&&m.maxHp===115));
   }
   await d.press('Escape');await page.waitForTimeout(450);await d.snap('06-world-after');
   await d.press('Tab');await page.waitForTimeout(250);
   await page.locator('.crt-tab[data-tab="2"]').click();await d.snap('07-forecast');
   if(name==='investment'||name==='capped')assert((await page.locator('#status-panel').innerText()).includes('供奉作用前'));
   await d.press('Escape');await page.waitForTimeout(450);
   if(name==='investment'){
    // Verify persisted public reading through a complete browser reload.
    const persisted=JSON.parse(await page.evaluate(()=>localStorage.getItem('coh-save-v1')));
    await d.ledger('purchased');await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
    await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1400);await d.snap('08-reloaded');
    const loaded=JSON.parse(await page.evaluate(()=>localStorage.getItem('coh-save-v1')));
    assert.deepEqual(loaded.growth,persisted.growth,'purchases survive reload');
    assert.equal(loaded.kindlingReserve,persisted.kindlingReserve);
    assert.deepEqual(loaded.impactForecast,persisted.impactForecast,'reload does not redraw forecast');
    const run=await c.depart('09-depart');assert(run.ok,JSON.stringify(run));
    await d.ledger('departed');

   }
   await d.ledger('end');assert.deepEqual(errors,[]);
   manifest.cases.push({name,ok:true,errors});
  }catch(error){manifest.cases.push({name,ok:false,error:String(error),errors});await page.screenshot({path:path.join(out,'failure.png')});throw error;}
  finally{await context.close();}
 }
}finally{fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));await browser.close();}
console.log(JSON.stringify(manifest,null,2));
