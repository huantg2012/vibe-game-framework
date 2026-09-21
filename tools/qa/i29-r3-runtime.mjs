import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';
const root='docs/qa/artifacts/iteration-29-r3',seed=JSON.parse(fs.readFileSync('docs/qa/artifacts/iteration-29-r2/runtime/linear/fixture.json'));
const route=fs.readFileSync('data/growth-route.csv','utf8').trim().split('\n').slice(1).map(s=>{const [order,id,level]=s.split(',');return{order:+order,id,level:+level};});
const cases=[{name:'body',owned:0,reserve:8},{name:'thicken',owned:6,reserve:12},{name:'forecast',owned:4,reserve:11}];
const result={method:'R3 production regression; isolated saves, real walking/inputs; read-only persisted production snapshots and DOM; no natural growth/economy claim',cases:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const spec of cases){
 const out=path.join(root,'runtime',spec.name);fs.mkdirSync(out,{recursive:true});
 const save=structuredClone(seed);save.kindlingReserve=spec.reserve;
 for(const step of route.slice(0,spec.owned)){if(step.id==='thicken')save.moduleMaxHpTier=step.level;else save.growth.upgrades[step.id]=step.level;}
 save.modules.forEach(m=>{m.hp=100;m.maxHp=100;});
 fs.writeFileSync(out+'/fixture.json',JSON.stringify(save,null,2));
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 await context.addInitScript(s=>localStorage.setItem('coh-save-v1',JSON.stringify(s)),save);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
 const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));

 try{
  await page.goto(process.env.I29_URL??'http://127.0.0.1:3025/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1500);
  for(const p of[{x:160,y:238},{x:112,y:216}])assert((await c.baseTo(p)).ok);
  await d.snap('01-world-before');await d.press('e');await page.waitForTimeout(450);await d.snap('02-before');
  const before=await read(),beforeText=await page.locator('#growth-panel').innerText();
  await d.press('Enter');await d.snap('03-after-immediate');await page.waitForTimeout(450);await d.snap('04-after');const after=await read();
  await d.press('Escape');await page.waitForTimeout(550);await d.snap('05-world-after');
  if(spec.name==='thicken'){
    assert(beforeText.includes('0 → 0'));assert.equal(after.kindlingReserve,0);assert.deepEqual(after.modules.map(m=>m.hp),before.modules.map(m=>m.hp));
    assert.equal(after.moduleMaxHpTier,1);
    const departure=await c.depart('06-depart');assert(departure.ok);await d.ledger('departed');assert.equal((await read()).riftCheckpoint.state.conditions.modifiers.startingChaos,0);
  }
  if(spec.name==='body'){
    for(const p of[{x:272,y:216},{x:272,y:112},{x:248,y:96},{x:224,y:88}])assert((await c.baseTo(p)).ok);
    await page.waitForTimeout(350);await d.snap('06-entrance-no-forecast');
    assert.equal((await read()).growth.upgrades.growth_forecast_clarity,0);
    const prompt=await page.locator('#purif-prompt').innerText();
    assert(/[？?]/.test(prompt),'level 0 uncertainty remains public');
    assert(!/x\d|×\d/.test(prompt),'no true multiplier at entrance');
    await d.press('e');await page.waitForTimeout(450);await d.snap('07-prepare');await d.press('Escape');await page.waitForTimeout(400);
  }
  if(spec.name==='forecast'){
    assert.equal(after.growth.upgrades.growth_forecast_clarity,1);
    assert.equal(after.kindlingReserve,0);
    assert.deepEqual(after.impactForecast,before.impactForecast,'purchase does not redraw forecast');
    for(const p of[{x:272,y:216},{x:272,y:112},{x:248,y:96},{x:224,y:88}])assert((await c.baseTo(p)).ok);
    await page.waitForTimeout(350);await d.snap('06-entrance-forecast-1');
    const prompt=await page.locator('#purif-prompt').innerText();
    assert(!/[？?]|x\d|×\d/.test(prompt),'level 1 discloses certain tier, not a raw multiplier');
    await d.press('Tab');await page.waitForTimeout(250);await page.locator('.crt-tab[data-tab="2"]').click();await d.snap('06-report');}
  await d.ledger('end');assert.deepEqual(errors,[]);result.cases.push({name:spec.name,before,after,beforeText,ok:true,errors});
 }catch(e){result.cases.push({name:spec.name,ok:false,error:String(e),errors});await page.screenshot({path:out+'/failure.png'});throw e;}
 finally{await context.close();}
}}finally{fs.writeFileSync(root+'/runtime/manifest.json',JSON.stringify(result,null,2));await browser.close();}
console.log(result.cases.map(c=>({name:c.name,ok:c.ok,reserve:c.before?.kindlingReserve+' -> '+c.after?.kindlingReserve})));
