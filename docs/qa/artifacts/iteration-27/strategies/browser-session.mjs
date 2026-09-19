import fs from 'node:fs';
import readline from 'node:readline';
import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createJourneyDriver} from '../../../../../tools/qa/i27-journey-driver.mjs';
const root=process.cwd()+'/docs/qa/artifacts/iteration-27/strategies';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context,page,driver,current;
async function load(name){
 if(context)await context.close();current=name;
 context=await browser.newContext({viewport:{width:1440,height:960}});
 await context.addInitScript(values=>{localStorage.clear();for(const [k,v]of Object.entries(values))localStorage.setItem(k,v);},JSON.parse(fs.readFileSync(root+'/'+name+'.storage.json','utf8')));
 page=await context.newPage();page.on('pageerror',e=>fs.appendFileSync(root+'/errors.jsonl',JSON.stringify({name,at:new Date().toISOString(),error:String(e)})+'\n'));
 driver=createJourneyDriver(page,root+'/'+name);await page.goto('http://127.0.0.1:3016/');await page.waitForTimeout(1200);return await driver.snap('00-menu');
}
const rl=readline.createInterface({input:process.stdin,terminal:false});console.log('READY');
for await(const line of rl){try{const cmd=JSON.parse(line);if(cmd.quit){await browser.close();break;}const result=await eval(`(async()=>{${cmd.js}})()`);console.log(JSON.stringify(result??null));}catch(e){console.log(JSON.stringify({error:String(e),stack:e.stack}));}}
