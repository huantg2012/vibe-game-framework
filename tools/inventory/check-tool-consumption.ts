/** Exercise production ToolSystem with a headless graphics sink and real inventory transactions. */
import assert from 'node:assert/strict';
import { ToolSystem } from '../../src/systems/tool-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
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
  const enemy = { getId: () => 'enemy', getPosition: () => ({ x: 12, y: 12 }), getState: () => 'patrol' };
  const system = new ToolSystem();
  system.create(scene as never, contaminantSystem.getSortieLoadout(), () => ({ x: 0, y: 0 }), () => [enemy] as never, {
    getCollectedNodes: () => [{ x: 8, y: 8 }],
    addKindling: () => events.push('kindling'),
    setEnemySpeedMultiplier: () => events.push('speed'),
    setEnemyPerceptionMultiplier: () => events.push('perception'),
    setEnemyDetectionFillRateMult: () => events.push('detection'),
    setHearingSuppressed: active => events.push(`hearing:${active}`),
    reduceChaosRate: () => events.push('chaos'),
  });
  return { system, slot, id: item.id, events, graphics: () => graphics };
}
for (const type of ['solidify', 'delay', 'erode', 'ruminate', 'retrograde', 'kindle', 'stitch', 'expand', 'compress', 'mirror', 'echo', 'resonate', 'overwrite', 'abyss', 'combust'] as ContaminantType[]) {
  const f = fixture(type);
  if (type === 'stitch' || type === 'resonate') {
    assert.equal(f.system.useSlot(f.slot), false); // Point A is visual-only, deliberately free.
    assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 2);
  }
  const graphics = f.graphics(); f.events.length = 0;
  let writes = 0;
  inventoryStore.setPersistence(() => { writes++; throw new Error('quota'); });
  assert.equal(f.system.useSlot(f.slot), false, type);
  assert.equal(writes, 1, `${type} reaches exactly one commit after eligibility`);
  assert.equal(f.graphics(), graphics, `${type} must not create its effect when commit fails`);
  assert.equal(f.events.length, 0, `${type} must not mutate gameplay on failure`);
  assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 2);
  checks++;
}
for (const type of ['stitch', 'resonate'] as ContaminantType[]) {
  const f = fixture(type, 1);
  assert.equal(f.system.useSlot(f.slot), false);
  inventoryStore.setPersistence(() => { throw new Error('quota'); });
  assert.equal(f.system.useSlot(f.slot), false);
  inventoryStore.setPersistence(() => f.events.push('persist'));
  f.events.length = 0;
  assert.equal(f.system.useSlot(f.slot), true, 'failed second point preserves point A for retry');
  assert.equal(f.events[0], 'persist'); assert.equal(inventoryStore.getItem(f.id), undefined);
  checks++;
}
for (const type of ['scatter', 'muffle', 'siphon'] as ContaminantType[]) {
  const f = fixture(type, 1);
  const trigger = () => {
    if (type === 'scatter') f.system.notifyEnemySuspicious('enemy');
    else if (type === 'muffle') return f.system.notifyProximityAvoid();
    else (f.system as unknown as { handleEnemyKilledForSiphon(id: string): void }).handleEnemyKilledForSiphon('enemy');
  };
  inventoryStore.setPersistence(() => { throw new Error('quota'); }); trigger();
  assert.equal(inventoryStore.getContaminants()[0]!.usesRemaining, 1);
  assert(f.events.every(event => event === 'hearing:false'), `${type}: no effect or counter decrement on failure`);
  f.events.length = 0; inventoryStore.setPersistence(() => f.events.push('persist')); trigger();
  assert.equal(f.events[0], 'persist'); assert.equal(inventoryStore.getItem(f.id), undefined);
  const count = f.events.length; trigger(); assert.equal(f.events.length, count, 'last charge cannot trigger twice');
  checks++;
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
inventoryStore.setPersistence(null);
console.log(`${checks} production tool consumption checks passed.`);
