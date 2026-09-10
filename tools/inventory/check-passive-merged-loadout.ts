/** Old in-flight active slots may migrate into the same family as the passive slot. */
import assert from 'node:assert/strict';
import { ToolSystem } from '../../src/systems/tool-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { AIState } from '../../src/types/game-types';
for (const type of ['siphon', 'muffle', 'scatter', 'retrograde'] as const) {
  inventoryStore.setPersistence(null); contaminantSystem.reset();
  const items = [2, 3].map((uses, i) => ({ id: `merged-${i}`, kind: 'contaminant', location: { kind: 'carried' },
    contaminant: { id: `merged-${i}`, type, rarity: CONTAMINANT_DATA[type].rarity, quality: 'ordinary', stage: 'tool', impactCharges: 3, usesRemaining: uses } }));
  assert(inventoryStore.loadState({ version: 2, items, starterGranted: true, firstWeaponDiscovered: false,
    equipment: { weaponId: null, toolIds: ['merged-0', null, 'merged-1'], defenseIds: [null,null,null] },
    run: { id: 'merged-run', status: 'active', carriedOutIds: ['merged-0','merged-1'], revealedNodes: {}, destroyedIds: [] } } as never));
  const graphics: unknown = new Proxy({}, { get: () => () => graphics });
  let visible = true;
  const enemy = { getId: () => 'e', getPosition: () => ({ x: 20, y: 20 }), getState: () => AIState.CHASE, getRole: () => 'infiltrator' };
  const tools = new ToolSystem();
  tools.create({ add: { graphics: () => graphics }, time: { now: 0 } } as never,
    contaminantSystem.getSortieLoadout(), () => ({ x: 0, y: 0 }), () => [enemy] as never,
    { isTargetVisible: () => visible, hasTargetLineOfSight: () => true });
  for (let i = 0; i < 5; i++) {
    if (type === 'siphon') {
      eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 1, source: 'merged' });
      assert.equal(tools.getPollutionResistanceBonus(), 20); tools.update(8000);
    } else if (type === 'muffle') {
      assert(tools.notifyProximityAvoid()); tools.update(1501);
    } else if (type === 'scatter') {
      tools.notifyEnemySuspicious('e'); eventBus.emit(GameEvent.ENEMY_LOST_PLAYER, { enemyId: 'e' });
    } else {
      visible = true; eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: 'e', alertLevel: 'chase' });
      tools.update(1); visible = false; tools.update(1);
      eventBus.emit(GameEvent.ENEMY_LOST_PLAYER, { enemyId: 'e' }); tools.update(6500);
    }
    assert.equal(inventoryStore.getContaminants().reduce((sum, item) => sum + item.usesRemaining, 0), 4 - i, `${type} event ${i + 1} consumes one owned instance`);
  }
  assert.equal(inventoryStore.getEquipment().toolIds.filter(Boolean).length, 0);
  tools.destroy(); console.log(`PASS ${type}: both migrated slot instances consumed fully, one event each`);
}
