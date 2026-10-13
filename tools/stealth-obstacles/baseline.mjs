/** Capture before authoring; replay the exact old recipes after CSV changes.
 * No map mutation and no replacement seed. Run with the repository's tsx alias config. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {serialize, deserialize} from 'node:v8';
import {gzipSync, gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {createR100ProductionRecipe, validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {bakeMasterWorldSurface} from '../../src/systems/r100-world/surface-bake.ts';
import {bakeSearchSitePatches} from '../../src/systems/r100-world/search-site-bake.ts';
import {applySearchSitePatch} from '../../src/systems/r100-world/search-site-patches.ts';
import {PAINTED_MATERIALS} from '../../src/generated/r100-materials.ts';
import {ORGANIZATION_MATERIALS} from '../../src/generated/r100-material-organizations.ts';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function exactHash(value) {
  const hash = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) {
      hash.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)); return;
    }
    if (Array.isArray(item)) {hash.update(`array:${item.length}[`); for (const child of item) visit(child); hash.update(']'); return;}
    if (item && typeof item === 'object') {hash.update('{'); for (const key of Object.keys(item)) {visit(key); visit(item[key]);} hash.update('}'); return;}
    assert.notEqual(typeof item, 'function');
    const text = item === undefined ? 'undefined' : JSON.stringify(item);
    hash.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value); return hash.digest('hex');
}
export function sourceHashes() {
  const hashes = {};
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) hashes[file] = sha256(fs.readFileSync(file));
    }
  }
  for (const directory of ['src', 'data']) walk(directory);
  for (const file of ['package.json', 'tsconfig.json', 'tools/contam-preview/tsconfig.json']) hashes[file] = sha256(fs.readFileSync(file));
  return hashes;
}
export async function readPainting(recipe, materialHashes) {
  async function decode(definition) {
    assert(definition, 'Material definition required');
    const file = `public${definition.source}`, bytes = fs.readFileSync(file);
    materialHashes[file] = sha256(bytes);
    return {width: definition.logical_pixels, height: definition.logical_pixels, worldSize: definition.world_size,
      source: definition.source, regions: definition.regions,
      pixels: new Uint8ClampedArray(await sharp(bytes).resize(definition.logical_pixels, definition.logical_pixels).ensureAlpha().raw().toBuffer())};
  }
  const read = async definition => ({...await decode(definition), solid: {...await decode(definition.solid),
    skinRoughness: definition.solid.skinRoughness, cutRoughness: definition.solid.cutRoughness, gain: definition.solid.gain, cutGain: definition.solid.cutGain}});
  const family = recipe.nativeDefinition.family;
  const definition = recipe.appearance.materialOrganization
    ? ORGANIZATION_MATERIALS.find(row => row.organization === recipe.appearance.materialOrganization)
    : PAINTED_MATERIALS.find(row => row.family === family);
  const primary = await read(definition), families = {};
  for (const name of new Set([family, ...recipe.nativeDefinition.instances.map(row => row.family ?? family)])) {
    families[name] = name === family ? primary : await read(PAINTED_MATERIALS.find(row => row.family === name));
  }
  return {...primary, families, appearance: recipe.appearance};
}
export function readStoredMap(file) {return deserialize(gunzipSync(fs.readFileSync(file)));}
const channels = ['albedo', 'normal', 'response', 'emission'];
async function materialReceipt(recipe, map, directory, capture, materialHashes) {
  const world = hydrateR100MasterWorld(map.native, map.layout);
  const painting = await readPainting(recipe, materialHashes);
  const surface = bakeMasterWorldSurface(world, painting);
  const patches = bakeSearchSitePatches(world, surface, painting);
  const patchHash = exactHash(patches), result = {patchHash, states: {}};
  if (capture) fs.writeFileSync(path.join(directory, 'search-patches.v8.gz'), gzipSync(serialize(patches)), {flag: 'wx'});
  for (const state of ['intact', 'searched']) {
    for (const patch of patches) applySearchSitePatch(surface, patch, patch[state]);
    result.states[state] = Object.fromEntries(channels.map(name => [name, sha256(surface[name])]));
    if (capture) {
      fs.writeFileSync(path.join(directory, `${state}-surface.v8.gz`), gzipSync(serialize(surface)), {flag: 'wx'});
      await sharp(Buffer.from(surface.albedo), {raw: {width: surface.width, height: surface.height, channels: 4}})
        .png().toFile(path.join(directory, `${state}-material.png`));
    }
  }
  return result;
}
async function run() {
  const mode = process.argv[2], directory = process.argv[3], replayOutput = process.argv[4];
  assert(['capture', 'replay'].includes(mode) && directory,
    'Usage: baseline.mjs capture BASELINE_DIR | replay BASELINE_DIR NEW_REPORT.json');
  const capture = mode === 'capture';
  const reportPath = capture ? path.join(directory, 'baseline.json') : replayOutput;
  assert(reportPath && !fs.existsSync(reportPath), 'Refusing to overwrite evidence');
  if (capture) {assert(!fs.existsSync(directory), 'New baseline directory required'); fs.mkdirSync(directory, {recursive: true});}
  const baseline = capture ? null : JSON.parse(fs.readFileSync(path.join(directory, 'baseline.json'), 'utf8'));
  if (baseline) assert.equal(baseline.status, 'passed', 'Only a completed baseline can be replayed');
  const worlds = (process.env.QA_WORLDS ?? 'split-rib-causeway,gel-rafts,sloughed-court').split(',');
  assert(worlds.length > 0 && worlds.length <= 5 && new Set(worlds).size === worlds.length);
  const grades = (process.env.QA_GRADES ?? 'low,medium,severe').split(',');
  assert(grades.length > 0 && grades.length <= 3 && new Set(grades).size === grades.length && grades.every(grade => ['low', 'medium', 'severe'].includes(grade)));
  const rows = baseline?.cases ?? worlds.flatMap(worldId => grades.map(grade => ({worldId, grade, seed: 20261012})));
  assert(new Set(rows.map(row => row.worldId)).size <= 5);
  const initialSources = sourceHashes();
  const report = {status: 'running', mode, createdAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
    node: process.version, sourceHashes: initialSources, materialHashes: {}, cases: [], failures: [],
    limitations: ['Explicitly listed grades per world at requested seed 20261012; admitted generator retries are retained.',
      'Complete map equality covers every serializable map field; only medium grade includes four-channel material and patch byte equality.',
      'Sharp decoding is deterministic within this environment; this is not a browser or aesthetic verdict.']};
  // Freeze every departure before generating any map, so a later reader never needs today's tables.
  const prepared = rows.map(row => {
    const id = `${row.worldId}-${row.grade}-${row.seed}`, recipeFile = `${id}.recipe.json`;
    const recipe = capture ? createR100ProductionRecipe(row.worldId, row.seed, row.grade)
      : JSON.parse(fs.readFileSync(path.join(directory, recipeFile), 'utf8'));
    assert.equal(recipe.package.algorithmRevision, 10); assert(validR100ProductionRecipe(recipe));
    if (capture) fs.writeFileSync(path.join(directory, recipeFile), JSON.stringify(recipe, null, 2) + '\n', {flag: 'wx'});
    return {row, id, recipeFile, recipe};
  });
  for (const {row, id, recipeFile, recipe} of prepared) {
    try {
      const recipeHash = exactHash(recipe), map = createR100ProductionMap(recipe), mapHash = exactHash(map);
      const item = {worldId: row.worldId, grade: row.grade, seed: row.seed, recipeFile, recipeHash, mapHash,
        attempt: map.metadata.attempt, effectiveSeed: map.metadata.effectiveSeed, rejected: map.metadata.rejected,
        geometryFingerprint: map.native.diagnostics.geometryFingerprint};
      if (!capture) {assert.equal(recipeHash, row.recipeHash, `${id}: frozen recipe changed`); assert.equal(mapHash, row.mapHash, `${id}: complete old map changed`);}
      if (row.grade === 'medium') {
        const materialDirectory = path.join(directory, id);
        if (capture) {
          fs.mkdirSync(materialDirectory);
          fs.writeFileSync(path.join(materialDirectory, 'map.v8.gz'), gzipSync(serialize(map)), {flag: 'wx'});
          fs.writeFileSync(path.join(materialDirectory, 'geometry.json'), JSON.stringify({definition: map.native.definition, spatial: map.native.diagnostics.spatial,
            spawn: map.layout.spawnPoint, extraction: map.layout.extractionPoint.position}, null, 2) + '\n', {flag: 'wx'});
        }
        item.material = await materialReceipt(recipe, map, materialDirectory, capture, report.materialHashes);
        if (!capture) assert.deepEqual(item.material, row.material, `${id}: old material or patches changed`);
      }
      report.cases.push(item); console.log(`PASS ${mode} ${id}`);
    } catch (error) {report.failures.push({worldId: row.worldId, grade: row.grade, seed: row.seed, error: error.stack ?? String(error)}); console.error(error);}
    finally {fs.mkdirSync(path.dirname(reportPath), {recursive: true}); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); global.gc?.();}
  }
  assert.deepEqual(sourceHashes(), initialSources, 'Generation/data sources changed during the run');
  if (baseline) assert.deepEqual(report.materialHashes, baseline.materialHashes, 'Original material source bytes changed');
  report.status = report.failures.length ? 'failed' : 'passed';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({status: report.status, cases: report.cases.length, failures: report.failures.length, reportPath}));
  if (report.failures.length) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await run();
