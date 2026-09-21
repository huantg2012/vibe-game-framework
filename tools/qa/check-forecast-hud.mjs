/** Real production HUD in an isolated browser document; no game/user save.
 * Verifies the disclosure boundary at the DOM that previously leaked intensity.
 * The full game's walking/entry scene remains a separate integration check.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.GAME_URL ?? 'http://127.0.0.1:3025';
const output = process.argv[2] ?? 'docs/qa/artifacts/iteration-29-r3/forecast-hud.json';
fs.mkdirSync(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  // Loading all modules into this deliberately empty document avoids mixing
  // dynamically imported singletons with a running game's bundled instances.
  await page.route(origin + '/forecast-hud-contract', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head><title>Forecast HUD contract</title></head><body></body></html>',
  }));
  await page.goto(origin + '/forecast-hud-contract');
  const result = await page.evaluate(async () => {
    const [{ PurificationHud }, { gameState }, { growthSystem }, { impactSystem, SEVERITY_LABEL },
      { tideSystem }, { contaminantSystem }, { stabilityTracker }, { saveManager }, { purchaseGrowth }] = await Promise.all([
      import('/src/ui/dom/purification-hud.ts'), import('/src/managers/game-state.ts'),
      import('/src/systems/growth-system.ts'), import('/src/systems/impact-system.ts'),
      import('/src/systems/tide-system.ts'), import('/src/systems/contaminant-system.ts'),
      import('/src/systems/stability-tracker.ts'), import('/src/managers/save-manager.ts'),
      import('/src/managers/growth-purchases.ts'),
    ]);
    const checks = [];
    const readings = [];
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const same = (left, right, message) => assert(JSON.stringify(left) === JSON.stringify(right), message);
    const records = new Map();
    saveManager.setStorage({ getItem: key => records.get(key) ?? null,
      setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) });
    gameState.reset(); growthSystem.reset(); contaminantSystem.reset(); tideSystem.reset(); stabilityTracker.reset();
    impactSystem.resetForecastState(); gameState.incrementCycle(); gameState.incrementCycle();
    gameState.addKindling(10000);
    growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: true, toolRevealed: true, leftFiniteCrest: true });
    const hud = new PurificationHud();
    hud.create();
    const frozen = { version: 2, targetId: 'CORE', actualPrimaryId: 'PURIFIER', committed: false,
      consumed: false, display: { targetId: 'CORE', severity: 'moderate' }, lookahead: null,
      queuedTargets: [], nextIntensity: 2.2, nextNextIntensity: 2.4 };
    impactSystem.loadForecastState(frozen);
    const initial = impactSystem.getForecastState();
    const sample = (label) => {
      const level = growthSystem.getLevel('growth_forecast_clarity');
      const publicReading = impactSystem.getForecastReading(level);
      hud.refresh(); hud.updatePrompt({ type: 'rift', distance: 0 });
      const prompt = document.getElementById('purif-prompt').textContent;
      const marginal = document.getElementById('purif-hud').textContent;
      assert(!/x\s*\d/.test(prompt), label + ': no raw intensity multiplier');
      assert(prompt.includes('第 3 次'), label + ': departure sequence remains');
      if (publicReading) {
        const value = SEVERITY_LABEL[publicReading.severity] + (publicReading.severityCertain ? '' : '？');
        assert(prompt.endsWith('强度' + value), label + ': entrance follows public certainty and grade');
        assert(marginal.includes(value), label + ': top HUD and entrance agree');
      } else {
        assert(!prompt.includes('强度'), label + ': absent forecast must not derive a tide reading');
      }
      const spans = [...document.querySelectorAll('#purif-prompt span')];
      assert(spans.every(span => span.style.fontSize === '11px'), label + ': locked text size');
      assert(document.querySelector('#dom-ui-root #purif-prompt'), label + ': shared overlay root');
      readings.push({ label, level, publicReading, prompt, marginal });
      return publicReading;
    };
    const zero = sample('L0');
    assert(!zero.severityCertain && zero.severity === 'moderate', 'L0 keeps the intentionally inaccurate coarse clue');
    for (let level = 1; level <= 3; level++) {
      while (growthSystem.getNextStep()?.id !== 'growth_forecast_clarity') {
        const next = growthSystem.getNextStep();
        assert(next && purchaseGrowth(next.id).ok, 'route prerequisite purchase succeeds');
      }
      assert(purchaseGrowth('growth_forecast_clarity').ok, 'actual forecast purchase succeeds');
      assert(growthSystem.getLevel('growth_forecast_clarity') === level, 'one forecast level purchased');
      const reading = sample('L' + level);
      assert(reading.severityCertain && reading.severity === 'heavy', 'L1+ displays actual grade');
      same(impactSystem.getForecastState(), initial, 'purchase and presentation must not redraw frozen forecast');
    }
    checks.push('L0/L1/L2/L3: actual purchases change public certainty; no raw multiplier or pressure at entrance');
    checks.push('All purchased levels preserve frozen facts; top HUD and nearby entrance agree');

    for (const committed of [false, true]) {
      impactSystem.loadForecastState({ version: 1, targetId: 'CORE', committed, consumed: false,
        display: { targetId: 'CORE', severity: committed ? 'heavy' : 'moderate' },
        lookahead: null, queuedTargets: [], nextIntensity: 2.2, nextNextIntensity: 2.4 });
      const before = impactSystem.getForecastState();
      for (let level = 0; level <= 3; level++) {
        const state = growthSystem.getState(); state.upgrades.growth_forecast_clarity = level;
        growthSystem.loadState(state);
        const reading = sample(`legacy-${committed ? 'committed' : 'uncommitted'}-L${level}`);
        assert(reading.severityCertain === committed, 'legacy promises keep their original certainty');
      }
      same(impactSystem.getForecastState(), before, 'legacy presentation is read-only');
    }
    checks.push('Legacy uncommitted and earned promises remain honest at all four levels');
    impactSystem.resetForecastState(); sample('no forecast');
    checks.push('No forecast: entrance keeps sequence only, without consulting real tide intensity');
    hud.destroy();
    assert(!document.getElementById('purif-hud') && !document.getElementById('purif-prompt'), 'HUD cleanup');
    return { checks, readings };
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(output, JSON.stringify({ verifiedAt: new Date().toISOString(), result: 'PASS',
    method: 'Production HUD and domain systems in real Chromium DOM; all state isolated in memory; normal purchase transactions, controlled prerequisites.',
    ...result, errors, limitations: ['Does not cover scene movement or artistic acceptance; full-scene runtime is separate.'] }, null, 2) + '\n');
  console.log(`${result.readings.length} disclosure states passed; ${output}`);
} finally {
  await browser.close();
}
