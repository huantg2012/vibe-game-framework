/** Compare study movement with the real Player math without creating Phaser. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { Player } from '../../src/entities/player';
import { readWorldStudyInput, stepWorldStudyVelocity, type WorldStudyVector } from '../../src/generation/world-study/movement';

const near = (actual: number, expected: number, reason: string): void => {
  assert(Math.abs(actual - expected) < 1e-9, `${reason}: ${actual} != ${expected}`);
};
const input = { x: 0, y: 0 }, velocity = { x: 0, y: 0 };
assert.equal(GAME_CONSTANTS.PLAYER.SPEED, 80);
assert.equal(GAME_CONSTANTS.PLAYER.MOVE_ACCEL_TIME, .08);
assert.equal(GAME_CONSTANTS.PLAYER.MOVE_DECEL_TIME, .10);
assert.equal(GAME_CONSTANTS.CAMERA.ZOOM, 1.5);

readWorldStudyInput(new Set(['KeyD']), input);
for (let step = 1; step <= 8; step++) {
  stepWorldStudyVelocity(velocity, input, .01);
  near(velocity.x, step * 10, 'Linear start ramp');
  near(velocity.y, 0, 'Horizontal start has no vertical drift');
}
readWorldStudyInput(new Set(), input);
for (let step = 1; step <= 10; step++) {
  stepWorldStudyVelocity(velocity, input, .01);
  near(velocity.x, 80 - step * 8, 'Linear stop ramp');
}
stepWorldStudyVelocity(velocity, input, .05);
assert.deepEqual(velocity, { x: 0, y: 0 }, 'Released input must settle exactly');

readWorldStudyInput(new Set(['KeyD', 'KeyW']), input);
stepWorldStudyVelocity(velocity, input, .08);
near(Math.hypot(velocity.x, velocity.y), 80, 'Diagonal movement remains base speed');
near(velocity.x, 80 * Math.SQRT1_2, 'Normalized diagonal X');
near(velocity.y, -80 * Math.SQRT1_2, 'Normalized diagonal Y');
readWorldStudyInput(new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft']), input);
assert.deepEqual(input, { x: 0, y: 0 }, 'Opposing inputs cancel');
const arrows = { x: 0, y: 0 }, wasd = { x: 0, y: 0 };
readWorldStudyInput(new Set(['ArrowRight', 'ArrowUp']), arrows);
readWorldStudyInput(new Set(['KeyD', 'KeyW']), wasd);
assert.deepEqual(arrows, wasd, 'Arrows and WASD are equivalent');
readWorldStudyInput(new Set(['KeyW', 'ArrowUp']), input);
assert.deepEqual(input, { x: 0, y: -1 }, 'Aliases do not double movement');

interface FakeBodyVelocity extends WorldStudyVector { set(x: number, y: number): void }
interface ReferencePlayer {
  readonly image: { readonly body: { readonly velocity: FakeBodyVelocity } };
  readonly inputVector: WorldStudyVector;
  moving: boolean;
  getEffectiveSpeed(): number;
}
const formalVelocity: FakeBodyVelocity = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
const reference: ReferencePlayer = { image: { body: { velocity: formalVelocity } }, inputVector: { x: 0, y: 0 },
  moving: false, getEffectiveSpeed: () => GAME_CONSTANTS.PLAYER.SPEED };
const formalStep = (Player.prototype as unknown as { stepVelocity(this: ReferencePlayer, dt: number): void }).stepVelocity;
const study = { x: 0, y: 0 }, shifted = { x: 0, y: 0 }, shiftedInput = { x: 0, y: 0 };
const sequence = [[], ['KeyD'], ['KeyD', 'KeyW'], ['KeyA'], [], ['ArrowDown'], ['KeyA', 'KeyS'], ['KeyS', 'KeyW']];
let compared = 0;
for (let index = 0; index < 320; index++) {
  const active = sequence[Math.floor(index / 10) % sequence.length]!;
  const dt = [1 / 60, 1 / 120, 1 / 30, .007][index % 4]!;
  readWorldStudyInput(new Set(active), input);
  readWorldStudyInput(new Set([...active, index % 2 ? 'ShiftLeft' : 'ShiftRight']), shiftedInput);
  assert.deepEqual(shiftedInput, input, 'Shift must not alter input');
  reference.inputVector.x = input.x; reference.inputVector.y = input.y;
  reference.moving = input.x !== 0 || input.y !== 0;
  formalStep.call(reference, dt);
  stepWorldStudyVelocity(study, input, dt);
  stepWorldStudyVelocity(shifted, shiftedInput, dt);
  near(study.x, formalVelocity.x, 'Real Player X parity');
  near(study.y, formalVelocity.y, 'Real Player Y parity');
  assert.deepEqual(study, shifted, 'Shift does not change speed or ramps');
  assert(Math.hypot(study.x, study.y) <= GAME_CONSTANTS.PLAYER.SPEED + 1e-9, 'Speed never exceeds base state');
  compared++;
}
console.log(`World movement: ${compared} real Player.stepVelocity comparisons passed; normalized diagonals, 0.08s start / 0.10s stop, Shift invariance and shared 80px/s / 1.5 camera constants verified.`);
