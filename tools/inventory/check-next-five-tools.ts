import assert from 'node:assert/strict';
import Phaser from 'phaser';
Object.assign(Phaser.Math, { Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)) });
import { ToolSystem } from '../../src/systems/tool-system';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { EnvironmentHazardControl } from '../../src/systems/environment-hazard-control';
import { collectToolRevealSnapshot, crossesToolLine, findStitchPlacement } from '../../src/systems/tool-targeting';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { AIState, type ContaminantType, type Vector2 } from '../../src/types/game-types';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';

const grid = { cols: 20, rows: 20, tileSize: 32, isWalkable: (x: number, y: number) => x > 0 && y > 0 && x < 19 && y < 19 };
const origin = { x: 176, y: 176 };
const line = findStitchPlacement(origin, { x: 1, y: 0 }, 32, 64, grid, () => true)!;
assert.deepEqual(line, { pointA: { x: 208, y: 208 }, pointB: { x: 208, y: 144 } });
assert(crossesToolLine({ x: 180, y: 176 }, { x: 250, y: 176 }, line));
assert(!crossesToolLine({ x: 208, y: 170 }, { x: 208, y: 190 }, line));
assert(!crossesToolLine({ x: 180, y: 225 }, { x: 250, y: 225 }, line));
assert.equal(findStitchPlacement(origin, { x: 1, y: 0 }, 32, 64, grid, (_a, b) => b.y !== 176), null, 'occluded middle invalidates whole seam');
assert.equal(findStitchPlacement(origin, { x: 1, y: 0 }, 32, 64, { ...grid, isWalkable: (x, y) => !(x === 6 && y === 5) }, () => true), null);
const snapshot = collectToolRevealSnapshot(origin, 192, { ...grid, isWalkable: (x, y) => grid.isWalkable(x, y) && x !== 7 },
  [{ x: 192, y: 192 }, { x: 256, y: 176 }, { x: 500, y: 176 }], [{ x: 176, y: 220 }]);
assert.deepEqual(snapshot.enemyPositions, [{ x: 192, y: 192 }]); assert.equal(snapshot.nodePositions.length, 1);
console.log('PASS legal one-key seam, swept crossing, middle obstruction, bounded floor-topology snapshot');

