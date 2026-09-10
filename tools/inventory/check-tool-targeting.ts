import assert from 'node:assert/strict';
import { findSingleWallLanding, findSoundLureLanding, selectNearestVisibleTarget, type SingleWallLandingInput } from '../../src/systems/tool-targeting';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType, type Vector2 } from '../../src/types/game-types';
import { hasLineOfSight } from '../../src/utils/grid-raycast';

function gridWith(solids: readonly [number, number, TileType?][] = []): TileGrid {
  const tiles = Array.from({ length: 6 }, () => Array<number>(6).fill(TileType.FLOOR));
  for (const [col, row, tile] of solids) tiles[row]![col] = tile ?? TileType.WALL;
  return new TileGrid({ cols: 6, rows: 6, tileSize: 32, tiles });
}

const origin = { x: 48, y: 48 };
const targetingGrid = gridWith([[2, 1]]);
const targets = [
  { id: 'dead', x: 49, y: 48, alive: false, visible: true },
  { id: 'unseen', x: 50, y: 48, alive: true, visible: false },
  { id: 'wall', x: 100, y: 48, alive: true, visible: true },
  { id: 'visible', x: 48, y: 104, alive: true, visible: true },
  { id: 'tie', x: 48, y: 104, alive: true, visible: true },
];
const policy = {
  getPosition: (target: typeof targets[number]) => target,
  isAlive: (target: typeof targets[number]) => target.alive,
  isVisible: (target: typeof targets[number]) => target.visible,
  hasLineOfSight: (from: Readonly<Vector2>, to: Readonly<Vector2>) => hasLineOfSight(targetingGrid, from, to),
};
assert.equal(selectNearestVisibleTarget(origin, targets, policy)?.id, 'visible', 'nearest eligible candidate wins; dead/unseen/walled candidates cannot consume targeting');
assert.equal(selectNearestVisibleTarget(origin, targets, { ...policy, maxDistance: 55 }), null);
assert.equal(selectNearestVisibleTarget(origin, targets, { ...policy, maxDistance: 56 })?.id, 'visible', 'range boundary is inclusive');
assert.equal(selectNearestVisibleTarget(origin, targets.slice(0, 3), policy), null);
assert.equal(selectNearestVisibleTarget(origin, [], policy), null);
assert.equal(selectNearestVisibleTarget(origin, targets, { ...policy, maxDistance: -1 }), null);
assert.equal(selectNearestVisibleTarget({ x: NaN, y: 0 }, targets, policy), null);

function phase(grid: TileGrid, overrides: Partial<SingleWallLandingInput> = {}): Vector2 | null {
  return findSingleWallLanding({
    origin, direction: { x: 1, y: 0 }, maxDistance: 120,
    bodyHalfWidth: 10, bodyHalfHeight: 10, grid,
    isPhaseableWall: (col, row) => {
      assert(col >= 0 && col < grid.cols && row >= 0 && row < grid.rows, 'wall classifier is never asked about map boundary');
      return grid.getTile(col, row) === TileType.WALL;
    },
    ...overrides,
  });
}

const oneWall = gridWith([[2, 1]]);
const landing = phase(oneWall);
assert(landing);
assert(Math.abs(landing.x - 106) < 0.001);
assert.equal(landing.y, 48);
assert.equal(phase(oneWall, { direction: { x: 9, y: 0 } })?.x, landing.x, 'direction normalization preserves landing');
assert(phase(oneWall, { origin: { x: 54, y: 48 } }), 'contact with near face is a valid start');
assert.equal(phase(oneWall, { origin: { x: 60, y: 48 } }), null, 'starting inside geometry is not a recovery teleport');
assert.equal(phase(oneWall, { maxDistance: 57 }), null, 'range covers complete trailing body clearance');
assert.equal(phase(gridWith()), null, 'ordinary open floor cannot spend a wall-crossing use');
assert.equal(phase(gridWith([[2, 1, TileType.VOID]])), null, 'VOID is never phaseable');
assert.equal(phase(gridWith([[2, 1], [3, 1]])), null, 'two tiles thick is rejected');
assert(phase(gridWith([[2, 1], [2, 2]]), { origin: { x: 48, y: 60 } }), 'a continuous one-tile-thick wall is phaseable across a brick seam');
assert.equal(phase(gridWith([[2, 1], [2, 2], [3, 2]]), { origin: { x: 48, y: 60 } }), null, 'a second wall thickness beside the centre ray still blocks the swept body');
assert(phase(gridWith([[1, 2], [2, 2]]), { origin: { x: 60, y: 48 }, direction: { x: 0, y: 1 } }), 'vertical crossing also accepts a continuous wall seam');
assert(phase(gridWith([[2, 1], [2, 2]]), { origin: { x: 144, y: 60 }, direction: { x: -1, y: 0 } }), 'reverse crossing shares the same wall-thickness rule');
assert.equal(phase(gridWith([[2, 1], [2, 2, TileType.VOID]]), { origin: { x: 48, y: 60 } }), null, 'adjacent VOID is never part of a phaseable wall plane');
assert.equal(phase(gridWith([[2, 1], [3, 2, TileType.VOID]]), { direction: { x: 1, y: 0.25 } }), null, 'a clear centre landing cannot hide body overlap with VOID');
assert.equal(phase(gridWith([[5, 1]])), null, 'far map-edge wall has no body-safe landing');
assert.equal(phase(gridWith([[5, 1]]), { origin: { x: 144, y: 48 } }), null);
assert.equal(phase(oneWall, { origin: { x: 4, y: 48 } }), null, 'initial body cannot cross map bounds');
assert.equal(phase(oneWall, { direction: { x: 0, y: 0 } }), null);
assert.equal(phase(oneWall, { bodyHalfWidth: 0 }), null);
assert.equal(phase(oneWall, { maxDistance: Infinity }), null);

