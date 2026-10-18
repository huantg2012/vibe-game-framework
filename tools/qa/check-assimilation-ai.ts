import assert from 'node:assert/strict';
import { AISystem } from '../../src/systems/ai/ai-system';
import { createEnemyTypeConfig, type Enemy } from '../../src/entities/enemy-factory';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import { AIState } from '../../src/types/game-types';
import type { Perception } from '../../src/types/ai-types';
import { assimilationHostilityMultiplier } from '../../src/systems/assimilation-system';

// Use the production perception entry against a finite open grid; only the
// Phaser actor/physics shell is absent. No substitute sensing algorithm.
const ai = new AISystem();
const config = createEnemyTypeConfig('infiltrator', INFILTRATOR_FORM);
const state = { state: AIState.PATROL, position: { x: 320, y: 320 }, facingAngle: 0,
  perceptionRangeMult: 1, detectionFillRateMult: .7, pendingDamage: false,
  pendingDamagePos: { x: 0, y: 0 }, pendingNoiseLevel: null as 'alert' | 'suspicious' | null,
  pendingNoisePos: { x: 0, y: 0 }, perceptionAccumMs: 0 };
const enemy = { id: 'recognition-target', ai: state, config, activityHearingAccumMs: 0,
  getForm: () => ({ ...INFILTRATOR_FORM, lexemes: { ...INFILTRATOR_FORM.lexemes, rhythm: 'rhythm_sleep' } }),
  getActivityVisualState: () => ({ phase: 'rest' }), tickActivity() {} } as unknown as Enemy;
const internal = ai as unknown as { playerPos: { x: number; y: number }; playerIsMoving: boolean;
  perception: Perception; enemies: Enemy[]; perceive(target: Enemy, distance: number): void;
  updateActivity(target: Enemy, dtMs: number): void };
Object.assign(ai, { occluders: { cols: 100, rows: 100, tileSize: 32, version: 0, isOpaque: () => false },
  context: { hearingRangeMult: 1, hearingSuppressed: false, playerActionSilenced: false } });
internal.enemies.push(enemy);
internal.playerIsMoving = true;
function inspect(distance: number): Perception {
  Object.assign(internal.playerPos, { x: state.position.x + distance, y: state.position.y });
  internal.perceive(enemy, distance); return { ...internal.perception };
}

ai.setPlayerRecognitionRangeMultiplier(1);
assert(inspect(config.sight.rangeCore * .75).visible);
ai.setPlayerRecognitionRangeMultiplier(assimilationHostilityMultiplier(100));
assert(!inspect(config.sight.rangeCore * .75).visible, 'High assimilation narrows passive visual recognition');
assert(inspect(config.sight.rangeCore * .4 * .99).visible, 'The reduced near range still recognizes a player');
assert.equal(state.detectionFillRateMult, .7, 'Tool confidence modulation is independent');

state.facingAngle = Math.PI;
ai.setPlayerRecognitionRangeMultiplier(1);
const hearingDistance = config.profile.hearingRange * .75;
const heard = inspect(hearingDistance);
assert(heard.hearingHit || heard.hearingRate > 0);
ai.setPlayerRecognitionRangeMultiplier(.4);
const quiet = inspect(hearingDistance);
assert(!quiet.hearingHit && quiet.hearingRate === 0, 'The same single range factor covers passive hearing');
state.state = AIState.CHASE;
state.facingAngle = 0;
assert(inspect(config.sight.rangeCore * .75).visible, 'An established chase ignores the assimilation reduction');
state.state = AIState.ALERT;
assert(!inspect(config.sight.rangeCore * .75).visible, 'Recognition resumes its normal adaptation after chase ends');

ai.reportNoise(internal.playerPos, config.sight.rangeCore, 'alert');
assert.equal(state.pendingNoiseLevel, 'alert', 'Explicit action noise keeps its original discovery radius');
ai.reportDamage(enemy.id, internal.playerPos);
assert(state.pendingDamage, 'Self-defense remains authoritative');
state.pendingDamage = false; state.pendingNoiseLevel = null; state.state = AIState.PATROL;
inspect(hearingDistance);
internal.updateActivity(enemy, 200);
assert.equal(state.pendingNoiseLevel, null, 'Sleeping bodies also respect the passive hearing range');
ai.setPlayerRecognitionRangeMultiplier(1);
internal.updateActivity(enemy, 200);
assert.equal(state.pendingNoiseLevel, 'suspicious');
assert.throws(() => ai.setPlayerRecognitionRangeMultiplier(NaN));
assert.throws(() => ai.setPlayerRecognitionRangeMultiplier(1.1));
console.log('PASS assimilation AI: real perception, passive visual/hearing range, sleeping wake, unchanged chase/noise/damage and tool fill');
