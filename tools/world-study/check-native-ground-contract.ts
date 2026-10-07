/** Construction 4 contract checks. Geometric clipping is independent of the
 * runtime body's SAT implementation. This is not an art or play admission. */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { buildNativeVolume, validateNativeVolumeSpec, NATIVE_VOLUME_V4_PROFILES, type NativeVolumeSpec, type NativeVolumeMesh } from '../../src/generation/world-study/native-volume-geometry';
import { validateNativeErosion, parseNativeErosionCell } from '../../src/generation/world-study/native-volume-erosion';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import { TileType } from '../../src/types/game-types';

const output = process.argv[2] ?? 'docs/qa/artifacts/r100-i10-i12/b01-geometry/contract.json';
const baseline = 'd194be4c';
const baselineText = execFileSync('git', ['show', `${baseline}:src/generated/r100-native-worlds.ts`], { encoding: 'utf8' });
const catalogPrefix = 'export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ';
const oldWorlds = JSON.parse(baselineText.slice(baselineText.indexOf(catalogPrefix) + catalogPrefix.length).replace(/;\s*$/, ''));
assert.equal(oldWorlds.length, 52);
assert.deepEqual(R100_NATIVE_WORLDS.slice(0, 52), oldWorlds, 'old 52 author definitions/profile data changed');
const oldCsv = execFileSync('git', ['show', `${baseline}:data/rift-native-worlds.csv`], { encoding: 'utf8' }).trimEnd().split('\n');
const newCsv = readFileSync('data/rift-native-worlds.csv', 'utf8').trimEnd().split('\n');
assert.deepEqual(newCsv.slice(0, 53).map(row => row.split(',').slice(0, oldCsv[0]!.split(',').length).join(',')), oldCsv.map((row, i) => i === 0 ? row : row), 'old 52 CSV fields must remain verbatim');
let oldErosion = 0;
for (const world of oldWorlds) for (const definition of world.definitions) { validateNativeErosion(definition.erosion, definition.cols * 32, definition.rows * 32); oldErosion++; }
const temporary = mkdtempSync(join(tmpdir(), 'coh-v4-geometry-'));
let oldMeshes = 0;
try {
  // Resolve the entire historical geometry closure from Git, never through
  // current modules. Explicit new profiles may extend today's v3 dispatcher
  // while these old inputs must still produce the exact historical mesh.
  for (const file of ['native-volume-geometry.ts', 'native-volume-expansion.ts', 'native-volume-cellular.ts'])
    writeFileSync(join(temporary, file), execFileSync('git', ['show', `${baseline}:src/generation/world-study/${file}`]));
  const bundled = join(temporary, 'baseline.mjs');
  buildSync({ entryPoints: [join(temporary, 'native-volume-geometry.ts')], outfile: bundled, platform: 'node', format: 'esm', bundle: true, logLevel: 'silent' });
  const previous = await import(pathToFileURL(bundled).href) as { buildNativeVolume: typeof buildNativeVolume };
  for (const world of oldWorlds) for (const definition of world.definitions) for (const instance of definition.instances) {
    const { role, ...geometry } = instance;
    const spec = { ...geometry, family: instance.family ?? definition.family, seed: 20261005 ^ Math.imul(instance.id, 104729), blocking: role === 'solid' ? 1 : 0 };
    const current = buildNativeVolume(spec), old = previous.buildNativeVolume(spec);
    for (const field of ['positions', 'normals', 'uv', 'indices', 'materials', 'regions', 'bounds', 'joints'] as const) assert.deepEqual(current[field], old[field], `${definition.id}/${instance.id}/${field}`);
    oldMeshes++;
  }
} finally { rmSync(temporary, { recursive: true, force: true }); }

type Point = { x: number; y: number };
const area = (polygon: readonly Point[]): number => Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]!; return sum + a.x * b.y - a.y * b.x; }, 0)) / 2;
function clip(points: readonly Point[], axis: 'x' | 'y', boundary: number, greater: boolean): Point[] {
  const result: Point[] = [], inside = (p: Point) => greater ? p[axis] >= boundary : p[axis] <= boundary;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) { const t = (boundary - a[axis]) / (b[axis] - a[axis]); result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  }
  return result;
}
function triangles(mesh: NativeVolumeMesh): Point[][] {
  const result: Point[][] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = [0, 1, 2].map(corner => { const at = mesh.indices[i + corner]! * 3; return { x: mesh.positions[at]!, y: mesh.positions[at + 1]! }; });
    if (area(points) > 1e-7) result.push(points);
  }
  return result;
}
const blocked = (faces: readonly Point[][], p: Point): boolean => faces.some(face => area(clip(clip(clip(clip(face, 'x', p.x - 10, true), 'x', p.x + 10, false), 'y', p.y - 10, true), 'y', p.y + 10, false)) > 1e-6);
const map = { cols: 100, rows: 100, tileSize: 8, tiles: Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => TileType.FLOOR)) };
const base: NativeVolumeSpec = { id: 1, seed: 41701, family: 'broken-shell', x: 400, y: 400, rotation: 0, length: 330, width: 240, height: 54, thickness: 12,
  fold: .6, branches: 3, opening: .7, distortion: .3, constructionVersion: 4, shapeProfile: 'clamp-bank', blocking: 1 };
