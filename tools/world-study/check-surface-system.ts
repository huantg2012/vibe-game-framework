/**
 * Surface-system contracts, not an aesthetic score.
 *
 * Runs the same renderer as the viewer. Existing recipes are rendered at full
 * map size; anonymous combinations and controlled parameter probes use a
 * compact window of actual generated geometry to keep this check bounded.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateWorldSample } from '../../src/generation/world-study/layout';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { renderWorldSurface, type WorldSurface } from '../../src/generation/world-study/surface';
import { buildSurfaceFields, sampleSurfaceField, validateSurfaceRecipe } from '../../src/generation/world-study/surface-field';
import { groundMaterialHighlights, type MaterialHighlight } from '../../src/generation/world-study/material-response';
import { worldSupportAt } from '../../src/generation/world-study/support';
import type { SurfaceRecipe, WorldMaterial, WorldProfile, WorldSample, WorldTopologyId } from '../../src/generation/world-study/types';

const started = performance.now();
const seeds = [70421, 0x9e3779b1] as const;
const topologies: readonly WorldTopologyId[] = ['loops', 'channels'];
const materials: readonly WorldMaterial[] = ['strata', 'crystal', 'glaze'];
const amountFields = ['coverage', 'wear', 'deposit', 'exposure'] as const;
type AmountField = typeof amountFields[number];
type NumericDimension = Exclude<keyof SurfaceRecipe, 'substrate' | 'coating'>;
const dimensions: readonly NumericDimension[] = ['coverage', 'wear', 'deposits', 'scale', 'relief', 'contrast'];
const commonRecipe: SurfaceRecipe = {
  substrate: 'strata', coating: 'crystal', coverage: .57, wear: .44,
  deposits: .62, scale: 1, relief: .65, contrast: .65,
};
const paletteSource = WORLD_PROFILES.find(profile => profile.id === 'ivory-basin') ?? WORLD_PROFILES[0];
assert(paletteSource, 'At least one world palette is required');

function anonymousProfile(surface: SurfaceRecipe, index: number): WorldProfile {
  return {
    ...paletteSource!, id: `surface-probe-${index}`, label: `Unnamed ${index}`,
    description: 'System contract fixture',
    // Deliberately constant: the new recipe must work without the legacy key.
    material: 'strata', surface: { ...surface },
  };
}

const anonymous = materials.flatMap((substrate, row) => materials.map((coating, col) =>
  anonymousProfile({ ...commonRecipe, substrate, coating }, row * materials.length + col)));

function geometrySignature(sample: WorldSample): string {
  return createHash('sha256').update(`${sample.cols}/${sample.rows}/${sample.tileSize}`)
    .update(sample.land).update(sample.walls).update(new Uint8Array(sample.flowAngle.buffer))
    .update(new Uint8Array(sample.deposition.buffer))
    .update(JSON.stringify([sample.spawn, sample.exit, sample.formations])).digest('hex');
}

/** Crop topology/organization data, never downscale rendered material pixels. */
function materialWindow(source: WorldSample): WorldSample {
  const cols = Math.min(48, source.cols), rows = Math.min(40, source.rows);
  const left = Math.floor((source.cols - cols) / 2), top = Math.floor((source.rows - rows) / 2);
  const land = new Uint8Array(cols * rows), walls = new Uint8Array(cols * rows);
  const flowAngle = new Float32Array(cols * rows), deposition = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const target = y * cols + x, origin = (y + top) * source.cols + x + left;
    land[target] = source.land[origin]!; walls[target] = source.walls[origin]!;
    flowAngle[target] = source.flowAngle[origin]!; deposition[target] = source.deposition[origin]!;
  }
  const formations = source.formations.flatMap(formation => {
    const cells = formation.cells.flatMap(cell => {
      const x = cell % source.cols - left, y = Math.floor(cell / source.cols) - top;
      return x >= 0 && y >= 0 && x < cols && y < rows ? [y * cols + x] : [];
    });
    return cells.length ? [{ ...formation, cells, center: {
      x: formation.center.x - left * source.tileSize,
      y: formation.center.y - top * source.tileSize,
    } }] : [];
  });
  const shift = (point: { readonly x: number; readonly y: number }) => ({
    x: point.x - left * source.tileSize, y: point.y - top * source.tileSize,
  });
  return { ...source, cols, rows, land, walls, flowAngle, deposition, formations,
    spawn: shift(source.spawn), exit: shift(source.exit) };
}

interface FieldSummary {
  count: number;
  means: Record<AmountField, number>;
  values: Record<AmountField, number[]>;
  direction: number[];
  variation: number;
}

