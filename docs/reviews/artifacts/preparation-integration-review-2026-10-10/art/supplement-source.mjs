import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const out='/Users/yilungao/coh/docs/reviews/artifacts/preparation-integration-review-2026-10-10/art';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage({viewport:{width:1020,height:1000},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:3027/docs/art/demos/preparation-threat-sample/');await page.waitForTimeout(2000);
for(const grade of ['low','medium','severe']){await page.locator(`button[data-grade=${grade}]`).click();await page.waitForTimeout(1500);await page.locator('.sample-stage').screenshot({path:`${out}/sample-${grade}.png`});}
await page.setViewportSize({width:960,height:688});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:3027/prepare-review.html?fixture=equipped');await page.waitForSelector('#inventory-panel');await page.waitForTimeout(900);await page.locator('[data-departure-grade=severe]').click();await page.waitForTimeout(300);
const probe=()=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).reverse().find(u=>/\/src\/ui\/dom\/inventory-panel\.ts(?:\?|$)/.test(u));const {inventoryPanel:p}=await import(url);const gl=p.prepareCanvas.getContext('webgl2'),program=gl.getParameter(gl.CURRENT_PROGRAM);return {telemetry:p.prepareVeil.getTelemetry(),uEquipment:gl.getUniform(program,gl.getUniformLocation(program,'uEquipment'))};});
const records=[await probe()];await page.locator('[data-prepare-action=next]').click();for(let i=0;i<10;i++){await page.waitForTimeout(30);records.push(await probe());}await page.screenshot({path:`${out}/reduced-equipment.png`});
fs.writeFileSync(`${out}/supplement.json`,JSON.stringify({browser:browser.version(),reduced:records},null,2));await browser.close();
