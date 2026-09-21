/** R2: isolated snapshots for edge states; actual keyboard/click purchases and walking. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';
const root=process.env.I29_OUT??'docs/qa/artifacts/growth-ux-2026-09-21/runtime';fs.mkdirSync(root,{recursive:true});
const seed=JSON.parse(JSON.parse(fs.readFileSync('docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json'))['coh-save-v1']);
const route=fs.readFileSync('data/growth-route.csv','utf8').trim().split('\n').slice(1).map(line=>{const [order,id,level,,,,cost]=line.split(',');return {order:+order,id,level:+level,cost:+cost};});
const facts={version:1,impactExperienced:false,offeringCompleted:false,toolRevealed:false,crestExperienced:false};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const manifest={method:'isolated newContext; explicit controlled saves except fresh; real keyboard/clicks, read-only routing; not natural long-term economy',cases:[]};
const cases=(process.env.I29_CASES??'fresh,poor,impact,crest,linear,legacy').split(',');
try{for(const name of cases){
 const out=path.join(root,name);fs.mkdirSync(out,{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 if(name!=='fresh'){
  const save=structuredClone(seed);save.kindlingReserve=name==='poor'?0:1000;save.growth.schemaVersion=2;save.growth.progression={...facts};
  for(const id in save.growth.upgrades)save.growth.upgrades[id]=0;
  save.moduleMaxHpTier=0;save.cycle=1;delete save.impactForecast;delete save.checkpointChecksum;
  const owned=name==='impact'?4:name==='crest'?16:0;
  for(const step of route.slice(0,owned)){if(step.id==='thicken')save.moduleMaxHpTier=step.level;else save.growth.upgrades[step.id]=step.level;}
  save.modules.forEach(m=>{m.hp=100;m.maxHp=100+save.moduleMaxHpTier*15;});
  if(name==='crest')save.growth.progression.impactExperienced=true;
  if(name==='linear')save.growth.progression={version:1,impactExperienced:true,offeringCompleted:true,toolRevealed:true,crestExperienced:true};
  if(name==='legacy'){delete save.growth.schemaVersion;save.growth.upgrades.growth_defense_slot=1;save.growth.upgrades.growth_forecast_clarity=3;}
  fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(save,null,2));
  await context.addInitScript(s=>{if(!localStorage.getItem('coh-save-v1'))localStorage.setItem('coh-save-v1',JSON.stringify(s));},save);
 }
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
 const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
 const read=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('coh-save-v1')));
 try{
  await page.goto(process.env.I29_URL??'http://127.0.0.1:3025/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1500);
  for(const pt of [{x:160,y:238},{x:112,y:216}])assert((await c.baseTo(pt)).ok);
  await d.press('e');await page.waitForTimeout(450);await d.snap('01-growth');
  const panel=page.locator('#growth-panel'),next=page.locator('[data-growth-next="true"]');
  assert.equal(await next.count(),1);assert(!(await panel.innerText()).includes('揭晓一件'));
  assert(!(await panel.innerText()).includes('0 → 1 /'));
  assert((await panel.innerText()).includes('Level 1'));
  if(name==='poor'){
    const before=await read();await d.press('Enter');assert.deepEqual(await read(),before);
    assert((await panel.innerText()).includes('薪柴不足，还差 8'));
    assert.equal(await panel.locator('#growth-confirm-btn').count(),0);
  }
  if(name==='fresh'){
    assert.equal(await panel.locator('.upgrade-card').count(),1);assert((await panel.innerText()).includes('已刻入 0 项 · 共 22 项'));
    assert.equal((await read()).growth.upgrades.growth_defense_slot,0);
  }
  if(name==='impact'||name==='crest'){
    const condition=page.locator('[data-growth-requirement]');assert.equal(await condition.count(),1);
    assert((await condition.innerText()).includes(name==='impact'?'承受冲击':'抵达退潮'));
    const before=await read();await d.press('Enter');assert.deepEqual(await read(),before,'locked purchase changes nothing');
    assert.equal(await panel.locator('#growth-confirm-btn').count(),0);
    await panel.locator('[data-growth-next="false"]').first().hover();await d.snap('02-owned');
    assert.equal(await panel.locator('[data-growth-requirement]').count(),0);assert(!(await panel.locator('.decision-aside').innerText()).includes('→'));
  }
  if(name==='linear'){
    const before=await read();
    for(const step of route){
      assert.equal(await next.count(),1);assert.equal(await next.getAttribute('data-id'),step.id);
      assert.equal(await panel.locator('[data-growth-requirement]').count(),0,'completed facts not duplicated');
      if([1,3,5,7,10,12,17,18].includes(step.order)){
        await page.waitForTimeout(500);await d.snap(`step-${String(step.order).padStart(2,'0')}`);
      }
      if(step.id==='thicken')assert(await page.locator('.decision-aside .stat-row').last().evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.decision-aside').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}),'all three module previews fit first screen');
      if(step.order===1){
        await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
      }else if(step.order===3){await page.locator('#growth-confirm-btn').click();await page.mouse.move(2,2);}
      else await d.press('Enter');
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);await d.snap('03-complete');assert.equal(await next.count(),0);assert((await panel.innerText()).includes('已刻入 22 项 · 共 22 项'));
    const after=await read();assert.equal(after.kindlingReserve,before.kindlingReserve-route.reduce((sum,step)=>sum+step.cost,0));assert.equal(after.growth.upgrades.growth_defense_slot,3);assert.equal(after.moduleMaxHpTier,3);
    assert(after.modules.every(m=>m.hp===100&&m.maxHp===145));
    await d.press('Enter');assert.deepEqual(await read(),after,'completed route never charges again');
  }
  if(name==='legacy'){
    const saved=await read();assert.equal(saved.growth.schemaVersion,2);assert.equal(saved.growth.upgrades.growth_defense_slot,3);assert.equal(saved.growth.upgrades.growth_forecast_clarity,3);
    assert((await panel.innerText()).includes('已刻入 6 项 · 共 22 项'));assert.equal(await next.getAttribute('data-id'),'growth_vitality');
  }
  await d.press('Escape');await page.waitForTimeout(400);assert((await c.baseTo({x:128,y:242})).ok);await d.press('e');await page.waitForTimeout(450);await d.snap('04-offering');
  assert.equal(await page.locator('#defense-panel .slot-cell').count(),name==='fresh'||name==='poor'?1:name==='impact'?2:name==='crest'?3:4);
  await d.press('Escape');await page.waitForTimeout(350);await d.ledger('end');
  if(name==='linear'||name==='legacy'){
   const before=await read();await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1300);
   const after=await read();assert.deepEqual(after.growth,before.growth);assert.equal(after.kindlingReserve,before.kindlingReserve);assert.deepEqual(after.impactForecast,before.impactForecast);
   if(name==='linear'){const result=await c.depart('05-rift');assert(result.ok,JSON.stringify(result));await d.ledger('departed');}
  }
  assert.deepEqual(errors,[]);manifest.cases.push({name,ok:true,errors});
 }catch(e){manifest.cases.push({name,ok:false,error:String(e),errors});await page.screenshot({path:path.join(out,'failure.png')});throw e;}
 finally{await context.close();}
}}finally{fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));await browser.close();}
console.log(JSON.stringify(manifest,null,2));
