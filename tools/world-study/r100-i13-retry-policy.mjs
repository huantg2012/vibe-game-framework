/** Bounded reconsideration uses only normal observations and actual movement.
 * No loot definitions, hidden enemy position or generation contents are inputs.
 */
import assert from 'node:assert/strict';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function retryAdmission(record, facts) {
  if (!record) return { allowed: true, reason: 'first-attempt' };
  if (record.failures >= 2) return { allowed: false, reason: 'two-failed-attempts' };
  if (facts.elapsedMs - record.elapsedMs < 5000) return { allowed: false, reason: 'five-second-minimum' };
  if (distance(facts.position, record.position) < 48 && facts.successes <= record.successes) return { allowed: false, reason: 'no-new-movement-or-other-success' };
  const evidence = record.blockers.map(old => {
    const now = facts.remembered.find(enemy => enemy.id === old.id && !enemy.source);
    const moved = !!now && now.seen > old.seen && distance(now.position, old.position) >= 32;
    const expired = (!now || facts.elapsedMs - now.seen > 5000) && facts.elapsedMs - old.seen > 5000;
    return { id: old.id, moved, expired, old, currentNormalMemory: now ?? null };
  });
  if (!evidence.length) {
    const look = facts.lastNormalObservation;
    const seenAgain = look?.elapsedMs > record.elapsedMs && distance(look.position, record.position) >= 48
      && look.visibleSearches.some(target => target.id === record.target.id);
    return { allowed: !!seenAgain, reason: 'no-enemy-blocker-requires-new-position-and-new-normal-target-observation',
      lastNormalObservation: look ?? null, requiresOriginalCaution: true, evidence };
  }
  return { allowed: evidence.every(row => row.moved || row.expired),
    reason: 'reassess-only-after-old-blocking-observation-changed', requiresOriginalCaution: true, evidence };
}

export function recordDeferred(previous, facts, target, reason) {
  return { target: { id: target.id, pos: { ...target.pos } }, reason, failures: (previous?.failures ?? 0) + 1,
    elapsedMs: facts.elapsedMs, position: { ...facts.position }, successes: facts.successes,
    blockers: facts.remembered.filter(enemy => !enemy.source &&
      (distance(enemy.position, facts.position) <= 170 || distance(enemy.position, target.pos) <= 170))
      .map(enemy => ({ id: enemy.id, position: { ...enemy.position }, seen: enemy.seen })) };
}

export function secondGeometryGoal(grid, footprints, firstGoal) {
  const { cols, rows, size, walk, start, halfX, halfY } = grid;
  const center = index => ({ x: (index % cols + .5) * size, y: (Math.floor(index / cols) + .5) * size });
  const floor = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && walk[y * cols + x];
  const clear = index => {
    const p = center(index);
    for (let y = Math.floor((p.y - halfY) / size); y <= Math.floor((p.y + halfY - .01) / size); y++)
      for (let x = Math.floor((p.x - halfX) / size); x <= Math.floor((p.x + halfX - .01) / size); x++) if (!floor(x, y)) return false;
    return true;
  };
  const begin = Math.floor(start.y / size) * cols + Math.floor(start.x / size), queue = [begin], distances = new Map([[begin, 0]]);
  for (let n = 0; n < queue.length; n++) {
    const index = queue[n], x = index % cols, y = Math.floor(index / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = x + dx, b = y + dy, next = b * cols + a;
      if (!floor(a, b) || distances.has(next) || !clear(next)) continue;
      distances.set(next, distances.get(index) + size); queue.push(next);
    }
  }
  const candidates = [];
  for (const [index, pathDistance] of distances) {
    const pos = center(index);
    if (distance(pos, firstGoal.pos) < 128 || footprints.some(point => distance(pos, point) < 128)) continue;
    const regionVisits = footprints.filter(point => distance(pos, point) < 256).length;
    candidates.push({ pos, regionVisits, pathDistance, index });
  }
  candidates.sort((a, b) => a.regionVisits - b.regionVisits || a.pathDistance - b.pathDistance || a.index - b.index);
  const selected = candidates[0];
  return selected ? { id: 'geometry-exploration', pos: selected.pos, geometryOrdinal: 2,
    disclosure: 'Pure body-reachable terrain at least128px from actual footprints; least-visited256px neighborhood, then shortest body path; no object/AI inputs',
    regionVisits: selected.regionVisits, pathDistance: selected.pathDistance } : null;
}

export function checkRetryPolicy() {
  const target = { id: 'normally-seen', pos: { x: 60, y: 0 } };
  const facts = { position: { x: 0, y: 0 }, elapsedMs: 1000, successes: 0, remembered: [{ id: 'seen-enemy', position: { x: 50, y: 0 }, seen: 1000 }] };
  const record = recordDeferred(null, facts, target, 'approach-kept-dangerous');
  assert(!retryAdmission(record, { ...facts, position: { x: 100, y: 0 }, elapsedMs: 5999, remembered: [] }).allowed);
  assert(!retryAdmission(record, { ...facts, elapsedMs: 7000, remembered: [] }).allowed);
  assert(retryAdmission(record, { ...facts, position: { x: 48, y: 0 }, elapsedMs: 7000, remembered: [] }).allowed);
  assert(retryAdmission(record, { ...facts, successes: 1, elapsedMs: 7000, remembered: [] }).allowed);
  const moved = { ...facts, position: { x: 48, y: 0 }, elapsedMs: 7000, remembered: [{ id: 'seen-enemy', position: { x: 82, y: 0 }, seen: 6999 }] };
  assert(retryAdmission(record, moved).allowed);
  assert(!retryAdmission(record, { ...moved, remembered: [{ id: 'seen-enemy', position: { x: 81, y: 0 }, seen: 6999 }] }).allowed);
  assert(!retryAdmission(recordDeferred(record, moved, target, 'second-failure'), { ...moved, elapsedMs: 15000, remembered: [] }).allowed);
  const noBlocker = recordDeferred(null, { ...facts, remembered: [] }, target, 'channel-not-completed');
  assert(!retryAdmission(noBlocker, { ...moved, remembered: [] }).allowed);
  assert(retryAdmission(noBlocker, { ...moved, remembered: [], lastNormalObservation: { elapsedMs: 6999, position: moved.position, visibleSearches: [target] } }).allowed);
  const grid = { cols: 24, rows: 24, size: 32, walk: Array(576).fill(true), start: { x: 80, y: 80 }, halfX: 12, halfY: 12 };
  const footprints = [{ x: 80, y: 80 }, { x: 176, y: 80 }], goal = secondGeometryGoal(grid, footprints, { pos: { x: 720, y: 720 } });
  assert(goal && footprints.every(point => distance(point, goal.pos) >= 128));
  assert.equal(secondGeometryGoal({ ...grid, walk: Array(576).fill(false) }, footprints, { pos: { x: 720, y: 720 } }), null);
  return { status: 'pass', scope: 'Two-attempt ceiling,5second/48px-or-success conditions, normal enemy32px movement or natural memory expiry, no hidden geometry inputs' };
}
if (process.argv[1]?.endsWith('r100-i13-retry-policy.mjs') && process.argv.includes('--self-check')) console.log(JSON.stringify(checkRetryPolicy()));
