/** Human-directed screenshot/keyboard review. No map, enemy or reward inspection.
 * The scene is paused while a reviewer reads each frame; active intervals use
 * ordinary input and time. This is a bounded visual/interaction review, not
 * natural-duration or novice-navigation evidence. JSON commands on stdin. */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03/visual-play');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const log=value=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
page.on('pageerror',error=>log({error:String(error)}));
const target = new URL('/r100-gym.html', process.env.GAME_URL ?? 'http://127.0.0.1:3043');
target.search = new URLSearchParams({world:process.env.QA_WORLD??'ash-strata',grade:process.env.QA_GRADE??'medium',seed:process.env.QA_SEED??'20261004',loadout:process.env.QA_LOADOUT??'bare'}).toString();
log({method:'Screenshot-directed normal input; paused between observations. Explicit Gym equipment fixture, not natural supply.',url:target.href});
await page.goto(target.href);
await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
await page.locator('#pause').click();
let frame=0, previousElapsed=0;
async function snap(label){
 const file=path.join(out,`${String(frame++).padStart(3,'0')}-${label}.png`);await page.locator('#game-container canvas').screenshot({path:file});
 const visibleState=await page.evaluate(()=>{const p=window.__r100Gym.getState().runtime.probe;return{hp:p.hp,chaos:p.chaos,kindling:p.kindling,elapsedMs:p.elapsedMs,ended:p.ended,prompt:p.search.prompt}});
 if(visibleState.elapsedMs<previousElapsed)throw Error('Scene restarted during review; source changed or run reset. Preserve this attempt, do not count it.');
 previousElapsed=visibleState.elapsedMs;
 log({frame:file,state:visibleState});console.log(JSON.stringify({frame:file,state:visibleState}));
}
await snap('entry');
const rl=readline.createInterface({input:process.stdin});
try{for await(const raw of rl){
 let c;try{c=JSON.parse(raw);}catch{console.log('Invalid command JSON');continue;}
 if(c.quit)break;
 if(c.snap){await snap(c.snap);continue;}
 const ms=Number(c.ms??100);if(!Number.isFinite(ms)||ms<0||ms>30000)throw Error('Duration out of range');
 const keys=c.keys??[];if(!Array.isArray(keys)||!keys.every(k=>['w','a','s','d','e','q','f','Space'].includes(k)))throw Error('Only play keys');
 await page.locator('#pause').click();await page.locator('#game-container').focus();
 try{for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);}
 finally{for(const key of keys)await page.keyboard.up(key);}
 if(await page.evaluate(()=>!window.__r100Gym.getState().runtime.paused))await page.locator('#pause').click();
 log({keys,ms,label:c.label});await snap(c.label??'step');
}}
finally{await browser.close();}
