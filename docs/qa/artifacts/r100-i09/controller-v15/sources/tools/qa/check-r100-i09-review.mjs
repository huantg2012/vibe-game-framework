/** Isolated synthetic I/O contract. No browser, game save or qualification data.
 * node --import tsx tools/qa/check-r100-i09-review.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { selectR100WorldId } from '../../src/generation/world-study/r100-world-selection.ts';

const tool = 'tools/qa/r100-i09-review-continuous.mjs', reviewPolicy = 'tools/qa/r100-i09-review-policy.json';
const temporary = fs.mkdtempSync(path.resolve('node_modules/.tmp-i09-review-'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); return file; };
const policies = ['low', 'medium', 'severe', 'alternating'];
try {
  const manifest = write(path.join(temporary, 'manifest.json'), { verifiedCopyHashes: true, patches: [], sources: {} });
  const initial = { cycle: 30, kindlingReserve: 20, modules: [], growth: { upgrades: { growth_sortie_slot: 1 } }, inventory: {
    version: 4, equipment: { toolIds: ['tool', null, null, null] }, items: [{ id: 'tool', kind: 'contaminant', contaminant: { usesRemaining: 100 } }],
    run: { id: 'earned-before', status: 'settled', baseSettled: true }, riftWorldHistory: { version: 1, visits: [] } } };
  const storage = write(path.join(temporary, 'earned-storage.json'), { origins: [{ localStorage: [{ name: 'coh-save-v1', value: JSON.stringify(initial) }] }] });
  const policyFile = write(path.join(temporary, 'policy-freeze.json'), { sourceManifest: manifest, storage, fixedFiles: [{ file: manifest, sha256: sha(manifest) }, { file: storage, sha256: sha(storage) }],
    review: { policy: reviewPolicy, policySha256: sha(reviewPolicy), tool, toolSha256: sha(tool) } });
  const summary = { sourceValid: true, validatedTrips: 48, policy: policyFile, policySha256: sha(policyFile), branches: [] };
  const originals = new Map();
  function buildBranches(counts = {}) {
  summary.branches = []; originals.clear();
  for (const policy of policies) {
    let current = structuredClone(initial);
    const folder = path.join(temporary, policy, policy), trips = [], log = [];
    for (let index = 0; index < (counts[policy] ?? 12); index++) {
      const ordinal = index + 1, grade = policy === 'alternating' ? policies[index % 3] : policy, seed = 1000 + index;
      const before = structuredClone(current), world = selectR100WorldId(seed, before.inventory.riftWorldHistory);
      const entry = structuredClone(before); entry.cycle++; entry.inventory.run = { id: `${policy}-${ordinal}`, status: 'active' };
      entry.inventory.riftWorldHistory.visits = [...before.inventory.riftWorldHistory.visits.slice(-7), { worldId: world, grade }];
      const returned = structuredClone(entry); returned.kindlingReserve += 2; returned.inventory.items[0].contaminant.usesRemaining--;
      returned.inventory.run = { id: entry.inventory.run.id, status: 'settled', baseSettled: true, outcome: 'extract', kindlingGained: 2, returnedIds: ['tool'], destroyedIds: [] };
      const prepared = structuredClone(returned); prepared.kindlingReserve--; current = prepared;
      const save = (label, state) => { const file = write(path.join(folder, `${ordinal}-${label}.save.json`), state); return { sha256: sha(file), state }; };
      trips.push({ ordinal, policy, grade, status: 'completed-real-input', noStateInjection: true, fixedDefectIdentity: false, errors: [], consoleErrors: [], navigationWarning: null,
        identity: { seed, generation: { requestedSeed: seed, package: { id: `r100-${world}`, grade, algorithmRevision: 5 } } },
        before: save('before', before), entrySave: save('entry', entry), afterReturn: save('returned', returned), afterPreparation: save('after-preparation', prepared),
        outcome: 'extract', management: { actions: [{ kind: 'repair', spent: 1 }] }, entryState: { pos: { x: 0, y: 0 },
          nodes: [{ id: 'node', kind: 'kindling', collected: false, pos: { x: 400, y: 0 } }] },
        searches: [{ id: 'node', collected: true, elapsedMs: 20000 }], fieldResult: { elapsedMs: 40000, hp: 100, chaos: 20,
          nodes: [{ id: 'node', kind: 'kindling', collected: true, pos: { x: 400, y: 0 } }] } });
      log.push({ event: 'snapshot', label: `${ordinal}-entry` }, { event: 'known-tool-context-input', key: 'Q', slot: 0,
        item: { id: 'tool', uses: usesOf(entry) }, used: 1, remaining: usesOf(returned) }, { event: 'snapshot', label: `${ordinal}-field-result` });
    }
    const rawFile = write(path.join(temporary, policy, 'report.json'), { controlledWorld: null, controlledBuild: null, fixedDefectIdentity: null, policyRevision: 15, realJourneyAttempts: trips });
    fs.writeFileSync(path.join(folder, 'journey.jsonl'), log.map(row => JSON.stringify(row)).join('\n') + '\n');
    originals.set(rawFile, fs.readFileSync(rawFile)); summary.branches.push({ policy, report: rawFile, reportSha256: sha(rawFile) });
  }
  }
  buildBranches();
  function run(name, expectedCode) {
    const output = path.join(temporary, `${name}.json`);
    write(path.join(temporary, 'summary.json'), summary);
    const result = spawnSync(process.execPath, ['--import', 'tsx', tool, '--input', temporary, '--output', output], {
      encoding: 'utf8', timeout: 20000, env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' }, maxBuffer: 1024 * 1024,
    });
    assert.equal(result.status, expectedCode, `${name}: ${result.stderr}\n${result.stdout}`);
    return JSON.parse(fs.readFileSync(output));
  }
  const valid = run('complete-synthetic48', 0);
  assert.equal(valid.validatedTrips, 48); assert.equal(valid.experienceApproval, 'pending');
  assert.deepEqual(valid.gradeCounts, { low: 16, medium: 16, severe: 16 });
  assert.equal(valid.metrics.tools.Q.consumed, 48); assert.deepEqual(valid.uncoveredToolKeys, ['F', 'G']);
  assert.equal(valid.metrics.repairSpent, 48); assert.equal(valid.metrics.reserveDelta, 48);
  const nearBranch = summary.branches[0], nearRaw = JSON.parse(originals.get(nearBranch.report));
  for (const trip of nearRaw.realJourneyAttempts.slice(0, 3)) {
    trip.entryState.nodes[0].pos.x = 100; trip.fieldResult.nodes[0].pos.x = 100;
  }
  write(nearBranch.report, nearRaw); nearBranch.reportSha256 = sha(nearBranch.report);
  const near = run('near-entry-only-still-real-data', 0);
  assert.equal(near.validatedTrips, 48); assert.equal(near.metrics.actualPickups, 48);
  assert.equal(near.metrics.nearEntryPickups, 3); assert.equal(near.metrics.nearEntryOnlyReturns, 3);
  assert.equal(near.metrics.emptyReturns, 0); assert.equal(near.metrics.searchAndExtract, 45);
  assert(near.mandatoryDiagnosis.some(row => row.kind === 'three-or-more-consecutive-without-non-entry-extraction'));
  fs.writeFileSync(nearBranch.report, originals.get(nearBranch.report)); nearBranch.reportSha256 = sha(nearBranch.report);
  const branch = summary.branches[0], changed = JSON.parse(originals.get(branch.report));
  changed.realJourneyAttempts[0].identity.generation.package.id = 'r100-not-the-drawn-world';
  write(branch.report, changed); branch.reportSha256 = sha(branch.report);
  const invalid = run('wrong-natural-world', 1);
  assert.equal(invalid.status, 'incomplete-or-invalid-data'); assert(invalid.mandatoryDiagnosis.some(row => row.kind === 'contract-failure'));
  fs.writeFileSync(branch.report, originals.get(branch.report)); branch.reportSha256 = sha(branch.report);
  const drift = JSON.parse(originals.get(branch.report)); drift.realJourneyAttempts[1].before.state.kindlingReserve++;
  const beforeFile = path.join(temporary, 'low', 'low', '2-before.save.json'); write(beforeFile, drift.realJourneyAttempts[1].before.state);
  drift.realJourneyAttempts[1].before.sha256 = sha(beforeFile); write(branch.report, drift); branch.reportSha256 = sha(branch.report);
  const discontinuous = run('changed-real-save-chain', 1); assert.equal(discontinuous.status, 'incomplete-or-invalid-data');
  buildBranches({ low: 13, medium: 13, severe: 13, alternating: 9 });
  const uneven = run('uneven48', 1); assert.equal(uneven.validatedTrips, 48); assert.deepEqual(uneven.gradeCounts, { low: 16, medium: 16, severe: 16 });
  assert.equal(uneven.status, 'incomplete-or-invalid-data', '48 total and16 per grade cannot replace four complete branches');
  buildBranches();
  const firstBranch = summary.branches[0], changedInitial = JSON.parse(originals.get(firstBranch.report));
  changedInitial.realJourneyAttempts[0].before.state.kindlingReserve++;
  const initialFile = write(path.join(temporary, 'low', 'low', '1-before.save.json'), changedInitial.realJourneyAttempts[0].before.state);
  changedInitial.realJourneyAttempts[0].before.sha256 = sha(initialFile); write(firstBranch.report, changedInitial); firstBranch.reportSha256 = sha(firstBranch.report);
  const refilled = run('refilled-initial-save', 1); assert.equal(refilled.status, 'incomplete-or-invalid-data');
  console.log('PASS synthetic48 review I/O: natural replay, exact branches/earned resources, use/cost accounting, legitimate near-only returns distinguished; four invalid cases rejected; experience stays pending');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
function usesOf(state) { return state.inventory.items[0].contaminant.usesRemaining; }
