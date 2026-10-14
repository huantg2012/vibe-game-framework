# QA Report: G1 独立 8px 精评采样场

日期：2026-10-14。Feature：COH-F011，关联 F007 / F013。证据类型：QA 静态接线审查；另读取 Code 执行的既有合成及唯一固定对照收据。本 QA 未运行测试、构建、几何、采样或浏览器，未改 src / data / tools。

基准：[G1 足迹来源审计](g1-footprint-source-audit.md)与本批 Task Brief：保持 16px D_i、锚点、粗排、deep、wide 和 mean；只用独立 8px 场精评完整 tuple 的 G1 最大距离，合并去重实际 assessment 点且不因 raw 岸距丢弃；规划限值仍 152px，候选/预算/正式门不变。没有将本修复扩大为统一实际 H 足迹或重新设计生成算法。

## 结论

本次限定静态审查未发现新增接线偏差。缺失相位导致误判的前置原因已由全 raw H＋S 定点证据成立；两个精评分支都已使用新场。**采样修复成立不等于地图准入：唯一固定 c27 对照仍因 G1 最大空白超限而拒绝。**

## 来源版本

`4cbfaf48693043bcfdde00c4c332637a462e12d8` 上未提交、Code 通知冻结的工作树。相关 SHA-256 与 `g1-field-logic-round1.json` 的来源记录一致：

- `native-spatial-g1-field.ts`：`0f07263b5c5d6ea8ef88102082afaa9f16e9bd494c579fccf6c5b29b1e896ee9`
- `native-spatial-layout.ts`：`f97b4f60ca428c0f494b4dd5b8167be38ccde0ac5cfcc7b131fa6db16650dc5d`
- `native-spatial-initial-placement.ts`：`d3696582e5569ac3c64eef4405c4e655697b7ef48d138eeff32feeaa39f11e78`
- `native-spatial-joint-refinement.ts`：`8d4e7d8c558f74a072908f70bafacd7e0557382dd79aaf9778b57deb04a24225`
- `native-spatial-generation.ts`：`2d0b629c10c6f9f90a09fb985b020bebc839d6a0ef9ce61ef29f34f12465409a`
- `native-spatial-measure.ts`：`645fb86bba2e2fb951a9e101d219886f9851752cccda88b9e540b29d0f26b0c3`
- `check-g1-field.mjs`：`4e75c94ee9439a342dc746a8270a370157661388e2d558f40e0a6eb07f660eca`

## 检查事实

- **原因前置成立。** [Code 四组逻辑收据](g1-field-logic-round1.json)对保存坏 c28 的 p=(948,524) 查询全部 raw H＋S，最近 H0=155.463822158px，最近 S=156.806317396px；两者均超过规划 152px。旧 16px 格所选相位 (948,516) 的全结构距离仅147.488982639px。查询 adapter `layout.ts:77–80` 复用原 `planningObject` / `meshPrimitives`，没有只取 H 或单独重写 S 投影。该收据没有新地图编译。
- **细场不变成候选站位。** `g1-field.ts:25–39` 枚举 8px 中心，保留原 raw L−B 岸距12px过滤。`layout.ts:278–279` 独立持有 g1Field 和 baseField；`315` 的 D_i / 锚点仍传 baseField。`siteFor:157–185` 的候选流及粗排仍读原 field。
- **实际岸边见证不会被 raw 支撑过滤。** `g1-field.ts:33–38` 在网格构造之后直接追加 assessment 点，并按精确坐标与网格和历史见证一起去重；`margin<12` 只作为诊断计数，不是拒绝条件。
- **completePlanningScore 已接。** `layout.ts:134–142` 在全部对象完整平移之后，用 g1Field.maximum 查询整个 P 的并集树，仅替换 coverExcess 的 maximum。fresh 完整状态通过 `315`，single 前后及 joint 通过 `331–348` 共用此入口。
- **siteFor 精评已接。** `layout.ts:154,196–197` 先缓存细场到所有其他完整对象的距离；每个合法候选再与当前完整对象的真实 blocking 距离取最小，得到完整 H＋S 状态的最大距。`177` 仅精评收到 fineMaximum；粗排仍用既有粗最大值。没有把单物件距冒充整图最近距。
- **新细场不污染面积、拓扑或 mean。** completeScore 的 distances / mean 仍从原 field 计算；wide 只对 `index<areaPointCount` 计数，调用方仍传 baseField.length。deepSpan 按原 baseField 建图，只读取对应前缀索引。siteFor 的均值、wide、deep 同样没有读 g1Field.points。原有 assessmentPoints 对 field / mean / 粗排的既有行为保持；本轮新增的 8px 点没有进入这些统计。
- **截止接线完整。** 细场构造、距离缓存及每次 maximum 在第0次及每1024次查询检查共享 checkpoint（`g1-field.ts:28,46,55`）；生产 layout 从 geometryWork 传入。single 扫描的 catch 现会再次检查共享截止（`layout.ts:346`），不会把超时当作普通“保留旧站位”吞掉。
- **没有增加候选或几何预算。** single 仍受 `NATIVE_SPATIAL_SITE_EVALUATION_LIMIT` 限制（`layout.ts:200`）；initializer、joint 算子和 geometry controller 未因新场增加搜索槽或编译次数。规划限值仍 `maxEmptyRadiusPx−8=152`，正式 measure 的160px、deep448px与 G3 规则未改。细场增加的是每次完整精评的距离查询成本，不能称为免费。

## 已有运行证据及其限制

已读取 Code 的 [唯一固定 c27 收据](g1-field-c27-round1/report.json)，没有重跑：来源前后一致；单次 refinement 约4870ms，细场24245点、185次最大值评分、4485325次最大值距离查询及387920次缓存查询。该成本只描述这次固定输入，不证明整个正式请求能在60秒内产出有效地图。

新实际几何 hash `479a0ead75d88dd5`，仍拒绝 `G1-largest-empty-radius`，最大空白上界约160.220096px。规划 maximum / sum 为0.00285258，已经显式保留违规，并非新的假零。历史漏采点 (948,524) 本次得到 S 覆盖；新最坏点是 (980,892)，raw H=147.851277px、final H=159.298462px，而 final S=154.563242px 成为实际最近结构。**不能把159.298462当作该点最终全结构最小距离**；正式上界来自 final S 再加单元误差。这个剩余足迹差异是不同问题，本报告不审查后续足迹统一方案，也不以调采样或放宽门限使本图通过。

未验证：新算法正式 fresh 成功率、G2 / G4 / G5、完整内容部署、正常镜头、留出种子、恢复和浏览器性能。由 Director 关联登记本报告与有限收据；不提升 COH-F011 的整体交付状态。
