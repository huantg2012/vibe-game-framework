/** Integration probe. Real menu/grade/departure/reload input, isolated storage.
 * Opens preparation via the scene method to isolate it from haven navigation.
 * This is integration evidence, not a complete or novice expedition playtest. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const expectedRevision = Number(process.env.QA_EXPECTED_ALGORITHM_REVISION ?? 5);
assert([5, 6, 11, 13].includes(expectedRevision), 'Unsupported expected algorithm revision');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03/production');
assert(!fs.existsSync(out) || fs.readdirSync(out).length === 0, 'Use a new empty output directory; never overwrite prior evidence');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { method: 'Isolated new records; real menu/grade/depart/reload input. Preparation opened through its normal scene method. No loot, seed, outcome or clock overrides.', cases: [], status: 'running' };
const grades = (process.env.QA_GRADES ?? 'low,medium,severe').split(',');
const requestedWorlds = (process.env.QA_WORLDS ?? '').split(',').filter(Boolean);
const worlds = requestedWorlds.length ? requestedWorlds : [null];
const enemyMaterial = process.env.QA_ENEMY_MATERIAL === '1';
const approachMaterial = enemyMaterial && process.env.QA_APPROACH_MATERIAL === '1';
const rounds = Number(process.env.QA_RUNS ?? 1), seedStart = Number(process.env.QA_SEED_START ?? 0);
assert(Number.isSafeInteger(rounds) && rounds >= 1 && rounds <= 5, 'QA_RUNS must be 1–5');
assert(Number.isSafeInteger(seedStart) && seedStart >= 0 && seedStart + rounds * 20000 <= 0xffffffff, 'Invalid QA_SEED_START');
assert(grades.length > 0 && grades.every(grade => ['low', 'medium', 'severe'].includes(grade)), 'Invalid QA_GRADES');
report.enemyMaterialProbe = enemyMaterial;
report.rounds = rounds;
if (requestedWorlds.length) report.method = 'Controlled coverage: one departure seed per world is selected before any play; the enabled formal pool still selects the world. Real grade/departure/reload controls; preparation opened by its scene method. Fresh ordinary inventory. No outcome, map, health, loot, position or clock overrides. Not a natural expedition/economy sample.';
if (enemyMaterial) report.materialMethod = 'Read-only wrappers observe the actual renderer.attach arguments and completed visual updates. Brief real arrow-key input tests moving shoulder-light ownership. No forms, poses, lights, FOV, damage cells or render output are injected. Missing generated substrates and unobserved visible anatomy remain explicit coverage gaps.';
const responses = new Map(), pendingResponses = [], deferredResponses = new Set();
const deferAudit = process.env.QA_DEFER_AUDIT === '1', screenshots = process.env.QA_SCREENSHOTS !== '0';
async function installEnemyMaterialProbe(page) {
  if (!enemyMaterial) return;
  await page.evaluate(async () => {
    if (window.__r100EnemyMaterial) throw new Error('Material observer was already installed');
    const { getFormRenderer } = await import('/src/entities/form-renderers/registry.ts');
    const renderer = getFormRenderer('d-mixed');
    if (!renderer?.ready) throw new Error('Production form renderer is unavailable');
    const probe = window.__r100EnemyMaterial = { rows: [] };
    const attach = renderer.attach;
    renderer.attach = function (ctx) {
      const visual = attach.apply(this, arguments);
      if (ctx.scene?.sys.settings.key !== 'RiftScene') return visual;
      const row = { ctx, visual, lighting: ctx.worldLighting, frames: 0, nativeFrames: 0,
        firstLights: null, firstPlayer: null, firstLamp: null, maxPlayerTravel: 0,
        maxLampTravel: 0, maxLampPlayerError: 0, violations: [], lastPose: null };
      probe.rows.push(row);
      const fail = message => { if (!row.violations.includes(message)) row.violations.push(message); };
      const update = visual.update;
      visual.update = function (pose) {
        const result = update.apply(this, arguments);
        row.frames++; row.lastPose = { x: pose.x, y: pose.y, visibility: pose.visibility };
        if (ctx.worldAdaptation) {
          const native = ctx.scene.devRuntime?.worldMaterialLighting, bridge = ctx.worldLighting;
          if (bridge !== row.lighting) fail('attach lighting bridge identity changed');
          if (native) {
            row.nativeFrames++;
            if (!bridge || bridge.lights !== native.lights) fail('bridge does not expose the actual runtime lights');
            if (typeof bridge?.shadeAt !== 'function' || typeof native.shadeAt !== 'function') fail('actual world shadow sampler is missing');
            const lights = bridge?.lights;
            if (row.firstLights && row.firstLights !== lights) fail('runtime light array identity changed');
            row.firstLights ??= lights;
            const lamp = lights?.[0], player = ctx.scene.player.getPosition();
            if (!lamp) fail('moving shoulder lamp is absent');
            else {
              row.firstPlayer ??= { x: player.x, y: player.y };
              row.firstLamp ??= { x: lamp.x, y: lamp.y };
              row.maxPlayerTravel = Math.max(row.maxPlayerTravel, Math.hypot(player.x - row.firstPlayer.x, player.y - row.firstPlayer.y));
              row.maxLampTravel = Math.max(row.maxLampTravel, Math.hypot(lamp.x - row.firstLamp.x, lamp.y - row.firstLamp.y));
              row.maxLampPlayerError = Math.max(row.maxLampPlayerError, Math.hypot(lamp.x - player.x, lamp.y - player.y));
            }
          }
        }
        return result;
      };
      return visual;
    };
  });
}
async function captureEnemyMaterial(page, phase) {
  if (!enemyMaterial) return null;
  const sample = await page.evaluate(phase => {
    const scene = window.__game.scene.getScene('RiftScene'), recipe = scene.recovery?.identity.generation;
    const rows = window.__r100EnemyMaterial.rows.filter(row => row.ctx.scene === scene &&
      [...scene.formVisuals.values()].includes(row.visual));
    const adapted = rows.filter(row => row.ctx.worldAdaptation);
    const native = scene.devRuntime?.worldMaterialLighting;
    const observations = rows.map(row => {
      const { ctx, visual, lastPose: pose } = row;
      const id = [...scene.formVisuals].find(([, candidate]) => candidate === visual)?.[0];
      const flash = visual.getFlashSource?.();
      const image = visual.image ?? (flash && scene.children.list.find(object => object.texture?.key === flash.textureKey));
      const visibility = { observed: false, visiblePixels: 0, outsideSight: 0, outsideTerrain: 0,
        alphaAboveSight: 0, imageVisible: image?.visible ?? null, imageAlpha: image?.alpha ?? null };
      if (ctx.worldAdaptation && image && pose) {
        visibility.observed = true;
        if (ctx.form.substrate === 'human_remnant') {
          visibility.expectedAlpha = pose.visibility;
          visibility.authoritativeVisibility = scene.visibility.getVisibilityAt(pose);
          visibility.hidden = pose.visibility <= 0;
        } else if (ctx.form.substrate === 'fungal_mat' && image.visible) {
          const canvas = visual.texture.getContext().getImageData(0, 0, visual.w, visual.h).data;
          const left = image.x - visual.w / 2, top = image.y - visual.h / 2;
          for (let y = 0; y < visual.h; y++) for (let x = 0; x < visual.w; x++) {
            const alpha = canvas[(y * visual.w + x) * 4 + 3]; if (!alpha) continue;
            visibility.visiblePixels++;
            const point = { x: left + x + .5, y: top + y + .5 };
            const seen = scene.visibility.getVisibilityAt(point);
            if (seen <= 0) visibility.outsideSight++;
            if (!scene.formFloorGrid.isWalkableAt(point.x, point.y)) visibility.outsideTerrain++;
            if (alpha > Math.round(255 * seen)) visibility.alphaAboveSight++;
          }
        }
      }
      const light = ctx.worldLighting?.lights?.[0];
      const shadow = light && pose && ctx.worldLighting?.shadeAt && native?.shadeAt
        ? { bridge: ctx.worldLighting.shadeAt(pose.x, pose.y, 0, light), native: native.shadeAt(pose.x, pose.y, 0, light) } : null;
      return { id, substrate: ctx.form.substrate, seed: ctx.seed, profile: ctx.worldAdaptation ?? null,
        frames: row.frames, nativeFrames: row.nativeFrames, violations: row.violations,
        bridgeSharesNativeLights: !!native && ctx.worldLighting?.lights === native.lights,
        maxPlayerTravel: row.maxPlayerTravel, maxLampTravel: row.maxLampTravel,
        maxLampPlayerError: row.maxLampPlayerError, shadow, visibility };
    });
    return { phase, worldId: recipe?.package.id.slice(5), revision: recipe?.package.algorithmRevision,
      materialVersion: recipe?.enemyMaterialVersion ?? null, frozenProfile: recipe?.enemyMaterial ?? null,
      sharedBridge: adapted.every(row => row.ctx.worldLighting === adapted[0].ctx.worldLighting),
      rows: observations, missing: ['human_remnant', 'fungal_mat'].filter(substrate => !rows.some(row => row.ctx.form.substrate === substrate)) };
  }, phase);
  (report.materialSamples ??= []).push(sample);
  const admitted = sample.revision === 13 && ['crystal-fibre', 'ruptured-film'].includes(sample.worldId);
  if (admitted) {
    assert.equal(sample.materialVersion, 1, 'approved new departure freezes its material version');
    assert.equal(sample.frozenProfile?.worldId, sample.worldId, 'material profile belongs to the saved world');
    assert.match(sample.frozenProfile.key, /^world-body-v1:/);
  } else assert.equal(sample.frozenProfile, null, 'legacy and unapproved worlds must not acquire the new material');
  assert(sample.sharedBridge, 'all adapted attachments share one stable world-light bridge');
  for (const row of sample.rows) {
    const supported = admitted && ['human_remnant', 'fungal_mat'].includes(row.substrate);
    assert.deepEqual(row.profile, supported ? sample.frozenProfile : null, `${row.id}: renderer consumes exactly the frozen profile`);
    if (!supported) continue;
    assert(row.frames > 0 && row.nativeFrames > 0, `${row.id}: actual production updates observed`);
    assert.deepEqual(row.violations, [], `${row.id}: stable runtime lighting`);
    assert(row.bridgeSharesNativeLights, `${row.id}: actual native lights supplied`);
    assert(row.maxLampPlayerError < 1e-6, `${row.id}: shoulder lamp follows the actual player`);
    assert(row.shadow && Number.isFinite(row.shadow.bridge) && row.shadow.bridge >= 0 && row.shadow.bridge <= 1);
    assert.equal(row.shadow.bridge, row.shadow.native, `${row.id}: bridge forwards actual shadow sampling`);
    const visible = row.visibility;
    assert(visible.observed, `${row.id}: actual display object is inspectable`);
    if (row.substrate === 'human_remnant') {
      assert.equal(visible.authoritativeVisibility, visible.expectedAlpha, `${row.id}: authoritative FOV reaches the pose`);
      assert.equal(visible.imageAlpha, visible.expectedAlpha, `${row.id}: actual human alpha matches FOV`);
      assert.equal(visible.imageVisible, !visible.hidden, `${row.id}: hidden humans stay hidden`);
    } else {
      assert.equal(visible.outsideSight, 0, `${row.id}: no painted anatomy outside official FOV`);
      assert.equal(visible.outsideTerrain, 0, `${row.id}: no painted anatomy in VOID`);
      assert.equal(visible.alphaAboveSight, 0, `${row.id}: surface alpha cannot exceed its local visibility`);
    }
  }
  sample.status = admitted ? sample.rows.some(row => row.profile) ? 'attached-and-observed' : 'generated-targets-missing' : 'legacy-or-unapproved-default';
  return sample;
}
async function observeMovingShoulder(page) {
  const before = await page.evaluate(() => {
    const s = window.__game.scene.getScene('RiftScene'); return { ...s.player.getPosition() };
  });
  const inputs = [];
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    await page.keyboard.down(key); await page.waitForTimeout(180); await page.keyboard.up(key);
    // A cold continuation resumes saved momentum. Let ordinary deceleration
    // finish before comparing two stationary checkpoint positions exactly.
    await page.waitForFunction(() => {
      const state = window.__game.scene.getScene('RiftScene').player.exportRuntimeState();
      return state.velocity.x === 0 && state.velocity.y === 0 && state.inputVector.x === 0 && state.inputVector.y === 0;
    }, null, { timeout: 2000 });
    const point = await page.evaluate(() => ({ ...window.__game.scene.getScene('RiftScene').player.getPosition() }));
    inputs.push({ key, heldMs: 180, point });
    if (Math.hypot(point.x - before.x, point.y - before.y) > 1) break;
  }
  return { before, inputs, method: 'Real arrow keys only; no position, clock or lamp setter' };
}
async function approachNaturalMaterialActors(page, id) {
  const evidence = { method: 'Read-only native body/LOS navigation to existing natural actors; actual arrow keys only', targets: [], samples: [] };
  for (const substrate of ['human_remnant', 'fungal_mat']) {
    const target = { substrate, plans: [], inputs: [], status: 'not-observed' };
    evidence.targets.push(target);
    const deadline = Date.now() + 45000;
    for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
      const sample = await captureEnemyMaterial(page, `approach-${substrate}-${attempt}`);
      evidence.samples.push(sample);
      const visible = sample.rows.find(row => row.substrate === substrate && row.profile && row.visibility.imageVisible &&
        (substrate === 'human_remnant' ? row.visibility.imageAlpha > 0 : row.visibility.visiblePixels > 0));
      if (visible) { target.status = 'visible'; target.id = visible.id; break; }
      const plan = await page.evaluate(async substrate => {
        const scene = window.__game.scene.getScene('RiftScene'), from = { ...scene.player.getPosition() };
        const actors = window.__r100EnemyMaterial.rows.filter(row => row.ctx.scene === scene && row.ctx.worldAdaptation &&
          row.ctx.form.substrate === substrate && row.lastPose && [...scene.formVisuals.values()].includes(row.visual));
        actors.sort((a, b) => Math.hypot(a.lastPose.x - from.x, a.lastPose.y - from.y) - Math.hypot(b.lastPose.x - from.x, b.lastPose.y - from.y));
        if (!actors.length) return { status: 'missing-natural-actor' };
        const actor = actors[0], to = { x: actor.lastPose.x, y: actor.lastPose.y };
        const id = [...scene.formVisuals].find(([, v]) => v === actor.visual)?.[0];
        const { hasLineOfSight } = await import('/src/utils/grid-raycast.ts');
        const sight = scene.nativeWorldPresentation.world.sight, body = scene.nativeBody;
        const size = sight.tileSize, cols = sight.cols, rows = sight.rows;
        const point = index => ({ x: (index % cols + .5) * size, y: (Math.floor(index / cols) + .5) * size });
        const parent = new Int32Array(cols * rows).fill(-2), queue = new Int32Array(cols * rows);
        const start = Math.floor(from.y / size) * cols + Math.floor(from.x / size);
        let head = 0, tail = 0, goal = -1;
        // The actual 20px body must sweep to the first navigation centre too.
        const first = point(start);
        if (body.displacementFraction(from, 10, 10, first.x - from.x, first.y - from.y) < 1) return { status: 'start-centre-unreachable', from, to, id };
        queue[tail++] = start; parent[start] = -1;
        while (head < tail && head < 40000) {
          const at = queue[head++], p = point(at);
          if (Math.hypot(p.x - to.x, p.y - to.y) < 128 && hasLineOfSight(sight, p, to)) { goal = at; break; }
          const col = at % cols, row = Math.floor(at / cols);
          for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
            const x = col + dx, y = row + dy, next = y * cols + x;
            if (x < 0 || y < 0 || x >= cols || y >= rows || parent[next] !== -2) continue;
            const nextPoint = point(next);
            if (!body.supports(nextPoint, 11, 11) || body.displacementFraction(p, 10, 10, dx * size, dy * size) < 1) continue;
            parent[next] = at; queue[tail++] = next;
          }
        }
        if (goal < 0) return { status: 'no-bounded-native-route', from, to, id, visited: head };
        const route = []; for (let at = goal; at >= 0; at = parent[at]) route.push(point(at)); route.reverse();
        const corners = route.filter((p, i) => !i || i === route.length - 1 ||
          (p.x - route[i - 1].x) !== (route[i + 1].x - p.x) || (p.y - route[i - 1].y) !== (route[i + 1].y - p.y));
        return { status: 'planned', from, to, id, visited: head, routeCells: route.length, corners };
      }, substrate);
      target.plans.push(plan);
      if (plan.status !== 'planned') { target.status = plan.status; break; }
      let stuck = 0;
      for (const corner of plan.corners) {
        while (Date.now() < deadline && stuck < 8) {
          const state = await page.evaluate(substrate => {
            const scene = window.__game.scene.getScene('RiftScene');
            const seen = window.__r100EnemyMaterial.rows.some(row => row.ctx.scene === scene && row.ctx.form.substrate === substrate &&
              row.ctx.worldAdaptation && row.lastPose?.visibility > 0 && [...scene.formVisuals.values()].includes(row.visual));
            return { point: { ...scene.player.getPosition() }, seen };
          }, substrate);
          if (state.seen) break;
          const dx = corner.x - state.point.x, dy = corner.y - state.point.y;
          if (Math.hypot(dx, dy) < 4) break;
          const horizontal = Math.abs(dx) >= Math.abs(dy), distance = horizontal ? Math.abs(dx) : Math.abs(dy);
          const key = horizontal ? dx > 0 ? 'ArrowRight' : 'ArrowLeft' : dy > 0 ? 'ArrowDown' : 'ArrowUp';
          const heldMs = Math.max(25, Math.min(150, distance / 130 * 1000));
          await page.keyboard.down(key); await page.waitForTimeout(heldMs); await page.keyboard.up(key);
          await page.waitForFunction(() => {
            const state = window.__game.scene.getScene('RiftScene').player.exportRuntimeState();
            return state.velocity.x === 0 && state.velocity.y === 0 && state.inputVector.x === 0 && state.inputVector.y === 0;
          }, null, { timeout: 2000 });
          const after = await page.evaluate(() => ({ ...window.__game.scene.getScene('RiftScene').player.getPosition() }));
          target.inputs.push({ key, heldMs, from: state.point, to: after });
          stuck = Math.hypot(after.x - state.point.x, after.y - state.point.y) < .1 ? stuck + 1 : 0;
        }
        if (stuck >= 8 || Date.now() >= deadline) break;
      }
    }
    const final = await captureEnemyMaterial(page, `approach-${substrate}-final`); evidence.samples.push(final);
    if (final.rows.some(row => row.substrate === substrate && row.profile && row.visibility.imageVisible &&
      (substrate === 'human_remnant' ? row.visibility.imageAlpha > 0 : row.visibility.visiblePixels > 0))) target.status = 'visible';
    if (screenshots) await page.screenshot({ path: path.join(out, `${id}-${substrate}-${target.status}.png`) });
    console.log(`${id}: natural ${substrate}: ${target.status} (${target.inputs.length} real key presses)`);
  }
  return evidence;
}
async function installTimingProbe(page) {
  if (process.env.QA_STAGE_TIMING !== '1') return;
  await page.evaluate(async () => {
    const { RiftScene } = await import('/src/scenes/rift-scene.ts');
    const stages = [], pictures = []; window.__r100EntryTiming = { stages, pictures, readyAt: null };
    const create = RiftScene.prototype.createRunSteps, post = RiftScene.prototype.onPostUpdate, fence = RiftScene.prototype.createNativeEntryFence;
    RiftScene.prototype.createRunSteps = function* (...args) {
      const original = create.apply(this, args);
      try { while (true) { const start = performance.now(), result = original.next();
        stages.push({ start, duration: performance.now() - start, frame: this.game.loop.frame });
        if (result.done) return; yield;
      } } finally { original.return(); }
    };
    RiftScene.prototype.onPostUpdate = function (...args) {
      const measure = this.nativeEntryFence?.needsPresentation() && !this.stagedEntry?.isActive();
      const start = performance.now(), result = post.apply(this, args);
      if (measure) pictures.push({ start, duration: performance.now() - start }); return result;
    };
    RiftScene.prototype.createNativeEntryFence = function (...args) {
      const result = fence.apply(this, args), released = result.hooks.released;
      result.hooks.released = () => { released(); window.__r100EntryTiming.readyAt = performance.now(); }; return result;
    };
  });
}
report.sourceHashMethod = 'Fetch the exact served module/asset URLs independently of worker lifetime. Run only against an immutable source snapshot. Hashes verify served content, not browser cache transfer.';
try {
  coverage: for (const world of worlds) for (const grade of grades) for (let round = 0; round < rounds; round++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__r100LongTasks = [];
      new PerformanceObserver(list => {
        for (const row of list.getEntries()) window.__r100LongTasks.push({ start: row.startTime, duration: row.duration });
      }).observe({ entryTypes: ['longtask'] });
    });
    const id = `${world ? `${world}-${grade}` : grade}${rounds > 1 ? `-run-${round + 1}` : ''}`;
    const result = { world, grade, round: round + 1, errors: [], consoleMessages: [], status: 'running' }; report.cases.push(result);
    page.on('pageerror', error => result.errors.push(String(error)));
    page.on('console', message => result.consoleMessages.push({ type: message.type(), text: message.text() }));
    const recordResponse = response => {
      const url = new URL(response.url());
      if (!response.ok() || !/^\/(src\/|assets\/r100-materials\/)/.test(url.pathname)) return;
      // A material worker intentionally terminates after prewarming. Its CDP
      // response body can disappear before Playwright reads it, although the
      // game loaded it successfully. Audit the same frozen URL independently.
      if (deferAudit) { deferredResponses.add(response.url()); return; }
      pendingResponses.push(fetch(response.url()).then(async source => {
        if (!source.ok) throw new Error(`Source audit HTTP ${source.status}: ${response.url()}`);
        const body = Buffer.from(await source.arrayBuffer());
        const hash = createHash('sha256').update(body).digest('hex');
        const before = responses.get(url.pathname);
        if (before && before !== hash) throw new Error(`Source changed during coverage: ${url.pathname}`);
        responses.set(url.pathname, hash);
      }).catch(error => { result.errors.push(String(error)); }));
    };
    page.on('response', recordResponse);
    try {
      await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3043/');
      // Scene activation precedes asynchronous title decoding. Inputs are
      // deliberately ignored until the menu's actual interaction gate opens.
      await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
      await page.keyboard.press('Enter', { delay: 100 });
      await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
      await page.waitForTimeout(2200);
      await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
      const choice = page.locator(`[data-departure-grade="${grade}"]`);
      await choice.waitFor(); await choice.click();
      assert.equal(await choice.getAttribute('aria-pressed'), 'true');
      const nextPreparationStep = page.locator('[data-prepare-action="next"]');
      if (await nextPreparationStep.count()) {
        await nextPreparationStep.click();
        await page.locator('[data-prepare-action="depart"]').waitFor();
        result.preparationSteps = ['pollution', 'equipment'];
      }
      result.historyBeforeDeparture = await page.evaluate(async () =>
        (await import('/src/systems/inventory-store.ts')).inventoryStore.getRiftWorldHistory());
      assert.deepEqual(result.historyBeforeDeparture, { version: 1, visits: [] }, 'fresh formal coverage starts with empty history');
      if (world) {
        result.controlledSeed = await page.evaluate(async ({ world, grade, start }) => {
          const { selectR100ProductionRecipe } = await import('/src/generation/world-study/r100-package.ts');
          let seed = start;
          while (seed < start + 20000 && selectR100ProductionRecipe(seed, grade).package.id !== `r100-${world}`) seed++;
          if (seed === start + 20000) throw new Error(`World is not in the enabled pool: ${world}`);
          const original = crypto.getRandomValues;
          crypto.getRandomValues = function(values) {
            if (values instanceof Uint32Array && values.length === 1) {
              crypto.getRandomValues = original; values[0] = seed; return values;
            }
            return original.call(this, values);
          };
          return seed;
        }, { world, grade, start: seedStart + round * 20000 });
      }
      if (screenshots) await page.screenshot({ path: path.join(out, `${id}-prepare.png`) });
      await installEnemyMaterialProbe(page);
      await installTimingProbe(page);
      const timing = Date.now();
      const entryStart = await page.evaluate(() => performance.now());
      const profiler = process.env.QA_CPU_PROFILE === '1' ? await context.newCDPSession(page) : null;
      if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
      await page.keyboard.press('Shift+Enter', { delay: 100 });
      await page.waitForFunction(() => {
        const s = window.__game?.scene.getScene('RiftScene');
        return s?.scene.isActive() && s.player && s.nativeWorldPresentation && s.devRuntime && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive();
      }, null, { timeout: 30000 });
      result.departureMs = Date.now() - timing;
      await page.waitForTimeout(800);
      if (process.env.QA_STAGE_TIMING === '1') { result.entryTiming = await page.evaluate(() => window.__r100EntryTiming); result.entryWaitMs = result.entryTiming.readyAt - entryStart; }
      result.entryLongTasks = await page.evaluate(start => window.__r100LongTasks.filter(row => row.start >= start), entryStart);
      if (profiler) {
        const profile = await profiler.send('Profiler.stop');
        fs.writeFileSync(path.join(out, `${id}-entry.cpuprofile`), JSON.stringify(profile.profile));
        await profiler.detach();
      }
      if (screenshots) await page.screenshot({ path: path.join(out, `${id}-entry.png`) });
      result.runtime = await page.evaluate(() => {
        const s = window.__game.scene.getScene('RiftScene');
        return { grade: s.chaos.exportRuntimeState(), world: s.nativeWorldPresentation.world.definition,
          bodyGrid: s.formFloorGrid.tileSize, enemies: s.ai.getEnemies().length,
          nodes: s.search.nodes.map(n => ({ kind: n.kind, tier: n.tier, value: n.value })),
          elapsed: s.devElapsedMs };
      });
      assert.equal(result.runtime.world.grade, grade);
      assert.equal(result.runtime.bodyGrid, 8);
      result.materialMovement = await observeMovingShoulder(page);
      assert(result.materialMovement.inputs.some(input => Math.hypot(input.point.x - result.materialMovement.before.x,
        input.point.y - result.materialMovement.before.y) > 1), 'actual arrow-key input moves the player');
      result.enemyMaterialEntry = await captureEnemyMaterial(page, 'entry');
      if (result.enemyMaterialEntry?.rows.some(row => row.profile)) {
        assert(result.enemyMaterialEntry.rows.some(row => row.profile && row.maxPlayerTravel > 1 && row.maxLampTravel > 1),
          'actual player and shared shoulder lamp must move together during real input');
      }
      if (approachMaterial) result.materialApproach = await approachNaturalMaterialActors(page, id);
      if (process.env.QA_REQUIRE_VISIBLE_MATERIAL === '1') assert(result.materialApproach?.targets.every(target => target.status === 'visible'),
        'both naturally generated adapted substrates require actual visible anatomy evidence');
      await page.keyboard.press('Escape', { delay: 100 }); await page.waitForTimeout(150);
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
      result.checkpointPlayer = before.riftCheckpoint?.state?.player;
      result.identity = before.riftCheckpoint?.identity ?? before.riftDeparture?.identity;
      assert.equal(result.identity.generation.version, 3);
      assert.equal(result.identity.generation.package.algorithmRevision, expectedRevision);
      assert.equal(before.inventory.version, 4);
      result.committedWorldHistory = before.inventory.riftWorldHistory;
      assert.deepEqual(result.committedWorldHistory, { version: 1, visits: [{
        worldId: result.identity.generation.package.id.slice('r100-'.length), grade,
      }] }, 'exactly one official departure records its selected world and grade');
      assert.equal(result.identity.generation.package.grade, grade);
      if (world) {
        assert.equal(result.identity.generation.package.id, `r100-${world}`);
        assert.equal(result.identity.generation.requestedSeed, result.controlledSeed);
      }
      assert(before.riftCheckpoint?.state?.world.nativePresentation, 'formal renderer persists its own clock');
      result.savedWorldState = before.riftCheckpoint.state.world;
      if (process.env.QA_REQUIRE_BODY_VERSION === '1') {
        assert.equal(before.riftCheckpoint.state.world.bodyGeometryVersion, 1);
        const player = before.riftCheckpoint.state.player;
        assert(Math.abs(player.bodyPosition.x + 10 - player.position.x) < 1e-6);
        assert(Math.abs(player.bodyPosition.y + 10 - player.position.y) < 1e-6);
      }
      await page.reload();
      await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
      await installEnemyMaterialProbe(page);
      await installTimingProbe(page);
      const restoreStart = await page.evaluate(() => performance.now());
      await page.keyboard.press('Enter', { delay: 100 });
      await page.waitForFunction(() => {
        const s = window.__game?.scene.getScene('RiftScene');
        return s?.scene.isActive() && s.nativeWorldPresentation && s.devRuntime && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive();
      }, null, { timeout: 30000 });
      if (process.env.QA_STAGE_TIMING === '1') { result.restoreTiming = await page.evaluate(() => window.__r100EntryTiming); result.restoreWaitMs = result.restoreTiming.readyAt - restoreStart; }
      result.enemyMaterialRestored = await captureEnemyMaterial(page, 'cold-restore');
      await page.keyboard.press('Escape', { delay: 100 }); await page.waitForTimeout(150);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
      result.restoredCheckpointPlayer = after.riftCheckpoint?.state?.player;
      result.coldReloadLongTasks = await page.evaluate(() => window.__r100LongTasks);
      result.restoreLongTasks = result.coldReloadLongTasks.filter(row => row.start >= restoreStart);
      assert.deepEqual(after.riftCheckpoint?.identity ?? after.riftDeparture?.identity, result.identity);
      assert.deepEqual(after.riftCheckpoint.state.player.position, before.riftCheckpoint.state.player.position);
      if (enemyMaterial) {
        assert.deepEqual(result.enemyMaterialRestored.frozenProfile, result.enemyMaterialEntry.frozenProfile,
          'cold continuation retains the exact frozen enemy profile');
        assert.deepEqual(after.riftCheckpoint.identity.generation.package, before.riftCheckpoint.identity.generation.package,
          'cold continuation retains the exact package');
        assert.deepEqual(after.riftCheckpoint.identity.generation.enemyMaterial, before.riftCheckpoint.identity.generation.enemyMaterial,
          'saved enemy material is not replaced on cold continuation');
        assert.deepEqual(result.enemyMaterialRestored.rows.map(({ id, substrate, seed, profile }) => ({ id, substrate, seed, profile })),
          result.enemyMaterialEntry.rows.map(({ id, substrate, seed, profile }) => ({ id, substrate, seed, profile })),
          'actual cold attachments retain generated identity, individual seed and profile');
      }
      if (process.env.QA_REQUIRE_BODY_VERSION === '1') {
        assert.equal(after.riftCheckpoint.state.world.bodyGeometryVersion, 1);
        assert.deepEqual(after.riftCheckpoint.state.player.bodyPosition, before.riftCheckpoint.state.player.bodyPosition);
        assert(after.riftCheckpoint.elapsedMs >= before.riftCheckpoint.elapsedMs);
        result.bodyGeometry = { version: 1, fullBodyCheckpointAdmitted: true, coldBodyPositionPreserved: true };
      }
      assert.deepEqual(after.inventory.riftWorldHistory, result.committedWorldHistory, 'cold recovery preserves the entire recent history without another visit');
      result.worldHistoryPreserved = true;
      result.coldIdentityPreserved = true;
      result.performanceBudget = { maximumContinuousMs: 50, entryPass: result.entryLongTasks.length === 0,
        restorePass: result.restoreLongTasks.length === 0, sourceAuditDeferred: deferAudit, serialBrowserCases: true };
      if (process.env.QA_P01_STRICT === '1') {
        assert(result.performanceBudget.entryPass, 'entry continuous main-thread task exceeds 50ms');
        assert(result.performanceBudget.restorePass, 'restore continuous main-thread task exceeds 50ms');
        if (result.entryTiming) for (const timing of [result.entryTiming, result.restoreTiming]) assert([...timing.stages,...timing.pictures].every(row => row.duration < 50), 'measured native construction/presentation stage must stay below 50ms');
      }
      assert.deepEqual(result.errors, []);
      result.status = 'passed';
      if (screenshots) await page.screenshot({ path: path.join(out, `${id}-restored.png`) });
      console.log(`${id}: entry and reload passed (${result.departureMs} ms including scene transition)`);
    } catch (error) {
      result.status = 'failed'; result.failure = String(error);
      await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {});
      result.diagnostic = await page.evaluate(() => ({ text: document.body.innerText, saved: localStorage.getItem('coh-save-v1'), active: window.__game?.scene.getScenes(true).map(s => s.sys.settings.key) })).catch(() => null);
      console.error(id, error); process.exitCode = 1;
    } finally {
      page.off('response', recordResponse);
      await Promise.all(pendingResponses);
      if (result.errors.length) { result.status = 'failed'; result.failure ??= 'Source/browser errors'; }
      fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
      await context.close();
    }
    // Explicit final-observation mode preserves the current complete case,
    // then stops before creating another context even if a caught error did
    // not fail the scene's own completion predicate. Default probes are unchanged.
    const observedFailure = process.env.QA_WORKER_OBSERVER_FAILURE_FILE;
    if (observedFailure && fs.existsSync(observedFailure)) {
      result.status = 'failed'; result.failure ??= 'External Worker/network observation requires diagnosis';
      result.observedFailure = { path: observedFailure, sha256: createHash('sha256').update(fs.readFileSync(observedFailure)).digest('hex') };
      process.exitCode = 1;
    }
    if (result.status === 'failed' && process.env.QA_STOP_ON_FAILURE === '1') break coverage;
  }
  report.status = report.cases.every(c => c.status === 'passed') ? 'passed' : 'failed';
} finally {
  await Promise.all(pendingResponses);
  for (const url of deferredResponses) { const response = await fetch(url); if (!response.ok) throw new Error(`Deferred source audit ${response.status}: ${url}`); responses.set(new URL(url).pathname, createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')); }
  report.loadedSourceHashes = Object.fromEntries([...responses.entries()].sort());
  if (enemyMaterial) report.enemyMaterialCoverage = ['crystal-fibre', 'ruptured-film'].map(worldId => {
    const samples = report.cases.filter(row => row.status === 'passed' && row.enemyMaterialEntry?.worldId === worldId);
    return { worldId, completedDepartures: samples.length,
      substrates: ['human_remnant', 'fungal_mat'].map(substrate => {
        const rows = samples.flatMap(sample => sample.enemyMaterialEntry.rows.filter(row => row.substrate === substrate && row.profile));
        const observed = samples.flatMap(sample => [sample.enemyMaterialEntry, ...(sample.materialApproach?.samples ?? []), sample.enemyMaterialRestored]);
        const visible = observed.flatMap(sample => sample.rows.filter(row => row.substrate === substrate && row.profile && row.visibility.imageVisible &&
          (substrate === 'human_remnant' ? row.visibility.imageAlpha > 0 : row.visibility.visiblePixels > 0)));
        return { substrate, generated: rows.length, visibleSamples: visible.length,
          status: !rows.length ? 'missing-from-generated-departures' : !visible.length ? 'attached-but-visible-anatomy-not-observed' : 'attached-and-visible' };
      }) };
  });
  if (report.cases.some(result => result.errors.length)) { report.status = 'failed'; process.exitCode = 1; }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
