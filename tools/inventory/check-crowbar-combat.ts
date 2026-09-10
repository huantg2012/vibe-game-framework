import { observeVisualHits } from '../../src/entities/hit-reaction';
/** Real Combat + Host methods with engine effects replaced, no duplicate damage model. */
import assert from 'node:assert/strict';
import { CombatSystem } from '../../src/systems/combat-system';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system';
import { swingDamage, swingContactProgress, type WeaponAttackPose } from '../../src/systems/weapon-swing';
import { sampleCrowbarRig, type CrowbarRigPose } from '../../src/entities/player-weapon-rig';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { GameEvent } from '../../src/types/events';
import { eventBus } from '../../src/core/event-bus';

const grid = { cols: 20, rows: 20, tileSize: 8, version: 0, isOpaque: (_x: number, _y: number) => false };
function fixture(bodies: { id: string; x: number; y: number }[] = []) {
  const combat = new CombatSystem();
  const player = { getPosition: () => ({ x: 80, y: 80 }), getFacingAngle: () => 0,
    setSpeedModifier() {}, clearSpeedModifier() {}, setWeaponVisual() {}, setWeaponAttackPose() {} };
  const views = bodies.map(row => ({ getId: () => row.id, getPosition: () => row, getFacingAngle: () => 0, isEngaged: () => false }));
  const noise: number[] = [];
  Object.assign(combat, { player, occluders: grid, hooks: { onNoise: (_p: unknown, radius: number) => noise.push(radius) },
    ai: { getEnemies: () => views, getEnemyById: (id: string) => views.find(v => v.getId() === id) },
    spawnFx() {}, drawVisuals() {}, stepFx() {} });
  combat.noteRosterChanged();
  combat.configureWeapon('crowbar_plain', 7);
  return { combat, noise };
}
function advance(combat: CombatSystem, total: number, step = 16) {
  while (total > 0) { const dt = Math.min(total, step); combat.update(dt); total -= dt; }
}
function hostFixture(combat: CombatSystem, nuclei: { x: number; y: number }[], continuity = 'colony') {
  const system = new ContaminationHostSystem();
  const cores = nuclei.map(core => ({ core, hp: 50, alive: true, flashMs: 0, floorCol: 0, floorRow: 0 }));
  const host = { id: 'host', alive: true, kind: 'bing', hp: 50, core: nuclei[0], nuclei: cores,
    form: { portfolio: 'bing', occupancy: 'paint', substrate: 'fungal_mat', continuity, coverage: 'rewrite', lexemes: { contact: 'contact_step_chaos' } },
    gfx: { clear() {}, setVisible() {} }, marks: null, noiseRemainingMs: 0 };
  Object.assign(system, { hosts: [host], liveMotion: true });
  combat.registerMeleeTargets(system);
  return { system, host, cores };
}

for (const weapon of Object.values(WEAPON_DATA)) {
  const values = new Set<number>();
  for (let i = 1; i < 10000; i++) {
    const value = swingDamage(7, i, weapon.damageMin, weapon.damageMax);
    assert(value >= weapon.damageMin && value <= weapon.damageMax && Number.isInteger(value));
    values.add(value);
    assert.equal(value, swingDamage(7, i, weapon.damageMin, weapon.damageMax));
  }
  assert.equal(values.size, weapon.damageMax - weapon.damageMin + 1);
}
assert.equal(swingContactProgress(-5, 0, 0, 40, Math.PI * 2 / 3), null, 'no near-body backwards bypass');
assert.equal(swingContactProgress(41, 0, 0, 40, Math.PI * 2 / 3), null);
assert.equal(swingContactProgress(30, 0, 0, 40, Math.PI * 2 / 3), .5);

