/** Revision 5 recovery uses real saved identities. Revision 6 may only change
 * the identity receipt of these existing worlds, never their map or pixels. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createR100ProductionRecipe as previousRecipe, createR100ProductionMap as previousMap,
  bakeMasterWorldSurface as previousBake } from '../../src/generation/legacy-r100-v5/executor.js';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { bakeMasterWorldSurface } from '../../src/systems/r100-world/surface-bake';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';
import type { WorldProductionMap } from '../../src/generation/world-study/production-map';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import type { PollutionGrade } from '../../src/generation/world-study/pollution-grade';

const priorPath = 'docs/qa/artifacts/r100-i09/production-final52-recheck/report.json';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8')) as { status: string; cases: {
  world: string; grade: PollutionGrade; identity: { signature: string; generation: WorldProductionRecipeV3 }; }[] };
assert.equal(prior.status, 'passed'); assert.equal(prior.cases.length, 156);
assert.equal(new Set(prior.cases.map(row => `${row.world}/${row.grade}`)).size, 156);
const smokeWorlds = ['rib-vault', 'pleated-hide', 'blister-field', 'monolith-sill', 'chalk-steps', 'wax-tongues'];
const full = process.argv.includes('--full');
const frozenOnly = process.argv.includes('--frozen-only');
const selected = prior.cases.filter(row => full || smokeWorlds.some((id, index) => id === row.world
  && row.grade === (['low', 'medium', 'severe'] as const)[index % 3]));
assert.equal(selected.length, full ? 156 : 6);
const reportFlag = process.argv.indexOf('--report');
const output = reportFlag < 0 ? null : process.argv[reportFlag + 1]!;
if (output) assert(!fs.existsSync(output), 'Preserve previous attempts; choose a new report path');
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item)
  ? { type: item.constructor.name, bytes: Buffer.from(item.buffer, item.byteOffset, item.byteLength).toString('base64') }
  : item instanceof Map ? [...item.entries()] : item);
const comparable = (world: WorldProductionMap) => ({ ...world,
  native: { ...world.native, packageHash: 'identity-only', algorithmRevision: undefined },
  metadata: { ...world.metadata, signature: 'identity-only' } });
const cases: unknown[] = [];
let failure: string | undefined;
try {
  // All actual saved recipes, including their integrity receipts, remain valid.
  for (const row of prior.cases) {
    const old = row.identity.generation;
    assert.equal(old.package.algorithmRevision, 5); assert(validR100ProductionRecipe(old));
    assert.deepEqual(previousRecipe(row.world, old.requestedSeed, row.grade), old);
    const current = createR100ProductionRecipe(row.world, old.requestedSeed, row.grade);
    assert.equal(current.package.algorithmRevision, 6); assert(validR100ProductionRecipe(current));
    const { package: _oldPackage, ...oldFields } = old, { package: _newPackage, ...newFields } = current;
    assert.deepEqual(newFields, oldFields, `${row.world}/${row.grade}: authored recipe unchanged`);
    const forged = { ...structuredClone(old), package: { ...old.package, algorithmRevision: 6 } };
    assert(!validR100ProductionRecipe(forged), 'Old receipt cannot be relabeled as revision 6');
    const mutated = { ...structuredClone(old), contentDefinition: { ...old.contentDefinition,
      kindling_deep_value: old.contentDefinition.kindling_deep_value + 1 } };
    assert(!validR100ProductionRecipe(mutated), 'Old rule changes must be rejected');
    const future = structuredClone(current);
    (future.package as { algorithmRevision: number }).algorithmRevision = 7;
    assert(!validR100ProductionRecipe(future), 'Unknown executor cannot be admitted');
  }
  const paintings = new Map<string, PaintedMaterial>();
  for (const row of PAINTED_MATERIALS) {
    const decode = async (source: typeof row | typeof row.solid): Promise<PaintedSurface> => ({
      width: source.logical_pixels, height: source.logical_pixels, source: source.source,
      worldSize: source.world_size, regions: source.regions,
      pixels: new Uint8ClampedArray(await sharp(`public${source.source}`).resize(source.logical_pixels,
        source.logical_pixels).ensureAlpha().raw().toBuffer()),
    });
    paintings.set(row.family, { ...await decode(row), solid: { ...await decode(row.solid),
      skinRoughness: row.solid.skinRoughness, cutRoughness: row.solid.cutRoughness,
      gain: row.solid.gain, cutGain: row.solid.cutGain } });
  }
  for (const row of selected) {
    const old = row.identity.generation, current = createR100ProductionRecipe(row.world, old.requestedSeed, row.grade);
    const before = previousMap(old), recovered = createR100ProductionMap(structuredClone(old));
    const after = frozenOnly ? undefined : createR100ProductionMap(current);
    assert.equal(canonical(recovered), canonical(before), `${row.world}: frozen payload exact`);
    assert.equal(generatedRiftIdentity(recovered.layout, old, recovered).signature, row.identity.signature,
      `${row.world}: actual prior browser identity exact`);
    if (after) assert.equal(canonical(comparable(after)), canonical(comparable(before)), `${row.world}: new geometry/content exact`);
    const families = Object.fromEntries([...new Set([old.nativeDefinition.family,
      ...old.nativeDefinition.instances.map(instance => instance.family ?? old.nativeDefinition.family)])]
      .map(family => [family, paintings.get(family)!]));
    const painting = { ...paintings.get(old.nativeDefinition.family)!, families };
    const a = previousBake(hydrateR100MasterWorld(before.native!, before.layout), painting);
    const b = bakeMasterWorldSurface(hydrateR100MasterWorld(recovered.native!, recovered.layout), painting);
    const c = after ? bakeMasterWorldSurface(hydrateR100MasterWorld(after.native!, after.layout), painting) : undefined;
    const surface: Record<string, string> = {};
    for (const key of ['albedo', 'normal', 'response', 'emission'] as const) {
      assert.deepEqual(b[key], a[key], `${row.world}: old ${key} pixels`);
      if (c) assert.deepEqual(c[key], a[key], `${row.world}: new ${key} pixels`);
      surface[key] = sha(a[key]);
    }
    cases.push({ world: row.world, grade: row.grade, seed: old.requestedSeed, signature: row.identity.signature,
      oldPayloadExact: true, currentGeometryAndContentExact: after ? true : null, surface });
    console.log(`PASS revision5 exact recovery${after ? ' + revision6 equivalent' : ''}: ${row.world}/${row.grade}`);
  }
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ status: failure ? 'failed' : 'pass', mode: full ? 'full-52x3' : 'six-profile-smoke', frozenOnly,
    executors: ['src/generation/legacy-r100-v5/executor.js', 'src/generation/legacy-r100-v5/executor-revision5.js'].map(file => ({ path: file, sha256: sha(fs.readFileSync(file)) })),
    harness: { path: 'tools/world-study/check-r100-revision5.ts', sha256: sha(fs.readFileSync('tools/world-study/check-r100-revision5.ts')) },
    priorReport: { path: priorPath, sha256: sha(fs.readFileSync(priorPath)) }, priorRecipes: 156,
    plannedMapCases: selected.length, cases, failure,
    scope: 'Saved revision5 recipe validation and bounded exact map/surface comparisons. Not new-world qualification or gameplay approval.' }, null, 2) + '\n', { flag: 'wx' });
}
if (failure) throw new Error(failure);
console.log(`PASS 156 saved recipes; ${cases.length} exact map/recovery/four-surface cases.`);
