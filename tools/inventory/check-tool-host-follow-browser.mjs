/** Live-frame Host attachment regression. The isolated lab runs the production update order. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
try {
  for (const type of ['delay', 'combust']) {
    await page.goto(`${base}/combat-lab.html?auto-reset=0&protected=1&tool-q=${type}&exercise=duel`);
    await page.waitForFunction(() => window.__combatLab?.getState().ready);
    const gas = await page.locator('#enemy option').evaluateAll(options => options.find(option => /气团/.test(option.textContent))?.value);
    assert(gas); await page.locator('#enemy').selectOption(gas); await page.waitForTimeout(250);
    if (await page.locator('#pause-veil').isVisible()) await page.locator('#resume').click();
    await page.locator('#approach').click();
    if (type === 'combust') await page.waitForFunction(() => window.__combatLab.game.scene.getScene('CombatLabScene').hosts.getToolTargets()[0]?.hazardReleased);
    const success = await page.evaluate(type => {
      const scene = window.__combatLab.game.scene.getScene('CombatLabScene');
      if (type === 'delay') for (let i = 0; i < 200 && scene.hosts.getToolTargets()[0].hazardReleased; i++) {
        scene.hosts.update(50, scene.player.getPosition(), false, scene.player.getFacingAngle());
      }
      return scene.tools.useSlot(0);
    }, type);
    assert(success, type);
    for (let frame = 0; frame < 3; frame++) {
      await page.waitForTimeout(700);
      const state = await page.evaluate(type => {
        const scene = window.__combatLab.game.scene.getScene('CombatLabScene');
        const host = scene.hosts.getToolTargets()[0];
        const effect = type === 'delay' ? scene.tools.delayDevices[0] : scene.tools.combustFields[0];
        return { error: effect ? Math.hypot(host.position.x - effect.position.x, host.position.y - effect.position.y) : null,
          control: scene.hosts.getToolVisualControl(host.id), released: host.hazardReleased };
      }, type);
      assert.equal(state.error, 0, `${type} follows this frame's moving core`);
      assert.equal(state.control, type === 'delay' ? 'held' : 'suppressed');
      if (type === 'delay') assert.equal(state.released, false);
    }
    console.log(`PASS ${type} actual scene frames keep Host and visible material trace coincident`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