let fieldCases = 0;
function checkFields(sample: WorldSample): FieldSummary {
  validateSurfaceRecipe(sample.profile.surface);
  buildSurfaceFields(sample);
  const means = { coverage: 0, wear: 0, deposit: 0, exposure: 0 };
  const values: Record<AmountField, number[]> = { coverage: [], wear: [], deposit: [], exposure: [] };
  const direction: number[] = [];
  let count = 0, variation = 0;
  for (let row = 0; row < sample.rows; row += 2) for (let col = 0; col < sample.cols; col += 2) {
    const cell = row * sample.cols + col;
    if (!sample.land[cell] || sample.walls[cell]) continue;
    const x = (col + .5) * sample.tileSize, y = (row + .5) * sample.tileSize;
    const value = sampleSurfaceField(sample, x, y);
    for (const key of amountFields) {
      assert(Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1,
        `${sample.profile.id}/${sample.seed}: ${key} must be finite in [0,1]`);
      means[key] += value[key]; values[key].push(value[key]);
    }
    assert(Number.isFinite(value.direction), 'Surface direction must be finite');
    direction.push(value.direction);
    const next = sampleSurfaceField(sample, x + 8, y);
    for (const key of amountFields) variation += Math.abs(value[key] - next[key]);
    count++;
  }
  assert(count >= 30, 'Field fixture has too little supported land');
  for (const key of amountFields) means[key] /= count;
  fieldCases++;
  return { count, means, values, direction, variation: variation / count };
}

const floorMasks = new Map<string, Uint8Array>();
function floorMaskFor(sample: WorldSample): Uint8Array {
  const key = geometrySignature(sample);
  const cached = floorMasks.get(key);
  if (cached) return cached;
  const width = sample.cols * sample.tileSize, height = sample.rows * sample.tileSize;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    mask[y * width + x] = Number(worldSupportAt(sample, x, y));
  }
  floorMasks.set(key, mask);
  return mask;
}

interface ImageSummary { mean: number; deviation: number; edgeEnergy: number; litPixels: number }
interface RenderCheck {
  surface: WorldSurface;
  highlights: readonly MaterialHighlight[];
  summary: ImageSummary;
}
let renderCases = 0, checkedVoidPixels = 0, checkedReflectionPixels = 0;
function checkedRender(sample: WorldSample): RenderCheck {
  const surface = renderWorldSurface(sample), mask = floorMaskFor(sample);
  assert.equal(surface.width, sample.cols * sample.tileSize);
  assert.equal(surface.height, sample.rows * sample.tileSize);
  assert.equal(surface.rgba.length, mask.length * 4);
  let sum = 0, square = 0, litPixels = 0, edgeEnergy = 0, edges = 0;
  const luminance = (index: number): number => surface.rgba[index * 4]! * .2126
    + surface.rgba[index * 4 + 1]! * .7152 + surface.rgba[index * 4 + 2]! * .0722;
  for (let i = 0; i < mask.length; i++) {
    const pixel = i * 4;
    assert.equal(surface.rgba[pixel + 3], 255, 'A baked map must be opaque');
    if (!mask[i]) {
      assert.equal(surface.rgba[pixel]! + surface.rgba[pixel + 1]! + surface.rgba[pixel + 2]!, 0,
        `${sample.profile.id}: a material wrote into absent space at ${i % surface.width},${Math.floor(i / surface.width)}`);
      checkedVoidPixels++;
      continue;
    }
    const value = luminance(i);
    sum += value; square += value * value; litPixels++;
    // Compare interior land only: a black coastline must not manufacture contrast.
    if (i % surface.width > 0 && mask[i - 1]) { edgeEnergy += Math.abs(value - luminance(i - 1)); edges++; }
    if (i >= surface.width && mask[i - surface.width]) { edgeEnergy += Math.abs(value - luminance(i - surface.width)); edges++; }
  }
  assert(litPixels > 10000, 'Rendered fixture has too little floor for statistics');
  const highlights = groundMaterialHighlights(sample).map(value => ({ ...value }));
  for (const highlight of highlights) {
    assert(Number.isFinite(highlight.normal) && Number.isFinite(highlight.strength));
    assert(highlight.strength >= 0 && highlight.strength <= 1, 'Reflection strength is outside [0,1]');
    assert(Number.isFinite(highlight.sharpness) && highlight.sharpness > 0, 'Reflection response has invalid sharpness');
    for (const key of ['x', 'y', 'width', 'height'] as const) assert(Number.isInteger(highlight[key]), 'Reflection footprint must use integer pixels');
    assert(highlight.width > 0 && highlight.height > 0, 'Empty reflection footprint');
    for (let dy = 0; dy < highlight.height; dy++) for (let dx = 0; dx < highlight.width; dx++) {
      const x = highlight.x + dx, y = highlight.y + dy;
      assert(x >= 0 && y >= 0 && x < surface.width && y < surface.height && mask[y * surface.width + x],
        `${sample.profile.id}: reflection extends into void at ${x},${y}`);
      checkedReflectionPixels++;
    }
  }
  const mean = sum / litPixels;
  renderCases++;
  return { surface, highlights, summary: { mean, deviation: Math.sqrt(Math.max(0, square / litPixels - mean * mean)),
    edgeEnergy: edgeEnergy / Math.max(1, edges), litPixels } };
}

