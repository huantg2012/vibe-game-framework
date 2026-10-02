/** Immutable v1 identities plus cold JSON reconstruction of condition worlds. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';
import { selectWorldProductionRecipe, validWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { mix32 } from '../../src/generation/seed-fork';
import type { WorldProductionMap } from '../../src/generation/world-study/production-map';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { createProceduralDeparture, proceduralRiftIdentity, restoreProceduralLayout, restoreProceduralWorld } =
  await import('../../src/managers/rift-recovery');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/world-generation-v1.json', 'utf8')) as {
  records: { identity: RiftCheckpoint['identity']; tileMapHash: string; hostMapHash: string; age: string }[];
};

/** Bake the real danger field and independently sweep the actual fine-grid body,
 * rather than trusting placement metadata or duplicating its margin-set helper. */
function assertPaintFreeRetreat(world: WorldProductionMap): void {
  const { layout } = world, danger = new Set<string>();
  const forms = layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing');
  for (const [slot, form] of forms.entries()) {
    const pin = layout.contaminationPins.paintFloors[slot]!;
    const seed = mix32(layout.seed, `ENM_BING_${String(slot + 1).padStart(2, '0')}`);
    const baked = bakePaintGenome({ substrate: form.substrate, coverage: form.coverage, seed,
      continuity: form.continuity, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId, veinVariant: resolvePaintVeinVariant(form.substrate, seed), geometryVersion: 2 });
    for (const cell of collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH,
      (pin.floorCol + .5) * 32, (pin.floorRow + .5) * 32, 32)) danger.add(`${cell.col},${cell.row}`);
  }
  assert(danger.size > 0, 'the clear retreat does not remove the paint quota');
  for (const node of [...layout.kindlingNodes, ...layout.contaminantNodes])
    assert(!danger.has(`${Math.floor(node.position.x / 32)},${Math.floor(node.position.y / 32)}`), `${node.id} intersects paint danger`);
  const points = world.metadata.semantic!.lowExposureRoute.points;
  assert(points.length > 1);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    for (let step = 0; step <= steps; step++) {
      const x = a.x + (b.x - a.x) * step / steps + 4, y = a.y + (b.y - a.y) * step / steps + 4;
      for (let row = Math.floor((y - 10) / 32); row <= Math.floor((y + 10 - 1e-6) / 32); row++)
        for (let col = Math.floor((x - 10) / 32); col <= Math.floor((x + 10 - 1e-6) / 32); col++)
          assert(!danger.has(`${col},${row}`), `swept retreat body meets paint danger at ${col},${row}`);
    }
  }
}

for (const saved of fixture.records) {
  const bytes = JSON.stringify(saved.identity), world = restoreProceduralWorld(json(saved.identity))!;
  assert.equal(saved.identity.generation!.version, 1);
  assert.equal(world.layout.paintGeometryVersion, 2);
  assert.equal(proceduralRiftIdentity(world.layout).signature, saved.identity.signature, 'v1 gold identity must remain unchanged');
  assert.equal(checkpointChecksum(world.layout.tileMap), saved.tileMapHash);
  assert.equal(checkpointChecksum(world.hostTileMap), saved.hostMapHash);
  assert.equal(world.layout.contaminationAge, saved.age);
  assert.equal(world.metadata.conditions, undefined, 'old world must not acquire new conditions');
  assert.equal(JSON.stringify(saved.identity), bytes, 'restore cannot migrate the original identity');
}

for (const version of [0, 3, '2', null]) {
  const candidate = { ...selectWorldProductionRecipe(0), version };
  assert(!validWorldProductionRecipe(candidate), 'unknown generation versions reject instead of falling back');
}
const invalid = selectWorldProductionRecipe(0);
assert.equal(invalid.version, 2);
assert(!validWorldProductionRecipe({ ...invalid, conditions: undefined }));
assert(!validWorldProductionRecipe({ ...invalid, paintGeometryVersion: 1 }));
assert(!validWorldProductionRecipe({ ...invalid, requestedSeed: 1 }));

const seeds = [0, 5, 70421];
let at = 0;
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
  getRandomValues(values: Uint32Array): Uint32Array { values[0] = seeds[at++]!; return values; },
} });
const records: { identity: RiftCheckpoint['identity']; tileMapHash: string; hostMapHash: string }[] = [];
try {
  for (const seed of seeds) {
    const identity = createProceduralDeparture(), world = restoreProceduralWorld(identity)!;
    assert.equal(identity.generation!.version, 2, 'new departures must use condition generation');
    assert.equal(identity.generation!.requestedSeed, seed);
    assert(world.metadata.conditions && world.metadata.semantic, 'conditions and semantic admission reach the production map');
    assert.equal(world.sample.materialSeed, world.metadata.conditions.streams.material);
    assert.equal(world.layout.kindlingNodes.length, 8);
    assert.equal(world.layout.contaminantNodes.length, 3);
    assert.equal(world.layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
    for (const node of world.metadata.semantic.nodes.filter(node => node.tier === 'deep')) {
      assert.equal(node.costBasis, 'interaction-area', 'formal deployment must consume the actual fine terrain');
      assert(node.interactionSeats && node.interactionSeats > 0);
      assert(node.extraTravelPx >= world.metadata.conditions.semantic.minimumDeepDetourPx);
    }
    assertPaintFreeRetreat(world);
    records.push({ identity: json(identity), tileMapHash: checkpointChecksum(world.layout.tileMap),
      hostMapHash: checkpointChecksum(world.hostTileMap) });
    console.log(`v2 requested=${seed} admitted=${world.layout.seed} signature=${identity.signature} attempt=${world.metadata.attempt}`);
  }
} finally {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else Reflect.deleteProperty(globalThis, 'crypto');
}
// Every departure evicts its predecessor. Reconstruction cannot pass by reusing
// the mutable objects which happened to exist when the record was created.
for (const saved of records) {
  const bytes = JSON.stringify(saved.identity), world = restoreProceduralWorld(json(saved.identity))!;
  assert.equal(proceduralRiftIdentity(world.layout).signature, saved.identity.signature);
  assert.equal(checkpointChecksum(world.layout.tileMap), saved.tileMapHash);
  assert.equal(checkpointChecksum(world.hostTileMap), saved.hostMapHash);
  assert.equal(JSON.stringify(saved.identity), bytes);
  const changed = json(saved.identity);
  assert.equal(changed.generation!.version, 2);
  if (changed.generation?.version !== 2) throw Error('Expected frozen v2 identity');
  changed.generation = { ...changed.generation, conditions: { ...changed.generation.conditions,
    streams: { ...changed.generation.conditions.streams, material: changed.generation.conditions.streams.material ^ 1 } } };
  assert.throws(() => restoreProceduralLayout(changed), 'a changed stream must not hydrate the old runtime');
  const downgraded = json(saved.identity);
  const { conditions: _conditions, ...previous } = changed.generation;
  downgraded.generation = { ...previous, version: 1 };
  assert.throws(() => restoreProceduralLayout(downgraded), 'an old signature cannot authorize a different generation version');
}
console.log(`PASS generation versions: ${fixture.records.length} immutable v1 complete-paint identities, ${records.length} cold v2 JSON reconstructions; full-body retreat and all eleven resource seats free of real paint danger; bad/missing contracts and version/stream tampering rejected.`);
