import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=path.resolve(process.env.QA_MATRIX_OUT??'docs/qa/artifacts/r100-i03/prepared-heavy-visible-pollution');const freeze=JSON.parse(fs.readFileSync(path.join(out,'policy-freeze.json'),'utf8'));
const cases=[];
for(const spec of freeze.cases){const r=JSON.parse(fs.readFileSync(path.join(out,spec.name,'report.json'),'utf8')),run=r.realJourneyAttempts[0];
 const lines=fs.readFileSync(path.join(out,spec.name,'severe','journey.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
 const uses=lines.filter(x=>x.event==='known-tool-context-input');const totals={};for(const u of uses)totals[u.item.name]=(totals[u.item.name]??0)+u.used;
 const exits=lines.filter(x=>x.event==='return-with-reserve'||x.event==='abandoned-observed-approach');
 assert.equal(run.identity.generation.package.grade,'severe');assert.equal(run.identity.generation.requestedSeed,spec.seed);
 cases.push({...spec,actualSeed:run.identity.seed,status:run.status,earned:run.afterReturn.state.inventory.run.kindlingGained,outcome:run.outcome,hp:run.fieldResult.hp,chaos:run.fieldResult.chaos,fieldMs:run.fieldResult.elapsedMs,
 searches:run.searches,successful:run.searches.filter(s=>s.collected).length,successfulDeep:run.searches.filter(s=>s.collected&&s.tier==='deep').length,
 toolUses:totals,toolInputs:uses,exitDecisions:exits,consoleErrors:run.consoleErrors,navigationWarning:run.navigationWarning,performance:run.performance,
 policyWindows:lines.filter(x=>x.event==='observed-back-facing-window').length,visiblePollutionObservations:lines.filter(x=>x.event==='visible-encounter-observation'&&x.visiblePollutionCells?.length).length});
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({status:'complete-four-precommitted-attempts-not-risk-reward-approved',scope:freeze.method,counts:4,cases,conclusion:'All4 actual returns, no deep pile collected. These cautious75-chaos/95-reserve policies do not establish the reward of prepared severe exploration; they also do not establish its impossibility. No new game balance claims. Contents concealed before search; kind/tier in receipts are diagnostic after-fact labels, not target-selection inputs.'},null,2));
const text=['# 重污染准备复测：固定4趟','', '两种普通成熟双工具 × ash-strata 两个预先固定种子，各一次。沿已冻结可见污染绕路和短距离背身接近策略，没有补抽、改地图、改时钟或场内资源注入。此组与自然90、低档30、独立经营12分开。','',
 ...cases.map(c=>`- ${c.build} / ${c.seed}：${c.outcome}，带回 ${c.earned} 薪柴；HP ${c.hp}，混乱 ${c.chaos.toFixed(1)}，场内 ${(c.fieldMs/1000).toFixed(1)}秒；搜完 ${c.successful} 处，深处 ${c.successfulDeep}；真实工具消耗 ${JSON.stringify(c.toolUses)}。`),'',
 '四案均未取到深处堆，不能据此宣布重污染高回报成立。A与B分别在两个种子带回5/3和1/3；加入可见污染绕行并不自动提高这套有限策略的收入。普通成熟工具均在准备时作为受控fixture建立，第一趟无冲击伤害，禁止用此组算自然经营净利润。','',
 '关键限制：脚本沿75混乱/40HP保守回撤，并按估计归途预留95出场；机制100和150不是强制撤离线。因此这里没有测试充分准备玩家承受更高混乱惩罚继续深入的空间，不是玩家能力上限。按当前观察做有限战斗、声诱、压制也不能等同熟练人类的时机选择。','',
 '翻找前内容是隐藏的：视觉与HUD不提供薪柴/污染物类别或数额，只有来源提示。脚本以位置/可见风险选择，未按隐藏kind、tier、value预选产出。事后只拿到污染物或小份薪柴是样本的搜取风险，不能反推玩家本应事先知道哪堆有薪柴。','',
 '专业判断：下一步应围绕一次真实“工具改变接近机会→搜完深处→承受可理解代价→带回”的有限观察，而不是用入口撤离充通过项，或因这个保守脚本低收入就增加地图薪柴。已有旧A8个案只证明一次可带回深收益；本4案没有扩大该结论。原始输入、工具前后余次、截图、返回存档、性能均保留。',''];
fs.writeFileSync(path.join(out,'summary.md'),text.join('\n'));console.log(cases.map(c=>({name:c.name,earned:c.earned,toolUses:c.toolUses,hp:c.hp,chaos:c.chaos})));
