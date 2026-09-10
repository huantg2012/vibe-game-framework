/** Production AI controls + Combat clocks, with graphics/physics replaced by adapters. */
import assert from 'node:assert/strict';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { AISystem } from '../../src/systems/ai/ai-system';
import { CombatSystem } from '../../src/systems/combat-system';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { stepFsm } from '../../src/systems/ai/state-machine';
import { createEnemyTypeConfig, type Enemy } from '../../src/entities/enemy-factory';
import { AIState } from '../../src/types/game-types';
import type { AIContext } from '../../src/systems/ai/context';
import type { Perception } from '../../src/types/ai-types';

const FREEZE = { movementMultiplier: 0, perceptionMultiplier: 0, suppressAttack: true, breakOnDamage: true };
const STUN = { movementMultiplier: 0, suppressAttack: true };
const grid = { cols: 20, rows: 20, tileSize: 8, version: 0, isOpaque: () => false };
function fixture() {
  const controls = new EnemyControlState();
  const position = { x: 109, y: 80 };
  let committed = false;
  const velocity = { x: 25, y: 0 };
  const view = {
    id: 'enemy', controls, ai: { externalSpeedMult: 1, perceptionRangeMult: 1 },
    getId: () => 'enemy', getPosition: () => position, getFacingAngle: () => Math.PI,
    isEngaged: () => true, isAttackAvailable: () => true,
    setAttackCommitted(value: boolean) { committed = value; },
    setVelocity(x: number, y: number) { velocity.x = x; velocity.y = y; },
  };
  const ai = new AISystem();
  Object.assign(ai, { enemies: [view] });
  const combat = new CombatSystem();
  Object.assign(combat, {
    player: { getPosition: () => ({ x: 80, y: 80 }), getFacingAngle: () => 0,
      setSpeedModifier() {}, clearSpeedModifier() {}, setWeaponVisual() {}, setWeaponAttackPose() {} },
    ai, occluders: grid, hooks: { onNoise() {} },
    spawnFx() {}, spawnImpact() {}, drawVisuals() {}, stepFx() {},
  });
  combat.noteRosterChanged();
  combat.configureWeapon('crowbar_plain', 7);
  return { ai, combat, controls, view, position, velocity, isCommitted: () => committed };
}
function advance(combat: CombatSystem, duration: number, step = 10): void {
  while (duration > 0) { const dt = Math.min(step, duration); combat.update(dt); duration -= dt; }
}
function startWindup(combat: CombatSystem): void {
  advance(combat, GAME_CONSTANTS.COMBAT.ENEMY_FIRST_ATTACK_DELAY_MS);
  assert.equal(combat.getEnemyAttackVisualState('enemy').phase, 'windup');
}

// Source expiry order cannot erase another zone, freeze or stun; legacy setters are isolated.
for (const order of [['ice', 'stun'], ['stun', 'ice']]) {
  const { ai, view, controls, velocity } = fixture();
  ai.setEnemyControl('enemy', 'zone:a', { movementMultiplier: .6, perceptionMultiplier: .5 });
  ai.setEnemyControl('enemy', 'zone:b', { movementMultiplier: .5 });
  assert.equal(view.ai.externalSpeedMult, .3);
  ai.setEnemyControl('enemy', 'ice', FREEZE);
  ai.setEnemyControl('enemy', 'stun', STUN);
  assert.deepEqual(velocity, { x: 0, y: 0 }, 'immobilization stops already-issued velocity immediately');
  const revision = controls.attackInterruptRevision;
  ai.setEnemyControl('enemy', 'ice', FREEZE);
  assert.equal(controls.attackInterruptRevision, revision, 'refreshing a source does not produce fake interruptions');
  ai.setEnemySpeedMultiplier('enemy', .7);
  ai.setEnemyPerceptionMultiplier('enemy', .7);
  ai.setEnemySpeedMultiplier('enemy', 1);
  ai.setEnemyPerceptionMultiplier('enemy', 1);
  assert.equal(controls.movementMultiplier, 0);
  ai.clearEnemyControl('enemy', order[0]!);
  assert.equal(controls.attackSuppressed, true);
  assert.equal(controls.movementMultiplier, 0);
  ai.clearEnemyControl('enemy', order[1]!);
  assert.equal(controls.attackSuppressed, false);
  assert.equal(view.ai.externalSpeedMult, .3);
  assert.equal(view.ai.perceptionRangeMult, .5);
  ai.clearEnemyControl('enemy', 'zone:a');
  assert.equal(view.ai.externalSpeedMult, .5);
  assert.equal(view.ai.perceptionRangeMult, 1);
  ai.clearEnemyControl('enemy', 'zone:b');
  assert.equal(view.ai.externalSpeedMult, 1);
}

