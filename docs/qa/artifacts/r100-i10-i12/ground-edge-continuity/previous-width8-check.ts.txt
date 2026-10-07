import assert from 'node:assert/strict';
import { buildNativeVolume, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
const spec: NativeVolumeSpec = { id: 1, family: 'folded-slab', seed: 1, x: 80, y: 80, rotation: .67, length: 32, width: 24, height: 6, thickness: 2,
  fold: .5, opening: .5, branches: 3, distortion: .2, blocking: 0, constructionVersion: 4, shapeProfile: 'fracture-fan', groundEdgeWidth: 8 };
const polygon = [{ x: 240, y: 64 }, { x: 320, y: 64 }, { x: 320, y: 192 }, { x: 240, y: 192 }];
const context = { polygons: [polygon], width: 400, height: 256, matterAt: (x: number, y: number): boolean => x >= 0 && y >= 0 && x < 400 && y < 256 && !(x >= 240 && x < 320 && y >= 64 && y < 192) };
const mesh = buildNativeVolume(spec, context), rotated = buildNativeVolume({ ...spec, rotation: -1.03 }, context);
const { groundEdgeWidth: _width, ...carrier } = spec;
const baseTriangles = buildNativeVolume(carrier).triangleCount;
assert(mesh.triangleCount > baseTriangles && mesh.triangleCount <= baseTriangles + 2048);
let positiveHeights = 0;
for (let face = baseTriangles; face < mesh.triangleCount; face++) {
  const points = [0, 1, 2].map(corner => { const at = mesh.indices[face * 3 + corner]! * 3; return { x: mesh.positions[at]!, y: mesh.positions[at + 1]!, z: mesh.positions[at + 2]! }; });
  if (points.some(point => point.z > .1)) positiveHeights++;
  const cx = points.reduce((n, point) => n + point.x, 0) / 3, cy = points.reduce((n, point) => n + point.y, 0) / 3;
  assert(context.matterAt(cx, cy), 'ground-side bank triangles cannot occupy missing terrain');
  for (let corner = 0; corner < 3; corner++) for (let axis = 0; axis < 3; axis++) {
    const at = mesh.indices[face * 3 + corner]! * 3 + axis, other = rotated.indices[face * 3 + corner]! * 3 + axis;
    assert(Math.abs(mesh.positions[at]! - rotated.positions[other]!) < 1e-4, 'world cut must not rotate with its carrier instance');
  }
}
assert(positiveHeights > 0, 'width8 needs actual sloped material, not all-zero corner heights');
const raster = compileNativeVolumeRaster([mesh], { x: 0, y: 0, width: 400, height: 256, opticalHeight: 24 });
const cutPixels = Array.from(raster.occupiedPixels).filter(pixel => pixel % 400 > 180 && raster.material[pixel] === 1 && raster.heightField[pixel]! > .1).length;
assert(cutPixels > 100, 'valid 8px width has visible raster material');
console.log(JSON.stringify({ status: 'PASS', width: 8, cellSize: 8, totalTriangles: mesh.triangleCount, edgeTriangles: mesh.triangleCount - baseTriangles, nonzeroEdgeFaces: positiveHeights, visibleCutPixels: cutPixels, rotationInvariant: true }));
