/** Read-only actual receipts for an explicitly separate management phase or low baseline. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]),file=path.join(root,'report.json');
const report=JSON.parse(fs.readFileSync(file,'utf8'));
const runs=report.realJourneyAttempts.filter(r=>r.status==='completed-real-input');
const final=r=>r.afterPreparation?.state??r.afterRepair?.state??r.afterReturn.state;
const records=runs.map((r,i)=>{
 const before=r.before.state,returned=r.afterReturn.state,end=final(r),earned=returned.inventory.run.kindlingGained;
 const actions=r.management?.actions;
 const repairPaid=actions?actions.filter(a=>a.kind==='repair').reduce((n,a)=>n+a.spent,0):returned.kindlingReserve-(r.afterRepair?.state.kindlingReserve??returned.kindlingReserve);
 const growthPaid=actions?actions.filter(a=>a.kind==='growth').reduce((n,a)=>n+a.cost,0):0;
 const balance=before.kindlingReserve+earned-repairPaid-growthPaid-end.kindlingReserve;
 assert.equal(balance,0,`actual fuel accounting mismatch at ${r.ordinal}`);
 assert.equal(end.cycle,before.cycle+1,`cycle not consecutive at ${r.ordinal}`);
 if(i)assert.deepEqual(before,final(runs[i-1]),`state continuity mismatch at ${r.ordinal}`);
 return {ordinal:r.ordinal,cycleBefore:before.cycle,cycleAfter:end.cycle,world:r.identity.generation.package.id,grade:r.grade,runId:returned.inventory.run.id,outcome:r.outcome,
  beforeReserve:before.kindlingReserve,earned,repairPaid,growthPaid,afterReserve:end.kindlingReserve,
  modules:before.modules.map(m=>({type:m.type,before:m.hp,afterImpact:returned.modules.find(n=>n.type===m.type).hp,afterMaintenance:end.modules.find(n=>n.type===m.type).hp})),
  growthBefore:before.growth.upgrades,growthAfter:end.growth.upgrades,growthActions:actions?.filter(a=>a.kind==='growth')??[],
  fieldHp:r.fieldResult.hp,fieldChaos:r.fieldResult.chaos,fieldMs:r.fieldResult.elapsedMs,searches:r.searches,offered:r.offered??[],
  activeToolsAtReturn:end.inventory.items.filter(i=>i.kind==='contaminant'&&i.contaminant.stage==='tool'&&i.contaminant.usesRemaining>0).map(i=>({id:i.id,remaining:i.contaminant.usesRemaining,location:i.location.kind})),
  performance:r.performance,navigationWarning:r.navigationWarning,consoleErrors:r.consoleErrors};
});
assert.equal(new Set(records.map(r=>r.runId)).size,records.length,'runIds must be unique within phase');
const first=runs[0]?.before.state,last=runs.length?final(runs.at(-1)):null;
const freeze=JSON.parse(fs.readFileSync(path.join(root,'policy-freeze.json'),'utf8'));
const sourceHash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output={generatedAt:new Date().toISOString(),source:file,sourceSha256:sourceHash,phase:freeze.kind??'Independent management continuation from actual baseline cycle7',policyFreeze:freeze,sourceStatus:report.status,
 count:records.length,failedOrPending:report.realJourneyAttempts.filter(r=>r.status!=='completed-real-input').map(r=>({ordinal:r.ordinal,status:r.status,failure:r.failure??null})),
 totals:{returned:records.reduce((n,r)=>n+r.earned,0),repairPaid:records.reduce((n,r)=>n+r.repairPaid,0),growthPaid:records.reduce((n,r)=>n+r.growthPaid,0),extracted:records.filter(r=>r.outcome==='extract').length,deaths:records.filter(r=>r.outcome==='death').length,startReserve:first?.kindlingReserve,endReserve:last?.kindlingReserve,startCycle:first?.cycle,endCycle:last?.cycle,startModules:first?.modules,endModules:last?.modules,startGrowth:first?.growth.upgrades,endGrowth:last?.growth.upgrades},
 continuityAndFuelAccounts:true,records,
 limits:['Only completed real-input records are counted; failed and pending attempts retained.','Full-map geometry and node positions aid macro routing; micro decisions use disclosed visible projections. This is not a human blind playtest.','An actual saved-state branch does not make its previous seven journeys new income and cannot be pooled into the original natural cohort.','No death in a sample cannot prove death recovery or expected value. No claim of optimal play or long-term balance follows from one phase.']};
fs.writeFileSync(path.join(root,'management-summary.json'),JSON.stringify(output,null,2));
const t=output.totals;
const lines=[`# ${freeze.kind??'独立经营阶段：实际输入账目'}`,'',`实际完成 ${records.length} 趟；来源状态 ${report.status}。自然原始组与本对照分开保留。`, '',
 `从周期 ${t.startCycle??'—'} 至 ${t.endCycle??'—'}，带回 ${t.returned}，维修支出 ${t.repairPaid}，成长支出 ${t.growthPaid}；余粮 ${t.startReserve??'—'} → ${t.endReserve??'—'}。撤离 ${t.extracted}，死亡 ${t.deaths}。`,
 `模块：${t.startModules?.map(m=>`${m.type} ${m.hp}`).join(' / ')??'—'} → ${t.endModules?.map(m=>`${m.type} ${m.hp}`).join(' / ')??'—'}。`,
 `成长终态：${JSON.stringify(t.endGrowth??{})}。`,'',
 '逐趟完整账、实际搜索/受伤/污染、供奉和帧样本在 management-summary.json。连续存档、唯一 runId、薪柴入账与实际维修/成长支出已逐笔核对。','',
 ...records.map(r=>`- 第 ${r.ordinal} 趟 ${r.world}：带回 ${r.earned}，修 ${r.repairPaid}，成长 ${r.growthPaid}，余 ${r.afterReserve}；模块 ${r.modules.map(m=>m.afterMaintenance).join('/')}；场内 HP ${r.fieldHp} / 混乱 ${r.fieldChaos.toFixed(1)}。`),'',
 '范围：宏观路线使用全图几何；这不是盲玩，也不等于人审。单存档有限样本不能证明最优经营或长期平衡；有失败就保留失败，不补抽。'];
fs.writeFileSync(path.join(root,'summary.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({count:records.length,status:report.status,totals:t,failedOrPending:output.failedOrPending},null,2));
