/** Production decision contracts, not a claim of a normal-FOV human playthrough. */
import assert from 'node:assert/strict';
import { selectWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { applySemanticDeployment, measureInteractionAreas, measureSemanticThreat } from '../../src/generation/world-study/semantic-deployment';
import type { GeneratedRiftLayout } from '../../src/generation/types';
import { isStaticFloorBody } from '../../src/generation/static-body-access';
import { drawOne, floorMotionFor, INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { hasLineOfSight } from '../../src/utils/grid-raycast';
import { TileType } from '../../src/types/game-types';
import { SeededRandom } from '../../src/utils/random';

function coarseLayout(map: ReturnType<typeof createWorldProductionMap>): GeneratedRiftLayout {
  const coarse = (col: number, row: number) => ({ col: Math.floor((col + .5) * 8 / 32), row: Math.floor((row + .5) * 8 / 32) });
  const position = (p: { x: number; y: number }) => ({ x: p.x - 4, y: p.y - 4 });
  return { ...map.layout, spawnPoint: position(map.layout.spawnPoint),
    extractionPoint: { ...map.layout.extractionPoint, position: position(map.layout.extractionPoint.position) },
    kindlingNodes: map.layout.kindlingNodes.map(node => ({ ...node, position: position(node.position) })),
    contaminantNodes: map.layout.contaminantNodes.map(node => ({ ...node, position: position(node.position) })),
    tileMap: map.hostTileMap, enemySpawns: map.layout.enemySpawns.map(enemy => ({ ...enemy,
    spawn: coarse(enemy.spawn.col, enemy.spawn.row), patrol: { ...enemy.patrol,
      waypoints: enemy.patrol.waypoints.map(p => coarse(p.col, p.row)) } })) };
}
/** Independent reference uses a sorted frontier and physical centre distances. */
function referenceDistances(layout: GeneratedRiftLayout, point: { x: number; y: number }, actualBody = false, exitArea = false): Float64Array {
  const grid = new TileGrid(layout.tileMap), n = grid.cols * grid.rows, result = new Float64Array(n).fill(Infinity);
  const blocked = new Set(layout.enemySpawns.filter(isStaticFloorBody).map(e => e.spawn.row * grid.cols + e.spawn.col));
  const bodies = layout.enemySpawns.filter(isStaticFloorBody).map(e => ({ x: (e.spawn.col + .5) * grid.tileSize, y: (e.spawn.row + .5) * grid.tileSize }));
  const seats = Uint8Array.from({ length: n }, (_, cell) => {
    const x = cell % grid.cols, y = Math.floor(cell / grid.cols), p = { x: (x + .5) * grid.tileSize, y: (y + .5) * grid.tileSize };
    return actualBody ? Number(bodyHasSupport(grid, p, 10, 10) && !bodies.some(b => Math.abs(b.x - p.x) < 19.999 && Math.abs(b.y - p.y) < 19.999))
      : Number(grid.isWalkable(x, y) && !blocked.has(cell));
  });
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && seats[y * grid.cols + x] === 1;
  const start = Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize), frontier = [start]; result[start] = 0;
  if (exitArea) for (let cell = 0; cell < n; cell++) {
    const x = cell % grid.cols, y = Math.floor(cell / grid.cols);
    if (free(x, y) && Math.hypot((x + .5) * grid.tileSize - point.x, (y + .5) * grid.tileSize - point.y) <= layout.extractionPoint.triggerRadius) {
      result[cell] = 0; frontier.push(cell);
    }
  }
  const done = new Set<number>();
  while (frontier.length) {
    frontier.sort((a, b) => result[b]! - result[a]!); const current = frontier.pop()!;
    if (done.has(current)) continue; done.add(current);
    const x = current % grid.cols, y = Math.floor(current / grid.cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || !free(x + dx, y + dy) || (dx && dy && (!free(x + dx, y) || !free(x, y + dy)))) continue;
      const next = (y + dy) * grid.cols + x + dx, distance = result[current]! + Math.hypot(dx, dy) * grid.tileSize;
      if (distance < result[next]!) { result[next] = distance; frontier.push(next); }
    }
  }
  return result;
}
const records: unknown[] = [];
for (const seed of [70421, 81457, 91283]) {
  const recipe = selectWorldProductionRecipe(seed); assert.equal(recipe.version, 2); if (recipe.version !== 2) throw new Error('v2');
  const map = createWorldProductionMap(recipe.profile, recipe.space, seed, { contentFragmentTypeId: recipe.contentFragmentTypeId,
    paintGeometryVersion: 2, generationVersion: 2, conditions: recipe.conditions });
  const layout = coarseLayout(map), original = JSON.stringify(layout), terrain = { tileMap: map.layout.tileMap, coordinateOffset: { x: 4, y: 4 } },
    result = applySemanticDeployment(layout, recipe.conditions, terrain);
  assert.equal(JSON.stringify(layout), original, 'Compiler may not mutate accepted input');
  assert.deepEqual(result.layout.contaminationDraw, layout.contaminationDraw, 'Semantics never redraw final identities');
  assert.deepEqual(result.layout.enemySpawns, layout.enemySpawns, 'Semantics never move or invent threats');
  assert.deepEqual(result.layout.kindlingNodes.map(n => n.tier).sort(), ['safe','safe','safe','contested','contested','contested','deep','deep'].sort());
  assert.equal(result.layout.contaminantNodes.length, 3); assert.equal(result.layout.landmarks.length, 3);
  const d = map.metadata.semantic!;
  assert(d.extraRoutePx >= 64 && d.exposureReduction >= .2);
  for (const route of [d.shortRoute, d.lowExposureRoute]) {
    let length = 0;
    for (let i = 1; i < route.points.length; i++) length += Math.hypot(route.points[i]!.x - route.points[i - 1]!.x, route.points[i]!.y - route.points[i - 1]!.y);
    assert(Math.abs(length - route.lengthPx) < 1e-6);
    assert(route.points.every(p => new TileGrid(layout.tileMap).isWalkableAt(p.x, p.y)));
  }
  const fromSpawn = referenceDistances(layout, layout.spawnPoint), fromExit = referenceDistances(layout, layout.extractionPoint.position);
  const idx = (p: { x: number; y: number }) => Math.floor(p.y / 32) * layout.tileMap.cols + Math.floor(p.x / 32);
  const nodes = [...layout.kindlingNodes, ...layout.contaminantNodes];
  const fineSpawn = referenceDistances(map.layout, map.layout.spawnPoint, true), fineExit = referenceDistances(map.layout, map.layout.extractionPoint.position, true, true);
  const fineGrid = new TileGrid(map.layout.tileMap), fineIndex = (p: { x: number; y: number }) => Math.floor(p.y / 8) * fineGrid.cols + Math.floor(p.x / 8);
  const fineBaseline = fineExit[fineIndex(map.layout.spawnPoint)]!;
  const minimumInteractionExtra = (node: { x: number; y: number }): number => {
    const target = { x: node.x + 4, y: node.y + 4 }; let minimum = Infinity;
    for (let y = Math.floor(target.y / 8) - 6; y <= Math.floor(target.y / 8) + 6; y++) for (let x = Math.floor(target.x / 8) - 6; x <= Math.floor(target.x / 8) + 6; x++) {
      const p = { x: (x + .5) * 8, y: (y + .5) * 8 }, cell = y * fineGrid.cols + x;
      if (Math.hypot(p.x - target.x, p.y - target.y) <= 48 && bodyHasSupport(fineGrid, p, 10, 10) && hasLineOfSight(fineGrid, p, target, 48.001))
        minimum = Math.min(minimum, fineSpawn[cell]! + fineExit[cell]! - fineBaseline);
    }
    return minimum;
  };
  for (const node of d.nodes) {
    const position = nodes.find(n => n.id === node.id)!.position, cell = idx(position);
    const extra = fromSpawn[cell]! + fromExit[cell]! - fromSpawn[idx(layout.extractionPoint.position)]!;
    const expected = node.costBasis === 'interaction-area' ? minimumInteractionExtra(position) : extra;
    assert(Math.abs(expected - node.extraTravelPx) < 1e-6, 'Cost must include all visible 48px standing seats, body clearance and extraction area');
    if (node.tier === 'deep') assert(node.costBasis === 'interaction-area' && (node.interactionSeats ?? 0) > 1 && node.extraTravelPx >= recipe.conditions.semantic.minimumDeepDetourPx && node.approachThreat >= .18);
    if (node.tier === 'safe') assert(node.threat <= recipe.conditions.semantic.safeMaxThreat);
    if (node.tier === 'contested') assert(node.threat >= .18 && node.extraTravelPx < recipe.conditions.semantic.minimumDeepDetourPx * .85);
  }
  const deep = layout.kindlingNodes.filter(n => n.tier === 'deep');
  assert((Math.abs(deep[0]!.position.x - deep[1]!.position.x) + Math.abs(deep[0]!.position.y - deep[1]!.position.y)) / 32 >= 6);
  assert.deepEqual(applySemanticDeployment({ ...layout, fragmentTypeId: 'anonymous-world', recipeId: 'anonymous-space' }, recipe.conditions, terrain).diagnostics, result.diagnostics);
  assert.throws(() => applySemanticDeployment({ ...layout, enemySpawns: [] }, recipe.conditions), /no longer, materially lower-exposure/);
  const stationary = layout.enemySpawns.find(e => e.form && floorMotionFor(e.form) !== 'motion_patrol');
  assert(stationary, 'Fixture must exercise a real stationary form');
  const staticOnly = { ...layout, enemySpawns: [stationary] };
  const actual = measureSemanticThreat(staticOnly);
  const fakeRoute = measureSemanticThreat({ ...staticOnly, enemySpawns: [{ ...stationary, patrol: { ...stationary.patrol,
    waypoints: [{ col: 0, row: 0 }, { col: 50, row: 30 }] } }] });
  assert.deepEqual(actual.field, fakeRoute.field, 'Static hosts cannot receive imaginary patrol danger');
  assert.equal(actual.sources[0]!.samples, 1);
  // Counterexample guard: a centre-reachable point can have a materially cheaper
  // visible search seat. Keep this test independent of accepted resource positions.
  const inspect = measureInteractionAreas(layout, terrain);
  let cheaperInteraction = false;
  for (const node of nodes.filter(node => node.tier === 'deep')) {
    const target = { x: node.position.x + 4, y: node.position.y + 4 }, cell = fineIndex(target);
    const centreCost = fineSpawn[cell]! + fineExit[cell]! - fineBaseline;
    const area = inspect.at(node.position)!;
    if (centreCost - area.minimumExtraPx >= 32) cheaperInteraction = true;
    assert(Math.abs(area.minimumExtraPx - minimumInteractionExtra(node.position)) < 1e-6);
  }
  assert(cheaperInteraction, 'Fixture must expose the old centre-only overstatement');
  records.push({ seed, effectiveSeed: map.layout.seed, program: recipe.conditions.programId,
    deepCostMinimum: Math.min(...d.nodes.filter(n => n.tier === 'deep').map(n => n.extraTravelPx)),
    routeExtraPx: d.extraRoutePx, exposureReduction: d.exposureReduction });
}
// Concrete opaque partition: an enemy must not project its sight through missing support.
const tiles = Array.from({ length: 12 }, () => Array<number>(14).fill(TileType.FLOOR));
for (const row of tiles) row[6] = TileType.VOID;
const occluded = { tileMap: { cols: 14, rows: 12, tileSize: 32, tiles }, enemySpawns: [{ id: 'VISION', type: 'infiltrator',
  spawn: { col: 4, row: 6 }, facing: 0, form: INFILTRATOR_FORM, patrol: { waypoints: [{ col: 4, row: 6 }], mode: 'static' } }] } as unknown as GeneratedRiftLayout;
