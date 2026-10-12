/** Capture from a fixed Git checkout, then replay those saved r8 recipes after CSV expansion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {serialize, deserialize} from 'node:v8';
import {gzipSync, gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const mode = process.argv[2];
assert(['capture', 'verify'].includes(mode), 'Usage: check-r8-previous.mjs capture|verify');
const root = path.resolve(process.env.QA_SOURCE_ROOT ?? '.');
const directory = path.resolve(process.env.QA_BASELINE_DIR ?? 'docs/qa/artifacts/r100-fragment-expansion-2026-10-12/previous-r8-confirmed');
const reportPath = path.resolve(process.env.QA_REPORT ?? path.join(directory, mode === 'capture' ? 'baseline.json' : 'replay.json'));
assert(!fs.existsSync(reportPath), `Refusing to overwrite evidence: ${reportPath}`);
if (mode === 'capture') assert.equal(fs.realpathSync(process.env.TSX_TSCONFIG_PATH ?? ''), fs.realpathSync(path.join(root, 'tools/contam-preview/tsconfig.json')), 'Capture must resolve all @ imports through the fixed Git source tsconfig, never the live workspace');
const load = name => import(pathToFileURL(path.join(root, name)).href);
const [{createR100ProductionRecipe, validR100ProductionRecipe}, {createR100ProductionMap}, {hydrateR100MasterWorld}, {bakeMasterWorldSurface}, {PAINTED_MATERIALS}, {ORGANIZATION_MATERIALS}] = await Promise.all([
  load('src/generation/world-study/r100-package.ts'), load('src/generation/world-study/r100-production-map.ts'), load('src/generation/world-study/r100-native-data.ts'), load('src/systems/r100-world/surface-bake.ts'), load('src/generated/r100-materials.ts'), load('src/generated/r100-material-organizations.ts')]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function exactHash(value) {
  const hash = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) {hash.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)); return;}
    if (Array.isArray(item)) {hash.update(`array:${item.length}[`); for (const child of item) visit(child); hash.update(']'); return;}
    if (item && typeof item === 'object') {hash.update('{'); for (const key of Object.keys(item)) {visit(key); visit(item[key]);} hash.update('}'); return;}
    assert.notEqual(typeof item, 'function');
    const text = typeof item === 'undefined' ? 'undefined' : JSON.stringify(item);
    hash.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value); return hash.digest('hex');
}
function sourceHashes() {
  const hashes = {};
  for (const prefix of ['src', 'data']) {
    function walk(directory) {
      for (const entry of fs.readdirSync(path.join(root, directory), {withFileTypes: true})) {
        const relative = `${directory}/${entry.name}`;
        if (entry.isDirectory()) walk(relative);
        else if (entry.isFile()) hashes[relative] = digest(fs.readFileSync(path.join(root, relative)));
      }
    }
    walk(prefix);
  }
  for (const relative of ['package.json', 'tsconfig.json', 'tools/contam-preview/tsconfig.json', 'tools/contam-preview/phaser-stub.ts']) hashes[relative] = digest(fs.readFileSync(path.join(root, relative)));
  return hashes;
}
const report = {status: 'running', mode, createdAt: new Date().toISOString(), sourceRoot: root, sourceCommit: process.env.QA_SOURCE_COMMIT ?? null, environment: {platform: process.platform, architecture: process.arch, node: process.version, sharp: sharp.versions, aliasConfig: process.env.TSX_TSCONFIG_PATH ?? null}, sourceHashes: sourceHashes(), materialHashes: {}, cases: []};
if (mode === 'capture') {
  assert(report.sourceCommit, 'Fixed Git revision is required when capturing');
  const repository = path.resolve(process.env.QA_GIT_ROOT ?? '.');
  report.sourceCommit = execFileSync('git', ['rev-parse', report.sourceCommit], {cwd: repository, encoding: 'utf8'}).trim();
  // Bind every execution/author input to Git, rather than trusting the directory label.
  for (const [relative, hash] of Object.entries(report.sourceHashes)) {
    assert.equal(digest(execFileSync('git', ['show', `${report.sourceCommit}:${relative}`], {cwd: repository, maxBuffer: 30 * 1024 * 1024})), hash, `Baseline differs from fixed Git source: ${relative}`);
  }
}
async function painting(recipe) {
  const family = recipe.nativeDefinition.family;
  async function decode(definition) {
    assert(definition, 'Unknown painted material');
    const relative = `public${definition.source}`, input = fs.readFileSync(path.join(root, relative));
    report.materialHashes[relative] = digest(input);
    return {width: definition.logical_pixels, height: definition.logical_pixels, worldSize: definition.world_size, source: definition.source, regions: definition.regions,
      pixels: new Uint8ClampedArray(await sharp(input).resize(definition.logical_pixels, definition.logical_pixels).ensureAlpha().raw().toBuffer())};
  }
  const read = async definition => ({...await decode(definition), solid: {...await decode(definition.solid), skinRoughness: definition.solid.skinRoughness, cutRoughness: definition.solid.cutRoughness, gain: definition.solid.gain, cutGain: definition.solid.cutGain}});
  const primaryDefinition = recipe.appearance.materialOrganization ? ORGANIZATION_MATERIALS.find(row => row.organization === recipe.appearance.materialOrganization) : PAINTED_MATERIALS.find(row => row.family === family);
  const primary = await read(primaryDefinition), families = {};
  for (const name of new Set([family, ...recipe.nativeDefinition.instances.map(row => row.family ?? family)])) families[name] = name === family ? primary : await read(PAINTED_MATERIALS.find(row => row.family === name));
  return {...primary, families, appearance: recipe.appearance};
}
fs.mkdirSync(directory, {recursive: true});
const baseline = mode === 'verify' ? JSON.parse(fs.readFileSync(path.join(directory, 'baseline.json'), 'utf8')) : null;
if (baseline) assert.equal(baseline.status, 'passed');
const cases = baseline?.cases ?? (process.env.QA_WORLDS ?? 'ash-strata,splayed-fibres,shell-chain,pale-sail,gel-fibre,cinder-ridge,woven-quarters,monolith-sill').split(',').map(worldId => ({worldId, grade: 'medium', seed: 20261012}));
try {
  for (const item of cases) {
    const id = `${item.worldId}-${item.grade}-${item.seed}`;
    const recipePath = `${id}.recipe.json`, mapPath = `${id}.map.v8.gz`;
    const recipe = baseline ? JSON.parse(fs.readFileSync(path.join(directory, recipePath), 'utf8')) : createR100ProductionRecipe(item.worldId, item.seed, item.grade);
    assert.equal(recipe.package.algorithmRevision, 8); assert(validR100ProductionRecipe(recipe), `${id}: saved recipe rejected`);
    const recipeHash = digest(JSON.stringify(recipe));
    if (baseline) assert.equal(recipeHash, item.recipeHash, `${id}: saved recipe bytes drifted`);
    else fs.writeFileSync(path.join(directory, recipePath), `${JSON.stringify(recipe)}\n`, {flag: 'wx'});
    let map = createR100ProductionMap(recipe);
    const mapHash = exactHash(map);
    if (baseline) {
      if (fs.existsSync(path.join(directory, mapPath))) {
        const storedMap = deserialize(gunzipSync(fs.readFileSync(path.join(directory, mapPath))));
        assert.equal(exactHash(storedMap), item.mapHash, `${id}: stored map was changed`);
      }
      assert.equal(mapHash, item.mapHash, `${id}: complete old r8 map changed after expansion`);
    } else fs.writeFileSync(path.join(directory, mapPath), gzipSync(serialize(map)), {flag: 'wx'});
    const world = hydrateR100MasterWorld(map.native, map.layout);
    const surface = bakeMasterWorldSurface(world, await painting(recipe));
    const rgbaHashes = Object.fromEntries(['albedo', 'normal', 'response', 'emission'].map(key => [key, digest(surface[key])]));
    if (baseline) assert.deepEqual(rgbaHashes, item.rgbaHashes, `${id}: old r8 material pixels changed`);
    report.cases.push({worldId: item.worldId, grade: item.grade, seed: item.seed, recipePath, mapPath, storedMapChecked: Boolean(baseline && fs.existsSync(path.join(directory, mapPath))), recipeHash, mapHash, rgbaHashes, attempt: map.metadata.attempt, fragment: Boolean(recipe.spatialPolicy.fragmentShape)});
    console.log(`PASS ${mode} old r8 ${id}: complete map + four RGBA layers`);
    map = null; global.gc?.();
  }
  if (mode === 'capture') for (const [relative, hash] of Object.entries(report.materialHashes)) {
    assert.equal(digest(execFileSync('git', ['show', `${report.sourceCommit}:${relative}`], {cwd: path.resolve(process.env.QA_GIT_ROOT ?? '.'), maxBuffer: 30 * 1024 * 1024})), hash, `Material differs from fixed Git: ${relative}`);
  }
  if (baseline) for (const [relative, hash] of Object.entries(baseline.materialHashes)) assert.equal(report.materialHashes[relative], hash, `Material input changed: ${relative}`);
  report.status = 'passed';
  report.limitations = ['Finite medium-grade saved r8 fixtures; does not replace browser cold continuation or all-world/all-seed coverage.', 'Complete map equality includes content, bodies, diagnostics and effective-seed admission, not just terrain.'];
} catch (error) {report.status = 'failed'; report.error = error.stack ?? String(error); process.exitCode = 1; console.error(error);}
finally {fs.mkdirSync(path.dirname(reportPath), {recursive: true}); fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx'});}
