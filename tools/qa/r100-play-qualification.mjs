/** Summarize immutable, fixed-seed real-input records. Never assign art approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {reconcileTerminalPickups} from './r100-observed-searches.mjs';
import {collectI09SearchReceipts} from './r100-i09-search-receipts.mjs';
import {validateControllerSupplement, validateSupplementJourney} from './r100-i12-controller-supplement.mjs';
import {validateFacingControllerSupplement, validateFacingSupplementJourney} from './r100-i12-facing-supplement.mjs';

export function buildPlaySummary(planPath, bytes = file => fs.readFileSync(file), exists = file => fs.existsSync(file)) {
const read = file => JSON.parse(bytes(file));
const sha = file => createHash('sha256').update(bytes(file)).digest('hex');
const plan = read(planPath), grades = ['low', 'medium', 'severe'], seeds = [20261005, 3075192741];
assert.equal(plan.version, 1);
const algorithmRevisions = plan.algorithmRevisions ?? [5];
assert(algorithmRevisions.length && new Set(algorithmRevisions).size === algorithmRevisions.length
  && algorithmRevisions.every(revision => revision === 5 || revision === 6), 'Declare supported source revisions explicitly');
assert(plan.worlds?.length && new Set(plan.worlds).size === plan.worlds.length);
assert(plan.batches?.length && new Set(plan.batches).size === plan.batches.length);
const key = row => `${row.world}/${row.grade}/${row.seed}`;
const wanted = new Set(plan.worlds.flatMap(world => grades.flatMap(grade => seeds.map(seed => key({world, grade, seed})))));
const attempts = [], sources = [], scheduled = new Set();
const supplements = [], supplementedCases = new Set();

for (const folder of plan.batches) {
  const policyPath = path.join(folder, 'policy-freeze.json'), batchPath = path.join(folder, 'batch-report.json');
  const policy = read(policyPath), batch = read(batchPath);
  const algorithmRevision = policy.algorithmRevision ?? 5;
  assert(algorithmRevisions.includes(algorithmRevision), 'Batch revision is outside the summary plan');
  const controllerPolicyRevision = policy.controllerPolicyRevision ?? 13;
  assert([13, 15, 16, 17].includes(controllerPolicyRevision));
  const supplement = controllerPolicyRevision === 16
    ? validateControllerSupplement(policy.controllerSupplement, policy, batch, plan, bytes)
    : controllerPolicyRevision === 17
      ? validateFacingControllerSupplement(policy.controllerSupplement, policy, batch, plan, bytes) : null;
  if (supplement) {
    for (const row of supplement.protocol.cases) {
      assert(!supplementedCases.has(key(row)), 'Only one bounded supplemental attempt per original case');
      supplementedCases.add(key(row));
    }
    supplements.push(supplement);
  }
  if (algorithmRevision === 6) {
    assert([15, 16, 17].includes(controllerPolicyRevision), 'Expansion batches require an explicitly frozen actual-pickup controller');
    if (!supplement) {
      const reference = policy.controllerDerivation; assert(reference, 'Revision6 input adapter receipt is required');
      assert.equal(sha(reference.path), reference.sha256);
      const derived = read(reference.path);
      assert.equal(derived.inputPolicyRevision, 15); assert.equal(derived.algorithmRevision, 6);
      assert.equal(derived.executor.sha256, policy.harnessSha256);
      assert.equal(sha(derived.original.path), derived.original.sha256);
      assert.equal(derived.transformation.kind, 'result-version-assertion-only');
      assert.equal(derived.transformation.allOtherSourceBytesExact, true);
    }
  }
  assert.equal(sha(policy.manifest), policy.manifestSha256, 'Source receipt changed');
  assert.equal(sha(policy.storageSource), policy.storageSourceSha256, 'Earned save source changed');
  assert.equal(sha(policy.storage), policy.storageSha256, 'Remapped earned save changed');
  assert.equal(sha(path.join(folder, 'journey-source.mjs')), policy.harnessSha256, 'Frozen input policy changed');
  assert.equal(sha(path.join(folder, 'coverage-source.mjs')), policy.wrapperSha256, 'Frozen scheduler changed');
  const originalStorage = read(policy.storageSource), isolatedStorage = read(policy.storage);
  assert.equal(originalStorage.origins.length, 1); assert.equal(isolatedStorage.origins.length, 1);
  isolatedStorage.origins[0].origin = originalStorage.origins[0].origin;
  assert.deepEqual(isolatedStorage, originalStorage, 'Only save origin may differ');
  const rows = new Map(policy.cases.map(row => [row.dir, row]));
  assert.equal(rows.size, policy.cases.length, 'Duplicate fixed case directory');
  for (const row of policy.cases) {
    assert(wanted.has(key(row)), `Unexpected world/grade/seed: ${key(row)}`);
    scheduled.add(key(row));
  }
  sources.push({folder, policy: policyPath, policySha256: sha(policyPath), reportSha256: sha(batchPath),
    sourceManifest: policy.manifest, sourceManifestSha256: policy.manifestSha256, harnessSha256: policy.harnessSha256,
    algorithmRevision, controllerPolicyRevision,
    ...(supplement ? {controllerSupplement: policy.controllerSupplement} : {}),
    status: batch.status, planned: policy.cases.length, attempted: batch.attempts.length});
  for (const attempt of batch.attempts) {
    const expected = rows.get(attempt.dir); assert(expected && key(expected) === key(attempt));
    const reportPath = path.join(folder, attempt.dir, 'report.json');
    const receipt = {key: key(attempt), world: attempt.world, grade: attempt.grade, seed: attempt.seed,
      report: reportPath, exitCode: attempt.exitCode ?? null, processComplete: false, searchAndExtract: false, collected: [], problems: []};
    attempts.push(receipt);
    if (!exists(reportPath)) { receipt.problems.push('No completed journey report'); continue; }
    receipt.reportSha256 = sha(reportPath);
    const data = read(reportPath);
    assert.equal(data.policyRevision, controllerPolicyRevision);
    assert.equal(data.harnessSha256, policy.harnessSha256);
    assert.deepEqual(data.harnessDependencies, policy.dependencies);
    assert.equal(data.controlledBuild, null, 'Qualification must use actually earned equipment');
    assert.equal(data.controlledWorld, attempt.world);
    assert.equal(data.fixedDefectIdentity, null);
    assert(Array.isArray(data.realJourneyAttempts), 'Actual journey list required');
    assert(data.realJourneyAttempts.length <= 1, 'At most one fixed attempt per receipt');
    if (!data.realJourneyAttempts.length) {
      receipt.problems.push('No actual field journey started');
      continue;
    }
    const journey = data.realJourneyAttempts[0], generation = journey.identity?.generation;
    if (!generation) { receipt.problems.push('No committed field identity'); continue; }
    assert.equal(generation.package.id, `r100-${attempt.world}`);
    assert.equal(generation.package.grade, attempt.grade);
    assert.equal(generation.package.algorithmRevision, algorithmRevision);
    assert.equal(generation.requestedSeed, attempt.seed);
    receipt.outcome = journey.outcome ?? null;
    receipt.elapsedMs = journey.fieldResult?.elapsedMs ?? journey.exploration?.state?.elapsedMs ?? 0;
    receipt.problems.push(...(journey.errors ?? []), ...(journey.consoleErrors ?? []));
    if (journey.navigationWarning) receipt.problems.push(journey.navigationWarning);
    if (journey.failure) receipt.problems.push(journey.failure);
    if (attempt.exitCode !== 0 || journey.status !== 'completed-real-input') receipt.problems.push('Input journey did not complete');
    const beforeRun = journey.entrySave?.state?.inventory?.run, afterRun = journey.afterReturn?.state?.inventory?.run;
    const settled = Boolean(beforeRun?.id && beforeRun.status === 'active' && beforeRun.id === afterRun?.id
      && afterRun.baseSettled && afterRun.status === 'settled' && afterRun.outcome === journey.outcome);
    if (!settled) receipt.problems.push('No matching, settled base transaction');
    if (!['extract', 'death'].includes(journey.outcome)) receipt.problems.push('No actual extract/death outcome');
    if (!(receipt.elapsedMs >= 10000)) receipt.problems.push('Insufficient actual field process');
    const actualPickups = controllerPolicyRevision >= 15 ? collectI09SearchReceipts(journey) : null;
    if (controllerPolicyRevision === 16)
      receipt.problems.push(...validateSupplementJourney(supplement, attempt, journey, actualPickups));
    if (controllerPolicyRevision === 17) {
      const events = bytes(path.join(folder, attempt.dir, attempt.grade, 'journey.jsonl')).toString().trim()
        .split('\n').filter(Boolean).map(line => JSON.parse(line));
      receipt.problems.push(...validateFacingSupplementJourney(supplement, attempt, journey, actualPickups, events));
    }
    if (actualPickups) {
      receipt.actualPickups = actualPickups.length;
      receipt.nearEntryPickups = actualPickups.filter(row => !row.eligibleNonEntry).length;
    }
    for (const search of actualPickups ? actualPickups.filter(row => row.eligibleNonEntry) : journey.searches.filter(row => row.collected)) {
      const node = journey.fieldResult?.nodes?.find(row => row.id === search.id), entry = journey.entryState?.pos;
      if (!node?.collected || !entry) { receipt.problems.push(`No terminal field proof for ${search.id}`); continue; }
      const distance = Math.hypot(node.pos.x - entry.x, node.pos.y - entry.y);
      assert(distance > 320, `Search at entry cannot qualify: ${distance}`);
      if (search.kind === 'contaminant' && (!afterRun?.revealedNodes || !Object.hasOwn(afterRun.revealedNodes, search.id)))
        receipt.problems.push(`No inventory reveal receipt for ${search.id}`);
      if (search.kind === 'kindling' && journey.outcome === 'extract' && !(journey.fieldResult.carried > 0))
        receipt.problems.push(`No carried kindling at extraction for ${search.id}`);
      receipt.collected.push({id: search.id, distanceFromEntry: distance, elapsedMs: search.elapsedMs});
    }
    // The controller can finish a nearby node, or observe completion only
    // after logging the target. Keep its original log and require independent
    // terminal/save agreement before accounting for any missed pickup.
    if (!actualPickups) receipt.collected.push(...reconcileTerminalPickups(journey));
    receipt.processComplete = receipt.problems.length === 0;
    receipt.searchAndExtract = receipt.processComplete && journey.outcome === 'extract' && receipt.collected.length > 0;
  }
}

for (const supplement of supplements) for (const row of supplement.protocol.cases) {
  const original = attempts.find(value => value.report === row.originalReport.path);
  assert(original && original.reportSha256 === row.originalReport.sha256 && key(original) === key(row),
    'The original unsuccessful report must be accounted for as an actual attempt');
  assert(original.processComplete && !original.searchAndExtract,
    'The supplemental protocol concerns completed original processes without successful search/extraction');
}

const pairs = plan.worlds.flatMap(world => grades.map(grade => {
  const perSeed = seeds.map(seed => {
    const records = attempts.filter(row => row.key === key({world, grade, seed}));
    return {seed, scheduled: scheduled.has(key({world, grade, seed})), attempts: records.length,
      processComplete: records.some(row => row.processComplete), searchAndExtract: records.some(row => row.searchAndExtract),
      reports: records.map(row => row.report)};
  });
  return {world, grade, seeds: perSeed, qualified: perSeed.every(row => row.processComplete) && perSeed.some(row => row.searchAndExtract)};
}));
const qualified = pairs.filter(row => row.qualified);
const summary = {version: 1, createdAt: new Date().toISOString(), status: qualified.length === pairs.length ? 'pass' : 'incomplete',
  algorithmRevisions,
  plan: planPath, planSha256: sha(planPath), method: 'Both originally fixed seeds must retain a completed real process; at least one must actually collect a non-entry remain and extract to a settled base. Late/adjacent pickups require entry-to-terminal node changes and matching settled loot receipts. Empty returns and deaths never count as successful searches. All attempts, including original environment errors, remain in the record.',
  limitations: 'Controlled world/seed with copies of an actually earned save, geometry-assisted expert navigation. Does not establish novice usability, natural continuous economy, visual acceptance, performance, or source continuity to a later catalog; those need separate evidence.',
  expectedGradePairs: pairs.length, qualifiedGradePairs: qualified.length, expectedSeeds: wanted.size, scheduledSeeds: scheduled.size,
  completedSeedProcesses: [...wanted].filter(id => attempts.some(row => row.key === id && row.processComplete)).length,
  actualAttempts: attempts.length, searchAndExtractAttempts: attempts.filter(row => row.searchAndExtract).length,
  // collected contains only eligible non-entry nodes. A policy15 return with
  // actual near-entry pickups is neither an eligible search nor an empty run.
  emptyReturns: attempts.filter(row => row.processComplete && row.outcome === 'extract'
    && !row.collected.length && !(row.actualPickups > 0)).length,
  ...(sources.some(row => row.controllerPolicyRevision >= 15) ? {
    nearEntryOnlyReturns: attempts.filter(row => row.processComplete && row.outcome === 'extract'
      && !row.collected.length && row.actualPickups > 0).length,
  } : {}),
  deaths: attempts.filter(row => row.processComplete && row.outcome === 'death').length,
  invalidOrIncompleteProcesses: attempts.filter(row => !row.processComplete).length, sources, pairs, attempts};
return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = name => { const at = args.indexOf(name); assert(at >= 0 && args[at + 1], `${name} required`); return args[at + 1]; };
  const output = arg('--output');
  assert(!fs.existsSync(output), 'Preserve previous summaries; choose a new output path');
  const summary = buildPlaySummary(arg('--plan'));
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({status: summary.status, qualifiedGradePairs: summary.qualifiedGradePairs, expectedGradePairs: summary.expectedGradePairs,
    completedSeedProcesses: summary.completedSeedProcesses, actualAttempts: summary.actualAttempts, output}));
  if (summary.status !== 'pass') process.exitCode = 1;
}
