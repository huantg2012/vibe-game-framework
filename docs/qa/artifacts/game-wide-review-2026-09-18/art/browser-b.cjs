const fs = require('node:fs/promises');
const readline = require('node:readline');
const pw = require('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir='/Users/yilungao/coh/docs/qa/artifacts/game-wide-review-2026-09-18/art';
let browser,context,page; let log=[]; let started=Date.now();
async function record(action,detail=''){log.push({at:new Date().toISOString(),elapsedMs:Date.now()-started,action,detail}); await fs.writeFile(dir+'/B-input-log.json',JSON.stringify(log,null,2));}
async function snap(name){await page.screenshot({path:dir+'/'+name+'.png'});await record('screenshot',name+'.png');return name;}
async function press(key){await page.keyboard.press(key);await record('key',key);}
async function move(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await record('hold',{key,ms});}
async function click(text){await page.getByText(text,{exact:true}).click();await record('click visible text',text);}
(async()=>{browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,recordVideo:{dir:dir+'/B-video',size:{width:1440,height:1000}}});page=await context.newPage(); await page.goto('http://127.0.0.1:3013/'); await record('open','Fresh isolated context, production entry. Chrome launch required external sandbox approval after EPERM. Audio not monitored.'); console.log('READY B');for await(const line of readline.createInterface({input:process.stdin})){try{const result=await eval('(async()=>{'+line+'})()');console.log(JSON.stringify({result}));}catch(e){console.log(JSON.stringify({error:e.message}));}}})();
