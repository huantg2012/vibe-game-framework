/** Current r7 snapshot integrity/size and authored-group contract; no map raster. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds.ts';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package.ts';
import { createR100SpatialDefinition, validR100SpatialPolicy } from '../../src/generation/world-study/r100-spatial-world.ts';
import { validateNativeErosion, validateNativeGroundEdgeOwnership } from '../../src/generation/world-study/native-volume-erosion.ts';
const arg = process.argv.indexOf('--report'); assert(arg >= 0 && process.argv[arg + 1], '--report required');
const report = process.argv[arg + 1]; assert(!existsSync(report), 'Never overwrite earlier evidence');
const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = path => ({ path, sha256: sha(readFileSync(path)) });
const cases = [], boundaryChecks = [], semanticChecks = []; let failure;
function rejectMutation(recipe, name, mutate) {
  const changed = structuredClone(recipe); mutate(changed.spatialPolicy);
  assert(!validR100ProductionRecipe(changed), `${recipe.package.id}/${recipe.package.grade}: accepted changed ${name}`);
  return name;
}
function ring(count) { return Array.from({ length: count }, (_, i) => ({ x: 128 + 64 * Math.cos(i * 2 * Math.PI / count), y: 128 + 64 * Math.sin(i * 2 * Math.PI / count) })); }
try {
  for (const world of R100_NATIVE_WORLDS) for (const grade of ['low', 'medium', 'severe']) {
    const recipe = createR100ProductionRecipe(world.id, 20261010, grade);
    assert.equal(recipe.package.algorithmRevision, 7); assert(recipe.spatialPolicy);
    assert(validR100ProductionRecipe(recipe), `${world.id}/${grade}`);
    const saved = JSON.parse(JSON.stringify(recipe)); assert.deepEqual(saved, recipe);
    assert(validR100ProductionRecipe(saved), 'JSON round trip must retain the package');
    const size = JSON.stringify(recipe).length; assert(size <= 60000);
    const policy = recipe.spatialPolicy;
    const integrityMutations = [
      ['sourceHash', p => { p.sourceHash = p.sourceHash === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64); }],
      ['placementJitterPx', p => { p.placementJitterPx += 1; }],
      ['organization', p => { p.organization = 'unknown'; }],
      ['organizationRules.sourceMode', p => { p.organizationRules.sourceMode = p.organizationRules.sourceMode === 'repeat' ? 'source-once' : 'repeat'; }],
      ['organizationRules.materialScaling', p => { p.organizationRules.materialScaling = !p.organizationRules.materialScaling; }],
      ['organizationRules.solidCount', p => { p.organizationRules.solidCount += 1; }],
      ['organizationRules.reliefCount', p => { p.organizationRules.reliefCount += 1; }],
      ['placement.x', p => { p.placements[0].x += .125; }],
      ['placement.sourceIndex', p => { p.placements[0].sourceIndex += 1; }],
      ['erosion.point', p => { p.erosion[0][0].x += .125; }],
      ['erosion.missingPolygon', p => { p.erosion.pop(); }],
      ['spawnCandidate', p => { p.spawnCandidates[0].x += 1; }],
      ['extraction.minPathDistancePx', p => { p.extraction.minPathDistancePx += 1; }],
    ].map(([name, mutate]) => rejectMutation(recipe, name, mutate));
    if (policy.groupTransform) for (const key of ['scale', 'sourceX', 'sourceY', 'targetX', 'targetY']) {
      integrityMutations.push(rejectMutation(recipe, `groupTransform.${key}`, p => { p.groupTransform[key] += .001; }));
    }
    for (const key of ['organizationRules', 'groupTransform', 'erosion']) {
      integrityMutations.push(rejectMutation(recipe, `missing.${key}`, p => { delete p[key]; }));
    }
    const missing = structuredClone(recipe); delete missing.spatialPolicy;
    assert(!validR100ProductionRecipe(missing), 'r7 cannot omit spatial policy');
    rejectMutation(recipe, 'foreignWorld', p => { p.worldId = 'invalid-world'; });
    const { definition } = createR100SpatialDefinition(saved.nativeDefinition, saved.spatialPolicy, saved.requestedSeed);
    validateNativeGroundEdgeOwnership(definition);
    if (policy.organizationRules.sourceMode === 'source-once') {
      assert.equal(definition.instances.length, recipe.nativeDefinition.instances.length);
      const transformed = new Map(definition.instances.map(instance => [instance.id, instance]));
      for (const placement of policy.placements) {
        const source = recipe.nativeDefinition.instances.filter(instance => instance.role === placement.role)[placement.sourceIndex];
        const actual = transformed.get(placement.id); assert(actual);
        for (const key of Object.keys(source).filter(key => !['id', 'x', 'y', 'rotation', 'length', 'width'].includes(key))) {
          assert.deepEqual(actual[key], source[key], `${world.id}/${grade}: preserved ${source.id}.${key}`);
        }
        if (policy.groupTransform) {
          const group = policy.groupTransform;
          assert.equal(actual.id, source.id); assert.equal(actual.rotation, source.rotation);
          for (const [key, expected] of [
            ['x', group.targetX + (source.x - group.sourceX) * group.scale],
            ['y', group.targetY + (source.y - group.sourceY) * group.scale],
            ['length', source.length * group.scale], ['width', source.width * group.scale],
          ]) assert(Math.abs(actual[key] - expected) < 1e-6, `${world.id}/${grade}: uniform group ${key}`);
        }
      }
    }
    cases.push({ world: world.id, grade, characters: size, dependencyHash: recipe.package.dependencyHash,
      spatialSourceHash: policy.sourceHash, spatialPolicyHash: sha(JSON.stringify(policy)),
      organization: policy.organization, sourceMode: policy.organizationRules.sourceMode,
      groupTransform: policy.groupTransform, instanceCount: definition.instances.length,
      compiledErosionHash: sha(JSON.stringify(policy.erosion)), maxErosionVertices: Math.max(...policy.erosion.map(p => p.length)), integrityMutations });
  }
  assert.equal(cases.length, 324);
  assert.equal(cases.filter(row => row.organization === 'authored-group').length, 258);
  for (const [name, count, width, height, accepted] of [
    ['source32', 32, 1024, 768, true], ['source33', 33, 1024, 768, false],
    ['expanded32', 32, 2304, 1792, true], ['expanded33', 33, 2304, 1792, false],
    ['otherWidth33', 33, 2305, 1792, false], ['otherHeight33', 33, 2304, 1791, false],
  ]) {
    const check = () => validateNativeErosion([ring(count)], width, height);
    if (accepted) assert.doesNotThrow(check, name); else assert.throws(check, /polygon requires/, name);
    boundaryChecks.push({ name, count, width, height, accepted });
  }
  const authored = createR100ProductionRecipe('quiet-spur', 20261010, 'medium');
  assert(Math.max(...authored.spatialPolicy.erosion.map(p => p.length)) <= 32, 'Merged sea-mouth remains within original vertex budget');
  const offGroup = structuredClone(authored.spatialPolicy); offGroup.placements[0].x += .01;
  assert(validR100SpatialPolicy(offGroup, 'quiet-spur'), 'Structural check alone does not prove affine placement');
  assert.throws(() => createR100SpatialDefinition(authored.nativeDefinition, offGroup, authored.requestedSeed), /diverges from its frozen source transform/);
  semanticChecks.push('quiet-spur merged shore fits unchanged32-vertex budget', 'inconsistent affine placement rejected by definition construction');
  const repeatedSource = structuredClone(authored.spatialPolicy);
  const solidPlacements = repeatedSource.placements.filter(p => p.role === 'solid'); solidPlacements[1].sourceIndex = solidPlacements[0].sourceIndex;
  assert(!validR100SpatialPolicy(repeatedSource, 'quiet-spur')); semanticChecks.push('source-once duplicate sourceIndex rejected');
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
mkdirSync(dirname(report), { recursive: true }); writeFileSync(report, JSON.stringify({ status: failure ? 'failed' : 'pass', cases, failure,
  maxRecipeCharacters: Math.max(...cases.map(row => row.characters)), budgetCharacters: 60000, boundaryChecks, semanticChecks,
  sources: ['src/generation/world-study/r100-package.ts', 'src/generation/world-study/production-recipe.ts',
    'src/generation/world-study/r100-spatial-world.ts', 'src/generation/world-study/r100-spatial-types.ts',
    'src/generation/world-study/native-volume-erosion.ts', 'src/generated/r100-spatial-data.ts',
    'src/generated/r100-package-manifest.ts', 'data/rift-spatial-organizations.csv', 'data/rift-spatial-authored-groups.csv',
    'data/rift-spatial-authored-erosion.csv', 'tools/world-study/codegen-r100-spatial.mjs', 'tools/world-study/build-r100-authored-shores.py',
    'src/generation/world-study/r100-spatial-deployment.ts', 'src/generated/rift-spatial-deployment-data.ts',
    'tools/recovery/check-native-r100-revision7-recipes.mjs'].map(receipt),
  checks: ['324 r7 snapshots + JSON round trip', 'new rules/transform/cut field mutations rejected', 'missing/foreign policy rejected',
    'source-once instance properties and ground-edge ownership', '258 uniform authored-group definitions', '60,000-character budget',
    'unchanged32-vertex limit for source/expanded/other dimensions', 'affine mismatch and duplicate-source rejection'],
  scope: 'Recipe integrity and lightweight definition construction only; not complete runtime maps, surface pixels, art or gameplay qualification.' }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw new Error(failure);
console.log(`PASS ${cases.length} r7 snapshots; 258 authored-group definitions; max ${Math.max(...cases.map(row => row.characters))}/60000 characters; vertex-boundary/semantic cases`);
