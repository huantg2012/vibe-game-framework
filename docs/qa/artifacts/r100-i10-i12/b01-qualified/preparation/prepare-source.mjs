/** Prepare commands and one CPU executor from the browser's frozen source.
 * Preparation never marks a batch ready and never runs a qualification case. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { validateExpansionPlan } from './check-r100-expansion-plan.mjs';

const root = process.cwd(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = file => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const arg = name => { const at = process.argv.indexOf(name); assert(at >= 0 && process.argv[at + 1], `${name} required`); return process.argv[at + 1]; };
const manifestPath = arg('--source'), batchId = arg('--batch'), out = path.resolve(arg('--output'));
const planPath = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json', plan = read(planPath);
validateExpansionPlan(plan); assert.equal(plan.status, 'frozen');
const batch = plan.batches.find(row => row.id === batchId); assert(batch && batch.worlds.length === 4);
assert(!fs.existsSync(out), 'Never overwrite a prepared source or attempt');
const source = read(manifestPath), frozen = source.temporaryRoot;
assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
const verifyFrozen = () => { for (const [file, expected] of Object.entries(source.sources))
  assert.equal(sha(fs.readFileSync(path.join(frozen, file))), expected, `Frozen source changed: ${file}`); };
verifyFrozen();
const harnessPath = 'tools/world-study/check-r100-library.ts';
const stubPath = 'tools/contam-preview/phaser-stub.ts';
const harness = fs.readFileSync(harnessPath, 'utf8'), stub = fs.readFileSync(stubPath);
fs.mkdirSync(out, { recursive: true });
const frozenHarness = path.join(out, 'sources', harnessPath), frozenStub = path.join(out, 'sources', stubPath);
for (const [file, bytes] of [[frozenHarness, harness], [frozenStub, stub]]) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { flag: 'wx' }); }
const virtualEntry = path.join(frozen, harnessPath);
const compiled = await build({ stdin: { contents: harness, sourcefile: virtualEntry,
  resolveDir: path.dirname(virtualEntry), loader: 'ts' }, bundle: true, write: false, metafile: true,
  platform: 'node', format: 'esm', target: 'node22', external: ['esbuild'],
  tsconfigRaw: { compilerOptions: { target: 'ES2020', useDefineForClassFields: true,
    baseUrl: frozen, paths: { '@/*': ['src/*'], phaser: [frozenStub] } } } });
const dependencies = [];
for (const file of Object.keys(compiled.metafile.inputs).sort()) {
  const absolute = path.resolve(file);
  if (absolute === virtualEntry) { dependencies.push(receipt(harnessPath)); continue; }
  if (absolute === frozenStub) { dependencies.push(receipt(stubPath)); continue; }
  const relative = path.relative(frozen, absolute).split(path.sep).join('/');
  assert(!relative.startsWith('../') && source.sources[relative], `Unfrozen CPU dependency: ${file}`);
  assert.equal(sha(fs.readFileSync(absolute)), source.sources[relative]);
  dependencies.push({ path: relative, sha256: source.sources[relative] });
}
assert(dependencies.some(row => row.path === harnessPath));
assert(dependencies.some(row => row.path === 'src/generation/world-study/r100-package.ts'));
verifyFrozen(); assert.equal(sha(fs.readFileSync(harnessPath)), sha(harness)); assert.equal(sha(fs.readFileSync(stubPath)), sha(stub));
const bytes = compiled.outputFiles[0].contents, executorSha256 = sha(bytes);
const executor = path.join(out, `qualification-${executorSha256.slice(0, 12)}.mjs`);
fs.writeFileSync(executor, bytes, { flag: 'wx' });
fs.writeFileSync(path.join(out, 'source-snapshot.json'), JSON.stringify({ executor, sha256: executorSha256, dependencies,
  frozenRuntime: receipt(manifestPath), harness: receipt(harnessPath), stub: receipt(stubPath) }, null, 2) + '\n');
const batchRoot = path.dirname(out), executionPlan = path.join(batchRoot, 'execution-plan.json');
const baseArgs = [executor, '--executor', executor, '--worlds', batch.worlds.join(','), '--concurrency', '1', '--compact-report'];
const commands = { schemaVersion: 1, status: 'prepared-not-ready', batch: batchId, worlds: batch.worlds,
  qualificationPlan: receipt(planPath), source: receipt(manifestPath), executor: receipt(executor), executionPlan,
  readinessGate: 'Root normal-view approval must be recorded first. Create a separate exact execution copy with only this batch status ready, then validateExpansionExecutionPlan before any command.',
  generation: [
    { cases: 480, command: process.execPath, args: [...baseArgs, '--full', '--report', path.join(batchRoot, 'generation-full', 'report.json')] },
    { cases: 96, command: process.execPath, args: [...baseArgs, '--holdout', plan.generation.holdout.path, '--report', path.join(batchRoot, 'generation-holdout', 'report.json')] },
  ],
  play: { cases: 24, command: process.execPath, args: ['tools/qa/r100-i07-i09-coverage.mjs'],
    env: { GAME_URL: `http://127.0.0.1:${source.port}/`, QA_SOURCE_MANIFEST: manifestPath,
      QA_EXPANSION_PLAN: executionPlan, QA_BATCH_ID: batchId, QA_WORLDS: batch.worlds.join(','),
      QA_GRADES: plan.grades.join(','), QA_SEEDS: plan.actualPlay.seeds.join(','), QA_CONCURRENCY: '1',
      QA_RESOURCE_PAUSE_FILE: '/tmp/coh-r100-i10-i12.pause', QA_OUTPUT_DIR: path.join(batchRoot, 'play') } },
  resources: 'At most one CPU worker during one browser; performance requires exclusive CPU/browser. No command has run.',
  tool: receipt('tools/qa/prepare-r100-expansion-batch.mjs') };
fs.writeFileSync(path.join(out, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
console.log(JSON.stringify({ status: commands.status, batch: batchId, runtimeDependencies: dependencies.length,
  executorBytes: bytes.length, executorSha256, commands: path.join(out, 'commands.json') }));
