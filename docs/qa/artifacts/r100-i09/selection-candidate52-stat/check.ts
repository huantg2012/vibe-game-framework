/** Read-only candidate-pool preflight, not final enabled-catalog qualification. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { R100_NATIVE_WORLDS, R100_NATIVE_CATALOG_SOURCE_HASH } from '../../../../../src/generated/r100-native-worlds';
import { R100_WORLD_SELECTION_POLICY as policy, R100_SELECTION_SOURCE_HASH } from '../../../../../src/generated/r100-world-selection';
import { describeR100World, r100WorldNeighborDistance, r100WorldSelectionWeights, selectR100WorldId } from '../../../../../src/generation/world-study/r100-world-selection';
import { appendRiftWorldVisit, emptyRiftWorldHistory } from '../../../../../src/types/rift-world-history';
import { mix32 } from '../../../../../src/generation/seed-fork';

const sources = ['data/rift-native-worlds.csv', 'data/rift-world-selection.csv', 'src/generated/r100-native-worlds.ts',
  'src/generated/r100-world-selection.ts', 'src/generation/world-study/r100-world-selection.ts', 'src/types/rift-world-history.ts',
  'src/generation/seed-fork.ts'];
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const original = JSON.stringify(R100_NATIVE_WORLDS), hashes = sources.map(file => ({ file, sha256: sha(file) }));
const catalog = R100_NATIVE_WORLDS.map(world => ({ ...world, enabled: true }));
assert.equal(catalog.length, 52); assert.equal(new Set(catalog.map(row => row.id)).size, 52);
const descriptors = new Map(catalog.map(row => [row.id, describeR100World(row)]));
const neighbors = Object.fromEntries(catalog.map(a => [a.id, catalog.filter(b => a.id !== b.id
  && r100WorldNeighborDistance(descriptors.get(a.id)!, descriptors.get(b.id)!) <= policy.neighborDistance).map(row => row.id).sort()]));
assert(r100WorldSelectionWeights(undefined, catalog).every(row => row.weight === 1));
const first = catalog[0]!.id, recentVisit = { worldId: first, grade: 'low' as const };
assert.equal(r100WorldSelectionWeights({ version: 1, visits: [recentVisit] }, catalog).find(row => row.worldId === first)!.weight, .2);
assert.deepEqual(r100WorldSelectionWeights({ version: 1, visits: [recentVisit] }, catalog),
  r100WorldSelectionWeights({ version: 1, visits: [{ ...recentVisit, grade: 'severe' }] }, catalog));
for (let seed = 0; seed < 100; seed++) assert.equal(selectR100WorldId(seed, undefined, catalog), selectR100WorldId(seed, undefined, [...catalog].reverse()));

const samples = 32_768;
function sample(useHistory: boolean) {
  let history = emptyRiftWorldHistory(), repeats = 0, near = 0, previous: string | undefined;
  const counts = Object.fromEntries(catalog.map(row => [row.id, 0]));
  const perGrade = ['low', 'medium', 'severe'].map(() => ({ ...counts }));
  for (let index = 0; index < samples; index++) {
    const id = selectR100WorldId(mix32(index, 'i09-sampling-evidence'), useHistory ? history : undefined, catalog);
    counts[id]!++; perGrade[index % 3]![id]!++;
    if (id === previous) repeats++;
    else if (previous && neighbors[previous]!.includes(id)) near++;
    if (useHistory) history = appendRiftWorldVisit(history, { worldId: id, grade: (['low', 'medium', 'severe'] as const)[index % 3]! });
    previous = id;
  }
  return { counts, perGrade, repeats, near, samples };
}
const uniform = sample(false), recent = sample(true), expected = samples / catalog.length;
for (const [id, count] of Object.entries(uniform.counts)) assert(Math.abs(count - expected) < 7 * Math.sqrt(expected), `${id}: same conservative7sigma bound`);
for (const counts of recent.perGrade) assert(Object.values(counts).every(count => count > 0), 'Every candidate remains reachable at every grade');
assert(recent.repeats < uniform.repeats * .65, 'Same repeat reduction threshold');
if (uniform.near > 100) assert(recent.near < uniform.near * .9, 'Same near-repeat reduction threshold');
assert.equal(JSON.stringify(R100_NATIVE_WORLDS), original, 'Imported author data unchanged');
for (const row of hashes) assert.equal(sha(row.file), row.sha256, 'No disk source change');
const result = { status: 'pass-candidate52-preflight-only', scope: 'All52 authored candidates enabled in an in-memory copy only. Original CSV and generated registry remain unchanged. Not final52 enabled-pool statistics or gameplay evidence.',
  actualEnabledCount: R100_NATIVE_WORLDS.filter(row => row.enabled).length, worldIds: catalog.map(row => row.id).sort(),
  policy, catalogSourceHash: R100_NATIVE_CATALOG_SOURCE_HASH, policySourceHash: R100_SELECTION_SOURCE_HASH,
  sourcesBeforeAndAfter: hashes, descriptors: [...descriptors.values()], neighbors, uniform, recent,
  repeatRate: [uniform.repeats / samples, recent.repeats / samples], nearRate: [uniform.near / samples, recent.near / samples] };
writeFileSync(new URL('./selection.json', import.meta.url), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, actualEnabledCount: result.actualEnabledCount, worlds: 52, samplesPerPolicy: samples,
  repeatRate: result.repeatRate, nearRate: result.nearRate,
  minWorldSamples: Math.min(...Object.values(recent.counts)), maxWorldSamples: Math.max(...Object.values(recent.counts)) }));
