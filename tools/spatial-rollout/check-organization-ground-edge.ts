/** One production world before/after material-domain regression, not art approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { bakeMasterWorldSurface } from '../../src/systems/r100-world/surface-bake';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';
import { prepareOrganizationSurfaceWindows } from '../../src/systems/r100-world/organization-sampling';

type Definition = typeof ORGANIZATION_MATERIALS[number] | typeof PAINTED_MATERIALS[number];
const decode = async (row: Definition | Definition['solid']): Promise<PaintedSurface> => ({
  width: row.logical_pixels, height: row.logical_pixels, worldSize: row.world_size, source: row.source, regions: row.regions,
  pixels: new Uint8ClampedArray(await sharp(`public${row.source}`).resize(row.logical_pixels, row.logical_pixels).ensureAlpha().raw().toBuffer()),
});
const load = async (row: Definition): Promise<PaintedMaterial> => ({ ...await decode(row), solid: { ...await decode(row.solid),
  skinRoughness: row.solid.skinRoughness, cutRoughness: row.solid.cutRoughness, gain: row.solid.gain, cutGain: row.solid.cutGain } });
const hash = (value: unknown): string => createHash('sha256').update(ArrayBuffer.isView(value)
  ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : JSON.stringify(value)).digest('hex');
const baseline = process.env.QA_BASELINE ?? '/tmp/coh-woven-organization-before';
const record = process.argv.includes('--record-before');
const recipe = createR100ProductionRecipe('woven-quarters', 20261010, 'medium');
const map = createR100ProductionMap(recipe), world = hydrateR100MasterWorld(map.native!, map.layout);
const primary = await load(ORGANIZATION_MATERIALS.find(row => row.organization === recipe.appearance!.materialOrganization)!);
const fibre = await load(PAINTED_MATERIALS.find(row => row.family === 'fibre-knot')!);
const painting = { ...primary, families: { 'membrane-rim': primary, 'fibre-knot': fibre } };
const surface = bakeMasterWorldSurface(world, painting);
const geometry: Record<string, string> = { layout: hash(map.layout) };
for (const mesh of world.meshes) for (const key of ['spec', 'positions', 'normals', 'uv', 'indices', 'materials', 'regions', 'vertexCount', 'triangleCount', 'bounds', 'joints'] as const)
  geometry[`mesh.${mesh.spec.id}.${key}`] = hash(mesh[key]);
for (const key of ['config', 'occupancy', 'optical', 'cellHeight', 'matter', 'objectId', 'material', 'region', 'family', 'heightField', 'normals', 'uv', 'occupiedPixels', 'ambientOcclusion'] as const)
  geometry[`raster.${key}`] = hash(world.raster[key]);
const maps = Object.fromEntries((['albedo', 'normal', 'response', 'emission'] as const).map(key => [key, hash(surface[key])]));
const scales = [...prepareOrganizationSurfaceWindows(world.meshes, world.definition.family, primary)].map(([id, window]) => ({ id, skinScale: window.ground.skin.scale }));
if (record) {
  assert(!existsSync(`${baseline}.json`));
  writeFileSync(`${baseline}.json`, JSON.stringify({ geometry, maps, scales }, null, 2));
  writeFileSync(`${baseline}.rgba`, surface.albedo);
  console.log(JSON.stringify({ status: 'recorded-before', baseline, scales }));
} else {
  const before = JSON.parse(readFileSync(`${baseline}.json`, 'utf8'));
  assert.deepEqual(geometry, before.geometry, 'All pre-existing geometry/raster/deployment arrays and fields must stay byte-identical');
  for (const key of ['normal', 'response', 'emission']) assert.equal(maps[key], before.maps[key], `${key} must stay byte-identical`);
  const original = readFileSync(`${baseline}.rgba`), owner = world.meshes.find(mesh => mesh.spec.groundEdgeWidth)!.spec.id;
  let changedOwner = 0;
  for (let i = 0; i < world.raster.matter.length; i++) {
    const q = i * 4;
    assert.equal(surface.albedo[q + 3], original[q + 3], 'Material sampling cannot erase matter');
    const changed = surface.albedo[q] !== original[q] || surface.albedo[q + 1] !== original[q + 1] || surface.albedo[q + 2] !== original[q + 2];
    if (changed) { assert.equal(world.raster.objectId[i], owner, 'Only the affected owner may change'); changedOwner++; }
  }
  assert(changedOwner > 1000);
  const skin = scales.find(row => row.id === owner)!.skinScale;
  assert(skin > .49 && skin < .5, 'The owner fits its own 566px formation, never the 2564px coastline domain');
  const output = process.env.QA_REPORT!; assert(output && !existsSync(output), 'A fresh QA_REPORT is required');
  writeFileSync(output, JSON.stringify({ status: 'passed', world: 'woven-quarters', grade: 'medium', seed: 20261010,
    scope: 'Production byte-equivalence of every existing mesh/raster/layout field, normal/response/emission, and albedo owner-only changes. CPU material sampling; art approval remains separate.',
    geometry, beforeMaps: before.maps, afterMaps: maps, beforeScales: before.scales, afterScales: scales, changedOwner }, null, 2) + '\n');
  console.log(`PASS byte-identical geometry/layout/normal/response/emission; ${changedOwner} owner-only albedo pixels corrected`);
}
