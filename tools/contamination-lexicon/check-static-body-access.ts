/** R3: retained gym-only street fixture tests the solver; production 128 maps contain no static relics. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { checkStaticBodyAccess, ensureStaticBodyAccess, isStaticFloorBody, type StaticBodyAccessInput } from '../../src/generation/static-body-access';
import { generateRiftLayout } from '../../src/generation/rift-layout';
import { drawOne, supportsRuntimeForm } from '../../src/generation/contamination-draw';
import { SeededRandom } from '../../src/utils/random';
import { GAME_CONSTANTS } from '../../src/config/constants';
import type { EnemySpawnData, WalkGrid } from '../../src/types/map-types';

const fixtureEnemy: EnemySpawnData = {
  id: 'sentinel', type: 'infiltrator', spawn: { col: 4, row: 2 }, facing: 0,
  patrol: { mode: 'pingpong', waypoints: [{ col: 4, row: 2 }, { col: 6, row: 2 }] },
  form: { substrate: 'street_wreckage', coverage: 'infiltrate', portfolio: 'jia', occupancy: 'floor', continuity: 'monolith', lexemes: { motion: 'motion_anchor', sense: 'sense_cone', rhythm: 'rhythm_pulse', contact: 'contact_melee_three' } },
};
function fixture(bypass: boolean): StaticBodyAccessInput {
  const grid: WalkGrid = { cols: 9, rows: 5, tileSize: 32, version: 0, isWalkable: (col, row) => col >= 1 && col <= 7 && (bypass ? row >= 1 && row <= 3 : row === 2) };
  return { grid, spawnPoint: { x: 48, y: 80 }, enemySpawns: [fixtureEnemy], targets: [{ id: 'exit', position: { x: 240, y: 80 }, radius: 8 }, { id: 'loot', position: { x: 240, y: 80 }, radius: 48 }] };
}
const blocked = fixture(false), clear = fixture(true);
assert.deepEqual(checkStaticBodyAccess(blocked).blockedTargetIds, ['exit', 'loot']);
assert(checkStaticBodyAccess(clear).reachable, 'clear physical side route must remain available');
assert.equal(ensureStaticBodyAccess(clear, new SeededRandom(3), 'frag-library'), clear.enemySpawns, 'safe body must not consume another form draw');
const replaced = ensureStaticBodyAccess(blocked, new SeededRandom(3), 'frag-library');
assert(replaced && replaced.length === 1);
assert(!isStaticFloorBody(replaced[0]!));
assert(supportsRuntimeForm(replaced[0]!.form!));
assert.deepEqual({ ...replaced[0], form: undefined }, { ...fixtureEnemy, form: undefined }, 'id/type/position/facing/patrol preserved');
for (const slot of ['sense', 'rhythm'] as const) assert.equal(replaced[0]!.form!.lexemes[slot], fixtureEnemy.form!.lexemes[slot]);
assert.equal(replaced[0]!.form!.coverage, fixtureEnemy.form!.coverage);
assert.notEqual(replaced[0]!.form!.lexemes.motion, 'motion_patrol', 'keep sentry duty when a legal turning base exists');
assert(checkStaticBodyAccess({ ...blocked, enemySpawns: replaced }).reachable);
assert.equal(checkStaticBodyAccess({ ...blocked, enemySpawns: [] }).sampledPositions, 0, 'zero-static fast path must not build the navigation grid');
assert.equal(ensureStaticBodyAccess(blocked, new SeededRandom(1), 'missing-dialect'), null, 'no illegal fallback when the filtered candidate pool is empty');
assert.equal(drawOne(new SeededRandom(2), { portfolio: 'yi', fragmentTypeId: 'frag-library', substrate: 'doorframe', forbidSubstrate: ['doorframe'], preferUtterance: true }), null, 'named recipe cannot bypass forbidden substrate');

const evidence = 'docs/qa/iteration-18-evidence/';
const baseline = JSON.parse(readFileSync(`${evidence}generation-after.json`, 'utf8')) as { layouts: { inputSeed: number; spawns: EnemySpawnData[]; forms: unknown[] }[] };
const timings: number[] = [], layoutTimings: number[] = [], records: unknown[] = [];
let staticMaps = 0;
for (const before of baseline.layouts) {
  const started = performance.now();
  const layout = generateRiftLayout(before.inputSeed);
  layoutTimings.push(performance.now() - started);
  assert(layout.enemySpawns.every(e => !['doorframe', 'street_wreckage'].includes(e.form!.substrate)), 'retired floor bodies never return');

  const input: StaticBodyAccessInput = {
    grid: { ...layout.walkableMask, tileSize: 32, version: 0 }, spawnPoint: layout.spawnPoint, enemySpawns: layout.enemySpawns,
    targets: [{ id: layout.extractionPoint.id, position: layout.extractionPoint.position, radius: layout.extractionPoint.triggerRadius }, ...[...layout.kindlingNodes, ...layout.contaminantNodes].map((node) => ({ id: node.id, position: node.position, radius: GAME_CONSTANTS.LOOT.SEARCH_RADIUS }))],
  };
  const checkStart = performance.now();
  const result = checkStaticBodyAccess(input);
  const elapsed = performance.now() - checkStart;
  assert(result.reachable, `seed ${before.inputSeed}: ${result.blockedTargetIds}`);
  const bodies = layout.enemySpawns.filter(isStaticFloorBody);
  if (bodies.length) { staticMaps++; timings.push(elapsed); }
  else assert.equal(result.sampledPositions, 0);
  records.push({ seed: before.inputSeed, fragment: layout.fragmentTypeId, staticBodies: bodies.map((body) => ({ id: body.id, substrate: body.form!.substrate, spawn: body.spawn })), reachable: result.reachable, checkMs: elapsed, sampledPositions: result.sampledPositions });
}
const stats = (samples: number[]) => { const sorted = [...samples].sort((a, b) => a - b); return { meanMs: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted[sorted.length - 1] }; };
const report = { maps: baseline.layouts.length, staticMaps, blockedMaps: 0, retiredFloorBodiesAbsent: true, fixtureBlockedTargets: ['exit', 'loot'], fixtureFallback: replaced[0]!.form, zeroStaticSkipsNavigation: true, staticNavigationPerformance: stats(timings), completeLayoutPerformance: stats(layoutTimings), model: '4px player-center navigation; player20px, static20px, expanded body exclusion40px; walls/void expanded10px; actual exit/loot interaction radii', records };
writeFileSync(`${evidence}static-body-access.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, records: undefined }, null, 2));
