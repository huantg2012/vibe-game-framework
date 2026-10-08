/** Read-only bridge: preserve R1 ancestry and its fixed service targets in R2.
 * node <this> --a <R2-A report> --b <R2-B report> --output <new artifact>
 * Run the independent four-snapshot accounting audit separately as well.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=process.cwd(), args=process.argv.slice(2);
const arg=name=>{const i=args.indexOf(name);assert(i>=0&&args[i+1],`${name} required`);return path.resolve(args[i+1]);};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({path:path.relative(root,file),sha256:sha(file)});
const sum=(rows,fn)=>rows.reduce((n,r)=>n+fn(r),0);
const first=report=>report.realJourneyAttempts[0];
const last=report=>report.realJourneyAttempts.at(-1);
const target={CORE:51,STORAGE:100,PURIFIER:51};
function debt(state,targetHp=target) {
  const candidates=[null,...state.modules.map(m=>m.id)].map(bonusModule=>{
    const modules=state.modules.map(m=>{const missing=Math.max(0,targetHp[m.id]-m.hp),bonus=bonusModule===m.id?(state.repairBonusHp??0):0;
      return{id:m.id,hp:m.hp,target:targetHp[m.id],missing,kindling:missing?Math.max(1,Math.ceil((missing-bonus)/4)):0,sharedBonusAssigned:missing?bonus:0};});
    return{bonusModule,modules,kindling:sum(modules,m=>m.kindling)};
  });
  return candidates.sort((a,b)=>a.kindling-b.kindling)[0];
}
const base=path.join(root,'docs/qa/artifacts/r100-i13');
const inputs={aR1:path.join(base,'natural-maintenance/report.json'),bR1:path.join(base,'natural-prepared-recovery/report.json'),aR2:arg('--a'),bR2:arg('--b')};
const reports=Object.fromEntries(Object.entries(inputs).map(([key,file])=>[key,read(file)]));
const freezeFile=path.join(base,'r2-policy-freeze.json'),freeze=read(freezeFile);
assert.equal(sha(path.resolve(freeze.sourceManifest)),freeze.sourceManifestSha256);
for(const row of freeze.dependencies)assert.equal(sha(path.resolve(row.file)),row.sha256);
for(const row of freeze.cases)for(const [file,hash] of [[row.sourceReport,row.sourceReportSha256],[row.sourceStorage,row.sourceStorageSha256],[row.input,row.inputSha256]])assert.equal(sha(file),hash);
const branches=[];
for(const [role,expected] of [['a',6],['b',1]]) {
  const r1=reports[`${role}R1`],r2=reports[`${role}R2`];
  assert.equal(r2.realJourneyAttempts.length,expected);
  assert(r2.realJourneyAttempts.every(r=>r.status==='completed-real-input'));
  assert.deepEqual(first(r2).before.state,last(r1).afterPreparation.state,'R2 must continue the exact actual R1 terminal state');
  assert.deepEqual(Object.fromEntries(first(r1).before.state.modules.map(m=>[m.id,Math.min(100,m.hp)])),target,'Original service contract is 51/100/51');
  const summarizeRows=attempts=>attempts.map((r,index)=>{
    if(index)assert.deepEqual(r.before.state,attempts[index-1].afterPreparation.state);
    const b=r.before.state,e=r.afterPreparation.state,run=r.afterReturn.state.inventory.run;
    const actions=r.management.actions,repair=sum(actions.filter(a=>a.kind==='repair'),a=>a.spent),growth=sum(actions.filter(a=>a.kind==='growth'),a=>a.cost);
    const beforeDebt=debt(b),afterDebt=debt(e),income=run.kindlingGained;
    assert.equal(e.kindlingReserve-b.kindlingReserve,income-repair-growth);
    assert(Number.isFinite(r.timing?.preparationAndEntryWallMs)&&Number.isFinite(r.timing?.returnAndManagementWallMs),'Operator timing must be recorded, not silently replaced with zero');
    return{ordinal:r.ordinal,runId:run.id,world:r.identity.generation.package.id,grade:r.grade,outcome:r.outcome,income,repair,growth,
      reserveBefore:b.kindlingReserve,reserveAfter:e.kindlingReserve,beforeDebt,afterDebt,
      cashMaintenanceMargin:income-repair,sameOriginalServiceMargin:income-repair-(afterDebt.kindling-beforeDebt.kindling),
      modules:e.modules,extraHpAboveOriginalService:e.modules.map(m=>({id:m.id,hp:Math.max(0,m.hp-target[m.id])})),fieldMs:r.fieldResult.elapsedMs,
      recordedOperatorTiming:r.timing,growthActions:actions.filter(a=>a.kind==='growth')};
  });
  const rows=summarizeRows(r2.realJourneyAttempts),cumulativeRows=[...summarizeRows(r1.realJourneyAttempts),...rows];
  const total=rs=>({attempts:rs.length,income:sum(rs,r=>r.income),repair:sum(rs,r=>r.repair),growth:sum(rs,r=>r.growth),
    cashMaintenanceMargin:sum(rs,r=>r.cashMaintenanceMargin),sameOriginalServiceMargin:sum(rs,r=>r.sameOriginalServiceMargin),fieldMs:sum(rs,r=>r.fieldMs),
    preparationAndEntryWallMs:sum(rs,r=>r.recordedOperatorTiming?.preparationAndEntryWallMs??0),returnAndManagementWallMs:sum(rs,r=>r.recordedOperatorTiming?.returnAndManagementWallMs??0),
    outcomes:Object.fromEntries([...new Set(rs.map(r=>r.outcome))].map(outcome=>[outcome,rs.filter(r=>r.outcome===outcome).length]))});
  const capitalTarget=Object.fromEntries(first(r1).before.state.modules.map(m=>[m.id,m.hp]));
  branches.push({role:role==='a'?'maintenance':'fresh-glove-only',r1:ref(inputs[`${role}R1`]),r2:ref(inputs[`${role}R2`]),
    exactR1ToR2State:true,startingDebt:debt(first(r2).before.state),endingDebt:debt(last(r2).afterPreparation.state),
    originalR1StartingReserve:first(r1).before.state.kindlingReserve,segmentStartingReserve:first(r2).before.state.kindlingReserve,
    segmentEndingReserve:last(r2).afterPreparation.state.kindlingReserve,
    totals:total(rows),originalCapitalTarget:capitalTarget,originalCapitalDebtAtR2End:debt(last(r2).afterPreparation.state,capitalTarget),
    cumulativeR1R2:{totals:total(cumulativeRows),startingDebt:debt(first(r1).before.state),endingDebt:debt(last(r2).afterPreparation.state),
      reserveChange:last(r2).afterPreparation.state.kindlingReserve-first(r1).before.state.kindlingReserve,
      byGrade:Object.fromEntries([...new Set(cumulativeRows.map(r=>r.grade))].map(grade=>[grade,total(cumulativeRows.filter(r=>r.grade===grade))]))},rows});
}
const id='CAT_93e4d1e1-1ef4-4140-b7e9-148143ff7a7c_r100-contaminant-contested-1';
const b1=reports.bR1.realJourneyAttempts, obtained=b1.find(r=>r.afterReturn.state.inventory.run.returnedIds.includes(id));
const offered=b1.find(r=>r.offered.includes(id));
const mature=b1.find(r=>(r.afterReturn.state.inventory.offeringReceipts?.[`impact:${r.afterReturn.state.inventory.run.id}`]??[]).some(x=>x.itemId===id));
assert(obtained&&offered&&mature);assert.deepEqual([obtained.ordinal,offered.ordinal,mature.ordinal],[1,3,4]);
assert(!obtained.before.state.inventory.items.some(i=>i.id===id));
const item=obtained.afterReturn.state.inventory.items.find(i=>i.id===id);
assert.equal(item.source.runId,obtained.afterReturn.state.inventory.run.id);assert.equal(item.contaminant.stage,'defense');
assert.equal(offered.afterPreparation.state.inventory.items.find(i=>i.id===id).location.kind,'defense');
const matured=mature.afterReturn.state.inventory.items.find(i=>i.id===id);
assert.equal(matured.contaminant.catalog.identification,'revealed');assert.equal(matured.contaminant.catalog.definitionId,'gray_felt_glove');
const r2=first(reports.bR2),entry=r2.entrySave.state.inventory.items.find(i=>i.id===id),returned=r2.afterReturn.state.inventory.items.find(i=>i.id===id);
assert(entry);assert.equal(entry.contaminant.catalog.definitionId,'gray_felt_glove');assert.deepEqual(entry.source,item.source);
assert(r2.entrySave.state.inventory.equipment.toolIds.includes(id));
const actions=Object.entries(r2.afterReturn.state.inventory.run.actionReceipts).filter(([,r])=>r.itemId===id);
assert(actions.length>0,'The actual newly acquired glove must be used; ownership alone is insufficient');
assert.equal(entry.contaminant.usesRemaining-actions.length,returned?.contaminant.usesRemaining??0);
const chain={id,definitionId:'gray_felt_glove',source:item.source,obtained:{report:ref(inputs.bR1),ordinal:1,runId:obtained.afterReturn.state.inventory.run.id},
  offered:{ordinal:3,runId:offered.afterReturn.state.inventory.run.id},matured:{ordinal:4,runId:mature.afterReturn.state.inventory.run.id,uses:matured.contaminant.usesRemaining},
  equippedAndConsumed:{report:ref(inputs.bR2),ordinal:r2.ordinal,runId:r2.afterReturn.state.inventory.run.id,entryUses:entry.contaminant.usesRemaining,
    returnedUses:returned?.contaminant.usesRemaining??0,actions},
  status:'same-item-natural-acquisition-offering-maturity-equip-consumption-chain-verified',effectSemantics:'Separate actual window review required; charge receipts alone do not establish useful silence.'};
const output=arg('--output');assert(!fs.existsSync(output));
const result={version:1,recordedDate:'2026-10-08',status:'bounded-cross-report-accounting-pass',tool:ref(fileURLToPath(import.meta.url)),freeze:ref(freezeFile),sourceAndEightDependenciesMatched:true,originalFixedServiceTarget:target,
  branches,freshChain:chain,limitations:['R2 standalone audit uses segment-initial local HP for its diagnostic debt; this bridge is authoritative for original 51/100/51 comparisons.',
  'B begins with 26 kindling of pre-existing service debt; it is not reset to zero or described as healthy.',
  'The glove is newly acquired within R1, not an old earned ancestor item merely because it enters R2 already mature.',
  'This one supply chain is not recovery of the original compass/dash pair and does not establish sustainable full-loadout or weapon supply.',
  'R1 and R2 different policies, worlds, tides, equipment and timing preclude a single-cause estimate or general long-term balance claim.']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:ref(output),status:result.status,branches:branches.map(({role,startingDebt,endingDebt,totals})=>({role,startingDebt:startingDebt.kindling,endingDebt:endingDebt.kindling,totals})),freshGloveUses:actions.length}));
