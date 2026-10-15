/** Local Chrome visual/control smoke test; no saves or production game state. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.COH_PLAYWRIGHT_MODULE ?? join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const out = 'docs/qa/artifacts/enemy-world-pilot-2026-10-15';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.COH_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1220, height: 1120 } });
const errors = [], samples = [];
page.on('pageerror', error => errors.push(String(error)));
const state = () => page.evaluate(() => window.__enemyWorldPilot.getState());
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const seek = async time => { await page.evaluate(ms => window.__enemyWorldPilot.seek(ms), time); await settle(); };
const digest = async (x, y, width, height) => createHash('sha256').update(await page.evaluate(rect => Array.from(window.__enemyWorldPilot.canvas.getContext('2d').getImageData(...rect).data), [x,y,width,height]).then(bytes => Buffer.from(bytes))).digest('hex');
try {
  await page.goto(`${process.env.COH_PILOT_URL ?? 'http://127.0.0.1:3027/enemy-world-pilot.html'}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__enemyWorldPilot?.getState().ready, { timeout: 30000 });
  for (const world of ['crystal-fibre', 'ruptured-film']) {
    await page.evaluate(id => window.__enemyWorldPilot.selectWorld(id), world);
    assert((await state()).ready);
    for (const seed of [1, 2718, 4294967295]) for (const coverage of ['infiltrate', 'rewrite', 'overwrite']) {
      await page.locator('#seed').fill(String(seed)); await page.locator('#regenerate').click();
      await page.locator('#coverage').selectOption(coverage); await seek(800);
      const current = await state(); assert(current.ready); assert.deepEqual(current.errors, []);
      samples.push({ world, seed, coverage, anchor: current.anchor, bakeMs: current.organismBakeMs });
    }
    await page.locator('#seed').fill('2718'); await page.locator('#regenerate').click();
    await page.locator('#coverage').selectOption('rewrite'); await page.locator('#action').selectOption('idle');
    await seek(100); const h0 = await digest(144, 248, 192, 192), p0 = await digest(540, 214, 300, 320);
    await seek(1100); const h1 = await digest(144, 248, 192, 192), p1 = await digest(540, 214, 300, 320);
    assert.notEqual(h0, h1, 'human idle must animate'); assert.notEqual(p0, p1, 'paint must animate');
    await page.locator('#action').selectOption('walk'); await seek(959); const before = (await state()).pose.phaseMs;
    await seek(961); assert.equal((await state()).pose.phaseMs - before, 2, 'walk path cannot reset each gait');
    await page.locator('#action').selectOption('auto'); await seek(800);
    await page.screenshot({ path: `${out}/${world}-close.png`, fullPage: true });
    const adapted = await digest(144, 248, 192, 192);
    await page.locator('#adapted').uncheck(); await settle(); assert.notEqual(await digest(144, 248, 192, 192), adapted);
    await page.locator('#adapted').check();
    await page.locator('#zoom').selectOption('1.5'); await seek(800);
    await page.screenshot({ path: `${out}/${world}-normal.png`, fullPage: true });
    await page.locator('#zoom').selectOption('3'); await page.locator('#pause').click();
    const start = (await state()).elapsedMs; await page.waitForTimeout(8000);
    const end = await state(); assert(end.elapsedMs > start + 1000); assert(end.ready); assert(end.cachedHumanFrames <= 192);
    samples.push({ world, continuousAnimation: true, humanMotion: h0 !== h1, paintMotion: p0 !== p1, state: end });
  }
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), browser: await browser.version(), errors, samples, scope: '2 native-map visual pilots; 18 seed/coverage placements; controlled animation and controls, not AI/combat/FOV acceptance' };
  await writeFile(`${out}/browser-check.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, seedCoveragePlacements: 18, continuousWorlds: 2, errors, output: out }));
} finally { await browser.close(); }
