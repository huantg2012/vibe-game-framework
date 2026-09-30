import assert from 'node:assert/strict';
import {
  CHAMBER_DEVICE_WORLD_ANCHORS, LAST_LIGHT_FOOT_RADIUS, LAST_LIGHT_OBSTACLES,
  REST_WORLD_APPROACH, sampleLastLightSurface,
  type LastLightRoute, type WorldPoint,
} from '../../src/systems/last-light-layout.ts';
import {
  LAST_LIGHT_INTERACTION_PROFILES, LAST_LIGHT_INTERACTION_KEYS,
  chooseLastLightInteraction, lastLightInteractionDistance,
  type LastLightInteractionKey, type LastLightInteractionProfile,
} from '../../src/systems/last-light-interaction.ts';
import {
  canStandLastLight, createLastLightMovementState, getLastLightInteractionDistance,
  canInteractLastLight, stepLastLightMovement, lastLightProjectedWalkingSpeed,
  type LastLightMovementState,
} from '../../src/systems/last-light-locomotion.ts';

const results: string[] = [];
const stateAt = (point: WorldPoint, route: LastLightRoute): LastLightMovementState => createLastLightMovementState(point, route);
const eligible = (state: LastLightMovementState, profile: LastLightInteractionProfile): boolean =>
  Number.isFinite(lastLightInteractionDistance(state, profile, canStandLastLight));
const crossesStorageFloorBreak = (profile: LastLightInteractionProfile, point: WorldPoint): boolean =>
  profile.key === 'storage' && Math.abs(point.z + 3.178025) < .0001 && point.x < 8.35;
let frontSamples = 0, sideSamples = 0, rearSamples = 0, approachSamples = 0;
for (const profile of LAST_LIGHT_INTERACTION_PROFILES) {
  const approach = profile.key === 'rest' ? REST_WORLD_APPROACH : CHAMBER_DEVICE_WORLD_ANCHORS[profile.key];
  assert(eligible(stateAt(approach, profile.route), profile), `${profile.key}: approved approach remains usable`);
  approachSamples++;
  let nearFront = 0, nearSide = 0;
  for (let edgeIndex = 0; edgeIndex < profile.edges.length; edgeIndex++) {
    const edge = profile.edges[edgeIndex]!;
    for (const fraction of [.15, .5, .85]) {
      for (const distance of [LAST_LIGHT_FOOT_RADIUS + .012, .5, .9, 1.25]) {
        const point = { x: edge.a.x + (edge.b.x - edge.a.x) * fraction + edge.nx * distance,
          y: edge.a.y, z: edge.a.z + (edge.b.z - edge.a.z) * fraction + edge.nz * distance };
        if (!canStandLastLight(point, profile.route)) continue;
        if (crossesStorageFloorBreak(profile, point)) {
          assert(!eligible(stateAt(point, profile.route), profile), 'storage: broken upper-floor edge must interrupt reach');
          continue;
        }
        assert(eligible(stateAt(point, profile.route), profile), `${profile.key}: legal ${edgeIndex ? 'front side' : 'front'} approach ${fraction} at ${distance}m lost interaction`);
        if (edgeIndex === 0) { frontSamples++; nearFront++; } else { sideSamples++; nearSide++; }
      }
    }
  }
  assert(nearFront >= 3, `${profile.key}: insufficient usable frontage`);
  if (profile.edges.length > 1) assert(nearSide >= 2, `${profile.key}: no reasonable side approach`);
  const obstacle = LAST_LIGHT_OBSTACLES.find(item => item.id === profile.key);
  if (obstacle && profile.backstop) {
    const front = profile.edges[0]!, center = profile.backstop;
    const depth = Math.abs((front.a.x - center.x) * center.nx + (front.a.z - center.z) * center.nz);
    for (const distance of [.24, .5, 1]) {
      const point = { x: center.x - center.nx * (depth + distance), y: front.a.y,
        z: center.z - center.nz * (depth + distance) };
      if (!canStandLastLight(point, profile.route)) continue;
      assert(!eligible(stateAt(point, profile.route), profile), `${profile.key}: rear face must not activate`);
      rearSamples++;
    }
  }
  const valid = stateAt(approach, profile.route);
  assert(!eligible({ ...valid, route: profile.route === 'main' ? 'upper' : 'main' }, profile), `${profile.key}: cross-floor activation`);
  assert(!eligible({ ...valid, y: valid.y + 2.6 }, profile), `${profile.key}: wrong physical height activation`);
  assert(!eligible({ ...valid, x: NaN }, profile), `${profile.key}: non-finite position activation`);
}
results.push(`${approachSamples} approved approaches, ${frontSamples} full-front and ${sideSamples} front-side positions; ${rearSamples} reachable rear positions rejected`);
results.push('all seven interactables reject wrong floor, height and invalid coordinates');

