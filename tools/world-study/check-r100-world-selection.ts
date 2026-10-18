/** Deterministic statistical and invariant checks; no maps, user saves, or DOM. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { R100_NATIVE_WORLDS, R100_NATIVE_CATALOG_SOURCE_HASH } from '../../src/generated/r100-native-worlds';
import { R100_WORLD_SELECTION_POLICY as policy, R100_SELECTION_SOURCE_HASH } from '../../src/generated/r100-world-selection';
import { describeR100World, r100WorldNeighborDistance, r100WorldSelectionWeights, selectR100WorldId } from '../../src/generation/world-study/r100-world-selection';
import { appendRiftWorldVisit, emptyRiftWorldHistory, type RiftWorldHistory } from '../../src/types/rift-world-history';
import { mix32 } from '../../src/generation/seed-fork';

const catalog = R100_NATIVE_WORLDS, enabled = catalog.filter(row => row.enabled);
assert(enabled.length > 0, 'At least one admitted native world must remain selectable');
assert.equal(new Set(catalog.map(row => row.id)).size, catalog.length, 'Native world identities must be unique');
assert(catalog.every(row => /^[a-z][a-z0-9-]+$/.test(row.id) && ['low', 'medium', 'severe'].every(grade => row.definitions.some(definition => definition.grade === grade))), 'Every catalog entry retains a legal identity and all pollution grades');
const descriptors = new Map(catalog.map(row => [row.id, describeR100World(row)]));
const neighbors = Object.fromEntries(enabled.map(a => [a.id, enabled.filter(b => a.id !== b.id &&
  r100WorldNeighborDistance(descriptors.get(a.id)!, descriptors.get(b.id)!) <= policy.neighborDistance).map(row => row.id).sort()]));
const weightOf = (id: string, history: RiftWorldHistory) => r100WorldSelectionWeights(history).find(row => row.worldId === id)!.weight;
const first = enabled[0]!.id, visit = { worldId: first, grade: 'low' as const };
assert(r100WorldSelectionWeights().every(row => row.weight === 1));
assert.equal(weightOf(first, { version: 1, visits: [visit] }), .2);
assert.deepEqual(r100WorldSelectionWeights({ version: 1, visits: [visit] }),
  r100WorldSelectionWeights({ version: 1, visits: [{ ...visit, grade: 'severe' }] }), 'history is shared across grades');
assert.equal(weightOf(first, { version: 1, visits: [visit, ...Array.from({ length: 7 }, () => ({ worldId: 'retired-world', grade: 'severe' as const }))] }), 1);
assert.equal(weightOf(first, { version: 1, visits: Array.from({ length: 8 }, () => visit) }), .2, 'repeated history never multiplies penalties');
for (const neighbor of neighbors[first]!) assert.equal(weightOf(neighbor, { version: 1, visits: [visit] }), .55);
assert(r100WorldSelectionWeights({ version: 1, visits: [{ worldId: 'retired-world', grade: 'medium' }] }).every(row => row.weight === 1));
for (const a of descriptors.values()) for (const b of descriptors.values()) {
  const distance = r100WorldNeighborDistance(a, b);
  assert.equal(distance, r100WorldNeighborDistance(b, a));
  assert(distance >= 0 && distance <= 1);
  if (a.id === b.id) assert.equal(distance, 0);
}
for (let seed = 0; seed < 100; seed++) {
  assert.equal(selectR100WorldId(seed), selectR100WorldId(seed, undefined, [...catalog].reverse()));
  const single = catalog.map(row => ({ ...row, enabled: row.id === first }));
  assert.equal(selectR100WorldId(seed, { version: 1, visits: Array.from({ length: 8 }, () => visit) }, single), first);
}
for (const seed of [-1, 2 ** 32, .5, NaN]) assert.throws(() => selectR100WorldId(seed), /seed/);
assert.throws(() => selectR100WorldId(1, { version: 1, visits: Array(9).fill(visit) }), /history/);
assert.throws(() => selectR100WorldId(1, undefined, catalog.map(row => ({ ...row, enabled: false }))), /enabled/);
assert.throws(() => selectR100WorldId(1, undefined, [...catalog, enabled[0]!]), /Duplicate/);

const samples = 32_768;
function sample(useHistory: boolean) {
  let history = emptyRiftWorldHistory(), repeats = 0, near = 0, previous: string | undefined;
  const counts = Object.fromEntries(enabled.map(row => [row.id, 0]));
  const perGrade = ['low', 'medium', 'severe'].map(() => ({ ...counts }));
  for (let index = 0; index < samples; index++) {
    const id = selectR100WorldId(mix32(index, 'i09-sampling-evidence'), useHistory ? history : undefined);
    counts[id]!++; perGrade[index % 3]![id]!++;
    if (id === previous) repeats++;
    else if (previous && neighbors[previous]!.includes(id)) near++;
    if (useHistory) history = appendRiftWorldVisit(history, { worldId: id, grade: (['low', 'medium', 'severe'] as const)[index % 3]! });
    previous = id;
  }
  return { counts, perGrade, repeats, near, samples };
}
const uniform = sample(false), recent = sample(true), expected = samples / enabled.length;
for (const [id, count] of Object.entries(uniform.counts)) assert(Math.abs(count - expected) < 7 * Math.sqrt(expected), `${id}: uniform sampling outside conservative 7-sigma bound`);
for (const counts of recent.perGrade) assert(Object.values(counts).every(count => count > 0), 'every enabled world remains reachable at every grade');
assert(recent.repeats < uniform.repeats * .65, 'history should materially reduce immediate repeats');
if (uniform.near > 100) assert(recent.near < uniform.near * .9, 'history should reduce near repeats');
const report = { policy, catalogSourceHash: R100_NATIVE_CATALOG_SOURCE_HASH, policySourceHash: R100_SELECTION_SOURCE_HASH, worldIds: enabled.map(row => row.id).sort(),
  descriptors: [...descriptors.values()], neighbors, uniform, recent,
  scope: 'Seed sampling and policy invariants only; not actual journey, performance or visual acceptance.' };
const out = process.argv.indexOf('--out');
if (out >= 0) { const directory = process.argv[out + 1]!; mkdirSync(directory, { recursive: true }); writeFileSync(`${directory}/selection.json`, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ status: 'PASS', worlds: enabled.length, samplesPerPolicy: samples,
  repeatRate: [uniform.repeats / samples, recent.repeats / samples], nearRate: [uniform.near / samples, recent.near / samples],
  minWorldSamples: Math.min(...Object.values(recent.counts)), maxWorldSamples: Math.max(...Object.values(recent.counts)) }));
