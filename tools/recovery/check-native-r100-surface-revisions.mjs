/** Reject unsupported package/map/surface revisions before geometry allocation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createR100ProductionRecipe as createRevision6Recipe } from '../../src/generation/legacy-r100-v6/executor.js';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { bakeMasterWorldSurface } from '../../src/systems/r100-world/surface-bake.ts';
const arg = process.argv.indexOf('--report'); assert(arg >= 0 && process.argv[arg + 1], '--report required');
const report = process.argv[arg + 1]; assert(!existsSync(report), 'Never overwrite earlier evidence');
const unknown = [null, 0, 8, 99, '7', 7.1, true, NaN, Infinity];
const cases = []; let failure;
try {
  for (const recipe of [createRevision6Recipe('cinder-ridge', 20261010, 'medium'), createR100ProductionRecipe('quiet-spur', 20261010, 'medium')]) {
    assert(validR100ProductionRecipe(recipe));
    for (const revision of unknown) {
      const forged = structuredClone(recipe); forged.package.algorithmRevision = revision;
      assert(!validR100ProductionRecipe(forged));
      assert.throws(() => createR100ProductionMap(forged), /Invalid or unavailable/);
      assert.throws(() => bakeMasterWorldSurface({ algorithmRevision: revision, appearance: recipe.appearance }), /Unknown native surface algorithm revision/);
    }
    const missing = structuredClone(recipe); delete missing.package.algorithmRevision;
    assert(!validR100ProductionRecipe(missing));
    assert.throws(() => createR100ProductionMap(missing), /Invalid or unavailable/);
    const relabelled = structuredClone(recipe); relabelled.package.algorithmRevision = recipe.package.algorithmRevision === 6 ? 7 : 6;
    assert(!validR100ProductionRecipe(relabelled), 'Revision relabelling cannot migrate a saved contract');
    assert.throws(() => createR100ProductionMap(relabelled), /Invalid or unavailable/);
    cases.push({ world: recipe.appearance.worldId, sourceRevision: recipe.package.algorithmRevision,
      unsupportedValues: unknown.map(value => ({ type: typeof value, display: String(value) })),
      missingPackageRevisionRejected: true, crossRevisionRelabellingRejected: true });
  }
  for (const revision of [5, 6, 7]) for (const appearance of [undefined, null]) {
    assert.throws(() => bakeMasterWorldSurface({ algorithmRevision: revision, appearance }), /requires frozen appearance/);
  }
  const incomplete = createR100ProductionRecipe('quiet-spur', 20261010, 'medium'); delete incomplete.spatialPolicy;
  assert(!validR100ProductionRecipe(incomplete));
  assert.throws(() => createR100ProductionMap(incomplete), /Invalid or unavailable/);
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
const sources = ['src/generation/world-study/r100-package.ts', 'src/generation/world-study/r100-production-map.ts',
  'src/generation/legacy-r100-v6/executor-recovery.js', 'src/generation/world-study/native-volume-erosion.ts',
  'src/systems/r100-world/surface-bake.ts', 'src/generated/r100-spatial-data.ts', 'src/generated/r100-package-manifest.ts',
  'tools/recovery/check-native-r100-surface-revisions.mjs']
  .map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
mkdirSync(dirname(report), { recursive: true }); writeFileSync(report, JSON.stringify({ status: failure ? 'failed' : 'pass', cases, failure,
  explicitAppearanceRequired: [5, 6, 7], missingRevision7SpatialPolicyRejected: true, sources,
  legacyNote: 'Undefined MasterWorld algorithmRevision remains valid only for original appearance-based revision3/4 surface dispatch; package algorithmRevision is always required.',
  scope: 'Boundary rejection before terrain/surface allocation, covering r6 and authored-group r7 recipes. This is not successful full surface equivalence or WebGL qualification.' }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw new Error(failure);
console.log('PASS r6/r7 unsupported package/map/surface revisions, revision relabelling and missing frozen appearance/policy');