// The reported failure: feet close to either end of the purifier frontage are
// separated from the old parking point by the machine's own expanded base.
const purifier = LAST_LIGHT_INTERACTION_PROFILES.find(profile => profile.key === 'purifier')!;
const front = purifier.edges[0]!;
for (const fraction of [.04, .12, .5, .88, .96]) {
  const point = { x: front.a.x + (front.b.x - front.a.x) * fraction + front.nx * .235,
    y: front.a.y, z: front.a.z + (front.b.z - front.a.z) * fraction + front.nz * .235 };
  const state = stateAt(point, purifier.route);
  assert(canInteractLastLight(state, 'purifier'), `purifier close face ${fraction}: must not require retreat`);
  // Repeated diagonal pressure against the real collider keeps the same prompt,
  // including contact sliding. This runs the production movement, not teleport.
  for (let tick = 0; tick < 20; tick++) {
    const input = { x: -1, y: -1 };
    stepLastLightMovement(state, input, 1000 / 60, lastLightProjectedWalkingSpeed(state, input, 1.8));
    if ((state.x - point.x) ** 2 + (state.z - point.z) ** 2 < .04) {
      assert(canInteractLastLight(state, 'purifier'), 'near-contact movement may not lose the purifier prompt');
    }
  }
}
results.push('purifier entire close operating face and diagonal contact motion retain interaction');

// Real forecourt breach: the two feet positions are legal but the shorter line
// crosses the missing floor. A generous reach may never bypass topology.
const holeState = stateAt({ x: 7.7, y: 0, z: 3.08 }, 'main');
const acrossHole: LastLightInteractionProfile = { key: 'rift', route: 'main', reach: 8,
  edges: [{ a: { x: 7.2, y: .057, z: -.325 }, b: { x: 8.2, y: .057, z: -.325 }, nx: 0, nz: 1 }] };
assert(!eligible(holeState, acrossHole), 'may not interact across the actual forecourt hole');
const slope = stateAt({ x: 2.75, y: 0, z: -2.25 }, 'west-ramp');
for (const profile of LAST_LIGHT_INTERACTION_PROFILES) assert(!eligible(slope, profile), 'ramp must not reach either storey through projection');
results.push('actual floor breach and ramp/storey separation block reach');

// Distances are physical edge distances. A tie has deterministic order; a
// small candidate crossover does not flicker, but leaving clears immediately.
const distances = Object.fromEntries(LAST_LIGHT_INTERACTION_KEYS.map(key => [key, Infinity])) as Record<LastLightInteractionKey, number>;
assert.equal(chooseLastLightInteraction(distances, null), null);
distances.purifier = .7; distances.rift = .7;
assert.equal(chooseLastLightInteraction(distances, null), 'purifier');
for (const jitter of [.01, -.03, .06, -.01]) {
  distances.rift = .7 + jitter;
  assert.equal(chooseLastLightInteraction(distances, 'purifier'), 'purifier');
}
distances.rift = .5;
assert.equal(chooseLastLightInteraction(distances, 'purifier'), 'rift');
distances.rift = Infinity;
assert.equal(chooseLastLightInteraction(distances, 'rift'), 'purifier');
distances.purifier = Infinity;
assert.equal(chooseLastLightInteraction(distances, 'purifier'), null);
results.push('deterministic nearest edge selection, 0.16m switch hysteresis and immediate invalidation');

// Verify that eligible belts are continuous all the way to the physical foot
// limit; no annulus where retreating activates but touching loses the target.
let continuousSamples = 0;
for (const profile of LAST_LIGHT_INTERACTION_PROFILES) {
  const edge = profile.edges[0]!;
  for (let distance = .235; distance <= 1.39; distance += .025) {
    const point = { x: (edge.a.x + edge.b.x) / 2 + edge.nx * distance,
      y: edge.a.y, z: (edge.a.z + edge.b.z) / 2 + edge.nz * distance };
    const surface = sampleLastLightSurface(profile.route, point.x, point.z);
    if (!surface || !canStandLastLight(point, profile.route)) continue;
    if (crossesStorageFloorBreak(profile, point)) continue;
    const state = stateAt(point, profile.route);
    assert(Number.isFinite(getLastLightInteractionDistance(state, profile.key)), `${profile.key}: hole in operating belt at ${distance}`);
    continuousSamples++;
  }
}
results.push(`${continuousSamples} continuous approach samples from contact to reach limit`);
console.log(JSON.stringify({ passed: results.length, checks: results }, null, 2));
