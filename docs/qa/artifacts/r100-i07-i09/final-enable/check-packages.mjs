/** Read-only recipe comparison around the authorized enabled-only catalog edit.
 * No maps, browser, player save or game state is created or changed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { R100_NATIVE_WORLDS } from '../../../../../src/generated/r100-native-worlds.ts';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../../../../src/generation/world-study/r100-package.ts';

const mode = process.argv[2];
assert(['before', 'after'].includes(mode));
const base = new URL('./', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['data/rift-native-worlds.csv', 'src/generated/r100-native-worlds.ts',
  'src/generated/r100-package-manifest.ts', 'src/generation/world-study/r100-package.ts'];
const snapshot = {
  sourceHashes: Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))])),
  worlds: R100_NATIVE_WORLDS.map(row => ({ id: row.id, enabled: row.enabled })),
  recipes: R100_NATIVE_WORLDS.flatMap(world => ['low', 'medium', 'severe'].map(grade => ({
    worldId: world.id, grade, recipe: createR100ProductionRecipe(world.id, 20261005, grade),
  }))),
};
assert.equal(snapshot.worlds.length, 52);
assert(snapshot.recipes.every(row => row.recipe.package.algorithmRevision === 5 && validR100ProductionRecipe(row.recipe)));
if (mode === 'before') {
  assert.equal(snapshot.worlds.filter(row => row.enabled).length, 20);
  fs.writeFileSync(new URL('before.json', base), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(new URL('native-before.csv', base), fs.readFileSync(files[0]), { flag: 'wx' });
  console.log('PASS before activation: 20 enabled / 52 authored, 156 valid revision5 recipes saved');
} else {
  const before = JSON.parse(fs.readFileSync(new URL('before.json', base), 'utf8'));
  assert(snapshot.worlds.every(row => row.enabled));
  assert.deepEqual(snapshot.worlds.map(row => row.id), before.worlds.map(row => row.id));
  assert.deepEqual(snapshot.recipes, before.recipes, 'Enabled-only compilation must preserve every complete recipe and its dependency hash');
  assert(before.recipes.every(row => validR100ProductionRecipe(row.recipe)), 'Every pre-enable recipe must remain admissible');
  assert.equal(snapshot.sourceHashes[files[3]], before.sourceHashes[files[3]], 'No runtime package logic edit');
  const oldLines = fs.readFileSync(new URL('native-before.csv', base), 'utf8').split('\n');
  const newLines = fs.readFileSync(files[0], 'utf8').split('\n');
  assert.equal(newLines.length, oldLines.length);
  const at = oldLines[0].split(',').indexOf('enabled'); assert(at >= 0);
  let changes = 0;
  for (let index = 0; index < oldLines.length; index++) {
    if (oldLines[index] === newLines[index]) continue;
    const expected = oldLines[index].split(','); assert.equal(expected[at], 'false');
    expected[at] = 'true'; assert.equal(newLines[index], expected.join(',')); changes++;
  }
  assert.equal(changes, 32);
  const report = { status: 'pass-enabled-only-recipe-compatibility', beforeEnabled: 20, afterEnabled: 52,
    changedCsvFields: changes, old20GradeRecipesExact: 60, all52GradeRecipesExact: 156,
    preEnableRecipesStillValid: 156, sourceHashesBefore: before.sourceHashes, sourceHashesAfter: snapshot.sourceHashes,
    scope: 'Exact full recipe JSON and dependency hash plus production validator; no new map, browser recovery, visual or performance claim.' };
  fs.writeFileSync(new URL('report.json', base), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
}
