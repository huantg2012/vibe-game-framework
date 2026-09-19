/** Reproducible headless mechanic ledger. No browser or user save is read. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { generateRiftLayout } from '../../src/generation/rift-layout';
import { createContaminantSourceRegions } from '../../src/generation/contaminant-source-regions';
import { TileGrid } from '../../src/systems/tile-grid';
import { createContaminantDropPlan, type ContaminantDropPlan } from '../../src/systems/contaminant-drop-plan';
import { projectItemForPlayer } from '../../src/systems/contaminant-catalog';
import { InventoryStore } from '../../src/systems/inventory-store';
import { applyDefenseEffects } from '../../src/systems/defense-engine';
import { CATALOG_ITEMS } from '../../src/generated/contaminant-catalog-data';
import { WEAPON_DATA } from '../../src/generated/weapon-data';

const output = process.argv[2] ?? 'docs/qa/artifacts/iteration-28/data';
const versions = { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 } as const;
const baseSeed = 2026092000;
const sourceFiles = ['src/generated/contaminant-catalog-data.ts', 'src/systems/contaminant-drop-plan.ts',
  'src/systems/inventory-store.ts', 'src/generation/contaminant-source-regions.ts', 'src/generation/rift-layout.ts'];
const hashes = Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const store = new InventoryStore();
store.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain' });
assert(store.ensureStarter('ledger-starter').ok);
let durable = JSON.stringify(store.getState());
store.setPersistence(state => { durable = JSON.stringify(state); });
function generate(seed: number, runId: string) {
  const started = performance.now();
  const layout = generateRiftLayout(seed);
  const grid = new TileGrid(layout.tileMap);
  const source = createContaminantSourceRegions({ grid, spawn: layout.spawnPoint,
    nodes: [...layout.kindlingNodes, ...layout.contaminantNodes], seed: layout.seed });
  const nodes = layout.contaminantNodes.map(node => ({ id: node.id, tier: node.tier ?? 'safe', sourceTag: source.get(node.id)!.sourceTag }));
  const plan = createContaminantDropPlan({ runId, runSeed: layout.seed, nodes });
  return { layout, source, plan, generationMs: performance.now() - started };
}
function operate(generated: ReturnType<typeof generate>, chosenNode: string, ordinal: number) {
  const { layout, plan, source } = generated;
  const entry = plan.entries.find(item => item.nodeId === chosenNode)!;
  const node = layout.contaminantNodes.find(item => item.id === chosenNode)!;
  const definition = CATALOG_ITEMS[entry.contaminant.catalog!.definitionId]!;
  const unknown = projectItemForPlayer(entry.contaminant);
  assert.equal(unknown.identification, 'unidentified'); assert.equal(unknown.slot, null);
  assert(store.beginRun(plan.runId, versions).ok); assert(store.installDropPlan(plan).ok);
  assert(store.revealBatch(node.id, [{ id: entry.contaminant.id, kind: 'contaminant', contaminant: entry.contaminant }], node.position).ok);
  assert(store.settleRun(plan.runId, 'extract', 0).ok);
  assert(store.slotOffering(entry.contaminant.id, 0).ok);
  const cycles = [];
  while (store.getItem(entry.contaminant.id)?.location.kind === 'defense') {
    const c = store.getContaminants().find(item => item.id === entry.contaminant.id)!;
    const damage = applyDefenseEffects({ CORE: 100, STORAGE: 100, PURIFIER: 100 }, [c], {
      forecastTargetId: 'CORE', actualPrimaryId: 'CORE', stabilityProgress: 0,
      moduleHps: { CORE: 100, STORAGE: 100, PURIFIER: 100 }, moduleMaxHps: { CORE: 100, STORAGE: 100, PURIFIER: 100 },
    });
    const before = c.impactCharges;
    const receiptId = `${plan.runId}:impact:${cycles.length + 1}`;
    const result = store.finishOfferingImpact([c.id], 1, {}, receiptId); assert(result.ok);
    const after = store.getContaminants().find(item => item.id === c.id)!;
    cycles.push({ cycle: cycles.length + 1, receiptId, chargesBefore: before, chargesAfter: after.impactCharges,
      damageOn100: damage.finalDamagePerModule.CORE, transformed: result.value.length > 0 });
    assert(cycles.length <= 3);
  }
  const owned = store.getContaminants().find(item => item.id === entry.contaminant.id)!;
  assert.equal(owned.catalog!.definitionId, entry.contaminant.catalog!.definitionId);
  const revealed = projectItemForPlayer(owned); assert.equal(revealed.identification, 'revealed');
  assert.equal(store.getItem(owned.id)?.location.kind, 'stash');
  assert(store.loadState(JSON.parse(durable)), 'every completed chain reloads its actual persisted state');
  if (definition.class === 'inert') assert(!store.prepareTool(owned.id, 0).ok && !store.prepareTool(owned.id, 2).ok);
  return { ordinal, seed: layout.seed, recipeId: layout.recipeId, fragmentTypeId: layout.fragmentTypeId,
    runId: plan.runId, selectedNode: { id: node.id, position: node.position, tier: entry.tier, ...source.get(node.id) },
    allPlannedNodes: plan.entries, unknownPublicView: unknown, fixedIdentity: entry.contaminant.catalog,
    class: definition.class, familyId: definition.familyId, grade: definition.grade,
    cycles, identificationImpactCount: cycles.length, result: revealed,
    finalLocation: store.getItem(owned.id)!.location.kind, offeringSlotCleared: store.getEquipment().defenseIds[0] === null,
    discoveredPersisted: store.getDiscoveredCatalogIds().includes(definition.id),
    generationCpuMs: Number(generated.generationMs.toFixed(2)), walkingCombatMs: null };
}
const natural = [];
for (let i = 0; i < 30; i++) {
  const generated = generate(baseSeed + i, `i28-natural-${i + 1}`);
  // Node index comes from the generated layout before inspecting any hidden result.
  const chosen = [...generated.layout.contaminantNodes].sort((a, b) => a.id.localeCompare(b.id))[i % generated.layout.contaminantNodes.length]!;
  natural.push(operate(generated, chosen.id, i + 1));
  console.log(`natural ${i + 1}/30 seed=${baseSeed + i} node=${chosen.id}`);
}
const counts = natural.reduce((result, row) => { result[row.class]++; return result; }, { core: 0, weak: 0, inert: 0 });
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'natural-identification-30.json'), JSON.stringify({
  schemaVersion: 1, recordedAt: new Date().toISOString(), evidence: 'headless-mechanic-ledger',
  seedSelection: `${baseSeed} through ${baseSeed + 29}, all 30 consecutive seeds retained`,
  nodeSelection: 'sorted actual contaminant node ID at sampleIndex modulo node count; no identity filtering',
  generation: 'generateRiftLayout with production defaults; actual nodes, tiers and two source districts; no tutorial override',
  limitations: ['Calls real inventory, defense and offering mechanisms without walking, threats, game clocks or human choices.',
    'Not an economy balance, player pacing, visual or probability-distribution acceptance.'],
  sourceSha256: hashes, counts, rows: natural,
}, null, 2) + '\n');

// Separate directed test: a prefilter only saves map-generation cost. Every candidate admitted
// below is regenerated through the real map pipeline and tested against that actual fixed plan.
let directed: ReturnType<typeof operate> | undefined;
let checkedCandidates = 0;
const templateNodes = natural[0]!.allPlannedNodes.map(e => ({ id: e.nodeId, tier: e.tier, sourceTag: e.sourceTag }));
for (let seed = baseSeed + 30; seed < baseSeed + 1000000; seed++) {
  const preview: ContaminantDropPlan = createContaminantDropPlan({ runId: 'prefilter', runSeed: seed, nodes: templateNodes });
  if (!preview.entries.some(e => e.contaminant.quality === 'excellent' && e.contaminant.catalog!.offeringProfileId === 'quiet'
    && CATALOG_ITEMS[e.contaminant.catalog!.definitionId]!.class === 'inert')) continue;
  checkedCandidates++;
  const generated = generate(seed, 'i28-directed-inert-quiet');
  const chosen = generated.plan.entries.find(e => e.contaminant.quality === 'excellent' && e.contaminant.catalog!.offeringProfileId === 'quiet'
    && CATALOG_ITEMS[e.contaminant.catalog!.definitionId]!.class === 'inert');
  if (!chosen) continue;
  directed = operate(generated, chosen.nodeId, 1); break;
}
assert(directed, 'directed excellent inert quiet case found within documented bound');
writeFileSync(join(output, 'directed-inert-quiet.json'), JSON.stringify({ schemaVersion: 1,
  evidence: 'directed-headless-mechanic-ledger', excludedFromNatural30: true,
  selection: 'seed scan above natural sequence; template-plan prefilter, then actual generateRiftLayout and actual source districts verified before selection',
  checkedRealMapCandidates: checkedCandidates, sourceSha256: hashes, row: directed }, null, 2) + '\n');
writeFileSync(join(output, 'README.md'), `# I28 数据与供奉机制证据\n\n` +
  `- 自然序列：固定种子 ${baseSeed}–${baseSeed + 29}，30 张正式默认地图，每图轮换一个真实污染节点。全部结果保留。\n` +
  `- 核心 ${counts.core}、弱效 ${counts.weak}、无能力 ${counts.inert}。这是 30 次诊断结果，不能当理论概率或玩家选择统计。\n` +
  `- 每条使用真实 plan → install → revealBatch → extract → slotOffering → 逐轮防御计算与 finishOfferingImpact → 持久数据重载；完整 node、壳、品质、反应、身份、供奉轮次和去向见 JSON。\n` +
  `- 卓越＋无能力＋沉默反应定向例：种子 ${directed.seed}；单独 JSON，不混入自然 30 条。\n` +
  `- 没有模拟真实行走、战斗或耗时；generationCpuMs 仅本机地图生成计算时间。没有读取用户存档。\n` +
  `- 重跑：\`TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/contaminant-catalog/record-natural-identification.ts\`。\n`);
console.log(JSON.stringify({ natural: counts, directedSeed: directed.seed, output }));
