/** Chamber geometry/locomotion contracts: no renderer or browser is required. */
import assert from 'node:assert/strict';
import {
  CHAMBER_DEVICE_ANCHORS, CHAMBER_DEVICE_BASES, CHAMBER_DEVICE_FLOORS,
  CHAMBER_DEVICE_FOOTPRINTS, CHAMBER_FEET_RADIUS, CHAMBER_GROUND_OFFSET_Y,
  CHAMBER_MAX_STEP_MS, CHAMBER_SPAWN_POINT, CHAMBER_WALK_POLYGONS,
  chamberFeetToPlayerPosition, type ChamberDevice, type ChamberPoint, type ChamberPolygon,
} from '../../src/systems/purification-chamber-layout';
import {
  canInteractWithChamberDevice, canStandInChamber, createChamberMovementState,
  getChamberMovementPosition, PurificationChamberLocomotion, stepChamberMovement,
  type ChamberMovementState,
} from '../../src/systems/purification-chamber-locomotion';
import type { Player } from '../../src/entities/player';
import { CHAMBER_TEST_ROUTES } from './i30-chamber-driver.mjs';

const SPEED = 80;
const up = { x: 0, y: -1 }, down = { x: 0, y: 1 };
const left = { x: -1, y: 0 }, right = { x: 1, y: 0 }, still = { x: 0, y: 0 };
let checks = 0;
function near(actual: number, expected: number, label: string): void {
  assert(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
  checks++;
}

// Independent polygon winding and perimeter sampling verify actual feet support,
// including shared floor/ramp seams, rather than trusting the solver's own query.
function windingContains(polygon: ChamberPolygon, x: number, y: number): boolean {
  let winding = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
    if (a.y <= y && b.y > y && cross > 0) winding++;
    if (a.y > y && b.y <= y && cross < 0) winding--;
  }
  return winding !== 0;
}

function assertSupported(state: ChamberMovementState): void {
  assert(canStandInChamber(state), `Full feet clearance at (${state.x},${state.y})`);
  const radius = CHAMBER_FEET_RADIUS - 1e-5;
  for (let sample = 0; sample < 48; sample++) {
    const angle = sample / 48 * Math.PI * 2;
    const x = state.x + Math.cos(angle) * radius, y = state.y + Math.sin(angle) * radius;
    assert(Object.values(CHAMBER_WALK_POLYGONS).some(polygon => windingContains(polygon, x, y)),
      `Foot perimeter outside visible walk support at (${x},${y})`);
    assert(!Object.values(CHAMBER_DEVICE_FOOTPRINTS).some(polygon => windingContains(polygon, x, y)),
      `Foot perimeter penetrated a device at (${x},${y})`);
  }
  checks++;
}

function tick(state: ChamberMovementState, input: ChamberPoint, dt: number, speed = SPEED): void {
  const beforeX = state.x, beforeY = state.y;
  stepChamberMovement(state, input, dt, speed);
  assert(Math.hypot(state.x - beforeX, state.y - beforeY) <= speed * Math.min(dt, CHAMBER_MAX_STEP_MS) / 1000 + 1e-6,
    'Collisions and landings never add speed');
  assertSupported(state);
}

function advance(state: ChamberMovementState, input: ChamberPoint, durationMs: number, frameMs = 1000 / 60): void {
  for (let remaining = durationMs; remaining > 1e-7;) {
    const dt = Math.min(frameMs, remaining);
    tick(state, input, dt);
    remaining -= dt;
  }
}

function walkTo(state: ChamberMovementState, target: ChamberPoint, frameMs = 1000 / 60): void {
  for (let step = 0; step < 1200; step++) {
    const dx = target.x - state.x, dy = target.y - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6) return;
    tick(state, { x: dx / distance, y: dy / distance }, Math.min(frameMs, distance / SPEED * 1000));
  }
  assert.fail(`Continuous walk did not reach (${target.x},${target.y}) from (${state.x},${state.y})`);
}
function via(state: ChamberMovementState, points: readonly (readonly number[])[], frameMs = 1000 / 60): void {
  for (const [x, y] of points) walkTo(state, { x, y }, frameMs);
}

