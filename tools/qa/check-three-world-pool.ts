/** Departure admission only: no terrain generation, user saves or browser. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { R100_NATIVE_WORLDS as catalog } from '../../src/generated/r100-native-worlds';
import { createR100ProductionRecipe, selectR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { r100WorldSelectionWeights, selectR100WorldId } from '../../src/generation/world-study/r100-world-selection';
import type { RiftWorldHistory } from '../../src/types/rift-world-history';

const allowed = ['cinder-ridge', 'crystal-fibre', 'ruptured-film'];
const grades = ['low', 'medium', 'severe'] as const;
const seed = 20261012;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot() {
  const recipes = Object.fromEntries(catalog.flatMap(world => grades.map(grade => {
    const recipe = createR100ProductionRecipe(world.id, seed, grade);
    assert(validR100ProductionRecipe(recipe), `${world.id}/${grade}: frozen recipe rejected`);
    return [`${world.id}/${grade}`, hash(recipe)];
  })));
  const definitions = Object.fromEntries(catalog.map(({ enabled: _enabled, ...world }) => [world.id, hash(world)]));
  return { seed, definitions, recipes };
}
const current = snapshot();
const snapshotIndex = process.argv.indexOf('--snapshot');
if (snapshotIndex >= 0) {
  writeFileSync(process.argv[snapshotIndex + 1]!, JSON.stringify(current, null, 2) + '\n');
  console.log('Saved 108-world / 324-recipe pre-admission snapshot');
} else {
  assert.equal(catalog.length, 108);
  assert.deepEqual(catalog.filter(world => world.enabled).map(world => world.id).sort(), allowed);
  const locked = catalog.filter(world => !world.enabled);
  assert.equal(locked.length, 105);
  const beforeIndex = process.argv.indexOf('--before');
  if (beforeIndex >= 0) assert.deepEqual(current, JSON.parse(readFileSync(process.argv[beforeIndex + 1]!, 'utf8')), 'Admission edit changed world definitions or frozen recipe identity');

  // This in-memory negative control proves admission is absent from recipe identity.
  const flags = catalog.map(world => world.enabled);
  try {
    for (const world of catalog) (world as { enabled: boolean }).enabled = !world.enabled;
    assert.deepEqual(snapshot(), current, 'Enabled flags contaminated frozen recipe identity');
  } finally {
    catalog.forEach((world, index) => { (world as { enabled: boolean }).enabled = flags[index]!; });
  }

  const seen = new Set<string>();
  for (let index = 0; index < 128; index++) {
    const history: RiftWorldHistory = { version: 1, visits: Array.from({ length: 8 }, (_, age) => ({
      worldId: locked[(index + age) % locked.length]!.id, grade: grades[age % grades.length]!,
    })) };
    assert.deepEqual(r100WorldSelectionWeights(history).map(row => row.worldId), allowed);
    const selected = selectR100WorldId(index, history);
    assert(allowed.includes(selected)); seen.add(selected);
    assert.equal(selectR100WorldId(index, history, [...catalog].reverse()), selected);
    for (const grade of grades) {
      const recipe = selectR100ProductionRecipe(index, grade, history);
      assert.equal(recipe.package.id, `r100-${selected}`, 'Pollution grade leaked a different world pool');
      assert.equal(recipe.package.grade, grade);
    }
  }
  assert.deepEqual([...seen].sort(), allowed);
  console.log(JSON.stringify({ pass: true, enabled: allowed, disabled: locked.length, preservedRecipes: Object.keys(current.recipes).length,
    gradeSelections: 384, reversedCatalogCases: 128, checks: ['locked history cannot reopen worlds', 'all grades share pool', 'recipe and definition identity independent of enabled', ...(beforeIndex >= 0 ? ['pre/post catalog change exact digest match'] : [])] }));
}
