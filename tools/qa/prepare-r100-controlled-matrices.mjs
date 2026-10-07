/** Freeze the two final I11 controlled-contract executors. Does not run or approve them. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = file => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const arg = name => {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), `${name} required`);
  return process.argv[index + 1];
};
const sourcePath = path.resolve(arg('--source')), output = path.resolve(arg('--output'));
const sourceReceipt = receipt(sourcePath);
const source = read(sourcePath), frozen = source.temporaryRoot;
assert(source.verifiedCopyHashes === true);
assert.deepEqual(source.patches, []);
assert(!fs.existsSync(output), 'Never overwrite a prepared or failed execution');
const verifyFrozen = () => {
  assert.equal(receipt(sourcePath).sha256, sourceReceipt.sha256, 'Frozen source manifest changed');
  for (const [file, expected] of Object.entries(source.sources)) {
    assert.equal(sha(fs.readFileSync(path.join(frozen, file))), expected, `Frozen input changed: ${file}`);
  }
};
verifyFrozen();
const csvPath = 'data/rift-native-worlds.csv';
assert(source.sources[csvPath]);
const worldIds = fs.readFileSync(path.join(frozen, csvPath), 'utf8').trim().split(/\r?\n/).slice(1).map(row => row.split(',')[0]);
assert.equal(worldIds.length, 108, 'Final matrix preparation requires all108 authored worlds');
assert.equal(new Set(worldIds).size, 108);
const planPath = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const plan = read(planPath), planReceipt = receipt(planPath);
assert.equal(plan.status, 'frozen');
assert.equal(planReceipt.sha256, 'd493aeb9d26b4758c90434c8c5a8cdfb74fb581800a2c37a50ae3b2eb91f0c25');
const plannedWorldIds = [...plan.baseline.worlds, ...plan.batches.flatMap(batch => batch.worlds)];
assert.equal(new Set(plannedWorldIds).size, 108);
assert.deepEqual([...worldIds].sort(), [...plannedWorldIds].sort(), 'Final worlds must match the frozen qualification plan');
const ability = plan.i11ContractMatrix.abilitySource;
assert.equal(source.sources[ability.path], ability.sha256, 'Frozen ability CSV must match the original matrix');
const stage = path.join(output, 'sources');
fs.mkdirSync(stage, { recursive: true });
for (const directory of ['src', 'data']) fs.symlinkSync(path.join(frozen, directory), path.join(stage, directory), 'dir');
const copy = file => {
  const bytes = fs.readFileSync(file), target = path.join(stage, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  return { original: file, target, sha256: sha(bytes) };
};
const planCopy = copy(planPath), stub = copy('tools/contam-preview/phaser-stub.ts');
const copied = [planCopy, stub], commands = [];
for (const [kind, entry, cases] of [
  ['capability', 'tools/qa/check-r100-cross-world-capabilities.ts', 1536],
  ['presentation', 'tools/qa/check-r100-presentation-phases.ts', 15552],
]) {
  const harness = copy(entry); copied.push(harness);
  const compiled = await build({ entryPoints: [harness.target], bundle: true, write: false, metafile: true,
    platform: 'node', format: 'esm', target: 'node22', external: ['esbuild'],
    // Final coverage is a compiled requirement, not an optional shell setting.
    // The presentation executor rejects a subset and a stale generated catalog.
    define: { 'process.env.QA_MATRIX_FINAL': '"1"' },
    tsconfigRaw: { compilerOptions: { target: 'ES2020', useDefineForClassFields: true,
      baseUrl: frozen, paths: { '@/*': ['src/*'], phaser: [stub.target] } } } });
  const dependencies = Object.keys(compiled.metafile.inputs).sort().map(file => {
    const absolute = path.resolve(file), captured = [harness, stub].find(row => row.target === absolute);
    if (captured) {
      assert.equal(sha(fs.readFileSync(absolute)), captured.sha256);
      return { path: captured.original, sha256: captured.sha256, origin: 'copied-harness' };
    }
    const relative = path.relative(frozen, absolute).split(path.sep).join('/');
    assert(!relative.startsWith('../') && source.sources[relative], `Unfrozen runtime dependency: ${file}`);
    assert.equal(sha(fs.readFileSync(absolute)), source.sources[relative]);
    return { path: relative, sha256: source.sources[relative], origin: 'immutable-runtime' };
  });
  const bytes = compiled.outputFiles[0].contents, executor = path.join(output, `${kind}-${sha(bytes).slice(0, 12)}.mjs`);
  fs.writeFileSync(executor, bytes, { flag: 'wx' });
  commands.push({ kind, expectedCases: cases, command: process.execPath,
    args: [executor, path.join(output, `${kind}-report.json`)], cwd: stage,
    unsetEnvironment: ['QA_WORLDS'], finalCoverageCompiled: true, executor: receipt(executor), dependencies });
}
verifyFrozen();
for (const copiedFile of copied) {
  assert.equal(sha(fs.readFileSync(copiedFile.original)), copiedFile.sha256, 'Harness changed during preparation');
  assert.equal(sha(fs.readFileSync(copiedFile.target)), copiedFile.sha256);
}
const result = { status: 'prepared-not-run', frozenRuntime: sourceReceipt, qualificationPlan: planReceipt,
  worldIds, copiedInputs: copied, commands,
  executionRequirements: ['Coordinator-approved single CPU window; never alongside exclusive performance measurements.',
    'Unchanged source/plan/executor hashes before and after every process; preserve every exit and original report.',
    'Require1536 capability cases and15552 presentation cases with exact108world/324grade/8direction/6phase coverage.',
    'Recorded renderer only; no GPU, normal visual quality, actual input journey or listening approval.'],
  tool: receipt('tools/qa/prepare-r100-controlled-matrices.mjs') };
fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, worlds: worldIds.length,
  executors: commands.map(row => ({ kind: row.kind, dependencies: row.dependencies.length, cases: row.expectedCases })) }));
