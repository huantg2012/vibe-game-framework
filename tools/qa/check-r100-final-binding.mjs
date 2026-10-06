#!/usr/bin/env node
/** Adversarial binding checks over the real, finished final plan. No fabricated
 * 52-world baseline, browser, ledger writes or changes to recorded evidence.
 * First require the unmodified dry proposal to pass. Negative cases change an
 * in-memory reader and reseal all dependent receipts before calling the binder.
 * Usage: --plan <finished-plan.json> --output <new-report.json>; --list is inert.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildProposal} from './r100-bind-i07-i09.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BINDER = 'tools/qa/r100-bind-i07-i09.mjs';
const LEDGER = 'docs/progress/rift-r100.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const key = row => `${row.world}/${row.grade}/${row.seed}`;
function repositoryPath(file) {
  assert.equal(typeof file, 'string');
  const relative = path.relative(ROOT, path.resolve(ROOT, file));
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Outside repository: ${file}`);
  return relative;
}

/** The shared cache contains only actual disk bytes; each negative has a
 * separate overlay. Files read directly by the binder remain real and unchanged. */
function recordedInputs() {
  const originals = new Map();
  const actualPath = file => {
    const relative = repositoryPath(file), target = fs.realpathSync(path.join(ROOT, relative));
    repositoryPath(target);
    assert(fs.statSync(target).isFile(), `Expected file: ${file}`);
    return {relative, target};
  };
  return {
    bytes(file) {
      const {relative, target} = actualPath(file);
      if (!originals.has(relative)) originals.set(relative, fs.readFileSync(target));
      return originals.get(relative);
    },
    exists(file) { return fs.existsSync(path.join(ROOT, repositoryPath(file))); },
    unchanged() {
      for (const [file, before] of originals) assert(fs.readFileSync(actualPath(file).target).equals(before), `Input changed during binding checks: ${file}`);
    },
    receipts() { return [...originals].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => ({path: file, sha256: sha(bytes)})); },
  };
}

function scenario(originalPlan, inputs) {
  const plan = structuredClone(originalPlan), overlays = new Map(), checkedReceipts = [];
  const bytes = file => overlays.get(repositoryPath(file)) ?? inputs.bytes(file);
  const read = {
    bytes,
    exists: file => overlays.has(repositoryPath(file)) || inputs.exists(file),
    json: file => JSON.parse(bytes(file)),
    receipt(value) {
      assert(value?.path && /^[a-f0-9]{64}$/.test(value.sha256), 'Explicit evidence SHA required');
      const actual = sha(bytes(value.path));
      assert.equal(actual, value.sha256, `Evidence changed: ${value.path}`);
      checkedReceipts.push({path: value.path, sha256: actual});
      return JSON.parse(bytes(value.path));
    },
    unchanged: () => inputs.unchanged(),
  };
  const putBytes = (file, value) => {
    // Mutations must concern real inputs, never invented successful fixtures.
    inputs.bytes(file);
    overlays.set(repositoryPath(file), Buffer.from(value));
    return sha(value);
  };
  const putJson = (file, value) => putBytes(file, encode(value));
  const reseal = (receipt, value) => { receipt.sha256 = putJson(receipt.path, value); };
  function mutateTop(name, change) {
    const receipt = plan[name], value = read.receipt(receipt);
    change(value); reseal(receipt, value);
    // Reach the intended logical predicate, rather than merely failing an old
    // enclosing SHA. These references legitimately concern the changed report.
    if (['generation', 'production', 'equivalence'].includes(name)) {
      const review = read.receipt(plan.technicalReview);
      review.evidence[name] = structuredClone(receipt); reseal(plan.technicalReview, review);
    }
    if (['production', 'equivalence'].includes(name)) {
      for (const bindingReceipt of plan.runtimeBindings) {
        const binding = read.receipt(bindingReceipt);
        if (binding.report.path === receipt.path) {
          binding.report = structuredClone(receipt); reseal(bindingReceipt, binding);
        }
      }
    }
  }
  function mutateBinding(kind, change) {
    const receipts = plan.runtimeBindings.filter(item => read.receipt(item).kind === kind);
    assert.equal(receipts.length, 1);
    const receipt = receipts[0], binding = read.receipt(receipt);
    change(binding); reseal(receipt, binding);
  }
  return {plan, read, putBytes, putJson, mutateTop, mutateBinding,
    edits: () => [...overlays].map(([file, value]) => ({path: file, originalSha256: sha(inputs.bytes(file)), mutatedSha256: sha(value)})),
    checkedReceipts,
  };
}

function targetPair(play) {
  const pair = play.pairs.find(row => row.grade === 'low' && row.qualified);
  assert(pair, 'Real completed low-grade pair required'); return pair;
}
const samePair = (row, pair) => row.world === pair.world && row.grade === pair.grade;