function fixture(type: ContaminantType, uses = 1) {
  inventoryStore.setPersistence(null); contaminantSystem.reset();
  const c = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity);
  c.stage = 'tool'; c.usesRemaining = uses;
  assert(inventoryStore.addContaminant(c).ok);
  const slot = CONTAMINANT_DATA[type].toolType === 'passive' ? 2 : 0;
  assert(inventoryStore.prepareTool(c.id, slot).ok); assert(inventoryStore.beginRun(`c-${type}`).ok);
  const position = { x: 180, y: 176 }, control = new EnemyControlState(), environment = new EnvironmentHazardControl();
  let valid = true, released = false, writes = 0;
  const captures: { enemies: readonly Vector2[]; nodes: readonly Vector2[]; duration: number }[] = [];
  const enemy = { getId: () => 'enemy', getPosition: () => position, getRole: () => 'infiltrator', getState: () => AIState.CHASE };
  const g: unknown = new Proxy({}, { get: () => () => g });
  const tools = new ToolSystem();
  tools.create({ add: { graphics: () => g }, time: { now: 0 } } as never, contaminantSystem.getSortieLoadout(), () => origin, () => [enemy] as never, {
    isTargetAlive: () => true, isTargetVisible: () => valid, hasTargetLineOfSight: () => valid,
    setEnemyControl: (_id, source, effect) => control.set(source, effect), clearEnemyControl: (_id, source) => control.clear(source),
    getStitchPlacement: () => valid ? line : null,
    getEnvironmentTargets: () => [{ id: 'host', position: { x: 220, y: 176 }, hazardReleased: released,
      canDelayNextHazard: !released, delayRemainingMs: environment.delayRemainingMs }] as never,
    delayEnvironmentHazard: (_id, source, ms) => { environment.delay(source, ms); return true; },
    clearEnvironmentControl: (_id, source) => environment.clear(source),
    getRevealSnapshot: () => valid ? { enemyPositions: [position], nodePositions: [{ x: 176, y: 220 }] } : { enemyPositions: [], nodePositions: [] },
    showAbyssReveal: (enemies, nodes, duration) => captures.push({ enemies, nodes, duration }),
  });
  inventoryStore.setPersistence(() => { writes++; });
  return { tools, c, position, control, environment, captures, slot, setValid(v: boolean) { valid = v; },
    setReleased(v: boolean) { released = v; }, writes: () => writes };
}
{
  const f = fixture('delay', 2);
  f.setValid(false); assert.equal(f.tools.useSlot(0), false); f.setValid(true);
  f.setReleased(true); assert.equal(f.tools.useSlot(0), false); assert.equal(f.writes(), 0);
  f.setReleased(false); assert(f.tools.useSlot(0)); assert.equal(f.environment.delayRemainingMs, 5000);
  assert.equal(f.tools.useSlot(0), false); assert.equal(f.writes(), 1);
  f.environment.suppress('external', 9000); f.tools.destroy();
  assert.equal(f.environment.delayRemainingMs, 0); assert.equal(f.environment.suppressionRemainingMs, 9000);
}
{
  const f = fixture('siphon');
  eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 0, source: 'test' });
  eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: -1, source: 'test' }); assert.equal(f.writes(), 0);
  eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 5, source: 'test' });
  assert.equal(f.writes(), 1); assert.equal(f.tools.getPollutionResistanceBonus(), 20);
  eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 5, source: 'test' }); assert.equal(f.writes(), 1);
  f.tools.update(7999); assert.equal(f.tools.getPollutionResistanceBonus(), 20);
  f.tools.update(1); assert.equal(f.tools.getPollutionResistanceBonus(), 0); f.tools.destroy();
}
{
  const f = fixture('stitch'); f.setValid(false); assert.equal(f.tools.useSlot(0), false); assert.equal(f.writes(), 0);
  f.setValid(true); assert(f.tools.useSlot(0)); assert.equal(f.writes(), 1);
  f.control.set('external', { movementMultiplier: .5 });
  f.position.x = 250; f.tools.update(16);
  assert.equal(f.control.movementMultiplier, 0); assert.equal(f.control.perceptionMultiplier, 1); assert.equal(f.control.attackSuppressed, false);
  f.tools.update(1499); assert.equal(f.control.movementMultiplier, 0);
  f.tools.update(1); assert.equal(f.control.movementMultiplier, .5);
  f.position.x = 180; f.tools.update(16); assert.equal(f.control.movementMultiplier, .5, 'same enemy does not retrigger this seam');
  f.tools.destroy(); assert.equal(f.control.movementMultiplier, .5);
}
{
  const f = fixture('compress'); assert(f.tools.useSlot(0)); f.tools.update(16);
  assert.equal(f.control.movementMultiplier, .5); assert.equal(f.control.perceptionMultiplier, 1); assert.equal(f.control.attackSuppressed, false);
  f.control.set('external', { movementMultiplier: .8 });
  f.position.x = 300; f.tools.update(16); assert.equal(f.control.movementMultiplier, .8);
  f.position.x = 180; f.tools.update(16); assert.equal(f.control.movementMultiplier, .4);
  f.tools.update(6000); assert.equal(f.control.movementMultiplier, .8); f.tools.destroy();
}
{
  const f = fixture('abyss'); f.setValid(false); assert.equal(f.tools.useSlot(0), false); assert.equal(f.writes(), 0);
  f.setValid(true); assert(f.tools.useSlot(0)); assert.equal(f.captures[0]?.duration, 6000);
  f.position.x = 350; assert.equal(f.captures[0]?.enemies[0]?.x, 180, 'snapshot detached from live positions');
  assert.equal(f.tools.useSlot(0), false); assert.equal(f.writes(), 1);
  f.tools.update(5999); assert(f.tools.getActiveTimedEffects().some(e => e.type === 'abyss'));
  f.tools.destroy(); assert.equal(f.captures.at(-1)?.duration, 0, 'cleanup clears reveal');
}
for (const type of ['delay', 'stitch', 'compress', 'abyss'] as const) {
  const f = fixture(type); inventoryStore.setPersistence(() => { throw Error('quota'); });
  assert.equal(f.tools.useSlot(0), false); assert.equal(f.tools.getActiveTimedEffects().length, 0);
  assert.equal(f.environment.delayRemainingMs, 0); assert.equal(f.captures.length, 0); f.tools.destroy();
}
inventoryStore.setPersistence(null);
console.log('PASS five real ToolSystem/inventory contracts: legal targets, final charge, failed save, source isolation, crossing and resistance lifetime');
