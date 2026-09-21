import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from '../../../../../tools/qa/i27-journey-driver.mjs';
import { createCycleInputs } from '../../../../../tools/qa/i27-cycle-inputs.mjs';

const out = path.dirname(new URL(import.meta.url).pathname);
const review = path.resolve(out, '../../purification-growth-review-2026-09-20');
const cases = process.argv.slice(2);
const names = cases.length ? cases : ['funded-full','capped','damaged','offering-3'];
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const previous = fs.existsSync(path.join(out,'capture.json')) ? JSON.parse(fs.readFileSync(path.join(out,'capture.json'),'utf8')).cases : [];
const report = {date:new Date().toISOString(), method:'Isolated prior controlled current-schema save fixtures; normal menu entry and real keyboard walking. No user storage and no runtime mutation. Not natural progression evidence.', fixtureCorrection:'Empty-offering fixture clears both item locations and defense references; an earlier incomplete fixture was rejected at entry and is not a production defect.', cases:previous.filter(value=>!names.includes(value.name))};
try {
  for (const name of names) {
    const offeringSource = ['offering-empty','offering-crest'].includes(name) ? 'offering-3' : name;
    const savePath = name.startsWith('offering') ? path.join(review,`growth/${offeringSource}.save.json`) : path.join(review,`runtime/${name}/fixture.save.json`);
    const save = JSON.parse(fs.readFileSync(savePath,'utf8'));
    if (name === 'offering-empty') {
      for (const item of save.inventory.items) if (item.location.kind === 'defense') item.location = {kind:'stash'};
      save.inventory.equipment.defenseIds = save.inventory.equipment.defenseIds.map(()=>null);
    }
    if (name === 'offering-crest') {
      save.tide.phase = 'crest'; save.tide.cycleInPhase = 0; save.tide.currentIntensity = 1.6;
    }
    const context = await browser.newContext({viewport:{width:1440,height:960}});
    await context.addInitScript(value=>localStorage.setItem('coh-save-v1',JSON.stringify(value)),save);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
    const driver = createJourneyDriver(page,path.join(out,name));
    const cycle = createCycleInputs(page,driver);
    await page.goto('http://127.0.0.1:3025/');
    await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
    await driver.press('Enter');
    await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));
    await page.waitForTimeout(1700);
    await driver.snap('01-hub');
    const target = name.startsWith('offering') ? {x:143,y:247} : {x:112,y:216};
    for (const point of [{x:160,y:238},target]) {
      const arrival = await cycle.baseTo(point);
      if (!arrival.ok) throw new Error(JSON.stringify(arrival));
    }
    await driver.snap('02-world');
    await driver.press('e'); await page.waitForTimeout(420);
    await driver.snap('03-panel');
    if (!name.startsWith('offering')) {
      const cardIds = await page.locator('#growth-panel .upgrade-card').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')));
      const thickenIndex = cardIds.indexOf('thicken');
      for (let i=0;i<thickenIndex;i++) await driver.press('ArrowDown');
      await driver.snap('03b-thicken');
      await page.locator('#growth-panel .readout-detail').hover();
      await page.mouse.wheel(0,500); await page.waitForTimeout(180);
      await driver.snap('03b-thicken-scrolled');
      if (cardIds.includes('pending')) {
        await driver.press('ArrowDown'); await driver.snap('03c-pending');
      }
    }
    await driver.press('Escape'); await page.waitForTimeout(300);
    await driver.snap('04-after-close');
    report.cases.push({name,errors});
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2));
  await browser.close();
}
