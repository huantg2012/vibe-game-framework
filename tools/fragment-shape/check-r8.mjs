/** Real r8 fragment admission and terrain agreement. Historical r7 is tested separately. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {R100_FRAGMENT_AUTHORING} from '../../src/generated/r100-fragment-data.ts';
import {PAINTED_MATERIALS} from '../../src/generated/r100-materials.ts';
import {ORGANIZATION_MATERIALS} from '../../src/generated/r100-material-organizations.ts';
import {createR100ProductionRecipe, validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {createR100SpatialDefinition, validR100SpatialPolicy} from '../../src/generation/world-study/r100-spatial-world.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {bakeMasterWorldSurface} from '../../src/systems/r100-world/surface-bake.ts';
import {TileType} from '../../src/types/game-types.ts';

const allGrades = ['low', 'medium', 'severe'];
const registered = new Set(R100_FRAGMENT_AUTHORING.map(row => row.worldId));
const worlds = (process.env.QA_WORLDS ?? [...registered].join(',')).split(',');
const grades = (process.env.QA_GRADES ?? allGrades.join(',')).split(',');
const seedTokens = (process.env.QA_SEEDS ?? '20261011,20261027,20261109').split(',');
assert(seedTokens.every(token => /^\d+$/.test(token)), 'QA_SEEDS must use nonempty decimal uint32 values');
const seeds = seedTokens.map(Number);
assert(worlds.length && new Set(worlds).size === worlds.length && worlds.every(world => registered.has(world)), 'QA_WORLDS must list unique registered fragment worlds');
assert(grades.length && new Set(grades).size === grades.length && grades.every(grade => allGrades.includes(grade)), 'QA_GRADES must list unique supported grades');
assert(seeds.length && new Set(seeds).size === seeds.length && seeds.every(seed => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff), 'QA_SEEDS must list unique uint32 seeds');
const sourceHashes = {};
for (const prefix of ['src', 'data']) {
  const walk = directory => {for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) sourceHashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }};
  walk(prefix);
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const reportAt = process.argv.indexOf('--report');
const destination = reportAt >= 0 ? process.argv[reportAt + 1] : undefined;
if (destination) assert(!fs.existsSync(destination), 'Do not overwrite previous evidence');
let checkedRecipes = 0;
for (const row of R100_NATIVE_WORLDS) for (const grade of allGrades) {
  const recipe = createR100ProductionRecipe(row.id, seeds[0], grade);
  assert.equal(recipe.package.algorithmRevision, 8);
  assert(validR100ProductionRecipe(recipe), `${row.id}/${grade}`);
  assert.equal(Boolean(recipe.spatialPolicy.fragmentShape), registered.has(row.id));
  checkedRecipes++;
}
const source = createR100ProductionRecipe('cinder-ridge', seeds[0], 'medium');
let rejectionCases = 0;
for (const mutate of [
  recipe => {recipe.package.algorithmRevision = 7;},
  recipe => {recipe.package.algorithmRevision = 9;},
  recipe => {recipe.spatialPolicy.fragmentShape.edgeSeed++;},
  recipe => {recipe.spatialPolicy.fragmentShape.layout.worldScale = 1;},
  recipe => {recipe.spatialPolicy.terrainOutline[0].x++;},
  recipe => {recipe.spatialPolicy.erosion.pop();},
  recipe => {recipe.spatialPolicy.fragmentShape.algorithmVersion = 'unregistered-v2';},
]) {
  const bad = structuredClone(source); mutate(bad);
  assert(!validR100ProductionRecipe(bad), 'Corrupt or relabelled package was accepted');
  rejectionCases++;
}
// Even valid alternate compiled contours cannot claim a different original edge seed.
const wrongOrigin = structuredClone(source.spatialPolicy);
wrongOrigin.fragmentShape.edgeSeed = (wrongOrigin.fragmentShape.edgeSeed + 1) >>> 0;
const compiled = compileR100FragmentShape(wrongOrigin.fragmentShape);
wrongOrigin.terrainOutline = compiled.terrainOutline; wrongOrigin.erosion = compiled.erosion;
assert(!validR100SpatialPolicy(wrongOrigin, 'cinder-ridge', source.requestedSeed)); rejectionCases++;
const finalA = createR100SpatialDefinition(source.nativeDefinition, source.spatialPolicy, seeds[0]).definition;
const finalB = createR100SpatialDefinition(source.nativeDefinition, source.spatialPolicy, 3571).definition;
assert.deepEqual(finalA.terrainOutline, finalB.terrainOutline, 'Retry changed terrain');
assert.deepEqual(finalA.erosion, finalB.erosion, 'Retry changed holes');

const inside = (ring, x, y) => {
  let found = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) found = !found;
  }
  return found;
};
function enclosedVoids(map) {
  const {cols, rows, tiles} = map;
  const seen = new Uint8Array(cols * rows), queue = new Int32Array(cols * rows);
  let holes = 0;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || tiles[Math.floor(start / cols)][start % cols] !== TileType.VOID) continue;
    let head = 0, tail = 1, outside = false; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const cell = queue[head++], x = cell % cols, y = Math.floor(cell / cols);
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) outside = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, next = yy * cols + xx;
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || seen[next] || tiles[yy][xx] !== TileType.VOID) continue;
        seen[next] = 1; queue[tail++] = next;
      }
    }
    if (!outside) holes++;
  }
  return holes;
}
async function painting(recipe) {
  const family = recipe.nativeDefinition.family;
  const decode = async definition => ({width: definition.logical_pixels, height: definition.logical_pixels, worldSize: definition.world_size,
    source: definition.source, regions: definition.regions,
    pixels: new Uint8ClampedArray(await sharp(`public${definition.source}`).resize(definition.logical_pixels, definition.logical_pixels).ensureAlpha().raw().toBuffer())});
  const read = async definition => ({...await decode(definition), solid: {...await decode(definition.solid),
    skinRoughness: definition.solid.skinRoughness, cutRoughness: definition.solid.cutRoughness, gain: definition.solid.gain, cutGain: definition.solid.cutGain}});
  const primaryDefinition = recipe.appearance.materialOrganization ? ORGANIZATION_MATERIALS.find(row => row.organization === recipe.appearance.materialOrganization) : PAINTED_MATERIALS.find(row => row.family === family);
  const primary = await read(primaryDefinition), families = {};
  for (const name of new Set([family, ...recipe.nativeDefinition.instances.map(row => row.family ?? family)])) families[name] = name === family ? primary : await read(PAINTED_MATERIALS.find(row => row.family === name));
  return {...primary, families, appearance: recipe.appearance};
}
async function verifyCase(worldId, grade, seed) {
  const recipe = createR100ProductionRecipe(worldId, seed, grade);
  const started = performance.now(), result = createR100ProductionMap(recipe);
  const generatedMs = performance.now() - started;
  assert.equal(result.native.algorithmRevision, 8);
  assert.equal(result.native.definition.fragmentShapeVersion, 'rectilinear-fragment-v1');
  const native = structuredClone(result.native), layout = structuredClone(result.layout);
  const world = hydrateR100MasterWorld(native, layout);
  const {terrainOutline, erosion} = world.definition;
  assert.deepEqual(terrainOutline, recipe.spatialPolicy.terrainOutline);
  assert.deepEqual(erosion, recipe.spatialPolicy.erosion);
  const map = layout.tileMap, matter = new Uint8Array(map.cols * map.rows);
  let checkedSupportCells = 0, transparentSolidCells = 0, partialMaterialCells = 0;
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    const x = col * 8 + 4, y = row * 8 + 4;
    const expected = inside(terrainOutline, x, y) && !erosion.some(hole => inside(hole, x, y));
    assert.equal(map.tiles[row][col] !== TileType.VOID, expected, 'Final 8px map differs from frozen polygons');
    assert.equal(world.matterAt(x, y), expected, 'Hydrated matter differs');
    assert.equal(world.sight.isOpaque(col, row), !expected, 'VOID sight differs');
    matter[row * map.cols + col] = Number(expected);
    if (map.tiles[row][col] === TileType.WALL) {assert(!world.sight.isOpaque(col, row)); transparentSolidCells++;}
    checkedSupportCells++;
  }
  assert(transparentSolidCells > 0);
  for (let row = 0; row < world.sample.rows; row++) for (let col = 0; col < world.sample.cols; col++) {
    let count = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) count += matter[(row * 4 + y) * map.cols + col * 4 + x];
    assert.equal(world.sample.land[row * world.sample.cols + col], Number(count > 0), '32px material sample cropped partial support');
    if (count && count < 16) partialMaterialCells++;
  }
  assert(partialMaterialCells > 0);
  const rasterHoles = enclosedVoids(map);
  assert.equal(rasterHoles, erosion.length, '8px raster merged/opened/lost a frozen hole');
  const surfaceStarted = performance.now();
  const surface = bakeMasterWorldSurface(world, await painting(recipe));
  const surfaceMs = performance.now() - surfaceStarted;
  let checkedSurfacePixels = 0;
  for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) {
    const expected = Boolean(matter[Math.floor(y / 8) * map.cols + Math.floor(x / 8)]);
    assert.equal(surface.albedo[(y * surface.width + x) * 4 + 3] !== 0, expected, 'Surface alpha disagrees with authoritative terrain');
    checkedSurfacePixels++;
  }
  const spatial = result.native.diagnostics.spatial;
  return {worldId, grade, seed, effectiveSeed: result.metadata.effectiveSeed, attempt: result.metadata.attempt, rejected: result.metadata.rejected,
    shapeHash: hash({terrainOutline, erosion}), supportHash: createHash('sha256').update(matter).digest('hex'),
    outlineVertices: terrainOutline.length, holes: erosion.length, rasterHoles, checkedSupportCells, transparentSolidCells, partialMaterialCells, checkedSurfacePixels,
    bodies: {bodySize: result.metadata.bodySize, reachableRatio: spatial.bodyReachableRatio, unreachableSeats: spatial.unreachableBodySeats},
    spawn: layout.spawnPoint, extraction: layout.extractionPoint.position, extractionRoutePx: result.metadata.extractionRoutePx,
    solidObjects: spatial.solidObjectCount, kindlingNodes: layout.kindlingNodes.length, contaminantNodes: layout.contaminantNodes.length, enemies: layout.enemySpawns.length,
    geometryFingerprint: result.native.diagnostics.geometryFingerprint, generatedMs, surfaceMs,
    rgbaHashes: Object.fromEntries(['albedo', 'normal', 'response', 'emission'].map(key => [key, createHash('sha256').update(surface[key]).digest('hex')]))};
}
const cases = [], failures = [];
for (const worldId of worlds) for (const seed of seeds) for (const grade of grades) {
  try {
    const item = await verifyCase(worldId, grade, seed); cases.push(item);
    console.log(`PASS r8 ${worldId} ${seed}/${grade}: attempt ${item.attempt}, ${item.outlineVertices} outer vertices, ${item.rasterHoles} holes, route ${item.extractionRoutePx.toFixed(1)}px`);
  } catch (error) {
    failures.push({worldId, seed, grade, error: error.stack ?? String(error)});
    console.error(`FAIL r8 ${worldId} ${seed}/${grade}: ${error.message}`);
  } finally {global.gc?.();}
}
for (const worldId of worlds) for (const seed of seeds) {
  const matches = cases.filter(item => item.worldId === worldId && item.seed === seed);
  if (matches.length !== grades.length) continue;
  assert.equal(new Set(matches.map(item => item.supportHash)).size, 1, `${worldId}/${seed}: grade selection changed terrain`);
  assert.equal(new Set(matches.map(item => item.shapeHash)).size, 1, `${worldId}/${seed}: grade selection changed frozen contours`);
}
const report = {status: failures.length ? 'failed' : 'passed', algorithmRevision: 8, algorithm: 'rectilinear-fragment-v1', registeredWorlds: [...registered], selectedWorlds: worlds, selectedSeeds: seeds, selectedGrades: grades, sourceHashes, checkedRecipes, rejectionCases, retryKeepsEdgeSeedAndTerrain: true,
  cases, failures, scope: `${cases.length} full maps for ${worlds.length} selected fragment worlds, ${seeds.length} seeds and ${grades.length} grades; complete deployment, actual material baking, frozen polygon / 8px matter / transferred LOS / coarse material support / every RGBA alpha pixel agreement. All ${R100_NATIVE_WORLDS.length} worlds also checked as recipes across all three grades.`,
  limitations: ['Node timings are not browser Worker timings or FPS.', 'This checks opaque cells, not natural navigation, shoulder-light observation or visual approval.', 'Cross-grade terrain agreement applies only to selected grades and is grouped independently by world and seed.', 'Old r7 replay, pre-expansion saved r8 replay and browser continuation have independent evidence.']};
if (destination) {fs.mkdirSync(path.dirname(destination), {recursive: true}); fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx'});}
console.log(JSON.stringify({status: report.status, checkedRecipes, rejectionCases, maps: cases.length, failures: failures.length, report: destination ?? null}));
if (failures.length) process.exitCode = 1;
