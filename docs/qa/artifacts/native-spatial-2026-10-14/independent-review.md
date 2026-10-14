# 原生空间测量：独立实现审查

日期：2026-10-14。Feature：F011 / F013 / F007。

本阶段依据已批准的[设计合同](../../../design-notes/world-fragment-native-generation-2026-10-13.md)，只读核对七个 `native-spatial-*` 模块和五份作者 CSV，并运行独立的小型物理反例。基线为 `4cbfaf48693043bcfdde00c4c332637a462e12d8` 的实施中工作树；测试文件和被测源码 SHA-256、前后稳定性保存在[首轮结果](independent-measure-initial.json)。本次为知情 QA，不是盲测。

## 已复现的问题

**NS-QA-01 / P2 / 确定偏差：G4 区域摘要把同一物件的后续经过重复记到其他区域。**

- 位置：`src/generation/world-study/native-spatial-routes.ts:85`，区域摘要重新遍历未平滑的身体图边中点检测相遇；正式路线记录则在第 77–78 行使用平滑后的完整路线，并按首次相遇去重。
- 批准依据：G4 要求把相遇事件归入首次发生区域，再按 `区域ID＋结构组ID` 去重；公共主干不能重复投票。
- 独立反例：800×640 真实物理地面，一处 304×96 内孔，起点 (100,100)。13 条完整路线全部在起点首次遇见该孔，事件记录均归区域 0；摘要却将它列入区域 **0、1、2、4、5、6**。13 条路线均发生路径平滑缩短。
- 后果：区域孔占比和区域样本是否足量会被不存在的“首次遇见”改变，进而误导布局校准。当前区域摘要只用于校准，本缺陷不等于已证明整条生产路线被错误准入。
- 最小修正：区域摘要消费与正式完整路线相同的首次相遇事件，再进行公共路线/区域身份去重；不能通过注明“两套统计”保留与批准合同相悖的含义。
- 状态：**已修复并同例复验通过**。Code 将区域摘要改为消费完整平滑路线的首次事件，以原身体图边标识公共主干，再按原事件区域去重。[修复复验](independent-measure-nsqa01-fixed.json)与[恢复工作后的独立复验](independent-measure-resume.json)均为 3/3；13 条路线的首次区域与区域摘要都只有区域 0。保留首轮失败证据，不追改为通过。

## 有限通过与已排除的疑点

独立工具 [check-qa-measure.mjs](../../../../tools/native-spatial/check-qa-measure.mjs) 首轮 **2 通过、1 失败**，运行期间所列源码哈希稳定。

- 两个独立实体之间有 24px 真实缝时，完整 20px 身体从 (252,120) 连续扫掠到 (252,360)，通过比例为 1；实体计数为 2。最初静态阅读的保守栅格合组疑点在测试前已被实现方改为真实足迹判定，因此本报告不声称复现了修复前失败。
- 同一冻结母体的两处分离足迹仍计为 1 个实体，报告 2 个物理分量，没有将合理的分离足部误拆成多个对象。
- G1 使用全支持域最坏距离并包含 8px 单元角误差；G2 源码明确检查有限 q/t、v/t 视距、单孔 LOS 消融和 q 集覆盖。这里是源码核查，不替代运行穷举。既有 root 七例与 facts 六例不作为本代理重新执行的结果，分别由它们自己的报告承载。

复现命令：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx \
  tools/native-spatial/check-qa-measure.mjs \
  docs/qa/artifacts/native-spatial-2026-10-14/independent-measure-NEW.json
