/** Isolated state sheets only. Never count these storage fixtures as natural play. */
import fs from 'node:fs';
export async function captureDeviceVisuals(browser, sourceFile, out, url) {
 fs.mkdirSync(out,{recursive:true});
 const raw=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
 const original=JSON.parse(raw['coh-save-v1']);
 const results=[];
 for(const hp of [null,70,45,0]){
  const fixture=structuredClone(original),label=hp===null?'natural-return-purifier-zero':`fixture-all-${hp}`;
  if(hp!==null)fixture.modules.forEach(m=>{m.hp=hp;});
  const ctx=await browser.newContext({viewport:{width:1440,height:960}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await ctx.addInitScript(s=>localStorage.setItem('coh-save-v1',JSON.stringify(s)),fixture);
  await page.goto(url);await page.waitForTimeout(900);await page.keyboard.press('Enter',{delay:90});await page.waitForTimeout(1800);
  await page.screenshot({path:`${out}/${label}.png`});
  if(hp===45){await page.waitForTimeout(550);await page.screenshot({path:`${out}/${label}-blink.png`});}
  results.push({label,sourceFile,fixture:hp!==null,changedFields:hp===null?[]:['modules[*].hp'],modules:fixture.modules,errors,scripts:await page.locator('script[src]').evaluateAll(ns=>ns.map(n=>n.src))});
  await ctx.close();
 }
 fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(results,null,2));return results;
}
