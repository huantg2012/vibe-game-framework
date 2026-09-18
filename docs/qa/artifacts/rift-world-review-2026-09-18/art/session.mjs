import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import readline from 'node:readline';
import fs from 'node:fs';
const out = '/Users/yilungao/coh/docs/qa/artifacts/rift-world-review-2026-09-18/art';
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:1600,height:1040},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:3011/rift-worlds.html');
const log = (entry) => fs.appendFileSync(out+'/actions.jsonl', JSON.stringify({time:new Date().toISOString(),...entry})+'\n');
const snapshot = async (name) => {
  await page.screenshot({path:out+'/'+name+'.png'});
  const text = await page.locator('body').innerText();
  const controls = await page.locator('button, input, select, a').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,text:n.textContent,value:n.value,type:n.type,id:n.id,href:n.href,options:n.options?Array.from(n.options).map(o=>({text:o.text,value:o.value})):undefined})));
  const result = {name,url:page.url(),text,controls}; log({type:'snapshot',...result}); console.log(JSON.stringify(result));
};
await snapshot('a01-entry');
for await (const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})) {
  try {
    const cmd = JSON.parse(line); log({type:'command',cmd});
    if(cmd.op==='quit') break;
    if(cmd.op==='shot') await snapshot(cmd.name);
    if(cmd.op==='click') {await page.getByRole('button',{name:cmd.name,exact:true}).click(); await snapshot(cmd.shot);}
    if(cmd.op==='select') {await page.locator(cmd.selector).selectOption(cmd.value); await snapshot(cmd.shot);}
    if(cmd.op==='fill') {await page.locator(cmd.selector).fill(cmd.value); await snapshot(cmd.shot);}
    if(cmd.op==='key') {await page.keyboard.press(cmd.key); await snapshot(cmd.shot);}
    if(cmd.op==='hold') {for(const k of cmd.keys)await page.keyboard.down(k);await page.waitForTimeout(cmd.ms);for(const k of cmd.keys)await page.keyboard.up(k);await snapshot(cmd.shot);}
    if(cmd.op==='viewport'){await page.setViewportSize({width:cmd.width,height:cmd.height});await snapshot(cmd.shot);}
    if(cmd.op==='wait'){await page.waitForTimeout(cmd.ms);await snapshot(cmd.shot);}
  } catch(error) {log({type:'error',error:error.message});console.log(JSON.stringify({error:error.message}));}
}
await browser.close();
