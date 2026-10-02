/** Actual UI modules and production Rift lifecycle in fresh Chromium storage.
 * Scheduler time is controlled; scene entry/threshold/pause use the real game.
 * This is a focused execution check, not a natural complete sortie. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = await import(pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
// tsx/esbuild names locally declared functions inside serialized page callbacks.
await context.addInitScript('globalThis.__name = (target) => target;');
const page = await context.newPage(), errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(String(e)));
const consoleErrors: string[] = [];
page.on('console',(message: any)=>{ if(message.type()==='error') consoleErrors.push(message.text()); });
const origin = process.env.NARRATION_URL ?? 'http://127.0.0.1:3027/';
const out = 'docs/qa/artifacts/rift-narration'; await mkdir(out, { recursive: true });
try {
  await context.route('**/__narration-check', (route: any) => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="background:#0b1010"></body></html>'}));
  await page.goto(new URL('/__narration-check', origin).href);
  const checks = await page.evaluate(async () => {
    const { EncounterNarration, RiftAtmosphereSchedule } = await import('/src/ui/dom/encounter-narration.ts');
    const { INFILTRATOR_FORM, REWRITER_FORM } = await import('/src/generation/contamination-draw.ts');
    const checks: string[] = [];
    const ok = (v: unknown, message: string) => { if (!v) throw new Error(message); checks.push(message); };
    const schedule = new RiftAtmosphereSchedule();
    ok(schedule.tick(1999, true, true) === null, 'entry does not precede two quiet seconds');
    ok(schedule.tick(1, true, true) === 'entry', 'eligible entry is one opportunity');
    ok(schedule.tick(44999, true, true) === null, 'quiet line observes minimum 45 seconds');
    ok(schedule.tick(1, true, true) === 'quiet', 'quiet line after interval');
    ok(schedule.tick(45000, true, true) === 'quiet' && schedule.tick(45000, true, true) === null, 'three-line sortie cap');
    const busy = new RiftAtmosphereSchedule();
    ok(busy.tick(13000, false, true) === null && busy.tick(2000, true, true) === null, 'busy entry expires without delayed catch-up');
    busy.tick(43000, false, true);
    ok(busy.tick(2000, true, true) === null, 'busy exploration opportunity discarded instead of queued');
    const restored = new RiftAtmosphereSchedule(true);
    ok(restored.tick(1000000, true, true) === null, 'unknown checkpoint budget never replays entry or replenishes ambient cap');
    const interrupted = new RiftAtmosphereSchedule(); interrupted.tick(1000,true,true); interrupted.interrupt();
    ok(interrupted.tick(3000,true,true)===null,'encounter/threshold cancels pending entry');
    const n = new EncounterNarration(); n.create();
    const subject = {id:'qa-one',form:INFILTRATOR_FORM,identifiable:true};
    ok(n.tick([subject],false), 'first visible edge speaks'); n.advance(250);
    const read = () => document.querySelector('#rift-encounter-log')?.textContent;
    const first = read(); n.advance(61000);
    ok(!n.tick([subject],false), 'continuous visibility never repeats after cooldown');
    n.tick([{...subject,identifiable:false}],false);
    ok(n.tick([subject],false) && read()!==first, 'same identity next encounter rotates prose without changing identity');
    n.advance(4000);
    ok(!n.tick([{...subject,id:'qa-two'}],false), 'different individual shares identity cooldown');
    const hear={id:'qa-hear',form:REWRITER_FORM,identifiable:true};
    ok(!n.tick([hear],true), 'blocked edge not shown'); n.advance(61000);
    ok(!n.tick([hear],false), 'blocked edge never becomes queued speech');
    n.tick([{...hear,identifiable:false}],false);ok(n.tick([hear],false),'new visible edge after silence still works');
    n.showThreshold('阈值测试句。'); n.advance(250);
    ok(document.querySelectorAll('#rift-encounter-log').length===1 && read()==='阈值测试句。','threshold owns the existing single slot');
    const frozen=document.querySelector('#rift-encounter-log')?.getAttribute('style');
    await new Promise(resolve=>setTimeout(resolve,350));
    ok(document.querySelector('#rift-encounter-log')?.getAttribute('style')===frozen && read()==='阈值测试句。','without Scene delta neither opacity nor text advances');
    n.advance(3000);ok(!n.isBusy(),'active time releases slot');n.destroy();
    ok(!document.querySelector('#rift-encounter-log'),'destroy removes the only line immediately');
    return checks;
  });
  await page.goto(origin);await page.getByRole('button',{name:'开始',exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'开始',exact:true}).click();await page.locator('#purif-hud').waitFor({timeout:30000});
  await page.locator('#menu-entry-transition').waitFor({state:'detached',timeout:30000});
  await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');audioManager.game.scene.getScene('PurificationScene').transitionToRift();});
  // The polling predicate must be synchronous: an import Promise itself is truthy.
  await page.waitForFunction(()=>{const game=(window as any).__game;return game?.scene.isActive('RiftScene') && game.scene.getScene('RiftScene').narrationMs>0 && !!document.getElementById('rift-encounter-log');},null,{timeout:60000});
  await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('RiftScene');s.chaos.addChaos('qa-threshold-crossing',102-s.chaos.getValue());});
  await page.waitForFunction(()=>document.querySelector('#rift-encounter-log')?.getAttribute('data-narration-kind')==='threshold');
  await page.waitForTimeout(400);
  const active=await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('RiftScene');const scopes=JSON.parse(localStorage.getItem('coh.atmosphere.v1')!).scopes;return{world:s.narrationWorld,level:s.thresholdLevel,text:document.getElementById('rift-encounter-log')?.textContent,flash:document.querySelectorAll('.chaos-threshold-overlay').length,chaos:s.chaos.getValue(),consumed:Object.keys(scopes).filter(k=>k.startsWith('atmosphere:chaos.'))};});
  assert.equal(active.level,3);assert(active.chaos>=100);assert.equal(active.flash,1);assert.deepEqual(active.consumed,['atmosphere:chaos.3']);checks.push('real ChaosSystem crosses three thresholds in one frame; Rift consumes only highest prose');
  await page.screenshot({path:`${out}/threshold.png`});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>document.getElementById('pause-overlay')?.style.display==='flex');
  await page.waitForFunction(()=> (window as any).__game.scene.isPaused('RiftScene'));
  assert.equal(await page.locator('#rift-encounter-log').evaluate((el:HTMLElement)=>el.style.visibility),'hidden');
  assert.equal(await page.locator('.chaos-threshold-overlay').evaluate((el:HTMLElement)=>el.style.visibility),'hidden');
  const frozen=await page.locator('#rift-encounter-log').getAttribute('style');await page.waitForTimeout(500);assert.equal(await page.locator('#rift-encounter-log').getAttribute('style'),frozen);checks.push('actual Scene blur pause hides and freezes narration and threshold flash');
  await page.keyboard.press('x');await page.waitForFunction(()=> (window as any).__game.scene.isActive('RiftScene'));assert.equal(await page.locator('#rift-encounter-log').evaluate((el:HTMLElement)=>el.style.visibility),'');await page.waitForTimeout(3200);assert.equal(await page.locator('.chaos-threshold-overlay').count(),0);checks.push('resume restores current reading then finishes and removes warning');
  await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');audioManager.game.scene.getScene('RiftScene').scene.start('MainMenuScene');});
  await page.getByRole('button',{name:'继续',exact:true}).waitFor({timeout:30000});assert.equal(await page.locator('#rift-encounter-log').count(),0);assert.equal(await page.locator('.chaos-threshold-overlay').count(),0);checks.push('real scene shutdown leaves neither narration nor threshold overlay');
  assert.deepEqual(errors,[]);const result={status:'PASS',at:new Date().toISOString(),checks,active,errors,scope:'Controlled module/scheduler tests and actual Rift production entry, coalesced warning, pause/resume/shutdown in test-owned browser. Quiet encounters use controlled time; no full natural sortie claim.'};
  await writeFile(`${out}/result.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(error){
  await page.screenshot({path:`${out}/failure.png`});
  console.error(await page.evaluate(async()=>{const {audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game?.scene.getScene('RiftScene');return{errors:document.body.textContent,active:s?.sys.isActive(),paused:s?.sys.isPaused(),pending:s?.pendingNarrationThreshold,level:s?.thresholdLevel,clock:s?.narrationMs,entry:s?.entryView,ended:s?.runController?.isRunEnded(),blocked:s?.frameCommit?.isBlocked()};}));
  console.error({errors,consoleErrors});throw error;
}finally{await context.close();await browser.close();}
