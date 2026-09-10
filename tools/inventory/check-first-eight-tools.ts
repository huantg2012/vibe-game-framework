/** I20 B2: execute actual tools, inventory commits, AI senses and FSM. */
import assert from 'node:assert/strict';
import { ToolSystem } from '../../src/systems/tool-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { AISystem } from '../../src/systems/ai/ai-system';
import { createEnemyTypeConfig, type Enemy } from '../../src/entities/enemy-factory';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import { AIState, type ContaminantType } from '../../src/types/game-types';
import { GameEvent } from '../../src/types/events';
import { eventBus } from '../../src/core/event-bus';

function fixture(type: ContaminantType, uses = 2) {
  inventoryStore.setPersistence(null); contaminantSystem.reset();
  const item = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity);
  item.stage = 'tool'; item.usesRemaining = uses;
  assert(inventoryStore.addContaminant(item).ok);
  const slot = CONTAMINANT_DATA[type].toolType === 'passive' ? 2 : 0;
  assert(inventoryStore.prepareTool(item.id, slot).ok);
  assert(inventoryStore.beginRun(`b2-${type}`).ok);
  let visible = true, legalLanding = true, targetingLure = false;
  const position = { x: 24, y: 0 };
  const origin = { x: 0, y: 0 };
  const writes: string[] = [];
  const decoys = new Map<string, { x: number; y: number }>();
  const noises: { position: { x: number; y: number }; radius: number }[] = [];
  const controls: string[] = [];
  const hosts = [
    { id: 'hidden', position: { x: -20, y: 0 }, hazardReleased: true, canSuppressHazard: true, suppressionRemainingMs: 0 },
    { id: 'wall', position: { x: 25, y: 0 }, hazardReleased: true, canSuppressHazard: true, suppressionRemainingMs: 0 },
    { id: 'gather', position: { x: 30, y: 0 }, hazardReleased: false, canSuppressHazard: true, suppressionRemainingMs: 0 },
    { id: 'released', position: { x: 50, y: 0 }, hazardReleased: true, canSuppressHazard: true, suppressionRemainingMs: 0 },
    { id: 'far', position: { x: 500, y: 0 }, hazardReleased: true, canSuppressHazard: true, suppressionRemainingMs: 0 },
  ];
  const enemy = { getId: () => 'enemy', getRole: () => 'infiltrator', getPosition: () => position,
    getState: () => AIState.CHASE, isTargetingDecoy: () => false, isTargetingLure: () => targetingLure };
  const graphics: unknown = new Proxy({}, { get: () => () => graphics });
  const system = new ToolSystem();
  system.create({ add: { graphics: () => graphics }, time: { now: 0, delayedCall() {} } } as never,
    contaminantSystem.getSortieLoadout(), () => origin, () => [enemy] as never, {
      isTargetVisible: p => visible && p.x >= 0,
      hasTargetLineOfSight: (_from, to) => to.x !== 25,
      getSoundLureDestination: distance => legalLanding ? { x: origin.x + distance, y: origin.y } : null,
      reportSoundLure: (p, radius) => noises.push({ position: { ...p }, radius }),
      setVisualDecoy: (source, p) => { if (p) decoys.set(source, { ...p }); else decoys.delete(source); },
      getEnvironmentTargets: () => hosts as never,
      suppressEnvironmentHazard: (id, source) => { controls.push(`${id}:${source}`); hosts.find(h => h.id === id)!.suppressionRemainingMs = 5000; return true; },
      clearEnvironmentControl: id => controls.push(`clear:${id}`),
      setEnemyDetectionFillRateMult: (id, mult) => controls.push(`fill:${id}:${mult}`),
    });
  inventoryStore.setPersistence(() => writes.push('saved'));
  return { system, slot, item, position, origin, writes, decoys, noises, controls, hosts,
    setVisible(value: boolean) { visible = value; }, setLanding(value: boolean) { legalLanding = value; },
    setLure(value: boolean) { targetingLure = value; } };
}

