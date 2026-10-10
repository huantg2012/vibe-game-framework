/** Production presentation over an isolated real-scene fixture; no player saves. */
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.QA_OUTPUT??`docs/qa/artifacts/preparation-integration-2026-10-10/presentation-${Date.now()}`;assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:960,height:688},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const report={errors,frames:[],checks:[]};
try{
await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3040'}/prepare-review.html?fixture=equipped`);
await page.waitForSelector('#inventory-panel');
await page.waitForTimeout(900);
const get=()=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).reverse().find(u=>/\/src\/ui\/dom\/inventory-panel\.ts(?:\?|$)/.test(u));const {inventoryPanel:p}=await import(url);return {telemetry:p.prepareVeil?.getTelemetry(),text:p.prepareNarration?.textContent,actor:p.options?.getPreparationActorRegion?.(),paused:p.options?.isPreparationPaused?.()};});
for(const grade of ['low','medium','severe']){
 await page.locator(`[data-departure-grade=${grade}]`).click();await page.waitForTimeout(1500);
 const a=await get();await page.screenshot({path:`${out}/${grade}.png`});await page.waitForTimeout(600);const b=await get();
 assert(b.telemetry.timeSeconds>a.telemetry.timeSeconds);assert(b.telemetry.travelPixels>a.telemetry.travelPixels);assert(b.text);report.frames.push({grade,a,b});
}
await page.locator('[data-departure-grade=low]').click();await page.waitForTimeout(180);const mid=await get();assert(mid.telemetry.transitionActive);assert(mid.telemetry.currentLevel>0&&mid.telemetry.currentLevel<2);report.checks.push('continuous downward transition');
await page.locator('[data-departure-grade=severe]').click();await page.waitForTimeout(1400);await page.locator('[data-prepare-action=next]').click();await page.waitForTimeout(1300);
const equipment=await get();assert.equal(equipment.text,'');assert(equipment.telemetry.phaseSpeed<.36);await page.screenshot({path:`${out}/equipment.png`});
await page.evaluate(()=>window.__game.scene.pause('PurificationScene'));await page.waitForTimeout(100);const paused=await get();await page.waitForTimeout(500);const frozen=await get();assert.equal(frozen.telemetry.timeSeconds,paused.telemetry.timeSeconds);assert.equal(frozen.telemetry.rafScheduled,false);report.checks.push('pause freezes veil and stops its RAF');
await page.evaluate(()=>window.__game.scene.resume('PurificationScene'));await page.waitForTimeout(150);assert((await get()).telemetry.timeSeconds>frozen.telemetry.timeSeconds);
await page.locator('.inventory-prepare-back').click();await page.waitForTimeout(350);assert.equal((await get()).text,'');
await page.evaluate(()=>window.__prepareReview.close());assert.equal(await page.locator('.inventory-prepare-veil').count(),0);await page.waitForTimeout(400);await page.evaluate(()=>window.__prepareReview.open());await page.waitForTimeout(400);assert.equal((await get()).text,'');report.checks.push('read grade and close/reopen do not replay narration');
await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-departure-grade=severe]').click();await page.waitForTimeout(200);const reduced=await get();assert.equal(reduced.telemetry.motionEnabled,false);assert.equal(reduced.telemetry.currentLevel,2);await page.waitForTimeout(200);assert.equal((await get()).telemetry.timeSeconds,reduced.telemetry.timeSeconds);report.checks.push('reduced motion retains severe stable composition');
await page.emulateMedia({reducedMotion:'no-preference'});
for(let i=0;i<20;i++){await page.evaluate(()=>{window.__prepareReview.close();window.__prepareReview.open();});await page.waitForTimeout(30);assert.equal(await page.locator('.inventory-prepare-veil').count(),1);}
report.checks.push('20 close/open cycles retain one veil');
await page.locator('.inventory-prepare-veil').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.waitForTimeout(100);await page.locator('[data-prepare-action=next]').click();assert.equal(await page.locator('#inventory-panel').getAttribute('data-prepare-view'),'equipment');report.checks.push('context loss preserves equipment navigation');
assert.deepEqual(errors,[]);report.status='PASS';
}catch(e){report.failure=String(e);}finally{fs.writeFileSync(`${out}/vfx-report.json`,JSON.stringify(report,null,2));await browser.close();}
if(report.failure)throw new Error(report.failure);
