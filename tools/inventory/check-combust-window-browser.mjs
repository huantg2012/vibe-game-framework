/** Combat-lab integration: UI fixture setup, natural Host clock, actual Q/F input.
 * Reads scene state but never calls skill/update methods or assigns a phase.
 * This verifies input and lifecycle; screenshots are evidence, not an aesthetic PASS.
 */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
const key = async name => { await page.keyboard.down(name); await page.waitForTimeout(100); await page.keyboard.up(name); };
const read = () => page.evaluate(() => {
  const scene = window.__combatLab.game.scene.getScene('CombatLabScene');
  const target = scene.hosts.getToolTargets()[0];
  return { target, phase: target ? scene.hosts.getVolumePresenceFrame(target.id)?.phase : null,
    tools: window.__combatLab.getState().tools, effects: scene.tools.combustFields.length,
    visualControl: target ? scene.hosts.getToolVisualControl(target.id) : null };
});
const remaining = snapshot => snapshot.tools.find(tool => tool.id === 'combust')?.remaining ?? 0;
async function load(label, extra = '') {
  await page.goto(`${base}/combat-lab.html?auto-reset=0&protected=1&tool-q=combust&tool-quality=ordinary&coverage=infiltrate&exercise=${label ? 'duel' : 'empty'}&${extra}`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  if (label) {
    const value = await page.locator('#enemy option').evaluateAll((options, text) => options.find(option => option.textContent.includes(text))?.value, label);
    assert(value, `${label}: production catalog entry`);
    await page.locator('#enemy').selectOption(value);
    await page.waitForFunction(() => window.__combatLab?.getState().ready);
    // The public lab button positions the fixture; subsequent phases use real time.
    await page.locator('#approach').click();
  } else if (await page.locator('#pause-veil').isVisible()) await page.locator('#resume').click();
  await page.locator('#game-container canvas').click();
}
async function waitPhase(phase) {
  await page.waitForFunction(expected => {
    const scene = window.__combatLab.game.scene.getScene('CombatLabScene');
    const target = scene.hosts.getToolTargets()[0];
    const frame = target && scene.hosts.getVolumePresenceFrame(target.id);
    return frame?.phase === expected && frame.progress < .65;
  }, phase, { timeout: 18000 });
}
try {
  await page.addInitScript(() => localStorage.setItem('coh-save-v1', 'combust-window-sentinel'));
  for (const [label, phase] of [['气团', 'rest'], ['雾团', 'gather'], ['尘絮群', 'disperse'], ['油膜', null]]) {
    await load(label);
    if (phase) await waitPhase(phase);
    const before = await read();
    assert(before.target.canSuppressHazard, `${label}/${phase}: selectable`);
    if (phase) assert.equal(before.target.hazardReleased, false, 'regression explicitly uses a non-release window');
    await key('q');
    const after = await read();
    assert(after.target.suppressionRemainingMs > 4500, `${label}: real Q starts suppression`);
    assert.equal(remaining(after), remaining(before) - 1, `${label}: exactly one use`);
    assert.equal(after.visualControl, 'suppressed');
    assert.equal(after.effects, 1);
    await key('q');
    assert.equal(remaining(await read()), remaining(after), `${label}: repeated Q is free`);
    await page.waitForFunction(() => {
      const scene = window.__combatLab.game.scene.getScene('CombatLabScene');
      const target = scene.hosts.getToolTargets()[0];
      return target?.suppressionRemainingMs === 0 && target.recoveryPending;
    }, null, { timeout: 7000 });
    const recovering = await read();
    assert.equal(recovering.target.canSuppressHazard, false);
    await key('q');
    assert.equal(remaining(await read()), remaining(after), `${label}: recovery wait is also free`);
    console.log(`PASS ${label}/${phase ?? 'persistent'}: actual Q outside release, one use, target control, repeated/recovery Q free`);
  }
  await load('气团', 'tool-f=delay');
  await waitPhase('rest');
  const delayedBefore = await read();
  await key('f');
  assert((await read()).target.delayRemainingMs > 4500);
  await key('q');
  const rejected = await read();
  assert.equal(remaining(rejected), remaining(delayedBefore));
  assert.equal(rejected.target.suppressionRemainingMs, 0);
  assert.equal(rejected.effects, 0);
  await page.waitForFunction(() => window.__combatLab.game.scene.getScene('CombatLabScene').hosts.getToolTargets()[0]?.delayRemainingMs === 0,
    null, { timeout: 7000 });
  await key('q');
  assert.equal(remaining(await read()), remaining(delayedBefore) - 1, 'Q works after delay actually ends');
  console.log('PASS actual F delay prevents a wasted simultaneous Q; Q works after natural expiry');
  await load(null);
  const emptyBefore = await read(); await key('q');
  const emptyAfter = await read();
  assert.equal(remaining(emptyAfter), remaining(emptyBefore)); assert.equal(emptyAfter.effects, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), 'combust-window-sentinel');
  assert.deepEqual(errors, []);
  console.log('PASS no-target Q free; formal save sentinel unchanged; no page errors');
} finally { await browser.close(); }