const CASES = [
  {name: 'missing-second-fixed-seed', rationale: 'A single recorded seed cannot qualify a world-grade pair.', mutate(test) {
    test.mutateTop('play', play => { const pair = targetPair(play); assert.equal(pair.seeds.length, 2); pair.seeds.pop(); });
  }},
  {name: 'empty-return-claimed-as-search', rationale: 'Empty collected lists cannot support a successful search/extract claim.', mutate(test) {
    test.mutateTop('play', play => {
      const pair = targetPair(play), attempts = play.attempts.filter(row => samePair(row, pair) && row.processComplete && row.outcome === 'extract');
      assert(attempts.some(row => row.searchAndExtract && row.collected.length));
      for (const row of attempts) { row.collected = []; row.searchAndExtract = true; }
    });
  }},
  {name: 'raw-search-proof-removed-with-resealed-receipts', rationale: 'Raw reports with no searches must invalidate unchanged successful summary claims, even with correct new hashes.', mutate(test) {
    test.mutateTop('play', play => {
      const pair = targetPair(play), attempts = play.attempts.filter(row => samePair(row, pair) && row.processComplete && row.searchAndExtract);
      assert(attempts.length > 0);
      for (const file of new Set(attempts.map(row => row.report))) {
        const raw = test.read.json(file); assert.equal(raw.realJourneyAttempts.length, 1);
        assert(raw.realJourneyAttempts[0].searches.some(row => row.collected));
        raw.realJourneyAttempts[0].searches = [];
        const hash = test.putJson(file, raw);
        for (const row of play.attempts.filter(row => row.report === file)) row.reportSha256 = hash;
      }
    });
  }},
  {name: 'raw-cpu-case-missing-with-resealed-receipt', rationale: 'Removing one actual successful CPU case cannot retain a 7488-case successful summary.', mutate(test) {
    test.mutateTop('generation', cpu => {
      let removed = false;
      for (const group of cpu.groups) for (const attempt of group.attempts) {
        if (removed) continue;
        const rows = test.read.bytes(attempt.raw.path).toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        const at = rows.findIndex(row => row.ok && group.worlds.includes(row.world));
        if (at < 0) continue;
        const gone = rows.splice(at, 1)[0];
        assert.equal(rows.filter(row => key(row) === key(gone)).length, 0);
        attempt.raw.sha256 = test.putBytes(attempt.raw.path, Buffer.from(`${rows.map(row => JSON.stringify(row)).join('\n')}\n`));
        attempt.executed = rows.length; removed = true;
      }
      assert(removed, 'Actual successful CPU case required');
    });
  }},
  {name: 'formal-cold-identity-false', rationale: 'Every world-grade must actually preserve its identity on reload.', mutate(test) {
    test.mutateTop('production', report => { report.cases[0].coldIdentityPreserved = false; });
  }},
  {name: 'formal-cold-body-false', rationale: 'An unchanged identity alone cannot substitute for body-position recovery.', mutate(test) {
    test.mutateTop('production', report => { report.cases[0].bodyGeometry.coldBodyPositionPreserved = false; });
  }},
  {name: 'formal-history-double-commit', rationale: 'A cold reload must not append another committed visit.', mutate(test) {
    test.mutateTop('production', report => { const history = report.cases[0].committedWorldHistory; history.visits.push(structuredClone(history.visits[0])); });
  }},
  {name: 'equivalence-wrong-requested-seed', rationale: 'Current equivalence must use the predetermined requested seed.', mutate(test) {
    test.mutateTop('equivalence', report => { const row = report.results.find(value => value.revision === 5); assert.equal(row.requestedSeed, 20261004); row.requestedSeed++; });
  }},
  {name: 'equivalence-duplicate-grade', rationale: '174 rows cannot hide a duplicated current grade and missing grade.', mutate(test) {
    test.mutateTop('equivalence', report => {
      const first = report.results.find(row => row.revision === 5), other = report.results.find(row => row.revision === 5 && row.world === first.world && row.grade !== first.grade);
      assert(other); other.grade = first.grade;
    });
  }},
  {name: 'art-wrong-world-dependency', rationale: 'A bounded art verdict must refer to the exact world package.', mutate(test) {
    test.mutateTop('art', art => { const row = art.worlds[0]; row.dependencyHash = `${row.dependencyHash[0] === '0' ? '1' : '0'}${row.dependencyHash.slice(1)}`; });
  }},
  {name: 'missing-production-runtime-binding', rationale: 'Current-source claims require an explicit production runtime audit.', mutate(test) {
    const before = test.plan.runtimeBindings.length;
    test.plan.runtimeBindings = test.plan.runtimeBindings.filter(item => test.read.receipt(item).kind !== 'production');
    assert.equal(test.plan.runtimeBindings.length, before - 1);
  }},
  {name: 'runtime-bound-to-another-real-source', rationale: 'A passed runtime audit of an older real source does not bind the current source.', mutate(test) {
    const older = test.plan.generationSources.find(row => row.sha256 !== test.plan.finalSource.sha256);
    assert(older, 'Real prior qualification source required'); test.read.receipt(older);
    test.mutateBinding('production', binding => { binding.finalSource = {path: older.path, sha256: older.sha256}; });
  }},
  {name: 'served-source-coverage-missing', rationale: 'The runtime audit must cover all recorded runtime/data/public bytes.', mutate(test) {
    test.mutateBinding('equivalence', binding => {
      const file = Object.keys(binding.beforeServedHashes).find(value => value.startsWith('src/'));
      assert(file); delete binding.beforeServedHashes[file]; delete binding.afterServedHashes[file];
    });
  }},
  {name: 'technical-review-wrong-source', rationale: 'Technical review must identify the final frozen source.', mutate(test) {
    const older = test.plan.generationSources.find(row => row.sha256 !== test.plan.finalSource.sha256);
    assert(older); test.read.receipt(older);
    test.mutateTop('technicalReview', review => { review.finalSourceSha256 = older.sha256; });
  }},
  {name: 'technical-review-wrong-evidence', rationale: 'Correct review status cannot substitute evidence from another validation axis.', mutate(test) {
    test.mutateTop('technicalReview', review => { review.evidence.generation = structuredClone(test.plan.production); });
  }},
];

