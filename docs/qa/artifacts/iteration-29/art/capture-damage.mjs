import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from '../../../../../tools/qa/i27-journey-driver.mjs';
import { createCycleInputs } from '../../../../../tools/qa/i27-cycle-inputs.mjs';
const root=path.dirname(new URL(import.meta.url).pathname);
const save=JSON.parse(fs.readFileSync(path.resolve(root,'../../purification-growth-review-2026-09-20/runtime/damaged/fixture.save.json'),'utf8'));
const out=path.join(root,'damaged-modules');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 await context.addInitScript(value=>localStorage.setItem('coh-save-v1',JSON.stringify(value)),save);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
 const driver=createJourneyDriver(page,out),cycle=createCycleInputs(page,driver);
 await page.goto('http://127.0.0.1:3025/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await driver.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1700);
 await driver.snap('01-hub');
 for(const [name,points]of [['core',[{x:224,y:218}]],['storage',[{x:274,y:230},{x:316,y:212}]],['purifier',[{x:286,y:268},{x:248,y:299}]]]){
  for(const point of points){const arrival=await cycle.baseTo(point);if(!arrival.ok)throw Error(JSON.stringify(arrival));}
  await driver.snap(name+'-world');await driver.press('e');await page.waitForTimeout(420);await driver.snap(name+'-panel');
  await driver.press('Escape');await page.waitForTimeout(300);
 }
 await context.close();
}finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({date:new Date().toISOString(),method:'Isolated preseeded damaged save; normal menu entry and real keyboard walking to all three module interactions. No runtime setters.',errors},null,2));await browser.close();}
