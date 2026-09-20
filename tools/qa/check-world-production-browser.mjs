/** One bounded real-input production journey. Fresh browser profile, no save
 * fixture, game setters, teleport, forced outcomes, seed overrides or clock edits.
 * Full-map/body reads guide BFS: diagnostic navigation, not novice-play evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/iteration-28/production-browser');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: out, size: { width: 1440, height: 960 } } });
assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
const page = await context.newPage();
const driver = createJourneyDriver(page, out), cycle = createCycleInputs(page, driver);
const report = { method: 'Fresh homepage/new game. Real keyboard travel, search, extraction and return. Full map/body reads only for diagnostic BFS; no state setters or seed override.', started: new Date().toISOString(), status: 'running', errors: [], checkpoints: [] };
page.on('pageerror', error => report.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
function persist() { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
async function snap(label) {
  const value = await driver.snap(label);
  const diagnostics = await page.evaluate(() => {
    const scene = window.__game?.scene.getScene('RiftScene');
    const bytes = localStorage.getItem('coh-save-v1');
    return { surface: scene?.worldSurface?.snapshot() ?? null, saveCharacters: bytes?.length ?? 0,
      physicsGridSize: scene?.formFloorGrid?.tileSize ?? null };
  });
  report.checkpoints.push({ label, ...value, diagnostics }); persist();
  console.log(label, JSON.stringify(value.state)); return value;
}

async function plan(targets) {
  const data = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene'), grid = scene.formFloorGrid, body = scene.player.getSprite().body;
    return { cols: grid.cols, rows: grid.rows, size: grid.tileSize,
      walk: Array.from({ length: grid.cols * grid.rows }, (_, i) => grid.isWalkable(i % grid.cols, Math.floor(i / grid.cols))),
      start: { ...scene.player.getPosition() }, halfX: body.width / 2 + 2, halfY: body.height / 2 + 2 };
  });
  const { cols, rows, size, walk, start, halfX, halfY } = data;
  const center = i => ({ x: (i % cols + .5) * size, y: (Math.floor(i / cols) + .5) * size });
  const floor = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && walk[y * cols + x];
  const clear = p => {
    for (let y = Math.floor((p.y - halfY) / size); y <= Math.floor((p.y + halfY - .01) / size); y++)
      for (let x = Math.floor((p.x - halfX) / size); x <= Math.floor((p.x + halfX - .01) / size); x++) if (!floor(x, y)) return false;
    return true;
  };
  const clearLine = (a, b) => {
    const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 2);
    for (let i = 0; i <= steps; i++) if (!floor(Math.floor((a.x + (b.x - a.x) * i / (steps || 1)) / size), Math.floor((a.y + (b.y - a.y) * i / (steps || 1)) / size))) return false;
    return true;
  };
  const safe = walk.map((value, i) => value && clear(center(i)));
  const begin = Math.floor(start.y / size) * cols + Math.floor(start.x / size);
  assert(safe[begin], 'current tile center must support the full body and margin');
  const queue = [begin], previous = new Map([[begin, -1]]);
  let end = null, chosen = null;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], p = center(current);
    chosen = targets.find(target => Math.hypot(target.pos.x - p.x, target.pos.y - p.y) <= 26 && clearLine(p, target.pos));
    if (chosen) { end = current; break; }
    const x = current % cols, y = Math.floor(current / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, i = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !safe[i] || previous.has(i)) continue;
      previous.set(i, current); queue.push(i);
    }
  }
  assert(end !== null, 'no path with full-body clearance to a usable interaction point');
  const raw = []; for (let i = end; i !== -1; i = previous.get(i)) raw.push(center(i)); raw.reverse();
  const points = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) if ((raw[i - 1].x === raw[i].x) !== (raw[i].x === raw[i + 1].x)) points.push(raw[i]);
  points.push(raw.at(-1));
  driver.log({ event: 'body-safe-route', halfX, halfY, size, target: chosen, points, disclosure: 'Read-only full-map routing; real input only.' });
  return { points, target: chosen };
}

async function go(targets) {
  const route = await plan(targets), started = Date.now();
  let last = null, stuck = 0;
  for (let index = 0; index < route.points.length; index++) {
    const point = route.points[index], previous = route.points[index - 1];
    const vertical = previous ? previous.x === point.x : null;
    for (let n = 0; n < 150; n++) {
      const state = await driver.state();
      assert(state.scene === 'rift' && state.active && !state.ended, `travel interrupted: ${JSON.stringify(state)}`);
      assert(Date.now() - started < 90000, 'route travel time budget');
      const dx = point.x - state.pos.x, dy = point.y - state.pos.y;
      if (Math.hypot(dx, dy) < 2.5) break;
      stuck = last && Math.hypot(last.x - state.pos.x, last.y - state.pos.y) < .25 ? stuck + 1 : 0;
      assert(stuck < 8, `physical obstacle at ${JSON.stringify(state.pos)}, target ${JSON.stringify(point)}`);
      last = state.pos;
      // Hits can displace the actor sideways off a safe corridor center. Restore
      // that cross-axis before moving toward a far waypoint, even when the main
      // distance dominates; otherwise a valid BFS route can still scrape walls.
      const horizontal = vertical === null ? Math.abs(dx) > Math.abs(dy)
        : vertical ? Math.abs(dx) > 1.6 : Math.abs(dy) <= 1.6;
      const delta = horizontal ? dx : dy;
      await driver.hold([horizontal ? delta > 0 ? 'd' : 'a' : delta > 0 ? 's' : 'w'], Math.max(17, Math.min(220, Math.abs(delta) / 80 * 1000)));
    }
  }
  return route.target;
}

try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3021/');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await snap('00-menu'); await driver.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1700); await snap('01-new-base');
  const departure = await cycle.depart('02-departure'); assert(departure.ok, JSON.stringify(departure));
  await snap('03-paused-entry'); await driver.ledger('entry');
  // Save/reload uses actual pause and menu continue. Read only the committed DTO.
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
  report.entryIdentity = before.riftCheckpoint?.identity ?? before.riftDeparture?.identity;
  await page.reload(); await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await driver.press('Enter'); await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'));
  await page.waitForTimeout(100); await driver.press('Escape'); await page.waitForTimeout(100);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
  const afterIdentity = restored.riftCheckpoint?.identity ?? restored.riftDeparture?.identity;
  assert.deepEqual(afterIdentity, report.entryIdentity, 'reload keeps the same generated world identity');
  assert.deepEqual(restored.riftCheckpoint?.state?.player?.position, before.riftCheckpoint?.state?.player?.position, 'stationary reload retains position');
  report.reload = { before: before.riftCheckpoint?.state?.player?.position, after: restored.riftCheckpoint?.state?.player?.position, sameIdentity: true };
  await snap('04-restored');
  if ((await driver.state()).paused) await driver.press('Escape');
  const state = await driver.state();
  const node = await go(state.nodes.filter(node => !node.collected && node.kind === 'kindling'));
  await driver.hold(['e'], 1450); await page.waitForTimeout(400);
  const searched = await snap('05-searched');
  assert(searched.state.nodes.find(entry => entry.id === node.id)?.collected, 'genuine E search completed');
  assert(!searched.state.ended, 'alive after search');
  await go([{ id: 'exit', pos: searched.state.exit.position }]);
  await driver.press('e'); await page.waitForTimeout(800);
  const exited = await snap('06-extracted');
  assert(exited.state.ended && exited.text.includes('撤离成功'), 'genuine extraction succeeded');
  await driver.press('r'); await page.locator('#impact-result-panel').waitFor({ timeout: 10000 });
  await page.locator('#impact-result-panel').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  const arrival = await snap('07-first-return');
  assert(arrival.text.includes('首次归来，本次免受冲击'), 'first return report present');
  const settled = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
  report.returnSettlement = { cycle: settled.cycle, reserve: settled.kindlingReserve, modules: settled.modules,
    outcome: settled.inventory.run.outcome, baseSettled: settled.inventory.run.baseSettled };
  assert.equal(settled.cycle, 1); assert(settled.modules.every(module => module.hp === 70));
  assert.equal(settled.inventory.run.outcome, 'extract'); assert.equal(settled.inventory.run.baseSettled, true);
  assert.equal(settled.kindlingReserve, searched.state.carried);
  await driver.ledger('first-return'); await driver.press('Escape'); await page.waitForTimeout(250);
  await snap('08-closed');
  assert(!await page.locator('#impact-result-panel').count());
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = String(error);
  await snap('failure').catch(() => {}); console.error(error); process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString(); persist();
  await context.close(); await browser.close();
}
