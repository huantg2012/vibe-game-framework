/** Negative accounting tests using copies of six recorded journeys. These
 * deliberately altered copies are test fixtures, never gameplay evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source = 'docs/qa/artifacts/r100-i07-i09/legacy20-play-serial-v13';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalPolicy = read(path.join(source, 'policy-freeze.json'));
const originalBatch = read(path.join(source, 'batch-report.json'));
const cases = originalPolicy.cases.filter(row => row.world === 'ash-strata');
const attempts = originalBatch.attempts.filter(row => row.world === 'ash-strata');
assert.equal(cases.length, 6); assert.equal(attempts.length, 6);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'r100-play-accounting-'));
const results = [];

function check(name, mutate, expected) {
  const folder = path.join(temporary, name); fs.mkdirSync(folder);
  const policy = structuredClone(originalPolicy);
  policy.cases = structuredClone(cases);
  for (const key of ['manifest', 'storageSource', 'storage']) policy[key] = path.resolve(policy[key]);
  const batch = { ...structuredClone(originalBatch), attempts: structuredClone(attempts) };
  const reports = new Map(cases.map(row => [row.dir, read(path.join(source, row.dir, 'report.json'))]));
  const plan = { version: 1, worlds: ['ash-strata'], batches: [folder] };
  for (const file of ['journey-source.mjs', 'coverage-source.mjs']) fs.copyFileSync(path.join(source, file), path.join(folder, file));
  mutate({ policy, batch, reports, plan, folder });
  write(path.join(folder, 'policy-freeze.json'), policy); write(path.join(folder, 'batch-report.json'), batch);
  for (const [dir, report] of reports) { fs.mkdirSync(path.join(folder, dir)); write(path.join(folder, dir, 'report.json'), report); }
  const planFile = path.join(folder, 'plan.json'), output = path.join(folder, 'summary.json'); write(planFile, plan);
  const run = spawnSync(process.execPath, ['tools/qa/r100-play-qualification.mjs', '--plan', planFile, '--output', output], { encoding: 'utf8' });
  const summary = fs.existsSync(output) ? read(output) : null;
  expected(run, summary);
  results.push({ name, status: 'pass', checkerExitCode: run.status,
    qualifiedPairs: summary?.qualifiedGradePairs ?? null });
  console.log(`PASS ${name}`);
}

const lowReports = reports => [...reports].filter(([dir]) => dir.includes('-low-')).map(([, report]) => report.realJourneyAttempts[0]);
try {
  check('unchanged-records', () => {}, (run, summary) => {
    assert.equal(run.status, 0, run.stderr); assert.equal(summary.qualifiedGradePairs, 3);
    assert.equal(summary.completedSeedProcesses, 6);
  });
  check('empty-return-is-not-search', ({ reports }) => {
    for (const row of lowReports(reports)) row.searches = [];
  }, (run, summary) => {
    assert.equal(run.status, 1); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.completedSeedProcesses, 6);
  });
  check('one-seed-cannot-cover-two', ({ batch }) => {
    batch.attempts = batch.attempts.filter(row => !(row.grade === 'low' && row.seed === 3075192741));
  }, (run, summary) => {
    assert.equal(run.status, 1); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.completedSeedProcesses, 5);
  });
  check('predeparture-error-remains-incomplete', ({ reports, batch }) => {
    const attempt = batch.attempts.find(row => row.grade === 'low' && row.seed === 3075192741);
    attempt.exitCode = 1;
    reports.get(attempt.dir).realJourneyAttempts = [];
  }, (run, summary) => {
    assert.equal(run.status, 1, run.stderr); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.completedSeedProcesses, 5);
    assert.equal(summary.invalidOrIncompleteProcesses, 1);
    assert(summary.attempts.some(row => row.problems.includes('No actual field journey started')));
  });
  check('error-does-not-become-route-evidence', ({ reports }) => {
    lowReports(reports)[1].consoleErrors.push('Deliberate negative fixture: WebGL context lost');
  }, (run, summary) => {
    assert.equal(run.status, 1); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.invalidOrIncompleteProcesses, 1);
  });
  check('claimed-search-needs-terminal-node', ({ reports }) => {
    for (const row of lowReports(reports)) for (const node of row.fieldResult.nodes) node.collected = false;
  }, (run, summary) => {
    assert.equal(run.status, 1); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.invalidOrIncompleteProcesses, 2);
  });
  check('return-needs-same-settled-run', ({ reports }) => {
    for (const row of lowReports(reports)) row.afterReturn.state.inventory.run.id = 'negative-fixture-another-run';
  }, (run, summary) => {
    assert.equal(run.status, 1); assert.equal(summary.qualifiedGradePairs, 2);
  });
  check('changing-fixed-seed-is-rejected', ({ reports }) => {
    lowReports(reports)[0].identity.generation.requestedSeed = 42;
  }, (run, summary) => { assert.equal(run.status, 1); assert.equal(summary, null); });
  check('changing-earned-resources-is-rejected', ({ policy, folder }) => {
    const storage = read(policy.storage), state = storage.origins[0].localStorage.find(row => row.name === 'coh-save-v1');
    const data = JSON.parse(state.value); data.kindlingReserve++; state.value = JSON.stringify(data);
    policy.storage = path.join(folder, 'mutated-storage.json'); write(policy.storage, storage); policy.storageSha256 = sha(policy.storage);
  }, (run, summary) => { assert.equal(run.status, 1); assert.equal(summary, null); });
  check('duplicate-world-plan-is-rejected', ({ plan }) => { plan.worlds.push('ash-strata'); },
    (run, summary) => { assert.equal(run.status, 1); assert.equal(summary, null); });
  check('settled-outcome-must-match-field-outcome', ({ reports }) => {
    for (const row of lowReports(reports)) row.afterReturn.state.inventory.run.outcome = 'death';
  }, (run, summary) => {
    assert.equal(run.status, 1); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.invalidOrIncompleteProcesses, 2);
  });
  check('undeclared-revision-rejected', ({ reports }) => {
    lowReports(reports)[0].identity.generation.package.algorithmRevision = 6;
  }, (run, summary) => { assert.equal(run.status, 1); assert.equal(summary, null); });
  const revision6Fixture = ({ policy, reports, plan, folder }) => {
    // Synthetic namespace/accounting fixture only. It is never preserved as a
    // gameplay result or used to claim the old journey ran revision6.
    plan.algorithmRevisions = [6]; policy.algorithmRevision = 6; policy.controllerPolicyRevision = 15;
    const derivation = 'docs/qa/artifacts/r100-i10-i12/controller-revision6/derivation.json', derived = read(derivation);
    policy.controllerDerivation = { path: derivation, sha256: sha(derivation) };
    policy.harnessSha256 = derived.executor.sha256;
    fs.copyFileSync(derived.executor.path, path.join(folder, 'journey-source.mjs'));
    for (const report of reports.values()) {
      report.policyRevision = 15; report.harnessSha256 = policy.harnessSha256;
      for (const row of report.realJourneyAttempts) row.identity.generation.package.algorithmRevision = 6;
    }
  };
  check('explicit-revision6-controller15-fixture', revision6Fixture, (run, summary) => {
    assert.equal(run.status, 0, run.stderr); assert.equal(summary.qualifiedGradePairs, 3);
    assert.deepEqual(summary.algorithmRevisions, [6]);
  });
  check('near-entry-pickup-is-process-not-search-qualification', context => {
    revision6Fixture(context);
    for (const row of lowReports(context.reports)) {
      for (const terminal of row.fieldResult.nodes.filter(node => node.collected)) {
        const start = row.entryState.nodes.find(node => node.id === terminal.id);
        terminal.pos = { x: row.entryState.pos.x + 100, y: row.entryState.pos.y };
        start.pos = structuredClone(terminal.pos);
      }
    }
  }, (run, summary) => {
    assert.equal(run.status, 1, run.stderr); assert.equal(summary.qualifiedGradePairs, 2);
    assert.equal(summary.completedSeedProcesses, 6);
    assert(summary.attempts.filter(row => row.grade === 'low').every(row => row.nearEntryPickups > 0 && row.collected.length === 0));
  });
  console.log(JSON.stringify({ status: 'pass', checks: results.length,
    scope: 'Qualification-accounting negative tests only; no new browser or game outcomes.', results }, null, 2));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