// One new chase -> one genuine loss of sight -> one stale six-second memory, including final use.
{
  const f = fixture('retrograde', 1);
  assert.equal(f.system.useSlot(f.slot), false, 'passive does not consume on manual input');
  f.setLure(true);
  eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: 'enemy', alertLevel: 'chase' });
  f.setVisible(false); f.system.update(16); assert.equal(f.writes.length, 0, 'false-body chase costs no tracking use');
  f.setLure(false); f.setVisible(true);
  eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: 'enemy', alertLevel: 'chase' });
  f.system.update(16); assert.equal(f.writes.length, 0);
  f.position.x = 40; f.system.update(16);
  f.setVisible(false); f.position.x = 90;
  inventoryStore.setPersistence(() => { throw new Error('disk full'); });
  f.system.update(16); assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 1);
  inventoryStore.setPersistence(() => f.writes.push('saved'));
  f.system.update(16);
  assert.equal(f.writes.length, 1); assert.equal(inventoryStore.getItem(f.item.id), undefined);
  const live = f.system as unknown as { retrogradeMarks: { position: { x: number; y: number }; remainingMs: number }[] };
  assert.deepEqual(live.retrogradeMarks[0]!.position, { x: 40, y: 0 });
  assert.equal(live.retrogradeMarks[0]!.remainingMs, 6000);
  f.position.x = 400; f.system.update(1000);
  assert.deepEqual(live.retrogradeMarks[0]!.position, { x: 40, y: 0 }, 'hidden enemy motion cannot move memory');
  f.setVisible(true); f.system.update(16); f.setVisible(false); f.system.update(16);
  assert.equal(f.writes.length, 1, 'repeated sight loss in the same chase is free');
  f.system.update(5000); assert.equal(live.retrogradeMarks.length, 0);
  f.system.destroy();
}
// Independent suspicion episodes, no old global cooldown and final use persists until calm.
{
  const f = fixture('scatter', 2);
  f.setLure(true); f.system.notifyEnemySuspicious('enemy'); assert.equal(f.writes.length, 0, 'lure suspicion is not player discovery');
  f.setLure(false);
  f.system.notifyEnemySuspicious('a'); f.system.notifyEnemySuspicious('a');
  f.system.notifyEnemySuspicious('b');
  assert.equal(f.writes.length, 2);
  assert(f.controls.includes('fill:a:0.7') && f.controls.includes('fill:b:0.7'));
  assert(!f.controls.includes('fill:b:1'));
  eventBus.emit(GameEvent.ENEMY_LOST_PLAYER, { enemyId: 'b' });
  assert(f.controls.includes('fill:b:1')); f.system.destroy();
}
// Throw legality precedes consumption; periodic sounds retain their physical landing position.
{
  const f = fixture('kindle', 1);
  f.setLanding(false); assert.equal(f.system.useSlot(0), false); assert.equal(f.writes.length, 0);
  f.setLanding(true); assert(f.system.useSlot(0));
  assert.equal(f.writes.length, 1); assert.equal(f.noises.length, 1);
  assert.deepEqual(f.noises[0], { position: { x: 96, y: 0 }, radius: 96 });
  f.origin.x = 300; f.system.update(1000);
  assert.deepEqual(f.noises[1], f.noises[0]);
  f.system.update(5000); const sounds = f.noises.length; f.system.update(1000);
  assert.equal(f.noises.length, sounds); assert.equal(f.system.getActiveTimedEffects().length, 0);
  f.system.destroy();
}
// Two independent mirrors: old expiry cannot clear the surviving new source.
{
  const f = fixture('mirror', 2);
  f.position.x = 400;
  assert(f.system.useSlot(0)); f.system.update(4000);
  f.origin.x = 60; assert(f.system.useSlot(0)); assert.equal(f.decoys.size, 2);
  f.system.update(4001); assert.equal(f.decoys.size, 1);
  assert.deepEqual([...f.decoys.values()][0], { x: 60, y: 0 });
  f.system.destroy(); assert.equal(f.decoys.size, 0);
}
// Active gathering is eligible too; skip blocked sources and select the next legal one.
{
  const f = fixture('combust', 3);
  f.setVisible(false); assert.equal(f.system.useSlot(0), false); assert.equal(f.writes.length, 0);
  f.setVisible(true); assert(f.system.useSlot(0));
  assert.equal(f.controls.length, 1); assert(f.controls[0]!.startsWith('gather:'));
  assert.equal(f.writes.length, 1);
  assert(f.system.useSlot(0), 'suppressed near source must not hide a legal farther source');
  assert.equal(f.writes.length, 2); assert(f.controls[1]!.startsWith('released:'));
  assert.equal(f.system.useSlot(0), false, 'already suppressed sources are not charged again');
  assert.equal(f.writes.length, 2);
  f.system.destroy(); assert(f.controls.includes('clear:released') && f.controls.includes('clear:gather'));
}

