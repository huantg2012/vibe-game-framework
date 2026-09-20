import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from '../../../../../tools/qa/i27-journey-driver.mjs';
import { createCycleInputs } from '../../../../../tools/qa/i27-cycle-inputs.mjs';
const root=path.dirname(new URL(import.meta.url).pathname);
const fresh=JSON.parse(fs.readFileSync(path.join(root,'walk-verified/fresh.storage.json')));
const base=JSON.parse(fresh['coh-save-v1']);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const manifest={version:'74bdd25',method:'Isolated preseeded current-schema save variants. Starting reserve/HP/upgrades/stability set explicitly, not earned through played sorties. All subsequent walking and panel actions use real keyboard events. No user storage.',cases:[]};
try{
 for(const name of ['funded-full','damaged','capped']){
  const save=structuredClone(base); save.kindlingReserve=100;
  for(const m of save.modules)m.hp=100;
  if(name==='damaged')save.modules.forEach((m,i)=>m.hp=[15,22,8][i]);
  if(name==='capped'){
   save.growth.upgrades={growth_chaos_resist:5,growth_kindling_affinity:3,growth_vitality:4,growth_sortie_slot:1,growth_defense_slot:1,growth_forecast_clarity:3};
   save.moduleMaxHpTier=3; for(const m of save.modules){m.maxHp=145;m.hp=145;}
   save.stability={progress:100,reached:true};
  }
  const out=path.join(root,name);fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'fixture.save.json'),JSON.stringify(save,null,2));
  const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:960}}});
  await context.addInitScript(value=>localStorage.setItem('coh-save-v1',JSON.stringify(value)),save);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
  await page.goto('http://127.0.0.1:3023/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1800);
  await d.snap('01-hub');
  await d.press('Tab');await page.waitForTimeout(350);await d.snap('02-status');await d.press('Escape');await page.waitForTimeout(400);
  for(const point of [{x:160,y:238},{x:112,y:216}]){const r=await c.baseTo(point);if(!r.ok)throw new Error(JSON.stringify(r));}
  await d.press('e');await page.waitForTimeout(420);await d.snap('03-growth');
  if(name==='funded-full'){
   await d.press('ArrowDown');await d.press('Enter');await page.waitForTimeout(450);await d.snap('04-affinity-purchased');
   for(let i=0;i<5;i++)await d.press('ArrowDown');
   await d.snap('05-before-thicken');await d.press('Enter');await page.waitForTimeout(450);await d.snap('06-after-thicken');
  }
  await d.press('Escape');await page.waitForTimeout(500);await d.snap('07-after-close');
  if(name==='funded-full'){await d.press('Tab');await page.waitForTimeout(350);await d.snap('08-after-status');}
  await d.ledger('end');manifest.cases.push({name,errors,phase:'captured'});
  await context.close();
 }
}finally{fs.writeFileSync(path.join(root,'states-manifest.json'),JSON.stringify(manifest,null,2));await browser.close();}
