/** Regression: ended combat must not expose a permanently frozen strike/recovery. */
import assert from 'node:assert/strict';
import { CombatSystem } from '../../src/systems/combat-system.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';

const combat = new CombatSystem();
// Engine-free fixture supplies only the owned clock state; calls are real production API.
const owned = combat as unknown as { enemies: Map<string, unknown> };
const state = {
  attackPhase: 'windup', attackTimerMs: 175, attackAngle: 1.25,
  cooldownRemainingMs: 0, strikeFxFrames: 0,
};
owned.enemies.set('sample', state);
assert.deepEqual(combat.getEnemyAttackVisualState('sample'), {
  phase: 'windup', progress: .5, facingAngle: 1.25,
});
state.attackPhase = 'cooldown';
state.cooldownRemainingMs = GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_COOLDOWN_MS;
assert.equal(combat.getEnemyAttackVisualState('sample').phase, 'strike');
state.cooldownRemainingMs -= 80;
assert.deepEqual(combat.getEnemyAttackVisualState('sample'), {
  phase: 'recover', progress: 0, facingAngle: 1.25,
});
combat.setEnabled(false);
assert.deepEqual(combat.getEnemyAttackVisualState('sample'), { phase: 'idle', progress: 0 });
combat.setEnabled(true);
state.cooldownRemainingMs = GAME_CONSTANTS.COMBAT.ENEMY_ATTACK_COOLDOWN_MS - 320;
assert.equal(combat.getEnemyAttackVisualState('sample').phase, 'idle');
assert.deepEqual(combat.getEnemyAttackVisualState('removed'), { phase: 'idle', progress: 0 });
console.log('check:combat-visual-state ok (authoritative phases, committed heading, disabled combat)');
