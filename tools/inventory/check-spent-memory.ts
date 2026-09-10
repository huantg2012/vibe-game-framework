/** Last-use regression: a second pursuer cannot keep baking snapshots after the item is gone. */
import assert from 'node:assert/strict';
import { ToolSystem } from '../../src/systems/tool-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { AIState } from '../../src/types/game-types';
import type { EnemyView } from '../../src/types/ai-types';

inventoryStore.setPersistence(null);
contaminantSystem.reset();
const item = contaminantSystem.createUnowned('retrograde', 'common');
item.stage = 'tool';
item.usesRemaining = 1;
assert(inventoryStore.addContaminant(item).ok);
assert(inventoryStore.prepareTool(item.id, 2).ok);
assert(inventoryStore.beginRun('spent-memory-regression').ok);

const positions = [{ x: 10, y: 10 }, { x: 20, y: 10 }];
let firstVisible = true;
let captures = 0;
const enemies = positions.map((position, index) => ({
  getId: () => String(index), getPosition: () => position,
  getState: () => AIState.CHASE, getRole: () => 'infiltrator',
}));
const graphics: unknown = new Proxy({}, { get: () => () => graphics });
const tools = new ToolSystem();
tools.create({ add: { graphics: () => graphics }, time: { now: 0 } } as never,
  contaminantSystem.getSortieLoadout(), () => ({ x: 0, y: 0 }), () => enemies as unknown as EnemyView[], {
    isTargetAlive: () => true,
    isTargetVisible: position => position.x !== 10 || firstVisible,
    hasTargetLineOfSight: () => true,
    // Count capture requests, not fake pixel comparisons. The canvas copy has separate browser coverage.
    captureEnemyVisual: () => { captures++; return undefined; },
  });
try {
  for (let index = 0; index < 2; index++) {
    eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: String(index), alertLevel: 'chase' });
  }
  assert.equal(captures, 2, 'both visible pursuit episodes capture a candidate pose');
  firstVisible = false;
  tools.update(100);
  assert.equal(inventoryStore.getItem(item.id), undefined, 'first sight loss consumes the final instance');
  assert.deepEqual(tools.getActiveTimedEffects(), [{ type: 'retrograde', remainingMs: 6000 }]);
  const afterFinalUse = captures;
  for (let index = 0; index < 10; index++) tools.update(100);
  assert.equal(captures, afterFinalUse, 'other visible pursuer must stop baking after final use');
  assert.deepEqual(tools.getActiveTimedEffects(), [{ type: 'retrograde', remainingMs: 5000 }],
    'cleaning unused capture candidates must not cancel the paid final memory');
  eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: '1', alertLevel: 'chase' });
  tools.update(4999);
  assert.equal(captures, afterFinalUse, 'new alerts cannot restart capture without an item');
  assert.deepEqual(tools.getActiveTimedEffects(), [{ type: 'retrograde', remainingMs: 1 }]);
  tools.update(1);
  assert.deepEqual(tools.getActiveTimedEffects(), [], 'final memory expires after the whole six seconds');
  console.log('PASS spent memory: two pursuers, no post-exhaustion baking, complete six-second final trace');
} finally {
  tools.destroy();
  inventoryStore.setPersistence(null);
  contaminantSystem.reset();
}
