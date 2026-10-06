/** Compare all prior52 current packages to independently verified immutable
 * map and surface hashes. Only the current map/bake runs; old oracles stay cold. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { bakeMasterWorldSurface } from '../../src/systems/r100-world/surface-bake';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import type { WorldProductionMap } from '../../src/generation/world-study/production-map';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';
import type { PollutionGrade } from '../../src/generation/world-study/pollution-grade';

const arg = (flag: string): string => { const at = process.argv.indexOf(flag); assert(at >= 0 && process.argv[at + 1], `${flag} required`); return process.argv[at + 1]!; };
const out = arg('--report'), referencePath = arg('--reference'), sourcePath = arg('--source'); assert(!fs.existsSync(out), 'Preserve prior continuity attempts');
const sha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const receipt = (file: string) => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8')) as {
  status: string; mode: string; previousExecutor: { path: string; sha256: string }; projectedExecutor: { path: string; sha256: string };
  priorReport: { path: string; sha256: string }; reference: { path: string; sha256: string };
  cases: { world: string; grade: PollutionGrade; seed: number; comparablePayloadHash: string; surface: Record<string, string> }[];
};
assert.equal(reference.status, 'pass'); assert.equal(reference.mode, 'full-52x3'); assert.equal(reference.cases.length, 156);
for (const source of [reference.previousExecutor, reference.projectedExecutor, reference.priorReport, reference.reference])
  assert.equal(sha(fs.readFileSync(source.path)), source.sha256, `Changed original continuity input: ${source.path}`);
const prior = JSON.parse(fs.readFileSync(reference.priorReport.path, 'utf8')) as {
  cases: { world: string; grade: PollutionGrade; identity: { generation: WorldProductionRecipeV3 } }[];
};
assert.equal(prior.cases.length, 156);
assert.equal(new Set(reference.cases.map(row => `${row.world}/${row.grade}`)).size, 156);
assert.equal(new Set(prior.cases.map(row => `${row.world}/${row.grade}`)).size, 156);
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item)
  ? { type: item.constructor.name, bytes: Buffer.from(item.buffer, item.byteOffset, item.byteLength).toString('base64') }
  : item instanceof Map ? [...item.entries()] : item);
const comparable = (world: WorldProductionMap) => ({ ...world,
  native: { ...world.native, packageHash: 'identity-only', algorithmRevision: undefined },
  metadata: { ...world.metadata, signature: 'identity-only' } });
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as {
  verifiedCopyHashes: boolean; patches: unknown[]; temporaryRoot: string; sources: Record<string, string>;
};
const frozenSource = receipt(sourcePath);
assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
const verifySource = (): void => {
  assert.equal(sha(fs.readFileSync(sourcePath)), frozenSource.sha256);
  for (const [file, expected] of Object.entries(source.sources)) {
    assert.equal(sha(fs.readFileSync(file)), expected, `Runtime differs from frozen input: ${file}`);
    assert.equal(sha(fs.readFileSync(path.join(source.temporaryRoot, file))), expected, `Frozen copy changed: ${file}`);
  }
};
const cases: unknown[] = [];
let failure: string | undefined;
try {
  verifySource();
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
  for (const row of reference.cases) {
    const old = prior.cases.find(item => item.world === row.world && item.grade === row.grade)!.identity.generation;
    assert.equal(old.requestedSeed, row.seed); assert(validR100ProductionRecipe(old), 'Original saved recipe still admitted');
    const current = createR100ProductionRecipe(row.world, row.seed, row.grade);
    assert.equal(current.package.algorithmRevision, 6); assert(validR100ProductionRecipe(current));
    const { package: _oldIdentity, ...oldFields } = old, { package: _newIdentity, ...currentFields } = current;
    assert.deepEqual(currentFields, oldFields, `${row.world}/${row.grade} old authored recipe exact`);
    assert.deepEqual(current.package.materials, old.package.materials, 'Empty organization adds no dependency key or changes existing atoms');
    const world = createR100ProductionMap(current), payloadHash = sha(canonical(comparable(world)));
    assert.equal(payloadHash, row.comparablePayloadHash, `${row.world}/${row.grade} geometry/content exact`);
    const families = Object.fromEntries([...new Set([current.nativeDefinition.family,
      ...current.nativeDefinition.instances.map(instance => instance.family ?? current.nativeDefinition.family)])]
      .map(family => [family, paintings.get(family)!]));
    const painting = { ...paintings.get(current.nativeDefinition.family)!, families };
    const surface = bakeMasterWorldSurface(hydrateR100MasterWorld(world.native!, world.layout), painting);
    const hashes: Record<string, string> = {};
    for (const key of ['albedo', 'normal', 'response', 'emission'] as const) {
      hashes[key] = sha(surface[key]); assert.equal(hashes[key], row.surface[key], `${row.world}/${row.grade} original ${key} bytes`);
    }
    cases.push({ world: row.world, grade: row.grade, seed: row.seed, comparablePayloadHash: payloadHash,
      surface: hashes, revision6DependencyHash: current.package.dependencyHash });
    console.log(`PASS original52 current revision6 continuity: ${row.world}/${row.grade}`);
  }
  verifySource();
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ status: failure ? 'failed' : 'pass', mode: 'full-original52-current6',
  reference: receipt(referencePath), sourceBeforeAndAfterExact: !failure, frozenSource, sourceFileCount: Object.keys(source.sources).length,
  harness: receipt('tools/world-study/check-r100-current-continuity.ts'), plannedCases: 156, cases, failure,
  scope: 'Original52 saved recipes/material dependencies and current6 map/fourRGBA exact. Reuses verified original hashes without historical map/bake execution; requires independent source continuity to inherit broad seed/gameplay evidence.' }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw new Error(failure);
console.log(`PASS ${cases.length} original52 current6 recipe/map/fourRGBA cases; historical executors not rerun.`);
