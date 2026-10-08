/** Formal selector distribution is unchanged while execution is version-bound. */
import assert from 'node:assert/strict';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { selectWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { restoreLegacyProductionWorld } from '../../src/generation/legacy-rift-generation';
import { legacyGenerationGold } from './legacy-generation-gold';

const seeds = [...Array.from({ length: 16 }, (_, index) => index), 70421, 0xffffffff];
const worlds = new Set<string>();
let admitted = 0, rejected = 0;
for (const seed of seeds) {
  const recipe = selectWorldProductionRecipe(seed);
  assert.equal(recipe.version, 2);
  if (recipe.version !== 2) throw new Error('Current formal selection changed: replace this baseline only with a version migration review');
  worlds.add(recipe.profile.id);
  const oldBytes = JSON.stringify(recipe);
  const attempt = (generate: () => ReturnType<typeof restoreLegacyProductionWorld>) => {
    try { const world = generate(); return { ok: true, result: legacyGenerationGold(world.layout, world) }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
  };
  const live = attempt(() => createWorldProductionMap(recipe.profile, recipe.space, recipe.requestedSeed, {
    contentFragmentTypeId: recipe.contentFragmentTypeId, paintGeometryVersion: 2,
    generationVersion: 2, conditions: recipe.conditions, fallbackSeeds: recipe.conditions.fallbackSeeds,
  }));
  const frozen = attempt(() => restoreLegacyProductionWorld(recipe));
  assert.deepEqual(frozen, live, `formal selector seed ${seed} changed on dispatch migration`);
  assert.equal(JSON.stringify(recipe), oldBytes);
  if (frozen.ok) admitted++; else rejected++;
}
assert.equal(worlds.size, 5, 'the natural seed sample must cover all five existing worlds');
console.log(`PASS v2 dispatch equivalence: ${seeds.length} natural seeds, ${worlds.size} worlds, ${admitted} admissions and ${rejected} preserved failures; full layout/sample/Host/metadata SHA256`);
