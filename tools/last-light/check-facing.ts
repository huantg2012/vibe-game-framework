import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  LAST_LIGHT_SCREEN_DIRECTIONS, lastLightScreenFacingYaws, mergeLastLightFacingYaws,
} from '../../src/art/last-light-facing';
import {
  LAST_LIGHT_CAMERA, LAST_LIGHT_WORLD_WALK_SPEED, REST_YAW, projectLastLight, sampleLastLightSurface,
  type LastLightRoute,
} from '../../src/systems/last-light-layout';
import {
  createLastLightMovementState, lastLightProjectedWalkingSpeed, stepLastLightMovement,
} from '../../src/systems/last-light-locomotion';

const angleDifference = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const degrees = (radians: number): number => radians * 180 / Math.PI;
const probes = [
  {route: 'main' as LastLightRoute, x: 0, z: 0},
  {route: 'west-ramp' as LastLightRoute, x: 2.7, z: -2.5},
];
const groups = probes.map(probe => {
  const plane = sampleLastLightSurface(probe.route, probe.x, probe.z);
  assert(plane, `${probe.route} probe must be on its authored walking plane`);
  return lastLightScreenFacingYaws(LAST_LIGHT_CAMERA, plane);
});
const authoredFacings = mergeLastLightFacingYaws(...groups);
assert.equal(authoredFacings.length, 14, 'Eight screen-key facings per plane share N/S; bake the remaining fourteen');
const requiredAssetFacings = mergeLastLightFacingYaws(authoredFacings, [REST_YAW]);
assert.equal(mergeLastLightFacingYaws([Math.PI, -Math.PI, 3 * Math.PI]).length, 1, 'Wrapped yaw must not duplicate atlas columns');
assert.throws(() => lastLightScreenFacingYaws(LAST_LIGHT_CAMERA, {dx: NaN, dz: 0}), /visible walking plane/);

// Check the forward projection independently of the facing inverse. Use real
// screen key pairs through production movement, never world-XZ diagonals.
let movementChecks = 0, maxKeyDirectionError = 0, maxFacingError = 0;
for (const [probeIndex, probe] of probes.entries()) {
  const surface = sampleLastLightSurface(probe.route, probe.x, probe.z)!;
  const start = {x: probe.x, y: surface.height, z: probe.z};
  const startPixel = projectLastLight(start);
  for (const [keyIndex, [x, y]] of LAST_LIGHT_SCREEN_DIRECTIONS.entries()) {
    const input = {x, y}, expected = Math.atan2(y, x), yaw = groups[probeIndex]![keyIndex]!;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    const forwardPixel = projectLastLight({x: start.x + dx, y: start.y + surface.dx * dx + surface.dz * dz, z: start.z + dz});
    const facingError = angleDifference(Math.atan2(forwardPixel.y - startPixel.y, forwardPixel.x - startPixel.x), expected);
    assert(facingError < 1e-9, `${probe.route} key ${keyIndex} sprite points away from actual key travel`);
    const movement = createLastLightMovementState(start, probe.route);
    const speed = lastLightProjectedWalkingSpeed(movement, input, LAST_LIGHT_WORLD_WALK_SPEED);
    stepLastLightMovement(movement, input, 1000 / 60, speed);
    const nextPixel = projectLastLight(movement);
    const keyError = angleDifference(Math.atan2(nextPixel.y - startPixel.y, nextPixel.x - startPixel.x), expected);
    assert(keyError < 1e-7, `${probe.route} key ${keyIndex} does not travel in its screen direction`);
    assert(angleDifference(movement.facing, yaw) < 1e-7, `${probe.route} key ${keyIndex} movement yaw differs from baked body yaw`);
    assert(Math.abs(Math.hypot(movement.x - start.x, movement.z - start.z) - LAST_LIGHT_WORLD_WALK_SPEED / 60) < 1e-7, 'Facing repair must not change physical walking speed');
    maxKeyDirectionError = Math.max(maxKeyDirectionError, keyError);
    maxFacingError = Math.max(maxFacingError, facingError);
    movementChecks++;
  }
}

let atlasFrameChecks = 0;
const mathOnly = process.argv.includes('--math-only');
if (!mathOnly) {
  const manifest = JSON.parse(await fs.readFile(new URL('../../public/assets/last-light/manifest.json', import.meta.url), 'utf8'));
  const frames = manifest.actor.frames as {pose: string; frame: number; direction: number; yaw: number}[];
  const poses = [...new Set(frames.map(frame => `${frame.pose}:${frame.frame}`))];
  assert(manifest.actor.width <= 8192 && manifest.actor.height <= 8192, 'Actor atlas exceeds the supported texture dimension');
  for (const pose of poses) {
    const candidates = frames.filter(frame => `${frame.pose}:${frame.frame}` === pose);
    for (const yaw of requiredAssetFacings) {
      const selected = [...candidates].sort((a, b) => angleDifference(a.yaw, yaw) - angleDifference(b.yaw, yaw))[0];
      assert(selected && angleDifference(selected.yaw, yaw) < 1e-6, `${pose} atlas is missing the screen-key facing ${degrees(yaw).toFixed(3)}°`);
      atlasFrameChecks++;
    }
    const distinctDirections = new Set(candidates.map(frame => frame.direction));
    assert.equal(distinctDirections.size, requiredAssetFacings.length, `${pose} must have one column for each unique authored facing, including the exact seated orientation`);
  }
}
console.log(JSON.stringify({
  status: mathOnly ? 'MATH-PASS / ASSET-CHECK-SKIPPED' : 'PASS',
  movementChecks, uniqueMovementFacings: authoredFacings.length, uniqueAssetFacings: requiredAssetFacings.length, atlasFrameChecks,
  maxKeyDirectionErrorDegrees: degrees(maxKeyDirectionError), maxFacingErrorDegrees: degrees(maxFacingError),
  checks: ['real screen cardinal and diagonal inputs', 'uphill/downhill inverse projection', 'world movement and sprite yaw agree', 'world speed unchanged', ...(mathOnly ? [] : ['every baked pose contains every required facing'])],
}, null, 2));
