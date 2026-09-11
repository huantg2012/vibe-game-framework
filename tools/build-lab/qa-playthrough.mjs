/** Independent QA: public configuration, actual keys, natural clock; all scene reads are observational. */
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root = process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/iteration-21';
const mode = process.env.CASE ?? 'watched-bare';
const dir = path.join(root, mode); await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const context = await browser.newContext({ viewport: { width: 1500, height: 960 }, recordVideo: { dir, size: { width: 1125, height: 720 } } });
// This is a new, nonpersistent incognito context, NOT a connection to the user's browser.
// Fail closed if any storage was unexpectedly inherited; never overwrite an existing record.
assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
const page = await context.newPage();
const evidence = { case: mode, method: 'UI setup, real keyboard/mouse thereafter, read-only snapshots, natural simulation clock.', observations: [], errors: [], checks: [] };
page.on('pageerror', e => evidence.errors.push(e.message));
// Sentinel setup occurs once, never re-written on reload; a production overwrite cannot be hidden.
await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3000'}/build-lab.html?autostart=0`);
await page.evaluate(() => {
  if (localStorage.getItem('coh-save-v1') !== null) throw new Error('Refusing to replace an existing save in QA context');
  localStorage.setItem('coh-save-v1', 'iteration21-independent-qa-original-save');
});
const scene = mode.startsWith('watched') ? 'watched' : mode.startsWith('contested') || mode.startsWith('death') ? 'contested' : 'periodic';
const build = mode.includes('quiet') ? 'quiet' : mode.includes('light') ? 'light' : mode.includes('melee') ? 'melee' : mode.includes('delay') ? 'cycle-delay' : mode.includes('suppress') ? 'cycle-suppress' : 'bare';
const volume = mode.includes('mist') ? 'mist_bank' : mode.includes('dust') ? 'dust_swarm' : 'gas_mass';
const held = new Set();
async function snapshot(label) { const s = await page.evaluate(() => window.__buildLab.getState()); if(label) evidence.observations.push({label,...s}); return s; }
async function release() { for (const key of held) await page.keyboard.up(key); held.clear(); }
async function press(key, ms=100) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }
async function move(axis, target, timeout=14000) {
  const before = await snapshot(); const direction = target > before.snapshot.player[axis] ? 1 : -1;
  const key = axis === 'x' ? direction > 0 ? 'd' : 'a' : direction > 0 ? 's' : 'w';
  await page.keyboard.down(key); held.add(key); const deadline = Date.now()+timeout;
  while (Date.now()<deadline) { const s = await snapshot(); if(s.snapshot.ended) throw new Error('Run ended during walking');
    if(direction*(target-s.snapshot.player[axis]) <= 2) { await release(); return; } await page.waitForTimeout(65); }
  await release(); throw new Error(`Walking blocked towards ${axis}=${target}: ${JSON.stringify((await snapshot()).snapshot.player)}`);
}
async function waypoint(x,y) { await move('x',x); await move('y',y); }
async function capture(label) { await snapshot(label); await page.screenshot({path:path.join(dir,`${label}.png`)}); }
async function waitPhase(phase,timeout=8000) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline) { if((await snapshot()).snapshot.hosts.some(h=>h.volume?.phase===phase))return; await page.waitForTimeout(50); }
 throw new Error(`Visible Host did not reach ${phase}`);
}
async function saveCheck(label) { assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),'iteration21-independent-qa-original-save'); evidence.checks.push(`formal save unchanged: ${label}`); }
async function extract() { await waypoint(176,400); await press('e',1600); await page.waitForTimeout(1000); const s=await snapshot('after-extract'); assert.equal(s.inventory.run.status,'settled'); assert.equal(s.inventory.run.outcome,'extract'); await saveCheck('actual extraction'); }
try {
 await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3000'}/build-lab.html?scene=${scene}&build=${build}&seed=7&volume=${volume}`);
 await page.waitForFunction(()=>window.__buildLab?.getState().snapshot?.enemies?.length>0);
 await page.locator('#game-container canvas').click(); await page.waitForTimeout(150);
 await capture('01-start'); await saveCheck('start');
 if(mode.startsWith('isolation')) {
   await page.locator('#seed').click();
   assert.equal((await snapshot()).paused,true,'Editing configuration pauses the old run');
   const focusPaused=(await snapshot()).snapshot.elapsedMs; await page.waitForTimeout(300); assert.equal((await snapshot()).snapshot.elapsedMs,focusPaused);
   evidence.checks.push('configuration focus pauses actual simulation'); await page.locator('#pause').click();
   await page.locator('#pause').click(); const paused=(await snapshot()).snapshot.elapsedMs; await page.waitForTimeout(300); assert.equal((await snapshot()).snapshot.elapsedMs,paused); await saveCheck('pause');
   await page.selectOption('#loadout','quiet'); await page.locator('#start').click(); await page.waitForTimeout(300); await saveCheck('configuration restart');
   await page.locator('#abort').click(); await page.locator('#start').click(); await page.waitForTimeout(300); await saveCheck('abort restart');
   await page.reload(); await page.waitForFunction(()=>window.__buildLab?.getState().snapshot); await saveCheck('reload');
   await page.locator('#game-container canvas').click(); await extract();
   const pendingDownload=page.waitForEvent('download'); await page.locator('#download').click();
   const downloaded=await pendingDownload; await downloaded.saveAs(path.join(dir,'downloaded-records.json'));
   const exported=JSON.parse(await readFile(path.join(dir,'downloaded-records.json'),'utf8'));
   assert.equal(exported.lab,'iteration-21'); assert.equal(exported.supplyValidation,false); assert.equal(exported.records.at(-1).outcome,'extract');
   evidence.checks.push('actual JSON download contains real settlement and declares training only');
   await press('r'); await page.waitForTimeout(150); assert.equal((await snapshot()).running,false); await saveCheck('R return');
 } else if(mode.startsWith('death')) {
   await move('y',144); await move('x',792); await move('y',400); await capture('02-exposed');
   const deadline=Date.now()+90000;
   while(Date.now()<deadline && !(await snapshot()).snapshot.ended) { await page.waitForTimeout(1000); }
   await page.waitForTimeout(1000); await capture('03-death'); const s=await snapshot(); assert.equal(s.inventory.run.status,'settled'); assert.equal(s.inventory.run.outcome,'death'); await saveCheck('actual death');
 } else if(scene==='watched') {
   if(mode.includes('wall')) {
     await move('y',280); await move('x',486); await capture('02-before-wall'); await press('f'); await capture('03-after-wall');
     if(build==='quiet') { assert((await snapshot()).snapshot.player.x>544); await move('x',670); await move('y',mode.includes('direct')?320:144);
       if(mode.includes('lure')) { await press('q'); await capture('03b-actual-lure'); }
     }
     else { await move('y',144); await move('x',670); }
     await move('x',944); await move('y',400);
   } else { await move('y',144); await move('x',944); await move('y',400); }
   await capture('04-at-prize'); await press('e',mode.includes('lure')?3000:1500); await capture('05-after-search');
   await move('y',144); await move('x',176); await extract();
 } else if(scene==='contested') {
   await move('y',144); await move('x',816); await move('y',432); await capture('02-contested');
   if(build==='melee') { await press('q'); await press('f');
     if(mode.includes('facing')) await press('a',350);
     for(let i=0;i<7;i++){ await press('Space'); await page.waitForTimeout(650); }
   }
   if(mode.includes('facing')) await move('x',816);
   await press('e',mode.includes('facing')?3000:1500); await capture('03-after-search'); await move('y',144); await move('x',176); await extract();
 } else {
   if(mode.includes('bypass')) { await move('y',656); await move('x',860); await move('y',400); }
   else { await move('x',mode.includes('near')||mode.includes('phase')?500:470); await capture('02-at-hazard');
     if(mode.includes('phase')) { await waitPhase('gather'); await capture('02b-observed-gather');
       if(build==='bare') { await waitPhase('release'); await waitPhase('disperse'); await capture('03-waited-for-safe-window'); }
     }
     if(build==='cycle-delay'||build==='cycle-suppress') { await press('q'); await capture('03-after-q');
       const current=(await snapshot()).snapshot;
       assert(current.hosts.some(h=>build==='cycle-delay'?h.delayRemainingMs>0:h.suppressionRemainingMs>0),'Actual Q must affect a real Host');
     }
     if(mode.includes('wait')) await page.waitForTimeout(1500);
     await move('x',760); await capture('04-crossed-hazard');
   }
   if(mode.includes('mist')||mode.includes('dust')) { await move('x',176); await extract(); }
   else { await move('x',944); await press('e',1500); await capture('05-after-search'); await move('y',144); await move('x',864); await move('y',656); await move('x',176); await extract(); }
 }
 if(!mode.startsWith('isolation')) await capture('90-final'); await saveCheck('final');
 if(!mode.startsWith('isolation') && !mode.startsWith('death') && !mode.includes('mist') && !mode.includes('dust')) {
   assert((await snapshot()).inventory.run.returnedIds.length>=1,'The actual searched item must be carried home; an empty retreat is not a loot completion');
 }
 evidence.passed=true;
} catch(error) { evidence.passed=false; evidence.failure=String(error.stack??error); console.error(evidence.failure); }
finally {
 await release().catch(()=>{});
 evidence.records=await page.evaluate(()=>window.__buildLab?.getRecords()).catch(()=>null);
 await page.screenshot({path:path.join(dir,'99-final.png')}).catch(()=>{});
 await writeFile(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));
 const video=page.video(); await context.close(); if(video) await rename(await video.path(),path.join(dir,'continuous.webm')); await browser.close();
 console.log(JSON.stringify({case:mode,passed:evidence.passed,failure:evidence.failure,checks:evidence.checks,summary:evidence.records?.map(r=>({outcome:r.outcome,metrics:r.metrics,run:r.finalInventory.run}))}));
 if(!evidence.passed)process.exitCode=1;
}
