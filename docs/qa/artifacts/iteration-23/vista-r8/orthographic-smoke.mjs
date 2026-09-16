import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('./2026-09-16T13-22-22-213Z/orthographic-smoke/', import.meta.url);
await mkdir(dir,{recursive:true});
const evidence={method:'Existing stage entry; real Start click and d key for 250ms, ordinary clock, read-only probe. No state injection.',errors:[],consoleErrors:[],observations:[]};
let browser;
try {
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>evidence.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text());});
 await page.goto('http://127.0.0.1:3011/spatial-slices.html?view=stage&route=long&loadout=bare&seed=7&autostart=0');
 await page.waitForFunction(()=>window.__spatialSlices?.getState().ready);
 await page.locator('#start').click();
 await page.waitForFunction(()=>{const l=window.__spatialSlices;return l.game.scene.isActive('RiftScene')&&l.game.scene.getScene('RiftScene').probeBuildLabState().elapsedMs>100;});
 await page.locator('#game-container').click({position:{x:18,y:18}});
 const read=()=>page.evaluate(()=>{const s=window.__spatialSlices.game.scene.getScene('RiftScene'),f=s.probePresentationFrame();return {orthographic:s.devRuntime?.presentation.camera.isOrthographicCamera,player:f.player.position,velocity:f.player.velocity,error:document.querySelector('#error')?.textContent??'',canvas:!!document.querySelector('canvas[data-spatial-stage]')};});
 evidence.observations.push(await read());
 await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');await page.waitForTimeout(250);
 evidence.observations.push(await read());
 await page.locator('canvas[data-spatial-stage]').screenshot({path:new URL('after-move.png',dir).pathname});
 const [a,b]=evidence.observations;
 evidence.passed=!!a.orthographic&&!!b.orthographic&&a.canvas&&b.canvas&&b.player.x>a.player.x&&!b.error&&!evidence.errors.length&&!evidence.consoleErrors.length;
}catch(e){evidence.failure=String(e.stack??e);evidence.passed=false;}finally{await browser?.close();await writeFile(new URL('evidence.json',dir),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence));
if(!evidence.passed)process.exitCode=1;
