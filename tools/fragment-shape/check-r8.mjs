/** Real r8 cinder admission and terrain agreement. Historical r7 is tested separately. */
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

const grades = ['low', 'medium', 'severe'];
const seeds = [20261011, 20261027, 20261109];
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const reportAt = process.argv.indexOf('--report');
const destination = reportAt >= 0 ? process.argv[reportAt + 1] : undefined;
if (destination) assert(!fs.existsSync(destination), 'Do not overwrite previous evidence');
let checkedRecipes = 0;
const registered = new Set(R100_FRAGMENT_AUTHORING.map(row => row.worldId));
for (const row of R100_NATIVE_WORLDS) for (const grade of grades) {
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
wrongOrigin.fragmentShape.edgeSeed++;
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
async function verifyCase(grade, seed) {
  const recipe = createR100ProductionRecipe('cinder-ridge', seed, grade);
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
  return {grade, seed, effectiveSeed: result.metadata.effectiveSeed, attempt: result.metadata.attempt, rejected: result.metadata.rejected,
    shapeHash: hash({terrainOutline, erosion}), supportHash: createHash('sha256').update(matter).digest('hex'),
    outlineVertices: terrainOutline.length, holes: erosion.length, rasterHoles, checkedSupportCells, transparentSolidCells, partialMaterialCells, checkedSurfacePixels,
    bodies: {bodySize: result.metadata.bodySize, reachableRatio: spatial.bodyReachableRatio, unreachableSeats: spatial.unreachableBodySeats},
    spawn: layout.spawnPoint, extraction: layout.extractionPoint.position, extractionRoutePx: result.metadata.extractionRoutePx,
    solidObjects: spatial.solidObjectCount, kindlingNodes: layout.kindlingNodes.length, contaminantNodes: layout.contaminantNodes.length, enemies: layout.enemySpawns.length,
    geometryFingerprint: result.native.diagnostics.geometryFingerprint, generatedMs, surfaceMs,
    rgbaHashes: Object.fromEntries(['albedo', 'normal', 'response', 'emission'].map(key => [key, createHash('sha256').update(surface[key]).digest('hex')]))};
}
const cases = [];
for (const seed of seeds) for (const grade of grades) {
  const item = await verifyCase(grade, seed); cases.push(item);
  global.gc?.();
  console.log(`PASS r8 cinder ${seed}/${grade}: attempt ${item.attempt}, ${item.outlineVertices} outer vertices, ${item.rasterHoles} holes, route ${item.extractionRoutePx.toFixed(1)}px`);
}
for (const seed of seeds) assert.equal(new Set(cases.filter(item => item.seed === seed).map(item => item.supportHash)).size, 1, 'Grade selection changed same-seed terrain');
const report = {status: 'passed', algorithmRevision: 8, algorithm: 'rectilinear-fragment-v1', registeredWorlds: [...registered], checkedRecipes, rejectionCases, retryKeepsEdgeSeedAndTerrain: true,
  cases, scope: '9 full cinder maps with complete deployment, actual material baking, frozen polygon / 8px matter / transferred LOS / coarse material support / every RGBA alpha pixel agreement. Other 107 worlds checked as recipes only.',
  limitations: ['Node timings are not browser Worker timings or FPS.', 'This checks opaque cells, not natural navigation, shoulder-light observation or visual approval.', 'Old r7 replay and browser continuation have independent evidence.']};
if (destination) {fs.mkdirSync(path.dirname(destination), {recursive: true}); fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx'});}
console.log(JSON.stringify({status: report.status, checkedRecipes, rejectionCases, maps: cases.length, report: destination ?? null}));