// Body + real colony core share one sample and ordered two-target budget, including 10fps.
for (const step of [8, 16, 33, 100]) {
  const { combat, noise } = fixture([{ id: 'body', x: 109, y: 81 }, { id: 'late', x: 98, y: 101 }, { id: 'behind', x: 75, y: 80 }]);
  const { cores } = hostFixture(combat, [{ x: 100, y: 68 }, { x: 100, y: 72 }]);
  const visualHits: string[] = [];
  const stopHits = ['body', 'host', 'late', 'behind'].map(id => observeVisualHits(id, () => visualHits.push(id)));
  const damageEvents: number[] = [];
  const handler = (e: { amount: number }) => damageEvents.push(e.amount);
  eventBus.on(GameEvent.ENEMY_DAMAGED, handler);
  combat.requestPlayerAttack();
  const sample = combat.getSwingSnapshot().damage;
  advance(combat, 400, step);
  eventBus.off(GameEvent.ENEMY_DAMAGED, handler);
  assert.equal(cores[0]!.hp, 50 - sample, 'earliest real core hit');
  assert.equal(cores[1]!.hp, 50, 'same host cannot take a second core hit');
  assert.equal(combat.getEnemyHealth('body'), 75 - sample, 'body shares same damage');
  assert.equal(combat.getEnemyHealth('late'), 75, 'later target outside shared budget');
  assert.equal(combat.getEnemyHealth('behind'), 75, 'rear near target cannot be hit');
  assert.deepEqual(damageEvents, [sample, sample]);
  assert.deepEqual(visualHits, ['host', 'body'], 'only real shared-budget hits notify visuals');
  stopHits.forEach(stop => stop());
  assert.equal(noise.filter(n => n === 160).length, 1, 'contact noise deduplicated across body and core');
  assert.equal(combat.getAttackState().phase, 'idle');
}

// Terrain blocks both bodies and host nuclei before spending budget.
{
  const { combat } = fixture([{ id: 'wall', x: 112, y: 80 }]);
  const { cores } = hostFixture(combat, [{ x: 114, y: 78 }]);
  let visualHits = 0;
  const stop = observeVisualHits('wall', () => visualHits++);
  const stopHost = observeVisualHits('host', () => visualHits++);
  Object.assign(combat, { occluders: { ...grid, isOpaque: (x: number) => x === 12 } });
  combat.requestPlayerAttack(); advance(combat, 300, 100);
  assert.equal(combat.getEnemyHealth('wall'), 75); assert.equal(cores[0]!.hp, 50);
  assert.equal(visualHits, 0, 'wall-blocked swings produce no impact reaction'); stop(); stopHost();
}
// Unkillable fields do not consume either budget or HP; high quality still cannot kill one.
{
  const { combat } = fixture([{ id: 'body', x: 109, y: 81 }]);
  const { host } = hostFixture(combat, [{ x: 100, y: 70 }], 'field');
  combat.configureWeapon('crowbar_excellent_standard');
  combat.requestPlayerAttack(); advance(combat, 300, 100);
  assert.equal(host.hp, 50); assert.equal(host.alive, true);
  assert.equal(combat.getEnemyHealth('body'), 75 - combat.getSwingSnapshot().damage);
}
// Buffer accepts last 100ms, starts at 500ms exactly and invalid inputs never roll.
{
  const { combat } = fixture();
  combat.requestPlayerAttack();
  for (let i = 0; i < 30; i++) combat.requestPlayerAttack();
  assert.equal(combat.getSwingSnapshot().sequence, 1);
  advance(combat, 390); combat.requestPlayerAttack(); advance(combat, 110);
  assert.equal(combat.getSwingSnapshot().sequence, 1, 'too early input not buffered');
  combat.requestPlayerAttack(); advance(combat, 450); combat.requestPlayerAttack();
  combat.update(100);
  assert.equal(combat.getSwingSnapshot().sequence, 3);
  const state = combat as unknown as { swingElapsedMs: number };
  assert.equal(state.swingElapsedMs, 50, 'buffer starts at legal boundary inside long frame');
  advance(combat, 400); combat.requestPlayerAttack(); combat.clearAttackBuffer(); advance(combat, 100);
  assert.equal(combat.getSwingSnapshot().sequence, 3, 'opening bag clears pending swing');
  combat.configureWeapon('crowbar_fine_standard');
  assert.equal(combat.getSwingSnapshot().sequence, 3, 'equipment changes do not restart stream');
  combat.configureWeapon(null); combat.requestPlayerAttack();
  assert.equal(combat.getSwingSnapshot().sequence, 3);
}
// Uses are spent once per successful swing, not once per target or frame.
{
  const { combat } = fixture([{ id: 'a', x: 109, y: 79 }, { id: 'b', x: 108, y: 83 }]);
  const visuals: (string | null)[] = [];
  const internals = combat as unknown as { hooks: { consumeWeaponUse?: () => boolean }; player: { setWeaponVisual: (quality: string | null) => void } };
  internals.player.setWeaponVisual = quality => visuals.push(quality);
  let uses = 1, calls = 0;
  internals.hooks.consumeWeaponUse = () => { calls++; uses--; combat.configureWeapon(null); return true; };
  combat.requestPlayerAttack();
  assert.equal(uses, 1, 'starting/whiffing a swing does not spend durability');
  const damage = combat.getSwingSnapshot().damage;
  advance(combat, 220);
  assert.equal(calls, 1); assert.equal(uses, 0);
  assert.equal(combat.getEnemyHealth('a'), 75 - damage);
  assert.equal(combat.getEnemyHealth('b'), 75 - damage, 'last use still hits second budgeted target');
  assert.equal(visuals.at(-1), 'ordinary', 'last-use weapon remains through recovery');
  advance(combat, 200);
  assert.equal(visuals.at(-1), null, 'weapon disappears after completed recovery');
  combat.requestPlayerAttack(); assert.equal(combat.getSwingSnapshot().sequence, 1);
}
{
  const { combat } = fixture([{ id: 'behind', x: 72, y: 80 }]);
  let calls = 0;
  Object.assign((combat as unknown as { hooks: object }).hooks, { consumeWeaponUse: () => { calls++; return true; } });
  combat.requestPlayerAttack(); advance(combat, 420);
  assert.equal(calls, 0, 'air/rear miss spends no use');
}
{
  const { combat } = fixture([{ id: 'a', x: 109, y: 79 }, { id: 'b', x: 108, y: 83 }]);
  let calls = 0;
  Object.assign((combat as unknown as { hooks: object }).hooks, { consumeWeaponUse: () => { calls++; return false; } });
  combat.requestPlayerAttack(); advance(combat, 420, 8);
  assert.equal(calls, 1, 'failed storage is not retried every active frame');
  assert.equal(combat.getEnemyHealth('a'), 75); assert.equal(combat.getEnemyHealth('b'), 75);
}

