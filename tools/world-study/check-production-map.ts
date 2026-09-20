/** Focused production wiring contract; deliberately not a broad balance sweep. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { rollPaintHostCount, supportsRuntimeForm } from '../../src/generation/contamination-draw';
import { evaluateDualPath } from '../../src/generation/dual-path';
import { mix32 } from '../../src/generation/seed-fork';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { SPACE_PROFILES } from '../../src/generation/world-study/space-profile';
import { getWorldSupportGrid } from '../../src/generation/world-study/support';
import { createAIRuntimeConfiguration } from '../../src/systems/ai/ai-system';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { colonyNucleusSeatsInFloors, resolveStopLoss } from '../../src/systems/contamination-host-live';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';

const options = { contentFragmentTypeId: 'frag-library' };
const records = [];
for (const [worldId, spaceId, seed] of [
  ['ash-strata', 'open-scars', 70421],
  ['crystal-fibre', 'fracture-fields', 175150],
  ['ivory-basin', 'open-scars', 0],
  ['ash-strata', 'open-scars', 5],
] as const) {
  const map = createWorldProductionMap(worldId, spaceId, seed, options), { layout } = map;
  const grid = new TileGrid(layout.tileMap), host = new TileGrid(map.hostTileMap), support = getWorldSupportGrid(map.sample);
  assert.equal(grid.tileSize, 8); assert.equal(host.tileSize, 32);
  assert.equal(layout.fragmentTypeId, `world-study:${worldId}`);
  assert.equal(grid.widthPx, host.widthPx); assert.equal(grid.heightPx, host.heightPx);
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    const floor = support.walkable[row * grid.cols + col] === 1;
    assert.equal(grid.isWalkable(col, row), floor, 'Physics may not coarsen or invent the accepted terrain');
    assert.equal(grid.isOpaque(col, row), !floor);
    assert.equal(layout.tileMap.tiles[row]![col], floor ? TileType.FLOOR : TileType.VOID);
  }
  const coarseFloor = new Uint8Array(host.cols * host.rows);
  for (let row = 0; row < host.rows; row++) for (let col = 0; col < host.cols; col++) {
    assert.notEqual(map.hostTileMap.tiles[row]![col], TileType.WALL, 'Void is not an invented wall Host');
    if (!host.isWalkable(col, row)) continue;
    coarseFloor[row * host.cols + col] = 1;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) assert(grid.isWalkable(col * 4 + x, row * 4 + y));
  }
  const start = Math.floor(layout.spawnPoint.y / 32) * host.cols + Math.floor(layout.spawnPoint.x / 32);
  const end = Math.floor(layout.extractionPoint.position.y / 32) * host.cols + Math.floor(layout.extractionPoint.position.x / 32);
  const routes = evaluateDualPath(coarseFloor, Uint8Array.from(coarseFloor, floor => floor ? 0 : 1), host.cols, host.rows, start, end);
  assert(routes.mainSteps > 0 && routes.altSteps > 0, 'Open-world still requires a distinct reachable alternative');
  assert.equal(layout.kindlingNodes.length, 8);
  assert.deepEqual(['safe', 'contested', 'deep'].map(tier => layout.kindlingNodes.filter(node => node.tier === tier).length), [3, 3, 2]);
  assert.equal(layout.contaminantNodes.length, 3);
  assert(layout.enemySpawns.length >= 3 && layout.enemySpawns.length <= 4);
  assert.equal(layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
  assert(layout.contaminationDraw.forms.every(supportsRuntimeForm));
  const paint = layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing');
  assert.equal(paint.length, rollPaintHostCount(layout.seed, layout.contaminationAge));
  assert.equal(paint.length, layout.contaminationPins.paintFloors.length);
  for (const target of [layout.spawnPoint, layout.extractionPoint.position,
    ...layout.kindlingNodes.map(node => node.position), ...layout.contaminantNodes.map(node => node.position)])
    assert(bodyHasSupport(grid, target, 10, 10));
  // The actual AI configuration must keep production patrols and clear sweeps.
  const ai = createAIRuntimeConfiguration(layout.enemySpawns, grid);
  for (const enemy of ai.enemies) {
    const form = layout.enemySpawns.find(spawn => spawn.id === enemy.id)!.form!;
    if (form.lexemes.motion === 'motion_patrol') assert.equal(enemy.patrolMode, 'pingpong');
    for (const route of enemy.patrolPaths) if (route) for (let i = 1; i < route.length; i++) {
      const a = route[i - 1]!, b = route[i]!;
      assert.equal(bodyDisplacementFraction(grid, a, 10, 10, b.x - a.x, b.y - a.y), 1, 'Native patrol route crosses missing support');
    }
  }
  for (const [slot, form] of paint.entries()) {
    const pin = layout.contaminationPins.paintFloors[slot]!, paintSeed = mix32(layout.seed, `ENM_BING_${String(slot + 1).padStart(2, '0')}`);
    const baked = bakePaintGenome({ substrate: form.substrate, coverage: form.coverage, seed: paintSeed,
      continuity: form.continuity, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId, veinVariant: resolvePaintVeinVariant(form.substrate, paintSeed) });
    const floors = collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH,
      (pin.floorCol + .5) * 32, (pin.floorRow + .5) * 32, 32).filter(point => host.isWalkable(point.col, point.row));
    assert(floors.length > 0, 'Real production Host paint must survive its terrain crop');
    const stop = resolveStopLoss(form), c = GAME_CONSTANTS.CONTAMINATION;
    assert.notEqual(stop, 'illegal');
    if (stop !== 'illegal' && stop.family === 'scatter_rejoin')
      assert(colonyNucleusSeatsInFloors(floors, c.COLONY_NUCLEUS_COUNT_MIN, c.COLONY_NUCLEUS_COUNT_MAX,
        c.COLONY_NUCLEUS_MIN_TILE_GAP, 2).length >= c.COLONY_NUCLEUS_COUNT_MIN);
  }
  const replay = createWorldProductionMap(JSON.parse(JSON.stringify(map.sample.profile)),
    JSON.parse(JSON.stringify(SPACE_PROFILES.find(space => space.id === spaceId)!)), layout.seed, options);
  assert.equal(replay.metadata.effectiveSeed, layout.seed, 'Accepted seed must replay directly');
  assert.equal(replay.metadata.signature, map.metadata.signature, 'Snapshot/effective-seed replay must preserve content');
  records.push({ worldId, spaceId, seed, effectiveSeed: layout.seed, age: layout.contaminationAge,
    enemies: layout.enemySpawns.length, paint: paint.length, signature: map.metadata.signature });
}
const original = createWorldProductionMap('ash-strata', 'open-scars', 70421, options);
const anonymous = createWorldProductionMap({ ...WORLD_PROFILES[0]!, id: 'snapshot-only-world' },
  { ...SPACE_PROFILES[0]!, id: 'snapshot-only-space' }, 70421, options);
assert.deepEqual(anonymous.layout.tileMap, original.layout.tileMap, 'World/space IDs cannot select a hidden geometry branch');
assert.equal(anonymous.layout.fragmentTypeId, 'world-study:snapshot-only-world');
for (const seed of [-1, .5, NaN, Infinity, 0x100000000])
  assert.throws(() => createWorldProductionMap('ash-strata', 'open-scars', seed, options));
assert.throws(() => createWorldProductionMap('missing-world', 'open-scars', 1, options));
assert.throws(() => createWorldProductionMap('ash-strata', 'missing-space', 1, options));
assert.throws(() => createWorldProductionMap('ash-strata', 'open-scars', 1, { contentFragmentTypeId: 'missing-dialect' }));
console.log(JSON.stringify({ passed: records.length, quotas: '8 fuel / 3 items / 3–4 bodies / native age-based Host count / 1 hearing', records }, null, 2));
