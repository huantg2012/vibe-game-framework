/** Exact pre-optimization oracle; candidate selection may change, body rules may not. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { NativeBodyCollision, type NativeBodyMotion } from '../../src/generation/world-study/native-body-collision';
import { NativeBodyCollision as OriginalBodyCollision } from './fixtures/native-body-collision-before-grid';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { createR100ProductionRecipe as revision6Recipe } from '../../src/generation/legacy-r100-v6/executor.js';
import { TileType } from '../../src/types/game-types';
import type { TileMapData } from '../../src/types/map-types';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import type { PhysicalSolidExemption } from '../../src/systems/ai/physical-grid';

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type Inspect = { solids: readonly Bounds[]; bucketOffsets: Uint32Array; bucketSolids: Uint32Array; candidateBits: Uint32Array;
  collectCandidates(left: number, top: number, right: number, bottom: number): void;
  trace(p: Point, w: number, h: number, dx: number, dy: number, exemption?: PhysicalSolidExemption): { fraction: number; normalX: number; normalY: number } };
const output = process.env.QA_REPORT ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/native-body-broad-phase.json';
assert(!existsSync(output), 'Never overwrite earlier evidence');
const sha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const oraclePath = 'tools/spatial-rollout/fixtures/native-body-collision-before-grid.ts';
const oracleText = readFileSync(oraclePath, 'utf8');
const originalSha = oracleText.match(/Source SHA-256: ([a-f0-9]{64})/)![1]!;
const normalizedOracle = oracleText.replace(/^\/\*\* Independent[\s\S]*?\*\/\n/, '')
  .replace("from '../../../src/generation/world-study/r100-native-data'", "from './r100-native-data'");
assert.equal(sha(normalizedOracle), originalSha, 'Oracle algorithms must remain verbatim pre-grid source');
const report: { status: string; oracle: unknown; cases: unknown[]; failure?: string; sources?: unknown } = {
  status: 'running', oracle: { path: oraclePath, fileSha256: sha(oracleText), originalSourceSha256: originalSha,
    normalization: 'Remove two provenance comment lines and relocate only one type-only import; remaining source bytes exact.' }, cases: [],
};
const save = (): void => writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const motion = (): NativeBodyMotion => ({ x: 0, y: 0, velocityX: 0, velocityY: 0, collided: false });
let random = 0x2debc613;
const next = (): number => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };

function verify(name: string, native: Pick<R100NativeWorldData, 'definition' | 'meshes'>, map: TileMapData, total: number): void {
  const begin = performance.now(), current = new NativeBodyCollision(native, map), prepareMs = performance.now() - begin;
  const original = new OriginalBodyCollision(native, map), inspector = current as unknown as Inspect, reference = original as unknown as Inspect;
  assert.equal(current.triangleCount, original.triangleCount);
  const actual = motion(), expected = motion(), width = map.cols * 8, height = map.rows * 8;
  let comparisons = 0, traces = 0, exemptions = 0, broadCoverage = 0;
  const legal: Point[] = [];
  const compare = (p: Point, halfW: number, halfH: number, dx: number, dy: number, velocity: Point, exemption?: PhysicalSolidExemption): void => {
    const label = `${name}/${comparisons++}: ${JSON.stringify({ p, halfW, halfH, dx, dy, velocity, exemption })}`;
    const supported = original.supports(p, halfW, halfH);
    assert.equal(current.supports(p, halfW, halfH), supported, `${label} supports`);
    assert.equal(current.displacementFraction(p, halfW, halfH, dx, dy, exemption), original.displacementFraction(p, halfW, halfH, dx, dy, exemption), `${label} displacement`);
    current.resolveMotion(p, halfW, halfH, dx, dy, velocity, actual);
    original.resolveMotion(p, halfW, halfH, dx, dy, velocity, expected);
    assert.deepEqual(actual, expected, `${label} all resolved position/velocity/collision fields`);
    if ([p.x, p.y, halfW, halfH, dx, dy].every(Number.isFinite) && halfW > 0 && halfH > 0) {
      assert.deepEqual(inspector.trace(p, halfW, halfH, dx, dy, exemption), reference.trace(p, halfW, halfH, dx, dy, exemption), `${label} trace fraction and equal-time normals`);
      traces++; if (exemption) exemptions++;
      if (comparisons < 100) {
        const left = Math.min(p.x, p.x + dx) - halfW, right = Math.max(p.x, p.x + dx) + halfW;
        const top = Math.min(p.y, p.y + dy) - halfH, bottom = Math.max(p.y, p.y + dy) + halfH;
        inspector.collectCandidates(left, top, right, bottom);
        for (let index = 0; index < inspector.solids.length; index++) {
          const s = inspector.solids[index]!;
          if (left <= s.maxX && right >= s.minX && top <= s.maxY && bottom >= s.minY) {
            assert((inspector.candidateBits[index >>> 5]! & (1 << (index & 31))) !== 0, `${label} conservative broad-phase coverage index ${index}`); broadCoverage++;
          }
        }
      }
    }
    if (supported && halfW === 10 && halfH === 10 && legal.length < 48) legal.push({ ...p });
  };
  const moves = [[0, 0], [1e-8, -1e-8], [64, 64], [-64, -64], [width * 2, height], [-width * 2, -height], [0, height * 2], [width, 0]];
  for (const x of [-40, 0, 10, 54, 64, 74, 118, 128, 138, width - 10, width, width + 32])
    for (const [dx, dy] of moves) compare({ x, y: 64 }, 10, 10, dx!, dy!, { x: dx!, y: dy! });
  for (let i = 0; i < total; i++) {
    const p = { x: -20 + next() * (width + 40), y: -20 + next() * (height + 40) };
    const halfW = i % 9 === 0 ? 2 : i % 13 === 0 ? 33 : 10, halfH = i % 11 === 0 ? 27 : 10;
    const dx = (next() - .5) * (i % 5 === 0 ? width * 3 : 160), dy = (next() - .5) * (i % 5 === 0 ? height * 3 : 160);
    const exemption = i % 7 === 0 ? { left: Math.floor((p.x + dx * .5) / 8) * 8, right: Math.floor((p.x + dx * .5) / 8) * 8 + 8,
      top: p.y - 40, bottom: p.y + 40 } : undefined;
    compare(p, halfW, halfH, dx, dy, { x: dx * .4, y: dy * .3 }, exemption);
  }
  for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
    compare({ x: 32, y: 32 }, value, 10, 2, 3, { x: 8, y: 9 });
    compare({ x: 32, y: 32 }, 10, value, 2, 3, { x: 8, y: 9 });
    compare({ x: value, y: 32 }, 10, 10, 2, 3, { x: 8, y: 9 });
    compare({ x: 32, y: 32 }, 10, 10, value, 3, { x: 8, y: 9 });
    compare({ x: 32, y: 32 }, 10, 10, 2, value, { x: 8, y: 9 });
    compare({ x: 32, y: 32 }, 10, 10, 2, 3, { x: value, y: 9 });
  }
  // Query reuse after early return, sign-bit words and partial final words.
  for (const index of [0, 31, 32, 63, 64, inspector.solids.length - 1]) if (index >= 0 && index < inspector.solids.length) {
    const s = inspector.solids[index]!;
    inspector.collectCandidates(s.minX, s.minY, s.maxX, s.maxY);
    assert((inspector.candidateBits[index >>> 5]! & (1 << (index & 31))) !== 0, `${name}: word-boundary source triangle ${index}`);
    compare({ x: (s.minX + s.maxX) / 2, y: (s.minY + s.maxY) / 2 }, 1, 1, 0, 0, { x: 0, y: 0 });
    compare({ x: width - 15, y: height - 15 }, 1, 1, 3, -2, { x: 8, y: -4 });
  }
  let localCandidates = 0;
  for (const p of legal) {
    inspector.collectCandidates(p.x - 12, p.y - 12, p.x + 12, p.y + 12);
    for (let word = 0; word < inspector.candidateBits.length; word++) { let bits = inspector.candidateBits[word]!; while (bits) { localCandidates++; bits &= bits - 1; } }
  }
  const bench = (body: NativeBodyCollision | OriginalBodyCollision): number => {
    const start = performance.now();
    for (let repeat = 0; repeat < 12; repeat++) for (let i = 0; i < legal.length; i++) body.resolveMotion(legal[i]!, 10, 10, i % 2 ? -1.4 : 1.4, i % 3 ? .9 : -.9, { x: 80, y: -40 }, actual);
    return performance.now() - start;
  };
  bench(current); bench(original);
  const currentMs: number[] = [], originalMs: number[] = [];
  for (let i = 0; i < 5; i++) { if (i % 2) { originalMs.push(bench(original)); currentMs.push(bench(current)); } else { currentMs.push(bench(current)); originalMs.push(bench(original)); } }
  currentMs.sort((a,b)=>a-b); originalMs.sort((a,b)=>a-b);
  const memoryBytes = inspector.bucketOffsets.byteLength + inspector.bucketSolids.byteLength + inspector.candidateBits.byteLength;
  report.cases.push({ name, triangles: current.triangleCount, comparisons, traces, exemptions, broadCoverage, prepareMs, memoryBytes,
    localMeanCandidates: legal.length ? localCandidates / legal.length : 0, benchmarkQueries: legal.length * 12,
    benchmarkCurrentMedianMs: currentMs[2], benchmarkOriginalMedianMs: originalMs[2], benchmarkScope: 'Same deterministic supported positions, 20px bodies and 1.4px local steps; CPU microbenchmark, not browser/FPS qualification.' });
  save(); console.log(`PASS ${name}: ${comparisons} exact queries, ${current.triangleCount} triangles, ${memoryBytes} index bytes`);
}

function fixture(triangles: number[][], withVoid: boolean): { native: Pick<R100NativeWorldData,'definition'|'meshes'>; map: TileMapData } {
  const positions = triangles.flat(), indices = Array.from({ length: positions.length / 3 }, (_, i) => i);
  const native = { definition: { instances: [{ id: 1, role: 'solid' }, { id: 2, role: 'relief' }] }, meshes: [
    { spec: { id: 1 }, positions: new Float32Array(positions), indices: new Uint32Array(indices) },
    { spec: { id: 2 }, positions: new Float32Array([0,0,0,640,0,0,0,512,0]), indices: new Uint32Array([0,1,2]) },
  ] } as unknown as Pick<R100NativeWorldData,'definition'|'meshes'>;
  return { native, map: { cols: 80, rows: 64, tileSize: 8,
    tiles: Array.from({ length: 64 }, (_, row) => Array.from({ length: 80 }, (_, col) => withVoid && ((col === 36 && row > 12 && row < 52) || (row === 42 && col < 15)) ? TileType.VOID : TileType.FLOOR)) } };
}
try {
  const empty = fixture([], false); verify('empty-solid-index', empty.native, empty.map, 200);
  const lattice = Array.from({ length: 97 }, (_, i) => { const x = 64 + i % 14 * 36, y = 64 + Math.floor(i / 14) * 55; return [x,y,0,x+12,y,0,x,y+15,0]; });
  lattice.push([-100,40,0,20,80,0,-60,190,0], [610,300,0,760,300,0,680,460,0], [15,-100,0,220,20,0,300,-50,0],
    [80,480,0,20,600,0,330,550,0], [400,40,0,460,40,0,460,100,0], [400,40,0,460,100,0,400,100,0],
    [128,128,0,128,192,0,192,128,0], [128,128,0,192,128,0,128,192,0], [64,64,0,64,64,0,64,64,0]);
  const synthetic = fixture(lattice, true); verify('bucket-edges-overflow-ties-void-exemptions', synthetic.native, synthetic.map, 2200);
  if (!process.argv.includes('--synthetic-only')) {
    for (const world of ['ash-strata','crystal-fibre','ivory-basin','cinder-ridge','pallid-membrane','silt-gel','woven-quarters']) {
      const production = createR100ProductionMap(createR100ProductionRecipe(world,20261010,'medium'));
      verify(`r7/${world}`, production.native!, production.layout.tileMap, 650);
      globalThis.gc?.();
    }
    for (const world of ['crystal-fibre','cinder-ridge','short-fibre-mat']) {
      const production = createR100ProductionMap(revision6Recipe(world,20261010,'medium'));
      verify(`r6/${world}`, production.native!, production.layout.tileMap, 650);
      globalThis.gc?.();
    }
  }
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error instanceof Error ? error.stack : String(error); }
report.sources = ['src/generation/world-study/native-body-collision.ts', oraclePath, 'tools/spatial-rollout/check-native-body-broad-phase.ts']
  .map(path => ({ path, sha256: sha(readFileSync(path)) }));
save(); if (report.failure) throw new Error(report.failure);
