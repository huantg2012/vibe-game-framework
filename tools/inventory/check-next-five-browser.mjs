/** Production lab adapters, real physics/Host/Combat/Chaos; isolated formal save. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
async function load(query) {
 await page.goto(`${base}/combat-lab.html?auto-reset=0&${query}`);
 await page.waitForFunction(() => window.__combatLab?.getState().ready);
 await page.evaluate(() => { window.s = window.__combatLab.game.scene.getScene('CombatLabScene'); s.scene.pause(); window.controlSnapshot = enemy => { const c=s.ai.getEnemyControlState(enemy.getId()); return {movementMultiplier:c.movementMultiplier,perceptionMultiplier:c.perceptionMultiplier,attackSuppressed:c.attackSuppressed}; }; });
}
try {
 await page.addInitScript(() => localStorage.setItem('coh-save-v1', 'c-five-sentinel'));
 await load('tool-passive=siphon&exercise=empty');
 const resistance = await page.evaluate(() => {
   const baseline = s.getReviewState().resistancePercent, before = s.combat.getHealth();
   const usesBefore = s.getReviewState().tools.find(t => t.id === 'siphon').remaining;
   const accepted = s.combat.applyHazardHit('test-core', 5);
   const healthAfter = s.combat.getHealth(), during = s.getReviewState().resistancePercent;
   const used = s.getReviewState().tools.find(t => t.id === 'siphon').remaining;
   const chaosBefore = s.chaos.getValue(); s.chaos.addImmediate(10); const chaos = s.chaos.getValue() - chaosBefore;
   s.tools.update(8000); const after = s.getReviewState().resistancePercent;
   return { baseline, before, accepted, healthAfter, during, usesBefore, used, chaos, after };
 });
 assert(resistance.accepted); assert.equal(resistance.before - resistance.healthAfter, 5);
 assert.equal(resistance.during - resistance.baseline, 20); assert.equal(resistance.usesBefore - resistance.used, 1);
 assert.equal(resistance.after, resistance.baseline); assert(Math.abs(resistance.chaos - 10 * (1 - resistance.during / 100)) < 1e-6, JSON.stringify(resistance));
 console.log('PASS real accepted hit activates additive resistance, no heal/retroactive damage; Chaos and review read it');
 await load('tool-q=stitch&exercise=duel');
 const seam = await page.evaluate(() => {
   const enemy = s.ai.getEnemies()[0]; const origin = s.player.getPosition();
   const before = s.getReviewState().tools.find(t => t.id === 'stitch').remaining;
   const success = s.tools.useSlot(0); const barrier = s.tools.stitchBarriers[0];
   if (!barrier) return { success };
   const a = barrier.pointA, b = barrier.pointB, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
   const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx,dy);
   const nx = -dy / length, ny = dx / length;
   const sprite = enemy.getSprite();
   sprite.body.reset(mx - nx * 20, my - ny * 20); enemy.syncPositionFromBody(); s.tools.update(1);
   sprite.body.reset(mx + nx * 20, my + ny * 20); enemy.syncPositionFromBody(); s.tools.update(1);
   const held = controlSnapshot(enemy);
   s.tools.update(1500); const released = controlSnapshot(enemy);
   return { success, length, centreDistance:Math.hypot(mx-origin.x,my-origin.y), held, released,
     spent: before - s.getReviewState().tools.find(t => t.id === 'stitch').remaining };
 });
 assert(seam.success); assert.equal(seam.length,64); assert.equal(seam.centreDistance,32); assert.equal(seam.spent,1);
 assert.equal(seam.held.movementMultiplier,0); assert.equal(seam.held.perceptionMultiplier,1); assert.equal(seam.held.attackSuppressed,false);
 assert.equal(seam.released.movementMultiplier,1);
 console.log('PASS real one-key seam detects swept physics crossing; only movement is stopped and restored');
 await load('tool-q=compress&exercise=duel');
 const compression = await page.evaluate(() => {
   const enemy = s.ai.getEnemies()[0], origin=s.player.getPosition(); enemy.getSprite().body.reset(origin.x+20,origin.y); enemy.syncPositionFromBody();
   const success=s.tools.useSlot(0); s.tools.update(16); const during=controlSnapshot(enemy);
   enemy.getSprite().body.reset(origin.x+90,origin.y); enemy.syncPositionFromBody();s.tools.update(16);const after=controlSnapshot(enemy);
   return {success,during,after};
 });
 assert(compression.success); assert.equal(compression.during.movementMultiplier,.5); assert.equal(compression.during.perceptionMultiplier,1);
 assert.equal(compression.during.attackSuppressed,false); assert.equal(compression.after.movementMultiplier,1);
 console.log('PASS real radius slowdown retains senses/attacks and releases outside');
 await load('tool-q=abyss&exercise=duel');
 const reveal=await page.evaluate(()=>{
   const enemy=s.ai.getEnemies()[0],origin=s.player.getPosition();enemy.getSprite().body.reset(origin.x+60,origin.y); enemy.syncPositionFromBody();
   const success=s.tools.useSlot(0),hasMarks=!!s.revealMarks;
   enemy.getSprite().body.reset(origin.x+100,origin.y); enemy.syncPositionFromBody(); const duplicate=s.tools.useSlot(0);
   s.tools.destroy();return{success,hasMarks,duplicate,cleared:s.revealMarks===null};
 });
 assert(reveal.success&&reveal.hasMarks&&reveal.cleared);assert.equal(reveal.duplicate,false);
 console.log('PASS nearby snapshot includes real bodies, persists independently and cleans up');
 await load('tool-q=delay&exercise=duel');
 await page.evaluate(()=>s.scene.resume());
 const gas=await page.locator('#enemy option').evaluateAll(options=>options.find(o=>/气团/.test(o.textContent))?.value);
 assert(gas);await page.locator('#enemy').selectOption(gas);await page.waitForTimeout(250);
 const delay=await page.evaluate(()=>{
   const s=window.__combatLab.game.scene.getScene('CombatLabScene');s.scene.pause();
   const h=s.hosts.getToolTargets()[0];s.player.getSprite().body.reset(h.position.x-48,h.position.y);s.player.postUpdate();
   for(let i=0;i<100&&s.hosts.getToolTargets()[0].hazardReleased;i++)s.hosts.update(100,s.player.getPosition(),false,s.player.getFacingAngle());
   const eligible=s.hosts.getToolTargets()[0],before=s.getReviewState().tools.find(t=>t.id==='delay').remaining;
   const success=s.tools.useSlot(0),paused=s.hosts.getToolTargets()[0];
   const repeated=s.tools.useSlot(0);for(let frame=0;frame<40;frame++)s.hosts.update(100,s.player.getPosition(),false,s.player.getFacingAngle());
   const late=s.hosts.getToolTargets()[0];s.tools.destroy();const clean=s.hosts.getToolTargets()[0];
   return{eligible,success,paused,repeated,late,clean,spent:before-s.getReviewState().tools.find(t=>t.id==='delay').remaining};
 });
 assert(delay.eligible.canDelayNextHazard&&!delay.eligible.hazardReleased);assert(delay.success);assert.equal(delay.paused.delayRemainingMs,5000);
 assert.equal(delay.repeated,false);assert.equal(delay.spent,1);assert.equal(delay.late.delayRemainingMs,1000);assert.equal(delay.late.hazardReleased,false);
 assert.equal(delay.clean.delayRemainingMs,0);console.log('PASS actual Host release clock held for delay, repeated use free, early cleanup scoped');
 assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),'c-five-sentinel');assert.deepEqual(errors,[]);
}finally{await browser.close();}
