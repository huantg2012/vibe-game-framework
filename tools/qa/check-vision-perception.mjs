/** Bounded math/query regression. No browser, player record, or full-world generation. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `export * from './src/systems/vision-perception.ts';
    export * from './src/systems/visibility-system.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
  define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'unused-phaser', setup(builder) {
    builder.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  } }],
});
const { VisibilitySystem, createRiftVisionConfig, perceptionTransmission, perceptionVeil,
  advancePerceptionTime, rebuildPerceptionField, paintPerceptionField } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const checks = [];
const check = (name, predicate) => { assert(predicate, name); checks.push(name); };

for (const range of [48, 80, 123.2, 224, 336]) {
  let previous = Infinity;
  for (let distance = 0; distance <= range + 4; distance += 0.25) {
    const value = perceptionTransmission(distance, range, 48);
    assert(value >= 0 && value <= 1 && value <= previous, `bounded monotonic falloff ${range}/${distance}`);
    if (distance >= range) assert.equal(value, 0);
    previous = value;
  }
}
checks.push('bounded monotonic attenuation; exact zero at/outside every range');
check('elapsed time freezes at zero delta', advancePerceptionTime(1234, 0) === 1234);
check('invalid/negative delta cannot reverse or corrupt time', advancePerceptionTime(1234, -8) === 1234 && advancePerceptionTime(1234, NaN) === 1234);
check('deterministic world-space veil', perceptionVeil(100, 200, 3000) === perceptionVeil(100, 200, 3000));

// Use the real class query and DDA, with a wall through the front sector.
const grid = { cols: 128, rows: 128, tileSize: 8, version: 1, isOpaque: (col, row) => col === 30 && row >= 8 && row <= 26 };
const vision = new VisibilitySystem();
vision.config = createRiftVisionConfig(); vision.occluders = grid;
vision.setRayCounts(vision.config.rayCountForward, vision.config.rayCountAmbient);
vision.render = () => {}; // Renderer needs Phaser; all gameplay/query computation remains real.
vision.update({ x: 160, y: 160 }, 0, 16);
check('normal config keeps legacy default', vision.getPresentation() === 'legacy' && vision.config.presentation === undefined);
const points = Array.from({ length: 180 }, (_, i) => ({ x: 160 + Math.cos(i * 0.41) * (i * 2), y: 160 + Math.sin(i * 0.41) * (i * 2) }));
const before = points.map(point => vision.getVisibilityAt(point));
const revision = vision.getQueryRevision();
vision.setPresentation('perceptual'); vision.update({ x: 160, y: 160 }, 0, 0);
assert.deepEqual(points.map(point => vision.getVisibilityAt(point)), before);
check('presentation switch preserves tactical query revision', vision.getQueryRevision() === revision);
check('VOID blocks actual tactical query', vision.getVisibilityAt({ x: 270, y: 160 }) === 0);
vision.setPresentation('legacy');
assert.deepEqual(points.map(point => vision.getVisibilityAt(point)), before);
checks.push('both directions of mode switch preserve 180 tactical samples');

const width = 256, height = 192, field = new Float32Array(width * height);
const raster = { width, height, worldX: 0, worldY: 0, originX: 160, originY: 160, clearRadius: 24,
  maximumRange: 224, rangeAt: angle => vision.getEffectiveRadius(angle),
  lineOfSightAt: (x, y) => vision.getVisibilityAt({ x, y }) > 0 };
const start = performance.now();
rebuildPerceptionField(field, raster, { cornerVisibility: new Uint8Array((width + 1) * (height + 1)) });
const geometryMs = performance.now() - start;
let visibleCells = 0;
for (let i = 0; i < field.length; i++) {
  if (!field[i]) continue;
  visibleCells++;
  const point = { x: (i % width + 0.5) * 2, y: (Math.floor(i / width) + 0.5) * 2 };
  assert(vision.getVisibilityAt(point) > 0, 'texture cannot reveal a tactically hidden cell');
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    assert(vision.getVisibilityAt({ x: point.x + dx, y: point.y + dy }) > 0, 'visible texel corner must respect range and VOID');
  }
}
check('texture has nonempty visible field', visibleCells > 1000);
check('occluded wall-back cells remain zero', field[80 * width + 135] === 0);
const data = new Uint8ClampedArray(field.length * 4);
const paint = { width, worldX: 0, worldY: 0, originX: 160, originY: 160, clearRadius: 24,
  corruption: 1, elapsedMs: 3000, voidColor: 0x080a0c, contaminationColor: 0x1aad96 };
paintPerceptionField(data, field, paint);
const frozen = data.slice();
paintPerceptionField(data, field, { ...paint, elapsedMs: advancePerceptionTime(paint.elapsedMs, 0) });
assert.deepEqual(data, frozen); checks.push('paused texture pixels remain identical');
for (let i = 0; i < field.length; i++) if (field[i] === 0) assert.equal(data[i * 4 + 3], 255);
checks.push('unknown/VOID cells stay opaque even at full contamination');
check('body safety region stays clear', data[(80 * width + 80) * 4 + 3] === 0);
paintPerceptionField(data, field, { ...paint, elapsedMs: 6000 });
let changedPixels = 0;
for (let i = 0; i < field.length; i++) if (data[i * 4 + 3] !== frozen[i * 4 + 3]) changedPixels++;
check('three seconds produce local moving deposits', changedPixels > 100);
console.log(JSON.stringify({ status: 'pass', checks, visibleCells, changedPixels, geometryMs: +geometryMs.toFixed(3),
  scope: 'Display math plus real query/LOS and toggle contract; browser art/performance reviewed separately.' }, null, 2));
