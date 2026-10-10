/** Directed counterexamples: crossing whole buckets, active exemptions and VOID. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { NativeBodyCollision as OriginalBodyCollision } from './fixtures/native-body-collision-before-grid';
import { TileType } from '../../src/types/game-types';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import type { TileMapData } from '../../src/types/map-types';

const native = { definition: { instances: [{ id: 1, role: 'solid' }] }, meshes: [{ spec: { id: 1 },
  positions: new Float32Array([80,0,0,88,0,0,88,256,0,80,256,0]), indices: new Uint32Array([0,1,2,0,2,3]),
}] } as unknown as R100NativeWorldData;
const map: TileMapData = { tileSize: 8, cols: 64, rows: 32, tiles: Array.from({ length: 32 }, () => Array.from({ length: 64 }, () => TileType.FLOOR)) };
const source = { x: 32, y: 100 }, dx = 400, exemption = { left: 80, right: 88, top: 0, bottom: 256 };
const current = new NativeBodyCollision(native, map), original = new OriginalBodyCollision(native, map);
assert(current.supports(source, 10, 10)); assert(current.supports({ x: source.x + dx, y: source.y }, 10, 10));
const stopped = current.displacementFraction(source, 10, 10, dx, 0);
assert(stopped > 0 && stopped < .1, 'Clear destination cannot skip a thin wall in a crossed bucket');
assert.equal(stopped, original.displacementFraction(source, 10, 10, dx, 0));
const exempted = current.displacementFraction(source, 10, 10, dx, 0, exemption);
assert.equal(exempted, 1, 'A complete actual single-wall exemption must have an observable effect');
assert.equal(exempted, original.displacementFraction(source, 10, 10, dx, 0, exemption));
const partial = { ...exemption, bottom: 95 };
assert.equal(current.displacementFraction(source, 10, 10, dx, 0, partial), stopped, 'A partial clip retains the non-exempt piece');
assert.equal(current.displacementFraction(source, 10, 10, dx, 0, partial), original.displacementFraction(source, 10, 10, dx, 0, partial));
const voidMap = { ...map, tiles: map.tiles.map(row => row.map((tile, col) => col === 28 ? TileType.VOID : tile)) };
const withVoid = new NativeBodyCollision(native, voidMap), oldVoid = new OriginalBodyCollision(native, voidMap);
const voidStop = withVoid.displacementFraction(source, 10, 10, dx, 0, exemption);
assert(voidStop > stopped && voidStop < 1, 'Exemption may bypass solid but never the later VOID');
assert.equal(voidStop, oldVoid.displacementFraction(source, 10, 10, dx, 0, exemption));
for (let i = 0; i < 100; i++) {
  assert(!current.supports({ x: 84, y: 100 }, 10, 10), 'Early SAT return leaves a populated candidate set');
  assert(current.supports({ x: 400, y: 200 }, 10, 10), 'Next disjoint query cannot inherit stale bits');
}
const result = { status: 'passed', clearEndpointLongSweepStopped: stopped, fullExemption: exempted, laterVoidStillStopped: voidStop,
  repeatedEarlyReturnThenClearQueries: 100, checks: ['whole 400px sweep', 'effective full exemption', 'partial exemption remains solid', 'exemption cannot bypass VOID', 'candidate-set reuse'],
  sources: ['src/generation/world-study/native-body-collision.ts', 'tools/spatial-rollout/check-native-body-broad-phase-edges.ts', 'tools/spatial-rollout/fixtures/native-body-collision-before-grid.ts']
    .map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })) };
writeFileSync(process.env.QA_REPORT ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/native-body-broad-phase-edges.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
