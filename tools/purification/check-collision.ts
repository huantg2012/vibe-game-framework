import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  PURIFICATION_DEVICE_ANCHORS as anchors,
  PURIFICATION_DEVICE_FOOTPRINTS as footprints,
  PURIFICATION_PLAYER_BODY as feet,
  PURIFICATION_SPAWN_POINT as spawn,
  destroyStaticCollision,
  type PurificationDeviceId,
} from '../../src/systems/purification-collision.ts';
import { DENSE_PLAYER_GROUND_OFFSET_Y } from '../../src/entities/player-sprite-dense.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import {
  createBoundaryShape, BOUNDARY_COLLISION_INNER_SCALE,
  BOUNDARY_COLLISION_SEGMENT_SIZE, BOUNDARY_COLLISION_SAMPLES,
} from '../../src/systems/boundary-shape.ts';

// Run Phaser's installed physics classes and World.separate, without a renderer/DOM.
// Only motion integration's acceleration hook is omitted: these cases hold full speed.
const require = createRequire(import.meta.url);
const Body = require('phaser/src/physics/arcade/Body');
const StaticBody = require('phaser/src/physics/arcade/StaticBody');
const World = require('phaser/src/physics/arcade/World');
const world = {
  defaults: {}, bounds: {}, gravity: { x: 0, y: 0 }, forceX: false,
  OVERLAP_BIAS: 4, staticTree: { remove() {}, insert() {} },
  updateMotion() {}, emit() {},
  intersects: World.prototype.intersects,
  separate: World.prototype.separate,
};

const ids = Object.keys(footprints) as PurificationDeviceId[];
const staticBodies = ids.map(id => {
  const f = footprints[id];
  const anchor = anchors[id];
  const base = new StaticBody(world);
  base.setSize(f.width, f.height);
  base.position.set(anchor.x + f.offsetX - f.width / 2, anchor.y + f.offsetY - f.height / 2);
  base.updateCenter();
  return base;
});

function actorAt(groundX: number, groundY: number) {
  const actor = new Body(world);
  actor.setSize(feet.width, feet.height, false);
  actor.position.set(groundX - feet.width / 2, groundY - feet.height / 2);
  actor.updateCenter();
  return actor;
}

function step(actor: ReturnType<typeof actorAt>, vx: number, vy: number, bodies = staticBodies): void {
  actor.resetFlags();
  actor.velocity.set(vx, vy);
  actor.update(1 / 60);
  for (const base of bodies) world.separate(actor, base, undefined, undefined, false);
  for (const base of bodies) assert.equal(world.intersects(actor, base), false, 'resolved feet never penetrate a base');
}

assert.equal(feet.offsetX + feet.width / 2, 16, 'foot body is horizontally centered on the 32px model');
assert.equal(feet.offsetY + feet.height / 2 - 16, DENSE_PLAYER_GROUND_OFFSET_Y, 'physics center equals the stable depth-sort contact');
assert.equal(GAME_CONSTANTS.PLAYER.BODY_SIZE, 20, 'shared rift collision size is unchanged');
assert.deepEqual(GAME_CONSTANTS.PLAYER.BODY_OFFSET, { x: 6, y: 6 }, 'shared rift collision offset is unchanged');

