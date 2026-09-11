import assert from 'node:assert/strict';
import { GroundHeightField } from '../../src/dev/spatial-study/stage/ground-height';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { ACTOR_HEIGHT } from '../../src/dev/spatial-study/stage/materials';

// This is a world-clearance contract, not a second implementation of the
// sampler. Mesh interpolation, VOID topology and planted feet are checked by
// the independent Stage geometry/actor suite.
let minimumClearance = Infinity;
let measuredColumns = 0;
const column = { field: 0, top: 0, bottom: 0 };
for (const seed of [0, 7, 42]) {
  const world = new SpatialSliceWorld(seed);
  const summary = world.ground.snapshot();
  assert.ok(Number(summary.maximumSlope) <= .4, 'the authored ground must stay traversable');
  assert.ok(Number(summary.range) >= 40 && Number(summary.range) <= 50,
    'the authored local scene must contain the agreed broad relief rather than a flat plane');
  const beforeLayout = JSON.stringify(world.layout);
  for (const elapsedMs of [0, 1900, 5350, 8200, 16000, 32000, 60000]) {
    for (let y = 4; y < world.height; y += 8) for (let x = 4; x < world.width; x += 8) {
      if (!world.isFloor(x, y)) continue;
      world.sampleSea(x, y, elapsedMs, column);
      if (column.field <= 0) continue;
      const clearance = column.bottom - world.groundHeightAt(x, y);
      minimumClearance = Math.min(minimumClearance, clearance); measuredColumns++;
      assert.ok(clearance >= ACTOR_HEIGHT + 8,
        `insufficient sea-belly clearance at seed=${seed}, t=${elapsedMs}, (${x},${y}): ${clearance}`);
    }
  }
  assert.equal(JSON.stringify(world.layout), beforeLayout, 'height sampling must not alter the production XY layout');
  const source = world.waterDefinition;
  assert.ok(world.isFloor(source.x, source.y), 'the real falling-water contact remains on the production floor');
  assert.ok(world.groundHeightAt(source.x, source.y) < 0,
    'the authored water contact should lie in its scoured depression');
}
assert.ok(measuredColumns > 10000);
console.log(`PASS slope / 40–50px relief / immutable XY / water depression / sea clearance: ${measuredColumns} columns, minimum ${minimumClearance.toFixed(2)}px`);

assert.throws(() => new GroundHeightField(64, 64, [{ id: 'unsafe-step', kind: 'ridge',
  x: 32, y: 32, radiusX: 8, radiusY: 8, angle: 0, height: 32 }]), /slope/,
'a narrow tall data change must fail before it creates a visually walkable but physically impossible wall');
console.log('PASS invalid sharp CSV landform fails fast instead of becoming a fake traversable cliff');
