/** Normal-FOV art routes: actual keyboard, unchanged actor/light/clock. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert(process.env.QA_PLAN && process.env.QA_SOURCE_MANIFEST && process.env.GAME_URL, 'Explicit plan, frozen manifest and URL required');
const plan = JSON.parse(fs.readFileSync(process.env.QA_PLAN));
const out = path.resolve(process.env.QA_OUTPUT_DIR); fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(process.env.QA_SOURCE_MANIFEST));
for (const [file, hash] of Object.entries(manifest.sources)) assert.equal(sha(fs.readFileSync(path.join(manifest.temporaryRoot, file))), hash, file);
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const report = { sourceManifest: { path: process.env.QA_SOURCE_MANIFEST, sha256: sha(fs.readFileSync(process.env.QA_SOURCE_MANIFEST)) }, plan, harnessSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  scope: 'Normal finite FOV and camera; controlled world/seed/bare training loadout. Real WASD from spawn, complete static floor read for body routing. No player, health, lighting, fog or clock edits. Enemies remain active. Brief route and still images are not full-run qualification.', cases: [], errors: [], browserClosed: false };
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const testCase of plan.cases) {
    const { world, grade, goals } = testCase, requestedSeed = plan.seed;
    const dir = path.join(out, `${world}-${grade}`); fs.mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: plan.viewport, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 1152, height: 800 } } });
    const page = await context.newPage(), result = { world, grade, seed: requestedSeed, steps: [] }; report.cases.push(result);
    const log = event => fs.appendFileSync(path.join(dir, 'inputs.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
    page.on('pageerror', error => { report.errors.push(String(error)); log({ event: 'pageerror', error: String(error) }); });
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ text: message.text(), location: message.location() }); });
    page.on('crash', () => report.errors.push('page crash'));
    page.on('load',()=>log({event:'load'}));
    page.on('domcontentloaded',()=>log({event:'domcontentloaded'}));
    page.on('requestfailed',request=>log({event:'requestfailed',url:request.url(),failure:request.failure()}));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) log({ event: 'navigation', url: frame.url() }); });
    const state = () => page.evaluate(() => { const scene = window.__game.scene.getScene('RiftScene'); return { active: scene.scene.isActive(), ended: scene.runController.isRunEnded(), pos: { ...scene.player.getPosition() }, facingAngle: scene.player.getFacingAngle(), facing4: scene.player.getFacing4(), hp: scene.combat.getHealth(), chaos: scene.chaos.getValue(), elapsedMs: scene.runController.getElapsedMs() }; });
    const hold = async (keys, ms) => { log({ event: 'hold', keys, ms }); try { for (const key of keys) await page.keyboard.down(key); await page.waitForTimeout(ms); } finally { for (const key of keys) await page.keyboard.up(key); } await page.waitForTimeout(35); };
    await page.goto(`${process.env.GAME_URL}/r100-gym.html?world=${world}&grade=${grade}&seed=${requestedSeed}&loadout=bare`);
    await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 90000 });
    await page.evaluate(async () => { const { audioManager } = await import('/src/managers/audio-manager.ts'); window.__game = audioManager.game; });
    await page.waitForFunction(() => { const s = window.__game?.scene.getScene('RiftScene'); return s?.scene.isActive() && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && s.search && s.chaos && !s.runController.isRunEnded(); });
    const identity = await page.evaluate(() => { const s = window.__r100Gym.getState(); return { requestedSeed: s.recipe.requestedSeed, worldId: s.recipe.profile.id, grade: s.recipe.nativeDefinition.grade, package: s.recipe.package, runtimeGrade: s.runtime.probe.pollutionGrade, url: location.href }; });
    assert.equal(identity.requestedSeed, requestedSeed); assert.equal(identity.worldId, world); assert.equal(identity.grade, grade); assert.equal(identity.runtimeGrade, grade); assert.equal(identity.package.algorithmRevision, 6);
    assert.deepEqual(page.viewportSize(), plan.viewport); result.identity = { ...identity, viewport: page.viewportSize() }; log({ event: 'entry', identity, state: await state() });
    const actualRecipe = await page.evaluate(() => window.__r100Gym.getState().recipe);
    assert.equal(actualRecipe.requestedSeed, requestedSeed); assert.equal(actualRecipe.profile.id, world); assert.equal(actualRecipe.nativeDefinition.grade, grade);
    const recipeFile = path.join(dir, 'recipe.json'); fs.writeFileSync(recipeFile, JSON.stringify(actualRecipe, null, 2));
    result.recipe = { path: path.relative(process.cwd(), recipeFile), sha256: sha(fs.readFileSync(recipeFile)) };
    await page.locator('#game-container').focus();
    async function route(target) {
      const data = await page.evaluate(() => { const s = window.__game.scene.getScene('RiftScene'), g = s.formFloorGrid, b = s.player.getSprite().body; return { cols: g.cols, rows: g.rows, size: g.tileSize, walk: Array.from({ length: g.cols * g.rows }, (_, i) => g.isWalkable(i % g.cols, Math.floor(i / g.cols))), start: { ...s.player.getPosition() }, halfX: b.halfWidth + 1, halfY: b.halfHeight + 1 }; });
      const { cols, rows, size, walk, start, halfX, halfY } = data;
      const center = i => ({ x: (i % cols + .5) * size, y: (Math.floor(i / cols) + .5) * size });
      const floor = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && walk[y * cols + x];
      const safe = walk.map((v, i) => { if (!v) return false; const p = center(i); for (let y = Math.floor((p.y - halfY) / size); y <= Math.floor((p.y + halfY - .01) / size); y++) for (let x = Math.floor((p.x - halfX) / size); x <= Math.floor((p.x + halfX - .01) / size); x++) if (!floor(x, y)) return false; return true; });
      // A real 20px body may stand in a legal corner excluded by the coarse
      // 22px planning margin. Connect to that unchanged conservative grid only
      // through an exact, short native-body sweep; never teleport or shrink it.
      const candidates = safe.flatMap((value, index) => value && Math.hypot(center(index).x - start.x, center(index).y - start.y) <= 32
        ? [{ index, ...center(index) }] : []);
      const connector = await page.evaluate(({ candidates }) => {
        const s = window.__game.scene.getScene('RiftScene'), b = s.player.getSprite().body, collision = s.nativeBody;
        const origin = { ...s.player.getPosition() }, halfX = b.halfWidth, halfY = b.halfHeight;
        if (!collision || s.runController.isRunEnded() || halfX !== 10 || halfY !== 10
          || Math.hypot(b.center.x - origin.x, b.center.y - origin.y) > 1e-6
          || !collision.supports(origin, halfX, halfY)) throw new Error('Art route requires an active supported original 20px native body');
        const ordered = candidates.map(candidate => ({ ...candidate, distance: Math.hypot(candidate.x - origin.x, candidate.y - origin.y) }))
          .filter(candidate => candidate.distance <= 32).sort((a, b) => a.distance - b.distance || a.index - b.index);
        for (const candidate of ordered) {
          if (!collision.supports(candidate, halfX, halfY)) continue;
          const fraction = collision.displacementFraction(origin, halfX, halfY, candidate.x - origin.x, candidate.y - origin.y);
          if (fraction === 1) return { origin, halfX, halfY, selected: candidate, fraction };
        }
        throw new Error(`No supported native-body connector within 32px of ${JSON.stringify(origin)}`);
      }, { candidates });
      const begin = connector.selected.index, prev = new Map([[begin, -1]]), queue = [begin];
      for (let n = 0; n < queue.length; n++) { const i = queue[n], x = i % cols, y = Math.floor(i / cols); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy, k = b * cols + a; if (floor(a, b) && safe[k] && !prev.has(k)) { prev.set(k, i); queue.push(k); } } }
      const end = queue.filter(i => safe[i]).sort((a, b) => Math.hypot(center(a).x - target.x, center(a).y - target.y) - Math.hypot(center(b).x - target.x, center(b).y - target.y))[0];
      assert.notEqual(end, undefined); const raw = []; for (let i = end; i !== -1; i = prev.get(i)) raw.push(center(i)); raw.reverse(); const points = [raw[0]];
      for (let i = 1; i < raw.length - 1; i++) if ((raw[i - 1].x === raw[i].x) !== (raw[i].x === raw[i + 1].x)) points.push(raw[i]); points.push(raw.at(-1));
      return { requested: target, actual: center(end), points, length: (raw.length - 1) * size, originConnector: connector };
    }
    for (const goal of goals) {
      const planned = await route(goal), start = Date.now(); let previous = null, stuck = 0; log({ event: 'route', planned });
      for (const waypoint of planned.points) for (let step = 0; step < 100; step++) {
        const s = await state(); assert(s.active && !s.ended, 'Run ended during actual approach'); assert(Date.now() - start < 60000, 'Approach exceeds bounded route time');
        const dx = waypoint.x - s.pos.x, dy = waypoint.y - s.pos.y, distance = Math.hypot(dx, dy); if (distance < 3) break;
        stuck = previous && Math.hypot(previous.x - s.pos.x, previous.y - s.pos.y) < .3 ? stuck + 1 : 0; previous = s.pos; assert(stuck < 10, `Body stalled near ${JSON.stringify(waypoint)}`);
        const keys = []; if (Math.abs(dx) > 2) keys.push(dx > 0 ? 'd' : 'a'); if (Math.abs(dy) > 2) keys.push(dy > 0 ? 's' : 'w'); await hold(keys, Math.max(35, Math.min(160, distance / 80 * 1000)));
      }
      const stepResult = { goal, route: planned, captures: [] };
      for (const face of goal.faces) {
        const desired = { north: -Math.PI / 2, south: Math.PI / 2, east: 0, west: Math.PI }[face];
        const key = { north: 'w', south: 's', east: 'd', west: 'a' }[face], error = angle => Math.abs(Math.atan2(Math.sin(angle - desired), Math.cos(angle - desired)));
        let current = await state(); for (let n = 0; error(current.facingAngle) > .12 && n < 6; n++) { await hold([key], 80); current = await state(); }
        assert(error(current.facingAngle) <= .12, `Actual facing must be ${face}`); assert(!current.ended);
        await page.waitForTimeout(160); const before = await state(), file = path.join(dir, `${goal.label}-${face}.png`);
        await page.locator('#game-container canvas').screenshot({ path: file }); const after = await state(), bytes = fs.readFileSync(file);
        const capture = { file: path.relative(process.cwd(), file), sha256: sha(bytes), png: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, facing: face, actualAngle: before.facingAngle, before, after };
        stepResult.captures.push(capture); log({ event: 'capture', capture });
      }
      result.steps.push(stepResult); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    }
    // Keep one brief actual pressure/animation segment; do not accelerate phase.
    result.activityBefore = await state(); await page.waitForTimeout(1200); result.activityAfter = await state();
    await context.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(`${world}/${grade}: actual normal route captured`);
  }
  assert.deepEqual(report.errors, []); report.status = 'captured-limited-art-routes';
} catch (error) { report.status = 'failed'; report.failure = String(error); report.stack = error.stack; process.exitCode = 1; console.error(error); }
finally { await browser.close(); report.browserClosed = true; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
