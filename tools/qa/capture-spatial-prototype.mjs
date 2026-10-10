import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/cinder-spatial-prototype-2026-10-10');
const seed = Number(process.env.QA_SEED ?? 20261010);
assert(Number.isSafeInteger(seed) && seed >= 0, 'QA_SEED must be a nonnegative integer');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1180 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3027'}/rift-spatial-prototype.html?seed=${seed}`);
  await page.waitForFunction(() => window.__spatialPrototype?.getState().ready || !document.getElementById('error')?.hidden, null, { timeout: 180000 });
  const state = await page.evaluate(() => window.__spatialPrototype?.getState());
  assert(state?.ready, await page.locator('#error').textContent());
  assert.equal(state.seed, seed);
  for (const mode of ['clean', 'routes', 'collision']) {
    await page.locator(`#${mode}`).click();
    assert.equal(await page.evaluate(() => window.__spatialPrototype.getState().mode), mode);
    const data = await page.evaluate(() => {
      const base = document.getElementById('map');
      const annotation = document.getElementById('annotation');
      const copy = document.createElement('canvas'); copy.width = base.width; copy.height = base.height;
      const context = copy.getContext('2d'); context.drawImage(base, 0, 0); context.drawImage(annotation, 0, 0);
      return copy.toDataURL('image/png').split(',')[1];
    });
    await fs.writeFile(path.join(out, `${mode}.png`), Buffer.from(data, 'base64'));
  }
  await page.locator('#clean').click();
  await page.screenshot({ path: path.join(out, 'preview.png'), fullPage: true });
  await page.locator('#native').click();
  assert(await page.locator('body').evaluate(node => node.classList.contains('native')));
  await page.locator('#fit').click();
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile(path.join(out, 'capture.json'), JSON.stringify({ scope: 'DEV spatial prototype; actual native surface renderer without observation fog. Markers and routes are review overlays. No full encounter/economy simulation or production rollout.', state, browserErrors: errors, verifiedControls: ['clean', 'routes', 'collision', 'native', 'fit'] }, null, 2) + '\n');
  console.log(JSON.stringify({ ready: state.ready, metrics: state.metrics, anchors: state.anchors, errors }, null, 2));
} finally { await browser.close(); }
