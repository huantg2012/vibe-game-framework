/** Real-browser fault injection, not a natural expedition sample.
 * Only the QA script/probe changes: production source and saved state are never patched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03-i06/create-failure');
const snapshotPath = path.resolve(process.env.QA_SOURCE_SNAPSHOT ?? 'docs/qa/artifacts/r100-i03-i06/frozen-release-candidate/source-snapshot.json');
const sourceSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3065/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sentinel = 'QA_R100_ATTACH_SCHEME_D_ONCE';
const report = {
  status: 'running', createdAt: new Date().toISOString(), base,
  featureIds: ['COH-F002', 'COH-F003', 'COH-F005', 'COH-F012'],
  method: 'Real Chrome/WebGL2, isolated empty browser storage. Normal New record and grade/departure controls; haven preparation opened through its existing scene method. One deliberate synchronous attachSchemeD throw after native wrapper creation and before createRuntime. Formal title Continue then restores the exact durable departure. Final scene.start(MainMenuScene) is an explicit QA shutdown operation, not natural extraction. No seed, map, actor, inventory, health, clock, loot or saved-byte mutation.',
  gpuMethod: 'The real MasterSurfaceRenderer.destroy is called without replacement. Probe retains renderer/context/GL handles only through WeakRef. It records actual deleteTexture/deleteBuffer/deleteProgram calls, native is* results before/after, and context-loss state. This proves explicit resource release, not driver memory usage or garbage-collection timing.',
  expectedErrors: [], unexpectedErrors: [], sourceSnapshot: path.relative(process.cwd(), snapshotPath),
};
fs.mkdirSync(out, { recursive: true });
const write = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
function verifySource() {
  const mismatches = [];
  for (const [file, hash] of Object.entries(sourceSnapshot.sources)) {
    const actual = sha(fs.readFileSync(path.join(sourceSnapshot.temporaryRoot, file)));
    if (actual !== hash) mismatches.push(file);
  }
  assert.deepEqual(mismatches, [], 'immutable served source must match its frozen snapshot');
  return { files: Object.keys(sourceSnapshot.sources).length, snapshotSha256: sha(fs.readFileSync(snapshotPath)), mismatches };
}
report.sourceBefore = verifySource();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const sourceResponses = new Map(), audits = [];
page.on('pageerror', error => report.unexpectedErrors.push({ kind: 'pageerror', message: String(error) }));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const row = { kind: 'console.error', message: message.text(), location: message.location() };
  if (row.message.includes(sentinel) && row.message.includes('Rift entry failed; saved record retained')) report.expectedErrors.push(row);
  else report.unexpectedErrors.push(row);
});
page.on('response', response => {
  const url = new URL(response.url());
  if (!response.ok() || !/^\/(src\/|assets\/r100-materials\/)/.test(url.pathname)) return;
  // Worker termination can expire CDP response bodies: read the same immutable URL independently.
  audits.push(fetch(response.url()).then(async result => {
    assert(result.ok, `served-source audit ${result.status}: ${url.pathname}`);
    const hash = sha(Buffer.from(await result.arrayBuffer())), old = sourceResponses.get(url.pathname);
    if (old && old !== hash) throw new Error(`Served module changed during probe: ${url.pathname}`);
    sourceResponses.set(url.pathname, hash);
  }).catch(error => report.unexpectedErrors.push({ kind: 'source-audit', message: String(error) })));
});
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  report.browser = await page.evaluate(() => ({ userAgent: navigator.userAgent, storageKeys: Object.keys(localStorage) }));
  assert(!report.browser.storageKeys.includes('coh-save-v1'), 'test context must begin without a game record');
  await page.evaluate(async sentinel => {
    const { RiftScene } = await import('/src/scenes/rift-scene.ts');
    const { MasterSurfaceRenderer } = await import('/src/systems/r100-world/surface-renderer.ts');
    const { inventoryStore } = await import('/src/systems/inventory-store.ts');
    const originalAttach = RiftScene.prototype.attachSchemeD;
    const originalDestroy = MasterSurfaceRenderer.prototype.destroy;
    const originalDraw = MasterSurfaceRenderer.prototype.draw;
    const renderers = new WeakMap(), rows = [], events = [];
    const probe = { injection: null, armed: true };
    const register = renderer => {
      if (renderers.has(renderer)) return rows[renderers.get(renderer)];
      const gl = renderer.gl;
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      const row = { id: rows.length, renderer: new WeakRef(renderer), gl: new WeakRef(gl),
        textures: renderer.textures.map(texture => new WeakRef(texture)),
        buffer: new WeakRef(renderer.buffer), program: new WeakRef(renderer.program),
        rendererName: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION), width: renderer.canvas.width, height: renderer.canvas.height,
        destroyCalls: 0, drawCalls: 0, deleteCalls: { textures: 0, buffers: 0, programs: 0 },
        release: null };
      renderers.set(renderer, rows.length); rows.push(row); return row;
    };
    const snapshot = () => rows.map(row => ({ id: row.id, rendererName: row.rendererName,
      version: row.version, width: row.width, height: row.height,
      textures: row.textures.length, destroyCalls: row.destroyCalls, drawCalls: row.drawCalls,
      deleteCalls: { ...row.deleteCalls }, release: row.release,
      stillReachable: { renderer: !!row.renderer.deref(), context: !!row.gl.deref() } }));
    MasterSurfaceRenderer.prototype.draw = function(...args) {
      register(this).drawCalls++; return originalDraw.apply(this, args);
    };
    MasterSurfaceRenderer.prototype.destroy = function(...args) {
      const row = register(this), gl = this.gl;
      row.destroyCalls++;
      const before = { textures: row.textures.map(ref => { const h = ref.deref(); return !!h && gl.isTexture(h); }),
        buffer: gl.isBuffer(this.buffer), program: gl.isProgram(this.program), contextLost: gl.isContextLost(), destroyed: this.destroyed };
      const deleteTexture = gl.deleteTexture, deleteBuffer = gl.deleteBuffer, deleteProgram = gl.deleteProgram;
      gl.deleteTexture = function(handle) { row.deleteCalls.textures++; return deleteTexture.call(this, handle); };
      gl.deleteBuffer = function(handle) { row.deleteCalls.buffers++; return deleteBuffer.call(this, handle); };
      gl.deleteProgram = function(handle) { row.deleteCalls.programs++; return deleteProgram.call(this, handle); };
      try { return originalDestroy.apply(this, args); }
      finally {
        gl.deleteTexture = deleteTexture; gl.deleteBuffer = deleteBuffer; gl.deleteProgram = deleteProgram;
        row.release = { before, after: {
          textures: row.textures.map(ref => { const h = ref.deref(); return !!h && gl.isTexture(h); }),
          buffer: gl.isBuffer(this.buffer), program: gl.isProgram(this.program), contextLost: gl.isContextLost(),
          destroyed: this.destroyed, canvas: [this.canvas.width, this.canvas.height] } };
        events.push({ event: 'renderer-destroy', id: row.id, calls: row.destroyCalls, time: performance.now() });
      }
    };
    RiftScene.prototype.attachSchemeD = function(...args) {
      if (!probe.armed) return originalAttach.apply(this, args);
      probe.armed = false;
      probe.injection = { hasNativeWrapper: !!this.nativeWorldPresentation, hasRuntime: !!this.devRuntime,
        surfaceRowsBeforeThrow: snapshot(), savedRaw: localStorage.getItem('coh-save-v1'),
        activeRun: structuredClone(inventoryStore.getRun()), time: performance.now() };
      events.push({ event: 'injected-attachSchemeD-throw', time: performance.now() });
      throw new Error(sentinel);
    };
    window.__r100CreateFailure = {
      read: () => ({ armed: probe.armed, injection: probe.injection, renderers: snapshot(), events }),
      disarm: () => { probe.armed = false; RiftScene.prototype.attachSchemeD = originalAttach; },
      uninstall: () => { RiftScene.prototype.attachSchemeD = originalAttach;
        MasterSurfaceRenderer.prototype.destroy = originalDestroy; MasterSurfaceRenderer.prototype.draw = originalDraw; },
    };
  }, sentinel);
  await page.waitForTimeout(350); await page.keyboard.press('Enter', { delay: 100 });
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
  const low = page.locator('[data-departure-grade="low"]');
  await low.waitFor(); await low.click(); assert.equal(await low.getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: path.join(out, '01-formal-preparation.png') });
  await page.keyboard.press('Shift+Enter', { delay: 100 });
  await page.waitForFunction(() => window.__r100CreateFailure?.read().injection && window.__game?.scene.isActive('MainMenuScene'), null, { timeout: 45000 });
  await page.waitForTimeout(200);
  const failure = await page.evaluate(async () => {
    const { inventoryStore } = await import('/src/systems/inventory-store.ts');
    return { ...window.__r100CreateFailure.read(), savedRaw: localStorage.getItem('coh-save-v1'),
      activeRun: structuredClone(inventoryStore.getRun()), riftActive: window.__game.scene.isActive('RiftScene') };
  });
  assert(failure.injection.hasNativeWrapper && !failure.injection.hasRuntime, 'fault must occur between wrapper and runtime construction');
  assert.equal(failure.activeRun.status, 'active');
  assert.equal(failure.activeRun.id, failure.injection.activeRun.id);
  assert.equal(failure.savedRaw, failure.injection.savedRaw, 'creation failure must preserve exact durable departure bytes');
  const saved = JSON.parse(failure.savedRaw);
  assert(saved.riftDeparture && !saved.riftCheckpoint, 'failed first creation retains departure, not a made-up checkpoint');
  assert.equal(saved.riftDeparture.identity.generation.version, 3);
  assert.equal(saved.riftDeparture.identity.generation.package.grade, 'low');
  assert.equal(failure.riftActive, false);
  fs.writeFileSync(path.join(out, 'failed-departure.json'), failure.savedRaw);
  const checkReleased = row => {
    assert.equal(row.destroyCalls, 1, 'renderer owner destroys once');
    assert.deepEqual(row.deleteCalls, { textures: 4, buffers: 1, programs: 1 });
    assert(row.release.before.textures.every(Boolean) && row.release.before.buffer && row.release.before.program);
    assert(!row.release.before.contextLost && !row.release.before.destroyed);
    assert(row.release.after.textures.every(value => !value) && !row.release.after.buffer && !row.release.after.program);
    assert(row.release.after.contextLost && row.release.after.destroyed);
    assert.deepEqual(row.release.after.canvas, [1, 1]);
  };
  assert.equal(failure.renderers.length, 1); checkReleased(failure.renderers[0]);
  assert.equal(failure.renderers[0].drawCalls, 0, 'failed prepared renderer was never handed to live runtime');
  report.failure = { ...failure, savedRaw: undefined, injection: { ...failure.injection, savedRaw: undefined },
    savedSha256: sha(failure.savedRaw), identity: saved.riftDeparture.identity };
  await page.screenshot({ path: path.join(out, '02-failure-returned-title.png') });
  await page.evaluate(() => window.__r100CreateFailure.disarm());
  // An entry error opens the explicit preserve/abandon sub-menu. Preserve the
  // run first, then use the ordinary Continue button on the root title menu.
  await page.getByRole('button', { name: '保留记录，返回', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.waitForFunction(() => {
    const s = window.__game?.scene.getScene('RiftScene');
    return s?.scene.isActive() && s.nativeWorldPresentation && s.devRuntime && s.devElapsedMs >= 900;
  }, null, { timeout: 45000 });
  const restored = await page.evaluate(async () => {
    const { inventoryStore } = await import('/src/systems/inventory-store.ts');
    const s = window.__game.scene.getScene('RiftScene');
    return { ...window.__r100CreateFailure.read(), identity: s.recovery.identity,
      elapsedMs: s.devElapsedMs, presentation: s.devRuntime.snapshot(),
      run: structuredClone(inventoryStore.getRun()), nativeTextures: s.textures.getTextureKeys().filter(key => key.startsWith('r100-native-')) };
  });
  assert.deepEqual(restored.identity, saved.riftDeparture.identity, 'formal Continue restores exact frozen identity');
  assert.equal(restored.run.id, failure.activeRun.id); assert.equal(restored.run.status, 'active');
  assert.equal(restored.renderers.length, 2); assert.equal(restored.renderers[1].destroyCalls, 0);
  assert(restored.renderers[1].drawCalls > 10); assert.equal(restored.nativeTextures.length, 1);
  report.restored = { ...restored, injection: undefined };
  await page.screenshot({ path: path.join(out, '03-continued-native-world.png') });
  await page.keyboard.press('Escape', { delay: 100 }); await page.waitForTimeout(150);
  const checkpointRaw = await page.evaluate(() => localStorage.getItem('coh-save-v1'));
  const checkpoint = JSON.parse(checkpointRaw);
  assert.deepEqual(checkpoint.riftCheckpoint.identity, saved.riftDeparture.identity);
  assert.equal(checkpoint.riftCheckpoint.state.phase, 'active');
  fs.writeFileSync(path.join(out, 'restored-active-checkpoint.json'), checkpointRaw);
  await page.evaluate(() => window.__game.scene.getScene('RiftScene').scene.start('MainMenuScene'));
  await page.waitForFunction(() => window.__game.scene.isActive('MainMenuScene'));
  await page.waitForTimeout(200);
  const closed = await page.evaluate(async () => {
    const { inventoryStore } = await import('/src/systems/inventory-store.ts');
    return { ...window.__r100CreateFailure.read(), savedRaw: localStorage.getItem('coh-save-v1'),
      run: structuredClone(inventoryStore.getRun()), nativeTextures: window.__game.textures.getTextureKeys().filter(key => key.startsWith('r100-native-')) };
  });
  assert.equal(closed.renderers.length, 2); closed.renderers.forEach(checkReleased);
  assert.deepEqual(closed.nativeTextures, []); assert.equal(closed.savedRaw, checkpointRaw);
  assert.equal(closed.run.id, failure.activeRun.id); assert.equal(closed.run.status, 'active');
  // A redundant ordinary stop must not destroy either transferred owner twice.
  await page.evaluate(() => window.__game.scene.stop('RiftScene')); await page.waitForTimeout(100);
  const repeat = await page.evaluate(() => window.__r100CreateFailure.read().renderers);
  assert.deepEqual(repeat.map(row => row.destroyCalls), [1, 1]);
  report.closed = { ...closed, savedRaw: undefined, injection: undefined, savedSha256: sha(checkpointRaw), repeatStopDestroyCalls: repeat.map(row => row.destroyCalls) };
  await page.screenshot({ path: path.join(out, '04-controlled-shutdown-title.png') });
  await page.evaluate(() => window.__r100CreateFailure.uninstall());
  await Promise.all(audits);
  assert.equal(report.expectedErrors.length, 1, 'only the injected create failure is expected');
  assert.deepEqual(report.unexpectedErrors, []);
  report.sourceAfter = verifySource();
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failureReason = error.stack ?? String(error); process.exitCode = 1;
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  report.lastProbe = await page.evaluate(() => window.__r100CreateFailure?.read()).catch(() => null);
  console.error(error);
} finally {
  await Promise.all(audits);
  report.loadedSourceHashes = Object.fromEntries([...sourceResponses.entries()].sort());
  write(); await context.close(); await browser.close();
  console.log(JSON.stringify({ status: report.status, expectedErrors: report.expectedErrors.length, unexpectedErrors: report.unexpectedErrors.length, report: path.join(out, 'report.json') }));
}
