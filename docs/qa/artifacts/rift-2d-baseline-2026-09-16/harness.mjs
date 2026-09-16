import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import readline from 'node:readline';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const page=await context.newPage();
const errors=[]; const httpErrors=[]; const steps=[];
page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
page.on('response',r=>{if(r.status()>=400) httpErrors.push({url:r.url(),status:r.status()})});
const out='/Users/yilungao/coh/docs/qa/artifacts/rift-2d-baseline-2026-09-16';
await mkdir(out,{recursive:true});
const snapshot=()=>page.evaluate(()=>{const g=window.__game; const active=g.scene.getScenes(true).map(s=>s.scene.key); const s=g.scene.getScenes(true).find(s=>s.player); return {active,logicalSize:[g.config.width,g.config.height],canvasCount:document.querySelectorAll('canvas').length,player:s?.player?.getPosition(),journey:s?.probeJourneyState?.(),layout:s?.layoutDebug,fixture:s?.devFixture??null,presentation:s?.devPresentation??null,projector:!!s?.devWorldProjector,runtime:!!s?.devRuntime,extraction:s?.extraction?.extractionPoint,ended:s?.runController?.runEnded,reason:s?.runController?.lastEndReason,body:document.body.innerText}});
const hold=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key)};
const shot=async(name)=>{await page.screenshot({path:`${out}/${name}.png`}); const s=await snapshot();steps.push({name,...s});return s;};
await page.goto('http://127.0.0.1:3011/?riftSeed=7',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
await page.keyboard.press('Enter');
await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));
await page.waitForTimeout(1800);
console.log(JSON.stringify(await shot('01-purification'),null,2));
console.log('READY: available browser, context, page, snapshot(), hold(key,ms), shot(name), steps, errors, httpErrors, out; send JS line; use CLOSE to finish');
for await (const line of readline.createInterface({input:process.stdin,terminal:false})) {
  if(line==='CLOSE'){await writeFile(`${out}/evidence.json`,JSON.stringify({date:new Date().toISOString(),url:page.url(),steps,errors,httpErrors},null,2));await browser.close();break;}
  try {console.log(JSON.stringify(await eval(`(async()=>{${line}})()`),null,2)??'done')}catch(e){console.log('ERROR',String(e))}
}
