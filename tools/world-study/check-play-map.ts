import assert from 'node:assert/strict';
import { createWorldPlayMap, findWorldPlayRoute } from '../../src/generation/world-study/play-map';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { SPACE_PROFILES } from '../../src/generation/world-study/space-profile';
import { getWorldSupportGrid } from '../../src/generation/world-study/support';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';

const outcomes: unknown[] = [];
for (const world of WORLD_PROFILES) for (const space of SPACE_PROFILES) for (const seed of [70421, 175150, 0]) {
  const map = createWorldPlayMap(world.id, space.id, seed), { layout } = map;
  const support = getWorldSupportGrid(map.sample), grid = new TileGrid(layout.tileMap);
  assert.equal(grid.cols * grid.tileSize, 1792); assert.equal(grid.rows * grid.tileSize, 1216);
  assert.equal(grid.tileSize, 8); assert.equal(map.metadata.bodySize, 20);
  assert.equal(layout.fragmentTypeId, `world-study:${world.id}`);
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    const expected = support.walkable[row * grid.cols + col] === 1;
    assert.equal(grid.isWalkable(col, row), expected);
    assert.equal(grid.isOpaque(col, row), !expected);
    assert.equal(layout.tileMap.tiles[row]![col], expected ? TileType.FLOOR : TileType.VOID);
  }
  assert.equal(layout.enemySpawns.length, 2);
  assert.equal(layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
  const points = [layout.spawnPoint, layout.extractionPoint.position,
    ...layout.kindlingNodes.map(node => node.position), ...layout.contaminantNodes.map(node => node.position)];
  for (const target of points) {
    assert(bodyHasSupport(grid, target, 10, 10));
    const path = findWorldPlayRoute(map, layout.spawnPoint, target);
    assert(path.length > 0);
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1]!, to = path[i]!;
      assert.equal(bodyDisplacementFraction(grid, from, 10, 10, to.x - from.x, to.y - from.y), 1, 'Route crosses missing support');
    }
  }
  for (const enemy of layout.enemySpawns) {
    const waypoints = enemy.patrol.waypoints.map(point => ({ x: (point.col + .5) * grid.tileSize, y: (point.row + .5) * grid.tileSize }));
    waypoints.forEach(point => assert(bodyHasSupport(grid, point, 10, 10)));
    for (let i = 1; i < waypoints.length; i++) {
      const from = waypoints[i - 1]!, to = waypoints[i]!;
      assert.equal(bodyDisplacementFraction(grid, from, 10, 10, to.x - from.x, to.y - from.y), 1);
    }
  }
  outcomes.push(map.metadata);
}
const repeat = createWorldPlayMap(WORLD_PROFILES[0]!.id, SPACE_PROFILES[0]!.id, 70421);
assert.equal(repeat.metadata.signature, (outcomes[0] as typeof repeat.metadata).signature);
for (const seed of [-1, .5, NaN, Infinity, 0x100000000]) assert.throws(() => createWorldPlayMap(WORLD_PROFILES[0]!.id, SPACE_PROFILES[0]!.id, seed));
assert.throws(() => createWorldPlayMap(WORLD_PROFILES[0]!.id, 'unknown', 7));
console.log(JSON.stringify({ passed: outcomes.length, nativeBody: '20×20', world: '1792×1216', support: 8, outcomes }, null, 2));
