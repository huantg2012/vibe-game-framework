import { createLegacyV2Departure } from './legacy-departure-helper';
/** A fresh process owns no recovery cache. Also bundled against poisoned live generators. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyGenerationGold } from './legacy-generation-gold';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';
import { checkpointChecksum, validRiftCheckpoint } from '../../src/types/rift-checkpoint';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { restoreProceduralWorld, restoreProceduralLayout, proceduralRiftIdentity } =
  await import('../../src/managers/rift-recovery');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const mode = process.argv[2]!, index = Number(process.argv[3]);
if (mode === 'v1') {
  const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/world-generation-v1.json', 'utf8'));
  const record = fixture.records[index], identity = record.identity as RiftCheckpoint['identity'];
  assert(validRiftCheckpoint({ version: 1, runId: 'cold-old', sequence: 0, elapsedMs: 0, state: {}, identity }));
  const before = JSON.stringify(identity), world = restoreProceduralWorld(identity)!;
  assert.equal(proceduralRiftIdentity(world.layout).signature, identity.signature);
  assert.equal(checkpointChecksum(world.layout.tileMap), record.tileMapHash);
  assert.equal(checkpointChecksum(world.hostTileMap), record.hostMapHash);
  assert.equal(JSON.stringify(identity), before);
  console.log(`PASS cold v1 ${index}: original identity, terrain and Host geometry`);
} else {
  const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/legacy-generation-gold.json', 'utf8'));
  const record = fixture.records[index], identity = record.identity as RiftCheckpoint['identity'];
  assert(validRiftCheckpoint({ version: 1, runId: 'cold-old', sequence: 0, elapsedMs: 0, state: {}, identity }));
  const before = JSON.stringify(identity), layout = restoreProceduralLayout(identity), world = restoreProceduralWorld(identity);
  const { id: _id, identity: _identity, ...expected } = record;
  assert.deepEqual(legacyGenerationGold(layout, world), expected, 'all generated fields must match pre-R100 code');
  assert.equal(proceduralRiftIdentity(layout).signature, identity.signature);
  assert.equal(JSON.stringify(identity), before, 'recovery must not migrate frozen promises');
  assert.throws(() => restoreProceduralLayout({ ...identity, signature: 'tampered' }));
  if (record.id === 'v2-0') {
    // Fixed FNV-1a collision found by the independent reviewer. The historical
    // short cache key used to return an already-cached v2 layout for version 3.
    const collision = { ...identity, generation: { ...identity.generation!, version: 3, n0: '\u3f2c\u6c7f' } };
    assert.equal(checkpointChecksum(collision.generation), checkpointChecksum(identity.generation));
    assert(!validRiftCheckpoint({ version: 1, runId: 'cache-collision', sequence: 0, elapsedMs: 0, state: {}, identity: collision }));
    assert.throws(() => restoreProceduralLayout(collision as unknown as RiftCheckpoint['identity']),
      'cache hits cannot bypass version admission, even with a colliding legacy checksum');
  }
  if (identity.generation) {
    for (const patch of [{ version: 3 }, { version: '2' }, { conditions: undefined }, { requestedSeed: -1 },
      { profile: { ...identity.generation.profile, material: 'unknown' } }]) {
      const corrupt = { ...json(identity), generation: { ...json(identity.generation), ...patch } };
      assert(!validRiftCheckpoint({ version: 1, runId: 'bad', sequence: 0, elapsedMs: 0, state: {}, identity: corrupt }));
      assert.throws(() => restoreProceduralLayout(corrupt as RiftCheckpoint['identity']));
    }
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
      getRandomValues(values: Uint32Array) { values[0] = identity.generation!.requestedSeed; return values; },
    } });
    try {
      const departure = createLegacyV2Departure();
      assert.equal(departure.signature, identity.signature, 'new v2 uses the same immutable executor as recovery');
      assert.equal(departure.generation?.version, 2);
    } finally { if (original) Object.defineProperty(globalThis, 'crypto', original); }
  }
  console.log(`PASS cold ${record.id}: full world SHA256, input preservation, corruption rejection and matching departure`);
}
