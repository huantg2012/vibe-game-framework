/** Registered I11 geometry through the actual compiler/raster/body path. This
 * checks physical meaning and shading contracts, not normal-world art quality. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { buildNativeVolume, validateNativeVolumeSpec, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster, type NativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import { TileType } from '../../src/types/game-types';

const output = process.argv[2] ?? 'docs/qa/artifacts/r100-i10-i12/i11-geometry-preparation/registered-contract.json';
const width = 360, map = { cols: 45, rows: 45, tileSize: 8, tiles: Array.from({ length: 45 }, () => Array.from({ length: 45 }, () => TileType.FLOOR)) };
const base: NativeVolumeSpec = { id: 1, family: 'membrane-rim', seed: 20261005, x: 180, y: 180, rotation: 0,
  length: 160, width: 120, height: 54, thickness: 10, fold: .6, branches: 3, opening: .7, distortion: .3, blocking: 1,
  constructionVersion: 4, shapeProfile: 'compressed-wedge' };
function cavities(raster: NativeVolumeRaster) {
  const seen = new Set<number>(), groups: { pixels: number[]; bottom: number[]; width: number; height: number }[] = [];
  for (const pixel of raster.occupiedPixels) if (raster.material[pixel] === 2 && !seen.has(pixel)) {
    const pixels = [pixel], bottom: number[] = []; seen.add(pixel);
    let minX = width, maxX = 0, minY = width, maxY = 0;
    for (let at = 0; at < pixels.length; at++) {
      const p = pixels[at]!, x = p % width, y = Math.floor(p / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (raster.region[p] === 0) bottom.push(p);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx!, ny = y + dy!, q = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < width && raster.matter[q] && raster.material[q] === 2 && !seen.has(q)) { seen.add(q); pixels.push(q); }
      }
    }
    groups.push({ pixels, bottom, width: maxX - minX + 1, height: maxY - minY + 1 });
  }
  assert.equal(groups.length, 6, 'six separate material recesses must survive rasterization');
  for (const group of groups) {
    assert(group.width < 20 && group.height < 20, 'cavities are smaller than the body, not apparent doorways');
    assert(group.bottom.length > 0, 'every cavity needs actual opaque bottom pixels');
    for (const p of group.bottom) assert(raster.heightField[p]! > 0, 'cavity bottom stays within the mass');
  }
  return groups;
}
const cases: unknown[] = [];
let bodySamples = 0, sweepSamples = 0, flatCutVertices = 0, smoothSkinVertices = 0, minBottomPixels = Infinity, maxTriangles = 0;
for (const profile of ['compressed-wedge', 'porous-break'] as const) for (const [length, breadth, tall, blocking] of [[90, 90, 35, 1], [160, 120, 54, 1], [240, 170, 68, 1], [180, 140, 5, 0]]) for (let direction = 0; direction < 8; direction++) {
  const spec: NativeVolumeSpec = { ...base, shapeProfile: profile, family: profile === 'porous-break' ? 'granular-ridge' : 'membrane-rim',
    length: length!, width: breadth!, height: tall!, blocking: blocking!, rotation: direction * Math.PI / 4 };
  const before = structuredClone(spec), mesh = buildNativeVolume(spec), again = buildNativeVolume(spec);
  assert.deepEqual(spec, before, 'builder must not rewrite author data');
  for (const field of ['positions', 'normals', 'uv', 'indices', 'materials', 'regions', 'bounds', 'joints'] as const) assert.deepEqual(mesh[field], again[field]);
  assert(mesh.triangleCount <= 600); maxTriangles = Math.max(maxTriangles, mesh.triangleCount);
  assert.equal(mesh.joints.length, blocking);
  assert([...mesh.positions, ...mesh.normals, ...mesh.uv].every(Number.isFinite));
  for (let f = 0; f < mesh.triangleCount; f++) {
    const [ia, ib, ic] = [0, 1, 2].map(c => mesh.indices[f * 3 + c]! * 3) as [number, number, number];
    const p = mesh.positions, ax = p[ib]! - p[ia]!, ay = p[ib + 1]! - p[ia + 1]!, az = p[ib + 2]! - p[ia + 2]!;
    const bx = p[ic]! - p[ia]!, by = p[ic + 1]! - p[ia + 1]!, bz = p[ic + 2]! - p[ia + 2]!;
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, size = Math.hypot(nx, ny, nz);
    for (const at of [ia, ib, ic]) {
      const n = mesh.normals, len = Math.hypot(n[at]!, n[at + 1]!, n[at + 2]!); assert(Math.abs(len - 1) < 1e-5);
      const alignment = Math.abs((nx * n[at]! + ny * n[at + 1]! + nz * n[at + 2]!) / size);
      if (mesh.materials[f] !== 0) { assert(alignment > .99998, 'fracture/pore walls keep real plane normals'); flatCutVertices++; }
      else { assert(alignment > .55, 'smooth skin stays aligned with its physical face'); if (alignment < .9999) smoothSkinVertices++; }
    }
  }
  const raster = compileNativeVolumeRaster([mesh], { x: 0, y: 0, width, height: width, opticalHeight: 16 });
  const body = new NativeBodyCollision({ meshes: [mesh], definition: { instances: [{ id: 1, role: blocking ? 'solid' : 'relief' }] } } as unknown as R100NativeWorldData, map);
  let poreCount = 0;
  if (profile === 'porous-break') {
    const groups = cavities(raster); poreCount = groups.length;
    for (const g of groups) {
      minBottomPixels = Math.min(minBottomPixels, g.bottom.length);
      for (const p of g.pixels) { assert.equal(body.supports({ x: p % width + .5, y: Math.floor(p / width) + .5 }, 10, 10), !blocking); bodySamples++; }
      const p = g.bottom[0]!, target = { x: p % width + .5, y: Math.floor(p / width) + .5 };
      const dx = target.x - spec.x, dy = target.y - spec.y, localX = dx * Math.cos(spec.rotation) + dy * Math.sin(spec.rotation), localY = breadth! * .56 + 22;
      const start = { x: spec.x + localX * Math.cos(spec.rotation) - localY * Math.sin(spec.rotation), y: spec.y + localX * Math.sin(spec.rotation) + localY * Math.cos(spec.rotation) };
      assert(body.supports(start, 10, 10));
      const fraction = body.displacementFraction(start, 10, 10, target.x - start.x, target.y - start.y);
      if (blocking) assert(fraction < 1); else assert.equal(fraction, 1); sweepSamples++;
    }
    // Removing actual bottom material makes a visible empty recess fail even
    // if its sidewalls and source texture remain present.
    const broken = { ...raster, region: new Uint8Array(raster.region) };
    for (const p of groups[0]!.bottom) broken.region[p] = 2;
    assert.throws(() => cavities(broken), /bottom/);
  }
  cases.push({ profile, direction, length, width: breadth, height: tall, blocking, triangles: mesh.triangleCount, pores: poreCount });
}
assert(smoothSkinVertices > 0);
for (const constructionVersion of [1, 2, 3] as const) for (const shapeProfile of ['compressed-wedge', 'porous-break'] as const) assert.throws(() => validateNativeVolumeSpec({ ...base, constructionVersion, shapeProfile }));
const sources = ['src/generation/world-study/native-volume-organization.ts', 'src/generation/world-study/native-volume-ground.ts', 'src/generation/world-study/native-volume-geometry.ts', 'tools/world-study/check-native-organization.ts'].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
const report = { status: 'PASS', scope: 'Registered profiles, deterministic native meshes, angle-bounded skin normals, hard real cuts, sealed raster cavities and actual 20px-body blocking/relief. No authored world, source texture, grade pressure or normal-view art pass.', cases, maxTriangles, minBottomPixels, bodySamples, sweepSamples, flatCutVertices, smoothSkinVertices, negativeBottomCases: 32, negativeVersionCases: 6, sources };
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, cases: cases.length, maxTriangles, minBottomPixels, bodySamples, sweepSamples, smoothSkinVertices }));
