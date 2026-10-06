/** P19 recovery projection: compare exact maps to the retained first derivative,
 * and pixels to already verified original hashes. Never rebake the old oracle. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createR100ProductionMap as previousMap } from '../../src/generation/legacy-r100-v5/executor-revision5.js';
import { createR100ProductionMap, validR100ProductionRecipe, bakeMasterWorldSurface } from '../../src/generation/legacy-r100-v5/executor-recovery.js';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import type { WorldProductionMap } from '../../src/generation/world-study/production-map';
import type { MasterWorld } from '../../src/generation/world-study/r100-master-world';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';
import type { PollutionGrade } from '../../src/generation/world-study/pollution-grade';

const arg = (flag: string): string => { const at = process.argv.indexOf(flag); assert(at >= 0 && process.argv[at + 1], `${flag} required`); return process.argv[at + 1]!; };
const out = arg('--report'); assert(!fs.existsSync(out), 'Never overwrite an earlier result');
const full = process.argv.includes('--full');
const sha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const receipt = (file: string) => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const referencePath = 'docs/qa/artifacts/r100-i10-i12/p19-revision5-closure/exact-156.json';
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8')) as {
  status: string; mode: string; frozenOnly: boolean; executors: { path: string; sha256: string }[];
  cases: { world: string; grade: PollutionGrade; seed: number; surface: Record<string, string> }[];
};
assert.equal(reference.status, 'pass'); assert.equal(reference.mode, 'full-52x3'); assert.equal(reference.frozenOnly, true);
for (const source of reference.executors) assert.equal(sha(fs.readFileSync(source.path)), source.sha256);
const priorPath = 'docs/qa/artifacts/r100-i09/production-final52-recheck/report.json';
const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8')) as {
  cases: { world: string; grade: PollutionGrade; identity: { generation: WorldProductionRecipeV3 } }[];
};
assert.equal(prior.cases.length, 156); assert.equal(reference.cases.length, 156);
const smokeWorlds = ['rib-vault', 'pleated-hide', 'blister-field', 'monolith-sill', 'chalk-steps', 'wax-tongues'];
const selected = prior.cases.filter(row => full || smokeWorlds.some((id, index) => id === row.world
  && row.grade === (['low', 'medium', 'severe'] as const)[index % 3]));
assert.equal(selected.length, full ? 156 : 6);
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item)
  ? { type: item.constructor.name, bytes: Buffer.from(item.buffer, item.byteOffset, item.byteLength).toString('base64') }
  : item instanceof Map ? [...item.entries()] : item);
const comparable = (world: WorldProductionMap) => ({ ...world,
  native: { ...world.native, packageHash: 'identity-only', algorithmRevision: undefined },
  metadata: { ...world.metadata, signature: 'identity-only' } });
const cases: unknown[] = [];
let failure: string | undefined;
try {
  for (const row of prior.cases) assert(validR100ProductionRecipe(row.identity.generation), `${row.world}/${row.grade} saved recipe`);
  for (const revision of [undefined, null, 0, 1, 2, 3, 4, 6, 7, '5']) {
    const forged = structuredClone(prior.cases[0]!.identity.generation);
    (forged.package as unknown as Record<string, unknown>).algorithmRevision = revision;
    assert(!validR100ProductionRecipe(forged));
    assert.throws(() => createR100ProductionMap(forged), /Invalid or unavailable native world package/);
    assert.throws(() => bakeMasterWorldSurface({ algorithmRevision: revision, appearance: forged.appearance } as unknown as MasterWorld), /Revision 5 surface requires/);
  }
  const unknownWorld = structuredClone(prior.cases[0]!.identity.generation);
  (unknownWorld.package as unknown as Record<string, unknown>).id = 'r100-not-in-the-frozen-52';
  assert(!validR100ProductionRecipe(unknownWorld));
  assert.throws(() => bakeMasterWorldSurface({ algorithmRevision: 5 } as MasterWorld), /Revision 5 surface requires/);
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
    const old = row.identity.generation;
    const before = previousMap(old), after = createR100ProductionMap(old);
    const payloadHash = sha(canonical(before));
    assert.equal(sha(canonical(after)), payloadHash, `${row.world}: exact projected payload`);
    const ref = reference.cases.find(item => item.world === row.world && item.grade === row.grade);
    assert(ref); assert.equal(ref.seed, old.requestedSeed);
    const families = Object.fromEntries([...new Set([old.nativeDefinition.family,
      ...old.nativeDefinition.instances.map(instance => instance.family ?? old.nativeDefinition.family)])]
      .map(family => [family, paintings.get(family)!]));
    const painting = { ...paintings.get(old.nativeDefinition.family)!, families };
    const actual = bakeMasterWorldSurface(hydrateR100MasterWorld(after.native!, after.layout), painting);
    const surface: Record<string, string> = {};
    for (const key of ['albedo', 'normal', 'response', 'emission'] as const) {
      surface[key] = sha(actual[key]); assert.equal(surface[key], ref.surface[key], `${row.world}: original ${key} bytes`);
    }
    cases.push({ world: row.world, grade: row.grade, seed: old.requestedSeed, payloadHash,
      comparablePayloadHash: sha(canonical(comparable(before))), surface });
    console.log(`PASS projected revision5 map + original RGBA hashes: ${row.world}/${row.grade}`);
  }
} catch (error) { failure = error instanceof Error ? error.stack : String(error); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ status: failure ? 'failed' : 'pass', mode: full ? 'full-52x3' : 'six-profile-smoke',
  previousExecutor: receipt('src/generation/legacy-r100-v5/executor-revision5.js'),
  projectedExecutor: receipt('src/generation/legacy-r100-v5/executor-recovery.js'),
  reference: receipt(referencePath), priorReport: receipt(priorPath), harness: receipt('tools/world-study/check-r100-revision5-projection.ts'),
  originalRecipes: 156, rejectedRevisionVariants: 10, unknownCatalogIdRejected: true,
  mapHashSchema: 'JSON typed-array-base64 and map-entries v1; comparable clears only packageHash/revision/metadata.signature',
  plannedCases: selected.length, cases, failure,
  scope: 'Original saved revision5 recovery only. The previous immutable map is compared; original surface hashes are reused without rebaking. Not revision6 qualification or a browser claim.' }, null, 2) + '\n', { flag: 'wx' });
if (failure) throw new Error(failure);
console.log(`PASS projected closure: 156 old recipes; ${cases.length} exact map/four-RGBA-hash cases.`);
