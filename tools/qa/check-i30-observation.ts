import assert from 'node:assert/strict';
import { chamberObservationFloorHeight, getChamberObservation, isChamberObservationRayClear } from '../../src/systems/chamber-observation.ts';
import { canInteractWithChamberDevice, createChamberMovementState } from '../../src/systems/purification-chamber-locomotion.ts';
import type { Face } from '../../assets/source/purification-r9/environment.ts';
import { CHAMBER_TEST_POINTS } from './i30-chamber-driver.mjs';

let checks = 0;
const check = (condition: unknown, message: string): void => { checks++; assert(condition, message); };
for (const feet of [{ x: 141, y: 322 }, { x: 149, y: 322 }, { x: 165, y: 305 }, { x: 112, y: 305 }]) {
  const result = getChamberObservation(feet, 'CORE');
  check(result.distance <= 44 && result.visible, 'Front/side observation survives the old operation-anchor discontinuity');
}
for (const feet of [{ x: 193.5, y: 258.5 }, { x: 199, y: 267 }]) {
  const result = getChamberObservation(feet, 'CORE');
  check(result.distance <= 58 && result.visible, 'Core visible above bearing structure from the lower stair approach');
  const movement = createChamberMovementState(feet);
  check(!canInteractWithChamberDevice(movement, 'core'), 'Observation does not grant E across a route seam');
}
check(getChamberObservation({ x: 321, y: 251.5 }, 'PURIFIER').visible, 'Right stair looks onto the purifier without a foot-circle sweep');
// R9's purifier stands before the folded east wall. The enclosed core niche now
// supplies the authored opaque-wall cases; these wall-space probes are deliberately
// not claimed to be legal player positions, just as the original far-wall probes.
for (const feet of [{ x: 141, y: 245 }, { x: 141, y: 260 }]) {
  const result = getChamberObservation(feet, 'CORE');
  check(result.distance <= 58 && !result.visible, 'The actual core-bay wall blocks the full body despite observation proximity');
}
check(getChamberObservation({ x: 185, y: 226 }, 'CORE').visible, 'An upper-floor view can see the tall core body');
check(getChamberObservation({ x: 185, y: 226 }, 'CORE').distance > 58, 'A visible body alone cannot bypass observation distance');
check(chamberObservationFloorHeight({ x: 185, y: 226 }) === 32, 'Upper floor sets eye elevation, not eligibility');
for (const [x, y] of [CHAMBER_TEST_POINTS.leftRamp, CHAMBER_TEST_POINTS.rightRamp]) {
  check(chamberObservationFloorHeight({ x, y }) === 16, 'Each mid-ramp observer has continuous eye elevation');
}
check(chamberObservationFloorHeight({ x: 141, y: 322 }) === 0, 'Main floor height is zero');

const face = (height: number): Face => ({ id: 'test-opaque-wall', layer: 'architecture', color: '#000000',
  points: [[-20, 50 - height], [20, 50 - height], [20, 50], [-20, 50]],
  plane: { normal: [0, 1, 0], elevation: 0, originY: 50, riseY: -1, occlusion: .01 } });
const eye = { x: 0, y: -16, z: 16 };
check(!isChamberObservationRayClear(eye, { x: 0, y: 84, z: 16 }, [face(60)]), 'An opaque high face blocks even when its lighting occlusion coefficient is low');
check(isChamberObservationRayClear(eye, { x: 0, y: 40, z: 60 }, [face(24)]), 'Upper body visible above low bearing face remains observable');
check(!isChamberObservationRayClear(eye, { x: 0, y: 84, z: 16 }, [face(24)]), 'The same bearing face still blocks the low body');
check(isChamberObservationRayClear(eye, { x: 0, y: 84, z: 16 }, [{ ...face(60), plane: null }]), 'Paint without geometry is not an invented opaque wall');
check(isChamberObservationRayClear(eye, { x: 90, y: 84, z: 16 }, [face(60)]), 'A clear line around the actual face edge is visible');
console.log(`I30 R9 chamber observation: ${checks} checks passed.`);
