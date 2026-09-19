# I28 数据与供奉机制证据

- 自然序列：固定种子 2026092000–2026092029，30 张正式默认地图，每图轮换一个真实污染节点。全部结果保留。
- 核心 19、弱效 8、无能力 3。这是 30 次诊断结果，不能当理论概率或玩家选择统计。
- 每条使用真实 plan → install → revealBatch → extract → slotOffering → 逐轮防御计算与 finishOfferingImpact → 持久数据重载；完整 node、壳、品质、反应、身份、供奉轮次和去向见 JSON。
- 卓越＋无能力＋沉默反应定向例：种子 2026092056；单独 JSON，不混入自然 30 条。
- 没有模拟真实行走、战斗或耗时；generationCpuMs 仅本机地图生成计算时间。没有读取用户存档。
- 重跑：`TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/contaminant-catalog/record-natural-identification.ts`。