```

## 覆盖限制

本阶段没有修改生产源码、CSV、主状态或提交代码。仅新增所属独立测试及本报告。layout/完整生成接入仍在实施，本次不把未完成部分列为缺陷。

未运行完整生产生成、旧档重放、实际敌人行为、正常镜头或性能测试；按协调者要求，本阶段不对实施中的半成品运行全构建。数量/空白/通路约束的共同可行性、预算与正式接入仍待后续全链验收；静态检查和小夹具通过不能提升为潜行体验、美术或用户终验通过。

## 第二阶段：冻结配方与公共边界

2026-10-14 恢复工作后，以当前实施中工作树继续核查 F011 / F013 / F007 及恢复边界。新增 [check-qa-recipes.mjs](../../../../tools/native-spatial/check-qa-recipes.mjs)，[结果与前后稳定源码哈希](independent-recipes-initial.json)记录 **3/3 组检查通过**：

- **324 份配方逐一核查。** 108 世界 × 低/中/重三档，自身 `validR100ProductionRecipe` 与公共 `validWorldProductionRecipe` 全部接受。已登记五图的 15 份使用 r12，其余 309 份使用 r11；r12 不携带旧 `spatialPolicy` / `augmentationPolicy`，世界身份与 `nativeSpatial.world.worldId` 一致。这里只验证工厂与配方，不是 324 张实际地图通过。
- **18 类破坏输入 fail closed。** 缺失 nativeSpatial、旧字段混入、世界不匹配、缺 policy/deployment、改孔尺寸或目标面积、错误/重复母体、额外策略字段、NaN/Infinity、伪装成 r11、未知 revision，均被自身及公共校验拒绝；公共 `createR100ProductionMap` 和 Worker 所用 `executeRiftGeneration` 也在生成前拒绝。没有以坏 r12 输入返回 r11 的情况。
- **今日作者数据与既有冻结配方隔离。** 在测试进程内更改当前 policy 间距和凝胶母体源 ID，已经创建的配方 JSON 不变并继续通过校验；新建该 reviewed 世界配方明确抛出 `Invalid reviewed native spatial intent`，没有降回 r11。测试在 `finally` 恢复模块内数据，没有改 CSV / generated 文件。

静态调用核查：r12 地图执行器无调用 r11 的异常兜底；r11 仅按包修订显式 dispatch。公共 surface bake 显式拒绝未知修订并将 r11 导向封存闭包；r12 走当前表面和翻找烘焙。r12 hydration 保留 8px 支撑/32px Host 尺度检查，重建 sight 时仍仅 VOID 为 opaque，并要求翻找来源覆盖所有已部署节点。Worker executor 在 departure/recovery 分流前验证 recipe，恢复后再比较 identity。以上静态证据不等于 r12 成图后完整结构化传输或成功重放。

G1/G2/G3/G4 补充源码核查没有发现新的确定偏差：G2 单孔消融只改 LOS、不改身体图，两段参照视距均受 224px 限制，覆盖集只含 q；每个有效孔都需见证。G4 的完整路线选合法 48px 操作站位，分腿平滑后按完整行程去重结构，横向开口使用真实 VOID/solid，未知转弯不重置窄段。NS-QA-01 三个独立物理反例本阶段重新运行，3/3 通过；其他代理已有反例未冒称本代理重跑。

**本阶段没有新增确定 Bug。** 成功 r12 地图、成功 r12 保存/重放、真实 Worker postMessage/transfer、完整表面烘焙、60 秒预算、实际敌人行为、浏览器和审美仍未由本报告验证。现有历史 r11 恢复另由其原报告负责。本次按协调者的分阶段范围未跑全构建；最终 build/typecheck 由主任务在实现稳定后执行。

复现命令：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx \
  tools/native-spatial/check-qa-recipes.mjs \
  docs/qa/artifacts/native-spatial-2026-10-14/independent-recipes-NEW.json
```

## 第三阶段：policy v2 的 B 与 core/shoulder 冻结边界

依据设计合同 §9.5–9.6，针对新增岸湾 B 和 core/shoulder 11 个字段做独立复验。[新结果](independent-recipes-v2.json)为 **7/7 组通过**，前后源码及六份 CSV 哈希稳定；v1 结果保持原文件不覆盖。

- 324 份当前配方再次通过，仍为 15 份 r12 与 309 份 r11。六份 CSV 共同来源 hash 与冻结 policy v2 一致。
- 原 18 类破坏输入仍拒绝；新增 **25 类 schema 反例**在独立 runtime validator、公共 recipe validator、公共 map 和 Worker executor 入口全部拒绝。覆盖全部 3 个 B world 字段及 11 个 core/shoulder 字段的缺失，独立 bayProfiles 缺失、旧 policy 版本、未知/重复 profile、非法湾数量域、倒置尺寸、非有限 throat、角色总数越限、搭接不足、外伸与肩片跨度不相容、未知附着语法。
- 另外 **4 类仍在合法 schema 范围内的改动**（湾深、湾数量选项、core 数量、shoulder 外伸）均单独通过 runtime schema 校验，但公共配方/生成入口因冻结完整性回执不匹配而拒绝；这证明检查不只依赖“改到非法范围”。
- 进程内修改当前 B/core/shoulder 作者值后，旧冻结配方仍不变且有效，新出发配方消费新值并产生不同 dependencyHash；再将新湾数量域破坏为 `[3]` 时新 factory 明确拒绝，旧配方仍有效。所有内存作者值在 `finally` 恢复，恢复后 factory 输出与原 JSON 完全相同。

本阶段没有新增确定 Bug，没有修改生产源码或 CSV，没有运行正式整图、留出种子、成功重放或全构建。上述结论限于 policy v2 配方/schema/坏输入的生成前边界，不能代替 B 几何身份、core/shoulder 实际构型、地图准入或体验验收。
