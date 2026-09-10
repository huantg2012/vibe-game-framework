/** Real-control QA: public lab setup, then keyboard-only motion and Q/F.
 * Scene reads are observations; no state assignment, skills, AI events or manual ticks.
 */
import assert from 'node:assert/strict';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const artifacts = process.env.ARTIFACT_DIR ?? '/tmp/i20-restraint-live';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 },
  recordVideo: { dir: artifacts, size: { width: 1080, height: 720 } } });
await context.addInitScript(() => localStorage.setItem('coh-save-v1', 'restraint-live-sentinel'));
const page = await context.newPage();
const errors = [], held = new Set(), evidence = { method: 'Public URL/UI setup; keyboard only afterwards; read-only scene observations; natural clock.', scenarios: {} };
page.on('pageerror', error => errors.push(error.message));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
async function release() { for (const key of held) await page.keyboard.up(key); held.clear(); }
async function key(name) { await page.keyboard.down(name); await page.waitForTimeout(100); await page.keyboard.up(name); }
async function observe() {
  return page.evaluate(() => {
    const s = window.__combatLab.game.scene.getScene('CombatLabScene');
    return { time: s.time.now, player: { ...s.player.getPosition() }, facing: s.player.getFacingAngle(),
      qUses: s.tools.getSlotUses(0), fUses: s.tools.getSlotUses(1),
      anchors: s.tools.compressAnchors.map(a => ({ position: { ...a.position }, radius: a.radius, remainingMs: a.remainingMs })),
      lines: s.tools.stitchBarriers.map(line => ({ a: { ...line.pointA }, b: { ...line.pointB }, remainingMs: line.remainingMs })),
      enemies: s.ai.getEnemies().map(enemy => {
        const id = enemy.getId(), control = s.ai.getEnemyControlState(id);
        const source = s.subjects.find(subject => subject.id === id)?.visual?.getFlashSource?.();
        return { id, position: { ...enemy.getPosition() }, velocity: { ...enemy.getActualVelocity() }, state: enemy.getState(),
          pose: s.tools.getEnemyRestraintPose(id), scaleY: source?.scaleY, scaleX: source?.scaleX,
          attack: s.combat.getEnemyAttackVisualState(id), movementMultiplier: control?.movementMultiplier ?? 1,
          attackSuppressed: control?.attackSuppressed ?? false, perceptionMultiplier: control?.perceptionMultiplier ?? 1 };
      }) };
  });
}
async function until(predicate, trace, label, timeoutMs = 9000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const sample = await observe(); trace.push(sample);
    if (predicate(sample)) return sample;
    await page.waitForTimeout(40);
  } while (Date.now() < deadline);
  throw new Error(`${label}: ${JSON.stringify(trace.at(-1))}`);
}
async function load(approach) {
  await release();
  await page.goto(`${base}/combat-lab.html?auto-reset=0&protected=1&tool-quality=ordinary&enemy=human_remnant_jia&count=3&coverage=rewrite&tool-q=compress&tool-f=stitch&exercise=duel`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  if (approach) await page.locator('#approach').click();
  await page.locator('#game-container canvas').click();
}
try {
  if (process.env.ONLY !== 'stitch') {
    await load(true);
    const trace = [await observe()]; evidence.scenarios.pressure = { trace };
    await page.screenshot({ path: path.join(artifacts, 'pressure-01-before.png') });
    await key('q');
    const pressed = await until(s => s.enemies.some(e => e.pose.pressure && e.scaleY < .97), trace, 'Q gives a real body response');
    assert.equal(pressed.qUses, trace[0].qUses - 1);
    const attack = await until(s => s.enemies.some(e => e.pose.pressure && ['strike', 'recover'].includes(e.attack.phase)), trace,
      'pressure permits a real completed enemy strike', 4500);
    const attacker = attack.enemies.find(e => e.pose.pressure && ['strike', 'recover'].includes(e.attack.phase));
    assert.equal(attacker.attackSuppressed, false); assert.equal(attacker.perceptionMultiplier, 1);
    assert.equal(attacker.movementMultiplier, .5); assert(attacker.scaleY < .97);
    await page.screenshot({ path: path.join(artifacts, 'pressure-02-actual-attack.png') });
    // Retreat through real physics; the anchor stays where Q was pressed.
    await page.keyboard.down('a'); held.add('a');
    // The central cover blocks x<330 at this y; stop on its reachable east side.
    await until(s => s.player.x < pressed.player.x - 105, trace, 'keyboard retreat', 2500);
    await release();
    const previouslyPressed = new Set(trace.flatMap(s => s.enemies.filter(e => e.pose.pressure).map(e => e.id)));
    const left = await until(s => s.anchors.some(a => a.remainingMs > 300) && s.enemies.some(e => previouslyPressed.has(e.id)
      && !e.pose.pressure && Math.hypot(e.position.x - s.anchors[0].position.x, e.position.y - s.anchors[0].position.y) > s.anchors[0].radius),
      trace, 'enemy follows the retreat out of a still-active anchor', 4500);
    const escaped = left.enemies.find(e => previouslyPressed.has(e.id) && !e.pose.pressure);
    assert.equal(escaped.movementMultiplier, 1);
    const recovered = await until(s => {
      const e = s.enemies.find(e => e.id === escaped.id);
      return !e.pose.pressure && Math.abs(e.scaleY - 1) < .01 && e.movementMultiplier === 1;
    }, trace, 'body scale recovers after leaving the field', 2000);
    await page.screenshot({ path: path.join(artifacts, 'pressure-03-followed-out.png') });
    evidence.scenarios.pressure = { trace, pressed, attack, left, recovered };
    console.log('PASS actual Q compresses real models; enemy completes attack; keyboard retreat draws it beyond live field and restores scale/speed');
  }
  if (process.env.ONLY !== 'pressure') {
    await load(true);
    const trace = [await observe()]; evidence.scenarios.stitch = { trace };
    // Turn away with a real retreat step, then put the line between the pursuit
    // and the east face of the cover. Initial proximity gives real visual contact.
    await page.keyboard.down('a'); held.add('a');
    await until(s => Math.abs(Math.abs(s.facing) - Math.PI) < .03, trace, 'complete the real left turn', 1500);
    await release();
    await key('f');
    const placed = await observe(); trace.push(placed);
    assert.equal(placed.fUses, trace[0].fUses - 1); assert.equal(placed.lines.length, 1);
    assert(placed.enemies.every(e => !e.pose.snared), 'casting alone must not snare enemies');
    await page.screenshot({ path: path.join(artifacts, 'stitch-01-placed-before-crossing.png') });
    await page.keyboard.down('a'); held.add('a');
    await until(s => s.player.x < 335, trace, 'retreat behind the placed line', 2500);
    await release();
    const crossed = await until(s => s.enemies.some(e => e.pose.snared), trace, 'natural pursuit crosses the actual line', 10000);
    const caught = crossed.enemies.find(e => e.pose.snared);
    const line = placed.lines[0];
    const side = p => (line.b.x - line.a.x) * (p.y - line.a.y) - (line.b.y - line.a.y) * (p.x - line.a.x);
    const initial = placed.enemies.find(e => e.id === caught.id);
    assert(side(initial.position) * side(caught.position) <= 0, 'observed body position actually passes to the opposite side');
    assert.equal(caught.movementMultiplier, 0); assert.equal(caught.attackSuppressed, false); assert.equal(caught.perceptionMultiplier, 1);
    const response = await until(s => s.enemies.some(e => e.id === caught.id && e.pose.snared && e.scaleY < .98), trace, 'crossing causes body reaction', 700);
    await page.screenshot({ path: path.join(artifacts, 'stitch-02-natural-crossing.png') });
    // Enter melee range via keys while the enemy is stopped, without attacking it.
    await page.keyboard.down('d'); held.add('d');
    await until(s => Math.hypot(s.player.x - caught.position.x, s.player.y - caught.position.y) < 32, trace, 'approach the snared enemy', 1200);
    await release();
    const attackObservation = await observe(); trace.push(attackObservation);
    // Approaching spends part of the short 1.5s stop. Record actual attack phases
    // without claiming this route guarantees an in-range strike in that window.
    const whileCaught = attackObservation.enemies.find(e => e.id === caught.id);
    assert.equal(whileCaught.attackSuppressed, false); assert.equal(whileCaught.perceptionMultiplier, 1);
    const recovered = await until(s => {
      const e = s.enemies.find(e => e.id === caught.id);
      return !e.pose.snared && e.movementMultiplier === 1 && Math.abs(e.scaleY - 1) < .01;
    }, trace, 'snare and model feedback recover naturally', 2500);
    assert(recovered.lines.length > 0, 'line remains after its one-enemy stop expires');
    await page.screenshot({ path: path.join(artifacts, 'stitch-03-recovered.png') });
    const attackObservedWhileSnared = trace.some(s => s.enemies.some(e => e.id === caught.id && e.pose.snared && ['windup', 'strike', 'recover'].includes(e.attack.phase)));
    evidence.scenarios.stitch = { trace, placed, crossed, response, attackObservation, attackObservedWhileSnared, recovered };
    console.log(`PASS actual F does not snare before crossing; natural pursuit crosses, body reacts, feedback/speed recover; attackSuppressed=false, actual attack seen while snared=${attackObservedWhileSnared}`);
  }
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), 'restraint-live-sentinel');
  evidence.result = 'PASS';
} catch (error) {
  evidence.result = 'FAIL'; evidence.error = String(error);
  await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  evidence.pageErrors = errors;
  await release();
  const video = page.video(); await context.close();
  if (video) await rename(await video.path(), path.join(artifacts, 'restraint-live.webm'));
  await writeFile(path.join(artifacts, 'observations.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
}
