// V4 corrects browser-storage origin transport only; v3 predeparture failure is immutable.
/** Source-only bridge: old12 plus exact actor-cache source36, same earned chain,
 * unchanged v2 journey/controller. Requires Director's qualified delta receipt. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';

const base = 'docs/qa/artifacts/r100-i14';
const root = `${base}/continuous/actor-cache-v4`, planFile = `${root}/policy-freeze.json`;
const parentPlan = `${base}/continuous/recovery-v2/policy-freeze.json`;
const journey = 'tools/world-study/r100-i14-continuous-v2-journey.mjs';
const wrapper = 'tools/world-study/run-r100-i14-continuous-v4.mjs';
const deltaFolder = `${base}/actor-occlusion`;
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({ file, sha256: sha(file) });
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const rawOf = storage => storage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value;
const verify = rows => { for (const row of rows) assert.equal(sha(row.file), row.sha256, row.file); };
const arg = key => { const i = process.argv.indexOf(key); return i < 0 ? null : process.argv[i + 1]; };
function predecessor(folder) {
  const reportFile = `${folder}/report.json`, storageFile = `${folder}/i14/browser-storage.json`, report = read(reportFile);
  assert.equal(report.realJourneyAttempts.length, 12);
  assert(report.realJourneyAttempts.every(row => row.status === 'completed-real-input'));
  const raw = rawOf(read(storageFile)), terminal = report.realJourneyAttempts.at(-1);
  assert.deepEqual(JSON.parse(raw), terminal.afterPreparation.state, 'Whole actual storage must equal the preceding terminal');
  assert.equal(JSON.parse(raw).inventory.run.status, 'settled');
  return { report, terminal, input: storageFile, rawSha256: createHash('sha256').update(raw).digest('hex'), reportRef: ref(reportFile) };
}
function mapOrigin(storage, targetOrigin) {
  assert.equal(new URL(targetOrigin).origin, targetOrigin);
  const mapped = structuredClone(storage), matches = mapped.origins.filter(origin => origin.localStorage.some(item => item.name === 'coh-save-v1'));
  assert.equal(matches.length, 1, 'Exactly one current-save origin required');
  assert.equal(new Set(mapped.origins.map(origin => origin.origin)).size, mapped.origins.length, 'Unique source origins');
  for (const origin of mapped.origins) assert.equal(new Set(origin.localStorage.map(item => item.name)).size, origin.localStorage.length, 'Unique keys within each origin');
  const index = mapped.origins.indexOf(matches[0]), previousOrigin = mapped.origins[index].origin;
  assert(!mapped.origins.some((origin, i) => i !== index && origin.origin === targetOrigin), 'Origin mapping may not merge stores');
  mapped.origins[index].origin = targetOrigin;
  const reverse = structuredClone(mapped); reverse.origins[index].origin = previousOrigin;
  assert.deepEqual(reverse, storage, 'Only the current-save carrier origin may change');
  assert.deepEqual(mapped.cookies, storage.cookies, 'All cookie fields unchanged');
  for (let i = 0; i < storage.origins.length; i++) assert.deepEqual(mapped.origins[i].localStorage, storage.origins[i].localStorage, 'Every key/value remains byte-for-byte equal');
  return { mapped, index, previousOrigin, targetOrigin };
}
function writeMappedInput(input, gameUrl, folder, prefix) {
  const storage = read(input), mapping = mapOrigin(storage, new URL(gameUrl).origin);
  const file = `${folder}/${prefix}-browser-storage.json`, proof = `${folder}/${prefix}-origin-proof.json`;
  write(file, mapping.mapped);
  write(proof, { original: ref(input), mapped: ref(file), originDiff: mapping.previousOrigin === mapping.targetOrigin ? []
    : [{ path: `origins[${mapping.index}].origin`, before: mapping.previousOrigin, after: mapping.targetOrigin }],
    cookiesUnchanged: true, allOriginKeyValuesUnchanged: true, currentRawSha256: createHash('sha256').update(rawOf(storage)).digest('hex'),
    origins: storage.origins.map((origin, index) => ({ before: origin.origin, after: mapping.mapped.origins[index].origin,
      keys: origin.localStorage.map(item => ({ name: item.name, utf8Bytes: Buffer.byteLength(item.value), sha256: createHash('sha256').update(item.value).digest('hex') })) })),
    scope: 'Browser-origin carrier mapping only. No save parsing/reserialization, game value mutation, backup promotion or failed-base input.' });
  assert.equal(rawOf(read(file)), rawOf(storage));
  return { file, proof };
}
function assertQualification(receipt, sourceManifest, previous) {
  assert.equal(receipt.status, 'approved-bounded-render-delta', 'Director must approve this bounded rendering delta');
  assert.deepEqual(receipt.targetSource, { path: sourceManifest, sha256: sha(sourceManifest) }, 'Qualification must bind this exact new source');
  const bridge = receipt.continuousBridge;
  assert.deepEqual(bridge.firstTwelveReport, { path: previous.reportRef.file, sha256: previous.reportRef.sha256 }, 'Qualification must retain the exact first12');
  assert.deepEqual(bridge.precedingStorage, { path: previous.input, sha256: sha(previous.input) }, 'Qualification must bind the actual predecessor storage');
  assert.equal(bridge.retainedFirstTwelve, 12); assert.equal(bridge.newRemaining, 36); assert.equal(bridge.allowContinuation, true);
}
if (process.argv.includes('--self-check')) {
  const sourceManifest = `${deltaFolder}/frozen-source/source-snapshot.json`, previous = predecessor(`${base}/continuous/recovery-v2/batch-01`);
  const valid = { status: 'approved-bounded-render-delta', targetSource: { path: sourceManifest, sha256: sha(sourceManifest) },
    continuousBridge: { firstTwelveReport: { path: previous.reportRef.file, sha256: previous.reportRef.sha256 },
      precedingStorage: { path: previous.input, sha256: sha(previous.input) }, retainedFirstTwelve: 12, newRemaining: 36, allowContinuation: true } };
  assertQualification(valid, sourceManifest, previous);
  for (const mutate of [r => { r.status = 'pending'; }, r => { r.targetSource.sha256 = 'wrong'; },
    r => { r.continuousBridge.firstTwelveReport.sha256 = 'wrong'; }, r => { r.continuousBridge.precedingStorage.sha256 = 'wrong'; },
    r => { r.continuousBridge.retainedFirstTwelve = 0; }, r => { r.continuousBridge.newRemaining = 48; }, r => { r.continuousBridge.allowContinuation = false; }]) {
    const invalid = structuredClone(valid); mutate(invalid); assert.throws(() => assertQualification(invalid, sourceManifest, previous));
  }
  const originalStorage = read(previous.input), mapping = mapOrigin(originalStorage, 'http://127.0.0.1:3037');
  assert.equal(rawOf(mapping.mapped), rawOf(originalStorage));
  assert.equal(mapping.mapped.origins[mapping.index].origin, 'http://127.0.0.1:3037');
  assert.equal(mapOrigin(mapping.mapped, 'http://127.0.0.1:3037').previousOrigin, 'http://127.0.0.1:3037');
  const duplicate = structuredClone(originalStorage); duplicate.origins.push(duplicate.origins[0]);
  assert.throws(() => mapOrigin(duplicate, 'http://127.0.0.1:3037'));
  console.log(JSON.stringify({ status: 'pass', qualificationMutationsRejected: 7, wholePredecessorStateEqualsTerminal: true,
    originalStorageKeyValuesUnchanged: true, idempotentOriginMapping: true, ambiguousCurrentOriginRejected: true,
    scope: 'Pure predicate regression only. Synthetic valid shape is not a Director receipt or permission to run.' })); process.exit(0);
}
if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(planFile), 'Never overwrite a source bridge');
  const qualification = arg('--qualification'); assert(qualification && fs.existsSync(qualification), 'Director delta qualification receipt required');
  const prior = read(parentPlan); verify([...prior.dependencies, prior.taskContract]);
  const delta = `${deltaFolder}/delta-freeze.json`, sourceManifest = `${deltaFolder}/frozen-source/source-snapshot.json`;
  assert.equal(read(delta).newSource.sha256, sha(sourceManifest));
  assert.equal(read(`${deltaFolder}/runtime-reference/report.json`).status, 'passed-reference-samples');
  const previous = predecessor(`${base}/continuous/recovery-v2/batch-01`);
  assertQualification(read(qualification), sourceManifest, previous);
  assert.deepEqual(previous.report.realJourneyAttempts.map(row => row.grade), Array.from({ length: 4 }, () => ['low', 'medium', 'severe']).flat());
  const source = read(sourceManifest);
  for (const [file, expected] of Object.entries(source.sources)) assert.equal(sha(file), expected, file);
  const chrome = prior.environment.chromePath;
  fs.mkdirSync(root, { recursive: true });
  const failedRoot = `${base}/continuous/actor-cache-v3/batch-02`, failure = read(`${failedRoot}/report.json`);
  assert.equal(failure.realJourneyAttempts.length, 1); const failed = failure.realJourneyAttempts[0];
  assert.equal(failed.ordinal, 13); assert.equal(failed.status, 'failed'); assert(!failed.entrySave && !failed.entryState); assert.equal(failed.searches.length, 0);
  const gameUrl = `http://127.0.0.1:${source.port}/`, mapped = writeMappedInput(previous.input, gameUrl, root, 'initial');
  write(planFile, { version: 4, createdAt: new Date().toISOString(), taskContract: prior.taskContract,
    parentPlan: ref(parentPlan), qualifiedDelta: ref(qualification), deltaFreeze: ref(delta), sourceManifest: ref(sourceManifest),
    firstTwelveSource: prior.sourceManifest, precedingBatch: previous.reportRef, input: ref(previous.input), inputCurrentRawSha256: previous.rawSha256,
    dependencies: [...prior.dependencies, ref(wrapper)], steps: prior.steps, gameUrl,
    runtimeInput: ref(mapped.file), originMappingProof: ref(mapped.proof),
    immutableSetupFailure: [`${base}/continuous/actor-cache-v3/policy-freeze.json`, `${failedRoot}/report.json`, `${failedRoot}/execution.json`,
      `${failedRoot}/i14/13-before.save.json`, `${failedRoot}/i14/browser-storage.json`].map(ref),
    setupFailureDisposition: 'Wrong browser origin read a new isolated base. Complete-earned-state guard stopped before prepare/departure; zero new sorties. V4 maps only original earned storage carrier origin; never uses the failed base.',
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model, logicalCores: os.cpus().length,
      totalMemory: os.totalmem(), chromePath: chrome, chromeVersion: execFileSync(chrome, ['--version'], { encoding: 'utf8' }).trim(),
      power: execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }).trim() },
    sourceBridge: 'Exactly12 completed natural trips on original source plus36 on exact actor-cache source. Whole earned state crosses intact; no claiming48 all on new source.',
    method: 'Unchanged frozen v2 journey bytes/policy. Same predeclared low/medium/severe sequence; no preparation downgrade, early economic stop, world replacement or resource fixture.',
    controllerRevision: 'I14-continuous-b14-bounded-v2-envelope', sourceDeltaOnly: true, allowedBatches: [2, 3, 4],
    historicalFirstFailure: 'V1 first low interrupted before movement; v2 same-run sequence8 recovery is retained in the first12, no extra departure.' });
  console.log(`Frozen ${planFile}`); process.exit(0);
}
const batch = Number(arg('--run-batch'));
assert([2, 3, 4].includes(batch), 'Use --freeze --qualification FILE, or --run-batch2..4');
const plan = read(planFile);
verify([...plan.dependencies, plan.taskContract, plan.parentPlan, plan.qualifiedDelta, plan.deltaFreeze, plan.sourceManifest,
  plan.firstTwelveSource, plan.precedingBatch, plan.input, plan.runtimeInput, plan.originMappingProof, ...plan.immutableSetupFailure]);
assertQualification(read(plan.qualifiedDelta.file), plan.sourceManifest.file, predecessor(`${base}/continuous/recovery-v2/batch-01`));
for (const [file, expected] of Object.entries(read(plan.sourceManifest.file).sources)) assert.equal(sha(file), expected, file);
const previous = predecessor(batch === 2 ? `${base}/continuous/recovery-v2/batch-01` : `${root}/batch-${String(batch - 1).padStart(2, '0')}`);
if (batch === 2) assert.equal(previous.rawSha256, plan.inputCurrentRawSha256);
const firstOrdinal = (batch - 1) * 12 + 1, out = `${root}/batch-${String(batch).padStart(2, '0')}`;
assert(!fs.existsSync(out), 'Failures and completed batches are immutable; no replacement');
fs.mkdirSync(out);
const mapped = batch === 2 ? { file: plan.runtimeInput.file, proof: plan.originMappingProof.file } : writeMappedInput(previous.input, plan.gameUrl, out, 'input');
assert.equal(rawOf(read(mapped.file)), rawOf(read(previous.input)), 'Actual runtime save bytes match the preceding earned terminal');
const continuation = { id: `i14-source-bridge-v4-batch-${batch}`, sourceBranch: 'I13-A23-to-I14-single-chain',
  sourceStorage: mapped.file, sourceStorageSha256: sha(mapped.file), steps: plan.steps.slice(firstOrdinal - 1, firstOrdinal + 11),
  freshItemIds: previous.terminal.freshAcquisitionOrder.map(row => row.id),
  ancestorRunIds: [...new Set([...previous.report.continuation.ancestorRunIds, ...previous.report.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)])],
  resumeFirst: false, sourceBridge: { plan: ref(planFile), newSource: plan.sourceManifest, qualifiedDelta: plan.qualifiedDelta,
    precedingBatch: previous.reportRef, originalEarnedStorage: ref(previous.input), originMappingProof: ref(mapped.proof), inputCurrentRawSha256: previous.rawSha256, disclosure: plan.sourceBridge } };
write(`${out}/batch-input.json`, { plan: ref(planFile), input: ref(mapped.file), originalEarnedInput: ref(previous.input), continuation });
const env = { ...process.env, GAME_URL: plan.gameUrl, QA_OUTPUT_DIR: out, QA_STORAGE_STATE: mapped.file, QA_RUNS: '12',
  QA_I14_SCHEDULE: JSON.stringify(continuation.steps.map(step => step.grade)), QA_I14_PREPARATION: JSON.stringify(continuation.steps[0].preparation),
  QA_I14_CONTINUATION: JSON.stringify(continuation), QA_POST_RETURN_MANAGEMENT: '1', QA_ENTRY_WAIT: '600', QA_ORDINAL_START: String(firstOrdinal),
  QA_WORLD_ID: '', QA_SEED: '', QA_CONTROLLED_BUILD: '', QA_REPRO_IDENTITY_FILE: '', QA_REPLAY_INPUTS: '',
  CHROME_PATH: plan.environment.chromePath, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' };
const guard = spawnSync(process.execPath, ['--import', 'tsx', journey, '--check-return-policy'], { env, encoding: 'utf8' });
write(`${out}/return-policy-check.json`, { exitCode: guard.status, stdout: guard.stdout, stderr: guard.stderr }); assert.equal(guard.status, 0);
const execution = { batch, firstOrdinal, startedAt: new Date().toISOString(), planSha256: sha(planFile), sourceManifest: plan.sourceManifest,
  qualifiedDelta: plan.qualifiedDelta, input: ref(mapped.file), originalEarnedInput: ref(previous.input), originMappingProof: ref(mapped.proof), status: 'running', sourceBridge: plan.sourceBridge };
const save = () => fs.writeFileSync(`${out}/execution.json`, `${JSON.stringify(execution, null, 2)}\n`); save();
const fd = fs.openSync(`${out}/process.log`, 'wx');
try { execution.exitCode = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--import', 'tsx', journey], { env, stdio: ['ignore', fd, fd] });
  execution.childPid = child.pid; save(); child.once('error', reject); child.once('close', resolve); }); }
catch (error) { execution.error = String(error); execution.exitCode = -1; }
finally { fs.closeSync(fd); }
const reportFile = `${out}/report.json`, report = fs.existsSync(reportFile) ? read(reportFile) : null;
execution.report = report ? ref(reportFile) : null; execution.actualAttempts = report?.realJourneyAttempts.length ?? 0;
execution.completed = report?.realJourneyAttempts.filter(row => row.status === 'completed-real-input').length ?? 0;
execution.status = execution.exitCode === 0 && execution.completed === 12 ? 'completed' : 'failed-preserved-no-replacement';
execution.finishedAt = new Date().toISOString(); save(); console.log(`I14 source-bridge batch${batch}: ${execution.status} ${execution.completed}/12`);
if (execution.status !== 'completed') process.exitCode = 1;
