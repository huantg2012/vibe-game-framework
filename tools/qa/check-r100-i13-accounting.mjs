/** Independent, read-only accounting of actual journey receipts.
 * Writes only a new QA artifact; never launches a browser or changes a save.
 * --historical or repeated --report <report.json>, --output <new.json>
 * Cash, facility HP, growth and item lifecycles stay separate: no invented prices.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({ path: path.relative(ROOT, file), sha256: sha(file) });
const lifecycle = item => item[item.kind];
const definition = item => item.kind === 'weapon' ? item.weapon.definitionId : item.contaminant.catalog?.definitionId ?? item.contaminant.type;
const sum = (rows, value) => rows.reduce((total, row) => total + value(row), 0);
const map = items => new Map(items.map(item => [item.id, item]));
const brief = item => ({ id: item.id, kind: item.kind, definition: definition(item), stage: lifecycle(item).stage,
  uses: lifecycle(item).usesRemaining, charges: lifecycle(item).impactCharges, location: item.location, source: item.source ?? null });
const failures = [], limits = new Set(), checked = { assertions: 0, snapshotFiles: 0, reports: 0, trips: 0 };
function check(condition, message, detail) {
  checked.assertions++;
  if (!condition) failures.push({ message, ...detail });
}
function equal(actual, expected, message, detail) {
  try { assert.deepEqual(actual, expected); checked.assertions++; }
  catch { checked.assertions++; failures.push({ message, ...detail, actual, expected }); }
}
function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function assets(state) {
  const items = state.inventory.items, buckets = {};
  for (const item of items) {
    const key = `${item.kind}/${definition(item)}/${lifecycle(item).stage}`;
    buckets[key] ??= { count: 0, uses: 0, charges: 0, offeringSlots: 0 };
    const row = buckets[key]; row.count++; row.uses += lifecycle(item).usesRemaining;
    row.charges += lifecycle(item).impactCharges; row.offeringSlots += Number(item.location.kind === 'defense');
  }
  return { reserve: state.kindlingReserve, repairBonusHp: state.repairBonusHp ?? 0,
    modules: state.modules.map(m => ({ id: m.id, hp: m.hp, maxHp: m.maxHp })), growth: state.growth,
    usableWeaponCharges: sum(items.filter(i => i.kind === 'weapon' && lifecycle(i).stage === 'tool'), i => lifecycle(i).usesRemaining),
    usableContaminantCharges: sum(items.filter(i => i.kind === 'contaminant' && lifecycle(i).stage === 'tool'), i => lifecycle(i).usesRemaining),
    items: items.map(brief), buckets };
}
function repairDebt(state, targetHp) {
  const bonus = state.repairBonusHp ?? 0;
  const options = [null, ...state.modules.map(m => m.id)].map(bonusModule => {
    const modules = state.modules.map(m => {
      const target = Math.min(m.maxHp, targetHp[m.id]), deficit = Math.max(0, target - m.hp);
      const credit = m.id === bonusModule ? bonus : 0;
      return { id: m.id, hp: m.hp, target, deficit, kindling: deficit ? Math.max(1, Math.ceil((deficit - credit) / 4)) : 0,
        bonusApplied: deficit && credit ? credit : 0 };
    });
    return { bonusModule, modules, kindling: sum(modules, m => m.kindling) };
  });
  return options.sort((a, b) => a.kindling - b.kindling)[0];
}
function phaseTimes(log, ordinal) {
  const stamp = label => log.find(row => row.event === 'snapshot' && row.label === label)?.at;
  const entry = stamp(`${ordinal}-entry`), end = stamp(`${ordinal}-field-result`), returned = stamp(`${ordinal}-return`), next = stamp(`${ordinal + 1}-entry`);
  return { entry, fieldEnd: end, returned, nextEntry: next,
    observedEntryToFieldEndMs: entry && end ? Date.parse(end) - Date.parse(entry) : null,
    observedReturnToNextEntryMs: returned && next ? Date.parse(next) - Date.parse(returned) : null,
    interpretation: 'Operator wall time includes automation, screenshots, loading and UI waits; it is not human time or pure management time.' };
}
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(field.replace(/\r$/, '')); field = ''; if (c === '\n') { rows.push(row); row = []; } }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift(); return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(header.map((k, i) => [k, r[i] ?? ''])));
}
const catalogFile = path.join(ROOT, 'data/contaminant-items.csv');
const catalog = new Map(parseCsv(fs.readFileSync(catalogFile, 'utf8')).map(row => [row.item_id, row]));
function auditReport(file) {
  checked.reports++;
  const report = read(file), folder = path.dirname(file), files = walk(folder), runs = report.realJourneyAttempts ?? [];
  const rows = [], pending = runs.filter(row => row.status !== 'completed-real-input').map(row => ({ ordinal: row.ordinal, status: row.status, failure: row.failure }));
  const logs = files.filter(name => path.basename(name) === 'journey.jsonl');
  const log = logs.flatMap(name => fs.readFileSync(name, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
  const initial = runs.find(r => r.status === 'completed-real-input')?.before.state;
  const serviceTarget = Object.fromEntries((initial?.modules ?? []).map(m => [m.id, Math.min(100, m.hp)]));
  const fullEffectTarget = Object.fromEntries((initial?.modules ?? []).map(m => [m.id, 100]));
  const capitalTarget = Object.fromEntries((initial?.modules ?? []).map(m => [m.id, m.hp]));
  let previous = null;
  for (const trip of runs.filter(row => row.status === 'completed-real-input')) {
    checked.trips++;
    const context = { report: path.relative(ROOT, file), ordinal: trip.ordinal };
    const states = {};
    for (const [key, label] of [['before','before'], ['entrySave','entry'], ['afterReturn','returned'], ['afterPreparation','after-preparation']]) {
      const stored = trip[key]; check(!!stored?.state && !!stored.sha256, `Required ${key} snapshot`, context);
      if (!stored?.state) continue;
      const candidates = files.filter(name => path.basename(name) === `${trip.ordinal}-${label}.save.json`);
      const exact = candidates.find(name => sha(name) === stored.sha256);
      check(!!exact, `Exact ${key} saved bytes`, context);
      if (exact) { equal(read(exact), stored.state, `${key} parsed state`, context); checked.snapshotFiles++; }
      states[key] = stored.state;
    }
    if (Object.keys(states).length !== 4) continue;
    const { before: b, entrySave: e, afterReturn: r, afterPreparation: p } = states;
    if (previous) equal(b, previous, 'Adjacent actual prepared state preserved', context);
    previous = p;
    const bi = map(b.inventory.items), ei = map(e.inventory.items), ri = map(r.inventory.items), pi = map(p.inventory.items);
    const run = r.inventory.run, entryRun = e.inventory.run;
    equal(run.id, entryRun.id, 'Same entered and settled run', context);
    check(run.status === 'settled' && run.baseSettled === true && run.outcome === trip.outcome, 'Actual completed settlement', context);
    equal(e.cycle, b.cycle + 1, 'Single departure cycle', context);
    equal(e.kindlingReserve, b.kindlingReserve, 'No departure cash fixture', context);
    equal(e.modules, b.modules, 'No departure facility fixture', context);
    equal(e.growth, b.growth, 'No departure growth fixture', context);
    equal([...bi.keys()].sort(), [...ei.keys()].sort(), 'No departure item fixture or disappearance', context);
    const passive = entryRun.passiveReceipts ?? [];
    for (const item of e.inventory.items) {
      const old = bi.get(item.id); if (!old) continue;
      equal(definition(item), definition(old), 'Item definition frozen at departure', { ...context, id: item.id });
      equal(item.source, old.source, 'Item acquisition source frozen at departure', { ...context, id: item.id });
      const receipt = passive.find(row => row.itemId === item.id);
      equal(lifecycle(old).usesRemaining - lifecycle(item).usesRemaining, receipt?.usesConsumed ?? 0, 'Only receipted passive charges paid at departure', { ...context, id: item.id });
      if (receipt) { equal(receipt.usesConsumed, 1, 'Passive consumes one trip', context); equal(receipt.usesRemaining, lifecycle(item).usesRemaining, 'Passive receipt balance', context); }
    }
    const actions = trip.management?.actions ?? [], repairs = sum(actions.filter(a => a.kind === 'repair'), a => a.spent), growth = sum(actions.filter(a => a.kind === 'growth'), a => a.cost);
    check(actions.every(a => ['repair','growth'].includes(a.kind)), 'All management cash actions classified', context);
    equal(r.kindlingReserve - b.kindlingReserve, run.kindlingGained, 'Settled cash equals actual reserve increase', context);
    equal(r.kindlingReserve - p.kindlingReserve, repairs + growth, 'Repair and growth cash reconcile', context);
    equal(run.kindlingGained, trip.outcome === 'extract' ? trip.fieldResult.carried : 0, 'Only extracted cash banks', context);
    const conditions = e.riftCheckpoint?.state?.conditions;
    // Weapons can be an additional revealed item on a kindling pile; they do
    // not replace the pile's kindling. Do not exclude revealedNodes here.
    const kindlingPiles = trip.fieldResult.nodes.filter(n => n.collected && n.kind === 'kindling');
    if (conditions) equal(sum(kindlingPiles, n => Math.max(1, Math.floor((n.value + conditions.kindlingAffinity) * conditions.modifiers.kindlingValueModifier))), trip.fieldResult.carried, 'Per-pile integer yield equals carried cash', context);
    else limits.add('At least one record lacks frozen sortie conditions; its per-pile formula cannot be audited.');
    const growthChanges = Object.keys(p.growth.upgrades).filter(id => p.growth.upgrades[id] !== r.growth.upgrades[id]).map(id => ({ id, before: r.growth.upgrades[id], after: p.growth.upgrades[id] }));
    for (const change of growthChanges) equal(change.after - change.before, actions.filter(a => a.kind === 'growth' && a.id === change.id).length, 'Growth level has paid action', { ...context, id: change.id });
    const modules = b.modules.map(start => {
      const entered = e.modules.find(m => m.id === start.id), returned = r.modules.find(m => m.id === start.id), prepared = p.modules.find(m => m.id === start.id);
      let hp = returned.hp;
      for (const action of actions.filter(a => a.kind === 'repair' && a.module === start.id)) { equal(action.beforeHp, hp, 'Repair starts from actual HP', context); hp = action.afterHp; }
      equal(hp, prepared.hp, 'Prepared facility HP matches repair receipts', { ...context, id: start.id });
      return { id: start.id, beforeHp: start.hp, entryHp: entered.hp, returnedHp: returned.hp, preparedHp: prepared.hp,
        beforeMax: start.maxHp, preparedMax: prepared.maxHp, change: prepared.hp - start.hp, actualRepairPaid: sum(actions.filter(a => a.kind === 'repair' && a.module === start.id), a => a.spent) };
    });
    let repairBonus = r.repairBonusHp ?? 0;
    for (const action of actions.filter(a => a.kind === 'repair')) {
      const module = r.modules.find(m => m.id === action.module);
      equal(action.afterHp, Math.min(module.maxHp, action.beforeHp + action.spent * 4 + repairBonus), 'Real injection follows integer repair and single bonus', { ...context, id: action.module });
      repairBonus = 0;
    }
    equal(p.repairBonusHp ?? 0, repairBonus, 'Shared repair credit consumed at most once', context);
    const currentOffering = r.inventory.offeringReceipts?.[`impact:${run.id}`] ?? [];
    const matured = [], consumed = [], lost = [], fieldNew = [], unknown = [];
    const actionReceipts = Object.values(run.actionReceipts ?? {});
    for (const item of e.inventory.items) {
      const after = ri.get(item.id), lc = lifecycle(item), ac = after && lifecycle(after), useReceipts = actionReceipts.filter(a => a.itemId === item.id);
      if (after) {
        equal(after.source, item.source, 'Existing item retains original acquisition source', { ...context, id: item.id });
        equal(definition(after), definition(item), 'Existing item retains definition through settlement', { ...context, id: item.id });
      }
      if (item.location.kind !== 'carried') {
        check(!!after, 'Base-held asset remains owned', { ...context, id: item.id });
        if (after && lc.stage !== ac.stage) {
          check(item.location.kind === 'defense' && currentOffering.some(x => x.itemId === item.id), 'Maturity has actual offering receipt', { ...context, id: item.id });
          matured.push({ before: brief(item), after: brief(after), family: catalog.get(definition(after))?.family_id ?? null });
        }
        continue;
      }
      const pr = passive.find(x => x.itemId === item.id);
      const lastReceipt = useReceipts.at(-1), endingUses = after ? ac.usesRemaining : lastReceipt?.usesLeft;
      if (item.kind === 'contaminant' && !pr) {
        for (const [i, action] of useReceipts.entries()) equal(action.usesLeft, lc.usesRemaining - i - 1, 'Active action charge sequence', { ...context, id: item.id });
        if (after) equal(ac.usesRemaining, lc.usesRemaining - useReceipts.length, 'Active returned charge balance', { ...context, id: item.id });
        consumed.push({ id: item.id, kind: item.kind, definition: definition(item), family: catalog.get(definition(item))?.family_id ?? null, uses: useReceipts.length, source: item.source });
      } else if (pr) consumed.push({ id: item.id, kind: 'passive', definition: definition(item), family: pr.familyId, uses: pr.usesConsumed, source: item.source });
      else if (after) consumed.push({ id: item.id, kind: 'weapon', definition: definition(item), uses: lc.usesRemaining - ac.usesRemaining, method: 'actual surviving-item balance', source: item.source });
      if (!after) {
        if (run.destroyedIds.includes(item.id)) {
          if (item.kind === 'weapon') consumed.push({ id: item.id, kind: 'weapon', definition: definition(item), uses: lc.usesRemaining, method: 'actual exhausted item', source: item.source });
          if (item.kind === 'contaminant') equal(pr ? lc.usesRemaining : endingUses, 0, 'Destroyed contaminant exhausted', { ...context, id: item.id });
        } else if (['death','abandon'].includes(trip.outcome)) {
          lost.push({ ...brief(item), remainingUsesAtLoss: pr ? lc.usesRemaining : item.kind === 'contaminant' ? lc.usesRemaining - useReceipts.length : null,
            usesAtEntry: lc.usesRemaining, consumedBeforeLoss: item.kind === 'contaminant' ? useReceipts.length : null });
          if (item.kind === 'weapon') { unknown.push(`Lost weapon ${item.id}: last durable state has ${lc.usesRemaining} uses; no per-swing durable receipt separates use from death loss.`); limits.add('Death/abandon weapon charges have exact total asset loss but consumption-versus-lost-residual split is unknown without a final inventory snapshot.'); }
        } else failures.push({ message: 'Unexplained equipped asset disappearance', ...context, item: brief(item) });
      }
    }
    for (const item of r.inventory.items.filter(i => !ei.has(i.id))) {
      check(run.returnedIds.includes(item.id), 'New returned item has settlement receipt', { ...context, id: item.id }); fieldNew.push(brief(item));
    }
    for (const id of run.returnedIds) check(ri.has(id) && !ei.has(id), 'Returned ID is genuinely new', { ...context, id });
    const offered = trip.offered ?? [];
    equal([...ri.keys()].sort(), [...pi.keys()].sort(), 'Management creates/destroys no inventory assets', context);
    for (const item of p.inventory.items) {
      const old = ri.get(item.id); if (!old) continue;
      equal(lifecycle(item), lifecycle(old), 'Management does not refill or mature equipment', { ...context, id: item.id });
      equal(item.source, old.source, 'Management preserves acquisition source', { ...context, id: item.id });
      if (item.location.kind === 'defense' && old.location.kind !== 'defense') check(offered.includes(item.id), 'New offering has actual input receipt', { ...context, id: item.id });
    }
    const slotProgress = e.inventory.equipment.defenseIds.filter(Boolean).map(id => ({ id, entry: ei.has(id) ? brief(ei.get(id)) : null, returned: ri.has(id) ? brief(ri.get(id)) : null }));
    if (trip.outcome === 'death') { equal(run.returnedIds, [], 'Death banks no new items', context); for (const id of entryRun.carriedOutIds) check(!ri.has(id), 'Death removes carried assets', { ...context, id }); }
    const serviceDebt = { before: repairDebt(b, serviceTarget), returned: repairDebt(r, serviceTarget), prepared: repairDebt(p, serviceTarget) };
    rows.push({ ordinal: trip.ordinal, grade: trip.grade, outcome: trip.outcome, world: trip.identity.generation.package.id,
      seed: trip.identity.seed, algorithmRevision: trip.identity.generation.package.algorithmRevision, runId: run.id,
      fieldMs: trip.fieldResult.elapsedMs, observedTiming: phaseTimes(log, trip.ordinal), recordedI13Timing: trip.i13Timing ?? trip.timing ?? null,
      cash: { start: b.kindlingReserve, banked: run.kindlingGained, repair: repairs, growth, cashAfterRepair: run.kindlingGained - repairs,
        sameServiceMargin: run.kindlingGained - repairs - (serviceDebt.prepared.kindling - serviceDebt.before.kindling),
        reserveDelta: p.kindlingReserve - b.kindlingReserve, end: p.kindlingReserve, carriedCashLost: trip.outcome === 'extract' ? 0 : trip.fieldResult.carried },
      serviceDebt, fullEffectDebt: { before: repairDebt(b, fullEffectTarget), prepared: repairDebt(p, fullEffectTarget) },
      originalCapitalDebt: { before: repairDebt(b, capitalTarget), prepared: repairDebt(p, capitalTarget) },
      modules, growthChanges, conditions, consumed, lost, newItems: fieldNew, matured, offeringSlots: slotProgress, offered, unknown });
  }
  const first = runs.find(r => r.status === 'completed-real-input')?.before.state, last = previous;
  const consumptionByKind = Object.fromEntries(['weapon','contaminant','passive'].map(kind => [kind, sum(rows.flatMap(r => r.consumed).filter(i => i.kind === kind), i => i.uses)]));
  const runIds = new Set(rows.map(row => row.runId));
  const supply = rows.flatMap(row => row.matured).map(item => ({ ...item, sourceScope: runIds.has(item.after.source?.runId) ? 'collected-in-this-sequence' : 'earned-ancestor-stock' }));
  const freshSupplyChains = rows.flatMap(row => row.newItems.map(item => {
    const offering = rows.find(r => r.offered.includes(item.id)), mature = rows.find(r => r.matured.some(m => m.after.id === item.id));
    const consumedLater = rows.filter(r => r.ordinal > row.ordinal).flatMap(r => r.consumed.filter(c => c.id === item.id && c.uses > 0).map(c => ({ ordinal: r.ordinal, uses: c.uses, kind: c.kind })));
    return { item, collectedOrdinal: row.ordinal, firstOfferedOrdinal: offering?.ordinal ?? null, maturedOrdinal: mature?.ordinal ?? null,
      consumedLater, completeRecordedSupplyAndConsumption: !!offering && !!mature && consumedLater.length > 0,
      semanticEffectConfirmed: false };
  }));
  const restoredFacilities = first && last ? first.modules.map(module => {
    const end = last.modules.find(row => row.id === module.id);
    return { id: module.id, start: module.hp, end: end.hp, missingHpToStart: Math.max(0, module.hp - end.hp),
      kindlingToRestoreStartBeforeSharedBonus: Math.ceil(Math.max(0, module.hp - end.hp) / 4) };
  }) : [];
  return { report: ref(file), policyRevision: report.policyRevision, controlledWorld: report.controlledWorld ?? null, controlledBuild: report.controlledBuild ?? null,
    completed: rows.length, pending, sourceMode: report.controlledWorld ? 'fixed-world-diagnostic' : 'natural-world-selection',
    serviceTarget, fullEffectTarget, capitalTarget, restoredFacilities, supply, freshSupplyChains,
    startAssets: first ? assets(first) : null, endAssets: last ? assets(last) : null,
    totals: { banked: sum(rows, r => r.cash.banked), repair: sum(rows, r => r.cash.repair), growth: sum(rows, r => r.cash.growth),
      cashAfterRepair: sum(rows, r => r.cash.cashAfterRepair), sameServiceMargin: sum(rows, r => r.cash.sameServiceMargin), reserveDelta: sum(rows, r => r.cash.reserveDelta),
      carriedCashLost: sum(rows, r => r.cash.carriedCashLost), fieldMs: sum(rows, r => r.fieldMs), deaths: rows.filter(r => r.outcome === 'death').length,
      actualConsumedCharges: consumptionByKind, lostItems: sum(rows, r => r.lost.length), newItems: sum(rows, r => r.newItems.length),
      maturedItems: sum(rows, r => r.matured.length), maturedFromThisSequence: supply.filter(row => row.sourceScope === 'collected-in-this-sequence').length,
      maturedFromEarnedAncestor: supply.filter(row => row.sourceScope === 'earned-ancestor-stock').length, offeringAssignments: sum(rows, r => r.offered.length) }, rows };
}
const args = process.argv.slice(2), reports = [];
if (args.includes('--self-check')) {
  const base = path.join(ROOT, 'docs/qa/artifacts/r100-i10-i12/continuous-final108');
  const normal = read(path.join(base, 'low/report.json')).realJourneyAttempts[0];
  const maturity = read(path.join(base, 'low/report.json')).realJourneyAttempts.find(r => (r.afterReturn.state.inventory.offeringReceipts?.[`impact:${r.afterReturn.state.inventory.run.id}`]?.length ?? 0) > 0);
  const dead = read(path.join(base, 'medium/report.json')).realJourneyAttempts.find(r => r.outcome === 'death');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-i13-accounting-'));
  const cases = [
    { name: 'unaltered-real-receipt', trip: normal, expected: null, mutate() {} },
    { name: 'unpaid-extra-cash', trip: normal, expected: 'Repair and growth cash reconcile', mutate(r) { r.afterPreparation.state.kindlingReserve++; } },
    { name: 'free-tool-refill-at-management', trip: normal, expected: 'Management does not refill or mature equipment', mutate(r) {
      r.afterPreparation.state.inventory.items.find(i => i.kind === 'contaminant' && i.contaminant.stage === 'tool').contaminant.usesRemaining++;
    } },
    { name: 'base-held-item-swallowed', trip: normal, expected: 'Base-held asset remains owned', mutate(r) {
      const id = r.entrySave.state.inventory.items.find(i => i.location.kind === 'stash').id;
      for (const key of ['afterReturn','afterPreparation']) r[key].state.inventory.items = r[key].state.inventory.items.filter(i => i.id !== id);
    } },
    { name: 'unreceipted-maturity', trip: normal, expected: 'Maturity has actual offering receipt', mutate(r) {
      const id = r.entrySave.state.inventory.items.find(i => i.location.kind === 'stash' && lifecycle(i).stage === 'defense').id;
      for (const key of ['afterReturn','afterPreparation']) { const item = r[key].state.inventory.items.find(i => i.id === id); lifecycle(item).stage = 'tool'; lifecycle(item).usesRemaining = 9; }
    } },
    { name: 'dead-equipped-tool-retained', trip: dead, expected: 'Death removes carried assets', mutate(r) {
      const item = r.entrySave.state.inventory.items.find(i => i.kind === 'contaminant' && i.location.kind === 'carried' && !r.afterReturn.state.inventory.run.destroyedIds.includes(i.id));
      for (const key of ['afterReturn','afterPreparation']) r[key].state.inventory.items.push(structuredClone(item));
    } },
    { name: 'same-run-free-departure-resource', trip: normal, expected: 'No departure facility fixture', mutate(r) { r.entrySave.state.modules[0].hp++; } },
    { name: 'ancestor-maturity-relabelled-new-supply', trip: maturity, expected: 'Existing item retains original acquisition source', mutate(r) {
      const runId = r.afterReturn.state.inventory.run.id, id = r.afterReturn.state.inventory.offeringReceipts[`impact:${runId}`][0].itemId;
      for (const key of ['afterReturn','afterPreparation']) r[key].state.inventory.items.find(i => i.id === id).source.runId = runId;
    } },
  ];
  const results = [];
  for (const c of cases) {
    const folder = path.join(root, c.name); fs.mkdirSync(folder);
    const trip = structuredClone(c.trip); c.mutate(trip);
    for (const [key,label] of [['before','before'],['entrySave','entry'],['afterReturn','returned'],['afterPreparation','after-preparation']]) {
      const file = path.join(folder, `${trip.ordinal}-${label}.save.json`); fs.writeFileSync(file, JSON.stringify(trip[key].state)); trip[key].sha256 = sha(file);
    }
    const file = path.join(folder, 'report.json'), resultFile = path.join(folder, 'audit.json');
    fs.writeFileSync(file, JSON.stringify({ policyRevision: 15, realJourneyAttempts: [trip] }));
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--report', file, '--output', resultFile], { cwd: ROOT, encoding: 'utf8' });
    assert(fs.existsSync(resultFile), child.stderr || 'Child audit produced no artifact');
    const result = read(resultFile);
    if (c.expected) { assert.equal(child.status, 1); assert(result.failures.some(row => row.message === c.expected), `${c.name}: expected ${c.expected}`); }
    else { assert.equal(child.status, 0); assert.deepEqual(result.failures, []); }
    results.push({ name: c.name, expectedFailure: c.expected, exitCode: child.status, actualFailures: result.failures.map(row => row.message),
      savedBytesRehashedAfterMutation: true, outcome: 'pass' });
  }
  const debtState = { repairBonusHp: 6, modules: [{ id: 'CORE', hp: 90, maxHp: 130 }, { id: 'STORAGE', hp: 90, maxHp: 130 }, { id: 'PURIFIER', hp: 100, maxHp: 130 }] };
  assert.equal(repairDebt(debtState, { CORE:100, STORAGE:100, PURIFIER:100 }).kindling, 4, 'One six-HP credit cannot be used for both modules');
  debtState.repairBonusHp = 20;
  assert.equal(repairDebt(debtState, { CORE:100, STORAGE:100, PURIFIER:100 }).kindling, 4, 'Even oversized credit needs one paid injection and cannot spill');
  const oi = args.indexOf('--output'); assert(oi >= 0 && args[oi + 1]); const output = path.resolve(args[oi + 1]); assert(!fs.existsSync(output));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const result = { status: 'pass', recordedDate: '2026-10-08', tool: ref(fileURLToPath(import.meta.url)), method: 'Mutate real historical state and rehash all four saved files; rejection must come from economic/ownership semantics, not stale bytes.',
    cases: results, integerRepairBonusCases: 2, gameRuntimeModified: false };
  fs.writeFileSync(output, JSON.stringify(result,null,2)+'\n', { flag: 'wx' });
  fs.rmSync(root, { recursive: true, force: true }); console.log(JSON.stringify({ output: ref(output), status: 'pass', cases: results.length, integerRepairBonusCases:2 }));
  process.exit(0);
}
if (args.includes('--historical')) for (const branch of ['low','medium','severe','alternating']) reports.push(path.join(ROOT, 'docs/qa/artifacts/r100-i10-i12/continuous-final108', branch, 'report.json'));
for (let i = 0; i < args.length; i++) if (args[i] === '--report') reports.push(path.resolve(args[++i]));
const oi = args.indexOf('--output'); assert(reports.length && oi >= 0 && args[oi + 1], '--historical or --report, and --output required');
const output = path.resolve(args[oi + 1]); assert(!fs.existsSync(output), 'Never overwrite evidence');
const branches = reports.map(auditReport);
limits.add('No asset is assigned an invented kindling sale price; heterogeneous tools and facility HP cannot be added into cash.');
limits.add('Exact owned stocks and maturity are accounting evidence, not proof that abilities created useful action windows.');
limits.add('Shared ancestors/fixed-world branches are not independent players or estimates of long-term expected grade value.');
limits.add('Per-field and operator wall time are distinct; pure human preparation, listening, fatigue and all-world balance remain unverified.');
const result = { version: 1, recordedDate: '2026-10-08', status: failures.length ? 'accounting-failed' : 'bounded-accounting-pass-with-explicit-unknowns',
  reviewer: '/root/i13_qa', tool: ref(fileURLToPath(import.meta.url)), catalog: ref(catalogFile), checked, failures,
  totalTrips: sum(branches, b => b.completed), branches, limitations: [...limits] };
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: ref(output), status: result.status, checked, failures: failures.slice(0, 12), branches: branches.map(b => ({ report: b.report.path, totals: b.totals,
  weaponCharges: [b.startAssets?.usableWeaponCharges, b.endAssets?.usableWeaponCharges], modules: [b.startAssets?.modules, b.endAssets?.modules] })) }));
process.exitCode = failures.length ? 1 : 0;
