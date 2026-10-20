/** Bounded independent art-study contract; no save writes or world generation. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({
  stdin: { contents: `export * from './src/systems/vision-light-eater.ts';
    export * from './src/systems/vision-perception.ts';
    export * from './src/systems/visibility-system.ts';
    export * from './src/utils/grid-raycast.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'unused-phaser', setup(builder) {
    builder.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);
const checks = [];
function check(name, condition) { assert(condition, name); checks.push(name); }
const state = { pollution: 0, assimilation: 0, lampX: 160, lampY: 160, bodyX: 160, bodyY: 160, elapsedMs: 3000 };
const sample = api.createLightEaterSample();
check('P alone shrinks physical shoulder light', api.lightEaterLampRadius(0) === 232 && api.lightEaterLampRadius(100) === 132);
check('A recovery stays inside clean-lamp extent', api.lightEaterExtent(100, 100) === 232);
check('normal mid-field stays readable before light consumption', api.sampleLightEater(sample, 260, 160, state).warm > 0.8);
state.pollution = 100;
const warmAtHighP = api.sampleLightEater(sample, 250, 160, state).warm;
const ordinaryOuter = api.sampleLightEater(sample, 330, 160, state).transmission;
state.assimilation = 100;
check('A does not recover warm light', api.sampleLightEater(sample, 250, 160, state).warm === warmAtHighP);
const adaptedOuter = api.sampleLightEater(sample, 330, 160, state);
check('A recovers a separate dim cold signal', ordinaryOuter === 0 && adaptedOuter.warm === 0 && adaptedOuter.cold > 0.25 && adaptedOuter.cold < 0.58);
check('reaction vanishes when no warm light remains', adaptedOuter.reaction === 0);

// Sweep every integer P and multiple world-space phases. A preset-only check
// would miss discontinuities between the screenshots used for art review.
const sweepSample = api.createLightEaterSample(), previousSample = api.createLightEaterSample();
const fields = ['warm', 'cold', 'transmission', 'reaction', 'residue'];
let maximumPollutionStep = 0, maximumTimeStep = 0, minimumSaturatedNear = 1, maximumSaturatedNear = 0;
for (const anchor of [[160, 160], [730, 415], [-250, 330]]) {
  const sweepState = { ...state, lampX: anchor[0], lampY: anchor[1], bodyX: anchor[0], bodyY: anchor[1] };
  for (const elapsedMs of [0, 3000, 11250]) for (const assimilation of [0, 80, 100]) {
    Object.assign(sweepState, { pollution: 0, assimilation, elapsedMs });
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) for (const radius of [0, 10, 21, 32, 60, 90, 130, 170, 210, 231]) {
      const x = anchor[0] + Math.cos(angle) * radius, y = anchor[1] + Math.sin(angle) * radius;
      sweepState.pollution = 0;
      api.sampleLightEater(previousSample, x, y, sweepState);
      for (let p = 1; p <= 100; p++) {
        sweepState.pollution = p;
        api.sampleLightEater(sweepSample, x, y, sweepState);
        for (const field of fields) {
          assert(Number.isFinite(sweepSample[field]) && sweepSample[field] >= 0 && sweepSample[field] <= 1);
          maximumPollutionStep = Math.max(maximumPollutionStep, Math.abs(sweepSample[field] - previousSample[field]));
        }
        if (radius <= 60) assert(sweepSample.warm <= previousSample.warm + 1e-12, `near-field brightened at P=${p}`);
        Object.assign(previousSample, sweepSample);
      }
      if (radius <= 21) {
        minimumSaturatedNear = Math.min(minimumSaturatedNear, sweepSample.warm);
        maximumSaturatedNear = Math.max(maximumSaturatedNear, sweepSample.warm);
        assert.equal(sweepSample.transmission, sweepSample.warm, 'A cannot restore the near-field comfort brightness');
      }
    }
  }
}
check('every adjacent 1% pollution transition remains bounded without tier jumps', maximumPollutionStep < 0.04);
checks.push('near-field absorption is monotonic over all 101 pollution values');
check('saturation absorbs underfoot without a protected bright disc', minimumSaturatedNear > 0.48 && maximumSaturatedNear < 0.71);
checks.push('A does not exempt the near field from absorption');
let previousReceived = api.lightEaterReceivedLight(0);
check('received-light endpoints reduce real surface highlights', previousReceived === 1 && Math.abs(api.lightEaterReceivedLight(100) - 0.68) < 1e-12);
for (let p = 1; p <= 100; p++) {
  const received = api.lightEaterReceivedLight(p);
  assert(received <= previousReceived && previousReceived - received < 0.005);
  previousReceived = received;
}
checks.push('received-light response is monotonic with bounded 1% changes');

// Probe former 50 ms boundaries with sub-millisecond steps: quantized animation
// time or a P-threshold branch would produce a finite jump at one of these cuts.
for (const p of [0, 25, 55, 100]) for (const time of [50, 3000, 11250]) {
  const continuousState = { ...state, pollution: p, assimilation: 80 };
  for (let x = 20; x <= 360; x += 17) for (let y = 20; y <= 360; y += 17) {
    api.sampleLightEater(previousSample, x, y, { ...continuousState, elapsedMs: time - 0.001 });
    api.sampleLightEater(sweepSample, x, y, { ...continuousState, elapsedMs: time + 0.001 });
    for (const field of fields) maximumTimeStep = Math.max(maximumTimeStep, Math.abs(sweepSample[field] - previousSample[field]));
    for (const threshold of [25, 50, 75, 100]) {
      api.sampleLightEater(previousSample, x, y, { ...continuousState, elapsedMs: time, pollution: threshold - 0.00001 });
      api.sampleLightEater(sweepSample, x, y, { ...continuousState, elapsedMs: time, pollution: threshold + 0.00001 });
      for (const field of fields) assert(Math.abs(sweepSample[field] - previousSample[field]) < 1e-6, `discontinuous P=${threshold} ${field}`);
    }
  }
}
check('time and pollution fields are continuous across former frame/tier boundaries', maximumTimeStep < 0.00001);

// Sample annular means, not individual rays: local drifting pockets are intended,
// but a coherent darker band must not separate the warm core from A's outer
// material signal. This catches a late cold-signal onset even with continuous P.
let maximumAnnularRebound = 0;
for (const [x, y] of [[1132, 1324], [160, 160], [730, 415]]) {
  for (const elapsedMs of [0, 10000, 22500]) for (const pollution of [70, 80, 90, 100]) for (const assimilation of [60, 80, 100]) {
    const annularState = { pollution, assimilation, lampX: x, lampY: y, bodyX: x, bodyY: y, elapsedMs };
    const radius = api.lightEaterLampRadius(pollution);
    let lowestInnerMean = Infinity;
    for (let step = 0; step <= 13; step++) {
      const distance = radius * (0.5 + step * 0.05);
      let mean = 0;
      for (let angle = 0; angle < 72; angle++) {
        mean += api.sampleLightEater(sweepSample, x + distance * Math.cos(angle * Math.PI / 36),
          y + distance * Math.sin(angle * Math.PI / 36), annularState).transmission / 72;
      }
      lowestInnerMean = Math.min(lowestInnerMean, mean);
      maximumAnnularRebound = Math.max(maximumAnnularRebound, mean - lowestInnerMean);
    }
  }
}
check('warm-to-cold recognition has no coherent dark annulus', maximumAnnularRebound < 0.03);
for (const p of [0, 25, 55, 100]) for (const a of [0, 50, 100]) {
  state.pollution = p; state.assimilation = a;
  const radius = api.lightEaterExtent(p, a);
  for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
    assert.equal(api.sampleLightEater(sample, 160 + Math.cos(angle) * (radius + 1), 160 + Math.sin(angle) * (radius + 1), state).transmission, 0);
  }
}
checks.push('all 12 P/A endpoint combinations keep finite range');

const grid = { cols: 128, rows: 128, tileSize: 8, version: 1,
  isOpaque: (col, row) => col === 30 && row >= 8 && row <= 30 };
const vision = new api.VisibilitySystem();
vision.config = api.createRiftVisionConfig(); vision.occluders = grid;
vision.setRayCounts(vision.config.rayCountForward, vision.config.rayCountAmbient);
vision.render = () => {};
vision.update({ x: 160, y: 160 }, 0, 16);
const baseline = [{ x: 200, y: 160 }, { x: 60, y: 160 }, { x: 160, y: 40 }].map(p => vision.getVisibilityAt(p));
vision.setPresentation('light-eater'); vision.setLightEaterState(55, 80, { x: 160, y: 160 });
vision.update({ x: 160, y: 160 }, 0, 0);
const points = Array.from({ length: 60 }, (_, i) => ({ x: 160 + Math.cos(i * 0.2) * 150, y: 160 + Math.sin(i * 0.2) * 150 }));
const facingZero = points.map(p => vision.getVisibilityAt(p));
vision.update({ x: 160, y: 160 }, Math.PI, 0);
assert.deepEqual(points.map(p => vision.getVisibilityAt(p)), facingZero);
checks.push('new field does not inherit old facing cone');
check('VOID remains opaque to new queries', vision.getVisibilityAt({ x: 270, y: 160 }) === 0);
vision.setPresentation('legacy'); vision.update({ x: 160, y: 160 }, 0, 0);
assert.deepEqual([{ x: 200, y: 160 }, { x: 60, y: 160 }, { x: 160, y: 40 }].map(p => vision.getVisibilityAt(p)), baseline);
checks.push('switching back restores legacy queries');

const width = 256, height = 192, admission = new Float32Array(width * height);
const origin = { x: 160, y: 160 }, target = { x: 0, y: 0 };
api.rebuildPerceptionField(admission, { width, height, worldX: 0, worldY: 0, originX: 160, originY: 160,
  clearRadius: 24, maximumRange: 272, rangeAt: () => 272,
  lineOfSightAt: (x, y) => { target.x = x; target.y = y; return api.hasLineOfSight(grid, origin, target); },
}, { cornerVisibility: new Uint8Array((width + 1) * (height + 1)) });
const pixels = new Uint8ClampedArray(admission.length * 4), transmission = new Float32Array(admission.length);
const paint = { ...state, pollution: 100, assimilation: 100, width, worldX: 0, worldY: 0 };
api.paintLightEater(pixels, admission, transmission, paint, sample);
for (let i = 0; i < admission.length; i++) if (admission[i] === 0) {
  assert.equal(pixels[i * 4 + 3], 255); assert.equal(transmission[i], 0);
}
checks.push('new mask never reveals unavailable or VOID cells');
const paused = pixels.slice(); api.paintLightEater(pixels, admission, transmission, paint, sample);
assert.deepEqual(pixels, paused); checks.push('paused optical sample is exactly stable');
api.paintLightEater(pixels, admission, transmission, { ...paint, elapsedMs: paint.elapsedMs + 3000 }, sample);
let changed = 0;
for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] !== paused[i + 1] || pixels[i + 3] !== paused[i + 3]) changed++;
check('three seconds visibly alter local light consumption', changed > 500);
console.log(JSON.stringify({ status: 'pass', checks, changedPixels: changed, maximumPollutionStep, maximumTimeStep, maximumAnnularRebound,
  saturatedNearTransmission: [minimumSaturatedNear, maximumSaturatedNear],
  scope: 'DEV optical math/query/VOID contracts only; colour, motion quality and performance need real-scene review.' }, null, 2));