const grid = { cols: 40, rows: 40, tileSize: 8, version: 0, isOpaque: () => false };
function senseFixture() {
  const enemy = {
    id: 'sense', config: createEnemyTypeConfig('infiltrator'), getForm: () => INFILTRATOR_FORM,
    ai: { state: AIState.PATROL, position: { x: 80, y: 80 }, velocity: { x: 0, y: 0 },
      facingAngle: 0, perceptionRangeMult: 1, perceptionAccumMs: 0, targetingDecoy: false,
      detection: 0, detectionFillRateMult: 1, pendingDamage: false,
      pendingNoiseLevel: null, pendingNoisePos: { x: 0, y: 0 }, escalationSuppressed: false,
      searchPoints: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
      investigatePos: null, losGraceMs: 0, lastSeenPlayerPos: null, lastSeenPlayerVel: null },
    spawnData: { patrol: { waypoints: [], mode: 'static' } },
  } as unknown as Enemy;
  const playerPos = { x: 8, y: 80 }; // Behind the enemy, independently of the lure.
  const context = { playerPos, playerVel: { x: 0, y: 0 }, playerIsMoving: false, decoyPos: null,
    hearingRangeMult: 1, occluders: grid, emitAlert() {}, emitLost() {}, cue() {},
    pathfinder: { findNearestWalkable(x: number, y: number, out: { x: number; y: number }) { out.x = x; out.y = y; return true; } } };
  const ai = new AISystem();
  Object.assign(ai, { enemies: [enemy], context, playerPos, playerIsMoving: false, occluders: grid });
  const internals = ai as unknown as { visibleDecoyFor(enemy: Enemy): { x: number; y: number } | null;
    runPerceptionTick(enemy: Enemy, delta: number): void; };
  const tick = () => { context.decoyPos = internals.visibleDecoyFor(enemy) as null; internals.runPerceptionTick(enemy, 1000); };
  return { ai, enemy, context, tick, internals };
}
// Vision alone finds a decoy without a sighting of the actual player; sources cannot erase each other.
{
  const f = senseFixture();
  f.ai.setVisualDecoy('front', { x: 110, y: 80 }); f.ai.setVisualDecoy('rear', { x: 60, y: 80 });
  assert.deepEqual(f.internals.visibleDecoyFor(f.enemy), { x: 110, y: 80 });
  f.enemy.ai.detection = 1; f.tick();
  assert.equal(f.enemy.ai.state, AIState.CHASE); assert(f.enemy.ai.targetingDecoy);
  assert(f.enemy.ai.investigatingLure);
  assert.deepEqual(f.enemy.ai.lastSeenPlayerPos, { x: 110, y: 80 });
  f.ai.setVisualDecoy('rear', null); assert.deepEqual(f.internals.visibleDecoyFor(f.enemy), { x: 110, y: 80 });
  let realChaseAlerts = 0;
  f.context.emitAlert = () => { if (!f.enemy.ai.investigatingLure) realChaseAlerts++; };
  f.ai.setVisualDecoy('front', null); f.context.playerPos.x = 110; f.tick();
  assert.equal(realChaseAlerts, 1, 'new real target gets an event even while state remains chase');
  assert.equal(f.enemy.ai.investigatingLure, false);
  f.ai.setVisualDecoy('front', { x: 110, y: 80 });
  f.enemy.ai.targetingDecoy = false;
  assert.equal(f.internals.visibleDecoyFor(f.enemy), null, 'confirmed real-player chase ignores visual distraction');
  f.enemy.ai.state = AIState.PATROL;
  Object.assign(f.ai, { occluders: { ...grid, isOpaque: (col: number) => col === 12 } });
  assert.equal(f.internals.visibleDecoyFor(f.enemy), null, 'wall blocks mirror sight');
}
// Sound targets the shell, respects hearing and walls, and cannot rewrite a chase.
{
  const f = senseFixture();
  f.ai.reportSoundLure({ x: 150, y: 80 }, 96);
  assert.deepEqual(f.enemy.ai.pendingNoisePos, { x: 150, y: 80 });
  f.tick(); assert(Math.hypot(f.enemy.ai.investigatePos!.x - 150, f.enemy.ai.investigatePos!.y - 80) <= f.enemy.config.hearing.posJitter, 'heard estimate jitters around shell, not the player');
  assert.equal(f.enemy.ai.state, AIState.SUSPICIOUS);
  assert.equal(f.enemy.ai.investigatingLure, true, 'sound-source identity survives FSM transition');
  f.enemy.ai.pendingNoiseLevel = null;
  Object.assign(f.ai, { occluders: { ...grid, isOpaque: (col: number) => col === 12 } });
  f.ai.reportSoundLure({ x: 150, y: 80 }, 96);
  assert.equal(f.enemy.ai.pendingNoiseLevel, null, 'wall attenuates this out-of-range sound');
  f.enemy.ai.state = AIState.CHASE;
  f.ai.reportSoundLure({ x: 85, y: 80 }, 96);
  assert.equal(f.enemy.ai.pendingNoiseLevel, null, 'chase keeps its confirmed target');
}

inventoryStore.setPersistence(null);
console.log('PASS first eight abilities: stale memory / suspicion episodes / real sound / independent visual lures / targeted hazard suppression');
