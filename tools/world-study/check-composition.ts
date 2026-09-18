/** I26 contracts: recipe freedom, regional controls, pixel ownership and body support. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { generateWorldSample, worldSpaceDiagnostics } from '../../src/generation/world-study/layout';
import { renderWorldSurface } from '../../src/generation/world-study/surface';
import { buildSurfaceFields, validateSurfaceRecipe } from '../../src/generation/world-study/surface-field';
import { canStandWorld, getWorldSupportGrid, worldSupportAt } from '../../src/generation/world-study/support';
import type { WorldProfile, WorldSample, SurfaceRecipe } from '../../src/generation/world-study/types';

const started = performance.now();
const records: unknown[] = [];
const digest = (pixels: Uint8ClampedArray) => createHash('sha256').update(pixels).digest('hex');
function windowOf(sample: WorldSample): WorldSample {
  const cols = 40, rows = 32, left = 30, top = 24;
  const crop = <T extends Uint8Array | Float32Array>(source: T): T => {
    const result = new (source.constructor as { new(length: number): T })(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) result[y * cols + x] = source[(y + top) * sample.cols + x + left]!;
    return result;
  };
  return { ...sample, cols, rows, land: crop(sample.land), walls: crop(sample.walls),
    flowAngle: crop(sample.flowAngle), deposition: crop(sample.deposition), formations: [] };
}
function measure(sample: WorldSample) {
  const surface = renderWorldSurface(sample), { rgba, width, height } = surface;
  let supported = 0, saturated = 0, colored = 0, dark = 0, chromaTotal = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!;
    assert.equal(rgba[i + 3], 255);
    if (!worldSupportAt(sample, x, y)) { assert.equal(r + g + b, 0, 'VOID acquired material'); continue; }
    supported++; const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max ? (max - min) / max : 0;
    chromaTotal += c; if (c > .35) saturated++; if (r !== g || g !== b) colored++;
    if (max < 48) dark++;
  }
  return { hash: digest(rgba), supported, saturationShare: saturated / supported,
    meanChroma: chromaTotal / supported, colored, darkShare: dark / supported };
}
// Holdout seeds were not the scene-tuning seed 70421 or the old next-R sample.
for (const profile of WORLD_PROFILES) for (const topology of ['loops', 'channels'] as const) {
  const seed = topology === 'loops' ? 15485863 : 32452843;
  const sample = generateWorldSample(profile, topology, seed);
  assert(canStandWorld(sample, sample.spawn.x, sample.spawn.y));
  assert(canStandWorld(sample, sample.exit.x, sample.exit.y));
  assert(worldSpaceDiagnostics(sample)?.quality.bodyRoute, 'No fully swept native-sized route');
  const support = getWorldSupportGrid(sample);
  assert.equal(support.tileSize, 8);
  const stats = measure(windowOf(sample));
  if (profile.id === 'ash-strata') assert.equal(stats.colored, 0, 'Monochrome was tinted globally');
  if (['carmine-lacquer', 'cobalt-gold'].includes(profile.id)) assert(stats.saturationShare > .6, 'High-chroma recipe was globally desaturated');
  records.push({ world: profile.id, topology, seed, attempt: worldSpaceDiagnostics(sample)?.attempt, ...stats });
}
const base = WORLD_PROFILES.find(row => row.id === 'cobalt-gold')!;
const geometry = windowOf(generateWorldSample(base, 'loops', 49979687));
const profile = (surface: SurfaceRecipe, id = 'anonymous-unseen') => ({ ...base, id, surface });
const sampleWith = (p: WorldProfile) => ({ ...geometry, profile: p });
const recipe: SurfaceRecipe = { ...base.surface, coverage: .7, wear: .3, relief: 1, deposits: .8,
  quietness: .2, regionScale: 1, formScale: 1, fragmentation: .4, accentCoverage: .3 };
const baseline = measure(sampleWith(profile(recipe)));
assert.deepEqual(measure(sampleWith(profile(recipe, 'totally-renamed'))), baseline, 'World name changed rendering');
const probes: [string, SurfaceRecipe[keyof SurfaceRecipe], SurfaceRecipe[keyof SurfaceRecipe]][] = [
  ['organization', 'patches', 'bands'], ['regionScale', .5, 2], ['quietness', 0, 1],
  ['formScale', .5, 2], ['fragmentation', 0, 1], ['accentCoverage', 0, 1],
];
for (const [dimension, a, b] of probes) {
  const first = sampleWith(profile({ ...recipe, [dimension]: a }));
  const second = sampleWith(profile({ ...recipe, [dimension]: b }));
  const lo = measure(first), hi = measure(second);
  assert.notEqual(lo.hash, hi.hash, `${dimension} does not affect pixels`);
  if (dimension === 'quietness') {
    const mean = (values: Float32Array) => values.reduce((sum, value) => sum + value, 0) / values.length;
    assert(mean(buildSurfaceFields(second).quiet) > mean(buildSurfaceFields(first).quiet) + .25);
    assert(mean(buildSurfaceFields(second).deposit) < mean(buildSurfaceFields(first).deposit));
  }
  records.push({ anonymous: true, dimension, low: lo, high: hi });
}
for (const invalid of [{ quietness: -1 }, { regionScale: 3 }, { formScale: NaN },
  { fragmentation: 2 }, { accentCoverage: -1 }, { organization: 'world-id-special' }]) {
  assert.throws(() => validateSurfaceRecipe({ ...recipe, ...invalid } as SurfaceRecipe));
}
// An interior unsupported cell inside the body must be detected, not only its perimeter.
const plane: WorldSample = { ...geometry, cols: 8, rows: 8, land: new Uint8Array(64).fill(1), walls: new Uint8Array(64) };
const support = getWorldSupportGrid(plane);
assert(canStandWorld(plane, 64, 64));
support.walkable[8 * support.cols + 8] = 0;
assert(!canStandWorld(plane, 64, 64), 'AABB stepped over an interior void');
assert(!canStandWorld(plane, -1, 64), 'AABB left supported world bounds');
const report = { result: 'PASS', at: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started),
  scope: '10 holdout world/space samples; six controlled composition effects; renamed anonymous recipe; invalid recipe rejection; actual support pixels and 20px body. Not an aesthetic verdict or exhaustive world-space proof.', records };
const output = process.argv[2] ?? 'docs/qa/artifacts/iteration-26/composition-check.json';
mkdirSync(output.slice(0, output.lastIndexOf('/')), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2));
console.log(`I26 composition: ${report.result}; 10 holdouts, 6 pixel-affecting controls, name independence, color freedom, void and 20px support. ${report.elapsedMs}ms`);
