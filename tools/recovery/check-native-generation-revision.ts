/** Historical recipes are actual previous browser departures, not newly minted current data. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { createR100ProductionMap as frozenMap } from '../../src/generation/legacy-r100-v2/executor.js';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';
const records = ['part-a', 'part-b'].flatMap(part => JSON.parse(readFileSync(`docs/qa/artifacts/r100-i06/final-runtime/formal-entry/${part}/report.json`, 'utf8')).cases);
assert.equal(records.length, 60);
for (const record of records) {
  const old = record.identity.generation;
  assert.equal(old.package.algorithmRevision, 2); assert(validR100ProductionRecipe(old));
  const restored = createR100ProductionMap(old), direct = frozenMap(old);
  assert.equal(checkpointChecksum(restored), checkpointChecksum(direct), 'entire structured-clone payload stays exact');
  assert.equal(generatedRiftIdentity(restored.layout, old, restored).signature, record.identity.signature, 'actual prior browser identity stays exact');
  const current = createR100ProductionRecipe(record.world, old.requestedSeed, record.grade);
  assert.equal(current.package.algorithmRevision, 5); assert.equal(current.contentDefinition.version, 2);
  assert(validR100ProductionRecipe(current));
  const forgedRevision = structuredClone(old); forgedRevision.package.algorithmRevision = 3;
  assert(!validR100ProductionRecipe(forgedRevision), 'old receipt cannot be relabelled');
  const forgedRules = structuredClone(old); forgedRules.contentDefinition.kindling_deep_value += 1;
  assert(!validR100ProductionRecipe(forgedRules), 'old frozen content remains integrity checked');
  const future = structuredClone(current); (future.package as { algorithmRevision: number }).algorithmRevision = current.package.algorithmRevision + 1;
  assert(!validR100ProductionRecipe(future), 'unknown executor cannot be accepted');
}
console.log('PASS 60 actual revision-2 browser identities and exact world payloads; revision-5/definition-2 selection; mutated/future rejection.');
