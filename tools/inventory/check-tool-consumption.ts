/** Exercise production ToolSystem with a headless graphics sink and real inventory transactions. */
import assert from 'node:assert/strict';
import Phaser from 'phaser';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
// Supply the graphics-only math called by successful ruminate VFX in the headless adapter.
Object.assign(Phaser.Math, { Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)) });
import { ToolSystem } from '../../src/systems/tool-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { AISystem } from '../../src/systems/ai/ai-system';
import type { ContaminantType } from '../../src/types/game-types';

let checks = 0;
function fixture(type: ContaminantType, uses = 2) {
  inventoryStore.setPersistence(null);
  contaminantSystem.reset();
  const item = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity);
  item.stage = 'tool'; item.usesRemaining = uses;
  inventoryStore.addContaminant(item);
  const slot = CONTAMINANT_DATA[type].toolType === 'passive' ? 2 : 0;
  assert.equal(inventoryStore.prepareTool(item.id, slot).ok, true);
  inventoryStore.beginRun(`run-${type}`);
  const events: string[] = [];
  let graphics = 0;
  const g: unknown = new Proxy({}, { get: () => (..._args: unknown[]) => g });
  const scene = { add: { graphics() { graphics++; events.push('visual'); return g; } }, time: { now: 0, delayedCall() {} } };
  const enemy = { getRole: () => 'infiltrator', getId: () => 'enemy', getPosition: () => ({ x: 12, y: 12 }), getState: () => 'patrol' };
  const system = new ToolSystem();
  system.create(scene as never, contaminantSystem.getSortieLoadout(), () => ({ x: 0, y: 0 }), () => [enemy] as never, {
    getPhaseDestination: () => ({ x: 48, y: 0 }),
    movePlayerTo: () => events.push('phase'),
    getCollectedNodes: () => [{ x: 8, y: 8 }],
    addKindling: () => events.push('kindling'),
    setEnemySpeedMultiplier: () => events.push('speed'),
    setEnemyPerceptionMultiplier: () => events.push('perception'),
    setEnemyDetectionFillRateMult: () => events.push('detection'),
    setHearingSuppressed: active => events.push(`hearing:${active}`),
    reduceChaosRate: () => events.push('chaos'),
    getSoundLureDestination: () => ({ x: 48, y: 0 }),
    reportSoundLure: () => events.push('sound-lure'),
    setVisualDecoy: () => events.push('decoy'),
    getStitchPlacement: () => ({ pointA: { x: 32, y: -32 }, pointB: { x: 32, y: 32 } }),
    getRevealSnapshot: () => ({ enemyPositions: [{ x: 12, y: 12 }], nodePositions: [] }),
    showAbyssReveal: () => events.push('reveal'),
    delayEnvironmentHazard: () => { events.push('delay-host'); return true; },
    getEnvironmentTargets: () => [{ id: 'host', position: { x: 12, y: 0 }, hazardReleased: type !== 'delay',
      canDelayNextHazard: type === 'delay', delayRemainingMs: 0,
      canSuppressReleasedHazard: true, suppressionRemainingMs: 0 }] as never,
    suppressEnvironmentHazard: () => { events.push('suppress-host'); return true; },
  });
  return { system, slot, id: item.id, events, graphics: () => graphics };
}
for (const type of ['solidify', 'delay', 'kindle', 'stitch', 'expand', 'compress', 'mirror', 'abyss', 'combust'] as ContaminantType[]) {
  const f = fixture(type);
  const graphics = f.graphics(); f.events.length = 0;
  let writes = 0;
  inventoryStore.setPersistence(() => { writes++; throw new Error('quota'); });
  assert.equal(f.system.useSlot(f.slot), false, type);
  assert.equal(writes, 1, `${type} reaches exactly one commit after eligibility`);
  assert.equal(f.graphics(), graphics, `${type} must not create its effect when commit fails`);
  assert.equal(f.events.length, 0, `${type} must not mutate gameplay on failure`);
  assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 2);
  f.system.destroy(); checks++;
}
{
  const f = fixture('stitch', 1);
  inventoryStore.setPersistence(() => { throw new Error('quota'); });
  assert.equal(f.system.useSlot(f.slot), false);
  inventoryStore.setPersistence(() => f.events.push('persist')); f.events.length = 0;
  assert.equal(f.system.useSlot(f.slot), true, 'one-key seam retries after failed commit');
  assert.equal(f.events[0], 'persist'); assert.equal(inventoryStore.getItem(f.id), undefined);
  f.system.destroy(); checks++;
}
for (const type of ['scatter', 'muffle', 'siphon'] as ContaminantType[]) {
  const f = fixture(type, 1);
  const trigger = () => {
    if (type === 'scatter') f.system.notifyEnemySuspicious('enemy');
    else if (type === 'muffle') return f.system.notifyProximityAvoid();
    else eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 1, source: 'test' });
  };
  inventoryStore.setPersistence(() => { throw new Error('quota'); }); trigger();
  assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 1);
  assert(f.events.every(event => event === 'hearing:false'), `${type}: no effect or counter decrement on failure`);
  f.events.length = 0; inventoryStore.setPersistence(() => f.events.push('persist')); trigger();
  assert.equal(f.events[0], 'persist'); assert.equal(inventoryStore.getItem(f.id), undefined);
  const count = f.events.length; trigger(); assert.equal(f.events.length, count, 'same episode cannot spend twice');
  if (type === 'muffle') { f.system.update(CONTAMINANT_DATA.muffle.toolDurationMs); assert.equal(trigger(), false, 'final episode ends after silence'); }
  f.system.destroy(); checks++;
}
{
  const f = fixture('solidify');
  (f.system as unknown as { getEnemies(): never[] }).getEnemies = () => [];
  let writes = 0; inventoryStore.setPersistence(() => { writes++; });
  assert.equal(f.system.useSlot(0), false); assert.equal(writes, 0); checks++;
}
{
  const ai = new AISystem();
  (ai as unknown as { context: { hearingSuppressed: boolean } }).context = { hearingSuppressed: true };
  ai.setHearingAvoidedListener(() => false); assert.equal(ai.trySuppressHearingDiscovery('enemy'), false);
  ai.setHearingAvoidedListener(() => true); assert.equal(ai.trySuppressHearingDiscovery('enemy'), true); checks++;
}
{
  const f = fixture('expand', 1);
  (f.system as unknown as { getPhaseDestination(): null }).getPhaseDestination = () => null;
  let writes = 0; inventoryStore.setPersistence(() => { writes++; });
  assert.equal(f.system.useSlot(0), false); assert.equal(writes, 0);
  assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 1); f.system.destroy(); checks++;
}
{
  const f = fixture('muffle', 2);
  assert.equal(f.system.notifyProximityAvoid(), true);
  for (let i = 0; i < 40; i++) { f.system.update(100); assert.equal(f.system.notifyProximityAvoid(), true); }
  assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 1, 'continuous encounter costs once');
  f.system.update(CONTAMINANT_DATA.muffle.toolDurationMs);
  assert.equal(f.system.notifyProximityAvoid(), true);
  assert.equal(inventoryStore.getItem(f.id), undefined, 'next independent episode spends last use');
  assert.equal(f.system.notifyProximityAvoid(), true, 'last use continues suppressing'); checks++;
}
{
  // Exercise real ToolSystem timers: one zone expires without releasing a later zone,
  // and damage-broken freeze must not restore speed through a surviving slow field.
  const f = fixture('compress', 2);
  const control = new EnemyControlState();
  const live = f.system as unknown as {
    setEnemyControl: (id: string, source: string, effect: Parameters<EnemyControlState['set']>[1]) => void;
    clearEnemyControl: (id: string, source: string) => void;
    hasEnemyControl: (id: string, source: string) => boolean;
    applySolidify: (commit: () => boolean) => boolean;
  };
  live.setEnemyControl = (_id, source, effect) => control.set(source, effect);
  live.clearEnemyControl = (_id, source) => { control.clear(source); };
  live.hasEnemyControl = (_id, source) => control.has(source);
  assert.equal(f.system.useSlot(0), true); f.system.update(1000);
  assert.equal(f.system.useSlot(0), true); f.system.update(100);
  assert.equal(control.movementMultiplier, 0.25, 'overlapping zones keep separate sources');
  assert.equal(live.applySolidify(() => true), true);
  assert.equal(control.attackSuppressed, true); assert.equal(control.movementMultiplier, 0);
  control.breakOnDamage(); f.system.update(100);
  assert.equal(control.attackSuppressed, false); assert.equal(control.movementMultiplier, 0.25);
  f.system.update(4901);
  assert.equal(control.movementMultiplier, 0.5, 'first zone expiry preserves second zone');
  f.system.destroy(); assert.equal(control.movementMultiplier, 1, 'shutdown releases own remaining sources'); checks++;
}
inventoryStore.setPersistence(null);
console.log(`${checks} production tool consumption checks passed.`);
