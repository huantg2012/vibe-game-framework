/** Independent geometry/entry boundary audit: clipping oracle differs from the
 * runtime separating-axis collision solver. No complete-world art claim. */
import assert from 'node:assert/strict';
import { buildNativeVolume, NATIVE_VOLUME_SHAPE_PROFILES, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import { mix32 } from '../../src/generation/seed-fork';
import { TileType } from '../../src/types/game-types';

type Point = { x: number; y: number };
function clip(points: readonly Point[], axis: 'x' | 'y', at: number, greater: boolean): Point[] {
  const inside = (p: Point) => greater ? p[axis] >= at : p[axis] <= at;
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, q = points[(i + 1) % points.length]!;
    if (inside(p)) result.push(p);
    if (inside(p) !== inside(q)) {
      const t = (at - p[axis]) / (q[axis] - p[axis]);
      result.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return result;
}
function area(points: readonly Point[]): number {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]!; return sum + p.x * q.y - p.y * q.x; }, 0)) * .5;
}
function independentBlocked(triangles: readonly Point[][], p: Point): boolean {
  return triangles.some(triangle => {
    let intersection = clip(triangle, 'x', p.x - 10, true);
    intersection = clip(intersection, 'x', p.x + 10, false);
    intersection = clip(intersection, 'y', p.y - 10, true);
    intersection = clip(intersection, 'y', p.y + 10, false);
    return area(intersection) > 1e-6;
  });
}
const spec: NativeVolumeSpec = { id: 1, family: 'broken-shell', seed: 41701, x: 320, y: 280, rotation: 0,
  length: 300, width: 240, height: 62, thickness: 12, fold: .68, branches: 3, opening: .88, distortion: .72, blocking: 1, constructionVersion: 3, shapeProfile: 'rib-vault' };
const map = { cols: 80, rows: 70, tileSize: 8, tiles: Array.from({ length: 70 }, () => Array.from({ length: 80 }, () => TileType.FLOOR)) };
let bodySamples = 0, recipes = 0, invalidContracts = 0;
for (const shapeProfile of NATIVE_VOLUME_SHAPE_PROFILES) for (const rotation of [0, .47, -.91]) {
  const mesh = buildNativeVolume({ ...spec, shapeProfile, rotation });
  const native = { definition: { instances: [{ id: 1, role: 'solid' }] }, meshes: [mesh] } as unknown as R100NativeWorldData;
  const body = new NativeBodyCollision(native, map), triangles: Point[][] = [];
  for (let face = 0; face < mesh.indices.length; face += 3) {
    const points = [0, 1, 2].map(corner => { const at = mesh.indices[face + corner]! * 3; return { x: mesh.positions[at]!, y: mesh.positions[at + 1]! }; });
    if (area(points) > 1e-6) triangles.push(points);
  }
  for (let i = 0; i < 180; i++) {
    const p = { x: 110 + mix32(i, `x-${shapeProfile}-${rotation}`) / 2 ** 32 * 420,
      y: 90 + mix32(i, `y-${shapeProfile}-${rotation}`) / 2 ** 32 * 380 };
    assert.equal(body.supports(p, 10, 10), !independentBlocked(triangles, p), `${shapeProfile}/${rotation}/${i}: 20px body differs from clipped visual geometry`);
    if (body.supports(p, 10, 10)) {
      const dx = 25 * Math.cos(i), dy = 25 * Math.sin(i), fraction = body.displacementFraction(p, 10, 10, dx, dy);
      for (let step = 1; step <= 5; step++) {
        const at = { x: p.x + dx * fraction * step / 5, y: p.y + dy * fraction * step / 5 };
        assert(!independentBlocked(triangles, at), 'swept stopping point and preceding path must remain outside the visual solid');
      }
    }
    bodySamples++;
  }
  const relief = { ...native, definition: { instances: [{ id: 1, role: 'relief' }] } } as unknown as R100NativeWorldData;
  const face = triangles.find(row => area(row) > 1)!;
  const centre = { x: face.reduce((sum, p) => sum + p.x, 0) / 3, y: face.reduce((sum, p) => sum + p.y, 0) / 3 };
  assert(!body.supports(centre, 10, 10), 'the same visible face must stop a body when solid');
  assert(new NativeBodyCollision(relief, map).supports(centre, 10, 10), 'shallow material has no implicit solid collision');
}
// Recompute the public receipt after mutation so invalid contracts cannot pass
// merely because their original hash was stale. This is not an anti-cheat test.
function restamp(recipe: WorldProductionRecipeV3): void {
  const source = JSON.stringify({ algorithm: 'r100-native@3.5', native: recipe.nativeDefinition, profile: recipe.profile, space: recipe.space,
    contentFragmentTypeId: recipe.contentFragmentTypeId, grade: recipe.gradeDefinition, contents: recipe.contentDefinition,
    appearance: recipe.appearance, materials: recipe.package.materials });
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  (recipe.package as { dependencyHash: string }).dependencyHash = (hash >>> 0).toString(16).padStart(8, '0');
}
if (!process.argv.includes('--geometry-only')) for (const world of R100_NATIVE_WORLDS) for (const grade of ['low', 'medium', 'severe'] as const) {
  const recipe = createR100ProductionRecipe(world.id, 173, grade); assert(validR100ProductionRecipe(recipe)); recipes++;
}
const baseline = createR100ProductionRecipe(R100_NATIVE_WORLDS[0]!.id, 173, 'low');
for (const patch of [{ constructionVersion: 3 }, { constructionVersion: 3, shapeProfile: 'bad-profile' },
  { constructionVersion: 2, shapeProfile: 'rib-vault' }, { opening: undefined }, { role: 'passage' }, { bogus: 1 }, { family: 'bad-family' }]) {
  const recipe = structuredClone(baseline); Object.assign(recipe.nativeDefinition.instances[0]!, patch); restamp(recipe);
  assert.equal(validR100ProductionRecipe(recipe), false, `Malformed instance rejected despite matching receipt: ${JSON.stringify(patch)}`); invalidContracts++;
}
console.log(JSON.stringify({ status: 'PASS', geometryOnly: process.argv.includes('--geometry-only'), shapeProfiles: NATIVE_VOLUME_SHAPE_PROFILES, bodySamples, validRecipes: recipes, invalidContracts,
  scope: 'Independent clipping oracle, rotation and full-body sweep samples; valid current recipes and malformed signed-data contracts. No complete-world visual or journey claim.' }));
