/** Content admission on the accepted representative geometry, independent of the r7 package router. */
import assert from 'node:assert/strict';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { SPATIAL_PROTOTYPE_CONFIG as CONFIG, SPATIAL_PROTOTYPE_VOLUMES, SPATIAL_PROTOTYPE_EROSION, SPATIAL_PROTOTYPE_ANCHORS } from '../../src/generated/rift-spatial-prototype-data';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data';
import { createMasterWorld, type MasterDefinition } from '../../src/generation/world-study/r100-master-world';
import { getR100SpatialDeploymentPolicy, validateR100SpatialDeploymentPolicy } from '../../src/generation/world-study/r100-spatial-deployment';
import { deployR100Expedition } from '../../src/generation/world-study/r100-expedition';
import { buildSpatialExtractionField, selectSpatialExtraction } from '../../src/dev/spatial-extraction-selection';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { mix32 } from '../../src/generation/seed-fork';

const source = R100_NATIVE_WORLDS.find(world => world.id === CONFIG.world_id)!;
const spatial = getR100SpatialDeploymentPolicy();
assert.throws(() => validateR100SpatialDeploymentPolicy({ ...spatial, version: 2 }));
assert.throws(() => validateR100SpatialDeploymentPolicy({ ...spatial, unknown: 1 }));
const seeds = process.argv.includes('--both-seeds') ? [20261010, 20261011] : [20261010];
for (const seed of seeds) for (const grade of POLLUTION_GRADE_DEFINITIONS) {
  const spawn = SPATIAL_PROTOTYPE_ANCHORS.filter(row => row.role === 'candidate').sort((a, b) => mix32(seed, `spatial-spawn-${a.id}`) - mix32(seed, `spatial-spawn-${b.id}`))[0]!;
  const branch = SPATIAL_PROTOTYPE_ANCHORS.find(row => row.role === 'branch')!;
  const base: MasterDefinition = { ...source.definitions.find(row => row.grade === grade.id)!, cols: CONFIG.cols, rows: CONFIG.rows,
    instances: SPATIAL_PROTOTYPE_VOLUMES, erosion: SPATIAL_PROTOTYPE_EROSION.map(row => row.points),
    spawn_x: spawn.x, spawn_y: spawn.y, exit_x: spawn.x, exit_y: spawn.y, search_x: branch.x, search_y: branch.y };
  const terrain = createMasterWorld(base, seed, { grade, profile: source.profile });
  const field = buildSpatialExtractionField(new TileGrid(terrain.layout.tileMap), terrain.layout.spawnPoint, {
    minPathDistancePx: CONFIG.extraction_min_path_distance, minEuclideanDistancePx: CONFIG.extraction_min_euclidean_distance,
    minPathFraction: CONFIG.extraction_min_path_fraction, maxPathFraction: CONFIG.extraction_max_path_fraction,
    clearanceHalfSize: CONFIG.extraction_clearance_half_size, regionCols: CONFIG.extraction_region_cols,
    regionRows: CONFIG.extraction_region_rows, distanceBands: CONFIG.extraction_distance_bands,
  });
  const exit = selectSpatialExtraction(field, seed);
  const world = createMasterWorld({ ...base, exit_x: exit.point.x, exit_y: exit.point.y }, seed, { grade, profile: source.profile, spatialDeployment: spatial });
  const definition = R100_EXPEDITION_GRADES.find(row => row.grade_id === grade.id)!;
  const { layout, diagnostics } = deployR100Expedition(world, definition);
  assert.equal(layout.kindlingNodes.reduce((sum, node) => sum + node.value!, 0), grade.id === 'low' ? 9 : grade.id === 'medium' ? 13 : 17);
  assert.equal(layout.enemySpawns.length, definition.enemy_count);
  assert.equal(layout.contaminantNodes.length, definition.contaminant_safe_count + definition.contaminant_contested_count + definition.contaminant_deep_count);
  assert.equal(world.pollution.pins.paintFloors.length, grade.paintCount);
  assert.equal(world.pollution.volumes.length, grade.volumeCount);
  const grid = new TileGrid(layout.tileMap);
  const nodes = [...layout.kindlingNodes, ...layout.contaminantNodes];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!;
    assert(bodyHasSupport(grid, node.position, 10, 10));
    for (const other of nodes.slice(index + 1)) assert(Math.hypot(node.position.x - other.position.x, node.position.y - other.position.y) >= spatial.node_spacing_px);
  }
  const windows = diagnostics.patrolWindows as readonly { readonly durationMs: number }[];
  assert.equal(windows.length, nodes.filter(node => node.tier !== 'safe').length);
  assert(windows.every(window => window.durationMs >= 2400));
  for (const point of world.pollution.safeRoute) {
    assert(bodyHasSupport(grid, point, 10, 10));
    const col = Math.floor(point.x / 32), row = Math.floor(point.y / 32);
    assert(!world.pollution.paintCells.some(cell => Math.floor(cell.x / 32) === col && Math.floor(cell.y / 32) === row));
    assert(!world.pollution.volumes.some(box => col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow));
  }
  for (const enemy of layout.enemySpawns) {
    assert.notEqual(enemy.patrol.mode, 'static');
    for (let index = 1; index < enemy.patrol.waypoints.length; index++) {
      const previous = enemy.patrol.waypoints[index - 1]!, next = enemy.patrol.waypoints[index]!;
      assert.equal(bodyDisplacementFraction(grid, { x: (previous.col + .5) * 8, y: (previous.row + .5) * 8 }, 10, 10,
        (next.col - previous.col) * 8, (next.row - previous.row) * 8), 1);
    }
  }
  console.log(JSON.stringify({ seed, grade: grade.id, diagnostics, spawn: layout.spawnPoint, exit: layout.extractionPoint.position,
    paintPins: world.pollution.pins.paintFloors.map(seat => ({ x: (seat.floorCol + .5) * 32, y: (seat.floorRow + .5) * 32 })) }));
}
