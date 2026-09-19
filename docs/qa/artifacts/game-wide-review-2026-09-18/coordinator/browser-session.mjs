import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import readline from 'node:readline';
const root = '/Users/yilungao/coh/docs/qa/artifacts/game-wide-review-2026-09-18/coordinator';
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context = await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
const page = await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
let index=0;
async function snapshot(label) {
  const name=String(index++).padStart(3,'0')+'-'+label;
  await page.screenshot({path:root+'/'+name+'.png'});
  const row={time:new Date().toISOString(),name,url:page.url(),text:await page.locator('body').innerText(),errors:[...errors]};
  fs.appendFileSync(root+'/actions.jsonl',JSON.stringify(row)+'\n');
  return row;
}
async function hold(keys,ms){for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);}
async function saved(label){const values=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));fs.writeFileSync(root+'/'+label+'.storage.json',JSON.stringify(values,null,2));return values;}
await page.goto('http://127.0.0.1:3013/');
await page.waitForTimeout(1400);
console.log(JSON.stringify(await snapshot('menu')));
for await (const line of readline.createInterface({input:process.stdin})) {
  try {
    const cmd=JSON.parse(line);
    if(cmd.quit)break;
    fs.appendFileSync(root+'/actions.jsonl',JSON.stringify({time:new Date().toISOString(),command:cmd})+'\n');
    const value=await eval('(async()=>{'+cmd.js+'})()');
    console.log(JSON.stringify({value}));
  }catch(error){console.log(JSON.stringify({error:String(error),stack:error.stack}));}
}
fs.writeFileSync(root+'/pageerrors.json',JSON.stringify(errors,null,2));
await browser.close();
