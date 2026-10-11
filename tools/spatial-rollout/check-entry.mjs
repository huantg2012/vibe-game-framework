/** Version-pinned entrance integration through the current two-stage preparation controls.
 * Isolated browser storage; no seed/world, player, outcome, save or clock overrides.
 * Opening preparation uses its normal scene method, not physical haven navigation.
 * This is entrance/cold-recovery evidence, not a natural expedition playtest. */
import assert from 'node:assert/strict';
const expectedRevision = Number(process.env.QA_ALGORITHM_REVISION ?? 7);
assert(Number.isSafeInteger(expectedRevision) && expectedRevision > 0, 'QA_ALGORITHM_REVISION must be a positive integer');
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/entry');
const grades = (process.env.QA_GRADES ?? 'low,medium,severe').split(',');
assert(grades.length && grades.every(grade => ['low', 'medium', 'severe'].includes(grade)));
const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:3027/';
const timeout = Number(process.env.QA_TIMEOUT_MS ?? 120000);
assert(Number.isFinite(timeout) && timeout > 0);
fs.mkdirSync(out, { recursive: true });
assert(!fs.existsSync(path.join(out,'report.json')),'Refusing to replace existing evidence');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = {
  startedAt: new Date().toISOString(), gameUrl, status: 'running', expectedRevision,
  scope: 'Formal homepage → new record → preparation scene entry → real grade choice → real equipment stage → Shift+Enter departure → Escape checkpoint → browser reload → real Continue. Isolated storage, naturally selected worlds; no seed/world/state/save/clock overrides. Preparation opening bypasses physical haven navigation. Not a natural expedition, economy, discovery-after-exploration, performance acceptance or complete visual review.',
  cases: [],
};
const writeReport = () => fs.writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function waitForMenu(page) {
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive(), null, { timeout });
}
async function waitForRift(page) {
  await page.waitForFunction(() => {
    const scene = window.__game?.scene.getScene('RiftScene');
    return scene?.scene.isActive() && scene.player && scene.nativeWorldPresentation && scene.devRuntime
      && !scene.stagedEntry?.isActive() && !scene.nativeEntryFence?.isActive();
  }, null, { timeout });
}
async function readRuntime(page) {
  return page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene');
    const world = scene.nativeWorldPresentation.world;
    const extraction = world.layout.extractionPoint.position;
    const minimap = scene.minimap.exportRuntimeState();
    return {
      grade: world.definition.grade, revision: world.algorithmRevision,
      width: world.raster.width, height: world.raster.height, bodyTileSize: scene.formFloorGrid.tileSize,
      spawn: world.layout.spawnPoint, player: { ...scene.player.getPosition() }, extraction,
      extractionVisible: scene.visibility.getVisibilityAt(extraction),
      extractionThroughFogGlow: scene.visibility.glowSources.has(world.layout.extractionPoint.id),
      canExtract: scene.extraction.canExtract(), extractionDiscovered: minimap.extractionDiscovered,
      extractionTileExplored: minimap.explored[minimap.extractionTile.y * minimap.mapWidth + minimap.extractionTile.x],
      minimapLabel: document.querySelector('#rift-minimap')?.getAttribute('aria-label'),
      enemies: scene.ai.getEnemies().length,
      nodes: scene.search.nodes.map(node => ({ kind: node.kind, tier: node.tier, value: node.value })),
      elapsedMs: scene.devElapsedMs,
    };
  });
}
async function pauseAndReadSave(page) {
  await page.keyboard.press('Escape', { delay: 100 });
  await page.locator('.pause-menu-panel').waitFor({ timeout });
  await page.waitForFunction(() => {
    const value = localStorage.getItem('coh-save-v1');
    return value && JSON.parse(value).riftCheckpoint?.state?.phase === 'active';
  }, null, { timeout });
  return page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
}

