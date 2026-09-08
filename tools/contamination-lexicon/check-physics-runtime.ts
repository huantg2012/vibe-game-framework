/** I18: fixed-step/render cadence and real Arcade static-body separation. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { AISystem } from '../../src/systems/ai/ai-system';
import { Enemy } from '../../src/entities/enemy-factory';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import type Phaser from 'phaser';
const require = createRequire(import.meta.url);
const Emitter = require('eventemitter3');
const separateX = require('phaser/src/physics/arcade/SeparateX');
const separateY = require('phaser/src/physics/arcade/SeparateY');
const world = new Emitter();
let filter: (_a: unknown, b: unknown) => boolean;
let colliderDestroyed = 0;
let trackedRoster: unknown[] = [];
const scene = { physics: { world, add: { collider(_player: unknown, roster: unknown[], _callback: unknown, process: typeof filter) {
  trackedRoster = roster; filter = process; return { world, destroy() { assert(this.world); colliderDestroyed++; this.world = null; } };
} } } };
const grid = { cols: 40, rows: 40, tileSize: 32, version: 0, isOpaque: () => false, isWalkable: () => true };
const ai = new AISystem();
ai.create(scene as unknown as Phaser.Scene, [], grid, grid, { requireExactlyOneRewriter: false });
const bodySprite = { x: 100, y: 100, name: 'mobile' };
const actual = { x: 0, y: 0 };
const mobile = Object.create(Enemy.prototype) as Enemy;
Object.assign(mobile, { id:'mobile', form:INFILTRATOR_FORM, body:bodySprite, actualVelocity:actual,
  ai:{ position:{x:100,y:100} }, syncVisuals() {}, destroy() {} });
const state = ai as unknown as { enemies: Enemy[]; sprites: unknown[]; updateStuckWatchdog(): void };
state.enemies.push(mobile); state.sprites.push(bodySprite); state.updateStuckWatchdog = () => {};
assert.equal(world.listenerCount('worldstep'), 1);
// Real source ordering: world step integrates 0.5px at 60Hz, then Arcade publishes
// the sprite, then Scene POST_UPDATE. Alternate 120Hz frames have no world step.
for (let frame=0;frame<240;frame++) {
  if (frame % 2 === 0) { bodySprite.x += .5; world.emit('worldstep', 1/60); }
  ai.postUpdate(1000/120);
  assert(Math.abs(mobile.getActualVelocity().x - 30) < 1e-9,
    '120Hz scene must see resolved 30px/s on physics and non-physics frames, never 60/0');
}
// Multiple fixed steps in one rendered frame use their aggregate simulation time.
for (let step=0;step<2;step++) { bodySprite.x += .5; world.emit('worldstep', 1/60); }
ai.postUpdate(1000/30);
assert(Math.abs(actual.x - 30) < 1e-9);
world.emit('worldstep', 1/60); ai.postUpdate(1000/120);
assert.equal(actual.x, 0, 'a wall-blocked actual physics step immediately stops the gait');
ai.postUpdate(1000/120); assert.equal(actual.x, 0);
// Contact correction is published to AI position; it is not attributed to the next step.
bodySprite.x += 1; mobile.syncPositionFromBody();
world.emit('worldstep', 1/60); ai.postUpdate(1000/120); assert.equal(actual.x, 0);
ai.postUpdate(5000); assert.equal(actual.x, 0, 'background render delta cannot create motion');
bodySprite.x += .5; world.emit('worldstep', 1/60); ai.postUpdate(5000);
assert(Math.abs(actual.x - 30) < 1e-9, 'resume uses actual physics time rather than stale render time');

// Collider consumes the live roster and the actual entity substrate predicate.
ai.addStaticPlayerCollider({} as Phaser.Physics.Arcade.Image);
assert.equal(trackedRoster, state.sprites);
assert.equal(filter!({}, bodySprite), false, 'mobile enemy never hard-blocks/boxes in the player');
function fixed(id: string, substrate: string) {
  const enemy = Object.create(Enemy.prototype) as Enemy;
  Object.assign(enemy, { id, form:{ ...INFILTRATOR_FORM, substrate }, destroy() {} });
  state.enemies.push(enemy);
  const sprite = { name:id }; state.sprites.push(sprite);
  return sprite;
}
const door = fixed('door', 'doorframe'), wreck = fixed('wreck', 'street_wreckage');
assert.equal(filter!({}, door), false, 'wall-only door has no floor body profile or ghost floor collider');
assert(filter!({}, wreck), 'historical gym foundation still exercises the static collider');
state.enemies.splice(state.enemies.findIndex(e => e.id === 'wreck'),1);
state.sprites.splice(state.sprites.indexOf(wreck),1);
assert.equal(filter!({}, wreck), false, 'destroyed base cannot leave a ghost obstacle');

// Exercise Phaser's actual collision resolution for 20x20 zero-speed foundations.
function physicsBody(x: number, moving: boolean) {
  return { x, y:100, width:20, height:20, get right() { return this.x+this.width; }, get bottom() { return this.y+this.height; },
    _dx:moving?2:0, _dy:0, immovable:!moving, pushable:moving, moves:false,
    velocity:{x:moving?80:0,y:0}, bounce:{x:0,y:0}, blocked:{}, touching:{}, checkCollision:{},
    deltaAbsX() {return Math.abs(this._dx);}, deltaAbsY() {return Math.abs(this._dy);},
    processX(delta: number, velocity: number) {this.x+=delta;this.velocity.x=velocity;},
    processY(delta: number, velocity: number) {this.y+=delta;this.velocity.y=velocity;} };
}
const movingPlayer = physicsBody(81,true), foundation = physicsBody(100,false);
assert(separateX(movingPlayer, foundation, false, 4));
assert.equal(movingPlayer.right, foundation.x, 'player is separated at the physical 20px footprint');
assert.equal(foundation.x,100, 'immovable foundation never gets pushed by the player');
assert.equal(movingPlayer.velocity.x,0);
const fromBelow = physicsBody(100,true), fixedBase = physicsBody(100,false);
fromBelow.y=119; fromBelow._dy=-2; fromBelow._dx=0; fromBelow.velocity.y=-80;
assert(separateY(fromBelow,fixedBase,false,4));
assert.equal(fromBelow.y,fixedBase.bottom, 'upward approach stops below base instead of crossing its sorting contact');
assert.equal(fixedBase.y,100); assert.equal(fromBelow.velocity.y,0);
ai.destroy();
assert.equal(world.listenerCount('worldstep'),0, 'shutdown removes fixed-step listener');
assert.equal(colliderDestroyed,1, 'shutdown removes static player collider');
world.emit('worldstep',1/60);
ai.create(scene as unknown as Phaser.Scene,[],grid,grid,{requireExactlyOneRewriter:false});
assert.equal(world.listenerCount('worldstep'),1, 'scene recreation has exactly one listener');
ai.destroy();
assert.equal(world.listenerCount('worldstep'),0);
// Phaser shuts its physics plugin down BEFORE our scene shutdown listener.
const retiredWorld = new Emitter();
scene.physics.world = retiredWorld;
ai.create(scene as unknown as Phaser.Scene, [], grid, grid, { requireExactlyOneRewriter:false });
ai.addStaticPlayerCollider({} as Phaser.Physics.Arcade.Image);
const retiredCollider = (ai as unknown as { staticPlayerCollider: { world: unknown; destroy(): void } }).staticPlayerCollider;
retiredCollider.destroy(); // Already disposed by an earlier teardown owner.
scene.physics.world = null;
assert.doesNotThrow(() => ai.destroy(), 'scene plugin world can already be null and collider already destroyed');
assert.equal(retiredWorld.listenerCount('worldstep'),0, 'cached registered emitter is detached even after plugin reset');
assert.doesNotThrow(() => ai.destroy(), 'repeated shutdown is idempotent');
// Re-create against a NEW plugin while the old plugin is already unavailable.
scene.physics.world = new Emitter();
ai.create(scene as unknown as Phaser.Scene, [], grid, grid, { requireExactlyOneRewriter:false });
const priorWorld = scene.physics.world;
scene.physics.world = new Emitter();
ai.create(scene as unknown as Phaser.Scene, [], grid, grid, { requireExactlyOneRewriter:false });
assert.equal(priorWorld.listenerCount('worldstep'),0);
assert.equal(scene.physics.world.listenerCount('worldstep'),1);
ai.destroy();
console.log('check:physics-runtime PASS (120/60 cadence, multiple steps, blocked/resume, live static-only collision, Arcade separation, dispose/recreate)');
