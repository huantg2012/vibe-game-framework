import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import readline from 'node:readline';
const root='/Users/yilungao/coh/docs/qa/artifacts/rift-world-review-2026-09-18/play';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1600,height:1040},deviceScaleFactor:1});
const page=await context.newPage();
await page.goto('http://127.0.0.1:3011/rift-worlds.html');
await page.waitForTimeout(1200);
let n=0;
async function observe(label){const name=String(n++).padStart(3,'0')+'-'+label;await page.screenshot({path:root+'/screenshots/'+name+'.png'}); const info={time:new Date().toISOString(),name,url:page.url(),visibleText:await page.locator('body').innerText()};fs.appendFileSync(root+'/actions.jsonl',JSON.stringify(info)+'\n');console.log(JSON.stringify(info));}
await observe('initial');
for await(const line of readline.createInterface({input:process.stdin})){try{const cmd=JSON.parse(line);const start=new Date().toISOString();if(cmd.type==='hold'){for(const key of cmd.keys)await page.keyboard.down(key);await page.waitForTimeout(cmd.ms);for(const key of cmd.keys)await page.keyboard.up(key);}else if(cmd.type==='click'){await page.getByRole(cmd.role||'button',{name:cmd.name,exact:true}).click();}else if(cmd.type==='fill'){await page.getByRole('textbox').fill(cmd.value);}else if(cmd.type==='select'){await page.getByRole('combobox').nth(cmd.index||0).selectOption({label:cmd.label});}else if(cmd.type==='press'){await page.keyboard.press(cmd.key);}else if(cmd.type==='dom'){console.log(await page.locator('body').ariaSnapshot());}else if(cmd.type==='options'){console.log(await page.locator('select').allTextContents());}else if(cmd.type==='point'){await page.mouse.click(cmd.x,cmd.y);}else if(cmd.type==='quit'){break;}fs.appendFileSync(root+'/actions.jsonl',JSON.stringify({time:start,action:cmd})+'\n');await page.waitForTimeout(150);await observe(cmd.label||cmd.type);}catch(e){console.log('ERROR '+e.message);}}
await browser.close();
