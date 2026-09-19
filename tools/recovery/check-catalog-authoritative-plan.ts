/** A saved valid result remains authoritative even when it differs from a reroll.
 * Directed edits are explicit; this is recovery validation, not loot sampling.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CATALOG_SOURCE_AFFINITIES } from '../../src/generated/contaminant-catalog-data';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { validateProceduralRiftAdmission } = await import('../../src/managers/rift-recovery');
const { InventoryStore } = await import('../../src/systems/inventory-store');
// saveManager validates inventory first, then the procedural world adapter.
const admitted = (value: any) => new InventoryStore().loadState(value.inventory)
  && validateProceduralRiftAdmission(value.riftCheckpoint, value.inventory);
const source = 'docs/qa/artifacts/iteration-28/browser/natural-current/03-carry.storage.json';
const record = JSON.parse(JSON.parse(readFileSync(source, 'utf8'))['coh-save-v1']);
assert(admitted(record), 'Real carried-shell checkpoint must load');
const saved = structuredClone(record);
const plan = saved.inventory.run.dropPlan;
const unopened = plan.entries.find((entry: any) => !saved.inventory.run.revealedNodes[entry.nodeId]);
assert(unopened && unopened.contaminant.catalog.definitionId !== 'amber_beetle');
const oldDefinition = unopened.contaminant.catalog.definitionId;
unopened.contaminant.catalog.definitionId = 'amber_beetle';
const sourceTag = Object.keys(CATALOG_SOURCE_AFFINITIES).find(tag => tag !== 'unbiased' && tag !== plan.entries[0].sourceTag)!;
assert(sourceTag);
plan.sourceRegions = Object.fromEntries(saved.riftCheckpoint.state.search.nodes.map((node: any) =>
  [node.id, { sourceTag, hint: '定向边界测试：存档中的片区提示' }]));
for (const entry of plan.entries) entry.sourceTag = sourceTag;
const frozen = structuredClone(saved);
assert(admitted(saved),
  'Legal saved identities and source districts must not be rejected because they differ from today’s reroll');
assert.deepEqual(saved, frozen, 'Admission must not rewrite stored drops or source hints');
const missingFuel = structuredClone(saved);
const fuel = saved.riftCheckpoint.state.search.nodes.find((node: any) => node.kind === 'kindling');
delete missingFuel.inventory.run.dropPlan.sourceRegions[fuel.id];
assert(!admitted(missingFuel), 'Missing saved fuel district must reject');
const mismatched = structuredClone(saved);
mismatched.inventory.run.dropPlan.entries[0].sourceTag = 'unbiased';
assert(!admitted(mismatched), 'Entry and district source tags must agree');
const path = 'docs/qa/artifacts/iteration-28/reveal-persistence';
mkdirSync(path, { recursive: true });
writeFileSync(`${path}/authoritative-plan.json`, JSON.stringify({
  status: 'PASS', source,
  method: 'Directed recovery boundary: change one unopened valid definition and all saved source labels; keep real map/checkpoint, acquired item and cached reveal unchanged. No production data edited.',
  changedUnopenedNode: unopened.nodeId, oldDefinition, savedDefinition: 'amber_beetle', savedSourceTag: sourceTag,
  checks: ['real checkpoint admitted', 'valid fixed result admitted without reroll comparison', 'saved hints not mutated', 'missing fuel district rejected', 'inconsistent source tag rejected'],
}, null, 2));
console.log('PASS catalog fixed-plan admission: saved item/district authority, missing fuel district and source mismatch reject');
