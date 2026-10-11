/** Public live dispatch must preserve the already verified immutable r7 oracle. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import * as original from '../../src/generation/legacy-r100-v7/executor.js';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map.ts';
import { validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { bakeMasterWorldSurface } from '../../src/systems/r100-world/surface-bake.ts';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data.ts';

const directory = 'src/generation/legacy-r100-v7';
const manifest = JSON.parse(readFileSync(`${directory}/manifest-recovery.json`, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = path => ({ path, sha256: sha(readFileSync(path)) });
const flag = process.argv.indexOf('--report');
assert(flag >= 0 && process.argv[flag + 1], '--report required');
const report = process.argv[flag + 1];
assert(!existsSync(report), 'Never overwrite earlier evidence');
const seed = 20261010;
const rows = [ ['cinder-ridge','low'], ['cinder-ridge','medium'], ['cinder-ridge','severe'], ['quiet-spur','medium'] ];
const grades = ['low', 'medium', 'severe'];
const allRows = manifest.projection.ids.flatMap(id => grades.map(grade => [id, grade]));
const selected = process.argv.includes('--full') ? allRows : rows;
const assetReceipt = JSON.parse(readFileSync(`${directory}/assets.json`, 'utf8'));
for (const asset of assetReceipt.assets) assert.equal(sha(readFileSync(asset.path)), asset.sha256);
const getHistorical = path => {
  const result = spawnSync('git', ['show', `${manifest.sourceRevision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout.toString();
};
const historicalArray = (path, name) => JSON.parse(getHistorical(path).match(new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`))[1]);
const materialRows = historicalArray('src/generated/r100-materials.ts', 'PAINTED_MATERIALS');
const organizationRows = historicalArray('src/generated/r100-material-organizations.ts', 'ORGANIZATION_MATERIALS');
/** Framed values avoid allocating multi-hundred-MiB JSON/base64 copies. */
function exactHash(value) {
  const hash = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) { hash.update(`typed:${item.constructor.name}:${item.byteLength}:`); hash.update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)); return; }
    if (Array.isArray(item)) { hash.update(`array:${item.length}[`); for (const child of item) visit(child); hash.update(']'); return; }
    if (item instanceof Map) { hash.update(`map:${item.size}[`); for (const [key, child] of item) { visit(key); visit(child); } hash.update(']'); return; }
    if (item && typeof item === 'object') { hash.update('{'); for (const key of Object.keys(item)) { visit(key); visit(item[key]); } hash.update('}'); return; }
    assert.notEqual(typeof item, 'function', 'Serialized payload must not contain functions');
    const text = typeof item === 'undefined' ? 'undefined' : JSON.stringify(item);
    hash.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value); return hash.digest('hex');
}
const paintings = new Map();
async function painting(definition) {
  if (paintings.has(definition.source)) return paintings.get(definition.source);
  const decode = async source => ({ width: source.logical_pixels, height: source.logical_pixels,
    worldSize: source.world_size, source: source.source, regions: source.regions,
    pixels: new Uint8ClampedArray(await sharp(`public${source.source}`).resize(source.logical_pixels, source.logical_pixels).ensureAlpha().raw().toBuffer()) });
  const result = { ...await decode(definition), solid: { ...await decode(definition.solid),
    skinRoughness: definition.solid.skinRoughness, cutRoughness: definition.solid.cutRoughness,
    gain: definition.solid.gain, cutGain: definition.solid.cutGain } };
  paintings.set(definition.source, result); return result;
}
async function recipePainting(recipe) {
  const main = recipe.nativeDefinition.family;
  const mainDefinition = recipe.appearance?.materialOrganization
    ? organizationRows.find(row => row.organization === recipe.appearance.materialOrganization)
    : materialRows.find(row => row.family === main);
  assert(mainDefinition);
  const primary = await painting(mainDefinition), families = {};
  for (const family of new Set([main, ...recipe.nativeDefinition.instances.map(row => row.family ?? main)])) {
    families[family] = family === main ? primary : await painting(materialRows.find(row => row.family === family));
  }
  return { ...primary, families, appearance: recipe.appearance };
}
const referencePath = process.env.QA_REFERENCE ?? 'docs/qa/artifacts/r100-fragment-rollout-2026-10-11/revision7-freeze.json';
const reference = JSON.parse(readFileSync(referencePath, 'utf8'));
assert.equal(reference.status, 'pass');
assert.equal(reference.sourceRevision, manifest.sourceRevision);
assert.equal(reference.checkedRecipes, 324);
for (const executor of reference.executors) assert.equal(sha(readFileSync(executor.path)), executor.sha256, 'Historical oracle reference is stale');
const livePaths = [
  'src/generation/world-study/r100-package.ts',
  'src/generation/world-study/r100-production-map.ts',
  'src/systems/r100-world/surface-bake.ts',
  'src/generation/world-study/r100-native-data.ts',
];
const liveBefore = livePaths.map(receipt);
const cases = [];
let checkedRecipes = 0, failure;
try {
  for (const [id, grade] of allRows) {
    const recipe = original.createR100ProductionRecipe(id, seed, grade);
    assert(validR100ProductionRecipe(recipe), `${id}/${grade}: live validator rejected historical r7`);
    checkedRecipes++;
  }
  for (const [id, grade] of selected) {
    const expected = reference.cases.find(row => row.world === id && row.grade === grade && row.seed === seed);
    assert(expected, `${id}/${grade}: no completed immutable equality reference`);
    const recipe = original.createR100ProductionRecipe(id, seed, grade), material = await recipePainting(recipe);
    assert.equal(exactHash(recipe), expected.recipeHash, 'Historical fixture differs from completed oracle');
    const started = performance.now(), world = createR100ProductionMap(recipe);
    const surface = bakeMasterWorldSurface(hydrateR100MasterWorld(world.native, world.layout), material);
    const actual = {
      payloadHash: exactHash(world), layoutHash: exactHash(world.layout), nativeHash: exactHash(world.native),
      rgba: Object.fromEntries(['albedo', 'normal', 'response', 'emission'].map(key => [key, sha(surface[key])])),
    };
    for (const key of ['payloadHash', 'layoutHash', 'nativeHash', 'rgba']) assert.deepEqual(actual[key], expected.results[0][key], `${id}/${grade}: live ${key} changed`);
    cases.push({world: id, grade, seed, terrainOutlineVertices: expected.terrainOutlineVertices,
      recipeHash: exactHash(recipe), ...actual, elapsedMs: Math.round(performance.now() - started)});
    console.log(`PASS public r7 map and four RGBA: ${id}/${grade}`);
    global.gc?.();
  }
  assert.deepEqual(livePaths.map(receipt), liveBefore, 'Live route sources changed during verification');
} catch(error) { failure = error instanceof Error ? error.stack : String(error); }
mkdirSync(dirname(report), { recursive: true });
writeFileSync(report, JSON.stringify({status: failure ? 'failed' : 'pass', sourceRevision: manifest.sourceRevision,
  checkedRecipes, plannedCases: selected.length, cases, failure, liveSources: liveBefore,
  reference: receipt(referencePath), immutableExecutor: receipt(`${directory}/executor-recovery.js`),
  harness: receipt('tools/recovery/check-native-r100-revision7-live.mjs'),
  hashSchema: 'framed values and raw typed-array bytes v1; exact own fields, no identity exclusions',
  scope: 'Public live validator/map/surface routes versus completed immutable r7 oracle hashes; 324 old recipes and 4 full-map/four-RGBA cases. No new r8 map qualification or browser cold recovery.'}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error(failure);
console.log(`PASS ${checkedRecipes} historical r7 recipes and ${cases.length} public-route map/surface cases.`);
