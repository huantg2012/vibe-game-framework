# QA Report：历史 c27 的 G2 独立诊断

日期：2026-10-14。执行时刻：05:42:24–05:42:25 UTC。依据：`docs/specs/system-map-generation.md` 与 `docs/design-notes/world-fragment-native-generation-2026-10-13.md` 的 G2 合同。

**这份历史实际几何通过正式 G2，但仍被 G3 拒绝。没有生产准入、完整部署或 G4 通过结论。**

## 来源与执行边界

- 完整保存输入来自 [`wide-bias-replay/candidate-27.json`](../wide-bias-replay/candidate-27.json)，包含 definition、assemblies、11 H / 5 S、holes / bays / landJoins / plan 及冻结 policy。
- 历史对照为第四次 fresh 的 [`production-gel-core-shoulder-round1.json`](../production-gel-core-shoulder-round1.json)，请求 gel-rafts / medium / 20261012，第一个 geometry attempt 的 c27。
- 仅真实重编保存 definition **1 次**；直接调用官方 `nativeSpatialGeometryFingerprint`，hash 精确为 **`1100442b556caf23`**。完整实际 G1/G3 返回值也与上述历史收据逐字段相同。
- 然后直接调用官方 `evaluateNativeSpatialVisibility` **1 次**，没有调用布局采样器，没有复跑 fresh、挑另一个候选或重新落位内容。补充的最短路读取仅用于输出最差覆盖路径，不重新运行 G2。
- 测试工具：[`diagnose-historical-c27-g2.mjs`](../../../../../tools/native-spatial/diagnose-historical-c27-g2.mjs)。完整数据与源指纹见 [`report.json`](report.json)。历史文件未修改。

## G2 结果

冻结标准保持：32px q / v 采样、224px 参考视距、q→v 真实身体路径 80–240px、所有身体中心至有效 q 集合的真实最短路不超过 320px。只对单个 H 的遮视做归因消融，B 及其余遮挡保留；身体路径使用原图。

1,196 个可达 q 采样点中，逐 H 共找到 511 条见证；去重后的合格 q 为 **492 个**。每个实际 H 都有见证：

- `H-12148`：44 条。
- `H-12313`：51 条。
- `H-12526`：58 条。
- `H-20638`：53 条。
- `H-27011`：40 条。
- `H-30701`：54 条。
- `H-33785`：37 条。
- `H-43389`：49 条。
- `H-51675`：20 条。
- `H-8809`：53 条。
- `H-9026`：52 条。

完整 q / v / t、路线与 sight 距离、逐孔候选失败原因均保存在 JSON。不同孔可共享 q；见证总数不能当作独立 q 数量。v / t 不因作为见证而加入覆盖集合。

覆盖测量检查了全部 **18,632 个**合法身体中心：

- 最坏路程 **272.570px**；320px 门剩余 **47.430px**，覆盖缺口为 **0px**。
- 最差身体中心：cell 41328，世界坐标 **(1156, 1148)**。
- 最近有效 q：cell 42800，坐标 **(1412, 1188)**，归因孔为 `H-43389`。真实路径共 33 个身体格点，完整坐标保留在 JSON。
- 超过 320px 的身体中心 **0**；无法到达有效 q 的身体中心 **0**。
- 17,383 个中心位于 0–160px；1,249 个位于 160–320px。

正式 G2 返回 `accepted: true`、空拒因列表。此有限诊断没有发现该 c27 的孔见证或覆盖缺口；不由此推断其它候选、其它世界或连续空间中任意方向都安全。

## 仍然保留的拒绝

该几何仍不具备生产资格：宽地核比例 **0.5405753542292829 < 0.55**，正式 G3 拒因为 `G3-wide-domain-area`。55% 门未修改。

其它对应实际量保持：最大空白上界 157.97231636677054px、深区跨度 336px、最大宽域连通比例 0.9901707704527403。此报告没有绕过 G3 启动正式部署，也没有将 G2 单门结果写成生产成功。

## 成本和稳定性

- 一次实际几何编译：179.849ms。
- 结构识别与实际 G1/G3 复核：241.305ms。
- 一次正式 G2：142.505ms。
- 补充覆盖路径读取：4.848ms。
- 此次工具内总耗时：618.031ms；这不是完整生成性能承诺。

源码冻结后执行。通过 AST 递归收集 import / export / dynamic import / type import 依赖；正式 fingerprint 直接 import，因此 generation、layout、joint 也包含在绑定内。**192 个源依赖**，连同保存输入、第四次 fresh 收据、工具、配置和 package 锁文件，共 **199 个文件**在执行前后 SHA-256 完全一致，`sourcesStable: true`。未使用复制或提取后的替代 fingerprint 实现。

本次仅为经授权的单候选诊断，未重复全项目构建或其它事务测试；没有执行 G4、敌人/拾取部署、撤离及探索路线验收、其它种子或留出集。G4 的共同可行性仍待完整内容落位证据，不能从本报告补认。
