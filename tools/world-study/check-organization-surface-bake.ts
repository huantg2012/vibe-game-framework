/** Renderer isolation checks; these explicit fixtures are not catalog worlds or art approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createMasterWorld, type MasterWorld } from '../../src/generation/world-study/r100-master-world';
import { NATIVE_VOLUME_FAMILY_SEQUENCE } from '../../src/generation/world-study/native-volume-geometry';
import { NativeVolumeLighting } from '../../src/generation/world-study/native-volume-raster';
import { paintMasterGround } from '../../src/systems/r100-world/ground';
import { bakeMasterSurface, masterVolumePalette } from '../../src/systems/r100-world/surface-bake';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';

type MaterialDefinition = typeof PAINTED_MATERIALS[number] | typeof ORGANIZATION_MATERIALS[number];
const decode = async (row: MaterialDefinition | MaterialDefinition['solid']): Promise<PaintedSurface> => ({
  width: row.logical_pixels, height: row.logical_pixels, source: row.source, worldSize: row.world_size,
  regions: row.regions,
  pixels: new Uint8ClampedArray(await sharp(`public${row.source}`).resize(row.logical_pixels, row.logical_pixels).ensureAlpha().raw().toBuffer()),
});
const load = async (row: MaterialDefinition): Promise<PaintedMaterial> => ({ ...await decode(row),
  solid: { ...await decode(row.solid), skinRoughness: row.solid.skinRoughness,
    cutRoughness: row.solid.cutRoughness, gain: row.solid.gain, cutGain: row.solid.cutGain } });
const hash = (data: Uint8Array | Uint8ClampedArray): string => createHash('sha256').update(data).digest('hex');
const results = [];
for (const [worldId, organization] of [['tension-membrane', 'short-fibre'], ['grain-laminate', 'porous-marrow']] as const) {
  const atom = ORGANIZATION_MATERIALS.find(row => row.organization === organization)!;
  const primary = await load(atom);
  const secondaryFamily = worldId === 'tension-membrane' ? 'fibre-knot' : 'folded-slab';
  const secondary = await load(PAINTED_MATERIALS.find(row => row.family === secondaryFamily)!);
  const buffers = [primary.pixels, primary.solid!.pixels, secondary.pixels, secondary.solid!.pixels];
  const originalBuffers = buffers.map(hash);
  for (const grade of ['low', 'medium', 'severe'] as const) {
    const recipe = createR100ProductionRecipe(worldId, 20261005, grade);
    const base = createMasterWorld(recipe.nativeDefinition, recipe.requestedSeed, { grade: recipe.gradeDefinition, profile: recipe.profile });
    const world: MasterWorld = { ...base, algorithmRevision: 6, appearance: recipe.appearance };
    // Keep the same atom in both bakes so this isolates sampling, not an image or palette change.
    const painting = { ...primary, families: { [world.definition.family]: primary, [secondaryFamily]: secondary } };
    const ground = paintMasterGround(world);
    const volume = new NativeVolumeLighting(world.raster, masterVolumePalette(world), { seed: world.sample.seed, axis: world.definition.axis });
    const original = bakeMasterSurface(world, ground, volume, painting);
    const opted = { ...world, appearance: { ...recipe.appearance!, materialOrganization: organization } };
    const changed = bakeMasterSurface(opted, ground, volume, painting);
    const repeat = bakeMasterSurface(opted, ground, volume, painting);
    for (const key of ['normal', 'response', 'emission'] as const) assert.deepEqual(changed[key], original[key], `${organization}/${grade}: sampling must not change ${key}`);
    for (const key of ['albedo', 'normal', 'response', 'emission'] as const) assert.deepEqual(repeat[key], changed[key], `${organization}/${grade}: deterministic ${key}`);
    const primaryIndex = NATIVE_VOLUME_FAMILY_SEQUENCE.indexOf(world.definition.family) + 1;
    let changedPrimary = 0, changedRelief = 0, secondaryPixels = 0, substratePixels = 0;
    const relief = new Set(world.definition.instances.filter(row => row.role === 'relief').map(row => row.id));
    for (let i = 0; i < world.raster.matter.length; i++) {
      const q = i * 4;
      const different = original.albedo[q] !== changed.albedo[q] || original.albedo[q + 1] !== changed.albedo[q + 1] || original.albedo[q + 2] !== changed.albedo[q + 2];
      assert.equal(original.albedo[q + 3], changed.albedo[q + 3], 'Sampling cannot erase matter or reveal through it');
      if (!world.raster.matter[i]) { assert(!different, 'Substrate has no object-local source window'); substratePixels++; }
      else if (world.raster.family[i] !== primaryIndex) { assert(!different, 'Secondary material retains its own sampling'); secondaryPixels++; }
      else if (different) { changedPrimary++; if (relief.has(world.raster.objectId[i]!)) changedRelief++; }
    }
    assert(changedPrimary > 100 && changedRelief > 100 && secondaryPixels > 100 && substratePixels > 100,
      'Fixture must exercise actual primary solids, exposed primary relief, secondary surfaces and substrate');
    assert.deepEqual(buffers.map(hash), originalBuffers, 'Shared source atoms remain immutable');
    results.push({ worldId, organization, grade, seed: recipe.requestedSeed, changedPrimary, changedRelief, secondaryPixels, substratePixels,
      rgba: Object.fromEntries((['albedo', 'normal', 'response', 'emission'] as const).map(key => [key, hash(changed[key])])) });
  }
}
console.log(JSON.stringify({ status: 'pass', scope: 'Six opt-in CPU renderer fixtures; material sampling only. No catalog world enables these options. No normal-light, visual-quality or old-library continuity claim.', cases: results }, null, 2));
