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
console.log(JSON.stringify({ status: 'pass', checks, changedPixels: changed,
  scope: 'DEV optical math/query/VOID contracts only; colour, motion quality and performance need real-scene review.' }, null, 2));