const speed = GAME_CONSTANTS.PLAYER.SPEED;
const interactionRadius = GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;
for (const [index, id] of ids.entries()) {
  const base = staticBodies[index]!;
  const anchor = anchors[id];
  assert.ok(base.y < anchor.y && base.bottom > anchor.y, `${id}: base covers the sorting line`);

  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const actor = actorAt(base.center.x + dx! * 36, base.center.y + dy! * 36);
    for (let tick = 0; tick < 180; tick++) step(actor, -dx! * speed, -dy! * speed);
    const expectedX = base.center.x + dx! * (base.width + feet.width) / 2;
    const expectedY = base.center.y + dy! * (base.height + feet.height) / 2;
    assert.ok(Math.abs(actor.center.x - expectedX) < 1e-6 && Math.abs(actor.center.y - expectedY) < 1e-6, `${id}: continuous pressure stops on side ${dx},${dy}`);
    if (dy) assert.equal(actor.center.y > anchor.y, dy > 0, `${id}: blocked approach cannot cross the depth-sort line`);
    assert.equal(dx ? actor.velocity.x : actor.velocity.y, 0, `${id}: collision has no bounce`);
    assert.ok(Math.hypot(actor.center.x - anchor.x, actor.center.y - DENSE_PLAYER_GROUND_OFFSET_Y - anchor.y) < interactionRadius, `${id}: interaction remains reachable from side ${dx},${dy}`);
  }

  // All four corners are free standing positions inside the existing interaction ring.
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    const actor = actorAt(base.center.x + dx * ((base.width + feet.width) / 2 + 0.01), base.center.y + dy * ((base.height + feet.height) / 2 + 0.01));
    assert.ok(Math.hypot(actor.center.x - anchor.x, actor.center.y - DENSE_PLAYER_GROUND_OFFSET_Y - anchor.y) < interactionRadius, `${id}: corner interaction is reachable`);
    for (const other of staticBodies) assert.equal(world.intersects(actor, other), false, `${id}: interaction corner is not occupied`);
  }

  const actor = actorAt(base.center.x, base.bottom + feet.height / 2 + 0.1);
  const tangentSpeed = speed / Math.SQRT2;
  for (let tick = 0; tick < 8; tick++) step(actor, tangentSpeed, -tangentSpeed);
  assert.ok(actor.center.x > base.center.x + 6, `${id}: diagonal pressure slides tangentially`);
  assert.ok(actor.center.y > anchor.y, `${id}: sliding remains in front before clearing the edge`);
  for (let tick = 0; tick < 32; tick++) step(actor, tangentSpeed, -tangentSpeed);
  assert.ok(actor.x >= base.right && actor.center.y < anchor.y, `${id}: walking around the edge reaches the rear`);
}

// Spawn is unobstructed and can start moving in all eight directions.
for (let direction = 0; direction < 8; direction++) {
  const angle = direction * Math.PI / 4;
  const actor = actorAt(spawn.x, spawn.y + DENSE_PLAYER_GROUND_OFFSET_Y);
  for (let tick = 0; tick < 18; tick++) step(actor, Math.cos(angle) * speed, Math.sin(angle) * speed);
  assert.ok(Math.hypot(actor.center.x - spawn.x, actor.center.y - spawn.y - DENSE_PLAYER_GROUND_OFFSET_Y) > 23.9, 'spawn has room to leave in every direction');
}

console.log('PASS actual Arcade separation: five bases × four sustained approaches, stable depth side, diagonal sliding and rear access');
console.log('PASS aligned feet, 32px side/corner interaction access, open spawn, unchanged rift defaults');

