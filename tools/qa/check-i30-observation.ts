import assert from 'node:assert/strict';
import { chamberObservationFloorHeight, getChamberObservation, isChamberObservationRayClear } from '../../src/systems/chamber-observation.ts';
import { canInteractWithChamberDevice, createChamberMovementState } from '../../src/systems/purification-chamber-locomotion.ts';
import type { Face } from '../../assets/source/purification-r8/environment.ts';

let checks = 0;
const check = (condition: unknown, message: string): void => { checks++; assert(condition, message); };
for (const feet of [{ x: 253, y: 318 }, { x: 261, y: 316 }, { x: 261, y: 317 }, { x: 217, y: 299 }]) {
  const result = getChamberObservation(feet, 'CORE');
  check(result.distance <= 44 && result.visible, 'Front/side observation survives the old operation-anchor discontinuity');
}
for (const feet of [{ x: 294, y: 249 }, { x: 304, y: 256 }]) {
  const result = getChamberObservation(feet, 'CORE');
  check(result.distance <= 58 && result.visible, 'Core visible above bearing structure from the lower stair approach');
  const movement = createChamberMovementState(feet);
  check(!canInteractWithChamberDevice(movement, 'core'), 'Observation does not grant E across a route seam');
}
check(getChamberObservation({ x: 420, y: 239 }, 'PURIFIER').visible, 'Right stair looks onto the purifier without a foot-circle sweep');
check(!getChamberObservation({ x: 451, y: 200 }, 'PURIFIER').visible, 'The actual east high wall hides the complete purifier body');
check(!getChamberObservation({ x: 451, y: 232 }, 'PURIFIER').visible, 'Standing on the far wall edge cannot see through it');
check(getChamberObservation({ x: 253, y: 220 }, 'CORE').visible, 'An upper-floor view can see the tall core body');
check(getChamberObservation({ x: 253, y: 220 }, 'CORE').distance > 58, 'A visible body alone cannot bypass observation distance');
check(chamberObservationFloorHeight({ x: 253, y: 220 }) === 32, 'Upper floor sets eye elevation, not eligibility');
check(chamberObservationFloorHeight({ x: 294, y: 245 }) === 16, 'Mid-ramp observer has continuous eye elevation');
check(chamberObservationFloorHeight({ x: 253, y: 318 }) === 0, 'Main floor height is zero');

const face = (height: number): Face => ({ id: 'test-opaque-wall', layer: 'architecture', color: '#000000',
  points: [[-20, 50 - height], [20, 50 - height], [20, 50], [-20, 50]],
  plane: { normal: [0, 1, 0], elevation: 0, originY: 50, riseY: -1, occlusion: .01 } });
const eye = { x: 0, y: -16, z: 16 };
check(!isChamberObservationRayClear(eye, { x: 0, y: 84, z: 16 }, [face(60)]), 'An opaque high face blocks even when its lighting occlusion coefficient is low');
check(isChamberObservationRayClear(eye, { x: 0, y: 40, z: 60 }, [face(24)]), 'Upper body visible above low bearing face remains observable');
check(!isChamberObservationRayClear(eye, { x: 0, y: 84, z: 16 }, [face(24)]), 'The same bearing face still blocks the low body');
check(isChamberObservationRayClear(eye, { x: 0, y: 84, z: 16 }, [{ ...face(60), plane: null }]), 'Paint without geometry is not an invented opaque wall');
check(isChamberObservationRayClear(eye, { x: 90, y: 84, z: 16 }, [face(60)]), 'A clear line around the actual face edge is visible');
console.log(`I30 R8 chamber observation: ${checks} checks passed.`);
