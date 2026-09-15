/** Real WebGL startup/disposal regression in an isolated synthetic context.
 * This deliberately injects factory failures. It is not normal-play evidence.
 * Requires the dev server; defaults to the iteration-23 review server on 3007.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const origin = process.env.STAGE_TEST_ORIGIN ?? 'http://127.0.0.1:3007';
const output = process.env.STAGE_TEST_OUTPUT ?? '/private/tmp/coh-i23-stage-startup.json';
const sourceRoot = process.env.SOURCE_ROOT ?? process.cwd();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['src/dev/spatial-study/stage/presentation.ts', 'src/dev/spatial-study/stage/materials.ts',
  'src/dev/spatial-study/stage/actors.ts', 'src/dev/living-landmass/world.ts', 'tools/living-landmass/check-stage-startup.mjs'];
const sources = () => Promise.all(sourceFiles.map(async file => ({ file, sha256: digest(await readFile(path.join(sourceRoot, file))) })));
const result = { schema: 1, startedAt: new Date().toISOString(), origin,
  method: 'Actual Three/WebGL StagePresentation with synthetic frame/DOM/sight. Factory exceptions and resource instrumentation are injected. No game scene or player save is modified; this is startup lifecycle evidence only.',
  cases: [], errors: [], resourceFailures: [], sourceBefore: await sources() };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
let browser;
try {
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: 1100, height: 750 } });
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) result.resourceFailures.push({ url: response.url(), status: response.status() }); });
  await page.route('**/__stage-startup-probe', route => route.fulfill({ status: 200, contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="host" style="position:relative;width:960px;height:640px"><canvas id="original" width="960" height="640" style="opacity:0.73;width:960px;height:640px"></canvas></div></body></html>' }));
  await page.goto(`${origin}/__stage-startup-probe`);
  const moduleResponse = await page.request.get(`${origin}/src/dev/spatial-study/stage/presentation.ts`);
  assert.equal(moduleResponse.status(), 200, 'Dev server must expose the actual production module');
  const moduleText = await moduleResponse.text();
  const threeUrl = moduleText.match(/from\s*["']([^"']*three[^"']*)["']/)?.[1];
  assert(threeUrl, 'Resolve the exact Three module used by Stage; do not create a second copy');
  result.cases = await page.evaluate(async ({ threeUrl }) => {
    const THREE = await import(threeUrl);
    const { StagePresentation } = await import('/src/dev/spatial-study/stage/presentation.ts');
    const { StageVisibility } = await import('/src/dev/spatial-study/stage/terrain.ts');
    const { createPresentationFrame } = await import('/src/dev/spatial-study/stage/bridge.ts');
    const { createLivingLandmassWorld } = await import('/src/dev/living-landmass/world.ts');
    const original = document.querySelector('#original');
    const initialOpacity = original.style.opacity;
    const cases = [];
    let current = null;
    const geometryOwners = new WeakMap();
    const observerOwners = new WeakMap();
    const canvasOwners = new WeakMap();
    const NativeResizeObserver = window.ResizeObserver;
    const originalSetAttribute = THREE.BufferGeometry.prototype.setAttribute;
    const originalSetIndex = THREE.BufferGeometry.prototype.setIndex;
    const originalGeometryDispose = THREE.BufferGeometry.prototype.dispose;
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const webglEvents = new Set(['webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror']);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const trackGeometry = geometry => {
      if (current && !geometryOwners.has(geometry)) {
        geometryOwners.set(geometry, current);
        current.geometries.set(geometry.uuid, { geometry, disposals: 0, allocationStack: new Error().stack ?? '' });
      }
    };
    THREE.BufferGeometry.prototype.setAttribute = function (...args) { trackGeometry(this); return originalSetAttribute.apply(this, args); };
    THREE.BufferGeometry.prototype.setIndex = function (...args) { trackGeometry(this); return originalSetIndex.apply(this, args); };
    THREE.BufferGeometry.prototype.dispose = function (...args) {
      const owner = geometryOwners.get(this);
      if (owner) owner.geometries.get(this.uuid).disposals++;
      return originalGeometryDispose.apply(this, args);
    };
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback) {
        super(callback);
        if (current) { observerOwners.set(this, current); current.observers.push({ observer: this, observations: 0, disconnections: 0 }); }
      }
      observe(...args) {
        const owner = observerOwners.get(this), row = owner?.observers.find(item => item.observer === this);
        if (row) row.observations++;
        return super.observe(...args);
      }
      disconnect() {
        const owner = observerOwners.get(this), row = owner?.observers.find(item => item.observer === this);
        if (row) row.disconnections++;
        return super.disconnect();
      }
    };
    EventTarget.prototype.addEventListener = function (type, listener, ...rest) {
      if (current && this instanceof HTMLCanvasElement && webglEvents.has(type)) {
        if (!canvasOwners.has(this)) {
          canvasOwners.set(this, current);
          current.canvases.push({ canvas: this, gl: null, listeners: new Map(), removed: 0 });
        }
        const owner = canvasOwners.get(this), row = owner.canvases.find(item => item.canvas === this);
        if (!row.listeners.has(type)) row.listeners.set(type, new Set());
        row.listeners.get(type).add(listener);
      }
      return originalAddEventListener.call(this, type, listener, ...rest);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, ...rest) {
      const owner = canvasOwners.get(this), row = owner?.canvases.find(item => item.canvas === this);
      if (row && webglEvents.has(type) && row.listeners.get(type)?.delete(listener)) row.removed++;
      return originalRemoveEventListener.call(this, type, listener, ...rest);
    };
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = originalGetContext.apply(this, args);
      if (current && (args[0] === 'webgl2' || args[0] === 'webgl' || args[0] === 'experimental-webgl') && gl) {
        if (!canvasOwners.has(this)) {
          canvasOwners.set(this, current);
          current.canvases.push({ canvas: this, gl: null, listeners: new Map(), removed: 0 });
        }
        const owner = canvasOwners.get(this), row = owner.canvases.find(item => item.canvas === this);
        row.gl = gl;
      }
      return gl;
    };

    async function runCase(mode) {
      const record = { mode, geometries: new Map(), observers: [], canvases: [], terrainDestroyed: 0,
        projector: null, primaryPreserved: false, cleanupExceptionInjected: false, normalConstructed: false };
      current = record;
      const beforeCount = document.querySelectorAll('canvas[data-spatial-stage]').length;
      const world = createLivingLandmassWorld(7), frame = createPresentationFrame();
      Object.assign(frame.player.position, world.layout.spawnPoint);
      Object.assign(frame.player, { hp: 100, maxHp: 100 });
      Object.assign(frame.exit.position, world.layout.extractionPoint.position);
      frame.exit.radius = world.layout.extractionPoint.triggerRadius;
      const context = { scene: { game: { canvas: original, loop: { delta: 16 } } }, layout: world.layout,
        visibilityAt: () => 1, readPresentationFrame: () => frame,
        setWorldProjector: projector => { record.projector = projector; } };
      const primary = new Error(`expected ${mode} factory failure`);
      const cleanup = new Error('expected terrain cleanup failure');
      let stage = null;
      const options = { sea: false, camera: 'follow',
        createTerrain: () => {
          if (mode === 'terrain-throws') throw primary;
          const group = new THREE.Group(), visibility = new StageVisibility(context, world.width, world.height,
            (x, y) => world.isFloor(x, y));
          const geometry = new THREE.PlaneGeometry(96, 96);
          geometry.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x5a5550 }));
          mesh.position.set(world.layout.spawnPoint.x, 0, world.layout.spawnPoint.y);
          group.add(mesh);
          return { group, visibility, update: time => visibility.update(time), snapshot: () => ({}),
            destroy: () => {
              record.terrainDestroyed++;
              visibility.destroy();
              if (mode === 'attachment-throws-cleanup-throws') {
                record.cleanupExceptionInjected = true;
                throw cleanup;
              }
            } };
        },
        createAttachment: () => {
          if (mode === 'attachment-throws-cleanup-throws') throw primary;
          return undefined;
        } };
      try {
        try {
          stage = new StagePresentation(context, world, options);
          record.normalConstructed = true;
          check(mode === 'normal-repeat-destroy' || mode === 'normal-after-failures', `${mode}: missing injected failure`);
          check(document.querySelectorAll('canvas[data-spatial-stage]').length === beforeCount + 1, `${mode}: Stage canvas missing`);
          check(original.style.opacity === '0', `${mode}: Stage did not own output`);
          check(typeof record.projector === 'function', `${mode}: projector missing`);
          check(stage.snapshot().drawCalls > 0, `${mode}: normal construction did not draw a real frame`);
          stage.destroy();
          const first = [...record.geometries.values()].reduce((sum, row) => sum + row.disposals, 0);
          stage.destroy();
          check([...record.geometries.values()].reduce((sum, row) => sum + row.disposals, 0) === first, `${mode}: duplicate geometry disposal`);
        } catch (error) {
          if (mode === 'normal-repeat-destroy' || mode === 'normal-after-failures') throw error;
          check(error === primary, `${mode}: cleanup replaced the original construction error: ${String(error)}`);
          record.primaryPreserved = true;
        }
        // WebGL context loss is an actual browser signal; allow its event turn
        // to finish before checking another renderer can start on this page.
        await new Promise(resolve => setTimeout(resolve, 30));
        check(document.querySelectorAll('canvas[data-spatial-stage]').length === beforeCount, `${mode}: leaked Stage canvas`);
        check(original.style.opacity === initialOpacity, `${mode}: lost original Phaser opacity`);
        check(record.projector === null, `${mode}: leaked projector`);
        check(record.observers.length === 1, `${mode}: expected one real ResizeObserver`);
        check(record.observers.every(row => row.observations === 1 && row.disconnections === 1), `${mode}: observer remains connected`);
        check(record.geometries.size > 0, `${mode}: player geometry instrumentation did not run`);
        // Three creates a CPU-only VSM full-screen triangle inside each
        // WebGLShadowMap, even though Stage uses PCF shadows. It is owned by
        // the renderer closure, not the Stage scene, and has no public dispose
        // hook. Recognize only that exact allocation and shape. The real GL
        // context/lifecycle assertions below still cover renderer resources.
        const rendererGeometry = [...record.geometries.values()].filter(row => /\bWebGLShadowMap\b/.test(row.allocationStack));
        const shadowTriangle = [-1, -1, .5, 3, -1, .5, -1, 3, .5];
        check(rendererGeometry.length === 1 && rendererGeometry.every(row => {
          const position = row.geometry.getAttribute('position');
          return position?.count === 3 && shadowTriangle.every((value, index) => position.array[index] === value);
        }), `${mode}: unexpected renderer-owned geometry; revisit ownership instrumentation`);
        const stageGeometry = [...record.geometries.values()].filter(row => !rendererGeometry.includes(row));
        check(stageGeometry.length >= 2, `${mode}: expected player and contact-shadow geometry`);
        const undisposed = stageGeometry.filter(row => row.disposals === 0);
        check(undisposed.length === 0, `${mode}: leaked Stage geometry ${undisposed.map(row => `${row.geometry.type} ${row.geometry.uuid}\n${row.allocationStack}`).join('\n')}`);
        check(record.canvases.length === 1 && record.canvases[0].gl, `${mode}: expected a real WebGL renderer context`);
        for (const row of record.canvases) {
          check(row.gl.isContextLost(), `${mode}: renderer did not release its WebGL context`);
          check(!row.canvas.isConnected, `${mode}: renderer canvas still attached`);
          check(row.removed >= 3 && [...row.listeners.values()].every(listeners => listeners.size === 0), `${mode}: renderer.dispose did not remove its context listeners`);
        }
        check(record.terrainDestroyed === (mode === 'terrain-throws' ? 0 : 1), `${mode}: terrain ownership was not released once`);
        return { mode, passed: true, primaryPreserved: record.primaryPreserved,
          cleanupExceptionInjected: record.cleanupExceptionInjected, normalConstructed: record.normalConstructed,
          geometryCount: stageGeometry.length, geometryDisposals: stageGeometry.reduce((sum, row) => sum + row.disposals, 0),
          rendererOwnedCpuGeometryCount: rendererGeometry.length,
          observerCount: record.observers.length, observerDisconnections: record.observers[0].disconnections,
          rendererCount: record.canvases.length, rendererContextListenersRemoved: record.canvases[0].removed,
          contextLost: record.canvases[0].gl.isContextLost(), canvasCountBefore: beforeCount,
          canvasCountAfter: document.querySelectorAll('canvas[data-spatial-stage]').length,
          restoredOpacity: original.style.opacity, terrainDestroyed: record.terrainDestroyed };
      } finally {
        if (stage) stage.destroy();
        current = null;
      }
    }
    try {
      for (const mode of ['terrain-throws', 'attachment-throws-cleanup-throws', 'normal-after-failures', 'normal-repeat-destroy']) {
        cases.push(await runCase(mode));
      }
      return cases;
    } finally {
      THREE.BufferGeometry.prototype.setAttribute = originalSetAttribute;
      THREE.BufferGeometry.prototype.setIndex = originalSetIndex;
      THREE.BufferGeometry.prototype.dispose = originalGeometryDispose;
      window.ResizeObserver = NativeResizeObserver;
      EventTarget.prototype.addEventListener = originalAddEventListener;
      EventTarget.prototype.removeEventListener = originalRemoveEventListener;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  }, { threeUrl });
  assert.equal(result.cases.length, 4);
  assert(result.cases.every(row => row.passed));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.resourceFailures, []);
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] }, 'Isolated lifecycle checks must not write any game record');
  result.sourceAfter = await sources();
  assert.deepEqual(result.sourceAfter, result.sourceBefore, 'Source changed during this startup regression');
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.failure = error instanceof Error ? error.stack ?? error.message : String(error);
  throw error;
} finally {
  result.finishedAt = new Date().toISOString();
  await browser?.close();
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ passed: result.passed, method: 'isolated real-WebGL startup lifecycle only',
    cases: result.cases, errors: result.errors, resourceFailures: result.resourceFailures, output }, null, 2));
}
