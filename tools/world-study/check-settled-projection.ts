import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildNativeVolume, validateNativeVolumeSpec, type NativeVolumeMesh, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';

const base: NativeVolumeSpec = { id: 1, family: 'gel-flow', seed: 20261005, x: 320, y: 280, rotation: .31,
  length: 410, width: 220, height: 5, thickness: 2, fold: .43, branches: 3, opening: .7, distortion: .25,
  blocking: 0, constructionVersion: 4, shapeProfile: 'settled-bundle' };
const xyTriangles = (mesh: NativeVolumeMesh): number[][] => Array.from({ length: mesh.triangleCount }, (_, face) => {
  const points: number[] = [];
  for (let corner = 0; corner < 3; corner++) { const at = mesh.indices[face * 3 + corner]! * 3; points.push(mesh.positions[at]!, mesh.positions[at + 1]!); }
  return points;
}).filter(p => Math.abs((p[2]! - p[0]!) * (p[5]! - p[1]!) - (p[3]! - p[1]!) * (p[4]! - p[0]!)) > .0001);
const contains = (triangles: number[][], x: number, y: number): boolean => triangles.some(p => {
  const signs = [0, 2, 4].map((i, at) => { const j = ((at + 1) % 3) * 2; return (p[j]! - p[i]!) * (y - p[i + 1]!) - (p[j + 1]! - p[i + 1]!) * (x - p[i]!); });
  return signs.every(n => n >= -.001) || signs.every(n => n <= .001);
});
const metrics: unknown[] = []; let rejected = 0;
for (const [oldProfile, profile] of [['fallen-bundle', 'settled-bundle'], ['clamp-bank', 'settled-clamp']] as const) {
  for (const dimensions of [[410, 220], [175, 90], [200, 120]] as const) {
    const input = { ...base, shapeProfile: profile, length: dimensions[0], width: dimensions[1] };
    const before = buildNativeVolume({ ...input, shapeProfile: oldProfile }), after = buildNativeVolume(input);
    assert(after.triangleCount > 0 && after.triangleCount <= 600, 'existing per-profile budget');
    assert([...after.positions, ...after.normals, ...after.uv].every(Number.isFinite));
    assert(after.materials.every(slot => slot === 0) && after.joints.length === 0, 'one continuous intact non-emissive skin');
    for (const field of ['minX', 'minY', 'maxX', 'maxY'] as const) assert.equal(after.bounds[field], before.bounds[field], `original ${field} retained`);
    const a = xyTriangles(before), b = xyTriangles(after);
    // For clamp each projected triangle is exact. Bundle uses exactly the four
    // midpoint children of each source triangle; compare their union at a grid
    // including outside material and at every original edge's midpoint.
    if (profile === 'settled-clamp') assert.deepEqual(b, a);
    let samples = 0;
    for (let y = Math.floor(before.bounds.minY) - 4; y <= before.bounds.maxY + 4; y += 4)
      for (let x = Math.floor(before.bounds.minX) - 4; x <= before.bounds.maxX + 4; x += 4) {
        assert.equal(contains(a, x, y), contains(b, x, y), `${profile} footprint ${x}/${y}`); samples++;
      }
    let zero = 0, sloping = 0;
    const vertices = new Map<string, number>();
    for (let i = 0; i < after.positions.length; i += 3) {
      const x = after.positions[i]!, y = after.positions[i + 1]!, z = after.positions[i + 2]!, key = `${x},${y}`;
      if (vertices.has(key)) assert(Math.abs(vertices.get(key)! - z) < .00001, 'identical XY shares the same height, including attached broken ends');
      vertices.set(key, z); if (z < .0001) zero++; else if (z < 4) sloping++;
      assert(Math.abs(Math.hypot(after.normals[i]!, after.normals[i + 1]!, after.normals[i + 2]!) - 1) < .00001);
    }
    assert(zero > 0 && sloping > 0, 'actual floor contact and nonzero shallow transition');
    for (const patch of [{ blocking: 1 }, { blocking: undefined }, { height: 7 }, { constructionVersion: 3 }]) {
      assert.throws(() => validateNativeVolumeSpec({ ...input, ...patch } as NativeVolumeSpec)); rejected++;
    }
    metrics.push({ profile, dimensions, triangles: after.triangleCount, footprintSamplesExact: samples, zeroVertices: zero, slopingVertices: sloping });
  }
}
const out = process.argv[2] ?? 'docs/qa/artifacts/r100-i10-i12/b11-shallow-refined/contracts.json';
const report = { status: 'PASS', metrics, rejected, scope: 'Shallow-only schema, exact clamp triangles, sampled refined-bundle footprint, joined height/UV field and bounded triangles. Not a normal-view approval or full-world route result.' };
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
