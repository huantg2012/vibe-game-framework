/** Contract checks: actual tool sources -> non-damaging body feedback -> independent hit recoil. */
import assert from 'node:assert/strict';
import Phaser from 'phaser';
import { RestraintReaction, type RestraintPose } from '../../src/entities/restraint-reaction';
import { attachAnimatedModel, type AnimatedModelRequest } from '../../src/entities/form-renderers/d/model-visual';
import { notifyVisualHit } from '../../src/entities/hit-reaction';
import { ToolSystem } from '../../src/systems/tool-system';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { AIState } from '../../src/types/game-types';

Object.assign(Phaser.Math, { Clamp: (n: number, a: number, b: number) => Math.max(a, Math.min(b, n)) });
const free = { pressure: false, snared: false };
const pressure = { pressure: true, snared: false };
const snared = { pressure: false, snared: true };
const both = { pressure: true, snared: true };
const neutral = { scaleX: 1, scaleY: 1 };
function run(reaction: RestraintReaction, ms: number, pose: RestraintPose, dt = 20) {
  let frame = reaction.advance(0, pose);
  for (let elapsed = 0; elapsed < ms; elapsed += dt) frame = reaction.advance(Math.min(dt, ms - elapsed), pose);
  return frame;
}
for (const condition of [pressure, snared]) {
  const reaction = new RestraintReaction();
  assert.deepEqual(reaction.advance(20), neutral);
  const entry = run(reaction, 80, condition);
  assert(entry.scaleY < .98 && entry.scaleX > 1, 'entering control visibly settles the body');
  const settled = run(reaction, 2000, condition);
  for (let i = 0; i < 120; i++) {
    const held = reaction.advance(16, { ...condition });
    assert(Math.abs(held.scaleY - settled.scaleY) < .0001, 'holding an existing condition cannot repeatedly strike the body');
  }
  const earlyRelease = reaction.advance(20, free);
  assert(earlyRelease.scaleY > settled.scaleY && earlyRelease.scaleY < 1, 'release recovers rather than popping to baseline');
  assert.deepEqual(run(reaction, 2200, free), neutral, 'release restores the exact baseline');
  assert(run(reaction, 80, condition).scaleY < .98, 'a later independent entry reacts again');
}
for (const retained of [pressure, snared]) {
  const reaction = new RestraintReaction(), reference = new RestraintReaction();
  run(reaction, 1500, both);
  const single = run(reaction, 2000, retained), expected = run(reference, 2000, retained);
  assert(single.scaleY < .98, 'removing one condition retains the other');
  assert(Math.abs(single.scaleY - expected.scaleY) < .0001);
}
const atRates = [1000 / 30, 1000 / 60, 1000 / 120].map(dt => run(new RestraintReaction(), 500, both, dt));
assert(Math.max(...atRates.map(f => f.scaleY)) - Math.min(...atRates.map(f => f.scaleY)) < .001,
  'body settling has the same elapsed-time outcome across frame rates');
console.log('PASS pressure/snare entry, stable hold, smooth release, re-entry, overlap and frame-rate consistency');

// Real ToolSystem useSlot / crossing / expiry, without poking its internal effect arrays.
inventoryStore.setPersistence(null); contaminantSystem.reset();
for (const [slot, type] of ['compress', 'stitch'].entries()) {
  const item = contaminantSystem.createUnowned(type as 'compress' | 'stitch', CONTAMINANT_DATA[type as 'compress' | 'stitch'].rarity);
  item.stage = 'tool'; item.usesRemaining = type === 'compress' ? 2 : 1;
  assert(inventoryStore.addContaminant(item).ok); assert(inventoryStore.prepareTool(item.id, slot).ok);
}
assert(inventoryStore.beginRun('restraint-contract').ok);
const position = { x: 180, y: 176 }, controls = new EnemyControlState();
const enemy = { getId: () => 'restrained', getPosition: () => position, getRole: () => 'infiltrator', getState: () => AIState.CHASE };
const graphics: unknown = new Proxy({}, { get: () => () => graphics });
const tools = new ToolSystem();
tools.create({ add: { graphics: () => graphics }, time: { now: 0 } } as never,
  contaminantSystem.getSortieLoadout(), () => ({ x: 176, y: 176 }), () => [enemy] as never, {
    isTargetAlive: () => true, isTargetVisible: () => true, hasTargetLineOfSight: () => true,
    setEnemyControl: (_id, source, effect) => controls.set(source, effect), clearEnemyControl: (_id, source) => controls.clear(source),
    getStitchPlacement: () => ({ pointA: { x: 208, y: 144 }, pointB: { x: 208, y: 208 } }),
  });
