/** Formal nearest-target prediction from normal observations only.
 * Unknown hard-control eligibility is deliberately left to actual casting.
 */
import assert from 'node:assert/strict';
import { blocksLeg, shortLeg } from './r100-i13-pursuit-policy.mjs';
export { liveOwnControls, controlRolePermission } from './r100-i13-pursuit-policy.mjs';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function nearestPredictedTarget(facts, visibility, knownUnavailable, maxDistance = 128) {
  let selected = null, best = maxDistance * maxDistance;
  for (const enemy of facts.enemies) {
    if ((knownUnavailable.get(enemy.id) ?? -Infinity) > facts.elapsedMs) continue;
    const exposed = visibility.find(row => row.id === enemy.id);
    if (!exposed?.visible || !exposed.lineOfSight) continue;
    const dx = enemy.position.x - facts.position.x, dy = enemy.position.y - facts.position.y;
    const angle = Math.atan2(dy, dx) - facts.facing;
    if (Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) > Math.PI / 2) continue;
    const squared = dx * dx + dy * dy;
    if (squared > best || (selected && squared === best)) continue;
    selected = enemy; best = squared;
  }
  return selected;
}
export function nearestBlockingTurnCandidate(facts, point) {
  const leg = shortLeg(facts.position, point);
  if (!leg) return null;
  return facts.enemies.filter(enemy => distance(enemy.position, facts.position) <= 110
    && (enemy.approaching || enemy.attack === 'windup' || enemy.attack === 'active') && blocksLeg(enemy, leg))
    .sort((a, b) => distance(a.position, facts.position) - distance(b.position, facts.position))[0] ?? null;
}
export function selectedControlAdmission(facts, point, role, selected) {
  const leg = shortLeg(facts.position, point);
  if (!selected || !leg) return { allowed: false, reason: 'no-formal-public-target-or-short-leg' };
  if (role === 'transit') {
    const blockers = facts.enemies.filter(enemy => blocksLeg(enemy, leg) || (distance(enemy.position,facts.position)<110 && (enemy.attack==='windup'||enemy.attack==='active')));
    const pursuing = selected.approaching || selected.attack === 'windup' || selected.attack === 'active';
    const allowed = distance(selected.position, facts.position) <= 110 && pursuing && blockers.length === 1 && blockers[0].id === selected.id;
    return { allowed, reason: allowed ? 'formal-predicted-target-is-only-short-leg-blocker' : 'multiple-blockers-or-nearest-target-does-not-open-leg', selected, leg, blockers };
  }
  const others = facts.enemies.filter(enemy => enemy.id !== selected.id);
  const blocked = others.some(enemy => {
    const d = distance(enemy.position, facts.position);
    const facing = Math.cos(Math.atan2(facts.position.y - enemy.position.y, facts.position.x - enemy.position.x) - enemy.facing) > .35;
    return d < 52 || (d < 88 && facing) || (d < 110 && (enemy.attack === 'windup' || enemy.attack === 'active'));
  });
  return { allowed: !blocked && distance(selected.position,facts.position)<110, reason: blocked ? 'another-visible-enemy-still-blocks-search' : 'formal-predicted-search-target-and-other-original-gates', selected, leg, otherEnemies: others };
}
export function checkTargetPolicy() {
  // Original line399 normal observations and short leg; pure predicate regression.
  // The alternate facing below is an explicit hypothetical turn, not a replay.
  const observed = {"position":{"x":932.5468305588267,"y":454.13454938892795},"facing":-0.47111323433232266,"elapsedMs":31298.739999999725,"enemies":[{"id":"ENM_INF_01","position":{"x":886.5362288079662,"y":414.98262378931764},"facing":0.6477855677410551,"attack":"recover","approaching":true},{"id":"ENM_INF_03","position":{"x":880.2246270967734,"y":433.9606027080346},"facing":0.4282799146424743,"attack":"recover","approaching":true}]};
  const point = {"x": 940, "y": 452};
  const facts = { ...observed, facing: Math.atan2(observed.enemies[1].position.y-observed.position.y,observed.enemies[1].position.x-observed.position.x) };
  const visibility = facts.enemies.map(enemy => ({ id: enemy.id, visible: true, lineOfSight: true }));
  const selected = nearestPredictedTarget(facts, visibility, new Map());
  assert.equal(selected.id, 'ENM_INF_03', 'Never use array-first01 when formal nearest is03');
  assert.equal(selectedControlAdmission(facts, point, 'transit', selected).allowed, false, 'Freezing one of two blocking enemies does not open the short leg');
  assert.equal(nearestPredictedTarget(observed, visibility, new Map()), null, 'Planned turn is not an actual facing change');
  assert.equal(nearestPredictedTarget(facts, visibility.map(row => ({ ...row, lineOfSight: row.id !== 'ENM_INF_03' })), new Map()).id, 'ENM_INF_01');
  assert.equal(nearestPredictedTarget(facts, visibility, new Map([['ENM_INF_03', facts.elapsedMs+2000]])).id, 'ENM_INF_01');
  const single = { ...facts, enemies: [facts.enemies[1]] };
  assert(selectedControlAdmission(single, point, 'transit', single.enemies[0]).allowed);
  return { status: 'pass', scope: 'Original line399 positions/facings/shortleg with explicit hypothetical turn, nearest-not-array-first, multi-blocker rejection, actual facing, LOS and public protection memory' };
}
if (process.argv[1]?.endsWith('r100-i13-target-policy.mjs') && process.argv.includes('--self-check')) console.log(JSON.stringify(checkTargetPolicy()));