const diagonal = phase(gridWith([[2, 2]]), { direction: { x: 1, y: 1 } });
assert(diagonal && Math.abs(diagonal.x - 106) < 0.001 && Math.abs(diagonal.y - 106) < 0.001, 'one isolated tile can be crossed diagonally with complete body clearance');
assert.equal(phase(gridWith([[2, 1], [1, 2]]), { direction: { x: 1, y: 1 } }), null, 'diagonal seam does not turn two walls into a valid crossing');
assert.equal(phase(gridWith([[2, 2], [3, 2]]), { direction: { x: 1, y: 1 } }), null, 'swept body cannot clip a second tile even if final position is clear');
const vertical = phase(gridWith([[1, 2]]), { direction: { x: 0, y: 1 } });
assert(vertical && vertical.x === 48 && Math.abs(vertical.y - 106) < 0.001);
const reverse = phase(oneWall, { origin: { x: 144, y: 48 }, direction: { x: -1, y: 0 } });
assert(reverse && Math.abs(reverse.x - 54) < 0.001);

Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => 'zh-CN' }, configurable: true });
const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
const search = new LootSearchSystem();
const searchState = search as unknown as { nodes: Array<{ kind: 'kindling' | 'contaminant'; position: Vector2; collected: boolean }> };
searchState.nodes = [
  { kind: 'kindling', position: { x: 1, y: 1 }, collected: true },
  { kind: 'kindling', position: { x: 2, y: 2 }, collected: false },
  { kind: 'contaminant', position: { x: 3, y: 3 }, collected: true },
  { kind: 'contaminant', position: { x: 4, y: 4 }, collected: false },
];
assert.deepEqual(search.getCollectedKindlingPositions(), [{ x: 1, y: 1 }], 'bonus fuel only reads searched kindling nodes');
assert.deepEqual(search.getCollectedContaminantPositions(), [{ x: 3, y: 3 }], 'existing independent contaminant query remains intact');
assert.deepEqual(search.getUncollectedSearchPositions(), [{ x: 2, y: 2 }, { x: 4, y: 4 }], 'discovery continues to include both unrevealed pile kinds');
console.log('PASS: visible live targeting, single-wall swept-body landing, and searched-kindling query');

assert.deepEqual(findSoundLureLanding(origin, { x: 1, y: 0 }, 96, gridWith(), 20), { x: 144, y: 48 });
assert.equal(findSoundLureLanding(origin, { x: 1, y: 0 }, 96, oneWall, 20), null, 'too close to a wall to throw: no charge');
assert.deepEqual(findSoundLureLanding(origin, { x: 1, y: 0 }, 96, gridWith([[3, 1]]), 20), { x: 95, y: 48 }, 'throw stops before wall rather than appearing behind it');
assert.deepEqual(findSoundLureLanding(origin, { x: 1, y: 0 }, 300, gridWith(), 20), { x: 191, y: 48 }, 'throw clips at map edge');
assert.equal(findSoundLureLanding(origin, { x: 1, y: 1 }, 96, gridWith([[2, 1], [1, 2]]), 24), null, 'diagonal seam cannot throw through two corners');
assert.equal(findSoundLureLanding(origin, { x: 0, y: 0 }, 96, gridWith(), 20), null);
console.log('Sound lure throw geometry: 6 checks passed');