// Rendering curves have a moving elbow/chest, fixed family envelope, continuous phase joins.
const attack: WeaponAttackPose = { phase: 'windup', elapsedMs: 0, facing: 0, windupMs: 120, activeMs: 60,
  recoveryMs: 220, contactHoldMs: 24, contactRemainingMs: 0 };
const pose: CrowbarRigPose = { handX: 0, handY: 0, shoulderX: 0, shoulderY: 0, elbowX: 0, elbowY: 0,
  rotation: 0, torsoRotation: 0, torsoX: 0, torsoY: 0, behind: false };
for (const facing of ['up', 'down', 'left', 'right'] as const) {
  attack.facing = facing === 'up' ? -Math.PI / 2 : facing === 'down' ? Math.PI / 2 : facing === 'left' ? Math.PI : 0;
  let previous = 0, previousX = 0, previousY = 0;
  for (let t = 0; t <= 400; t++) {
    attack.elapsedMs = t; attack.phase = t < 120 ? 'windup' : t < 180 ? 'active' : 'recovery';
    sampleCrowbarRig(pose, facing, attack.facing, attack, t, false);
    assert(Object.values(pose).every(v => typeof v === 'boolean' || Number.isFinite(v)));
    if (t > 0) {
      assert(Math.abs(pose.rotation - previous) < .1, 'no phase rotation discontinuity');
      assert(Math.hypot(pose.handX - previousX, pose.handY - previousY) < 1, 'continuous wrist across windup/active/recovery joins');
    }
    previous = pose.rotation; previousX = pose.handX; previousY = pose.handY;
  }
}
console.log('check:crowbar-combat PASS: 10 definitions; per-swing RNG; 8/16/33/100ms body+Host shared sweep/HP/LOS/budget; field immunity; 100ms exact buffer; pose continuity');
