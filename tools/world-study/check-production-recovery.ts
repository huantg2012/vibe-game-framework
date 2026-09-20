/** New departures freeze their recipe; old active worlds keep the old generator. */
import assert from 'node:assert/strict';
import { WORLD_PROFILE_DATA } from '../../src/generated/rift-world-profile-data';
import { WORLD_SPACE_DATA } from '../../src/generated/rift-world-space-data';
import { selectWorldProductionRecipe, validWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { checkpointChecksum, validRiftDeparture } from '../../src/types/rift-checkpoint';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { createProceduralDeparture, proceduralRiftIdentity, restoreProceduralLayout, restoreProceduralWorld } = await import('../../src/managers/rift-recovery');
const seen = new Set<string>();
for (let seed = 0; seed < 256; seed++) {
  const recipe = selectWorldProductionRecipe(seed);
  assert(validWorldProductionRecipe(recipe));
  seen.add(`${recipe.profile.id}/${recipe.space.id}`);
}
assert.equal(seen.size, WORLD_PROFILE_DATA.length * WORLD_SPACE_DATA.length, 'every configured combination is selectable');
const records = [];
for (let index = 0; index < 5; index++) {
  const identity = createProceduralDeparture(), world = restoreProceduralWorld(identity)!;
  assert(identity.generation, 'formal departure must select the new world generator');
  assert.equal(world.layout.tileMap.tileSize, 8);
  assert.equal(world.hostTileMap.tileSize, 32);
  assert.equal(world.layout.kindlingNodes.length, 8);
  assert.equal(world.layout.contaminantNodes.length, 3);
  assert.equal(world.layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
  assert(validRiftDeparture({ version: 1, runId: `world-${index}`, identity,
    conditions: { cycle: 1, modifiers: { chaosRateModifier: 1, kindlingValueModifier: 1, startingChaos: 0 } } }));
  records.push({ identity: structuredClone(identity), shape: checkpointChecksum(world.layout.tileMap),
    host: checkpointChecksum(world.hostTileMap) });
}
// createDeparture evicts each preceding cache entry. JSON restore must reconstruct,
// not rely on the objects which happened to be resident during the departure.
for (const record of records) {
  const before = JSON.stringify(record.identity), restored = restoreProceduralWorld(record.identity)!;
  assert.equal(checkpointChecksum(restored.layout.tileMap), record.shape);
  assert.equal(checkpointChecksum(restored.hostTileMap), record.host);
  assert.equal(proceduralRiftIdentity(restored.layout).signature, record.identity.signature);
  assert.equal(JSON.stringify(record.identity), before);
  const recolored = structuredClone(record.identity); recolored.generation!.profile.palette.floor ^= 0xff;
  assert.throws(() => restoreProceduralLayout(recolored), 'recipe tampering must not pass under a stale signature');
  const geometry = structuredClone(record.identity); geometry.generation!.space.voidFraction = .17;
  assert.throws(() => restoreProceduralLayout(geometry), 'space changes cannot silently replace an in-flight map');
  const malformed = structuredClone(record.identity); malformed.generation!.requestedSeed = -1;
  assert(!validWorldProductionRecipe(malformed.generation));
  assert.throws(() => restoreProceduralLayout(malformed));
}
console.log('PASS production selection/recovery: all 10 CSV choices reachable; 5 formal departures preserve 8+3 content/one hearing; evicted JSON reconstruction; recipe/geometry/seed corruption rejected. This is wiring coverage, not long-term sampling.');
