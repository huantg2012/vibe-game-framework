import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from '../../../../../tools/qa/i27-journey-driver.mjs';
import { createCycleInputs } from '../../../../../tools/qa/i27-cycle-inputs.mjs';
const out=path.join(path.dirname(new URL(import.meta.url).pathname),'walk-verified');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:960}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
try{
 await page.goto('http://127.0.0.1:3023/');
 await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await d.snap('00-title');
 await d.press('Enter');
 await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));
 await page.waitForTimeout(1800);
 await d.snap('01-fresh-hub');
 await d.ledger('fresh');

 const stops=[
 ['02-core',[{x:224,y:216}]],
 ['03-growth',[{x:112,y:216}]],
 ['04-offering',[{x:128,y:242}]],
 ['05-purifier',[{x:180,y:246},{x:224,y:276}]],
 ['06-storage',[{x:280,y:250},{x:336,y:216}]],
 ['07-rift',[{x:272,y:224},{x:272,y:112},{x:248,y:96},{x:224,y:88}]]
 ];
 for(const [label,points]of stops){
   let ok=true;
   for(const pt of points){const r=await c.baseTo(pt);d.log({event:'base-walk',label,...r});if(!r.ok){ok=false;break;}}
   await d.snap(label+'-world');
   if(!ok)throw new Error('Route failed: '+label);
   await d.press('e');await page.waitForTimeout(420);await d.snap(label+'-panel');
   await d.press('Escape');await page.waitForTimeout(380);
 }
 await d.ledger('end');
 console.log(JSON.stringify({state:await d.state(),errors},null,2));

}finally{fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(errors,null,2));await context.close();await browser.close();}
