/** Continuous authored banks: real raster slope, shared seams, exact terrain/body. */
import assert from 'node:assert/strict';
import { buildNativeVolume, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import type { NativeGroundEdgeContext } from '../../src/generation/world-study/native-volume-ground-edge';
import type { NativeErosionPoint } from '../../src/generation/world-study/native-volume-erosion';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { TileType } from '../../src/types/game-types';
const spec: NativeVolumeSpec = { id: 1, family: 'folded-slab', seed: 1, x: 80, y: 80, rotation: .67, length: 32, width: 24, height: 6, thickness: 2,
  fold: .5, opening: .5, branches: 3, distortion: .2, blocking: 0, constructionVersion: 4, shapeProfile: 'fracture-fan', groundEdgeWidth: 8 };
function inside(polygon: readonly NativeErosionPoint[], x: number, y: number): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
function contextFor(polygons: NativeGroundEdgeContext['polygons'], width: number, height: number, master = false): NativeGroundEdgeContext {
  return { polygons, width, height, matterAt: (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const cx = Math.floor(x / 8) * 8 + 4, cy = Math.floor(y / 8) * 8 + 4, col = Math.floor(cx / 32), row = Math.floor(cy / 32);
    if (master && !(col >= 1 && row >= 1 && col < width / 32 - 1 && row < height / 32 - 1
      && !(col < 3 && row < 3) && !(col > width / 32 - 4 && row > height / 32 - 4))) return false;
    return !polygons.some(p => inside(p, cx, cy));
  } };
}
const fixtures = [
  { name: 'straight', polygon: [[240, 64], [320, 64], [320, 192], [240, 192]] },
  { name: 'diagonal', polygon: [[224, 64], [304, 96], [288, 216], [192, 176]] },
  { name: 'concave', polygon: [[216, 48], [336, 48], [336, 208], [280, 208], [280, 120], [216, 120]] },
];
const results: unknown[] = [];
for (const fixture of fixtures) for (const width of [8, 16, 24]) {
  const context = contextFor([fixture.polygon.map(p => ({ x: p[0]!, y: p[1]! }))], 400, 256);
  const current = { ...spec, groundEdgeWidth: width }, mesh = buildNativeVolume(current, context);
  const rotated = buildNativeVolume({ ...current, rotation: -1.03 }, context);
  const { groundEdgeWidth: _width, ...carrier } = current, base = buildNativeVolume(carrier), baseTriangles = base.triangleCount;
  assert(mesh.triangleCount > baseTriangles && mesh.triangleCount <= baseTriangles + 2048);
  assert.equal(mesh.joints.length, 0, 'ordinary cut banks must not invent fracture lights');
  const seams = new Map<string, { constant: number; axis: 'x' | 'y'; from: number; to: number; zFrom: number; zTo: number }[]>();
  let positiveHeights = 0;
  for (let face = baseTriangles; face < mesh.triangleCount; face++) {
    const points = [0, 1, 2].map(corner => { const at = mesh.indices[face * 3 + corner]! * 3; return { x: mesh.positions[at]!, y: mesh.positions[at + 1]!, z: mesh.positions[at + 2]! }; });
    if (points.some(p => p.z > .1)) positiveHeights++;
    for (const weights of [[.34, .33, .33], [.90, .05, .05], [.05, .90, .05], [.05, .05, .90]]) {
      const x = points.reduce((n, p, i) => n + p.x * weights[i]!, 0), y = points.reduce((n, p, i) => n + p.y * weights[i]!, 0);
      assert(context.matterAt(x, y), 'bank triangle must remain inside one authoritative present8px cell');
    }
    for (let corner = 0; corner < 3; corner++) for (let axis = 0; axis < 3; axis++) {
      const at = mesh.indices[face * 3 + corner]! * 3 + axis, other = rotated.indices[face * 3 + corner]! * 3 + axis;
      assert(Math.abs(mesh.positions[at]! - rotated.positions[other]!) < 1e-4, 'world cut cannot rotate with carrier');
    }
    for (let edge = 0; edge < 3; edge++) {
      const a = points[edge]!, c = points[(edge + 1) % 3]!;
      for (const axis of ['x', 'y'] as const) {
        if (Math.abs(a[axis] - c[axis]) > 1e-4 || Math.abs(a[axis] / 8 - Math.round(a[axis] / 8)) > 1e-5) continue;
        const along = axis === 'x' ? 'y' : 'x', from = Math.min(a[along], c[along]), to = Math.max(a[along], c[along]);
        if (to - from < 1e-4) continue;
        const constant = Math.round(a[axis] / 8) * 8, key = `${axis}:${constant}`, segments = seams.get(key) ?? [];
        segments.push({ constant, axis, from, to, zFrom: a[along] < c[along] ? a.z : c.z, zTo: a[along] < c[along] ? c.z : a.z }); seams.set(key, segments);
      }
    }
  }
  let joinedSamples = 0;
  for (const segments of seams.values()) {
    const first = segments[0]!;
    for (let along = Math.floor(Math.min(...segments.map(s => s.from))) + .5; along < Math.max(...segments.map(s => s.to)); along += 1) {
      const values = segments.filter(s => along > s.from + 1e-4 && along < s.to - 1e-4)
        .map(s => s.zFrom + (s.zTo - s.zFrom) * (along - s.from) / (s.to - s.from));
      if (!values.length) continue;
      assert(Math.max(...values) - Math.min(...values) < 1e-4, 'adjacent cells need identical height at every shared seam point');
      const x = first.axis === 'x' ? first.constant : along, y = first.axis === 'y' ? first.constant : along;
      const bothPresent = first.axis === 'x' ? context.matterAt(x - .1, y) && context.matterAt(x + .1, y) : context.matterAt(x, y - .1) && context.matterAt(x, y + .1);
      if (bothPresent && values[0]! > .1) { assert(values.length >= 2, 'a raised seam cannot end above unmeshed present ground'); joinedSamples++; }
    }
  }
  assert(joinedSamples > 0);
  assert(positiveHeights > 0);
  const raster = compileNativeVolumeRaster([mesh], { x: 0, y: 0, width: 400, height: 256, opticalHeight: 24 });
  const cutPixels = Array.from(raster.occupiedPixels).filter(pixel => pixel % 400 > 160 && raster.material[pixel] === 1 && raster.heightField[pixel]! > .1).length;
  assert(cutPixels > 100, 'legal width8 needs actually visible sloped material');
  let straightAlongshoreRange: number | undefined;
  if (fixture.name === 'straight') {
    const heights = Array.from({ length: 96 }, (_, i) => raster.heightField[(80 + i) * 400 + 236]!);
    straightAlongshoreRange = Math.max(...heights) - Math.min(...heights);
    assert(Math.min(...heights) > .1 && straightAlongshoreRange < 1e-4, 'straight bank ridge must stay continuous across8px joins, not repeat isolated pyramids');
  }
  const map = { cols: 50, rows: 32, tileSize: 8, tiles: Array.from({ length: 32 }, (_, y) => Array.from({ length: 50 }, (_, x) => context.matterAt(x * 8 + 4, y * 8 + 4) ? TileType.FLOOR : TileType.VOID)) };
  const definition = { instances: [{ id: 1, role: 'relief' as const }] };
  const beforeBody = new NativeBodyCollision({ definition: definition as never, meshes: [base] }, map), afterBody = new NativeBodyCollision({ definition: definition as never, meshes: [mesh] }, map);
  let bodySamples = 0;
  for (let y = 12; y < 248; y += 8) for (let x = 12; x < 392; x += 8) {
    const p = { x, y }; assert.equal(beforeBody.supports(p, 10, 10), afterBody.supports(p, 10, 10));
    for (const [dx, dy] of [[8, 0], [0, 8], [-8, 0], [0, -8]]) assert.equal(beforeBody.displacementFraction(p, 10, 10, dx!, dy!), afterBody.displacementFraction(p, 10, 10, dx!, dy!));
    bodySamples++;
  }
  results.push({ fixture: fixture.name, width, edgeTriangles: mesh.triangleCount - baseTriangles, joinedSamples, straightAlongshoreRange, cutPixels, bodySamples, rotationInvariant: true });
}
const affected = [];
for (const row of R100_NATIVE_WORLDS) for (const definition of row.definitions) {
  const instance = definition.instances.find(i => i.groundEdgeWidth !== undefined); if (!instance) continue;
  const { role, ...geometry } = instance, context = contextFor(definition.erosion, definition.cols * 32, definition.rows * 32, true);
  const mesh = buildNativeVolume({ ...geometry, family: instance.family ?? definition.family, seed: 20261005, blocking: role === 'solid' ? 1 : 0 }, context);
  const { groundEdgeWidth: _width, ...base } = mesh.spec;
  const edgeTriangles = mesh.triangleCount - buildNativeVolume(base).triangleCount;
  assert(edgeTriangles <= 2048);
  affected.push({ world: row.id, grade: definition.grade, width: instance.groundEdgeWidth, edgeTriangles });
}
console.log(JSON.stringify({ status: 'PASS', scope: 'continuous bank geometry only; no new world admission or normal-view art approval', fixtures: results, affected }, null, 2));
