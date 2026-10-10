/** Exact archived r6 contract coverage. New r7 qualification is a separate gate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import * as original from '../../src/generation/legacy-r100-v6/executor.js';
import * as derivative from '../../src/generation/legacy-r100-v6/executor-revision6.js';
import * as projected from '../../src/generation/legacy-r100-v6/executor-recovery.js';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data.ts';

const directory = 'src/generation/legacy-r100-v6';
const manifest = JSON.parse(readFileSync(`${directory}/manifest-recovery.json`, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = path => ({ path, sha256: sha(readFileSync(path)) });
const flag = process.argv.indexOf('--report');
assert(flag >= 0 && process.argv[flag + 1], '--report required');
const report = process.argv[flag + 1];
assert(!existsSync(report), 'Never overwrite earlier evidence');
const seed = 20261010;
const rows = [ ['ash-strata','low'], ['crystal-fibre','medium'], ['ivory-basin','severe'],
  ['cinder-ridge','medium'], ['tension-membrane','low'], ['gel-rafts','severe'],
  ['short-fibre-mat','medium'], ['marrow-break','severe'] ];
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
const cases = [];
let checkedRecipes = 0, failure;
try {
  for (const [id, grade] of allRows) {
    const recipe = original.createR100ProductionRecipe(id, seed, grade);
    assert.deepEqual(derivative.createR100ProductionRecipe(id, seed, grade), recipe, `${id}/${grade} exact frozen recipe`);
    assert(original.validR100ProductionRecipe(recipe)); assert(derivative.validR100ProductionRecipe(recipe)); assert(projected.validR100ProductionRecipe(recipe));
    checkedRecipes++;
  }
  const invalid = original.createR100ProductionRecipe('cinder-ridge', seed, 'medium');
  for (const revision of [undefined, null, 0, 1, 2, 3, 4, 5, 7, '6']) {
    const recipe = structuredClone(invalid); recipe.package.algorithmRevision = revision;
    assert(!projected.validR100ProductionRecipe(recipe));
    assert.throws(() => projected.createR100ProductionMap(recipe), /Invalid or unavailable/);
    assert.throws(() => projected.bakeMasterWorldSurface({ algorithmRevision: revision, appearance: recipe.appearance }), /Revision 6 surface requires/);
  }
  for (const [id, grade] of selected) {
    const recipe = original.createR100ProductionRecipe(id, seed, grade), material = await recipePainting(recipe);
    const results = [];
    for (const [name, executor] of [['original',original],['derivative',derivative],['projected',projected]]) {
      const started = performance.now(), world = executor.createR100ProductionMap(recipe);
      const payloadHash = exactHash(world), layoutHash = exactHash(world.layout), nativeHash = exactHash(world.native);
      const surface = executor.bakeMasterWorldSurface(hydrateR100MasterWorld(world.native, world.layout), material);
      const rgba = Object.fromEntries(['albedo','normal','response','emission'].map(key => [key,sha(surface[key])]));
      const entry = { name, payloadHash, layoutHash, nativeHash, rgba, elapsedMs: Math.round(performance.now()-started) };
      if (results.length) for (const key of ['payloadHash','layoutHash','nativeHash','rgba']) assert.deepEqual(entry[key],results[0][key],`${id}/${grade}/${name}: exact ${key}`);
      results.push(entry);
      global.gc?.();
    }
    cases.push({ world: id, grade, seed, family:recipe.nativeDefinition.family, organization:recipe.appearance?.materialOrganization,
      constructionVersions:[...new Set(recipe.nativeDefinition.instances.map(row=>row.constructionVersion??1))], recipeHash:exactHash(recipe), results });
    console.log(`PASS r6 exact payload/layout/native/four-RGBA: ${id}/${grade}`);
  }
} catch(error) { failure = error instanceof Error ? error.stack : String(error); }
mkdirSync(dirname(report), { recursive: true });
writeFileSync(report, JSON.stringify({ status:failure?'failed':'pass', sourceRevision:manifest.sourceRevision,
  checkedRecipes, plannedCases:selected.length, cases, failure, executors:['executor.js','executor-revision6.js','executor-recovery.js'].map(file=>receipt(`${directory}/${file}`)),
  assets:receipt(`${directory}/assets.json`), harness:receipt('tools/recovery/check-native-r100-revision6.mjs'),
  hashSchema:'framed values and raw typed-array bytes v1; exact fields with no identity exclusions',
  scope:'Revision6 compatibility only; immutable source recipes and exact three-executor payload/RGBA equality. Shared PNG pixels decoded using sharp; not browser image-decoder or revision7 gameplay qualification.' }, null, 2)+'\n', {flag:'wx'});
if(failure) throw new Error(failure);
console.log(`PASS ${checkedRecipes} r6 recipes; ${cases.length} exact payload/4-RGBA cases.`);
