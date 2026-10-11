/** Frozen authoring behavior and unchanged inputs for worlds not yet migrated. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {R100_FRAGMENT_AUTHORING} from '../../src/generated/r100-fragment-data.ts';
import {R100_SPATIAL_SECTORS} from '../../src/generated/r100-spatial-data.ts';
import {createR100ProductionRecipe, validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {createR100ProductionRecipe as createR7Recipe} from '../../src/generation/legacy-r100-v7/executor-revision7.js';

const reportAt = process.argv.indexOf('--report');
const destination = reportAt >= 0 ? process.argv[reportAt + 1] : undefined;
if (destination) assert(!fs.existsSync(destination), 'Never overwrite historical evidence');
const seed = 20261011;
const migrated = new Set(R100_FRAGMENT_AUTHORING.map(row => row.worldId));
const geometryInputs = recipe => {
  const {sourceHash, ...policy} = recipe.spatialPolicy;
  return {native: recipe.nativeDefinition, policy, profile: recipe.profile, appearance: recipe.appearance,
    gradeDefinition: recipe.gradeDefinition, contentDefinition: recipe.contentDefinition};
};
let unchangedRecipes = 0;
for (const world of R100_NATIVE_WORLDS) if (!migrated.has(world.id)) for (const grade of ['low', 'medium', 'severe']) {
  assert.deepEqual(geometryInputs(createR100ProductionRecipe(world.id, seed, grade)), geometryInputs(createR7Recipe(world.id, seed, grade)), `Unmigrated geometry/content inputs changed: ${world.id}/${grade}`);
  unchangedRecipes++;
}
const r7 = createR7Recipe('cinder-ridge', seed, 'medium');
assert(validR100ProductionRecipe(r7));
const relabelled = structuredClone(r7); relabelled.package.algorithmRevision = 8;
assert(!validR100ProductionRecipe(relabelled), 'Relabelled r7 package accepted as r8');
function exactHash(value) {
  const digest = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) {digest.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)); return;}
    if (Array.isArray(item)) {digest.update(`array:${item.length}[`); for (const child of item) visit(child); digest.update(']'); return;}
    if (item && typeof item === 'object') {digest.update('{'); for (const key of Object.keys(item)) {visit(key); visit(item[key]);} digest.update('}'); return;}
    assert.notEqual(typeof item, 'function');
    const text = typeof item === 'undefined' ? 'undefined' : JSON.stringify(item);
    digest.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value); return digest.digest('hex');
}
const saved = createR100ProductionRecipe('cinder-ridge', seed, 'medium');
const receipt = JSON.stringify(saved);
let before = createR100ProductionMap(saved);
const expectedHash = exactHash(before);
before = null; global.gc?.();
const authoring = R100_FRAGMENT_AUTHORING.find(row => row.worldId === 'cinder-ridge');
const sector = R100_SPATIAL_SECTORS.find(row => row.worldId === 'cinder-ridge');
const originalLand = authoring.layout.landRects[0][0], originalSalt = authoring.seedSalt, originalPlacement = sector.placements[0].x;
let recoveredHash, futureIdentityChanged;
try {
  // Process-local future CSV/codegen simulation. No source files are modified.
  authoring.layout.landRects[0][0] += 8;
  authoring.seedSalt = (authoring.seedSalt + 1) >>> 0;
  sector.placements[0].x += 16;
  assert(validR100ProductionRecipe(saved), 'Saved recipe began consulting current authoring data');
  assert(validR100ProductionRecipe(r7), 'Old r7 validator began consulting current authoring data');
  assert.equal(JSON.stringify(saved), receipt, 'Saved snapshot aliases current authoring rows');
  const nextDeparture = createR100ProductionRecipe('cinder-ridge', seed, 'medium');
  futureIdentityChanged = nextDeparture.package.dependencyHash !== saved.package.dependencyHash;
  assert(futureIdentityChanged, 'New source did not change new departure identity');
  recoveredHash = exactHash(createR100ProductionMap(saved));
  assert.equal(recoveredHash, expectedHash, 'Frozen complete r8 map changed after current authoring mutation');
} finally {
  authoring.layout.landRects[0][0] = originalLand;
  authoring.seedSalt = originalSalt;
  sector.placements[0].x = originalPlacement;
}
assert.equal(JSON.stringify(createR100ProductionRecipe('cinder-ridge', seed, 'medium')), receipt, 'Authoring mutation was not restored');
const report = {status: 'passed', algorithmRevision: 8, unchangedWorldCount: R100_NATIVE_WORLDS.length - migrated.size, unchangedRecipeCount: unchangedRecipes,
  unchangedScope: 'Exact native/spatial geometry, grade, content, appearance and profile inputs; source receipt and package revision intentionally differ. Not full-map requalification of these worlds.',
  r7ValidAndRelabelTo8Rejected: true,
  authoringMutation: {scope: 'Process-local generated authoring rows simulate future CSV changes; no source file edits.', changed: ['land rectangle', 'edge seed salt', 'solid/relief placement'], savedR8AndR7RemainValid: true, futureIdentityChanged,
    savedInputUnchanged: true, fullMapHashBefore: expectedHash, fullMapHashAfter: recoveredHash, exactMapEqual: expectedHash === recoveredHash, originalAuthoringRestored: true},
  limitation: 'Browser cold continuation and frozen r7 rendering are covered by separate evidence.'};
if (destination) {fs.mkdirSync(path.dirname(destination), {recursive: true}); fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx'});}
console.log(JSON.stringify(report, null, 2));
