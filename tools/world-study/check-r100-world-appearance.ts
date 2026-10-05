/** Meaningful visual contracts, not aesthetic approval. Uses actual source images. */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { bakeMasterWorldSurface } from '../../src/systems/r100-world/surface-bake';
import { createSearchRemainsPixels } from '../../src/generation/world-study/search-remains';
import { mapWorldPigment, paintedToneRange, sampleWorldAppearance } from '../../src/generation/world-study/world-material-pigment';
import { validR100WorldAppearance } from '../../src/generation/world-study/r100-world-appearance';
import { createR100ProductionRecipe as oldRecipe, createR100ProductionMap as oldMap, bakeMasterWorldSurface as oldBake } from '../../src/generation/legacy-r100-v3/executor.js';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';

assert.equal(R100_WORLD_APPEARANCES.length, R100_NATIVE_WORLDS.length);
const paints = new Map<string, PaintedMaterial>();
for (const row of PAINTED_MATERIALS) {
  const decode = async (source: typeof row | typeof row.solid): Promise<PaintedSurface> => ({
    width: source.logical_pixels, height: source.logical_pixels, source: source.source, worldSize: source.world_size, regions: source.regions,
    pixels: new Uint8ClampedArray(await sharp(`public${source.source}`).resize(source.logical_pixels, source.logical_pixels).ensureAlpha().raw().toBuffer()),
  });
  paints.set(row.family, { ...await decode(row), solid: { ...await decode(row.solid), ...{
    skinRoughness: row.solid.skinRoughness, cutRoughness: row.solid.cutRoughness, gain: row.solid.gain, cutGain: row.solid.cutGain,
  } } });
}
const field = { secondary: 0, tone: 0, detail: 1 }, output = new Float32Array(3);
for (const appearance of R100_WORLD_APPEARANCES) {
  assert(validR100WorldAppearance(appearance));
  const recipe = createR100ProductionRecipe(appearance.worldId, 20261005, 'medium');
  assert.equal(recipe.package.algorithmRevision, 4); assert(validR100ProductionRecipe(recipe));
  assert.equal(recipe.profile.palette.materialMid, appearance.solid.mid);
  assert.equal(recipe.profile.palette.faceLight, appearance.cleaved.light);
  const altered = structuredClone(recipe); (altered.appearance!.ground as { mid: number }).mid ^= 0x001010;
  assert(!validR100ProductionRecipe(altered), 'palette tampering invalidates its frozen departure');
  const absent = structuredClone(recipe); delete (absent as { appearance?: unknown }).appearance;
  assert(!validR100ProductionRecipe(absent), 'revision 4 cannot silently fall back to an old appearance');
  const paint = paints.get(recipe.nativeDefinition.family)!;
  const toneRange = paintedToneRange(paint), colors = new Set<string>();
  for (let lum = toneRange.low; lum <= toneRange.high; lum += .25) {
    mapWorldPigment(appearance, 'ground', lum, lum, lum, toneRange, field, 0, output);
    colors.add([...output].map(Math.round).join(','));
  }
  assert(colors.size > 60, `${appearance.worldId} retains a continuous tonal span; no flat tint or coarse palette quantization`);
  const samples = new Set<string>(); let secondary = 0, primary = 0;
  for (let y = 0; y < 768; y += 8) for (let x = 0; x < 1024; x += 8) {
    sampleWorldAppearance(appearance, x, y, 20261005, field);
    const repeat = { secondary: 0, tone: 0, detail: 0 };
    sampleWorldAppearance(appearance, x, y, 20261005, repeat); assert.deepEqual(field, repeat);
    assert(field.secondary >= 0 && field.secondary <= 1 && field.detail > 0);
    samples.add(`${Math.round(field.tone * 100)},${Math.round(field.detail * 100)}`);
    if (field.secondary > .5) secondary++; else primary++;
  }
  assert(samples.size > 30, 'large-scale organization changes local material/detail, not one whole-screen hue');
  assert(primary > 0 && secondary > 0, 'authored secondary coverage creates separated material zones, not a uniform hue overlay');
  const original = createSearchRemainsPixels(recipe.profile, 91823, paint);
  const recolored = createSearchRemainsPixels(recipe.profile, 91823, { ...paint, appearance });
  assert.notDeepEqual(recolored.pixels, original.pixels, 'painted loot actually receives the new material');
  for (let index = 3; index < original.pixels.length; index += 4) assert.equal(original.pixels[index], recolored.pixels[index], 'approved loot silhouette remains exact');
}
let legacy = 0, current = 0;
for (const [id, grade] of [['ash-strata', 'low'], ['crystal-fibre', 'medium'], ['ivory-basin', 'severe'], ['cinder-ridge', 'low'], ['pallid-membrane', 'medium'], ['silt-gel', 'severe']] as const) {
  const recipe = oldRecipe(id, 20261005, grade);
  assert(validR100ProductionRecipe(recipe));
  const restored = createR100ProductionMap(structuredClone(recipe)), direct = oldMap(recipe);
  assert.equal(checkpointChecksum(restored), checkpointChecksum(direct), 'complete revision 3 payload remains exact');
  assert.equal(restored.native!.appearance, undefined);
  const world = hydrateR100MasterWorld(restored.native!, restored.layout), painting = paints.get(world.definition.family)!;
  const expected = oldBake(world, painting), actual = bakeMasterWorldSurface(world, painting);
  for (const key of ['albedo', 'normal', 'response', 'emission'] as const) assert.deepEqual(actual[key], expected[key], `revision 3 ${key} remains byte exact`);
  legacy++;
  const nextRecipe = createR100ProductionRecipe(id, 20261005, grade), next = createR100ProductionMap(nextRecipe);
  const nextWorld = hydrateR100MasterWorld(next.native!, next.layout);
  assert.deepEqual(nextWorld.appearance, nextRecipe.appearance);
  const nextPainting = { ...paints.get(nextWorld.definition.family)!, families: Object.fromEntries(paints) };
  const changed = bakeMasterWorldSurface(nextWorld, nextPainting);
  const alternative = bakeMasterWorldSurface({ ...nextWorld, appearance: R100_WORLD_APPEARANCES[(current + 6) % R100_WORLD_APPEARANCES.length]! }, nextPainting);
  assert.notDeepEqual(changed.albedo, alternative.albedo);
  for (const key of ['normal', 'response', 'emission'] as const) assert.deepEqual(changed[key], alternative[key], `world identity cannot change ${key}, pollution or physical surface response`);
  current++;
}
console.log(`PASS ${R100_WORLD_APPEARANCES.length} frozen identities and loot silhouettes; ${legacy} legacy payloads/four-texture exact bakes; ${current} current color-only surface isolation checks.`);
// Regression: collision role does not decide the pigment of visible relief.
{
  const recipe = createR100ProductionRecipe('splayed-fibres', 20261005, 'medium'), map = createR100ProductionMap(recipe);
  const world = hydrateR100MasterWorld(map.native!, map.layout), source = paints.get(world.definition.family)!;
  const original = bakeMasterWorldSurface(world, source);
  const changedAppearance = { ...recipe.appearance!, solid: { dark: 0x201020, mid: 0x704070, light: 0xc090c0 },
    cleaved: { dark: 0x241021, mid: 0x804060, light: 0xd0a0b0 } };
  const changed = bakeMasterWorldSurface({ ...world, appearance: changedAppearance }, source);
  const reliefIds = new Set(world.definition.instances.filter(row => row.role === 'relief').map(row => row.id));
  let exposedReliefChanges = 0, unchangedGround = 0;
  for (let i = 0; i < world.raster.matter.length; i++) {
    const q = i * 4, different = original.albedo[q] !== changed.albedo[q] || original.albedo[q + 1] !== changed.albedo[q + 1] || original.albedo[q + 2] !== changed.albedo[q + 2];
    if (world.raster.matter[i] && reliefIds.has(world.raster.objectId[i]!) && different) exposedReliefChanges++;
    if (!world.raster.matter[i]) { assert(!different, 'changing intact matter ramps cannot recolor the empty substrate'); unchangedGround++; }
  }
  assert(exposedReliefChanges > 100, 'exposed nonblocking fibres retain their own matter pigment, not the ground palette');
  assert(unchangedGround > 100);
  console.log('PASS exposed-relief material identity is independent of its collision role; ground remains unchanged');
}
