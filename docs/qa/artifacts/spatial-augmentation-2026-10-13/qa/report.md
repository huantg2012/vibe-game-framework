# QA Report: solid + VOID 联合空间增补的独立算法契约

日期：2026-10-13。Feature IDs：COH-F007、COH-F011、COH-F013；关联 F006/F012/F015/F044/F052。

基线 HEAD：`99998703743895da7486fdee552f7bed019e64b8` 加并行工作树。执行环境：macOS、Node v22.14.0、仓库 tsx alias 配置。规格依据为 `docs/design-notes/stealth-obstacle-distribution-2026-10-13.md` 与 `docs/specs/system-map-generation.md` 的联合增补合同；本报告不沿用上一轮“不得新增孔”的限制。

本 Agent 只改独立检查脚本与本目录证据，没有改生产源码、CSV 或规格。公共 game-state 证据登记由 Director 统一维护。

## 当前结论

独立小场景契约的 **25/25 通过记录保留**，之后见证 locality 补丁的受影响小场景 **6/6 通过**；轻量基底提取对已有三张 r10 地图的 **3/3 对照通过**。这是有限几何、评分、候选生成与纯函数选择验证；不等于整个设计条款、全库新局、玩家实玩或真实敌人潜行已通过。

- [最终独立契约结果](independent-final.json)：保存执行开始/结束的生产源 hash，确认执行期间源未改变。
- [见证 locality 修复结果](local-reveal-attempt1.json)：补丁后仅复验受影响的 6 条，源码开始/结束 hash 相同。未重复原 25 条、正式 20 例或旧 r10；未受影响的 seed、候选生成、测量模块与原证据 hash 相同。
- [轻量基底提取结果](baseline-extraction-attempt2.json)：复用已有地图，只生成轻地形，不重跑完整生产或烤图。
- [此前 r10 基线](r10-current/baseline.json) 与 [早期 r10 引用](earlier-r10-references.json)：本阶段保留，旧版本完整恢复由 revision Code 负责，未重复执行。

## 已证实的行为

**双轴没有混算。** 开阔 fixture 加入真实 solid 后，结构缺口均值从 0.23768 降至 0.09762，遮视缺口仍为 1。真实三角内部阻挡 20px 身体，而穿过它的共享 DDA 射线仍通。相同形体改 relief 后两轴保持原值，不能借视觉形体刷结构收益。

**选择器实际使用两类机制。** 默认大开阔 fixture 真正选中 `combined`；另一个默认小开阔 fixture 真正选中 `void`。关闭 VOID 预算的大开阔 fixture 真正选中 `solid`，结构缺口 0.60602→0.52580、遮视仍为 1，状态为 `budget-exhausted`。这些结论来自实际选中计划；三类各有可构造候选的正控另记，不用“枚举到”代替“选中”。

**固定分母与损失计账有效。** 将一个原坏点及其 16 个端点仅从可达集合移除，F/O 原值完全保留。真实新增孔删除 42 个原探针，每个缺失点仍保留其原结构/遮视成本，固定探针数未缩小，并独立记录地面及身体站位损失。

**窄桥不能只靠身体可达率通过。** 独立 32px 桥 fixture 中，20px 身体可达率仍为 100%，原地面损失 6.36%、宽核保留 81.48%；候选仍被 `fixed-anchor-lost` 与 `largest-open-core-loss` 拒绝。没有相应基底核时比例为 `null`，不伪记 100%。

**原内容与重复守卫有效。** 修改原实例被拒绝；切去非地皮原 relief 真实足迹下的地面被拒绝。异地同归一形体 clone 被拒绝。solid、VOID、combined 的第三个等距共线新增群均被拒绝；原作者对象恰好排列成行不误触“新增群”规则。此处直接候选生成测试的 prior-group 元数据 fixture 只隔离重复规则，不冒充已部署地图。

**真实 VOID 揭露见证受范围限制。** 独立例子的初始距离为 208px，揭露后距离为 222.28px，完整身体路径为 84.35px，逐段以正式 20px sweep 验证。初始 DDA 被真实 VOID 阻断、终点 DDA 可通，终点不超过 224px。已经存在于前态的同一孔不能提供本轮“新增揭露”见证。这只证明几何观察点，不涉及敌人朝向、听觉、警觉积累或追击。

**locality 补丁后，远处见证不能用于局部候选。** 独立负例使用真实 fragment 整图重编：候选热点附近的 solid 提供 75.36% 局部结构改善，远处新增 VOID 提供全图遮视改善；所有其他几何/评分门均通过，但可找到的远处见证 observer 距 hotspot 为 1110.82px。`evaluateSpatialCandidate` 必传半径 224px 的 local focus 后，候选仅以 `no-void-reveal-witness` 拒绝。相同查询放到孔附近的 focus 有正例；真正局部 combined 候选仍能评估为合法，其 observer 恰在 hotspot 的 224px 边界，初始距离 208px、揭露距离 222.28px、完整身体路线 84.35px。单独 helper 可无 focus 做诊断，但生产候选评价必须带 focus。本闸的局部条件指 observer 处于热点圈内，不宣称整条路线都在圈内。