try {
  for (const grade of grades) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    const result = { grade, status: 'running', errors: [], failedRequests: [] };
    report.cases.push(result); writeReport();
    page.on('pageerror', error => result.errors.push(String(error)));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
    try {
      await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout });
      await waitForMenu(page);
      assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null, 'fresh browser context owns no prior record');
      await page.getByRole('button', { name: '开始', exact: true }).click();
      await page.waitForFunction(() => {
        const scene = window.__game?.scene.getScene('PurificationScene');
        return scene?.scene.isActive() && !scene.menuEntry && !scene.transitioning && !scene.shuttingDown;
      }, null, { timeout });
      await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
      const panel = page.locator('#inventory-panel[data-prepare-view="pollution"]');
      await panel.waitFor({ timeout });
      const choice = panel.locator(`[data-departure-grade="${grade}"]`);
      await choice.click();
      assert.equal(await choice.getAttribute('aria-pressed'), 'true');
      await page.screenshot({ path: path.join(out, `${grade}-pollution.png`) });
      await panel.locator('[data-prepare-action="next"]').click();
      const equipment = page.locator('#inventory-panel[data-prepare-view="equipment"]');
      await equipment.waitFor({ timeout });
      const depart = equipment.locator('[data-prepare-action="depart"]');
      assert.equal(await depart.isEnabled(), true, 'ordinary starter equipment may depart');
      result.preparation = { twoStages: true, gradePressed: grade, equipmentLabel: await depart.getAttribute('aria-label') };
      const history = await page.evaluate(async () => (await import('/src/systems/inventory-store.ts')).inventoryStore.getRiftWorldHistory());
      assert.deepEqual(history, { version: 1, visits: [] }, 'choosing pollution and entering equipment must not append a visit');
      await page.screenshot({ path: path.join(out, `${grade}-equipment.png`) });
      const departureStarted = Date.now();
      await page.keyboard.press('Shift+Enter', { delay: 100 });
      await waitForRift(page);
      result.departureMs = Date.now() - departureStarted;
      result.runtime = await readRuntime(page);
      assert.equal(result.runtime.grade, grade);
      assert.equal(result.runtime.revision, expectedRevision);
      assert.equal(result.runtime.width, 2304); assert.equal(result.runtime.height, 1792);
      assert.equal(result.runtime.bodyTileSize, 8);
      assert.deepEqual(result.runtime.player, result.runtime.spawn, 'no test movement or relocation occurred');
      assert.equal(result.runtime.extractionDiscovered, false, 'unknown extraction must stay absent from map memory at spawn');
      assert.equal(result.runtime.extractionTileExplored, 0);
      assert.equal(result.runtime.extractionVisible, 0, 'spawn vision must not reveal distant extraction');
      assert.equal(result.runtime.extractionThroughFogGlow, false, 'native extraction must not register a through-fog locator');
      assert.equal(result.runtime.canExtract, false);
      await page.screenshot({ path: path.join(out, `${grade}-entry.png`) });
      const before = await pauseAndReadSave(page);
      const identity = before.riftCheckpoint?.identity ?? before.riftDeparture?.identity;
      assert(identity?.generation?.spatialPolicy, 'the spatial policy is frozen inside the saved identity');
      assert.equal(identity.generation.version, 3);
      assert.equal(identity.generation.package.algorithmRevision, expectedRevision);
      assert.equal(identity.generation.package.grade, grade);
      assert.equal(before.riftCheckpoint.state.minimap.extractionDiscovered, false);
      assert.equal(before.riftCheckpoint.state.world.bodyGeometryVersion, 1);
      assert(before.riftCheckpoint.state.world.nativePresentation);
      const expectedHistory = { version: 1, visits: [{ worldId: identity.generation.package.id.slice('r100-'.length), grade }] };
      assert.deepEqual(before.inventory.riftWorldHistory, expectedHistory);
      fs.writeFileSync(path.join(out, `${grade}-saved-before.json`), `${JSON.stringify(before, null, 2)}\n`);
      result.world = expectedHistory.visits[0].worldId;
      result.identity = identity;
      result.identitySha256 = hash(identity);
      result.visits = expectedHistory;
      await page.reload({ waitUntil: 'domcontentloaded', timeout });
      await waitForMenu(page);
      const restoreStarted = Date.now();
      await page.getByRole('button', { name: '继续', exact: true }).click();
      await waitForRift(page);
      result.restoreMs = Date.now() - restoreStarted;
      result.restoredRuntime = await readRuntime(page);
      assert.equal(result.restoredRuntime.revision, expectedRevision);
      assert.equal(result.restoredRuntime.extractionDiscovered, false);
      assert.deepEqual(result.restoredRuntime.extraction, result.runtime.extraction);
      const after = await pauseAndReadSave(page);
      fs.writeFileSync(path.join(out, `${grade}-saved-after.json`), `${JSON.stringify(after, null, 2)}\n`);
      assert.deepEqual(after.riftCheckpoint.identity, identity, 'full frozen identity and content signature survive cold recovery');
      assert.deepEqual(after.riftCheckpoint.state.player.position, before.riftCheckpoint.state.player.position);
      assert.deepEqual(after.riftCheckpoint.state.player.bodyPosition, before.riftCheckpoint.state.player.bodyPosition);
      assert.deepEqual(after.inventory.riftWorldHistory, expectedHistory, 'cold recovery must not append a second visit');
      assert(after.riftCheckpoint.elapsedMs >= before.riftCheckpoint.elapsedMs);
      assert.deepEqual(result.errors, []);
      result.coldIdentityPreserved = true; result.coldBodyPositionPreserved = true; result.exactlyOneVisit = true;
      result.status = 'passed';
      await page.screenshot({ path: path.join(out, `${grade}-restored.png`) });
      console.log(`${grade}: ${result.world}; r${expectedRevision} departure and cold recovery passed`);
    } catch (error) {
      result.status = 'failed'; result.failure = String(error); process.exitCode = 1;
      await page.screenshot({ path: path.join(out, `${grade}-failure.png`) }).catch(() => {});
      result.diagnostic = await page.evaluate(() => ({ text: document.body.innerText, saved: localStorage.getItem('coh-save-v1'), active: window.__game?.scene.getScenes(true).map(scene => scene.sys.settings.key) })).catch(() => null);
      console.error(`${grade}: ${error}`);
    } finally { writeReport(); await context.close(); }
    if (result.status === 'failed') break;
  }
  report.status = report.cases.length === grades.length && report.cases.every(result => result.status === 'passed') ? 'passed' : 'failed';
} finally {
  report.finishedAt = new Date().toISOString();
  if (report.status === 'running') report.status = 'interrupted';
  writeReport(); await browser.close();
}
