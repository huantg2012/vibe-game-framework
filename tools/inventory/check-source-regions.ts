import assert from 'node:assert/strict';
import { createContaminantSourceRegions } from '../../src/generation/contaminant-source-regions';
import { createContaminantDropPlan } from '../../src/systems/contaminant-drop-plan';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';

const grid = (rows: string[]) => new TileGrid({ cols: rows[0]!.length, rows: rows.length, tileSize: 32,
  tiles: rows.map(row => [...row].map(char => char === '.' ? TileType.FLOOR : TileType.VOID)) });
const node = (id: string, col: number, row: number) => ({ id, position: { x: col * 32 + 16, y: row * 32 + 16 } });
const floor = grid(['.......', '.#####.', '.#####.', '.#####.', '.......']);
const nodes = [node('a', 0, 0), node('b', 0, 4), node('c', 6, 2), node('fuel', 0, 1)];
const args = { grid: floor, spawn: nodes[0]!.position, nodes, seed: 20260920 };
const regions = createContaminantSourceRegions(args);
assert.deepEqual(regions, createContaminantSourceRegions({ ...args, nodes: [...nodes].reverse() }), 'Node iteration order may not move districts');
assert.equal(new Set([...regions.values()].map(value => value.sourceTag)).size, 2);
assert.equal(regions.get('a')!.sourceTag, regions.get('fuel')!.sourceTag, 'Fuel must publish the same nearby district signal');
assert.ok([...regions.values()].every(value => value.hint && value.sourceTag !== 'unbiased'));
const noPath = grid(['..#..', '..#..']);
const isolated = [node('reachable-a', 0, 0), node('reachable-b', 1, 1), node('sealed', 4, 1)];
const split = createContaminantSourceRegions({ grid: noPath, spawn: isolated[0]!.position, nodes: isolated, seed: 10 });
assert.equal(split.get('sealed')!.sourceTag, 'unbiased', 'No source promise across unreachable void');
assert.equal(createContaminantSourceRegions({ ...args, nodes: [nodes[0]!] }).get('a')!.sourceTag, 'unbiased');
for (let seed = 0; seed < 40; seed++) {
  const source = createContaminantSourceRegions({ ...args, seed });
  const plan = createContaminantDropPlan({ runId: 'test', runSeed: seed,
    nodes: nodes.slice(0, 3).map(n => ({ id: n.id, tier: 'safe', sourceTag: source.get(n.id)!.sourceTag })) });
  assert.equal(plan.entries.length, 3);
  assert.deepEqual(source, createContaminantSourceRegions({ ...args, seed }), 'Item roll must not change the public district');
}
console.log('PASS source districts: geodesic split, stable order, shared fuel hints, disconnected fallback, independent item rolls');