**停止、确定性和纯函数回滚有效。** 禁用、无测得缺口、无可行改善、部分改善后预算耗尽分别保持其状态与残余；缺口仍存在时没有冒称目标达成。两轴同时欠缺时，18 个候选预算中各获 12/6 次评估，优先轴失败不吞掉另一轴。非法/非整数/非有限预算被拒。失败候选/异常之后再次评估结果相同，输入与基底缓存 hash 不变。一次选择的后备计划精确等于之前的完整几何与 fragment 输入。

按 Director 最终裁定，既有外层 geometry attempt 可以重新测量，不要求不同 attempt 的地图相等。候选 RNG 的纯派生函数已测试 worldId、requestedSeed、policy source hash、effective geometry seed 的输入分离，同身份/同 attempt 的候选序列与最终小场景选择重复一致。mesh 的实际几何 seed 未被候选 RNG 替代。

**轻地形提取未改变三个已存基底。** split-rib-causeway、gel-rafts、sloughed-court 各比较 64,512 个 8px cell；物理 tile、matter、完整身体支持及所有 mesh positions/indices 均为零差异。使用各旧地图真实 effective seed；Gel 为 3991160799，其余两张为 20261012。没有把 requested seed 误当成实际部署 seed。

## 本轮抓到并已修复的问题

1. **确定 Bug / High：新投影预估将 `role` 传入严格 native volume schema。** 结果是所有 solid/combined 分支被 catch 成“不合法候选”，只剩 VOID。`independent-attempt3.json` 保留稳定源下 3 条正控失败；剥离 `role` 后 `independent-attempt4.json` 为 24/24，最终新增 seed/范围检查后为 25/25。三类构造正控持续捕捉此类被 catch 隐去的程序错误。
2. **见证范围偏差：旧实现允许最终 clear-ray 点超出参考视距。** 旧小例子得到约 260px 的揭露距离。Director 明确终点必须在 224px 内后，生产查询已加范围门；最终独立见证为 222.28px。
3. **首审合同缺口已修补并复验：** 宽核 anchor 原来只检查身体存活、零核比例伪记 1、relief 支撑缺保护、重复守卫误用所有原 solid 且遗漏 VOID、优先轴失败提前停止。最终相关负控与正控均通过。groundEdge owner 地皮按 Director 明确裁定使用相对地面/宽核/连通门；不把这个例外外推给独有原 relief。
4. **确定偏差 / High：全图扫描借到远处的 fragment 重编见证。** 首轮报告保留的 locality 缺口之后由 Code 在正式 sloughed 样本中证实；独立 QA 没有重跑该正式图，而以 1110.82px 远处见证的小反例验证修复。当前 evaluator 强制 local focus，初始/最终视距、80–720px 路径与前态新见证条件保持，`local-reveal-attempt1.json` 的 6 条均通过。

`independent-attempt1.json` 的失败是 QA 合成 fragment 写成 worldScale 1 的 fixture 错误；`baseline-extraction.json` 的失败是 QA 错读旧 map 不含的 matter 字段。两者不是生产 Bug，后续各修正一次并保留原失败记录。

## 仍未覆盖或未满足的条目

- 见证 locality 缺口已在后续专项修复验证中关闭；正式 20 例因补丁产生的候选选择变化与完整内容准入，由 Code 的同配方回放另行登记。本报告不推定其结果。
- trace 尚不提供“新增细颈数量、窄区行程比例、共同可达子集对照”这些补充报告项。宽核连通与面积门已经验证，不能替代未实现的报告指标。
- 本 Agent 验证纯几何候选失败不污染及几何后备计划完整；**未强制注入真实 Host/资源/操作站位部署失败**。完整 controller 事务由 revision Code 的受控失败测试负责，真实完整内容由其五图生产/重放负责，需在整体验收中分别引用。
- 不覆盖全库 108 图 / 324 档 / 任意 seed，不保证每张图有增补或达到两轴目标；不覆盖实际敌人 AI、自然搜撤、正常镜头美术、FPS/加载预算或浏览器兼容性。
- 本阶段没有重复执行主线程统一构建，也没有把 Code 的 tsc 结果改称本 Agent 的独立 build。原 r10 精确恢复和正式五图全生成均归其他已分配验证。

## 复验入口与证据预算

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-augmentation/check-independent-contracts.mjs NEW_REPORT.json
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/spatial-augmentation/check-independent-baseline-extraction.mjs NEW_EXTRACTION_REPORT.json
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-augmentation/check-independent-local-reveal.mjs NEW_LOCAL_REVEAL_REPORT.json
```

脚本拒绝覆盖已有证据。小 fixture 不烤 1px 材质，不存 map.v8、surfaces 或图集；本目录收口前约 380 KiB，包括前期三份冻结 recipe、hash 和历史反例 JSON。必要生产缓存仍复用既有路径，没有新增大二进制副本。
