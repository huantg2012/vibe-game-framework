# QA Report: 全对象初始站位独立静态审查

日期：2026-10-14。Feature：COH-F011，关联 F007 / F013。

基准：[全局生成复核 §4–5](global-generation-design-review.md)，以及 `docs/specs/system-map-generation.md` 的原生联合生成与实际准入合同。

版本：`4cbfaf48693043bcfdde00c4c332637a462e12d8` 上的未提交工作树。审查源码 SHA-256：

- `native-spatial-initial-placement.ts`：`d3696582e5569ac3c64eef4405c4e655697b7ef48d138eeff32feeaa39f11e78`
- `native-spatial-layout.ts`：`36ac3802066c9cf7b6b4557728bf5f56933b51e1d3feb3b0034ffe343a23fce6`
- `native-spatial-generation.ts`：`6caf629552adb6c66ef8deb0ae978209ba309d381283af8693a5039fbcf05945`
- `native-spatial-types.ts`：`c6783d8e27463d577757d22d06d51a69a62494d3c585eaaae51749fae97c643b`
- 本次设计复核基准：`d988741b6d92607963f30d0972bc6b58ee2e4947bdfd29f74fda3af6d61eaa31`

方法与限制：只读静态审查；读取了 game-state skill / protocol、INDEX、当前迭代、相关实现和固定 c3 / 合成夹具工具。按本任务的并行资源约定，不运行构建、测试、地图生成、重放或浏览器，不修改源码、数据、阈值或他人文件。当前 INDEX 的旧状态不能代替正式新图验收。证据登记交 Director 汇总到 COH-E242。

## 发现的问题

### GI-01 · 中 · 正式生成丢失初始容量失败的结构化诊断

位置：`src/generation/world-study/native-spatial-generation.ts:247–252`；信息来源为 `native-spatial-initial-placement.ts:38–39,103,124` 和 `native-spatial-layout.ts:307–308`。

当某件对象没有独立可放域、固定匹配图无解、12 状态用尽，或者完整 H 身份资格失败时，错误对象已经携带 `initialPlacement`，后者包含域摘要、锚点/责任域、冲突姿态、状态计数与耗时；H 资格错误还携带 `qualification`。正式 controller 的 catch 只保存 `error.message`，没有复制这些字段。由于 `layout=proposal` 尚未执行，该分支同时只能记 `layoutSeed: 0`。外层 `capture-production.mjs` 再保存 attempt 时无法补回丢失的信息。

这不使不合格地图通过，但违反设计 §4.4–4.5 要保留具体 D_i / 责任域不可容证据和计算成本的要求；后续正式 fresh 若在资格前失败，会重新退化成泛化错误，无法从收据判断容量冲突还是成本问题。

固定 c3 工具 `tools/native-spatial/check-global-initial-c3.mjs:29` 已显式保存两项错误字段，因此本问题**不影响本次固定 c3 对照的诊断完整性**。建议正式 fresh 前在有界候选 trace 中保留相关失败诊断，避免为诊断重跑几何。无需改变生成规则、预算或门槛。

## 静态符合项

- **全部形体先采样、独立 D_i。** `layout.ts:275–304` 在调用 initializer 前构造全部母体、附属 relief、H 和次级 S；`initial-placement.ts:92–103` 对同一 snap8 field 分别建立每件的支持域，只看 L−B 与自己的完整 K，不使用其他对象的旧位置排除站点。支持查询按对象 ID 与站位缓存；空域整计划抛错。
- **P / K 分离。** `layout.ts:70–72` 使 S 的 support 包含 relief，而 blocking 只含 solid；H 两者均为完整矩形组。`initial-placement.ts:108–109,128` 的覆盖代价与责任更新读取 blocking 树；`95,99` 的支持及 H 对完整 K 的关系读取 support。没有让 relief 获得覆盖或障碍数量分。
- **完整瓶颈分配。** `initial-placement.ts:104–109` 先产生全部锚点和责任域，再构造 N×N 代价；代价为责任域到真实 P 的最大距离。`65–84` 先找可行最小瓶颈，再在该瓶颈下最小化平方和；对象按 ID、站点按 y/x，矩阵域顺序固定。未永久锁定匹配前缀。
- **冲突禁止包括同姿态的全部别名。** `43,78,98–100,112–124` 使用对象 ID＋真实站位作为禁止键，冲突双方各分一支完整重匹配；不会只换责任域标签而保留被禁止的位置。互斥检查同时读取全部新姿态，包含 P/P 间隙与 H/K 关系。
- **完整匹配与一次共同更新共享 12 槽。** `41,112–124,127–142` 共用 `trace.states.length`；无完整匹配也占一次搜索槽。合法基底才计算一次完整评分；随后仅一次职责重分配，每件最多 12 个地方评分。所有目标先算完，再共同插值 1、1/2、1/4；t=0 复用合法基底及原评分，不新增免费全状态。
- **评分只看完整合法状态。** 基底先过冲突检查；共同更新先完成所有位置、支撑和互斥检查，再调用 `evaluate`。不会部分提交前几个移动，也不拿对方已撤走的旧位置否决换位。只有最大/总违规及其平局评分更优才选新状态。
- **fresh 不借用其他图的真实 VOID。** `layout.ts:269,304` 初始完整评分使用本次 L−B 的 raw field，宽域修正为 0，没有传入历史 actual VOID / denominator。实际门仍在完整编译后重新计算。
- **一次完整 H 资格检查走共享 work。** `layout.ts:301–308` 强制提供预算，在选中完整状态后只调用一次 `geometryWork.run(initial-hole-identity)`；失败整计划拒绝。`generation.ts:213–223` 的外层 final 预留及内层资格检查共用 `44–62` 的计数，不退款，不改 72 次上限。
- **新增纯 CPU 路径接同一截止。** `types.ts:10–13` / `generation.ts:44–60` 暴露原 checkpoint，不消耗额外 work；D_i、最近站位、代价、匹配、冲突、职责更新和全域评分周边有检查点。只能静态确认接线，不能据此声称 60 秒内能产出地图。
- **refinement 保留原路径。** `layout.ts:309–339` 仍独立进入既有 single / joint 分支，没有 fresh 失败后回到前缀贪心或 r11 的旁路。
- **固定输入适配器复用正式 initializer。** `layout.ts:241–242,249–276` 保留完整 L/B、形体、原 layout seed 与 fragment seed；`check-global-initial-c3.mjs:21–24` 明确断言形体、数量、种子与输入未变。工具的存在与静态断言不等于实际运行通过。