assert.equal(CHAMBER_FEET_RADIUS, 6, 'Original hub body width remains 12px with rounded feet');
const spawn = createChamberMovementState();
const output = { x: 0, y: 0 };
getChamberMovementPosition(spawn, output);
assert.deepEqual(output, CHAMBER_SPAWN_POINT);
assert.deepEqual(chamberFeetToPlayerPosition(output), { x: output.x, y: output.y - CHAMBER_GROUND_OFFSET_Y });

// Every direction changes the corresponding screen axes on visible deep floor.
for (const direction of [up, down, left, right, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: -1, y: -1 }]) {
  const state = createChamberMovementState();
  tick(state, direction, 100);
  near(Math.hypot(state.x - spawn.x, state.y - spawn.y), 8, 'All directions share the 80px/s budget');
  near(state.x - spawn.x, direction.x / Math.hypot(direction.x, direction.y) * 8, 'Input X follows screen X');
  near(state.y - spawn.y, direction.y / Math.hypot(direction.x, direction.y) * 8, 'Input Y follows screen Y');
}

// Actor center alone cannot stand six pixels from an exposed wall or solid device.
assert(!canStandInChamber({ x: 243, y: 235 }), 'A supported center with hanging feet is illegal');
assert(canStandInChamber({ x: 243, y: 233 }), 'Exact wall clearance is legal');
for (const base of Object.values(CHAMBER_DEVICE_BASES)) assert(!canStandInChamber(base), 'Every device base is solid');
assert(!canStandInChamber({ x: 161, y: 305 }), 'Feet cannot intersect the core footprint');
assert(canStandInChamber({ x: 164, y: 305 }), 'Feet can contact the core without penetration');
assert.throws(() => createChamberMovementState({ x: 243, y: 255 }), /clearance/);

// The visible central cliff blocks a direct cross-floor route, including huge input frames.
const cliff = createChamberMovementState({ x: 243, y: 226 });
advance(cliff, down, 2500);
near(cliff.x, 243, 'Cliff collision does not auto-route sideways');
near(cliff.y, 233, 'Circle stops at the true step face');
assert.equal(cliff.route, 'upper');
tick(cliff, down, 100, 10000);
near(cliff.y, 233, 'Continuous sweep prevents tunneling across a narrow unsupported gap');

// Tangential input remains responsive on both room edges and device bodies.
const wallSlide = createChamberMovementState({ x: 230, y: 226 });
advance(wallSlide, { x: 1, y: 1 }, 400);
assert(wallSlide.x > 250, 'Diagonal pressure slides along the terrace edge');
near(wallSlide.y, 233, 'Sliding retains full body clearance');
const deviceSlide = createChamberMovementState({ x: 178, y: 311 });
advance(deviceSlide, { x: -1, y: -1 }, 270);
near(deviceSlide.x, 164, 'Sliding never cuts inside the core side');
advance(deviceSlide, { x: -1, y: -1 }, 150);
assert(deviceSlide.y < 289, 'Pressure against a device continues along its side');
assert(deviceSlide.x < 164, 'Rounded feet continue smoothly around the cleared corner');