let bodySamples = 0, sweepSamples = 0, rejections = 0;
const shapeMetrics: unknown[] = [];
for (const shapeProfile of NATIVE_VOLUME_V4_PROFILES) for (const rotation of [0, .43, -1.1]) {
  if (shapeProfile === 'settled-sheet' || shapeProfile === 'settled-fan') {
    const input = { ...base, shapeProfile, rotation, height: 5, blocking: 0 }, mesh = buildNativeVolume(input);
    assert(mesh.triangleCount > 0 && mesh.triangleCount < 600);
    assert([...mesh.positions, ...mesh.normals, ...mesh.uv].every(Number.isFinite));
    assert(mesh.materials.every(slot => slot === 0) && mesh.joints.length === 0, 'settled relief is intact non-emissive skin');
    assert(mesh.positions.some((v, i) => i % 3 === 2 && v === 0), 'settled edge reaches the real floor');
    assert.throws(() => validateNativeVolumeSpec({ ...input, blocking: 1 })); rejections++;
    assert.throws(() => validateNativeVolumeSpec({ ...input, height: 7 })); rejections++;
    shapeMetrics.push({ shapeProfile, rotation, triangles: mesh.triangleCount, role: 'relief-only', bounds: mesh.bounds });
    continue;
  }
  const mesh = buildNativeVolume({ ...base, shapeProfile, rotation }), faces = triangles(mesh);
  assert([...mesh.positions, ...mesh.normals, ...mesh.uv].every(Number.isFinite));
  assert(mesh.triangleCount > 0 && mesh.triangleCount < 600);
  assert(mesh.positions.some((v, i) => i % 3 === 2 && v === 0), 'real grounded lower edge');
  const cutArea = Array.from(mesh.materials).reduce((sum, material, face) => {
    if (material !== 1) return sum;
    return sum + area([0, 1, 2].map(corner => { const at = mesh.indices[face * 3 + corner]! * 3; return { x: mesh.positions[at]!, y: mesh.positions[at + 1]! }; }));
  }, 0);
  assert(cutArea > 100, 'solid cut faces must occupy real top-down area');
  assert.equal(mesh.joints.length, 1, 'one actual fracture source per solid');
  assert(mesh.materials.includes(3));
  for (let i = 0; i < mesh.normals.length; i += 3) assert(Math.abs(Math.hypot(mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!) - 1) < 1e-5);
  const native = { meshes: [mesh], definition: { instances: [{ id: 1, role: 'solid' }] } } as unknown as R100NativeWorldData;
  const body = new NativeBodyCollision(native, map);
  for (let i = 0; i < 200; i++) {
    const p = { x: 175 + ((Math.imul(i + 3, 1664525) >>> 0) % 997) / 997 * 450, y: 200 + ((Math.imul(i + 1, 1103515245) >>> 0) % 991) / 991 * 400 };
    assert.equal(body.supports(p, 10, 10), !blocked(faces, p), `${shapeProfile}/${rotation}/${i}`); bodySamples++;
    if (body.supports(p, 10, 10)) {
      const dx = Math.cos(i) * 37, dy = Math.sin(i) * 37, fraction = body.displacementFraction(p, 10, 10, dx, dy);
      for (let step = 1; step <= 6; step++) { assert(!blocked(faces, { x: p.x + dx * fraction * step / 6, y: p.y + dy * fraction * step / 6 })); sweepSamples++; }
    }
  }
  const relief = new NativeBodyCollision({ ...native, definition: { instances: [{ id: 1, role: 'relief' }] } } as unknown as R100NativeWorldData, map);
  const face = faces[0]!, centre = { x: face.reduce((n, p) => n + p.x, 0) / 3, y: face.reduce((n, p) => n + p.y, 0) / 3 };
  assert(relief.supports(centre, 10, 10), 'relief remains walkable');
  shapeMetrics.push({ shapeProfile, rotation, triangles: mesh.triangleCount, cutProjectedArea: cutArea, bounds: mesh.bounds });
}
for (const patch of [{ constructionVersion: 3 }, { constructionVersion: 4, shapeProfile: 'rib-vault' }, { constructionVersion: 2 }, { shapeProfile: 'unregistered' }, { unknown: 1 }]) {
  assert.throws(() => validateNativeVolumeSpec({ ...base, ...patch } as NativeVolumeSpec)); rejections++;
}
assert.throws(() => buildNativeVolume({ ...base, height: 6, blocking: 0, groundEdgeWidth: 16 })); rejections++;
assert.throws(() => buildNativeVolume({ ...base, groundEdgeWidth: 16 })); rejections++;
assert.equal(parseNativeErosionCell('', 1), undefined);
const valid = '0:0;100:0;100:100;0:100|140:20;160:20;160:40;140:40';
assert.equal(parseNativeErosionCell(valid, 4)?.length, 2);
const invalid = ['', '0:0;100:100;0:80;100:0', '0:0;100:0;50:0;50:80', '0:0;100:0;100:100;0:0', '0:0;1:0;0:1', '-1:0;100:0;100:100', '0:0;1025:0;100:100', '0:0;Infinity:0;100:100', '0:0;100:0;100:100;0:100|50:50;60:50;60:70;50:70', '0:0;100:0;100:100;0:100|100:50;120:50;120:80;100:80'];
for (const value of invalid) { assert.throws(() => value ? parseNativeErosionCell(value, 4) : validateNativeErosion([])); rejections++; }
assert.throws(() => parseNativeErosionCell(valid, 3)); rejections++;
assert.throws(() => validateNativeErosion([[{ x: 0, y: 0, z: 1 }, { x: 20, y: 0 }, { x: 0, y: 20 }]])); rejections++;
const report = { status: 'PASS', baseline, oldWorldDefinitions: 52, oldMeshesExact: oldMeshes, oldErosionDefinitions: oldErosion, bodySamples, sweepSamples, negativeContracts: rejections, shapeMetrics,
  scope: 'Exact old author data and geometry; independent 20px rectangle/mesh clipping and stopped sweeps; CSV and runtime erosion rejection. No art, full-world deployment, or formal play admission.' };
mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