function assertSameRender(first: RenderCheck, second: RenderCheck, label: string): void {
  const bytes = (pixels: Uint8ClampedArray): Uint8Array => new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  assert.equal(Buffer.compare(bytes(first.surface.rgba), bytes(second.surface.rgba)), 0, `${label}: pixels changed`);
  assert.deepEqual(first.highlights, second.highlights, `${label}: reflection samples changed`);
}

function imageDifference(first: RenderCheck, second: RenderCheck, mask: Uint8Array): { changedFraction: number; meanAbsolute: number } {
  let count = 0, changed = 0, total = 0;
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    let delta = 0;
    for (let channel = 0; channel < 3; channel++) delta += Math.abs(first.surface.rgba[index * 4 + channel]! - second.surface.rgba[index * 4 + channel]!);
    count++; total += delta;
    if (delta > 0) changed++;
  }
  return { changedFraction: changed / count, meanAbsolute: total / (count * 3) };
}

function fieldDifference(first: FieldSummary, second: FieldSummary): number {
  assert.equal(first.count, second.count);
  let delta = 0;
  for (const key of amountFields) for (let i = 0; i < first.count; i++) delta += Math.abs(first.values[key][i]! - second.values[key][i]!);
  return delta / (first.count * amountFields.length);
}

// Recipes are public data: reject malformed values before any paint is accepted.
validateSurfaceRecipe(commonRecipe);
for (const recipe of [null, undefined, {}, 0]) {
  assert.throws(() => validateSurfaceRecipe(recipe as SurfaceRecipe), 'Accepted an incomplete surface recipe');
}
for (const key of dimensions) {
  const lower = key === 'scale' ? .5 : 0, upper = key === 'scale' ? 2 : 1;
  validateSurfaceRecipe({ ...commonRecipe, [key]: lower });
  validateSurfaceRecipe({ ...commonRecipe, [key]: upper });
  for (const value of [Number.NaN, Infinity, -Infinity, lower - .001, upper + .001, undefined, '0.5']) {
    assert.throws(() => validateSurfaceRecipe({ ...commonRecipe, [key]: value } as SurfaceRecipe), `Accepted invalid ${key}=${String(value)}`);
  }
}
for (const key of ['substrate', 'coating'] as const) {
  for (const value of ['missing-material', '', undefined]) {
    assert.throws(() => validateSurfaceRecipe({ ...commonRecipe, [key]: value } as SurfaceRecipe), `Accepted invalid ${key}`);
  }
}

// Every world/profile uses the same generator contract, across unseen combinations.
const geometryReferences = new Map<string, string>();
for (const topology of topologies) for (const seed of seeds) {
  const reference = generateWorldSample(WORLD_PROFILES[0]!, topology, seed);
  const key = `${topology}/${seed}`, signature = geometrySignature(reference);
  geometryReferences.set(key, signature);
  assert.equal(geometrySignature(generateWorldSample(WORLD_PROFILES[0]!, topology, seed)), signature, 'Geometry is not deterministic');
  for (const profile of [...WORLD_PROFILES, ...anonymous]) {
    const sample = generateWorldSample(profile, topology, seed);
    assert.equal(geometrySignature(sample), signature, `${profile.id}: changing surface changed space or organization`);
    assert.deepEqual(sample.profile.surface, profile.surface, 'Generator discarded a public recipe');
    const summary = checkFields(sample);
    const renamed = { ...sample, profile: { ...profile, id: `renamed-${profile.id}`, label: 'Unrelated label' } };
    assert.deepEqual(checkFields(renamed), summary, 'Field depends on a profile name');
  }
}

// The three delivered examples exercise whole-map edges and unmodified dimensions.
for (const [index, profile] of WORLD_PROFILES.entries()) {
  const sample = generateWorldSample(profile, 'loops', seeds[0]);
  const rendered = checkedRender(sample);
  if (index === 0) assertSameRender(rendered, checkedRender(generateWorldSample(profile, 'loops', seeds[0])), 'Same seed/recipe');
}

