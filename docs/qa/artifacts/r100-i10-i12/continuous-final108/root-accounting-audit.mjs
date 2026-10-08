/** Root's read-only cross-check of the actual final48 receipts.
 * This is not the frozen automatic reviewer and cannot issue experience approval. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
const ROOT = process.cwd(), folder = path.dirname(fileURLToPath(import.meta.url));
const {collectI09SearchReceipts} = await import(pathToFileURL(path.join(ROOT, 'tools/qa/r100-i09-search-receipts.mjs')));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({path:path.relative(ROOT, file), sha256:sha(file)});
const automatic = read(path.join(folder, 'review.json')), policy = read(path.join(folder, 'policy-freeze.json'));
const summary = read(path.join(folder, 'summary.json'));
assert.equal(automatic.status, 'complete-valid-data-pending-experience-review');
assert.equal(summary.validatedTrips, 48); assert.equal(summary.sourceValid, true);
for (const input of automatic.inputs) assert.equal(sha(input.path), input.sha256);
for (const item of policy.fixedFiles) assert.equal(sha(item.file), item.sha256);
const storage = read(policy.storage), initial = JSON.parse(storage.origins[0].localStorage.find(row=>row.name==='coh-save-v1').value);
const ids = new Set(), branches = [], saveReferences = [];
const totals = {trips:0, nonEntrySearchAndExtract:0, emptyExtractions:0, deaths:0, actualPickups:0, nonEntryPickups:0, extractedPickups:0, kindlingGained:0, repairSpent:0, growthSpent:0, returnedItems:0, destroyedItems:0};
for (const branch of ['low','medium','severe','alternating']) {
  const reportFile = path.join(folder, branch, 'report.json'), report = read(reportFile), rows = [];
  assert.equal(report.policyRevision,15); assert.equal(report.controlledBuild,null); assert.equal(report.controlledWorld,null);
  assert.equal(report.realJourneyAttempts.length,12);
  const reviewed = automatic.branches.find(row=>row.policy===branch);
  for (const [index, trip] of report.realJourneyAttempts.entries()) {
    assert.equal(trip.ordinal,index+1); assert.equal(trip.status,'completed-real-input'); assert.equal(trip.noStateInjection,true);
    assert.deepEqual(trip.errors,[]); assert.deepEqual(trip.consoleErrors,[]);
    assert.equal(trip.grade,branch==='alternating'?['low','medium','severe'][index%3]:branch);
    for (const [key,label] of [['before','before'],['entrySave','entry'],['afterReturn','returned'],['afterPreparation','after-preparation']]) {
      const file=path.join(folder,branch,branch,`${trip.ordinal}-${label}.save.json`);
      assert.equal(sha(file),trip[key].sha256);assert.deepEqual(read(file),trip[key].state);saveReferences.push(ref(file));
    }
    const before=trip.before.state, entry=trip.entrySave.state, returned=trip.afterReturn.state, prepared=trip.afterPreparation.state;
    if(index) assert.deepEqual(before,report.realJourneyAttempts[index-1].afterPreparation.state);
    else {
      for(const key of ['cycle','kindlingReserve','modules','growth','tide']) assert.deepEqual(before[key],initial[key]);
      for(const key of ['items','equipment','run']) assert.deepEqual(before.inventory[key],initial.inventory[key]);
    }
    const world=trip.identity.generation.package.id.slice(5), run=returned.inventory.run, runId=entry.inventory.run.id;
    assert(!ids.has(runId));ids.add(runId); assert.equal(entry.cycle,before.cycle+1);
    assert.equal(run.id,runId);assert.equal(prepared.inventory.run.id,runId);assert.equal(run.status,'settled');assert.equal(run.baseSettled,true);assert.equal(run.outcome,trip.outcome);
    const history={version:1,visits:[...before.inventory.riftWorldHistory.visits.slice(-7),{worldId:world,grade:trip.grade}]};
    for(const state of [entry,returned,prepared]) assert.deepEqual(state.inventory.riftWorldHistory,history);
    const pickups=collectI09SearchReceipts(trip), nonEntry=pickups.filter(row=>row.eligibleNonEntry).length;
    const actions=trip.management?.actions??[], repair=actions.filter(row=>row.kind==='repair').reduce((n,row)=>n+row.spent,0), growth=actions.filter(row=>row.kind==='growth').reduce((n,row)=>n+row.cost,0);
    assert(actions.every(row=>['repair','growth'].includes(row.kind)));
    assert.equal(returned.kindlingReserve-prepared.kindlingReserve,repair+growth);
    assert.equal(returned.kindlingReserve-before.kindlingReserve,run.kindlingGained);
    if(trip.outcome==='death') {
      assert.equal(trip.fieldResult.hp,0);assert.equal(trip.fieldResult.ended,true);assert.equal(run.kindlingGained,0);assert.deepEqual(run.returnedIds,[]);
      for(const item of entry.inventory.items.filter(row=>row.location.kind==='carried')) {
        assert(!returned.inventory.items.some(row=>row.id===item.id));
        assert(![returned.inventory.equipment.weaponId,...returned.inventory.equipment.toolIds,...returned.inventory.equipment.defenseIds].includes(item.id));
      }
    }
    const auto=reviewed.rows[index];assert.deepEqual(pickups,auto.collectedNodes);assert.equal(repair,auto.economy.repairSpent);assert.equal(growth,auto.economy.growthSpent);
    assert.equal(world,auto.world);assert.equal(runId,summary.branches.find(row=>row.policy===branch).rows[index].runId);
    const row={ordinal:trip.ordinal,world,grade:trip.grade,outcome:trip.outcome,actualPickups:pickups.length,nonEntryPickups:nonEntry,elapsedMs:trip.fieldResult.elapsedMs,finalHp:trip.fieldResult.hp,finalChaos:trip.fieldResult.chaos,beforeReserve:before.kindlingReserve,returnedReserve:returned.kindlingReserve,preparedReserve:prepared.kindlingReserve,kindlingGained:run.kindlingGained,repairSpent:repair,growthSpent:growth,returnedItems:run.returnedIds.length,destroyedItems:run.destroyedIds.length};
    rows.push(row);totals.trips++;totals.actualPickups+=pickups.length;totals.nonEntryPickups+=nonEntry;
    for(const key of ['kindlingGained','repairSpent','growthSpent','returnedItems','destroyedItems']) totals[key]+=row[key];
    if(trip.outcome==='death')totals.deaths++;
    else {totals.extractedPickups+=pickups.length;if(nonEntry)totals.nonEntrySearchAndExtract++;else totals.emptyExtractions++;}
  }
  const last=report.realJourneyAttempts.at(-1).afterPreparation.state;
  branches.push({policy:branch,report:ref(reportFile),rows,startingReserve:rows[0].beforeReserve,endingReserve:rows.at(-1).preparedReserve,distinctWorlds:new Set(rows.map(row=>row.world)).size,actualFinalGrowth:last.growth,recurrence:reviewed.recurrence});
}
assert.equal(saveReferences.length,192);assert.equal(ids.size,48);
for(const [key,value] of Object.entries({trips:48,nonEntrySearchAndExtract:42,emptyExtractions:4,deaths:2,actualPickups:100,nonEntryPickups:100,extractedPickups:99,kindlingGained:550,repairSpent:267,growthSpent:314,returnedItems:47,destroyedItems:58}))assert.equal(totals[key],value,key);
assert.deepEqual(automatic.mandatoryDiagnosis,[]);assert.deepEqual(automatic.uncoveredToolKeys,[]);
const output=path.join(folder,'root-accounting-review.json');assert(!fs.existsSync(output));
const result={version:1,status:'bounded-actual48-accounting-pass',reviewer:'root',reviewedAt:new Date().toISOString(),audit:ref(fileURLToPath(import.meta.url)),accountingHelper:ref(path.join(ROOT,'tools/qa/r100-i09-search-receipts.mjs')),inputs:automatic.inputs.map(row=>ref(row.path)),source:ref(path.resolve(policy.sourceManifestOriginal)),checks:{exactSaveFiles:192,uniqueSettledRunIds:48,exactAdjacentSaveStates:true,oneHistoryAppendPerDeparture:true,actualPickupsReconciled:true,repairGrowthAndReturnedKindlingReconciled:true,deathCarriedItemsCleared:true},totals,branches,saveReferences,limitations:['Read-only actual accounting; source selection replay and per-key active/passive input checks additionally rely on the exact original automatic review.','No experience, balance, human, listening, performance or release approval is issued by this accounting audit.']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:ref(output),checks:result.checks,totals}));
