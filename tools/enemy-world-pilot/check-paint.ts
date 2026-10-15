/** Presentation-only gates for the two-world fungal-mat pilot.
 * Run: npx tsx --tsconfig tsconfig.json tools/enemy-world-pilot/check-paint.ts
 * Geometry/alpha invariance is a mechanics guard, not an art verdict.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintSurfaceMaterial } from '../../src/entities/form-renderers/d/paint-genome/material';
import { applyPaintWorldLighting } from '../../src/entities/form-renderers/d/paint-genome/lighting';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { sampleWorldMaterialLight } from '../../src/entities/form-renderers/d/world-material-light';
import type { FormVisualPose } from '../../src/entities/form-renderers/form-renderer';

const hash = (data: Uint8ClampedArray): string => createHash('sha256').update(data).digest('hex');
const pose: FormVisualPose = {
  x: 0, y: 0, facing4: 'down', moving: false, visibility: 1,
  signal: 'idle', deltaMs: 0, activity: { phase: 'active', progress: 1 },
};
const light = { x: 0, y: 0, z: 28, radius: 264, intensity: 3.1, color: [1, .94, .86] as const };
const results: { seed: number; width: number; height: number; cells: number; worlds: string[] }[] = [];

function assertSameAlpha(actual: Uint8ClampedArray, expected: Uint8ClampedArray, label: string): void {
  assert.equal(actual.length, expected.length, `${label}: buffer size`);
  for (let i = 3; i < actual.length; i += 4) assert.equal(actual[i], expected[i], `${label}: alpha at ${i}`);
}

for (const seed of [77, 194, 508]) {
  const baked = bakePaintGenome({
    substrate: 'fungal_mat', coverage: 'rewrite', seed,
    continuity: 'colony', sense: 'sense_touch', rhythm: 'rhythm_cluster', geometryVersion: 2,
  });
  const { field, canvasW: width, canvasH: height, growth } = baked;
  const fieldBefore = field.slice();
  const floorCells = collectPaintGenomeFloorTiles(field, width, height, 256, 256, 32);
  const base = new Uint8ClampedArray(width * height * 4);
  const explicitDefault = new Uint8ClampedArray(base.length);
  paintSurfaceMaterial(base, field, width, height, 'fungal_mat', 'rewrite', seed);
  paintSurfaceMaterial(explicitDefault, field, width, height, 'fungal_mat', 'rewrite', seed, 0, undefined, undefined, growth);
  assert.deepEqual(base, baked.buf.data, 'default material still matches the existing bake path');
  assert.deepEqual(explicitDefault, base, 'omitted world profile preserves the default path');
  const worlds: string[] = [];
  for (const worldId of ['crystal-fibre', 'ruptured-film']) {
    const profile = resolveEnemyWorldAdaptation(worldId);
    assert(profile, `${worldId}: material profile must exist`);
    const out = new Uint8ClampedArray(base.length);
    const next = new Uint8ClampedArray(base.length);
    const repeated = new Uint8ClampedArray(base.length);
    paintSurfaceMaterial(out, field, width, height, 'fungal_mat', 'rewrite', seed, 0, pose, profile, growth);
    paintSurfaceMaterial(next, field, width, height, 'fungal_mat', 'rewrite', seed, 800, pose, profile, growth);
    paintSurfaceMaterial(repeated, field, width, height, 'fungal_mat', 'rewrite', seed, 0, pose, profile, growth);
    assert.deepEqual(out, repeated, `${worldId}/${seed}: deterministic material`);
    assert.notDeepEqual(out, next, `${worldId}/${seed}: material must move with activity`);
    assertSameAlpha(out, base, `${worldId}/${seed}: rest footprint`);
    assertSameAlpha(next, base, `${worldId}/${seed}: animated footprint`);
    const lit = out.slice();
    applyPaintWorldLighting(lit, field, width, height, 0, 0, { lights: [light] });
    assertSameAlpha(lit, out, `${worldId}/${seed}: lit footprint`);
    assert.notDeepEqual(lit, out, `${worldId}/${seed}: actual lighting changes received material`);
    assert.deepEqual(field, fieldBefore, `${worldId}/${seed}: source field stays immutable`);
    assert.deepEqual(collectPaintGenomeFloorTiles(field, width, height, 256, 256, 32), floorCells, 'contact cells stay unchanged');
    worlds.push(hash(out));
  }
  assert.notEqual(worlds[0], worlds[1], `${seed}: the two worlds produce distinct material`);
  results.push({ seed, width, height, cells: floorCells.length, worlds });
}
for (let world = 0; world < 2; world++)
  assert.equal(new Set(results.map(result => result.worlds[world])).size, 3, 'seeds produce distinct individuals');

const ambient = sampleWorldMaterialLight({ lights: [] }, 0, 0, 0, 0, 0, 1, false);
const expectedAmbient = .36 / (1 + .28 * .36) * 1.15;
assert.deepEqual(ambient, [expectedAmbient, expectedAmbient, expectedAmbient], 'same ground ambient/tone response');
const lit = sampleWorldMaterialLight({ lights: [light] }, 0, 0, 0, 0, 0, 1, false);
assert(lit[0] > ambient[0] && lit[0] > lit[1] && lit[1] > lit[2], 'received light keeps lamp colour and intensity');
assert.deepEqual(sampleWorldMaterialLight({ lights: [light], shadeAt: () => 0 }, 0, 0, 0, 0, 0, 1, false), ambient, 'occlusion blocks direct light');
assert.deepEqual(sampleWorldMaterialLight({ lights: [light] }, 1000, 1000, 0, 0, 0, 1, false), ambient, 'out-of-range light contributes nothing');

console.log(JSON.stringify({
  cases: results, worldSeedCases: 6, defaultCompatible: true, deterministic: true,
  materialMotion: true, alphaUnchanged: true, fieldUnchanged: true,
  contactCellsUnchanged: true, receivedLighting: true, shadowAndRange: true,
}));
