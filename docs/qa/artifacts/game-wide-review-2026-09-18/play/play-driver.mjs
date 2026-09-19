import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/yilungao/coh/docs/qa/artifacts/game-wide-review-2026-09-18/play';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900}, deviceScaleFactor:1, recordVideo:{dir:path.join(root,'video'),size:{width:1440,height:900}}});
const page = await context.newPage();
const started = Date.now();
let n = 0;
console.log(JSON.stringify({ready:true,viewport:'1440x900',mode:'fresh context; normal DOM/text/keyboard/mouse only'}));
for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
  if (!line.trim()) continue;
  const req = JSON.parse(line);
  const at = new Date().toISOString();
  try {
    for (const action of req.actions || []) {
      if(action.type==='goto') await page.goto(action.url,{waitUntil:'networkidle'});
      else if(action.type==='press') await page.keyboard.press(action.key);
      else if(action.type==='hold') { const keys=action.keys||[action.key]; for(const k of keys) await page.keyboard.down(k); await page.waitForTimeout(action.ms); for(const k of keys.slice().reverse()) await page.keyboard.up(k); }
      else if(action.type==='click') await page.getByRole(action.role||'button',{name:action.name,exact:action.exact ?? true}).click();
      else if(action.type==='clickText') await page.getByText(action.text,{exact:action.exact ?? true}).click();
      else if(action.type==='mouse') await page.mouse.click(action.x,action.y);
      else if(action.type==='wait') await page.waitForTimeout(action.ms);
      else throw new Error('Unknown action '+action.type);
    }
    n++;
    const shot = `${String(n).padStart(3,'0')}-${req.label || 'observation'}.png`;
    await page.screenshot({path:path.join(root,'screenshots',shot),fullPage:false});
    const text = await page.locator('body').innerText();
    const buttons = await page.getByRole('button').allTextContents();
    const record = {n,at,elapsedMs:Date.now()-started,expect:req.expect||'',actions:req.actions||[],screenshot:'screenshots/'+shot,text,buttons};
    fs.appendFileSync(path.join(root,'operations.jsonl'),JSON.stringify(record)+'\n');
    console.log(JSON.stringify(record));
    if(req.close) { await context.close(); await browser.close(); break; }
  } catch(e) {
    const record = {at,error:e.message,request:req};
    fs.appendFileSync(path.join(root,'operations.jsonl'),JSON.stringify(record)+'\n');
    console.log(JSON.stringify(record));
  }
}
