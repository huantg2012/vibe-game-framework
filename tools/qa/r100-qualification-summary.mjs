/** Combine fixed generation attempts by identity, retaining every failure.
 * This proves only CPU generation/recovery coverage, never art or play quality.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {fileURLToPath} from 'node:url';

export function buildGenerationSummary(planPath, bytes = file => fs.readFileSync(file), exists = file => fs.existsSync(file)) {
const read = file => JSON.parse(bytes(file));
const sha = file => createHash('sha256').update(bytes(file)).digest('hex');
const plan = read(planPath);
const key = row => `${row.world}/${row.grade}/${row.seed}`;
const grades = ['low', 'medium', 'severe'];
const ordinary = Array.from({ length: 32 }, (_, i) => ((i + 1) * 0x100000000 / 33) >>> 0);
const boundary = [0, 1, 28, 65535, 65536, 0x7fffffff, 0xffffffff, 3390232493];
assert.equal(plan.version, 1);
assert(Array.isArray(plan.worlds) && plan.worlds.length > 0 && new Set(plan.worlds).size === plan.worlds.length);
assert(Array.isArray(plan.groups) && plan.groups.length > 0);
const heldFile = 'docs/qa/artifacts/r100-i07-i09/qualification-policy/holdout-seeds.json';
const held = read(heldFile), heldSeeds = Array.isArray(held) ? held : held.seeds;
assert.equal(heldSeeds.length, 8);
const seeds = [...ordinary.map(seed => ({ seed, cohort: 'ordinary' })),
  ...boundary.map(seed => ({ seed, cohort: 'boundary' })),
  ...heldSeeds.map(seed => ({ seed, cohort: 'independent-holdout' }))];
assert.equal(new Set(seeds.map(row => row.seed)).size, 48);
assert(seeds.every(row => Number.isSafeInteger(row.seed) && row.seed >= 0 && row.seed <= 0xffffffff));
const expected = new Map(plan.worlds.flatMap(world => grades.flatMap(grade => seeds.map(row => {
  const value = { world, grade, ...row }; return [key(value), value];
}))));
const records = new Map(), owners = new Set(), groups = [], originalFailures = [], supersededAttempts = [];
const supersededWorlds = new Set();
let attempts = 0;
for (const group of plan.groups) {
  assert(group.worlds.length && new Set(group.worlds).size === group.worlds.length);
  for (const world of group.worlds) {
    assert(plan.worlds.includes(world) && !owners.has(world), `Missing or duplicate world ownership: ${world}`);
    owners.add(world);
  }
  // A corrected authored world is requalified as a whole, never by selecting
  // favorable old seeds. The prior batch's other worlds can keep exact evidence.
  const superseded = new Set(group.supersededWorlds ?? []), archivedCases = new Map();
  assert.equal(superseded.size, (group.supersededWorlds ?? []).length);
  for (const world of superseded) {
    assert(plan.worlds.includes(world) && !group.worlds.includes(world));
    supersededWorlds.add(world);
  }
  assert(group.attempts.length > 0);
  let executorSha256, dependencies;
  const receipts = [];
  for (const folder of group.attempts) {
    const sourceFile = path.join(folder, 'source-snapshot.json'), source = read(sourceFile);
    const executor = path.join(folder, `qualification-${source.sha256.slice(0, 12)}.mjs`);
    assert.equal(sha(executor), source.sha256, `Executor bytes changed: ${folder}`);
    if (executorSha256) {
      assert.equal(source.sha256, executorSha256, `Changed executor inside a retry/holdout group: ${folder}`);
      assert.deepEqual(source.dependencies, dependencies, `Changed source declaration: ${folder}`);
    } else { executorSha256 = source.sha256; dependencies = source.dependencies; }
    // Early frozen runners predate the separate plan file. Their report still
    // records the input seed policy; derive only the declared Cartesian product,
    // never a plan from successful output rows.
    const separatePlan = path.join(folder, 'planned-cases.json');
    const plannedFile = exists(separatePlan) ? separatePlan : path.join(folder, 'report.json');
    const originalPlan = read(plannedFile);
    const planned = exists(separatePlan) ? originalPlan : {
      executorSha256: originalPlan.source.sha256,
      cases: [...group.worlds, ...superseded].flatMap(world => grades.flatMap(grade => originalPlan.seeds.map(row => ({ world, grade, ...row })))),
    };
    assert.equal(planned.executorSha256, source.sha256);
    const plannedKeys = new Set();
    for (const row of planned.cases) {
      const id = key(row);
      assert.deepEqual(row, expected.get(id), `Unexpected fixed case/cohort: ${id}`);
      assert((group.worlds.includes(row.world) || superseded.has(row.world)) && !plannedKeys.has(id));
      plannedKeys.add(id);
    }
    const rawFile = path.join(folder, 'cases.jsonl');
    const raw = bytes(rawFile).toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const local = new Set();
    for (const row of raw) {
      const id = key(row);
      assert(plannedKeys.has(id) && !local.has(id), `Duplicate or unplanned raw case: ${id}`);
      assert.equal(row.cohort, expected.get(id).cohort);
      assert.equal(typeof row.ok, 'boolean');
      if (row.ok) {
        assert(row.value && key(row.value) === id && row.value.cohort === row.cohort, `Result identity mismatch: ${id}`);
        assert.equal(typeof row.value.signature, 'string');
      }
      if (superseded.has(row.world)) {
        assert(!archivedCases.get(id)?.ok, `An already successful superseded case was rerun: ${id}`);
        archivedCases.set(id, row);
        supersededAttempts.push({id, ok: row.ok, source: rawFile, executorSha256, error: row.error ?? null});
        if (!row.ok) originalFailures.push({...row, source: rawFile, executorSha256, superseded: true});
        local.add(id); attempts++; continue;
      }
      assert(!records.get(id)?.ok, `An already successful case was rerun: ${id}`);
      if (!row.ok) originalFailures.push({ ...row, source: rawFile, executorSha256 });
      records.set(id, { ...row, source: rawFile, executorSha256 }); local.add(id); attempts++;
    }
    receipts.push({ folder, planned: planned.cases.length, executed: raw.length,
      source: { path: sourceFile, sha256: sha(sourceFile) },
      plan: { path: plannedFile, sha256: sha(plannedFile) }, raw: { path: rawFile, sha256: sha(rawFile) } });
  }
  for (const world of superseded) assert.equal([...archivedCases.values()].filter(row => row.world === world).length,
    grades.length * seeds.length, `Archive the entire original world qualification, not selected cases: ${world}`);
  groups.push({ id: group.id, worlds: group.worlds, supersededWorlds: [...superseded], executorSha256, dependencies, attempts: receipts });
}
assert.deepEqual([...owners].sort(), [...plan.worlds].sort());
for (const world of supersededWorlds) assert(owners.has(world), `Superseded world lacks a replacement group: ${world}`);
const missing = [...expected.keys()].filter(id => !records.has(id));
const failed = [...records].filter(([, row]) => !row.ok).map(([id, row]) => ({ id, ...row }));
const summary = {
  status: missing.length || failed.length ? 'incomplete' : 'pass',
  scope: 'Fixed CPU generation, collision/content contracts, live Host state and cold reconstruction. Not art, gameplay, production entry or performance approval. Final runtime compatibility must be bound separately.',
  plan: { path: planPath, sha256: sha(planPath) },
  independentHoldout: { path: heldFile, sha256: sha(heldFile) },
  worlds: plan.worlds.length, grades: plan.worlds.length * 3, expectedCases: expected.size,
  uniqueCases: records.size, successful: [...records.values()].filter(row => row.ok).length,
  attempts, supersededAttempts, originalFailures, missing, unresolved: failed, groups,
};
return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => process.argv[process.argv.indexOf(name) + 1];
  assert(process.argv.includes('--plan') && process.argv.includes('--output'));
  const output = arg('--output');
  assert(!fs.existsSync(output), 'Do not overwrite an earlier qualification receipt');
  const summary = buildGenerationSummary(arg('--plan'));
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
  console.log(`${summary.status.toUpperCase()}: ${summary.successful}/${summary.expectedCases} unique fixed cases; ${summary.attempts} attempts; ${summary.originalFailures.length} original failures retained`);
  if (summary.status !== 'pass') process.exitCode = 1;
}