// Regression: the south purifier used to form a pocket against the narrow membrane.
// Match production's 90 angles, 8px square blocks, two rows and .98 cutoff, then run
// those bodies AND all five bases through the same Arcade separation pass.
let combinedRoutes = 0;
for (const tidePhase of ['rise', 'crest', 'ebb'] as const) {
  for (const pressureSeed of [0, 7919, 15838, 79190, 997]) {
    const center = anchors.core;
    const points = [...Object.values(anchors), { x: center.x, y: center.y - 4 * GAME_CONSTANTS.TILE_SIZE }];
    const shape = createBoundaryShape({
      ellipseRx: 5.2, ellipseRy: 5, tideIntensity: 3, tidePhase, pressureSeed,
      interactionPoints: points, centerX: center.x, centerY: center.y,
    });
    const boundaryBodies = [];
    for (let i = 0; i < BOUNDARY_COLLISION_SAMPLES; i++) {
      const angle = i * Math.PI * 2 / BOUNDARY_COLLISION_SAMPLES;
      const r = shape.radiusAt(angle) * BOUNDARY_COLLISION_INNER_SCALE;
      for (let row = 0; row < 2; row++) {
        const body = new StaticBody(world);
        body.setSize(BOUNDARY_COLLISION_SEGMENT_SIZE, BOUNDARY_COLLISION_SEGMENT_SIZE);
        const radius = r + row * BOUNDARY_COLLISION_SEGMENT_SIZE;
        body.position.set(center.x + Math.cos(angle) * radius - body.halfWidth, center.y + Math.sin(angle) * radius - body.halfHeight);
        body.updateCenter();
        boundaryBodies.push(body);
      }
    }
    const allBodies = [...boundaryBodies, ...staticBodies];
    for (const point of points) {
      for (const block of boundaryBodies) {
        const nearestX = Math.max(block.x, Math.min(point.x, block.right));
        const nearestY = Math.max(block.y, Math.min(point.y, block.bottom));
        assert.ok(Math.hypot(nearestX - point.x, nearestY - point.y) >= interactionRadius + Math.hypot(feet.width, feet.height) / 2, 'sampled membrane leaves the full feet clear throughout the 32px safety disk');
      }
      // Include non-integer polar angles: nearest-degree rounding must not cut corners.
      for (let angleDeg = 0.17; angleDeg < 360; angleDeg += 3.31) {
        const angle = angleDeg * Math.PI / 180;
        assert.ok(shape.isInside(point.x + Math.cos(angle) * interactionRadius, point.y + Math.sin(angle) * interactionRadius), 'safe disk perimeter remains inside the shared visual shape');
      }
    }
    for (const [index, id] of ids.entries()) {
      const base = staticBodies[index]!;
      for (const fromSide of [-1, 1]) for (const turnSide of [-1, 1]) {
        const actor = actorAt(base.center.x, base.center.y + fromSide * ((base.height + feet.height) / 2 + 0.1));
        let reachedOtherSide = false;
        for (let tick = 0; tick < 120; tick++) {
          step(actor, turnSide * speed / Math.SQRT2, -fromSide * speed / Math.SQRT2, allBodies);
          if ((actor.center.y - anchors[id].y) * fromSide < -1) {
            reachedOtherSide = true;
            break;
          }
        }
        assert.ok(reachedOtherSide, `${tidePhase}/${pressureSeed}/${id}: diagonal route from ${fromSide} around ${turnSide} is not trapped between base and membrane`);
        combinedRoutes++;
      }
    }
  }
}
console.log(`PASS ${combinedRoutes} combined base/membrane routes across rise/crest/ebb at maximum intensity and five pressure seeds; exact 32px safety disks`);

// Group/Collider lifecycle is real Phaser code too; only unused renderer sprite
// constructors and GridAlign's eager Zone are replaced to avoid browser graphics.
for (const rendererPath of ['phaser/src/gameobjects/sprite/Sprite', 'phaser/src/physics/arcade/ArcadeSprite', 'phaser/src/actions/GridAlign']) {
  const resolved = require.resolve(rendererPath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: class {} } as NodeJS.Module;
}
const StaticGroup = require('phaser/src/physics/arcade/StaticPhysicsGroup');
const Collider = require('phaser/src/physics/arcade/Collider');
const EventEmitter = require('eventemitter3');
let childDestructions = 0;
let colliderRemovals = 0;
const groupScene = { sys: { updateList: { add() {}, remove() {} } } };
const colliderWorld = { removeCollider() { colliderRemovals++; } };
function collisionResources() {
  const group = new StaticGroup(world, groupScene);
  const child = new EventEmitter();
  child.body = {}; // already-enabled body: group does not need a scene physics factory
  child.destroy = () => { childDestructions++; child.emit('destroy', child); };
  group.add(child);
  return { group, collider: new Collider(colliderWorld, false, null, group) };
}

const live = collisionResources();
destroyStaticCollision(live.collider, live.group);
destroyStaticCollision(live.collider, live.group);
assert.equal(childDestructions, 1, 'live cleanup destroys each child once');
assert.equal(colliderRemovals, 1, 'repeated cleanup does not destroy a collider twice');

const alreadyDestroyed = collisionResources();
alreadyDestroyed.group.destroy(true, true); // display/update shutdown precedes scene callback
alreadyDestroyed.collider.destroy();
assert.equal(alreadyDestroyed.group.scene, undefined);
assert.equal(alreadyDestroyed.group.children, undefined);
destroyStaticCollision(alreadyDestroyed.collider, alreadyDestroyed.group);
destroyStaticCollision(alreadyDestroyed.collider, alreadyDestroyed.group);
assert.equal(childDestructions, 2, 'post-Phaser shutdown does not touch destroyed group children');
assert.equal(colliderRemovals, 2);
destroyStaticCollision(null, null);
console.log('PASS actual StaticGroup/Collider cleanup before shutdown, after Phaser shutdown and on repeated disposal');