try {
  assert(tools.useSlot(0)); tools.update(16);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), pressure);
  assert(tools.useSlot(1)); position.x = 220; tools.update(16);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), both);
  assert.equal(controls.movementMultiplier, 0);
  assert.equal(controls.attackSuppressed, false, 'restraint cannot invent attack interruption');
  assert.equal(controls.perceptionMultiplier, 1);
  tools.update(1501);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), pressure, 'snare expiry retains the pressure source');
  assert.equal(controls.movementMultiplier, .5);
  position.x = 260; tools.update(16);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), free);
  position.x = 220; tools.update(16);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), pressure);
  position.x = 180; tools.update(16);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), pressure, 'same seam cannot fabricate a second snare reaction');
  assert(tools.useSlot(0)); tools.update(4500);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), pressure, 'older pressure expiry cannot remove a newer overlapping source');
  assert.equal(controls.movementMultiplier, .5);
  tools.update(1501);
  assert.deepEqual(tools.getEnemyRestraintPose('restrained'), free);
  assert.equal(controls.movementMultiplier, 1);
  assert.deepEqual(tools.getEnemyRestraintPose('unrelated'), free);
} finally { tools.destroy(); inventoryStore.setPersistence(null); }
console.log('PASS actual tool placement, crossing, final-use lifetime, overlap, expiry and source-specific visual state');

// Exercise the production model adapter, with only the GPU/canvas boundary substituted.
const image = {
  x: 0, y: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0,
  setDepth() { return this; }, setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; },
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
  setVisible() { return this; }, setAlpha() { return this; }, destroy() {},
};
const baked: AnimatedModelRequest[] = [];
const visual = attachAnimatedModel({ scene: {
  textures: { createCanvas: () => ({ getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(64) }), putImageData() {} }), refresh() {} }), remove() {} },
  add: { image: () => image },
}, form: { coverage: 'low' }, seed: 1, depth: 20, subjectId: 'restraint-model' } as never,
{ id: 'qa-body', walkCycleMs: 800, stridePixels: 8, bake(request) {
  baked.push(request); return { buf: { data: new Uint8ClampedArray(64) }, canvas: { w: 4, h: 4, originX: 2, originY: 3 } } as never;
} });
const pose = { x: 100, y: 100, deltaMs: 20, facing4: 'right' as const, moving: false, visibility: 1, signal: 'idle' as const, restraint: pressure };
try {
  for (let i = 0; i < 100; i++) visual.update(pose);
  const heldScale = image.scaleY;
  assert(heldScale < .98); assert.equal(image.x, 100, 'pressure is not a fake directional hit');
  notifyVisualHit('restraint-model', 1, 0); visual.update(pose);
  assert.notEqual(image.x, 100, 'real accepted hits still produce directional recoil during restraint');
  for (let i = 0; i < 30; i++) visual.update(pose);
  assert.equal(image.x, 100); assert(Math.abs(image.scaleY - heldScale) < .0001, 'hit expiry retains held posture');
  visual.update({ ...pose, attack: { phase: 'windup', progress: .4 } });
  assert.equal(baked.at(-1)?.phase, 'windup', 'restraint does not replace the authoritative attack animation');
  for (let i = 0; i < 110; i++) visual.update({ ...pose, restraint: free });
  assert.equal(image.scaleX, 1); assert.equal(image.scaleY, 1); assert.equal(image.x, 100); assert.equal(image.y, 100);
} finally { visual.destroy(); }
console.log('PASS production model composition: restraint and real hits remain independent, attack pose preserved, baseline restored');
