/** I16: execute production behaviors; do not infer motion from renderer/source strings. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { ENEMY_DATA } from '../../src/generated/enemy-data.ts';
import { SUBSTRATE_DATA, UTTERANCE_DATA } from '../../src/generated/contamination-lexicon-data.ts';
import {
  drawOne, drawSortie, floorMotionFor, supportsRuntimeForm, familyCapabilityFor, motionChoicesFor, INFILTRATOR_FORM,
  type ContaminationForm,
} from '../../src/generation/contamination-draw.ts';
import { generateRiftLayout } from '../../src/generation/rift-layout.ts';
import { rollPaintHostCount } from '../../src/generation/contamination-draw.ts';
import { AISystem } from '../../src/systems/ai/ai-system.ts';
import { updateBehavior } from '../../src/systems/ai/behaviors.ts';
import { stepFsm, transitionTo } from '../../src/systems/ai/state-machine.ts';
import type { AIContext } from '../../src/systems/ai/context.ts';
import type { Enemy } from '../../src/entities/enemy-factory.ts';
import type { EnemyAIState, Perception } from '../../src/types/ai-types.ts';
import { AIState } from '../../src/types/game-types.ts';
import { SeededRandom } from '../../src/utils/random.ts';

const fragments = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library', 'frag-residential'];
const occupancies = new Set<string>();
for (let seed = 1; seed <= 64; seed++) {
  for (const fragmentTypeId of fragments) {
    const draw = drawSortie(new SeededRandom(seed), {
      fragmentTypeId, paintCount: 4, hasWallEdges: true, hasCorridors: true,
    });
    assert.equal(draw.warnings.length, 0, `${fragmentTypeId}/${seed}: ${draw.warnings}`);
    assert.equal(draw.forms.filter(f => f.lexemes.sense === 'sense_hear').length, 1);
    assert.equal(draw.forms.filter(f => f.occupancy === 'paint').length, 4);
    for (const form of draw.forms) {
      assert(supportsRuntimeForm(form), JSON.stringify(form));
      occupancies.add(form.occupancy);
    }
  }
}
assert.deepEqual([...occupancies].sort(), ['floor', 'paint', 'volume']);
for (const coverage of ['infiltrate', 'rewrite', 'overwrite'] as const) {
  for (const substrate of ['doorframe', 'street_wreckage']) {
    const form = drawOne(new SeededRandom(1), { portfolio: 'jia', fragmentTypeId: 'frag-library', coverage, substrate });
    assert.equal(form, null, 'retired ground relics cannot be drawn in production');
  }
}
const insect = drawOne(new SeededRandom(9), {
  portfolio: 'jia', fragmentTypeId: 'frag-library', substrate: 'insect_remnant', coverage: 'infiltrate',
});
assert.equal(insect?.lexemes.motion, 'motion_patrol');
// I17 human is a new biological source row, never an alias replacing organic_remnant.
assert.equal(SUBSTRATE_DATA.human_remnant.displayToken, '人形残余');
assert.equal(SUBSTRATE_DATA.human_remnant.residualVerb, '走');
assert.equal(SUBSTRATE_DATA.human_remnant.enabledScope, 'sortie');
assert.deepEqual(SUBSTRATE_DATA.human_remnant.legalOccupancies, ['floor']);
assert.deepEqual(SUBSTRATE_DATA.human_remnant.legalContinuities, ['monolith']);
assert.equal(SUBSTRATE_DATA.organic_remnant.enabledScope, 'sortie');
assert.equal(INFILTRATOR_FORM.substrate, 'organic_remnant');
for (const coverage of ['infiltrate', 'rewrite', 'overwrite'] as const) {
  const human = drawOne(new SeededRandom(17), {
    portfolio: 'jia', fragmentTypeId: 'frag-library', substrate: 'human_remnant', coverage,
  });
  assert(human && supportsRuntimeForm(human));
  assert.equal(human.substrate, 'human_remnant');
  assert.equal(human.coverage, coverage);
  if (coverage === 'infiltrate') assert.equal(human.lexemes.motion, 'motion_patrol');
}
for (const recipe of Object.values(UTTERANCE_DATA)) {
  const form: ContaminationForm = { ...recipe, lexemes: {
    motion: recipe.motion, sense: recipe.sense, rhythm: recipe.rhythm, contact: recipe.contact,
  } };
  const capability = familyCapabilityFor(form.substrate, form.portfolio);
  const expected = SUBSTRATE_DATA[form.substrate]?.enabledScope === 'sortie' && !!capability && (['motion', 'sense', 'rhythm', 'contact'] as const).every((slot) => capability[slot].includes(form.lexemes[slot])) && motionChoicesFor(form.substrate, form.portfolio, form.coverage).includes(form.lexemes.motion);
  assert.equal(supportsRuntimeForm(form), expected, recipe.id);
}

// Exercise placed forms, not only the pre-placement draw pool. Includes F01 seeds 1 and 3.
const humanCoverages = new Set<string>();
let humanAndInsectTogether = false;
for (let seed = 1; seed <= 32; seed++) {
  const layout = generateRiftLayout(seed);
  const forms = layout.contaminationDraw.forms;
  for (const form of forms) if (form.substrate === 'human_remnant') humanCoverages.add(form.coverage);
  if (forms.some(form => form.substrate === 'human_remnant') &&
      forms.some(form => form.substrate === 'insect_remnant')) humanAndInsectTogether = true;
  assert(forms.every(supportsRuntimeForm));
  assert.equal(forms.filter(f => f.lexemes.sense === 'sense_hear').length, 1);
  assert(forms.filter(f => f.lexemes.sense === 'sense_hear').every(f => f.occupancy === 'floor' || f.occupancy === 'wall'));
  assert.equal(layout.enemySpawns.filter(e => e.type === 'rewriter').length, forms.some(f => f.occupancy === 'wall' && f.lexemes.sense === 'sense_hear') ? 0 : 1);
  const floorCount = forms.filter(f => f.occupancy === 'floor').length;
  assert(floorCount >= 3 && floorCount <= 4);
  assert.equal(forms.filter(f => f.occupancy === 'wall' || f.occupancy === 'volume').length, 1);
  assert.equal(forms.filter(f => f.occupancy === 'paint').length,
    rollPaintHostCount(layout.seed, layout.contaminationAge));
}

assert.deepEqual([...humanCoverages].sort(), ['infiltrate', 'overwrite', 'rewrite'],
  'production draws all three human coverage tiers');
assert(humanAndInsectTogether, 'distinct human and insect bases can coexist on a real layout');

function fixture(form: ContaminationForm): { enemy: Enemy; ctx: AIContext } {
  // Only engine-independent fields used by the real behavior/FSM are needed here.
  const ai = {
    state: AIState.PATROL, position: { x: 100, y: 100 }, velocity: { x: 9, y: 9 },
    facingAngle: 0, facing4: 'right', scanPhaseMs: 0, scanBaseAngle: 0, scanIndex: 0,
    suspicionTimerMs: 0, suspiciousTurnHoldMs: 0, searchTimerMs: 0,
    investigatePos: { x: 150, y: 150 }, lastSeenPlayerPos: { x: 150, y: 150 },
    lastSeenPlayerVel: { x: 0, y: 0 }, losGraceMs: 0,
    pathRequestPending: true, pathPoints: [{ x: 300, y: 300 }], pathLength: 1, pathCursor: 0,
    patrolWaypoints: [{ x: 100, y: 100 }], patrolIndex: 0,
    patrolMode: 'static', patrolDir: 1, currentPatrolLeg: null,
    searchPoints: [{ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 100 }],
    searchPointCount: 0, searchIndex: 0, searchHoldMs: 0,
    externalSpeedMult: 3, movementDirLocked: true, lockedDir: { x: 1, y: 1 },
    engaged: false, detection: 0, pendingDamage: false, pendingDamagePos: { x: 110, y: 100 },
    pendingNoiseLevel: null, pendingNoisePos: { x: 130, y: 100 },
    escalationSuppressed: false, detectionFillRateMult: 1, alertEpisodeActive: false,
  } as EnemyAIState;
  const enemy = {
    ai, getForm: () => form,
    spawnData: { patrol: { mode: 'static', waypoints: [] } },
    config: {
      profile: ENEMY_DATA.infiltrator,
      hearing: { posJitter: 0 },
      speeds: { [AIState.PATROL]: 40 },
    },
    setVelocity(x: number, y: number) { ai.velocity.x = x; ai.velocity.y = y; },
  } as unknown as Enemy;
  const ctx = {
    playerPos: { x: 110, y: 100 }, playerVel: { x: 0, y: 0 }, dtMs: 16,
    enemies: [enemy], emitAlert() {}, emitLost() {}, cue() {},
    requestState(target: Enemy, next: AIState) { transitionTo(target, next, ctx); },
  } as unknown as AIContext;
  return { enemy, ctx };
}

// Inventory persistence may reject muffle consumption. Failed charges must leave
// the ordinary hearing discovery intact, just like the sleeping-body entry point.
for (const consumed of [false, true]) {
  const { enemy, ctx } = fixture(INFILTRATOR_FORM);
  ctx.hearingSuppressed = true;
  ctx.onHearingAvoided = () => consumed;
  stepFsm(enemy, { visible: false, hearingHit: true, hearingRate: 0, zone: 'none', distance: 10 } as Perception, 100, ctx);
  assert.equal(enemy.ai.state, consumed ? AIState.PATROL : AIState.SUSPICIOUS, 'muffle cannot swallow discovery before a charge commits');
}

for (const substrate of ['doorframe', 'street_wreckage', 'stalk_clump']) {
  // Stale/malicious patrol lexeme cannot make an anchored base translate.
  const form = { ...INFILTRATOR_FORM, substrate, lexemes: {
    ...INFILTRATOR_FORM.lexemes, motion: substrate === 'stalk_clump' ? 'motion_turn' : 'motion_patrol',
  } };
  for (const state of Object.values(AIState)) {
    const { enemy, ctx } = fixture(form);
    enemy.ai.state = state;
    for (let frame = 0; frame < 300; frame++) {
      updateBehavior(enemy, ctx);
      enemy.ai.position.x += enemy.ai.velocity.x * ctx.dtMs / 1000;
      enemy.ai.position.y += enemy.ai.velocity.y * ctx.dtMs / 1000;
      assert.deepEqual(enemy.ai.position, { x: 100, y: 100 }, `${substrate}/${state}`);
      assert.equal(enemy.ai.pathRequestPending, false);
      assert.equal(enemy.ai.pathPoints, null);
    }
  }
  const { enemy, ctx } = fixture(form);
  enemy.ai.state = AIState.CHASE;
  updateBehavior(enemy, ctx);
  assert.equal(enemy.ai.engaged, true, 'nearby seen player remains attackable');
  (ctx.playerPos as { x: number }).x = 100 + GAME_CONSTANTS.AI.STANDOFF_DISTANCE + 1;
  updateBehavior(enemy, ctx);
  assert.equal(enemy.ai.engaged, false, 'out-of-range player does not trigger remote combat');
  enemy.ai.losGraceMs = 100;
  (ctx.playerPos as { x: number }).x = 110;
  updateBehavior(enemy, ctx);
  assert.equal(enemy.ai.engaged, false, 'lost sight cancels stationary engagement');
  enemy.ai.losGraceMs = 0;
  enemy.ai.targetingDecoy = true;
  ctx.decoyPos = { x: 100, y: 150 };
  updateBehavior(enemy, ctx);
  assert.equal(enemy.ai.engaged, false, 'mirror target cannot grant real-player attack permission');
  assert(enemy.ai.facingAngle > 0, 'stationary enemy faces the sensed mirror');
  enemy.ai.targetingDecoy = false;
  ctx.decoyPos = null;
  enemy.ai.state = AIState.PATROL;
  enemy.ai.pendingNoiseLevel = 'alert';
  stepFsm(enemy, { visible: false, hearingHit: false, hearingRate: 0, zone: 'none', distance: 10 } as Perception, 100, ctx);
  assert.equal(enemy.ai.state, AIState.ALERT, 'noise still escalates through shared FSM');
  updateBehavior(enemy, ctx);
  assert.deepEqual(enemy.ai.velocity, { x: 0, y: 0 });
  enemy.ai.state = AIState.PATROL;
  enemy.ai.pendingDamage = true;
  stepFsm(enemy, { visible: false, hearingHit: false, hearingRate: 0, zone: 'none', distance: 10 } as Perception, 100, ctx);
  assert.equal(enemy.ai.state, AIState.CHASE, 'damage still escalates through shared FSM');
  updateBehavior(enemy, ctx);
  assert.deepEqual(enemy.ai.velocity, { x: 0, y: 0 });
}
// Run the actual public tool knockback path; no browser engine needed for Body.reset's boundary.
for (const substrate of ['doorframe', 'street_wreckage', 'organic_remnant']) {
  const { enemy } = fixture({ ...INFILTRATOR_FORM, substrate });
  let resets = 0;
  const body = { reset() { resets++; } };
  (enemy as unknown as { getSprite(): unknown }).getSprite = () => ({ body });
  const ai = new AISystem();
  (ai as unknown as { enemies: Enemy[] }).enemies.push(enemy);
  ai.knockbackEnemy('test', 30, 20);
  assert.equal(resets, 0, 'missing enemy is a no-op');
  (enemy as unknown as { id: string }).id = 'test';
  ai.knockbackEnemy('test', 30, 20);
  const anchored = substrate !== 'organic_remnant';
  assert.equal(resets, anchored ? 0 : 1, substrate);
  assert.deepEqual(enemy.ai.position, anchored ? { x: 100, y: 100 } : { x: 130, y: 120 });
}
const turning = fixture({ ...INFILTRATOR_FORM, coverage: 'rewrite', lexemes: { ...INFILTRATOR_FORM.lexemes, motion: 'motion_turn' } });
updateBehavior(turning.enemy, turning.ctx);
assert.notEqual(turning.enemy.ai.facingAngle, 0, 'turn-face rotates perception heading at rest');
const patrol = fixture(INFILTRATOR_FORM);
patrol.enemy.ai.patrolWaypoints[0] = { x: 200, y: 100 };
patrol.enemy.ai.pathPoints = null;
updateBehavior(patrol.enemy, patrol.ctx);
assert(Math.hypot(patrol.enemy.ai.velocity.x, patrol.enemy.ai.velocity.y) > 0, 'supported patrol still moves');
assert.equal(floorMotionFor(INFILTRATOR_FORM), 'motion_patrol');
console.log('check:runtime-behavior ok (320 draws, 32 layouts + human coverage/coexistence, all five AI states + noise/damage/combat/decoy/knockback/turn/patrol)');
