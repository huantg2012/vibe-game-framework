/** Pure chamber locomotion contracts; deliberately does not load Phaser or a DOM. */
import assert from 'node:assert/strict';
import {
  CHAMBER_DEVICE_ANCHORS, CHAMBER_DEVICE_FLOORS, CHAMBER_FLOORS,
  CHAMBER_MAX_STEP_MS, CHAMBER_ROUTE_LENGTHS, CHAMBER_SPAWN_POINT,
  type ChamberPoint, type ChamberRoute,
} from '../../src/systems/purification-chamber-layout';
import {
  createChamberMovementState, getChamberMovementPosition, isChamberFloor,
  stepChamberMovement, type ChamberMovementState,
} from '../../src/systems/purification-chamber-locomotion';

const SPEED = 80;
let assertions = 0;
const near = (actual: number, expected: number, label: string): void => {
  assert(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} != ${expected}`);
  assertions++;
};
const up = { x: 0, y: -1 }, down = { x: 0, y: 1 };
const left = { x: -1, y: 0 }, right = { x: 1, y: 0 }, still = { x: 0, y: 0 };
const position = (state: ChamberMovementState): { x: number; y: number } => {
  const out = { x: 0, y: 0 };
  getChamberMovementPosition(state, out);
  return out;
};
function advance(state: ChamberMovementState, input: ChamberPoint, durationMs: number, frameMs = 1000 / 60): void {
  let remaining = durationMs;
  while (remaining > 1e-7) {
    const dt = Math.min(frameMs, remaining);
    const before = position(state);
    stepChamberMovement(state, input, dt, SPEED);
    const after = position(state);
    assert(Math.hypot(after.x - before.x, after.y - before.y) <= SPEED * Math.min(dt, CHAMBER_MAX_STEP_MS) / 1000 + 1e-7,
      'Travel may never exceed the shared 80px/s path budget, including landings');
    remaining -= dt;
  }
}

// The entry position projects to a supported floor without drifting vertically.
const spawn = createChamberMovementState();
assert.deepEqual(position(spawn), CHAMBER_SPAWN_POINT);
assert.equal(spawn.route, 'main');
advance(spawn, up, 500);
assert.deepEqual(position(spawn), CHAMBER_SPAWN_POINT, 'W away from a staircase is not free vertical movement');
advance(spawn, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 500);
near(position(spawn).x, CHAMBER_SPAWN_POINT.x + 40, 'Holding W+D does not slow/speed the horizontal track');
near(position(spawn).y, CHAMBER_SPAWN_POINT.y, 'Diagonal input cannot enter the rear wall');

for (const fps of [30, 60, 120]) {
  const state = createChamberMovementState(CHAMBER_FLOORS.main.start);
  const dt = 1000 / fps;
  advance(state, up, 500, dt);
  assert.equal(state.route, 'left-stair');
  assert.equal(isChamberFloor(state.route), false, 'Devices cannot be used between floors');
  near(state.distance, 40, `Constant path speed ascending at ${fps} FPS`);
  const stopped = { ...state };
  advance(state, still, 700, dt);
  assert.deepEqual(state, stopped, 'Letting go on a stair stops exactly');
  advance(state, down, 250, dt);
  near(state.distance, 20, 'Mid-stair direction reverses without snapping to an endpoint');
  advance(state, down, 400, dt);
  assert.equal(state.route, 'main');
  assert.deepEqual(position(state), CHAMBER_FLOORS.main.start);

  // Travel the complete loop using only floor/stair controls.
  advance(state, up, 2000, dt);
  assert.equal(state.route, 'upper');
  assert.deepEqual(position(state), CHAMBER_FLOORS.upper.start);
  advance(state, right, 4000, dt);
  assert.deepEqual(position(state), CHAMBER_FLOORS.upper.end, 'Upper edge is solid, not a fall/drop');
  advance(state, down, 2000, dt);
  assert.equal(state.route, 'main');
  assert.deepEqual(position(state), CHAMBER_FLOORS.main.end);
  advance(state, left, 6500, dt);
  assert.deepEqual(position(state), CHAMBER_FLOORS.main.start, 'Main route is fully connected');
}

// Enter a staircase from the forgiving landing zone without teleporting sideways.
const landing = createChamberMovementState({ x: 96, y: 286 });
advance(landing, up, 50);
near(position(landing).x, 92, 'First traverse the last four pixels to the stair');
near(position(landing).y, 286, 'Landing approach remains on its floor');
advance(landing, up, 100);
assert.equal(landing.route, 'left-stair');
near(landing.distance, 4, 'Only the remaining movement budget climbs');

// All six interaction anchors are on the declared floor, reachable with short walks.
for (const [device, anchor] of Object.entries(CHAMBER_DEVICE_ANCHORS)) {
  const state = createChamberMovementState(anchor);
  const floor = CHAMBER_DEVICE_FLOORS[device as keyof typeof CHAMBER_DEVICE_ANCHORS];
  assert.equal(state.route, floor);
  near(position(state).x, anchor.x, `${device} X`);
  near(position(state).y, anchor.y, `${device} Y`);
}

// Long background frames cannot teleport to a different floor; invalid time/speed freeze.
const delayed = createChamberMovementState();
stepChamberMovement(delayed, right, 10000, SPEED);
near(position(delayed).x, CHAMBER_SPAWN_POINT.x + 8, 'Hidden-tab time is clamped to 100ms');
const beforeInvalid = { ...delayed };
for (const duration of [NaN, Infinity, -1, 0]) stepChamberMovement(delayed, right, duration, SPEED);
for (const speed of [NaN, Infinity, -1, 0]) stepChamberMovement(delayed, right, 100, speed);
assert.deepEqual(delayed, beforeInvalid);

// Recovery projection and every endpoint remain within support; floors win exact ties.
for (const route of ['main', 'upper', 'left-stair', 'right-stair'] as ChamberRoute[]) {
  const state = { route, distance: CHAMBER_ROUTE_LENGTHS[route] / 2 };
  const projected = createChamberMovementState(position(state));
  assert.equal(projected.route, route);
  near(projected.distance, state.distance, `${route} recovery projection`);
}
assert.equal(createChamberMovementState(CHAMBER_FLOORS.upper.start).route, 'upper');
assert.equal(createChamberMovementState(CHAMBER_FLOORS.main.end).route, 'main');

console.log(`I30 chamber movement: ${assertions} numeric contracts plus loop, stop/reverse, landing, interaction-floor and freeze assertions passed; no Phaser/DOM imported.`);
