/** Controlled production-scene regression, not novice-play evidence. A fresh
 * browser uses the real v2 world, Host, renderer and fog; only observer pose and
 * simulation pause are controlled. No player's browser/storage is accessed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/iteration-28/paint-fixes');
const legacy = process.argv.includes('--legacy');
const historical = process.argv.includes('--historical-before');
const reportName = legacy ? `legacy-${historical ? 'before' : 'after'}` : 'report';
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
const page = await context.newPage();
const report = { method: 'Isolated fresh browser, normal new game followed by controlled seed=1 production departure. Real RiftScene/world renderer/Host/visibility; simulation paused while observer position and eight-way facing are set. No fog disabling, fake DOM scene or player-save access.', errors: [], status: 'running', samples: [] };
if (legacy) report.method = 'Isolated recreation of reported world: seed 1644663053, ivory-basin/open-scars, no geometry-version field in the old recipe, observer1199,893 facing right. Real scene, production fog and terrain. Observer pose/simulation pause controlled; no user browser/save accessed. Historical before uses the old display bake (version1) and disables the new presentation-only relocation in this isolated renderer module; production files and gameplay stay unchanged.';
page.on('pageerror', error => report.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
const persist = () => fs.writeFileSync(path.join(out, `${reportName}.json`), JSON.stringify(report, null, 2));
try {
  if (legacy && historical) await page.route('**/src/entities/form-renderers/d/paint-genome/attach.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    const pattern = /(?:const|let) baked = bakePaintGenome\(\{ \.\.\.recipe, geometryVersion: 2 \}\);/;
    assert(pattern.test(source), 'historical comparison changes exactly the display geometry selector');
    // Old rendering had neither overscan nor presentation-only relocation.
    const historicalSource = source.replace(pattern, 'let baked = bakePaintGenome({ ...recipe, geometryVersion: 1 });')
      .replace('if (ctx.paintGeometryVersion === 1 && ctx.pin && ctx.surfaceFloorAt)', 'if (false)');
    await route.fulfill({ response, body: historicalSource });
  });
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3021/');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(300);
  report.world = await page.evaluate(async legacy => {
    const [{ createWorldProductionMap }, { selectWorldProductionRecipe }, { checkpointChecksum },
      { restoreProceduralLayout, installProceduralRiftRecovery }, { inventoryStore }] = await Promise.all([
      import('/src/generation/world-study/production-map.ts'), import('/src/generation/world-study/production-recipe.ts'),
      import('/src/types/rift-checkpoint.ts'), import('/src/managers/rift-recovery.ts'), import('/src/systems/inventory-store.ts')]);
    const seed = legacy ? 1644663053 : 1;
    const generation = legacy ? { ...selectWorldProductionRecipe(seed),
      profile: (await import('/src/generation/world-study/profiles.ts')).worldProfileById('ivory-basin'),
      space: (await import('/src/generation/world-study/space-profile.ts')).SPACE_PROFILES.find(value => value.id === 'open-scars'),
      paintGeometryVersion: undefined } : selectWorldProductionRecipe(seed);
    const world = createWorldProductionMap(generation.profile, generation.space, seed,
      { contentFragmentTypeId: generation.contentFragmentTypeId, paintGeometryVersion: generation.paintGeometryVersion ?? 1 });
    const layout = world.layout;
    const layoutHash = checkpointChecksum({ tileMap: layout.tileMap, spawns: layout.enemySpawns, pins: layout.contaminationPins,
      draw: layout.contaminationDraw, spawn: layout.spawnPoint, exit: layout.extractionPoint,
      fuel: layout.kindlingNodes, items: layout.contaminantNodes });
    const identity = { worldId: 'procedural-rift', layoutId: 'procedural-rift', seed: layout.seed,
      recipeId: layout.recipeId, signature: checkpointChecksum({ layout: layoutHash, generation, hostTileMap: world.hostTileMap }),
      generation, catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 };
    installProceduralRiftRecovery();
    restoreProceduralLayout(identity);
    const began = inventoryStore.beginRun('paint-controlled-browser',
      { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 });
    if (!began.ok) throw new Error(`Cannot begin controlled departure: ${began.error}`);
    const game = window.__game;
    game.scene.getScene('PurificationScene').scene.start('RiftScene', { cycle: 1,
      modifiers: { chaosRateModifier: 1, kindlingValueModifier: 1, startingChaos: 0 },
      recovery: { identity, externalTargetIds: [] } });
    return { identity, paintPins: layout.contaminationPins.paintFloors,
      forms: layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing') };
  }, legacy);
  await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'));
  await page.waitForFunction(() => window.__game.scene.getScene('RiftScene').formVisuals.size > 0);
  if (legacy) {
    report.fixture = await page.evaluate(() => {
      const s = window.__game.scene.getScene('RiftScene'); s.scene.pause(); s.physics.pause();
      const p = { x: 1199, y: 893 }, state = s.player.exportRuntimeState();
      state.bodyPosition = { x: p.x + state.bodyPosition.x - state.position.x, y: p.y + state.bodyPosition.y - state.position.y };
      state.position = p; state.velocity = { x: 0, y: 0 }; state.inputVector = { x: 0, y: 0 };
      state.moving = false; state.facingAngle = 0; state.facing4 = 'right'; s.player.restoreRuntimeState(state);
      s.cameras.main.centerOn(p.x, p.y); s.cameras.main.preRender(); s.visibility.update(p, 0, 16); s.syncSchemeDPoses(0);
      s.search.tickVisuals(0); s.groundDepthSorter?.update();
      const states = s.hosts.exportRuntimeState().hosts;
      const subjects = s.hosts.getSubjects().filter(host => host.form.portfolio === 'bing').map(host => {
        const v = s.formVisuals.get(host.id), pin = s.hosts.getVisualPin(host.id);
        const pixels = v.texture.getContext().getImageData(0, 0, v.w, v.h).data;
        let visible = 0, outsideOldCanvas = 0, inVoid = 0, outsideSight = 0;
        const left = v.image.x - v.w / 2, top = v.image.y - v.h / 2;
        for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) {
          if (!v.image.visible || !pixels[(y * v.w + x) * 4 + 3]) continue;
          visible++;
          const p = { x: left + x + .5, y: top + y + .5 };
          if (Math.abs(p.x - pin.x) > 44 || Math.abs(p.y - pin.y) > 44) outsideOldCanvas++;
          if (!s.formFloorGrid.isWalkableAt(p.x, p.y)) inVoid++;
          if (s.visibility.getVisibilityAt(p) === 0) outsideSight++;
        }
        const runtime = states.find(row => row.id === host.id).state;
        return { id: host.id, pin, displayOrigin: { x: v.image.x, y: v.image.y }, w: v.w, h: v.h, key: v.key, stepFloors: v.stepFloors,
          placement: v.legacyPresentationReport,
          state: { core: runtime.core, hp: runtime.hp, alive: runtime.alive, nuclei: runtime.nuclei },
          visible, outsideOldCanvas, inVoid, outsideSight };
      });
      return { version: s.paintGeometryVersion, position: p, subjects, targets: s.hosts.getRecoveryTargetIds(),
        identity: JSON.parse(localStorage.getItem('coh-save-v1')).riftCheckpoint.identity };
    });
    assert.equal(report.fixture.version, 1);
    assert(report.fixture.subjects.every(row => row.inVoid === 0 && row.outsideSight === 0));
    const target = report.fixture.subjects.find(row => row.id === 'ENM_BING_02');
    assert(target?.visible > 0);
    if (historical) { assert.equal(target.w, 88); assert.equal(target.h, 88); assert.equal(target.outsideOldCanvas, 0); }
    else {
      assert(target.w > 88 && target.h > 88 && target.outsideOldCanvas > 0);
      const before = JSON.parse(fs.readFileSync(path.join(out, 'legacy-before.json'), 'utf8'));
      assert.deepEqual(report.fixture.identity, before.fixture.identity, 'old world identity is not migrated');
      assert.deepEqual(report.fixture.targets, before.fixture.targets, 'combat target IDs/order do not change');
      assert.deepEqual(report.fixture.subjects.map(({ id, stepFloors, state }) => ({ id, stepFloors, state })),
        before.fixture.subjects.map(({ id, stepFloors, state }) => ({ id, stepFloors, state })), 'old danger cells, core seats and HP remain identical');
    }
    await page.waitForTimeout(120); await page.screenshot({ path: path.join(out, `${reportName}.png`) });
    if (!historical) {
      report.partial = await page.evaluate(() => {
        const s = window.__game.scene.getScene('RiftScene'), v = s.formVisuals.get('ENM_BING_02');
        const core = s.hosts.exportRuntimeState().hosts.find(row => row.id === 'ENM_BING_02').state.core;
        const p = { x: 1199, y: 893 };
        for (const direction of [7, 1, 3, 5]) {
          const angle = direction * Math.PI / 4; s.visibility.update(p, angle, 16); s.syncSchemeDPoses(0);
          s.search.tickVisuals(0);
          if (s.visibility.getVisibilityAt(core) > 0 || !v.image.visible) continue;
          const bytes = v.texture.getContext().getImageData(0, 0, v.w, v.h).data;
          let visible = 0, unsupported = 0, outsideSight = 0;
          for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) if (bytes[(y * v.w + x) * 4 + 3]) {
            visible++; const point = { x: v.image.x - v.w / 2 + x + .5, y: v.image.y - v.h / 2 + y + .5 };
            if (!s.formFloorGrid.isWalkableAt(point.x, point.y)) unsupported++;
            if (s.visibility.getVisibilityAt(point) === 0) outsideSight++;
          }
          if (visible) return { direction, visible, coreVisibility: 0, unsupported, outsideSight };
        }
        throw new Error('The reported old colony must remain partially visible with its core outside an eight-way cone');
      });
      assert.equal(report.partial.unsupported, 0); assert.equal(report.partial.outsideSight, 0);
      await page.waitForTimeout(100); await page.screenshot({ path: path.join(out, 'legacy-partial.png') });
    }
    assert.deepEqual(report.errors, []); report.status = 'passed'; persist();
    fs.rmSync(path.join(out, `${reportName}-failure.png`), { force: true });
    console.log(JSON.stringify({ status: report.status, target, identity: report.fixture.identity.signature }, null, 2));
  } else {
  report.fixture = await page.evaluate(() => {
    const s = window.__game.scene.getScene('RiftScene');
    s.scene.pause(); s.physics.pause();
    const forms = s.hosts.getSubjects().filter(subject => subject.form.portfolio === 'bing' && subject.form.continuity === 'colony');
    const grid = s.formFloorGrid;
    const candidates = [];
    for (const host of forms) {
      const v = s.formVisuals.get(host.id), pin = s.hosts.getVisualPin(host.id);
      const left = pin.x - v.w / 2, top = pin.y - v.h / 2;
      const samples = [];
      let bodyPixels = 0, unsupported = 0, canvasBorder = 0;
      for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) {
        if (v.rest[y * v.w + x] < .1) continue;
        bodyPixels++;
        if (!grid.isWalkableAt(left + x + .5, top + y + .5)) unsupported++;
        if (x < 2 || y < 2 || x >= v.w - 2 || y >= v.h - 2) canvasBorder++;
        if (x % 4 === 0 && y % 4 === 0) samples.push({ x: left + x + .5, y: top + y + .5 });
      }
      const runtime = s.hosts.exportRuntimeState().hosts.find(row => row.id === host.id);
      const core = runtime.state.core;
      candidates.push({ id: host.id, pin, core, bodyPixels, unsupported, canvasBorder, width: v.w, height: v.h,
        occupiedCells: v.stepFloors.length, sampleCount: samples.length });
      // The coarse grid cell centers provide full player body support. Search
      // only normal eight-way facings at one observer position per candidate.
      for (let dy = -224; dy <= 224; dy += 16) for (let dx = -224; dx <= 224; dx += 16) {
        const distance = Math.hypot(dx, dy);
        if (distance < 145 || distance > 195) continue;
        const p = { x: pin.x + dx, y: pin.y + dy };
        if (![-11, 0, 11].every(x => [-11, 0, 11].every(y => grid.isWalkableAt(p.x + x, p.y + y)))) continue;
        const views = [];
        for (let direction = 0; direction < 8; direction++) {
          const angle = direction * Math.PI / 4;
          s.visibility.update(p, angle, 16);
          const seen = samples.filter(point => s.visibility.getVisibilityAt(point) > 0).length;
          views.push({ direction, angle, seen, ratio: seen / samples.length, coreVisibility: s.visibility.getVisibilityAt(core) });
        }
        const full = views.find(view => view.ratio >= .97 && view.coreVisibility > 0);
        const partial = views.find(view => view.direction % 2 === 1 && view.ratio > .08 && view.ratio < .8 && view.coreVisibility === 0);
        const hidden = views.find(view => view.seen === 0 && view.coreVisibility === 0);
        if (full && partial && hidden) {
          window.__paintQA = { id: host.id, pin, position: p, full, partial, hidden };
          return { selected: window.__paintQA, checked: candidates, geometryVersion: s.paintGeometryVersion };
        }
      }
    }
    throw new Error(`No same-position eight-way full/partial/hidden view found: ${JSON.stringify(candidates)}`);
  });
  assert.equal(report.fixture.geometryVersion, 2);
  assert(report.fixture.checked.every(host => host.unsupported === 0 && host.canvasBorder === 0));
  assert(report.fixture.checked.some(host => host.occupiedCells > 9), 'complete colony occupies its actual multi-cell footprint');
  for (const name of ['full', 'partial', 'hidden']) {
    const sample = await page.evaluate(name => {
      const s = window.__game.scene.getScene('RiftScene'), selected = window.__paintQA;
      const v = s.formVisuals.get(selected.id), p = selected.position, angle = selected[name].angle;
      const state = s.player.exportRuntimeState();
      const offsetX = state.bodyPosition.x - state.position.x, offsetY = state.bodyPosition.y - state.position.y;
      state.position = { ...p }; state.bodyPosition = { x: p.x + offsetX, y: p.y + offsetY };
      state.velocity = { x: 0, y: 0 }; state.inputVector = { x: 0, y: 0 }; state.moving = false;
      state.facingAngle = angle; state.facing4 = ['right', 'down', 'down', 'left', 'left', 'up', 'up', 'right'][selected[name].direction];
      s.player.restoreRuntimeState(state);
      // A diagnostic teleport is much larger than the ordinary one-frame
      // camera margin. Refresh worldView before the real fog rasterizer runs.
      s.cameras.main.centerOn(p.x, p.y);
      s.cameras.main.preRender();
      s.visibility.update(p, angle, 16);
      s.syncSchemeDPoses(0);
      const pixels = v.texture.getContext().getImageData(0, 0, v.w, v.h).data;
      const left = v.image.x - v.w / 2, top = v.image.y - v.h / 2;
      let visiblePixels = 0, outsideSight = 0, inVoid = 0;
      for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) {
        if (!pixels[(y * v.w + x) * 4 + 3]) continue;
        visiblePixels++;
        const point = { x: left + x + .5, y: top + y + .5 };
        if (s.visibility.getVisibilityAt(point) === 0) outsideSight++;
        if (!s.formFloorGrid.isWalkableAt(point.x, point.y)) inVoid++;
      }
      const host = s.hosts.exportRuntimeState().hosts.find(row => row.id === selected.id);
      return { name, hostId: selected.id, position: { ...p }, direction: selected[name].direction,
        facingRadians: angle, core: host.state.core, coreVisibility: s.visibility.getVisibilityAt(host.state.core),
        visiblePixels, imageVisible: v.image.visible, outsideSight, inVoid,
        texture: { width: v.w, height: v.h }, floorCells: v.stepFloors.length };
    }, name);
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    assert.equal(sample.outsideSight, 0, `${name}: no pixels outside official sight`);
    assert.equal(sample.inVoid, 0, `${name}: paint never appears in spatial VOID`);
    if (name === 'full') assert(sample.visiblePixels > 0 && sample.coreVisibility > 0 && sample.imageVisible);
    if (name === 'partial') assert(sample.visiblePixels > 0 && sample.coreVisibility === 0 && sample.imageVisible,
      'core outside cone must not hide illuminated pieces');
    if (name === 'hidden') assert.equal(sample.imageVisible, false, 'turning away hides the organism');
    report.samples.push(sample); persist();
  }
  assert(report.samples[1].visiblePixels < report.samples[0].visiblePixels, 'the diagonal view shows only part of the same colony');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  fs.rmSync(path.join(out, 'failure.png'), { force: true });
  console.log(JSON.stringify({ status: report.status, selected: report.fixture.selected, samples: report.samples }, null, 2));
  }
} catch (error) {
  report.status = 'failed'; report.failure = String(error); process.exitCode = 1;
  await page.screenshot({ path: path.join(out, legacy ? `${reportName}-failure.png` : 'failure.png') }).catch(() => {});
  console.error(error);
} finally {
  persist(); await context.close(); await browser.close();
}
