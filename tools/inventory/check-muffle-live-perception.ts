/** Real perception/FSM + ToolSystem + inventory; no synthetic ENEMY_ALERT events. */
import assert from 'node:assert/strict';
import { AISystem } from '../../src/systems/ai/ai-system';
import { ToolSystem } from '../../src/systems/tool-system';
import { createEnemyTypeConfig, type Enemy } from '../../src/entities/enemy-factory';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { AIState, type EnemyRole, type Vector2 } from '../../src/types/game-types';

function fixture(role: EnemyRole = 'rewriter', uses = 3) {
  inventoryStore.setPersistence(null);
  contaminantSystem.reset();
  const item = contaminantSystem.createUnowned('muffle', 'fine');
  Object.assign(item, { stage: 'tool', usesRemaining: uses });
  assert(inventoryStore.addContaminant(item).ok);
  assert(inventoryStore.prepareTool(item.id, 2).ok);
  assert(inventoryStore.beginRun('muffle-perception-review').ok);
  const grid = { cols: 40, rows: 40, tileSize: 8, version: 0, isOpaque: () => false };
  const playerPos = { x: 8, y: 80 }; // 72px behind the enemy, outside its visual cone.
  const enemy = {
    id: 'hear', config: createEnemyTypeConfig(role), getForm: () => INFILTRATOR_FORM,
    getId: () => 'hear', getPosition: () => ({ x: 80, y: 80 }),
    isTargetingLure: () => false, isTargetingDecoy: () => false,
    ai: { state: AIState.PATROL, position: { x: 80, y: 80 }, velocity: { x: 0, y: 0 },
      facingAngle: 0, perceptionRangeMult: 1, perceptionAccumMs: 0, targetingDecoy: false,
      detection: 0, detectionFillRateMult: 1, pendingDamage: false,
      pendingDamagePos: { x: 0, y: 0 }, pendingNoiseLevel: null, pendingNoisePos: { x: 0, y: 0 },
      escalationSuppressed: false, searchPoints: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
      investigatePos: null, losGraceMs: 0, lastSeenPlayerPos: null, lastSeenPlayerVel: null },
    spawnData: { patrol: { waypoints: [], mode: 'static' } },
  } as unknown as Enemy;
  const context = {
    playerPos, playerVel: { x: 1, y: 0 }, playerIsMoving: true, decoyPos: null,
    hearingRangeMult: 1, hearingSuppressed: false, occluders: grid,
    emitAlert() {}, emitLost() {}, cue() {}, onHearingAvoided: () => tools.notifyProximityAvoid(),
    pathfinder: { findNearestWalkable(x: number, y: number, out: Vector2) { out.x = x; out.y = y; return true; } },
  };
  const ai = new AISystem();
  Object.assign(ai, { enemies: [enemy], context, playerPos, playerIsMoving: true, occluders: grid });
  const internals = ai as unknown as { runPerceptionTick(enemy: Enemy, deltaMs: number): void };
  const graphics: unknown = new Proxy({}, { get: () => () => graphics });
  const tools = new ToolSystem();
  tools.create({ add: { graphics: () => graphics }, time: { now: 0, delayedCall() {} } } as never,
    contaminantSystem.getSortieLoadout(), () => playerPos, () => [enemy],
    { setHearingSuppressed: active => ai.setHearingSuppressed(active) });
  tools.update(1);
  const tick = (duration = 100) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 100) {
      internals.runPerceptionTick(enemy, 100);
      tools.update(100);
    }
  };
  return { enemy, playerPos, context, ai, tools, item, tick, close: () => tools.destroy() };
}

const failures: string[] = [];
function check(name: string, test: () => void) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error)}`); }
  finally { inventoryStore.setPersistence(null); }
}

for (const role of ['infiltrator', 'rewriter'] as const) {
  check(`${role}: continuous real hearing costs once and cannot accumulate discovery`, () => {
    const f = fixture(role);
    try {
      f.tick(4000);
      assert.equal(f.tools.getSlotUses(2), 2);
      assert.equal(f.enemy.ai.state, AIState.PATROL);
      assert.equal(f.enemy.ai.detection, 0, 'swallowed hearing must not secretly charge detection');
    } finally { f.close(); }
  });
}
check('last use covers its full encounter; after a quiet gap hearing works again', () => {
  const f = fixture('rewriter', 1);
  try {
    f.tick(4000);
    assert.equal(f.tools.getSlotUses(2), 0);
    assert.equal(inventoryStore.getItem(f.item.id), undefined);
    assert.equal(f.enemy.ai.state, AIState.PATROL);
    f.playerPos.x = 1000; f.tick(2000);
    assert.equal(f.context.hearingSuppressed, false);
    f.playerPos.x = 8; f.tick(1000);
    assert.equal(f.enemy.ai.state, AIState.ALERT);
  } finally { f.close(); }
});
check('visible player is not silenced even while the hearing encounter is active', () => {
  const f = fixture();
  try {
    f.tick(300); f.playerPos.x = 110; f.tick(2000);
    assert.equal(f.enemy.ai.state, AIState.CHASE);
    assert.equal(f.tools.getSlotUses(2), 2);
  } finally { f.close(); }
});
check('accepted damage still proves the player and starts a chase', () => {
  const f = fixture();
  try {
    f.tick(300); f.ai.reportDamage('hear', f.playerPos); f.tick();
    assert.equal(f.enemy.ai.state, AIState.CHASE);
    assert.equal(f.tools.getSlotUses(2), 2);
  } finally { f.close(); }
});
for (const level of ['suspicious', 'alert'] as const) {
  check(`reported ${level} noise retains priority over passive suppression`, () => {
    const f = fixture();
    try {
      f.tick(300); f.ai.reportNoise(f.playerPos, 100, level); f.tick();
      assert.equal(f.enemy.ai.state, level === 'alert' ? AIState.ALERT : AIState.SUSPICIOUS);
      assert.equal(f.tools.getSlotUses(2), 2);
    } finally { f.close(); }
  });
}
check('failed inventory persistence cannot silence a real hearing discovery for free', () => {
  const f = fixture();
  try {
    inventoryStore.setPersistence(() => { throw new Error('intentional disk full'); });
    f.tick(1000);
    assert.equal(f.tools.getSlotUses(2), 3);
    assert.equal(f.enemy.ai.state, AIState.ALERT);
  } finally { f.close(); }
});
assert.deepEqual(failures, [], `${failures.length} live perception regression(s) failed`);
