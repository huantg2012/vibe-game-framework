#!/usr/bin/env node
/** Candidate-data audit only. Never imports or mutates the production game. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function readCsv(relative) {
  const source = readFileSync(resolve(root, relative), 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  assert.equal(quoted, false, `${relative}: unterminated quote`);
  if (row.length || cell.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift();
  assert.ok(header && new Set(header).size === header.length, `${relative}: missing/duplicate header`);
  return rows.filter(r => r.some(Boolean)).map((r, i) => {
    assert.equal(r.length, header.length, `${relative}:${i + 2}: column count`);
    return Object.fromEntries(header.map((key, j) => [key, r[j]]));
  });
}
function integer(row, key) {
  assert.match(row[key] ?? '', /^-?\d+$/, `${row.id ?? row.weapon_type}.${key}: integer required`);
  const value = Number(row[key]);
  assert.ok(Number.isSafeInteger(value), `${key}: outside integer range`);
  return value;
}
function unique(rows, key) {
  assert.equal(new Set(rows.map(r => r[key])).size, rows.length, `duplicate ${key}`);
}
const qualityRows = readCsv('data/drafts/iteration-19-crowbar-qualities.csv');
const itemRows = readCsv('data/drafts/iteration-19-crowbars.csv');
const profiles = readCsv('data/drafts/iteration-19-crowbar-attack-profile.csv');
assert.equal(qualityRows.length, 4); assert.equal(itemRows.length, 10); assert.equal(profiles.length, 1);
unique(qualityRows, 'id'); unique(itemRows, 'id');
const qualities = qualityRows.sort((a, b) => integer(a, 'quality_rank') - integer(b, 'quality_rank'));
const byId = new Map(qualities.map(q => [q.id, q]));
const profile = profiles[0];
assert.equal(profile.weapon_type, 'crowbar');
assert.ok(integer(profile, 'windup_ms') + integer(profile, 'active_ms') + integer(profile, 'recovery_ms') <= integer(profile, 'min_interval_ms'));
const choices = { standard: { weight: 30, resistance: 2 }, light: { weight: 27, resistance: 0 }, resistant: { weight: 33, resistance: 4 } };
for (const [i, q] of qualities.entries()) {
  assert.equal(q.weapon_type, 'crowbar'); assert.equal(integer(q, 'quality_rank'), i + 1);
  const lo = integer(q, 'damage_min'), hi = integer(q, 'damage_max');
  assert.ok(lo > 0 && hi >= lo && hi <= 1000, `${q.id}: invalid candidate range`);
  assert.ok(!('resistance_points' in q) && !('damage' in q), `${q.id}: retired quality columns`);
  if (i) assert.ok(lo > integer(qualities[i - 1], 'damage_max'), `${q.id}: quality ranges overlap`);
  const members = itemRows.filter(item => item.quality_id === q.id);
  assert.equal(members.length, i === 0 ? 1 : 3);
  if (i) assert.deepEqual(members.map(item => item.variant_id).sort(), Object.keys(choices).sort());
}
for (const item of itemRows) {
  assert.ok(byId.has(item.quality_id)); assert.equal(item.weapon_type, 'crowbar');
  assert.ok(!('resistance_delta_points' in item) && !item.id.includes('insulated'));
  for (const retired of ['damage', 'damage_min', 'damage_max', 'effect_id', 'reach_px', 'min_interval_ms']) {
    assert.ok(!(retired in item), `${item.id}: item must not override ${retired}`);
  }
  const rule = choices[item.variant_id]; assert.ok(rule, `${item.id}: unknown variant`);
  assert.equal(integer(item, 'weight_tenths'), rule.weight);
  assert.equal(integer(item, 'resistance_points'), item.id === 'crowbar_plain' ? 0 : rule.resistance);
  if (item.quality_id === qualities[0].id) assert.equal(item.id, 'crowbar_plain');
  assert.ok(item.visual_key && item.name && item.context_tags);
}

// Absorbing discrete convolution: each face is equiprobable, each accepted swing independent.
// Surviving sum counts are exact integers. Death on swing n has denominator faces**n.
function hitDistribution(hp, lo, hi) {
  const faces = BigInt(hi - lo + 1), maxHits = Math.ceil(hp / lo);
  const events = [];
  let alive = new Map([[0, 1n]]);
  for (let n = 1; n <= maxHits; n++) {
    let killed = 0n;
    const next = new Map();
    for (const [sum, count] of alive) {
      for (let damage = lo; damage <= hi; damage++) {
        const total = sum + damage;
        if (total >= hp) killed += count;
        else next.set(total, (next.get(total) ?? 0n) + count);
      }
    }
    if (killed) events.push({ hits: n, numerator: killed, denominator: faces ** BigInt(n) });
    alive = next;
  }
  assert.equal(alive.size, 0, 'all paths must terminate');
  const denominator = faces ** BigInt(maxHits);
  const total = events.reduce((sum, event) => sum + event.numerator * faces ** BigInt(maxHits - event.hits), 0n);
  assert.equal(total, denominator, 'kill probabilities must sum exactly to one');
  const expectedNumerator = events.reduce((sum, event) => sum + BigInt(event.hits) * event.numerator * faces ** BigInt(maxHits - event.hits), 0n);
  return { events, mean: Number(expectedNumerator) / Number(denominator) };
}
const hpTargets = [75, 50];
let priorMeans;
for (const q of qualities) {
  const means = [];
  for (const hp of hpTargets) {
    const result = hitDistribution(hp, integer(q, 'damage_min'), integer(q, 'damage_max'));
    means.push(result.mean);
    const choicesText = result.events.map(e => `${e.hits} hits ${(100 * Number(e.numerator) / Number(e.denominator)).toFixed(4)}%`).join('; ');
    const meanMs = integer(profile, 'windup_ms') + (result.mean - 1) * integer(profile, 'min_interval_ms');
    console.log(`${q.id} ${q.damage_min}-${q.damage_max}, HP ${hp}: ${choicesText}; E[hits]=${result.mean.toFixed(6)}; E[earliest ms]=${meanMs.toFixed(3)}`);
  }
  if (priorMeans) {
    assert.ok(means.every((mean, i) => mean <= priorMeans[i]), `${q.id}: worse expected hit count`);
    assert.ok(means.some((mean, i) => mean < priorMeans[i]), `${q.id}: no expected benefit on either current target`);
  }
  priorMeans = means;
}
console.log('PASS: draft schemas, fixed type profile, non-overlapping quality damage, horizontal resistance, integer weights, exact kill probabilities. Not runtime RNG, gameplay, save/reload, or art validation.');