export async function checkFinalBinding(planFile, output) {
  const inputs = recordedInputs(), planPath = repositoryPath(planFile), plan = JSON.parse(inputs.bytes(planPath));
  const destination = path.resolve(ROOT, output);
  assert(!fs.existsSync(destination), 'Preserve original checks; choose a new output report');
  assert.notEqual(destination, path.resolve(ROOT, planPath));
  // Register executable inputs as well as evidence before any proposal call.
  for (const file of [BINDER, repositoryPath(fileURLToPath(import.meta.url)), LEDGER]) inputs.bytes(file);
  const report = {version: 1, status: 'running', scope: 'Real final-plan baseline followed by in-memory adversarial evidence mutations with recomputed receipts. No browser, generated game, fictitious 52-world baseline, ledger write or replacement of recorded evidence.',
    startedAt: new Date().toISOString(), plan: {path: planPath, sha256: sha(inputs.bytes(planPath))}, binder: {path: BINDER, sha256: sha(inputs.bytes(BINDER))},
    baseline: null, cases: []};
  let failed = false;
  try {
    const baseline = scenario(plan, inputs), value = buildProposal(baseline.plan, baseline.read);
    assert.equal(value.summary.counts.qualified, 52); assert.equal(value.summary.counts.productionGradeCases, 156);
    assert.deepEqual(baseline.edits(), []);
    report.baseline = {status: 'pass', counts: value.summary.counts, proposedLedgerSha256: sha(encode(value.proposed)), addedEvidence: value.summary.addedEvidence};
    console.log('PASS unmodified real final-plan dry proposal');
    for (const spec of CASES) {
      const test = scenario(plan, inputs); let error;
      // A mutation setup failure is a checker failure, never a successful
      // rejection. The binder alone must reject the resealed logical input.
      spec.mutate(test);
      try { buildProposal(test.plan, test.read); } catch (caught) { error = caught; }
      const receiptFailure = error && /Evidence changed:|Explicit evidence SHA required/.test(String(error));
      const rejected = error instanceof assert.AssertionError && !receiptFailure;
      const result = {name: spec.name, rationale: spec.rationale, status: rejected ? 'pass' : 'failed', expected: 'explicit logical rejection',
        actual: !error ? 'accepted-corrupt-evidence' : receiptFailure ? 'rejected-only-by-stale-receipt' : error instanceof assert.AssertionError ? 'logical-assertion' : 'unexpected-error',
        error: error ? String(error) : null, stack: error?.stack ?? null, edits: test.edits(), checkedReceiptCount: test.checkedReceipts.length,
        planSha256: sha(encode(test.plan))};
      report.cases.push(result); if (!rejected) failed = true;
      console.log(`${rejected ? 'PASS' : 'FAIL'} ${spec.name}: ${result.actual}`);
    }
    assert(!failed, 'One or more corrupt evidence variants did not reach explicit logical rejection');
    report.status = 'pass';
  } catch (error) { report.status = 'failed'; report.failure = String(error); failed = true; }
  finally {
    try { inputs.unchanged(); report.actualInputsUnchanged = true; }
    catch (error) { report.status = 'failed'; report.inputMutationFailure = String(error); failed = true; }
    report.inputs = inputs.receipts(); report.endedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx'});
  }
  return {ok: !failed, report};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--list')) console.log(CASES.map(row => `${row.name}: ${row.rationale}`).join('\n'));
  else {
    const arg = name => { const at = process.argv.indexOf(name); assert(at >= 0 && process.argv[at + 1], `${name} required`); return process.argv[at + 1]; };
    const result = await checkFinalBinding(arg('--plan'), arg('--output'));
    console.log(JSON.stringify({status: result.report.status, baseline: result.report.baseline?.status ?? 'failed', checks: result.report.cases.length}));
    if (!result.ok) process.exitCode = 1;
  }
}
