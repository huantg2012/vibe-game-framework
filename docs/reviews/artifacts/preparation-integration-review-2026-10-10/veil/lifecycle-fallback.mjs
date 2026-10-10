import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const out='docs/reviews/artifacts/preparation-integration-review-2026-10-10/veil';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:960,height:688}});
const report={contextLoss:{console:[],states:[]},fallback:{console:[],grades:[]}};
page.on('console',m=>report.contextLoss.console.push({type:m.type(),text:m.text()}));
await page.goto('http://127.0.0.1:3027/prepare-review.html?fixture=equipped');await page.waitForSelector('#inventory-panel');await page.waitForTimeout(1200);
const renderer=()=>page.evaluate(()=>({lost:window.__game.renderer.gl.isContextLost(),rendererLost:window.__game.renderer.contextLost,drawCount:window.__game.renderer.drawCount,scene:window.__prepareReview.getState().scenes,panel:!!document.querySelector('#inventory-panel')}));
let lossAt=null;
for(let i=1;i<=30;i++){await page.evaluate(()=>{window.__prepareReview.close();window.__prepareReview.open();});await page.waitForTimeout(70);let s=await renderer();report.contextLoss.states.push({cycle:i,...s});if(s.lost){lossAt=i;break;}}
report.contextLoss.lossAt=lossAt;
await page.evaluate(()=>window.__prepareReview.close());report.contextLoss.afterClose=await renderer();
await page.waitForTimeout(1000);report.contextLoss.afterOneSecond=await renderer();await page.screenshot({path:`${out}/world-after-close-1s.png`});
await page.waitForTimeout(9000);report.contextLoss.afterTenSeconds=await renderer();await page.screenshot({path:`${out}/world-after-close-10s.png`});
const fallback=await browser.newPage({viewport:{width:960,height:688}});
fallback.on('console',m=>report.fallback.console.push({type:m.type(),text:m.text()}));
await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')return null;return original.call(this,type,...args);};});
await fallback.goto('http://127.0.0.1:3027/prepare-review.html?fixture=equipped');await fallback.waitForSelector('#inventory-panel');await fallback.waitForTimeout(1200);
for(const grade of ['low','medium','severe']){await fallback.locator(`[data-departure-grade=${grade}]`).click();await fallback.waitForTimeout(350);report.fallback.grades.push(await fallback.evaluate(()=>({grade:window.__prepareReview.getState().grade,gameGL:window.__game.renderer.gl.constructor.name,lost:window.__game.renderer.gl.isContextLost(),canvasHidden:document.querySelector('.inventory-prepare-veil').hidden,error:document.querySelector('.inventory-prepare-veil').dataset.error,backdropClass:document.querySelector('.inventory-prepare-backdrop').className,backdropCSS:document.querySelector('.inventory-prepare-backdrop').getAttribute('style')})));await fallback.screenshot({path:`${out}/fallback-${grade}.png`});}
await fallback.locator('[data-prepare-action=next]').click();report.fallback.equipmentAccessible=await fallback.locator('#inventory-panel').getAttribute('data-prepare-view');
fs.writeFileSync(`${out}/lifecycle-fallback.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));