assert.equal(measureSemanticThreat(occluded).field[6 * 14 + 8], 0, 'Opaque geometry cuts vision; muffled hearing cannot reach this seat');
const turningForm = drawOne(new SeededRandom(42), { portfolio: 'jia', fragmentTypeId: 'frag-library',
  motion: 'motion_turn', sense: 'sense_cone' });
assert(turningForm && floorMotionFor(turningForm) === 'motion_turn');
const turning = { tileMap: { cols: 22, rows: 16, tileSize: 32,
  tiles: Array.from({ length: 16 }, () => Array<number>(22).fill(TileType.FLOOR)) },
enemySpawns: [{ id: 'TURN', type: 'infiltrator', spawn: { col: 10, row: 7 }, facing: 0, form: turningForm,
  patrol: { waypoints: [{ col: 10, row: 7 }], mode: 'static' } }] } as unknown as GeneratedRiftLayout;
const turnThreat = measureSemanticThreat(turning).field;
assert.equal(turnThreat[7 * 22 + 5], 0, 'A ±45° scanning guard retains a rear blind side');
assert(turnThreat[7 * 22 + 15]! > 0, 'The same guard can see the forward seat');
// This existing layout cannot satisfy deep composition at its random roster seats.
// The bounded repair must move an encounter, never redraw its identity or the exit guardian.
const beforeRepair = coarseLayout(createWorldProductionMap('ash-strata', 'open-scars', 81457,
  { contentFragmentTypeId: 'frag-library' }));