## 结论与未验证

未发现允许非法/不完整布局绕过正式准入的新增静态阻断问题；发现一项正式失败证据保留缺口 GI-01。本结论不表示初始化假设有效、固定 c3 改善或 r12 可发布。

本次未执行合成夹具、类型检查、构建、固定 c3、fresh 生成、G2 / G4 / G5、恢复、实景或性能测试。最终仍须由唯一固定 c3 对照验证实际违规改善且身份/支撑/面积不退化；后续正式请求、正常镜头与完整内容证据不得由本次静态审查替代。

## 后续复核：GI-01 修复与只读测量观察器

2026-10-14，同工作树后续快照；只读源码与 Code 保存的合成收据，没有执行测试、构建或几何。新增复核范围仅为 GI-01 与 `evaluateNativeSpatialGeometry` 第七个可选观察器。

复核 SHA-256：

- `native-spatial-generation.ts`：`2d0b629c10c6f9f90a09fb985b020bebc839d6a0ef9ce61ef29f34f12465409a`
- `native-spatial-measure.ts`：`645fb86bba2e2fb951a9e101d219886f9851752cccda88b9e540b29d0f26b0c3`
- `native-spatial-types.ts`：`45e657b24949fce8ddcfe7177a29985175a241a42424658f11483167f53955d8`
- `check-runtime-diagnostics.mjs`：`28a35d054e14f1542cc9cd51504328e2b2b455d8082954f2a1a2f2add645e7f7`

**GI-01 在所报范围已修复。** `generation.ts:24–27` 以 `structuredClone` 复制错误中的 `initialPlacement` 和 `qualification`；正式 catch 在 `260–261` 行将其写入候选收据，且在 layout 尚未返回时用与 `layout.ts` 一致的正式 `mix32` 公式计算 layoutSeed。`types.ts:94–95` 登记了对应字段。域为空、固定图未解、状态预算耗尽及完整 H 资格失败的已有结构化信息不再只剩一条 message；收据副本不与原错误共享可变引用。本结论不扩大到没有携带这些字段的任意错误或 deadline 提前中断。

**测量观察器隔离静态符合。** `measure.ts:158–159` 只有提供观察器时才构造诊断对象；deep / deepBody / wide / distances 各自 `.slice()`，deepComponents 的外层数组和每个 cell 列表均新建。标量是值复制，没有传递 geometry、groups、policy、内部原数组或 gate 写入句柄。观察器返回值未参与任何准入决策；正式调用仍省略第七参。这里的“不分配”特指没有额外诊断复制，不指原有 G1/G3 测量本身不分配工作数组。

已阅读 [Code 的三组合成收据](runtime-diagnostics-logic-round2.json)，其记录源码前后一致，覆盖默认无观察器零诊断副本、故意修改所获副本后 gate 与原数组不变、失败上下文复制隔离及接线。上述四份当前指纹与收据相符。该收据由 Code 执行，本 QA 没有重跑，也没有将合成 5×5 输入检查升格为地图生成、完整请求截止或性能验收。

此次限定复核未发现新增隔离问题；原始报告中的 GI-01 发现保留作历史，当前状态为“修复，静态复核通过；正式 fresh 失败收据运行验证未执行”。
