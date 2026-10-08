/** Pure public-observation admission for one paid pursuit-control window. */
import assert from 'node:assert/strict';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function shortLeg(position, point, length = 28) {
  const total = distance(position, point);
  if (total < 1) return null;
  const scale = Math.min(length, total) / total;
  return { start: { ...position }, end: { x: position.x + (point.x - position.x) * scale, y: position.y + (point.y - position.y) * scale } };
}
export function blocksLeg(enemy, leg) {
  return [0, .5, 1].some(t => {
    const point = { x: leg.start.x + (leg.end.x - leg.start.x) * t, y: leg.start.y + (leg.end.y - leg.start.y) * t };
    const near = distance(enemy.position, point);
    const facing = Math.cos(Math.atan2(point.y - enemy.position.y, point.x - enemy.position.x) - enemy.facing) > .35;
    return near < 52 || (near < 88 && facing);
  });
}
export function pursuitCandidate(facts, point) {
  const leg = shortLeg(facts.position, point);
  if (!leg) return null;
  const enemy = facts.enemies.find(enemy => distance(enemy.position, facts.position) <= 110
    && (enemy.approaching || enemy.attack === 'windup' || enemy.attack === 'active') && blocksLeg(enemy, leg));
  return enemy ? { enemy, leg } : null;
}
export function liveOwnControls(registered, effects) {
  return effects.filter(effect => {
    const expected = registered.get(effect.effectId);
    return expected && effect.sourceInstanceId === expected.sourceInstanceId && effect.targetId === expected.targetId
      && effect.controlActive && effect.remainingTime > 0;
  });
}
export function controlRolePermission(roles, role) {
  return (role === 'transit' || role === 'search') && (roles.get(role) ?? 0) < 1;
}
export function checkPursuitPolicy() {
  const facts = { position: { x: 100, y: 100 }, enemies: [{ id: 'visible', position: { x: 50, y: 100 }, facing: 0, approaching: true, attack: 'idle' }] };
  assert.equal(pursuitCandidate(facts, { x: 300, y: 100 })?.enemy.id, 'visible');
  assert.equal(pursuitCandidate({ ...facts, enemies: [{ ...facts.enemies[0], approaching: false }] }, { x: 300, y: 100 }), null);
  assert.equal(pursuitCandidate({ ...facts, enemies: [{ ...facts.enemies[0], position: { x: -20, y: 100 } }] }, { x: 300, y: 100 }), null);
  const leg = shortLeg(facts.position, { x: 300, y: 100 }); assert.equal(distance(leg.start, leg.end), 28);
  const record = { effectId: 'paid1', sourceInstanceId: 'earned-item', targetId: 'visible' }, registered = new Map([[record.effectId, record]]);
  assert.equal(liveOwnControls(registered, [{ ...record, controlActive: true, remainingTime: 10 }]).length, 1);
  for (const invalid of [{ controlActive: false }, { remainingTime: 0 }, { targetId: 'different' }, { sourceInstanceId: 'another' }])
    assert.equal(liveOwnControls(registered, [{ ...record, controlActive: true, remainingTime: 10, ...invalid }]).length, 0);
  assert(controlRolePermission(new Map(), 'transit')); assert(!controlRolePermission(new Map([['transit', 1]]), 'transit'));
  assert(controlRolePermission(new Map([['transit', 1]]), 'search')); assert(!controlRolePermission(new Map(), 'other'));
  return { status: 'pass', scope: 'Currently visible pursuit/attack blocks28px leg; registered paid source/effect/target and live control required; separate one-transit/one-search roles' };
}
if (process.argv[1]?.endsWith('r100-i13-pursuit-policy.mjs') && process.argv.includes('--self-check')) console.log(JSON.stringify(checkPursuitPolicy()));