// Freeze at almost-complete windup cancels its token, never resolves a hidden strike.
for (const step of [8, 16, 33, 100]) {
  const { ai, combat, isCommitted } = fixture();
  startWindup(combat);
  advance(combat, GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_WINDUP_MS - 10);
  assert(isCommitted());
  const health = combat.getHealth();
  ai.setEnemyControl('enemy', 'ice', FREEZE);
  advance(combat, 1000, step);
  assert.equal(combat.getHealth(), health);
  assert.equal(combat.getStats().attackTokensInUse, 0);
  assert.equal(isCommitted(), false);
  assert.equal(combat.getEnemyAttackVisualState('enemy').phase, 'idle');
  ai.clearEnemyControl('enemy', 'ice');
  startWindup(combat);
  assert.equal(combat.getEnemyAttackVisualState('enemy').progress, 0);
  advance(combat, GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_WINDUP_MS - 1);
  assert.equal(combat.getHealth(), health, 'new telegraph cannot inherit frozen elapsed time');
  combat.update(1);
  assert(combat.getHealth() < health, 'attack resumes after the complete fresh telegraph');
}

// Damage breaks only damage-sensitive controls, including within one frame.
{
  const { ai, combat, controls } = fixture();
  startWindup(combat);
  advance(combat, GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_WINDUP_MS - 10);
  ai.setEnemyControl('enemy', 'ice', FREEZE);
  ai.setEnemyControl('enemy', 'stun', STUN);
  for (const amount of [0, -1, NaN, Infinity]) {
    assert.equal(combat.applyToolDamage('enemy', amount), false);
    assert(ai.hasEnemyControl('enemy', 'ice'));
  }
  assert.equal(combat.applyToolDamage('absent', 1), false);
  assert.equal(combat.applyToolDamage('enemy', 1), true);
  assert.equal(ai.hasEnemyControl('enemy', 'ice'), false);
  assert.equal(ai.hasEnemyControl('enemy', 'stun'), true);
  assert(controls.attackSuppressed);
  ai.clearEnemyControl('enemy', 'stun');
  const health = combat.getHealth();
  combat.update(100);
  assert.equal(combat.getHealth(), health, 'same-frame application/release still interrupts old windup');
  assert.equal(combat.getStats().attackTokensInUse, 0);
  startWindup(combat);
  assert.equal(combat.getEnemyAttackVisualState('enemy').progress, 0);
}

// Whiffs and rejected durability saves do not break ice; the last accepted use does.
for (const mode of ['whiff', 'save-rejected', 'last-use'] as const) {
  const { ai, combat, position } = fixture();
  ai.setEnemyControl('enemy', 'ice', FREEZE);
  if (mode === 'whiff') position.x = 150;
  let attempts = 0;
  Object.assign(combat, { hooks: { onNoise() {}, consumeWeaponUse() {
    attempts++;
    if (mode === 'save-rejected') return false;
    combat.configureWeapon(null);
    return true;
  } } });
  combat.requestPlayerAttack();
  const damage = combat.getSwingSnapshot().damage;
  advance(combat, 220);
  assert.equal(ai.hasEnemyControl('enemy', 'ice'), mode !== 'last-use');
  assert.equal(combat.getEnemyHealth('enemy'), 75 - (mode === 'last-use' ? damage : 0));
  assert.equal(attempts, mode === 'whiff' ? 0 : 1);
}

// Actual FSM: filling suspicion cannot bypass suppressed escalation straight into chase.
{
  const enemy = {
    ai: { state: AIState.SUSPICIOUS, detection: 1, detectionFillRateMult: 1,
      escalationSuppressed: true, pendingDamage: false, pendingNoiseLevel: null,
      position: { x: 109, y: 80 }, velocity: { x: 0, y: 0 } },
    config: createEnemyTypeConfig('infiltrator'),
  } as unknown as Enemy;
  const context = { playerPos: { x: 80, y: 80 }, playerVel: { x: 0, y: 0 },
    decoyPos: null, emitAlert() {}, emitLost() {}, cue() {} } as unknown as AIContext;
  const perception = { visible: true, hearingHit: false, hearingRate: 0, distance: 29,
    zone: 'core', hearingStill: false } as Perception;
  stepFsm(enemy, perception, 100, context);
  assert.equal(enemy.ai.state, AIState.SUSPICIOUS);
  enemy.ai.escalationSuppressed = false;
  stepFsm(enemy, perception, 100, context);
  assert.equal(enemy.ai.state, AIState.CHASE, 'ordinary certainty still acquires the player');
}

console.log('PASS enemy controls: independent sources, full restarted telegraphs, real-damage release and durability gates');
