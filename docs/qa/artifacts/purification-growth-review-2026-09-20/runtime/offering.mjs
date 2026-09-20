import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from '../../../../../tools/qa/i27-journey-driver.mjs';
import { createCycleInputs } from '../../../../../tools/qa/i27-cycle-inputs.mjs';
const root=path.dirname(new URL(import.meta.url).pathname);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try{
 for(const count of [3,4]){
  const storage=JSON.parse(fs.readFileSync(path.join(root,`../growth/offering-${count}.storage.json`)));
  const out=path.join(root,`offering-${count}`);fs.mkdirSync(out,{recursive:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:960}});
  await ctx.addInitScript(v=>{for(const[k,s]of Object.entries(v))localStorage.setItem(k,s);},storage);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
  await page.goto('http://127.0.0.1:3023/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await d.press('Enter');
  await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1800);await d.snap('01-hub');
  for(const p of [{x:175,y:238},{x:128,y:242}]){const r=await c.baseTo(p);if(!r.ok)throw new Error(JSON.stringify(r));}
  await d.snap('02-offering-world');await d.press('e');await page.waitForTimeout(500);await d.snap('03-offering-panel');
  results.push({count,method:'Production-factory preseeded current-schema isolated fixture, not naturally acquired. Real keyboard approach and panel open.',errors});
  await ctx.close();
 }
}finally{fs.writeFileSync(path.join(root,'offering-manifest.json'),JSON.stringify(results,null,2));await browser.close();}