// Nine cross-material recipes share palette, legacy material and geometry.
const fixtureSource = generateWorldSample(anonymous[0]!, 'channels', seeds[0]);
const fixture = materialWindow(fixtureSource);
for (const dimension of dimensions) {
  const invalid = { ...fixture, profile: anonymousProfile({ ...commonRecipe, [dimension]: Number.NaN }, 900) };
  assert.throws(() => renderWorldSurface(invalid), `The renderer did not reject invalid ${dimension}`);
}
const anonymousSignatures = new Set<string>();
const anonymousStats: Array<{ substrate: WorldMaterial; coating: WorldMaterial; mean: number; deviation: number; edgeEnergy: number }> = [];
for (const profile of anonymous) {
  const sample = { ...fixture, profile };
  const rendered = checkedRender(sample);
  const renamed = checkedRender({ ...sample, profile: { ...profile, id: `foreign-${profile.id}`, label: 'No known world', description: 'Same recipe' } });
  assertSameRender(rendered, renamed, 'Renaming a profile');
  anonymousSignatures.add(createHash('sha256').update(rendered.surface.rgba).digest('hex'));
  anonymousStats.push({ substrate: profile.surface.substrate, coating: profile.surface.coating, ...rendered.summary });
}
assert.equal(anonymousSignatures.size, 9, 'Some substrate/coating operators collapsed to the same rendering');

// Controlled one-dimensional changes must move fields/material, not just a hash.
const dimensionReports: Array<Record<string, string | number>> = [];
const fieldByDimension: Partial<Record<NumericDimension, AmountField>> = { coverage: 'coverage', wear: 'wear', deposits: 'deposit' };
for (const [index, dimension] of dimensions.entries()) {
  const low = dimension === 'scale' ? .5 : 0, high = dimension === 'scale' ? 2 : 1;
  const make = (value: number): WorldSample => ({ ...fixture,
    profile: anonymousProfile({ ...commonRecipe, [dimension]: value }, 100 + index) });
  const first = make(low), second = make(high);
  assert.equal(geometrySignature(first), geometrySignature(second), 'A surface parameter changed collision');
  const lowField = checkFields(first), highField = checkFields(second);
  const lowImage = checkedRender(first), highImage = checkedRender(second);
  const difference = imageDifference(lowImage, highImage, floorMaskFor(first));
  assert(difference.changedFraction > .001 && difference.meanAbsolute > .03,
    `${dimension}: parameter changed too little supported material (${JSON.stringify(difference)})`);
  const fieldName = fieldByDimension[dimension];
  if (fieldName) {
    assert(highField.means[fieldName] > lowField.means[fieldName] + .05,
      `${dimension}: its spatial field does not respond to the parameter`);
  }
  if (dimension === 'scale') {
    assert(fieldDifference(lowField, highField) > .005, 'Scale did not move spatial organization');
    assert(Math.abs(lowField.variation - highField.variation) > .0001, 'Scale did not change spatial variation');
  }
  if (dimension === 'contrast') {
    assert(highImage.summary.deviation > lowImage.summary.deviation * 1.01,
      'Increasing contrast did not increase supported-ground tonal spread');
  }
  if (dimension === 'relief') {
    assert(Math.abs(highImage.summary.edgeEnergy - lowImage.summary.edgeEnergy) > .005,
      'Relief did not change interior material edges');
  }
  dimensionReports.push({ dimension, ...difference, lowMean: lowImage.summary.mean, highMean: highImage.summary.mean,
    lowDeviation: lowImage.summary.deviation, highDeviation: highImage.summary.deviation,
    lowEdgeEnergy: lowImage.summary.edgeEnergy, highEdgeEnergy: highImage.summary.edgeEnergy,
    lowField: fieldName ? lowField.means[fieldName] : lowField.variation,
    highField: fieldName ? highField.means[fieldName] : highField.variation });
}

const report = {
  scope: 'Generation and material contracts only; these numbers do not establish visual quality.',
  fullMapGeometryCases: geometryReferences.size * (WORLD_PROFILES.length + anonymous.length),
  fieldCases, renderCases, checkedVoidPixels, checkedReflectionPixels,
  anonymousCombinations: anonymousStats, parameterResponses: dimensionReports,
  elapsedMs: Math.round(performance.now() - started),
};
if (process.argv[2]) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  await mkdir(path.dirname(process.argv[2]), { recursive: true });
  await writeFile(process.argv[2], JSON.stringify(report, null, 2));
}
console.log(`Surface system: ${report.fullMapGeometryCases} geometry / ${fieldCases} fields / ${renderCases} renders; nine anonymous combinations, six parameter effects, opaque void and supported reflections passed.`);
