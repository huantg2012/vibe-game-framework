/** Actual native frames, not a second renderer. Isolated DEV memory session. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/rift-r100-i02-corrections');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { date: new Date().toISOString(), scope: '18 native DEV fixtures; normal visibility, native 960x640 screenshots, actual keyboard-path patrol. No save access, full-run or art approval claim.', sources: {}, cases: [], errors: [] };
for (const file of ['src/dev/rift-r100-masters/world.ts', 'src/dev/rift-r100-masters/presentation.ts', 'src/dev/rift-r100-masters/surface-renderer.ts', 'src/dev/rift-r100-masters/surface-fields.ts', 'src/scenes/rift-scene.ts', 'src/systems/chaos-system.ts', 'data/rift-pollution-grades.csv']) report.sources[file] = createHash('sha256').update(await readFile(file)).digest('hex');
const context = await browser.newContext({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(String(error)));
const diag = () => page.evaluate(() => JSON.parse(document.querySelector('#diagnostics').textContent));
try {
  for (const seed of [20261002, 20261003]) for (const family of ['folded-slab', 'fibre-knot', 'broken-shell']) for (const grade of ['low', 'medium', 'severe']) {
    const id = `${family}-${grade}-${seed}`;
    await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3027'}/rift-r100-masters.html?family=${family}&grade=${grade}&seed=${seed}`);
    await page.waitForFunction(() => { try { const d = JSON.parse(document.querySelector('#diagnostics').textContent); return d.runtime.running && !d.runtime.starting; } catch { return false; } }, null, { timeout: 60000 });
    await page.locator('#pixel').click();
    await page.waitForTimeout(500);
    const before = await diag();
    assert.equal(before.runtime.probe.pollutionGrade, grade);
    const hostIds = before.runtime.probe.hosts.map(host => host.id);
    assert.equal(new Set(hostIds).size, hostIds.length, `${id}: distinct native host identities`);
    const counts = { paint: hostIds.filter(id => id.startsWith('ENM_BING_')).length, volume: hostIds.filter(id => id.startsWith('ENM_DING_')).length };
    assert.deepEqual(counts, grade === 'low' ? { paint: 2, volume: 1 } : grade === 'medium' ? { paint: 4, volume: 2 } : { paint: 6, volume: 3 });
    await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${id}-entry.png`) });
    await page.locator('#patrol').click();
    await page.waitForTimeout(6500);
    const after = await diag();
    assert(!after.runtime.paused, `${id}: scene remains running`);
    assert(after.patrol.actualDistance > 20, `${id}: actual player moves`);
    await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${id}-walk.png`) });
    await page.locator('#pause').click();
    await page.waitForTimeout(250);
    const paused = await diag();
    await page.waitForTimeout(400);
    const held = await diag();
    assert.equal(held.runtime.probe.chaos, paused.runtime.probe.chaos, 'pause freezes pollution accumulation');
    assert.equal(held.presentation.elapsedMs, paused.presentation.elapsedMs, 'pause freezes material motion');
    const row = { id, family, grade, seed, counts, before, after, paused: { chaos: held.runtime.probe.chaos, elapsedMs: held.presentation.elapsedMs }, screenshots: [`${id}-entry.png`, `${id}-walk.png`] };
    report.cases.push(row);
    await writeFile(path.join(out, `${id}.json`), JSON.stringify(row, null, 2));
    console.log(JSON.stringify({ id, counts, chaosRate: before.runtime.probe.chaosRate, distance: after.patrol.actualDistance }));
  }
  assert.equal(report.errors.length, 0); report.status = 'limited-native-runtime-pass';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally { await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
