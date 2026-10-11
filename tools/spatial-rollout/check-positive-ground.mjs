/** Positive terrain contract tests. Small controlled worlds isolate terrain,
 * transfer and material edges; these are not production or visual acceptance. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds.ts';
import { createMasterWorld } from '../../src/generation/world-study/r100-master-world.ts';
import { validateNativeTerrainOutline } from '../../src/generation/world-study/native-volume-erosion.ts';
import { createR100SpatialPolicy, createR100SpatialDefinition, validR100SpatialPolicy } from '../../src/generation/world-study/r100-spatial-world.ts';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100ProductionRecipe as createRevision7Recipe } from '../../src/generation/legacy-r100-v7/executor-revision7.js';
import { compileR100FragmentShape } from '../../src/generation/world-study/r100-fragment-shape.ts';
import { serializeR100MasterWorld, hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data.ts';
import { buildMasterSurfaceFields } from '../../src/systems/r100-world/surface-fields.ts';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data.ts';
import { TileType } from '../../src/types/game-types.ts';

const baseline = process.env.QA_BASELINE ?? '3e0821a7';
const output = process.env.QA_REPORT ?? 'docs/qa/artifacts/r100-positive-ground-2026-10-11/contract.json';
const seed = 173;
const source = R100_NATIVE_WORLDS.find(world => world.id === 'cinder-ridge');
assert(source);
// No Hosts: this isolates terrain and avoids substituting a small test world's
// content capacity for full production admission (verified separately).
const frozen = { profile: source.profile, grade: { ...POLLUTION_GRADE_DEFINITIONS[0], paintCount: 0, volumeCount: 0 } };
const square = (x, y, size = 16) => [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }];
const outline = [{ x: 40, y: 104 }, { x: 144, y: 40 }, { x: 432, y: 56 }, { x: 472, y: 264 },
  { x: 384, y: 344 }, { x: 72, y: 320 }];
const holes = [[176, 104], [264, 104], [352, 104], [144, 192], [248, 200], [368, 208], [192, 272], [296, 280]].map(([x, y]) => square(x, y));
const definition = { ...source.definitions[0], cols: 16, rows: 12, instances: [], erosion: holes,
  spawn_x: 104, spawn_y: 144, exit_x: 416, exit_y: 272, search_x: 320, search_y: 248, enemy_x: 320, enemy_y: 152,
  terrainOutline: outline };
validateNativeTerrainOutline(outline, 512, 384, holes);
const world = createMasterWorld(definition, seed, frozen);
const inside = (ring, x, y) => {
  let result = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const p = ring[a], q = ring[b];
    if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) result = !result;
  }
  return result;
};
let comparedCells = 0, partialCoarseCells = 0;
for (let y = 4; y < 384; y += 8) for (let x = 4; x < 512; x += 8) {
  const expected = inside(outline, x, y) && !holes.some(hole => inside(hole, x, y));
  assert.equal(world.matterAt(x, y), expected, `8px matter ${x},${y}`);
  assert.equal(world.sight.isOpaque(Math.floor(x / 8), Math.floor(y / 8)), !expected);
  assert.equal(world.layout.tileMap.tiles[Math.floor(y / 8)][Math.floor(x / 8)] !== TileType.VOID, expected);
  comparedCells++;
}
assert(!world.matterAt(36, 36), 'A legacy rectangle corner must remain empty');
assert(world.matterAt(104, 144), 'The positive interior must exist');
for (const hole of holes) assert(!world.matterAt(hole[0].x + 8, hole[0].y + 8));
for (let row = 0; row < 12; row++) for (let col = 0; col < 16; col++) {
  let count = 0;
  for (let y = 4; y < 32; y += 8) for (let x = 4; x < 32; x += 8) count += world.matterAt(col * 32 + x, row * 32 + y) ? 1 : 0;
  assert.equal(world.sample.land[row * 16 + col], count > 0 ? 1 : 0, '32px sample must derive from physical support');
  if (count > 0 && count < 16) partialCoarseCells++;
}
assert(partialCoarseCells > 0, 'Fixture must exercise a boundary inside a coarse tile');
const native = structuredClone(serializeR100MasterWorld(world, frozen.grade, 'fixture'));
const hydrated = hydrateR100MasterWorld(native, structuredClone(world.layout));
assert.deepEqual(hydrated.definition.terrainOutline, outline);
for (let y = 4; y < 384; y += 8) for (let x = 4; x < 512; x += 8) assert.equal(hydrated.matterAt(x, y), world.matterAt(x, y));

const malformed = [undefined, null, [], outline.slice(0, 2), [...outline, outline[0]],
  outline.map((p, i) => i ? p : { x: NaN, y: p.y }), outline.map((p, i) => i ? p : { ...p, z: 0 }),
  outline.map((p, i) => i ? p : { x: -1, y: p.y }),
  [{ x: 40, y: 40 }, { x: 400, y: 300 }, { x: 400, y: 40 }, { x: 40, y: 300 }]];
for (const bad of malformed) assert.throws(() => validateNativeTerrainOutline(bad, 512, 384));
assert.throws(() => validateNativeTerrainOutline(outline, 512, 384, [square(16, 16)]));
assert.throws(() => validateNativeTerrainOutline(square(40, 40, 256), 512, 384, [square(40, 80)]), 'Touching hole');
validateNativeTerrainOutline([...outline].reverse(), 512, 384, holes);

// The eight-hole fixture above tests generic positive terrain. The current
// cinder authoring contract is separate: derive its holes from the same frozen
// rectangle compiler, never require a historical fixture's hole count.
const productionSeed = 20261011;
const policy = createR100SpatialPolicy('cinder-ridge', productionSeed);
assert.equal(policy.version, 2);
assert(policy.fragmentShape && policy.terrainOutline, 'Current representative must opt into the fragment compiler');
const compiled = compileR100FragmentShape(policy.fragmentShape, productionSeed);
assert.deepEqual(policy.terrainOutline, compiled.terrainOutline);
assert.deepEqual(policy.erosion, compiled.erosion);
assert(validR100SpatialPolicy(JSON.parse(JSON.stringify(policy)), 'cinder-ridge', productionSeed));
for (const bad of malformed) assert(!validR100SpatialPolicy({ ...policy, terrainOutline: bad }, 'cinder-ridge', productionSeed));
assert(!validR100SpatialPolicy({ ...policy, terrainOutlines: policy.terrainOutline }, 'cinder-ridge', productionSeed), 'Unknown field must reject');
const recipe = createR100ProductionRecipe('cinder-ridge', productionSeed, 'medium');
assert.equal(recipe.package.algorithmRevision, 8);
assert(validR100ProductionRecipe(JSON.parse(JSON.stringify(recipe))), 'Outline survives frozen recipe roundtrip');
const omitted = structuredClone(recipe); delete omitted.spatialPolicy.terrainOutline;
assert(!validR100ProductionRecipe(omitted), 'Deleting frozen terrain must invalidate its receipt');
const corruptNative = structuredClone(recipe); corruptNative.nativeDefinition.terrainOutline = null;
assert(!validR100ProductionRecipe(corruptNative));
assert.throws(() => createR100SpatialDefinition({ ...recipe.nativeDefinition, terrainOutline: square(64, 64, 256) }, recipe.spatialPolicy, seed), 'Source/world outline ambiguity must reject');

// Historical r7 keeps its archived positive-outline rules. Its eight holes
// belong to that frozen authoring, not to a new production-wide quota.
const revision7Recipe = createRevision7Recipe('cinder-ridge', 20261010, 'medium');
assert.equal(revision7Recipe.package.algorithmRevision, 7);
assert.equal(revision7Recipe.spatialPolicy.version, 1);
assert.equal(revision7Recipe.spatialPolicy.erosion.length, 8);
assert(revision7Recipe.spatialPolicy.terrainOutline);
assert(!Object.hasOwn(revision7Recipe.spatialPolicy, 'fragmentShape'));
assert(validR100ProductionRecipe(structuredClone(revision7Recipe)), 'Frozen r7 outline recipe must still dispatch to its archived validator');
assert(!validR100ProductionRecipe({ ...revision7Recipe, package: { ...revision7Recipe.package, algorithmRevision: 8 } }), 'An r7 recipe cannot be relabeled as r8');

// Exercise actual ground-edge material ownership on a small v4 world. The
// production context must include the outer ring, not merely the inner cut.
const edgeSource = R100_NATIVE_WORLDS.flatMap(item => item.definitions).find(item => item.instances.some(i => i.groundEdgeWidth === 8));
assert(edgeSource);
const owner = edgeSource.instances.find(i => i.groundEdgeWidth === 8);
const edgeDefinition = { ...edgeSource, cols: 8, rows: 6, grade: 'low', authoredErosion: true,
  terrainOutline: [{ x: 24, y: 48 }, { x: 80, y: 16 }, { x: 224, y: 40 }, { x: 232, y: 144 }, { x: 144, y: 176 }, { x: 32, y: 144 }],
  erosion: [square(120, 80)], instances: [{ ...owner, x: 160, y: 112, length: 40, width: 32 }],
  spawn_x: 64, spawn_y: 88, exit_x: 176, exit_y: 144, search_x: 184, search_y: 80, enemy_x: 80, enemy_y: 112 };
const edgeWorld = createMasterWorld(edgeDefinition, seed, frozen);
const edgeMesh = edgeWorld.meshes[0];
assert(edgeMesh.groundEdgeStart && edgeWorld.raster.groundEdgePixels);
let outerMaterialPixels = 0;
for (const i of edgeWorld.raster.occupiedPixels) {
  if (!(edgeWorld.raster.groundEdgePixels[i >>> 5] & (1 << (i & 31)))) continue;
  const x = i % 256, y = Math.floor(i / 256);
  assert(edgeWorld.matterAt(x, y), 'Ground-edge material must never fill absent terrain');
  if (Math.hypot(x - 128, y - 88) > 48) outerMaterialPixels++;
}
assert(outerMaterialPixels > 0, 'Outer outline must generate actual edge material');
const edgeFields = buildMasterSurfaceFields(edgeWorld);
let edgeColorPixels = 0;
for (let i = 0; i < edgeFields.erosion.length; i++) if (edgeFields.erosion[i] > 0) {
  const x = i % 256, y = Math.floor(i / 256);
  assert(edgeWorld.matterAt(x, y), 'Edge pigment must never light absent terrain');
  if (Math.hypot(x - 128, y - 88) > 48) edgeColorPixels++;
}
assert(edgeColorPixels > 0, 'Outer outline must feed the surface edge-color field');

// Run the unchanged-input path against the actual pre-change implementations,
// not a duplicate rectangle formula. Compare complete transferable values.
const temporary = mkdtempSync(path.join(tmpdir(), 'coh-positive-ground-'));
let legacyCases = 0;
try {
  const file = path.join(temporary, 'baseline.mjs');
  const oldPaths = new Set(['src/generation/world-study/r100-master-world.ts', 'src/systems/r100-world/surface-fields.ts']);
  await build({ stdin: { contents: "export { createMasterWorld } from './src/generation/world-study/r100-master-world.ts'; export { buildMasterSurfaceFields } from './src/systems/r100-world/surface-fields.ts';", resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', outfile: file, logLevel: 'silent', plugins: [{ name: 'baseline-ground', setup(builder) {
      builder.onLoad({ filter: /\.ts$/ }, args => {
        const relative = path.relative(process.cwd(), args.path);
        if (!oldPaths.has(relative)) return;
        return { contents: execFileSync('git', ['show', `${baseline}:${relative}`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }), loader: 'ts' };
      });
    } }] });
  const old = await import(pathToFileURL(file).href);
  const { terrainOutline: _outline, ...legacy } = definition;
  for (const caseSeed of [173, 991]) {
    const before = old.createMasterWorld(legacy, caseSeed, frozen), after = createMasterWorld(legacy, caseSeed, frozen);
    assert(!Object.hasOwn(after.definition, 'terrainOutline'));
    assert.deepEqual(serializeR100MasterWorld(after, frozen.grade, 'legacy'), serializeR100MasterWorld(before, frozen.grade, 'legacy'));
    // Separate bundles have different TileGrid constructors; compare their
    // transferable own state rather than the constructor's object identity.
    assert.deepEqual(structuredClone(after.layout), structuredClone(before.layout));
    assert.deepEqual(buildMasterSurfaceFields(after), old.buildMasterSurfaceFields(before));
    legacyCases++;
  }
} finally { rmSync(temporary, { recursive: true, force: true }); }
const files = ['src/generation/world-study/r100-master-world.ts', 'src/generation/world-study/native-volume-erosion.ts',
  'src/generation/world-study/r100-spatial-world.ts', 'src/generation/world-study/r100-spatial-types.ts',
  'src/generation/world-study/r100-fragment-shape.ts', 'src/generation/world-study/r100-package.ts',
  'src/generation/legacy-r100-v7/executor-recovery.js', 'src/generation/legacy-r100-v7/executor-revision7.js',
  'src/systems/r100-world/surface-fields.ts', 'src/generated/r100-spatial-data.ts', 'src/generated/r100-fragment-data.ts',
  'tools/spatial-rollout/check-positive-ground.mjs'];
const report = { status: 'passed', scope: 'Controlled terrain/material/freeze contracts and legacy equivalence; no complete production, performance or visual acceptance.',
  baseline, comparedCells, partialCoarseCells, fixtureInternalHoles: holes.length, malformedOutlines: malformed.length,
  currentRepresentative: { worldId: 'cinder-ridge', seed: productionSeed, algorithmRevision: recipe.package.algorithmRevision,
    shapeVersion: policy.fragmentShape.algorithmVersion, outerPoints: policy.terrainOutline.length, internalHoles: policy.erosion.length },
  historicalRecipe: { algorithmRevision: revision7Recipe.package.algorithmRevision, internalHoles: revision7Recipe.spatialPolicy.erosion.length,
    archivedValidationPassed: true, revisionRelabelRejected: true },
  outerMaterialPixels, edgeColorPixels, legacyCases,
  sources: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])) };
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(`PASS positive ground: ${comparedCells} 8px fixture cells / ${holes.length} fixture holes, r8 representative ${policy.erosion.length} derived holes, r7 archived validation, real edge material, ${legacyCases} exact pre-outline fixture worlds`);
