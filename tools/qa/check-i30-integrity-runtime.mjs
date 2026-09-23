/** Real production approach/focus paths in isolated storage. Color damage cases
 * are separately identified public-state fixtures, never natural-play evidence. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createChamberDriver } from './i30-chamber-driver.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.env.I30_OUT ?? 'docs/qa/artifacts/iteration-30-r7/integrity-runtime-final';
fs.mkdirSync(out, { recursive: true });
const sources = ['src/entities/purification-chamber-module.ts','src/ui/chamber-integrity-placement.ts','src/ui/dom/allocation-panel.ts','src/ui/dom/panel-styles.ts','src/scenes/purification-scene.ts','src/entities/player.ts','src/entities/player-weapon-rig.ts'];
const manifest = { at: new Date().toISOString(), method: 'Isolated new save, genuine keyboard movement/E/Escape, read-only frame probes. Art source may be undergoing separate R7 correction; these fingerprints lock the UI/player scope only.', sources: Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport:{width:1440,height:960} });
const page = await context.newPage();
page.on('pageerror', e => manifest.errors.push(String(e)));
await page.route('**/@vite/client', route => route.fulfill({contentType:'application/javascript',body:''}));
const d=createJourneyDriver(page,out), chamber=createChamberDriver(page,d);
async function sample(label) {
  const result=await page.evaluate(()=>{
    const scene=window.__game.scene.getScene('PurificationScene');
    const r=scene.player.getVisualBounds(scene.player.getSprite().getBounds());
    const player={left:r.left,right:r.right,top:r.top,bottom:r.bottom};
    const overlap=(a,b,gap=0)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
    const bars=[scene.coreModule,scene.storageModule,scene.purifierModule].filter(m=>m.inRange&&!m.focused&&m.readout.visible).map(m=>({id:m.id,...m.integrityPlacement, overlapsPlayer:overlap(m.integrityPlacement.rect,player,4.4),hp:m.getHpData(), hasDangerFill:m.readout.commandBuffer.includes(0xcc3333)}));
    const el=document.querySelector('.core-integrity');
    let dom=null;
    if(el&&scene.interactionModule){
      const geometry=scene.getIntegrityScreenGeometry(scene.interactionModule.id);
      const rect={left:el.offsetLeft,top:el.offsetTop,right:el.offsetLeft+el.offsetWidth,bottom:el.offsetTop+el.offsetHeight};
      const reserved=[...document.querySelectorAll('#allocation-panel .core-work,#allocation-panel .core-identity')].map(n=>({left:n.offsetLeft,top:n.offsetTop,right:n.offsetLeft+n.offsetWidth,bottom:n.offsetTop+n.offsetHeight}));
      const identity=document.querySelector('#allocation-panel .core-identity');
      const identityRect={left:identity.offsetLeft,top:identity.offsetTop,right:identity.offsetLeft+identity.offsetWidth,bottom:identity.offsetTop+identity.offsetHeight};
      dom={rect,side:el.dataset.side,visible:getComputedStyle(el).visibility,player:geometry.player,
        identity:{rect:identityRect,visible:getComputedStyle(identity).visibility,device:geometry.device},
        overlapsPlayer:overlap(rect,geometry.player,7.4),overlapsControls:reserved.some(r=>overlap(rect,r,7.4)),
        color:getComputedStyle(el.querySelector('.pbar-fill')).backgroundColor, fillWidth:el.querySelector('.pbar-fill').offsetWidth, width:el.offsetWidth, text:el.innerText};
    }
    return {player,bars,dom};
  });
  for(const bar of result.bars) assert(!bar.overlapsPlayer,`${label}: ${bar.id} world covers player`);
  if(result.dom?.identity.visible==='visible'){
    assert(result.dom.identity.rect.bottom<=result.dom.identity.device.top-7.5,`${label}: title overlaps device`);
    assert(result.dom.identity.rect.left>=16&&result.dom.identity.rect.right<=944&&result.dom.identity.rect.top>=16,`${label}: title leaves viewport`);
  }
  if(result.dom?.visible==='visible'){
    assert(!result.dom.overlapsPlayer,`${label}: DOM covers player ${JSON.stringify(result.dom)}`);
    assert(!result.dom.overlapsControls,`${label}: DOM covers controls/title`);
    assert.equal(result.dom.width,104);
  }
  return result;
}
async function focus(label){
  await d.press('e',20);
  await page.locator('#allocation-panel').waitFor({state:'visible'});
  const frames=[];
  for(let i=0;i<20;i++){ frames.push(await sample(`${label}-zoom-${i}`)); await page.waitForTimeout(18); }
  const result=await sample(label);
  assert.equal(result.dom?.visible,'visible',`${label} settled readout visible`);
  assert.equal(result.dom.identity.visible,'visible',`${label} settled title visible`);
  assert.equal(result.dom.color,'rgb(200, 205, 212)');
  await d.snap(label);
  manifest.checks.push({label,frames:frames.length,...result});
  await d.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#allocation-panel').count(),0);
}
async function approach(label,x,y){
  await chamber.walkFeet(x,y);await page.waitForTimeout(90);
  const result=await sample(label); assert(result.bars.length>0,`${label} nearby readout appears`);
  await d.snap(label); manifest.checks.push({label,...result});return result;
}
try{
  await page.goto(process.env.I30_URL??'http://127.0.0.1:3025/');
  await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),null);
  await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1800);
  await approach('01-core-approach-right',284,313);await focus('02-core-focus-right');
  await chamber.via([[285,322],[180,322]]);
  await approach('03-storage-approach-right',162,304);await focus('04-storage-focus-right');
  await chamber.via([[166,320],[135,320]]);
  await approach('05-storage-approach-left',141,304);await focus('06-storage-focus-left');
  await chamber.via([[180,322],[350,315],[413,307]]);
  await approach('07-purifier-approach-left',437,301);await focus('08-purifier-focus-left');
  await chamber.via([[450,311]]);
  await approach('09-purifier-approach-right',476,301);await focus('10-purifier-focus-right');
  // Real key turns while close to the purifier: each post-update must use the
  // current weapon/shoulder pose rather than one-frame-old bounds.
  for(const key of ['a','w','d','s']){await d.hold([key],45);await sample(`turn-${key}`);}
  manifest.checks.push({label:'four-facing-after-post-update',passed:true});
  const left=manifest.checks.find(v=>v.label==='07-purifier-approach-left').bars.find(v=>v.id==='PURIFIER');
  const right=manifest.checks.find(v=>v.label==='09-purifier-approach-right').bars.find(v=>v.id==='PURIFIER');
  assert.notEqual(left.side,right.side,'Real movement across purifier switches gauge side');
  // Explicit color-only damage fixture via the public state API in this isolated
  // context. It does not qualify as natural return/repair journey evidence.
  const damageFixture=await page.evaluate(async()=>{const {gameState}=await import('/src/managers/game-state.ts');const before={...gameState.getModule('PURIFIER')};gameState.applyDamage('PURIFIER',50);return {before,after:{...gameState.getModule('PURIFIER')}};});
  assert.equal(damageFixture.before.hp,70);assert.equal(damageFixture.after.hp,20);assert.equal(damageFixture.after.maxHp,100);
  await chamber.walkFeet(458,301); await page.waitForTimeout(100);
  const damagedWorld=await sample('11-danger-world-20of100');
  const damagedBar=damagedWorld.bars.find(bar=>bar.id==='PURIFIER');
  assert.equal(damagedBar.hp.hp,20);assert.equal(damagedBar.hp.maxHp,100);assert(damagedBar.hasDangerFill);
  await d.snap('11-danger-world-20of100');manifest.checks.push({label:'explicit-public-state-world20of100',...damagedWorld,damageFixture});
  await d.press('e');await page.waitForTimeout(450);
  const damaged=await sample('12-danger-focus-20of100');
  assert.equal(damaged.dom.color,'rgb(204, 51, 51)');
  assert(damaged.dom.text.includes('20 / 100'));assert(damaged.dom.fillWidth>0&&damaged.dom.fillWidth<damaged.dom.width/4);
  await d.snap('12-danger-focus-20of100');manifest.checks.push({label:'explicit-public-state-danger20of100',...damaged,damageFixture});
  await d.press('Escape');await page.waitForTimeout(280);
  assert.equal(await page.locator('#allocation-panel').count(),0);
  assert.equal(manifest.errors.length,0);
  manifest.result='PASS';
}catch(error){manifest.result='FAIL';manifest.failure=String(error);throw error;}
finally{fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await browser.close();}
console.log(`I30 integrity runtime PASS: ${manifest.checks.length} recorded cases.`);
