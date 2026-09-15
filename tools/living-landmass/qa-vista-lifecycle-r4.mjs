/** Bounded read-only lifecycle observer, separate from the complete route. */
import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir='docs/qa/artifacts/iteration-23/vista-r4/lifecycle-supplement';await mkdir(dir,{recursive:true});
const report={method:'Real navigation of same-origin visible game iframe; passive parent references observe native AudioContext state and close promises after iframe unload. Normal keys; no product state writes.',events:[],errors:[]};
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.route('http://127.0.0.1:3011/qa-lifecycle.html',r=>r.fulfill({contentType:'text/html',body:'<script>window.__qaContexts=[];window.__qaClose=[];window.__qaWatch=(c,p)=>{window.__qaClose.push({type:"called",state:c.state});p.then(()=>window.__qaClose.push({type:"resolved",state:c.state}));}</script><iframe src="/living-landmass-stage.html" style="width:1400px;height:950px;border:0"></iframe>'}));
 await page.addInitScript(()=>{if(window.parent===window)return;const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...a){super(...a);window.parent.__qaContexts.push(this);}close(){const p=super.close();window.parent.__qaWatch(this,p);return p;}};});
 await page.goto('http://127.0.0.1:3011/qa-lifecycle.html');
 const frame=page.frames().find(f=>f.parentFrame());await frame.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:15000});
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 await frame.locator('#game-container').click();await page.keyboard.press('w');await page.waitForTimeout(400);
 report.before=await frame.evaluate(()=>window.__livingLandmassStage.getState());
 // Native activation fallback after CUA discovery itself stalled. Strict 3s process bound.
 const activate=spawnSync('osascript',['-e','tell application "Finder" to activate'],{encoding:'utf8',timeout:3000});
 report.activation={status:activate.status,error:String(activate.error??activate.stderr??'')};
 await page.waitForTimeout(300);report.focusFact=await frame.evaluate(()=>({focused:document.hasFocus(),hidden:document.hidden}));
 const a=await frame.evaluate(()=>window.__livingLandmassStage.getState());await page.waitForTimeout(500);const b=await frame.evaluate(()=>window.__livingLandmassStage.getState());
 report.paused={a:a.inputPaused,b:b.inputPaused,audio:b.audio,positionStable:a.player.x===b.player.x&&a.player.y===b.player.y,clockStable:a.audio.presentationSeconds===b.audio.presentationSeconds};
 await page.bringToFront();await frame.locator('#game-container').click();await page.keyboard.press('d');await page.waitForTimeout(200);report.resumed=await frame.evaluate(()=>window.__livingLandmassStage.getState());
 await frame.goto('about:blank');await page.waitForTimeout(500);
 report.contexts=await page.evaluate(()=>window.__qaContexts.map(c=>({state:c.state})));report.events=await page.evaluate(()=>window.__qaClose);
 report.closePassed=report.contexts.length>=2&&report.contexts.every(c=>c.state==='closed')&&report.events.some(e=>e.type==='resolved');
 report.blurVerified=(!report.focusFact.focused||report.focusFact.hidden)&&b.inputPaused&&b.audio.paused&&report.paused.clockStable;
 report.resumeVerified=report.blurVerified&&!report.resumed.inputPaused&&report.resumed.audio.state==='running';
 report.sourceHashes={};for(const file of ['scene','vista-audio','vista-motion'])report.sourceHashes[file]=createHash('sha256').update(await readFile(`src/dev/living-landmass-stage/${file}.ts`)).digest('hex');
}catch(e){report.errors.push(String(e));}
finally{await browser.close();await writeFile(`${dir}/evidence.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({closePassed:report.closePassed,blurVerified:report.blurVerified,resumeVerified:report.resumeVerified,focusFact:report.focusFact,events:report.events,errors:report.errors}));}