// Both broad ramps have free lateral space, stop/reverse, and form one full loop.
for (const fps of [30, 60, 120]) {
  const state = createChamberMovementState();
  const frameMs = 1000 / fps;
  via(state, CHAMBER_TEST_ROUTES.mainToClimb, frameMs);
  assert.equal(state.route, 'left-stair');
  const midRamp = { ...state };
  advance(state, still, 300, frameMs);
  assert.deepEqual(state, midRamp, 'Releasing input stops on the ramp');
  advance(state, right, 50, frameMs);
  near(state.y, midRamp.y, 'D is screen-horizontal even on a ramp');
  advance(state, left, 50, frameMs);
  near(state.x, midRamp.x, 'Ramp direction reverses without a rail snap');
  assert(!canInteractWithChamberDevice(state, 'growth'), 'Ramp has no floor interaction authority');
  via(state, CHAMBER_TEST_ROUTES.climbToUpper, frameMs);
  assert.equal(state.route, 'upper');
  walkTo(state, CHAMBER_DEVICE_ANCHORS.growth, frameMs);
  via(state, CHAMBER_TEST_ROUTES.upperToOffering, frameMs);
  via(state, CHAMBER_TEST_ROUTES.descendEast.slice(0, 3), frameMs);
  assert.equal(state.route, 'right-stair');
  const eastRamp = { ...state };
  advance(state, down, 50, frameMs);
  advance(state, up, 50, frameMs);
  near(state.x, eastRamp.x, 'Second ramp does not force lateral travel');
  near(state.y, eastRamp.y, 'Second ramp reverses exactly');
  via(state, CHAMBER_TEST_ROUTES.descendEast.slice(3), frameMs);
  assert.equal(state.route, 'main');
  walkTo(state, CHAMBER_DEVICE_ANCHORS.purifier, frameMs);
  walkTo(state, CHAMBER_DEVICE_ANCHORS.rift, frameMs);
  walkTo(state, { x: 329, y: 320 }, frameMs);
  walkTo(state, CHAMBER_SPAWN_POINT, frameMs);
  walkTo(state, CHAMBER_DEVICE_ANCHORS.core, frameMs);
  via(state, CHAMBER_TEST_ROUTES.coreToStorage, frameMs);
  via(state, CHAMBER_TEST_ROUTES.storageToBehindCore, frameMs);
  via(state, CHAMBER_TEST_ROUTES.behindToFrontCore, frameMs);
}

for (const device of Object.keys(CHAMBER_DEVICE_ANCHORS) as ChamberDevice[]) {
  const state = createChamberMovementState(CHAMBER_DEVICE_ANCHORS[device]);
  assert.equal(state.route, CHAMBER_DEVICE_FLOORS[device]);
  assert(canInteractWithChamberDevice(state, device), `${device} operation point is usable`);
  assert(!canInteractWithChamberDevice(state, device === 'growth' || device === 'offering' ? 'core' : 'growth'),
    'Different floors never authorize each other');
}
const behindCore = createChamberMovementState({ x: 112, y: 305 });
assert(!canInteractWithChamberDevice(behindCore, 'core'), 'Solid device footprints block direct access');

// Bounded delta, invalid input and adapter freeze preserve exact state.
const delayed = createChamberMovementState();
stepChamberMovement(delayed, right, 10000, SPEED);
near(delayed.x, CHAMBER_SPAWN_POINT.x + 8, 'Hidden-tab delta is clamped');
const frozen = { ...delayed };
for (const value of [NaN, Infinity, -1, 0]) {
  stepChamberMovement(delayed, right, value, SPEED);
  stepChamberMovement(delayed, right, 100, value);
}
stepChamberMovement(delayed, { x: NaN, y: 1 }, 100, SPEED);
assert.deepEqual(delayed, frozen);
let enabled = true;
const playerPosition = chamberFeetToPlayerPosition(CHAMBER_SPAWN_POINT);
const fakePlayer = {
  getPosition: () => playerPosition,
  getMovementInput: () => enabled ? right : still,
  getEffectiveSpeed: () => SPEED,
  applyConstrainedMovement: (x: number, y: number) => { playerPosition.x = x; playerPosition.y = y; },
} as unknown as Player;
const adapter = new PurificationChamberLocomotion(fakePlayer);
adapter.update(100);
near(playerPosition.x, CHAMBER_SPAWN_POINT.x + 8, 'Adapter consumes original Player input');
near(playerPosition.y, CHAMBER_SPAWN_POINT.y - 10, 'Adapter converts sole to actor center exactly once');
enabled = false;
const pausedPosition = { ...playerPosition };
adapter.update(1000);
assert.deepEqual(playerPosition, pausedPosition, 'Panel freeze does not accumulate hidden travel');

// A deterministic long input stream challenges rounded corners and both seams.
let seed = 0x31415926;
const fuzz = createChamberMovementState();
for (let frame = 0; frame < 5000; frame++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const angle = (seed & 255) / 256 * Math.PI * 2;
  tick(fuzz, { x: Math.cos(angle), y: Math.sin(angle) }, [16, 33, 100][seed % 3]);
}
console.log(`I30 chamber movement: ${checks} movement/clearance checks passed; eight-way input, solid-device sliding, both ramp loops, six operation points, floor legality, freeze and no-tunneling verified.`);
