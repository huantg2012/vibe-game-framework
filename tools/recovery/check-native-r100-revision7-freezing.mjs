/** Isolated live-catalog changes cannot rewrite or revalidate a saved r7 snapshot. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100SpatialDefinition, validR100SpatialPolicy } from '../../src/generation/world-study/r100-spatial-world.ts';
import { R100_SPATIAL_CONFIG, R100_SPATIAL_PLACEMENTS, R100_SPATIAL_WORLDS, R100_SPATIAL_EROSION,
  R100_SPATIAL_ANCHORS, R100_SPATIAL_MATERIALS, R100_SPATIAL_ORGANIZATIONS, R100_SPATIAL_AUTHORED_GROUPS } from '../../src/generated/r100-spatial-data.ts';
import { R100_SPATIAL_DEPLOYMENT } from '../../src/generated/rift-spatial-deployment-data.ts';
const arg = process.argv.indexOf('--report'); assert(arg >= 0 && process.argv[arg + 1], '--report required');
const report = process.argv[arg + 1]; assert(!existsSync(report), 'Never overwrite earlier evidence');
const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = path => ({ path, sha256: sha(readFileSync(path)) });
const cases = [], mutations = []; let failure;
try {
  const saved = ['cinder-ridge', 'monolith-sill', 'woven-quarters', 'rib-vault', 'quiet-spur'].map(world => {
    const recipe = JSON.parse(JSON.stringify(createR100ProductionRecipe(world, 20261010, 'medium')));
    const policy = structuredClone(recipe.spatialPolicy); policy.sourceHash = 'a'.repeat(64);
    assert(validR100SpatialPolicy(policy, world), 'Snapshot structural validity must not compare live CSV digest');
    return { world, recipe, bytes: JSON.stringify(recipe), definition: createR100SpatialDefinition(recipe.nativeDefinition, recipe.spatialPolicy, recipe.requestedSeed) };
  });
  // Only this Node process is changed. No repository, save or runtime terrain is modified.
  R100_SPATIAL_CONFIG.cols += 1; R100_SPATIAL_CONFIG.placement_jitter_px += 1;
  mutations.push('config dimensions/jitter');
  for (const placement of R100_SPATIAL_PLACEMENTS) placement.x += 64;
  mutations.push('generic and special placement catalog');
  for (const world of R100_SPATIAL_WORLDS) { world.mirrorX = !world.mirrorX; world.organization = 'unknown-live-organization'; }
  mutations.push('world assignments and mirrors');
  for (const cut of R100_SPATIAL_EROSION) cut.points[0].x += 1;
  for (const start of R100_SPATIAL_ANCHORS) start.x += 1;
  for (const material of R100_SPATIAL_MATERIALS) material.lengthScale += .01;
  mutations.push('generic cuts, spawn anchors and material scaling');
  for (const organization of R100_SPATIAL_ORGANIZATIONS) { organization.solidCount += 1; organization.materialScaling = !organization.materialScaling; }
  mutations.push('organization rules and counts');
  for (const group of R100_SPATIAL_AUTHORED_GROUPS) {
    group.transform.scale += .01; group.transform.targetX += 1;
    group.solidCount += 1; group.placements[0].x += 1; group.erosion[0][0].x += 1;
  }
  mutations.push('authored group transform, counts, placements and compiled cuts');
  R100_SPATIAL_DEPLOYMENT.node_spacing_px += 16;
  mutations.push('deployment policy');
  for (const item of saved) {
    assert.equal(JSON.stringify(item.recipe), item.bytes, `${item.world}: frozen recipe aliases live catalog`);
    assert(validR100ProductionRecipe(item.recipe), `${item.world}: current values invalidate saved snapshot`);
    const rebuilt = createR100SpatialDefinition(item.recipe.nativeDefinition, item.recipe.spatialPolicy, item.recipe.requestedSeed);
    assert.deepEqual(rebuilt, item.definition, `${item.world}: frozen definition reads live placement/cut data`);
    cases.push({ world: item.world, grade: 'medium', organization: item.recipe.spatialPolicy.organization,
      sourceMode: item.recipe.spatialPolicy.organizationRules.sourceMode, dependencyHash: item.recipe.package.dependencyHash,
      savedRecipeHash: sha(item.bytes), definitionHash: sha(JSON.stringify(rebuilt)),
      maxErosionVertices: Math.max(...rebuilt.definition.erosion.map(p => p.length)) });
  }
  // Proves mutations were effective, rather than an empty test against immutable imports.
  assert.throws(() => createR100ProductionRecipe('quiet-spur', 20261010, 'medium'), /No spatial organization rules/);
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
mkdirSync(dirname(report), { recursive: true }); writeFileSync(report, JSON.stringify({ status: failure ? 'failed' : 'pass', cases, mutations, failure,
  sources: ['src/generation/world-study/r100-package.ts', 'src/generation/world-study/r100-spatial-world.ts',
    'src/generation/world-study/r100-spatial-deployment.ts', 'src/generation/world-study/native-volume-erosion.ts',
    'src/generated/r100-spatial-data.ts', 'src/generated/rift-spatial-deployment-data.ts', 'src/generated/r100-package-manifest.ts',
    'tools/recovery/check-native-r100-revision7-freezing.mjs'].map(receipt),
  checks: ['structurally valid non-current sourceHash accepted', 'all snapshot bytes remain unchanged after live catalog mutation',
    'saved package remains valid', 'exact frozen spatial definition including compiled cuts remains unchanged', 'live mutations demonstrably affect new factory call'],
  scope: 'Five representative saved snapshots, JSON ownership, validation and lightweight definition construction. No full terrain/surface regeneration, persistence IO or visual qualification.' }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw new Error(failure);
console.log(`PASS ${cases.length} frozen r7 snapshots and definitions after ${mutations.length} categories of isolated catalog mutation`);
