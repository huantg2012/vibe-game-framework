/**
 * I30 R5 surface authoring integration. Actual production painters run on isolated
 * offscreen Canvases; their albedo, surface data and baked textures are compared
 * with the live production scene. Diagnostic PNGs are NOT gameplay screenshots.
 *
 * Run serially after sources are frozen:
 * node tools/qa/check-i30-surface-runtime.mjs [--url URL] [--out DIRECTORY]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  url: { type: 'string', default: process.env.I30_URL ?? 'http://127.0.0.1:3025/' },
  out: { type: 'string', default: 'docs/qa/artifacts/iteration-30-r5/surface-runtime' },
} });
const out = values.out;
fs.mkdirSync(out, { recursive: true });
const sourcePaths = [
  'src/art/chamber-pixel-helpers.ts', 'src/art/chamber-exterior-pixels.ts',
  'src/art/chamber-surface-map.ts', 'src/art/purification-chamber-pixels.ts',
  'src/art/chamber-light-field.ts', 'src/art/chamber-floor-light.ts',
  'src/scenes/purification-chamber-visual.ts', 'src/scenes/purification-chamber-lighting.ts',
  'src/scenes/purification-scene.ts', 'src/systems/purification-chamber-layout.ts',
  'tools/qa/check-i30-surface-runtime.mjs',
];
const fingerprint = () => Object.fromEntries(sourcePaths.map(file =>
  [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const errors = [];
const manifest = {
  at: new Date().toISOString(), version: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  url: values.url, sources: fingerprint(), viewport: { width: 1440, height: 960 }, errors,
  method: 'Fresh isolated browser context; production MainMenu -> Purification via real Enter. Read-only live scene probes. Actual production painters imported into separate offscreen Canvases without replacing production methods.',
  scope: [],
  limitations: [
    'Diagnostic PNGs show static production painting inputs/outputs without actor, dynamic light, HUD or final game compositing; they are not gameplay frames.',
    'Normal diagnostic encodes world XYZ into RGB; height diagnostic uses a fixed -32..160 world-pixel scale. These colors are explanatory, not game art.',
    'Per-layer bake durations describe one instrumented browser execution, not FPS, load-time targets or a statistical performance benchmark.',
    'Height labels and visible-surface shading do not prove closed 3D meshes or hidden-surface light transport. Aesthetic approval remains separate.',
  ],
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: manifest.viewport });
const page = await context.newPage();
page.on('pageerror', error => errors.push(String(error)));
await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const cdp = await context.newCDPSession(page);
let profiling = false;

function calls(coverage, name) {
  return coverage.result.filter(script => script.url.includes('/src/art/chamber-surface-map.ts'))
    .flatMap(script => script.functions).filter(fn => fn.functionName === name)
    .reduce((sum, fn) => sum + (fn.ranges[0]?.count ?? 0), 0);
}

async function cachedSnapshot() {
  return page.evaluate(() => {
    const scene = window.__game.scene.getScene('PurificationScene');
    const visual = scene.chamber;
    const hash = values => {
      let result = 2166136261;
      for (let i = 0; i < values.length; i++) result = Math.imul(result ^ values[i], 16777619);
      return (result >>> 0).toString(16).padStart(8, '0');
    };
    return {
      active: scene.scene.isActive(),
      textures: visual.textures.map(key => {
        const texture = scene.textures.get(key);
        return { key, hash: hash(texture.context.getImageData(0, 0, 640, 400).data) };
      }),
      surfaceHash: hash(new Uint8Array(visual.architectureSurfaces.heights.buffer)),
      graphics: scene.children.list.filter(child => child.name?.startsWith('chamber-') && Array.isArray(child.commandBuffer))
        .map(child => ({ name: child.name, commands: child.commandBuffer.length, depth: child.depth })),
    };
  });
}

try {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  profiling = true;
  await page.goto(values.url);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null,
    'An isolated context must not inherit or change user storage');
  await page.keyboard.press('Enter', { delay: 90 });
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1400);
  const productionCoverage = await cdp.send('Profiler.takePreciseCoverage');
  manifest.productionSurfaceModuleUrls = productionCoverage.result
    .filter(script => script.url.includes('/src/art/chamber-surface-map.ts')).map(script => script.url);
  manifest.initialCalls = { bake: calls(productionCoverage, 'bake'), receiverResponse: calls(productionCoverage, 'receiverResponse') };
  assert(manifest.initialCalls.bake >= 9, 'Production creation must bake architecture, exterior, foreground and all six devices');
  assert(manifest.initialCalls.receiverResponse > 0, 'Production light compilation must consume the surface response');

  // This window contains no offscreen fixture calls, input, state change or module patching.
  const idleBefore = await cachedSnapshot();
  await page.waitForTimeout(1500);
  const idleAfter = await cachedSnapshot();
  const idleCoverage = await cdp.send('Profiler.takePreciseCoverage');
  manifest.idle = { durationMs: 1500, bakeCalls: calls(idleCoverage, 'bake'),
    responseCalls: calls(idleCoverage, 'receiverResponse'), before: idleBefore, after: idleAfter };
  assert.equal(manifest.idle.bakeCalls, 0, 'Idle dynamic lighting must not repeatedly bake static textures');
  assert.equal(manifest.idle.responseCalls, 0, 'Idle lighting must replay compiled face responses');
  assert.deepEqual(idleAfter.textures, idleBefore.textures, 'Static cached RGBA stays identical during idle');
  assert.equal(idleAfter.surfaceHash, idleBefore.surfaceHash, 'Static authored heights stay cached during idle');
  await cdp.send('Profiler.stopPreciseCoverage'); profiling = false;
  await cdp.send('Profiler.disable');
  manifest.scope.push('Calibrated production surface bake/response calls; a separate 1.5-second idle window observes zero rebakes/recompiles and identical cached textures/heights');

  const diagnostic = await page.evaluate(async () => {
    const { ChamberSurfaceMap } = await import('/src/art/chamber-surface-map.ts');
    const art = await import('/src/art/purification-chamber-pixels.ts');
    const layout = await import('/src/systems/purification-chamber-layout.ts');
    const scene = window.__game.scene.getScene('PurificationScene');
    const visual = scene.chamber;
    const width = 640, height = 400, count = width * height;
    const failures = [], checks = [], layers = [], images = {};
    const surfaceFields = ['coverage', 'heights', 'normalX', 'normalY', 'normalZ', 'occlusion', 'roughness'];
    const state = { ...visual.deviceState };
    const check = (condition, message, details) => {
      checks.push({ ok: Boolean(condition), message, ...(details === undefined ? {} : { details }) });
      if (!condition) failures.push({ message, details });
    };
    const createCanvas = () => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; };
    const read = canvas => canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const hash = array => {
      let result = 2166136261;
      for (let i = 0; i < array.length; i++) result = Math.imul(result ^ array[i], 16777619);
      return (result >>> 0).toString(16).padStart(8, '0');
    };
    const difference = (a, b) => {
      let count = 0; const examples = [];
      if (a.length !== b.length) return { count: Infinity, examples: [{ lengths: [a.length, b.length] }] };
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
        count++; if (examples.length < 8) examples.push({ index: i, before: a[i], after: b[i] });
      }
      return { count, examples };
    };
    const wholeComposite = createCanvas(), bakedComposite = createCanvas(), normalComposite = createCanvas(), heightComposite = createCanvas();
    const paletteEmission = new Set(['14,74,63', '26,107,92', '26,173,150', '42,230,200', '138,92,42', '196,135,58']);
    // Exercise the public painter composition separately from model coordinates:
    // nested construction restores an already transformed plane, and painted
    // surface finish inherits its host instead of resetting the geometry.
    const primitiveCanvas = createCanvas(), primitiveMap = new ChamberSurfaceMap();
    const primitivePainter = new art.ChamberPixels(primitiveCanvas.getContext('2d'), primitiveMap);
    primitivePainter.translate(100, 100, 32);
    primitivePainter.setPlane({ normal: [0, 0, 1], elevation: 7 });
    primitivePainter.rect(0, 0, 20, 20, '#3a3d42');
    const beforeBlock = primitiveMap.getPlane();
    primitivePainter.block(3, 3, 4, 4, 2);
    check(primitiveMap.getPlane() === beforeBlock, 'A nested block restores the exact already-transformed host plane');
    primitivePainter.rect(20, 20, 1, 1, '#3a3d42');
    check(primitiveMap.heights[120 * width + 120] === 39,
      'Drawing after a translated block applies the outer elevation exactly once');
    primitivePainter.setPlane(null);
    primitivePainter.rect(0, 0, 1, 1, '#8a8f96');
    check(primitiveMap.coverage[100 * width + 100] === 1 && primitiveMap.heights[100 * width + 100] === 39,
      'A real null-plane finish preserves its painted host height');
    primitivePainter.translate(-100, -100, -32);
    function validateLayer(id, paint, requiresSurface = true) {
      const plain = createCanvas(), authored = createCanvas();
      const map = new ChamberSurfaceMap();
      paint(new art.ChamberPixels(plain.getContext('2d')));
      const painter = new art.ChamberPixels(authored.getContext('2d'), map);
      paint(painter);
      const albedo = read(authored), oldAlbedo = read(plain);
      const byteDifference = difference(oldAlbedo, albedo);
      check(byteDifference.count === 0, `${id}: enabling surface authoring leaves every unbaked RGBA byte unchanged`, byteDifference);
      const transform = painter.ctx.getTransform();
      check(transform.a === 1 && transform.b === 0 && transform.c === 0 && transform.d === 1 && transform.e === 0 && transform.f === 0,
        `${id}: painter restores the Canvas transform`, { e: transform.e, f: transform.f });
      let opaque = 0, labelled = 0, eligible = 0, eligibleLabelled = 0, outsideAlpha = 0, badNormal = 0, badHeight = 0;
      const directions = { top: 0, front: 0, left: 0, right: 0, slope: 0 }, bound = [width, height, -1, -1];
      for (let i = 0; i < count; i++) {
        const offset = i * 4;
        const alpha = albedo[offset + 3];
        if (alpha) opaque++;
        const luminance = .2126 * albedo[offset] + .7152 * albedo[offset + 1] + .0722 * albedo[offset + 2];
        if (alpha && luminance > 20) { eligible++; if (map.coverage[i]) eligibleLabelled++; }
        if (!map.coverage[i]) continue;
        labelled++;
        if (!alpha) outsideAlpha++;
        const x = i % width, y = Math.floor(i / width);
        bound[0] = Math.min(bound[0], x); bound[1] = Math.min(bound[1], y); bound[2] = Math.max(bound[2], x); bound[3] = Math.max(bound[3], y);
        const nx = map.normalX[i], ny = map.normalY[i], nz = map.normalZ[i];
        if (Math.abs(Math.hypot(nx, ny, nz) - 1) > 1e-5) badNormal++;
        if (!Number.isFinite(map.heights[i])) badHeight++;
        if (nz > .9) directions.top++;
        if (ny > .8 && Math.abs(nz) < .3) directions.front++;
        if (nx < -.7) directions.left++;
        if (nx > .7) directions.right++;
        if (nz > .1 && nz < .9 && ny > .1) directions.slope++;
      }
      check(outsideAlpha === 0, `${id}: no authored surface escapes actual painted alpha`, { outsideAlpha });
      check(badNormal === 0 && badHeight === 0, `${id}: all authored normals and heights are finite and normalized`, { badNormal, badHeight });
      if (requiresSurface) check(eligible > 0 && eligibleLabelled / eligible >= .9,
        `${id}: at least 90% of visible material has real surface authoring`, { eligible, eligibleLabelled });
      const started = performance.now();
      if (requiresSurface) map.bake(authored.getContext('2d'));
      const bakeMs = performance.now() - started, baked = read(authored);
      let alphaChanged = 0, protectedChanged = 0, protectedCount = 0, changedMaterial = 0;
      for (let i = 0; i < count; i++) {
        const o = i * 4;
        if (albedo[o + 3] !== baked[o + 3]) alphaChanged++;
        const luminance = .2126 * albedo[o] + .7152 * albedo[o + 1] + .0722 * albedo[o + 2];
        const unchanged = albedo[o] === baked[o] && albedo[o + 1] === baked[o + 1] && albedo[o + 2] === baked[o + 2];
        const protectedPixel = !albedo[o + 3] || luminance <= 20
          || paletteEmission.has(`${albedo[o]},${albedo[o + 1]},${albedo[o + 2]}`) || !map.coverage[i];
        if (protectedPixel) { protectedCount++; if (!unchanged) protectedChanged++; }
        else if (!unchanged) changedMaterial++;
      }
      check(alphaChanged === 0 && protectedChanged === 0,
        `${id}: bake preserves every alpha byte, transparent RGB, black cavity, known emissive color and unlabelled pixel`,
        { alphaChanged, protectedChanged, protectedCount, changedMaterial });
      if (requiresSurface) check(changedMaterial > 0, `${id}: baked material actually consumes surface lighting`);
      const normal = createCanvas(), heightCanvas = createCanvas();
      const normalData = normal.getContext('2d').createImageData(width, height), heightData = heightCanvas.getContext('2d').createImageData(width, height);
      for (let i = 0; i < count; i++) {
        if (!map.coverage[i] || !albedo[i * 4 + 3]) continue;
        const o = i * 4;
        normalData.data[o] = (map.normalX[i] * .5 + .5) * 255;
        normalData.data[o + 1] = (map.normalY[i] * .5 + .5) * 255;
        normalData.data[o + 2] = (map.normalZ[i] * .5 + .5) * 255;
        normalData.data[o + 3] = 255;
        const value = Math.max(0, Math.min(255, (map.heights[i] + 32) / 192 * 255));
        heightData.data[o] = value; heightData.data[o + 1] = value; heightData.data[o + 2] = value; heightData.data[o + 3] = 255;
      }
      normal.getContext('2d').putImageData(normalData, 0, 0); heightCanvas.getContext('2d').putImageData(heightData, 0, 0);
      wholeComposite.getContext('2d').drawImage(plain, 0, 0); bakedComposite.getContext('2d').drawImage(authored, 0, 0);
      normalComposite.getContext('2d').drawImage(normal, 0, 0); heightComposite.getContext('2d').drawImage(heightCanvas, 0, 0);
      const summary = { id, opaque, labelled, eligible, eligibleLabelled, bounds: bound, directions, albedoHash: hash(albedo), bakedHash: hash(baked), bakeMs };
      layers.push(summary);
      return { map, albedo, baked, summary };
    }

    validateLayer('exterior', art.paintChamberExterior);
    const architecture = validateLayer('architecture', art.paintChamberArchitecture);
    check(architecture.summary.directions.top > 1000 && architecture.summary.directions.front > 1000
      && architecture.summary.directions.left + architecture.summary.directions.right > 100,
    'Architecture contains independently authored horizontal, front and side faces', architecture.summary.directions);
    const at = (x, y) => {
      const i = y * width + x, map = architecture.map;
      return { x, y, covered: map.coverage[i], z: map.heights[i], normal: [map.normalX[i], map.normalY[i], map.normalZ[i]] };
    };
    const floorProbes = [at(366, 300), at(280, 199)];
    check(floorProbes[0].covered && Math.abs(floorProbes[0].z) < 1e-5, 'Main-floor open material is at world height 0', floorProbes[0]);
    check(floorProbes[1].covered && Math.abs(floorProbes[1].z - 32) < 1e-5, 'Upper-floor open material is at world height 32', floorProbes[1]);
    const rampProbes = [];
    for (const ramp of [{ id: 'central', y0: 224, y1: 266, x0: 282, x1: 304 },
      { id: 'east', y0: 206, y1: 250, x0: 373, x1: 419 }]) {
      const samples = [];
      for (let y = ramp.y0 + 2; y <= ramp.y1 - 2; y++) {
        const t = (y - ramp.y0) / (ramp.y1 - ramp.y0);
        const sample = at(Math.round(ramp.x0 + (ramp.x1 - ramp.x0) * t), y);
        samples.push({ ...sample, expected: 32 * (1 - t) });
      }
      const badHeights = samples.filter(sample => !sample.covered || Math.abs(sample.z - sample.expected) > .01);
      check(badHeights.length === 0, `${ramp.id} ramp has continuous interpolated height through its existing central lane`, badHeights.slice(0, 10));
      const slope = -32 / (ramp.y1 - ramp.y0);
      const inconsistent = samples.filter(sample => Math.abs(sample.normal[1] * (1 + slope) + sample.normal[2] * slope) > .015);
      check(inconsistent.length === 0, `${ramp.id} ramp normals agree with the reconstructed slope tangent`, inconsistent.slice(0, 10));
      rampProbes.push({ id: ramp.id, samples });
    }

    const architectureKey = visual.textures.find(key => key.startsWith('purification-chamber-architecture-'));
    const actualArchitecture = scene.textures.get(architectureKey).context.getImageData(0, 0, width, height).data;
    // Vite can load identical source once with an HMR timestamp through the
    // scene graph and once without it through this explicit diagnostic import.
    // Compare executable implementation, not cross-module constructor identity;
    // every authored array and resulting texture is independently checked below.
    const actualConstructor = visual.architectureSurfaces.constructor;
    const sameSource = actualConstructor.name === ChamberSurfaceMap.name
      && actualConstructor.toString() === ChamberSurfaceMap.toString();
    const sameMethods = ['setPlane', 'stamp', 'bake', 'receiverResponse'].every(method =>
      visual.architectureSurfaces[method].toString() === ChamberSurfaceMap.prototype[method].toString());
    check(sameSource && sameMethods, 'Formal scene and direct import have identical surface constructor and method implementations',
      { constructorName: actualConstructor.name, sameConstructorSource: sameSource, sameMethodSources: sameMethods,
        sharedClassIdentity: visual.architectureSurfaces instanceof ChamberSurfaceMap });
    const actualDifference = difference(architecture.baked, actualArchitecture);
    check(actualDifference.count === 0, 'Live cached architecture RGBA exactly matches an independent production-painter bake', actualDifference);
    for (const field of surfaceFields) {
      const delta = difference(architecture.map[field], visual.architectureSurfaces[field]);
      check(delta.count === 0, `Live architecture ${field} exactly matches independent authored data`, delta);
    }
    validateLayer('grounding', art.paintChamberGrounding, false);
    validateLayer('resistance', painter => art.paintChamberResistance(painter, state), false);
    const deviceReports = [];
    for (const device of [...visual.devices].sort((a, b) => a.image.depth - b.image.depth)) {
      const fixture = validateLayer(device.id, painter => art.paintChamberDevice(painter, device.id, state));
      const actual = device.texture.context.getImageData(0, 0, width, height).data;
      const delta = difference(fixture.baked, actual);
      check(delta.count === 0, `${device.id}: live device texture exactly matches the same state and production painter`, delta);
      const base = layout.CHAMBER_DEVICE_BASES[device.id], bounds = fixture.summary.bounds;
      check(bounds[0] < base.x && bounds[2] > base.x && bounds[1] < base.y && bounds[3] > base.y - 15,
        `${device.id}: surface coverage stays around its actual world-space device base`, { base, bounds });
      // Apply an extra known transform around the real device painter. Its own
      // local drawing and balanced base transform must compose with this one.
      const shiftedCanvas = createCanvas(), shiftedMap = new ChamberSurfaceMap();
      const shiftedPainter = new art.ChamberPixels(shiftedCanvas.getContext('2d'), shiftedMap);
      shiftedPainter.translate(7, 9, 5);
      art.paintChamberDevice(shiftedPainter, device.id, state);
      shiftedPainter.translate(-7, -9, -5);
      const shifted = read(shiftedCanvas);
      let colorDrift = 0, surfaceDrift = 0, shiftedPixels = 0;
      for (let y = 0; y < height - 9; y++) for (let x = 0; x < width - 7; x++) {
        const i = y * width + x, j = (y + 9) * width + x + 7;
        for (let c = 0; c < 4; c++) if (fixture.albedo[i * 4 + c] !== shifted[j * 4 + c]) colorDrift++;
        if (fixture.map.coverage[i] !== shiftedMap.coverage[j]) surfaceDrift++;
        if (!fixture.map.coverage[i]) continue;
        shiftedPixels++;
        if (Math.abs(shiftedMap.heights[j] - fixture.map.heights[i] - 5) > 1e-4) surfaceDrift++;
        for (const field of ['normalX', 'normalY', 'normalZ', 'roughness', 'occlusion']) {
          if (Math.abs(shiftedMap[field][j] - fixture.map[field][i]) > 1e-6) surfaceDrift++;
        }
      }
      check(colorDrift === 0 && surfaceDrift === 0 && shiftedPixels > 0,
        `${device.id}: real painter composes screen translation +7,+9 and world elevation +5 without color/normal drift`,
        { colorDrift, surfaceDrift, shiftedPixels });
      const restored = shiftedPainter.ctx.getTransform();
      check(restored.e === 0 && restored.f === 0, `${device.id}: nested translated painting restores the outer Canvas transform`);
      deviceReports.push({ id: device.id, base, floor: layout.CHAMBER_DEVICE_FLOORS[device.id],
        key: device.texture.key, depth: device.image.depth, colorDrift, surfaceDrift, shiftedPixels });
    }
    validateLayer('foreground', art.paintChamberForeground);
    images['diagnostic-normal-albedo.png'] = wholeComposite.toDataURL('image/png');
    images['diagnostic-normal-baked.png'] = bakedComposite.toDataURL('image/png');
    images['diagnostic-world-normals.png'] = normalComposite.toDataURL('image/png');
    images['diagnostic-world-heights.png'] = heightComposite.toDataURL('image/png');
    check(visual.lighting.emitters.every(emitter => Number.isFinite(emitter.face.elevation)),
      'All production dynamic face sources provide real world elevation');
    check(visual.lighting.devices.length === 6, 'All six production devices have compiled lighting receivers');
    return { checks, failures, layers, state, floorProbes, rampProbes, deviceReports, images,
      production: { architectureKey, architectureInstance: visual.architectureSurfaces.constructor.name,
        dynamicSources: visual.lighting.emitters.map(emitter => ({ id: emitter.id, face: { ...emitter.face }, wallSpans: emitter.wallSpans.length, floorSpans: emitter.floorSpans.length })),
        deviceResponses: visual.lighting.devices.map(device => ({ id: device.id,
          responses: device.responses.map(response => ({ emitter: response.emitter.id, spans: response.spans.length })) })) } };
  });
  for (const [name, dataUrl] of Object.entries(diagnostic.images)) {
    fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  const imageNames = Object.keys(diagnostic.images); delete diagnostic.images;
  manifest.diagnostic = diagnostic;
  manifest.diagnosticImages = imageNames;
  manifest.scope.push('Actual production painter with/without surface tracking gives identical unbaked RGBA; coverage/alpha, normals, two floors, both ramp height sequences and bake preservation are checked');
  manifest.scope.push('Independent production-painter architecture data and all six baked device textures are compared against the live scene; nested device translation validates coordinate and elevation composition');
  assert.deepEqual(diagnostic.failures, [], 'Surface authoring integration invariants failed; inspect manifest diagnostic failures');
  assert.deepEqual(errors, [], 'Browser runtime must have no uncaught errors');
  manifest.endingSources = fingerprint();
  assert.deepEqual(manifest.endingSources, manifest.sources, 'Sources changed during observation; rerun after authoring freezes');
  manifest.ok = true;
} catch (error) {
  manifest.ok = false;
  manifest.failure = String(error);
  await page.screenshot({ path: path.join(out, 'failure-gameplay.png') }).catch(() => {});
  throw error;
} finally {
  if (profiling) await cdp.send('Profiler.stopPreciseCoverage').catch(() => {});
  manifest.endingSources = fingerprint();
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await cdp.detach().catch(() => {});
  await context.close(); await browser.close();
}
console.log(JSON.stringify({ ok: manifest.ok, out, checks: manifest.diagnostic?.checks.length,
  images: manifest.diagnosticImages, scope: manifest.scope }, null, 2));
