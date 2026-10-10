import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const out='/Users/yilungao/coh/docs/reviews/artifacts/preparation-integration-review-2026-10-10/art';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:960,height:688},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:3027/prepare-review.html?fixture=equipped');await page.waitForSelector('#inventory-panel');await page.waitForTimeout(1400);
const captures=[];
async function capture(name){await page.screenshot({path:`${out}/${name}.png`});captures.push({name,time:Date.now(),state:await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).reverse().find(u=>/\/src\/ui\/dom\/inventory-panel\.ts(?:\?|$)/.test(u));const {inventoryPanel:p}=await import(url);return {telemetry:p.prepareVeil?.getTelemetry(),actor:p.options?.getPreparationActorRegion?.(),text:p.prepareNarration?.textContent};})});}
await capture('production-low');await page.waitForTimeout(1000);await capture('production-low-later');
for(const grade of ['medium','severe','low']) {await page.locator(`[data-departure-grade=${grade}]`).click();for(let i=0;i<7;i++){await page.waitForTimeout(150);await capture(`to-${grade}-${i}`);}await page.waitForTimeout(500);await capture(`production-${grade}-stable`);}
await page.locator('[data-departure-grade=severe]').click();await page.waitForTimeout(1500);await page.locator('[data-prepare-action=next]').click();await page.waitForTimeout(1400);await capture('production-equipment');
await page.locator('.inventory-prepare-back').click();await page.waitForTimeout(600);await capture('production-return');
await page.goto('http://127.0.0.1:3027/docs/art/demos/preparation-threat-sample/');await page.waitForTimeout(5000);await page.setViewportSize({width:1020,height:1000});
fs.writeFileSync(`${out}/sample-dom.txt`,await page.locator('body').innerText());await page.screenshot({path:`${out}/sample-initial.png`});
fs.writeFileSync(`${out}/capture.json`,JSON.stringify({errors,captures},null,2));await browser.close();
