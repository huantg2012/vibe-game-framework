/** Real ability transactions/clocks plus GPU-independent Stage support checks.
 * Run with the existing headless Phaser adapter, never a second skill simulation. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ToolSystem } from '../../src/systems/tool-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { createPresentationFrame } from '../../src/dev/spatial-study/stage/bridge';
import { createToolPresentationFrame } from '../../src/systems/tool-presentation';
import { assertStagePresentationSupported, supportsStageForm, stageWeaponPhaseProgress } from '../../src/dev/spatial-study/stage/support';
import { StageEffects } from '../../src/dev/spatial-study/stage/effects';
import { StageLoot } from '../../src/dev/spatial-study/stage/loot';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import type { ContaminantType } from '../../src/types/game-types';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import type { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';

let checks = 0;
function check(name: string, run: () => void): void { run(); checks++; console.log(`PASS ${name}`); }
function near(a: number, b: number): void { assert(Math.abs(a - b) < 1e-4, `${a} != ${b}`); }

function fixture(type: ContaminantType) {
  inventoryStore.setPersistence(null); contaminantSystem.reset();
  const item = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity);
  item.stage = 'tool'; item.usesRemaining = 1;
  inventoryStore.addContaminant(item);
  const slot = CONTAMINANT_DATA[type].toolType === 'passive' ? 2 : 0;
  assert(inventoryStore.prepareTool(item.id, slot).ok); inventoryStore.beginRun(`stage-${type}`);
  const player = { x: 0, y: 0 }, position = { x: 12, y: 12 }, control = new EnemyControlState();
  const sounds: { x: number; y: number; radius: number }[] = [];
  const graphic: unknown = new Proxy({}, { get: () => () => graphic });
  const scene = { add: { graphics: () => graphic }, time: { now: 0, delayedCall() {} } };
  const enemy = { getRole: () => 'infiltrator', getId: () => 'target', getPosition: () => position, getState: () => 'patrol' };
  const system = new ToolSystem();
  let validPlacement = true;
  system.create(scene as never, contaminantSystem.getSortieLoadout(), () => player, () => [enemy] as never, {
    setEnemyControl: (_id, source, effect) => control.set(source, effect),
    clearEnemyControl: (_id, source) => control.clear(source),
    hasEnemyControl: (_id, source) => control.has(source),
    getStitchPlacement: () => validPlacement ? { pointA: { x: 32, y: -32 }, pointB: { x: 32, y: 32 } } : null,
    getSoundLureDestination: () => validPlacement ? { x: 48, y: 0 } : null,
    reportSoundLure: (point, radius) => sounds.push({ ...point, radius }),
    setHearingSuppressed() {},
  });
  return { system, item, player, position, control, sounds, slot, rejectPlacement: () => { validPlacement = false; } };
}

check('failed placements and failed persistence create no presentation instances or consumption', () => {
  for (const type of ['stitch', 'kindle', 'compress'] as const) {
    const f = fixture(type);
    try {
      inventoryStore.setPersistence(() => { throw new Error('quota'); });
      assert.equal(f.system.useSlot(f.slot), false);
      const view = f.system.getPresentationState();
      assert.equal(view.seams.length + view.pressures.length + view.soundLures.length, 0);
      assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 1);
      assert.equal(f.sounds.length, 0);
      inventoryStore.setPersistence(null);
      if (type !== 'compress') { f.rejectPlacement(); assert.equal(f.system.useSlot(f.slot), false); }
    } finally { f.system.destroy(); }
  }
});

check('stitch presents the committed line, real crossing and complete final-use stop without replay', () => {
  const f = fixture('stitch');
  try {
    assert(f.system.useSlot(0)); assert.equal(inventoryStore.getItem(f.item.id), undefined);
    const view = f.system.getPresentationState(), row = view.seams[0]!;
    assert.deepEqual([row.ax, row.ay, row.bx, row.by], [32, -32, 32, 32]);
    assert.equal(view.loadoutTypes[0], null); assert.equal(row.tension, 0);
    const before = JSON.stringify(view);
    for (let i = 0; i < 100; i++) assert.equal(f.system.getPresentationState().seams[0], row);
    assert.equal(JSON.stringify(view), before, 'reads never advance clocks'); assert.equal(f.control.movementMultiplier, 1);
    f.position.x = 40; f.system.update(16);
    assert.equal(f.system.getPresentationState().seams[0]!.tension, 1);
    assert.equal(f.control.movementMultiplier, 0); assert.equal(f.control.attackSuppressed, false);
    assert.deepEqual(f.system.getEnemyRestraintPose('target'), { pressure: false, snared: true });
    f.system.update(CONTAMINANT_DATA.stitch.toolStopMs);
    assert.equal(f.control.movementMultiplier, 1); assert.equal(f.system.getEnemyRestraintPose('target').snared, false);
    f.position.x = 12; f.system.update(16); f.position.x = 40; f.system.update(16);
    assert.equal(f.control.movementMultiplier, 1, 'crossing the same line again does not reapply');
    f.system.update(CONTAMINANT_DATA.stitch.toolDurationMs);
    for (let at = 0; at < 500; at += 16) f.system.update(16);
    assert.equal(f.system.getPresentationState().seams.length, 0);
  } finally { f.system.destroy(); }
});

check('pressure shares actual radius, controls, final lifetime and release; snapshots do not write control state', () => {
  const f = fixture('compress');
  try {
    assert(f.system.useSlot(0)); f.system.update(16);
    const row = f.system.getPresentationState().pressures[0]!;
    assert.equal(row.radius, CONTAMINANT_DATA.compress.toolRangePx);
    assert.equal(row.remainingMs, CONTAMINANT_DATA.compress.toolDurationMs - 16);
    assert.equal(f.control.movementMultiplier, CONTAMINANT_DATA.compress.toolMovementMult);
    assert.equal(f.control.attackSuppressed, false); assert(f.system.getEnemyRestraintPose('target').pressure);
    for (let i = 0; i < 20; i++) f.system.getPresentationState();
    assert.equal(row.remainingMs, CONTAMINANT_DATA.compress.toolDurationMs - 16);
    f.position.x = row.radius + 1; f.position.y = 0; f.system.update(16);
    assert.equal(f.control.movementMultiplier, 1); assert.equal(f.system.getEnemyRestraintPose('target').pressure, false);
    f.system.update(CONTAMINANT_DATA.compress.toolDurationMs);
    for (let at = 0; at < 500; at += 16) f.system.update(16);
    assert.equal(f.system.getPresentationState().pressures.length, 0);
  } finally { f.system.destroy(); }
});

check('kindle presents the real destination, throw age and each actual pulse through its final charge', () => {
  const f = fixture('kindle');
  try {
    assert(f.system.useSlot(0));
    let row = f.system.getPresentationState().soundLures[0]!;
    assert.deepEqual([row.x, row.y, row.fromX, row.fromY], [48, 0, 0, 0]);
    assert.equal(f.sounds.length, 1); assert.equal(row.elapsedMs, 0);
    f.system.update(160); row = f.system.getPresentationState().soundLures[0]!;
    assert.equal(row.elapsedMs, 160); assert.equal(row.pulseElapsedMs, 160);
    f.system.update(row.pulseIntervalMs - 160); row = f.system.getPresentationState().soundLures[0]!;
    assert.equal(f.sounds.length, 2); assert.equal(row.pulseElapsedMs, 0);
    const count = f.sounds.length, frozen = JSON.stringify(f.system.getPresentationState());
    for (let i = 0; i < 20; i++) f.system.getPresentationState();
    assert.equal(JSON.stringify(f.system.getPresentationState()), frozen); assert.equal(f.sounds.length, count);
    f.system.update(row.remainingMs); assert.equal(f.system.getPresentationState().soundLures.length, 0);
    assert.equal(f.sounds.length, count, 'expiration does not add a terminal pulse');
  } finally { f.system.destroy(); }
});

check('siphon and muffle derive from real passive triggers and retain their full last use', () => {
  const siphon = fixture('siphon');
  try {
    eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 0, source: 'test' });
    assert.equal(siphon.system.getPresentationState().siphonRemainingMs, 0);
    eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 1, source: 'test' });
    assert.equal(siphon.system.getPresentationState().siphonRemainingMs, CONTAMINANT_DATA.siphon.toolDurationMs);
    siphon.system.update(650);
    assert.equal(siphon.system.getPresentationState().siphonRemainingMs, CONTAMINANT_DATA.siphon.toolDurationMs - 650);
    eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 1, source: 'test' });
    assert.equal(siphon.system.getPresentationState().siphonRemainingMs, CONTAMINANT_DATA.siphon.toolDurationMs - 650);
    siphon.system.reset(); assert.equal(siphon.system.getPresentationState().siphonRemainingMs, 0);
  } finally { siphon.system.destroy(); }
  const muffle = fixture('muffle');
  try {
    assert.equal(muffle.system.getPresentationState().muffleEpisodeActive, false);
    assert(muffle.system.notifyProximityAvoid()); assert(muffle.system.getPresentationState().muffleEpisodeActive);
    assert(muffle.system.notifyProximityAvoid()); assert.equal(inventoryStore.getItem(muffle.item.id), undefined);
    muffle.system.update(CONTAMINANT_DATA.muffle.toolDurationMs);
    assert.equal(muffle.system.getPresentationState().muffleEpisodeActive, false);
    assert.equal(muffle.system.notifyProximityAvoid(), false);
  } finally { muffle.system.destroy(); }
});

check('the renderer explicitly rejects unsupported carried content and uses whole-swing phase boundaries', () => {
  const f = createPresentationFrame(); assertStagePresentationSupported(f);
  f.player.weaponDefinitionId = 'crowbar_fine_standard'; assertStagePresentationSupported(f);
  f.player.weaponDefinitionId = 'future-unknown-weapon'; assert.throws(() => assertStagePresentationSupported(f));
  f.player.weaponDefinitionId = 'crowbar_plain';
  const tools = createToolPresentationFrame(); f.tools = tools; tools.loadoutTypes.push('expand');
  assert.throws(() => assertStagePresentationSupported(f)); tools.loadoutTypes[0] = 'stitch'; assertStagePresentationSupported(f);
  assert(supportsStageForm({ occupancy: 'floor', substrate: 'insect_remnant', coverage: 'infiltrate' } as never));
  assert(!supportsStageForm({ occupancy: 'floor', substrate: 'human_remnant', coverage: 'infiltrate' } as never));
  assert(!supportsStageForm({ occupancy: 'air', substrate: 'insect_remnant', coverage: 'infiltrate' } as never));
  const pose = f.player.attack;
  Object.assign(pose, { windupMs: 120, activeMs: 60, recoveryMs: 220 });
  for (const [phase, elapsed, expected] of [['windup', 60, .5], ['active', 120, 0], ['active', 150, .5],
    ['active', 180, 1], ['recovery', 180, 0], ['recovery', 290, .5], ['recovery', 400, 1]] as const) {
    pose.phase = phase; pose.elapsedMs = elapsed; near(stageWeaponPhaseProgress(pose), expected);
  }
  pose.phase = 'recovery'; pose.elapsedMs = 181; pose.contactRemainingMs = 10; pose.contactElapsedMs = 150;
  near(stageWeaponPhaseProgress(pose), .5);
});

check('ground effects follow actual support and current visibility, never terrain memory or a hidden target', () => {
  const height = (x: number, y: number) => x * .02 + y * .04;
  const isFloor = (x: number, y: number) => x < 110 && y < 120;
  let visible = true;
  const context = { visibilityAt: () => visible ? 1 : 0 } as unknown as RiftDevRuntimeContext;
  const world = { width: 256, height: 256, isFloor, groundHeightAt: height } as unknown as SpatialSliceWorld;
  const texture = new THREE.Texture(), effect = new StageEffects(context, world, texture);
  let textureDisposals = 0; texture.addEventListener('dispose', () => textureDisposals++);
  const f = createPresentationFrame(), tools = createToolPresentationFrame(); f.tools = tools;
  tools.seams.push({ id: 1, ax: 80, ay: 95, bx: 140, by: 125, remainingMs: 1000, durationMs: 1000, tension: 0, opacity: 1 });
  tools.pressures.push({ id: 2, x: 90, y: 90, radius: 40, remainingMs: 1000, durationMs: 1000, opacity: 1 });
  try {
    const before = JSON.stringify(f); effect.update(f); assert.equal(JSON.stringify(f), before);
    const points = effect.copyGroundPoints(); assert(points.length > 0); assert(Number(effect.snapshot().clippedUnsupported) > 0);
    for (let at = 0; at < points.length; at += 3) {
      assert(isFloor(points[at]!, points[at + 2]!));
      assert(points[at + 1]! >= height(points[at]!, points[at + 2]!) + .69);
    }
    points.fill(999); assert.notDeepEqual(effect.copyGroundPoints(), points);
    visible = false; effect.update(f); assert.equal(effect.copyGroundPoints().length, 0);
    visible = true; tools.seams.length = 0; tools.pressures.length = 0; effect.update(f); assert.equal(effect.copyGroundPoints().length, 0);
  } finally { effect.destroy(); assert.equal(textureDisposals, 0, 'borrowed visibility texture is not owned by effects'); texture.dispose(); }
});

check('revealed weapons and contaminants use different native pixels on the real floor, preserving pickup positions', () => {
  const height = (x: number, y: number) => x * .07 + y * .03, isFloor = (x: number) => x <= 104;
  const loot = new StageLoot(height, isFloor), f = createPresentationFrame();
  f.groundItems.push({ id: 'weapon', kind: 'weapon', definitionId: 'crowbar_fine_standard', quality: 'fine', position: { x: 100, y: 100 }, visibility: 1 },
    { id: 'stone', kind: 'contaminant', definitionId: 'compress', quality: 'good', position: { x: 100, y: 100 }, visibility: 1 });
  try {
    const before = JSON.stringify(f); loot.update(f, 0); assert.equal(JSON.stringify(f), before);
    const shapes: number[][] = [];
    loot.group.updateMatrixWorld(true);
    loot.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const points = object.geometry.getAttribute('position'); assert(points.count > 0);
      shapes.push(Array.from(points.array));
      for (let at = 0; at < points.count; at++) {
        const p = new THREE.Vector3().fromBufferAttribute(points, at).applyMatrix4(object.matrixWorld);
        assert(isFloor(p.x)); near(p.y, height(p.x, p.z) + .8);
      }
    });
    assert.equal(shapes.length, 2); assert.notDeepEqual(shapes[0], shapes[1]);
    const meshes = loot.group.children.map(root => root.children[0]); loot.update(f, 16);
    assert.deepEqual(loot.group.children.map(root => root.children[0]), meshes, 'stationary loot is not rebuilt per tick');
  } finally { disposeTree(loot.group); }
});

inventoryStore.setPersistence(null);
console.log(`${checks} Stage ability/identity/ground contract checks passed. Readability, 3D depth compositing and input feel require live QA.`);
