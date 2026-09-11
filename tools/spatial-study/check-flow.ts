import assert from 'node:assert/strict';
import { WaterFlowCycle, createFallingWaterFlow } from '../../src/dev/spatial-study/water-flow';
import { sampleWaterCurtain, type WaterCurtainFrame } from '../../src/dev/spatial-study/water-curtain';
import { SLICE_WATER } from '../../src/dev/spatial-study/slice-world';
import { VoidRegions } from '../../src/dev/spatial-study/void-regions';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { TileType } from '../../src/types/game-types';
import type { GeneratedRiftLayout } from '../../src/generation/types';

let passed = 0, failed = 0;
function check(name: string, run: () => void): void {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}\n${String(e)}`); }
}
const flow = new WaterFlowCycle(SLICE_WATER);
const frame = (): WaterCurtainFrame => ({ phase: 'quiet', cycle: 0, progress: 0, extension: 0, active: false });
check('falling-front contact has exactly the existing authoritative active window over three cycles', () => {
  const out = createFallingWaterFlow(), damage = frame(), original = JSON.stringify(SLICE_WATER);
  assert.equal(SLICE_WATER.fallTravelMs, 780);
  for (let ms = 0; ms < flow.period * 3; ms++) {
    flow.sample(ms, out); sampleWaterCurtain(damage, ms, SLICE_WATER);
    assert.equal(out.leadingEdge >= 1 && out.trailingEdge < 1, damage.active, `contact mismatch at ${ms}`);
    for (const value of [out.leadingEdge, out.trailingEdge, out.sourceFeed, out.swell, out.residue]) assert(Number.isFinite(value) && value >= 0 && value <= 1);
  }
  assert.equal(JSON.stringify(SLICE_WATER), original);
  for (const ms of [flow.contactStart - 1, flow.contactStart + 1, flow.contactEnd - 1, flow.contactEnd + 1]) {
    flow.sample(ms, out); sampleWaterCurtain(damage, ms, SLICE_WATER);
    assert.equal(out.leadingEdge >= 1 && out.trailingEdge < 1, damage.active, `boundary mismatch at ${ms}`);
  }
});
check('leading and trailing fronts descend monotonically and accelerate, with a real unsupported tail after cutoff', () => {
  const out = createFallingWaterFlow(); let previousLead = 0, previousTail = 0;
  for (let ms = 0; ms < flow.period; ms++) {
    flow.sample(ms, out); assert(out.leadingEdge >= previousLead && out.trailingEdge >= previousTail, `upward motion at ${ms}`);
    assert(out.trailingEdge <= out.leadingEdge); previousLead = out.leadingEdge; previousTail = out.trailingEdge;
  }
  for (const start of [flow.feedStart, flow.feedEnd]) {
    const values = [0, .25, .5, .75, 1].map(f => { flow.sample(start + SLICE_WATER.fallTravelMs * f, out); return start === flow.feedStart ? out.leadingEdge : out.trailingEdge; });
    assert(values[2]! < .5, 'An accelerating fall travels less than half its distance in the first half of flight');
    assert(values[4]! - values[3]! > values[1]! - values[0]!);
  }
  flow.sample(flow.feedEnd + SLICE_WATER.fallTravelMs / 2, out);
  assert.equal(out.sourceFeed, 0); assert(out.leadingEdge === 1 && out.trailingEdge > 0 && out.trailingEdge < 1);
  const damage = frame(); sampleWaterCurtain(damage, flow.feedEnd + SLICE_WATER.fallTravelMs / 2, SLICE_WATER); assert(damage.active);
  flow.sample(flow.contactEnd + 1, out); assert.equal(out.leadingEdge, 1); assert.equal(out.trailingEdge, 1); assert(out.residue > 0);
});
check('paused/repeated time is deterministic and uses the caller-owned frame; next cycle begins with no old airborne water', () => {
  const out = createFallingWaterFlow(), other = createFallingWaterFlow();
  for (const ms of [0, flow.feedStart + 120, flow.feedEnd + 250, flow.contactEnd + 500]) {
    assert.equal(flow.sample(ms, out), out); const frozen = structuredClone(out);
    for (let n = 0; n < 8; n++) assert.deepEqual(flow.sample(ms, out), frozen);
    flow.sample(ms + flow.period, other);
    for (const key of ['leadingEdge','trailingEdge','sourceFeed','swell','residue'] as const) assert(Math.abs(other[key] - out[key]) < 1e-10);
  }
  flow.sample(flow.period, out); assert.equal(out.leadingEdge, 0); assert.equal(out.trailingEdge, 0); assert.equal(out.sourceFeed, 0);
});
check('invalid authored travel cannot silently generate nonfinite fronts', () => {
  for (const fallTravelMs of [0, -1, NaN, Infinity]) assert.throws(() => new WaterFlowCycle({ ...SLICE_WATER, fallTravelMs }), `invalid flight ${fallTravelMs}`);
  assert.throws(() => new WaterFlowCycle({ ...SLICE_WATER, fallTravelMs: flow.contactStart }), 'Cannot release before the gathering warning');
});

function map(rows: string[]): GeneratedRiftLayout['tileMap'] {
  return { cols: rows[0]!.length, rows: rows.length, tileSize: 32,
    tiles: rows.map(row => [...row].map(c => c === '.' ? TileType.VOID : c === 'W' ? TileType.WALL : TileType.FLOOR)) };
}
const at = (col: number, row: number) => [(col + .5) * 32, (row + .5) * 32] as const;
check('closed interior VOID is unknowable; only cardinal connectivity to the map edge creates an exterior vista', () => {
  const closed = map(['.......','.#####.','.#...#.','.#.#.#.','.#...#.','.#####.','.......']);
  const original = JSON.stringify(closed), regions = new VoidRegions(closed);
  for (const [x,y] of [[2,2],[3,2],[4,4],[2,4]]) { assert(regions.isInterior(...at(x!,y!))); assert(!regions.isExterior(...at(x!,y!))); }
  assert(regions.isExterior(...at(0,3))); assert(regions.isExterior(-1, 50));
  assert(!regions.isInterior(...at(3,3))); assert(!regions.isExterior(...at(3,3)));
  assert.equal(JSON.stringify(closed), original);
  const diagonal = structuredClone(closed); diagonal.tiles[1]![1] = TileType.VOID;
  assert(new VoidRegions(diagonal).isInterior(...at(2,2)), 'Diagonal corner contact does not open the hole');
  const wall = structuredClone(closed); wall.tiles[1]![3] = TileType.WALL;
  assert(new VoidRegions(wall).isInterior(...at(3,2)), 'A wall still separates the hole from exterior');
  const opening = structuredClone(closed); opening.tiles[1]![3] = TileType.VOID;
  const openRegions = new VoidRegions(opening);
  assert(openRegions.isExterior(...at(3,2))); assert(!openRegions.isInterior(...at(3,2)));
  assert(regions.isInterior(...at(3,2)), 'Another map instance cannot rewrite the first classification');
});
check('the actual central absence is all interior; east boundary stays exterior without changing XY collision or rules', () => {
  const world = new SpatialSliceWorld(7), before = JSON.stringify(world.layout.tileMap), regions = new VoidRegions(world.layout.tileMap);
  let interior = 0, exterior = 0;
  for (let y = 0; y < world.layout.tileMap.rows; y++) for (let x = 0; x < world.layout.tileMap.cols; x++) {
    const p = at(x,y), tile = world.layout.tileMap.tiles[y]![x];
    if (tile === TileType.VOID) { assert.notEqual(regions.isInterior(...p), regions.isExterior(...p)); if (regions.isInterior(...p)) interior++; else exterior++; }
    else { assert(!regions.isInterior(...p)); assert(!regions.isExterior(...p)); }
  }
  assert(regions.isInterior(528,432)); assert(!regions.isExterior(528,432)); assert(!world.isFloor(528,432));
  assert(regions.isExterior(960,624)); assert(interior >= 32 && exterior > interior);
  for (const time of [0, 5000, 15000]) {
    world.advance(time, world.layout.spawnPoint, true, () => false);
    assert(regions.isInterior(528,432)); assert(!world.isFloor(528,432));
  }
  assert.equal(JSON.stringify(world.layout.tileMap), before);
  console.log(`MEASURE interior VOID=${interior}, exterior VOID=${exterior}; classification is not a rendered no-leak proof.`);
});
console.log(`${passed} flow/VOID checks passed; ${failed} failed. Rendering, real input pause, blackout pixels and perceived falling motion remain browser checks.`);
if (failed) process.exitCode = 1;
