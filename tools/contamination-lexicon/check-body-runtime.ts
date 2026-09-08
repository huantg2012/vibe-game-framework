/** Execute Combat gates for six production bodies plus the retained gym-only street profile. */
import assert from 'node:assert/strict';
import { CombatSystem } from '../../src/systems/combat-system.ts';
import { createEnemyTypeConfig } from '../../src/entities/enemy-factory.ts';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw.ts';
import { BODY_PROFILE_DATA } from '../../src/generated/contamination-body-data.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { AIState } from '../../src/types/game-types.ts';

function encounter(substrate: string, startAngle = 0, startRange = 30) {
  const combat = new CombatSystem();
  const origin = { x: 100, y: 100 };
  const player = { x: 100 + Math.cos(startAngle) * startRange, y: 100 + Math.sin(startAngle) * startRange };
  const form = { ...INFILTRATOR_FORM, substrate };
  let committed = false;
  const view = {
    getId: () => 'sample', getForm: () => form, getPosition: () => origin, getFacingAngle: () => 0,
    isEngaged: () => true, isAttackAvailable: () => true,
    setAttackCommitted(value: boolean) { committed = value; },
  };
  const state = { id: 'sample', view, health: 75, alive: true,
    attackPhase: 'idle', attackTimerMs: 0, attackAngle: 0,
    cooldownRemainingMs: 0, engagedSinceMs: 500, strikeFxFrames: 0 };
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let x1 = 0; let y1 = 0;
  const graphics = { lineStyle() {}, beginPath() {}, strokePath() {},
    moveTo(x: number, y: number) { x1 = x; y1 = y; },
    lineTo(x: number, y: number) { lines.push({ x1, y1, x2: x, y2: y }); },
  };
  Object.assign(combat, { enemies: new Map([['sample', state]]), enabled: true, health: 100,
    player: { getPosition: () => player }, hooks: {}, graphics,
    occluders: { cols: 20, rows: 20, tileSize: 32, version: 0, isOpaque: () => false },
  });
  const runtime = combat as unknown as { updateEnemies(ms: number): void; health: number;
    drawTelegraph(sample: typeof state, alpha: number): void };
  const tick = (ms: number) => {
    while (ms > 0) { const step = Math.min(50, ms); runtime.updateEnemies(step); ms -= step; }
  };
  return { combat, runtime, state, player, origin, form, tick, lines, isCommitted: () => committed };
}

for (const [substrate, profile] of Object.entries(BODY_PROFILE_DATA)) {
  const e = encounter(substrate);
  e.tick(1);
  assert.equal(e.state.attackPhase, 'windup', `${substrate} can reach the 30px standoff`);
  e.tick(profile.windupMs / 2);
  assert.equal(e.runtime.health, 100, `${substrate} does not hit midway through its warning`);
  assert(Math.abs(e.combat.getEnemyAttackVisualState('sample').progress - .5) < .00001);
  e.tick(profile.windupMs / 2 - 1);
  assert.equal(e.runtime.health, 100);
  e.tick(1);
  assert.equal(e.runtime.health, 100 - GAME_CONSTANTS.COMBAT.ENEMY_DAMAGE_BASE);
  assert.equal(e.state.attackPhase, 'cooldown');
  assert.equal(e.state.cooldownRemainingMs, profile.cooldownMs);
  assert.equal(e.isCommitted(), false);
  assert.equal(e.combat.getEnemyAttackVisualState('sample').phase, 'strike');
  e.tick(80);
  assert.deepEqual(e.combat.getEnemyAttackVisualState('sample'), { phase: 'recover', progress: 0, facingAngle: 0 });
  e.tick(240);
  assert.equal(e.combat.getEnemyAttackVisualState('sample').phase, 'idle');
  e.tick(profile.cooldownMs - 321);
  assert.equal(e.state.attackPhase, 'cooldown');
  e.tick(1);
  assert.equal(e.state.attackPhase, 'windup', `${substrate} can recommit only after its full cooldown`);

  // Move to just inside/outside the committed angle while staying in range.
  for (const offset of [-.01, .01]) {
    const angle = (profile.halfAngleDeg + offset) * Math.PI / 180;
    const sample = encounter(substrate);
    sample.tick(1);
    sample.player.x = 100 + Math.cos(angle) * 30;
    sample.player.y = 100 + Math.sin(angle) * 30;
    sample.tick(profile.windupMs);
    assert.equal(sample.runtime.health < 100, offset < 0, `${substrate}: true angular hit boundary`);
    assert.equal(sample.state.attackAngle, 0, 'attack heading does not home toward a sidestep');
    // The start gate must agree with the eventual hit shape as well.
    const start = encounter(substrate, angle);
    start.tick(1);
    assert.equal(start.state.attackPhase === 'windup', offset < 0, `${substrate}: angular start gate`);
  }
  for (const offset of [-.01, .01]) {
    const sample = encounter(substrate);
    sample.tick(1);
    sample.player.x = 100 + profile.rangePx + offset;
    sample.tick(profile.windupMs);
    assert.equal(sample.runtime.health < 100, offset < 0, `${substrate}: true reach boundary`);
  }

  // Inspect actual renderer draw commands: edge scratches terminate on hit limits.
  e.runtime.drawTelegraph(e.state, .5);
  assert.equal(e.lines.length, 3);
  for (let index = 0; index < 3; index++) {
    const line = e.lines[index]!;
    const distance = Math.hypot(line.x2 - 100, line.y2 - 100);
    const angle = Math.atan2(line.y2 - 100, line.x2 - 100) * 180 / Math.PI;
    assert(Math.abs(distance - profile.rangePx) < .00001);
    assert(Math.abs(angle - (index === 0 ? 0 : index === 1 ? -profile.halfAngleDeg : profile.halfAngleDeg)) < .00001);
    if (index > 0) assert(Math.abs(Math.hypot(line.x2 - line.x1, line.y2 - line.y1) - 6) < .00001);
  }
  const config = createEnemyTypeConfig('infiltrator', e.form);
  assert.equal(config.speeds[AIState.CHASE], 65 * profile.moveScale);
  assert(profile.rangePx > GAME_CONSTANTS.AI.STANDOFF_DISTANCE + GAME_CONSTANTS.AI.STANDOFF_BAND,
    'all body profiles can hit without reducing the player spacing advantage');
}
const unknown = encounter('legacy-unregistered');
unknown.tick(1); unknown.tick(350);
assert.equal(unknown.runtime.health, 100 - GAME_CONSTANTS.COMBAT.ENEMY_DAMAGE_BASE);
assert.equal(unknown.state.cooldownRemainingMs, 1200);
assert.equal(createEnemyTypeConfig('infiltrator').speeds[AIState.CHASE], 65);
console.log('check:body-runtime ok (production and retained historical body profiles: actual attack gates, damage timings, angle/reach boundaries, cooldowns, normalized animation, scratch geometry; legacy fallback)');