const repairContract = { semantic: { minimumDeepDetourPx: 384, safeMaxThreat: .08, routeThreatPenalty: 6 } };
const repaired = applySemanticDeployment(beforeRepair, repairContract);
assert.equal(repaired.diagnostics.encounterAdjustments.length, 1, 'Fixture exercises actual encounter composition');
assert.deepEqual(repaired.layout.enemySpawns[0], beforeRepair.enemySpawns[0], 'Exit guardian is immutable');
assert.deepEqual(repaired.layout.contaminationDraw, beforeRepair.contaminationDraw);
assert.deepEqual(repaired.layout.enemySpawns.map(e => ({ id: e.id, type: e.type, form: e.form })),
  beforeRepair.enemySpawns.map(e => ({ id: e.id, type: e.type, form: e.form })), 'Repair changes seats, not identities or quota');
const movedId = repaired.diagnostics.encounterAdjustments[0]!.id;
const moved = repaired.layout.enemySpawns.find(e => e.id === movedId)!;
const movedDanger = measureSemanticThreat({ ...repaired.layout, enemySpawns: [moved] }).field;
const repairCell = (p: { x: number; y: number }) => Math.floor(p.y / 32) * beforeRepair.tileMap.cols + Math.floor(p.x / 32);
assert.equal(movedDanger[repairCell(beforeRepair.spawnPoint)], 0, 'Relocated encounter cannot discover the arrival');
assert.equal(movedDanger[repairCell(beforeRepair.extractionPoint.position)], 0, 'Relocated encounter cannot watch the exit');
assert.deepEqual(applySemanticDeployment(beforeRepair, repairContract), repaired, 'Bounded composition is deterministic');
console.log(JSON.stringify({ passed: 3, contracts: ['native semantic deployment', 'fixed economy', '8-direction added cost', 'no-threat rejection',
  'stationary actual motion', 'turn sweep blind side', 'opaque sight', 'anonymous identity', 'input immutability',
  '48px visible interaction-area lower cost', '8px support / 20px body', 'centre-only counterexample', 'bounded encounter composition', 'arrival/exit fairness', 'form identity preservation'], records }, null, 2));
