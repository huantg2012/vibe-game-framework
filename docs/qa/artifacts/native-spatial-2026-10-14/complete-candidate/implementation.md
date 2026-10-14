# 共享完整候选执行入口

COH-F011 / COH-F013；2026-10-14 工作树。该批为正式链抽取及诊断入口，后续仅按 root 授权执行一次固定完整候选验证，G4 拒绝，尚无新地图准入。

`r100-production-map.ts:completeNativeSpatialCandidate` 是 extraction → master → expedition → G4 → serialization 的唯一当前 r12 执行函数。正常候选循环及固定布局诊断共同调用它。G2 仍由共享 `evaluateNativeSpatialVisibility` 测量，完整入口要求 G1/G3 与 G2 的候选 trace 均已准入；没有改变其策略、字段或阈值。

完整候选槽在出口选择前消费，出口或后续阶段失败不退槽。函数保留阶段、原始错误诊断、route feedback 与 rejected seed；请求截止仍重抛原错误。原始端点及最终物理栅格相等断言保留，完整 profile、grade、spatialDeployment、contentDefinition、searchSitePolicy 均原样传递。

## 有限验证

- `logic-round1.json`、隔离性能字段后的 `logic-round2.json`：6 组通过。三项准入门缺失、seed/candidate/attempt 不匹配、进入 extraction 前失败、第三个 full 槽拒绝、deadline 原错误传播、AST 单一生产阶段 owner 与冻结参数接线。零 geometry、零内容部署；不伪造通过整图。
- `tsc-round1.log`：首轮失败只有并行 Main 提取共享边界后的 `native-spatial-measure.ts` 遗留 unused import，已由文件所有者修复。`tsc-round2.log` 在本批最终成功 trace 投影之后通过。
- `existing-budget-regression.json`：既有 geometry-work 账本 5 组纯回归通过。
- `dev-smoke.json`：独立 3038 端口 Vite 131ms 启动，首页和正式生产模块 HTTP 200；服务随后关闭。仅开发服务/模块冒烟，未生成地图或进行玩家操作。
- `replay-trace-round2.json`：4 组纯 trace 检查通过。耗时/纯性能计数不同的稳定序列化数据、synthetic map envelope 的完整 hash 与真实 checksum 函数结果一致；geometry / gate 改动仍改变签名。原账本未原地修改，2400ms 实际玩法窗口保留。
- 两个新工具的 `node --check` 及本批文件 `git diff --check` 已过。
- 项目未注册 `lint` 或统一 `test` npm 脚本；当前记录为缺失，不能写作已运行通过。

## 成功身份与性能证据隔离

静态审查确认原内联代码将 `attempts[].geometryWork[].elapsedMs` 纳入 `native.diagnostics`，整块又进入 signature，导致完整回放受运行计时干扰。当前成功路径统一先经过 `nativeSpatialReplayAttempts()`，精确去掉 `geometryWork[].elapsedMs` 与 `candidates[].initialPlacement.{timings,counts}`，再进入 native 序列化和签名。真实预算次数、候选顺序、结构、资格和 gate 不变；不采用 `*Ms` 通配删除，玩法窗口时长不能被误伤。

失败仍保留原始运行账本及耗时，成功性能证据继续由 `capture-production.mjs` 外层 `generationMs/replayMs` 和固定诊断 report 保留。测试没有忽略完整 map 字段。上述仅证明投影与身份性质；尚未取得真实完整地图的 exact replay。

## 固定布局工具与唯一实测

唯一实际执行记录位于相邻 `complete-candidate-c27-round1/summary.md`：历史 c27 的一步细化 c28（hash `9faebdbd40a92649`）在同源冻结 recipe 下通过 G1/G2/G3、撤离与完整内容部署，G4 的 5 项 H 遭遇比例及 2 项窄段问题导致拒绝；1,719.93ms，1 geometry、1 full、sourcesStable。未重试。独立内容/Host/patrol 精查当前为最终 success 分支，因此本次 G4 提前拒绝未执行这些后验断言，阶段诊断不提升为独立检查通过。

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx \
  tools/native-spatial/check-complete-candidate-saved.mjs \
  SAVED_LAYOUT_JSON FULL_RECIPE_OR_SINGLE_FAILURE_JSON EXPECTED_GEOMETRY_HASH NEW_DIRECTORY
```

固定工具只接受配方的第一次 geometry attempt。完整 recipe 必须通过正式 r12 校验，六类冻结意图与 saved input 精确一致，未被布局替换的材料/身份字段也必须一致。它从同一 recipe 取得 extraction、deployment、grade、profile、完整内容及 grounded search 规则，不从当前默认值补齐。原布局按实际 hash 核验，真实 G1/G3 不通过就不跑 G2，G2 不通过就不进入 full。

同一 60 秒计时和 72 geometry-work 账本覆盖该次重建与后续测量，最多 2 full 的生产限制保留；工具只执行这个候选一次，不循环或换 seed。完整结果另外精确核对各 tier 数量及价值、敌人数量、真实 Host pins/forms、非静止巡逻身体扫掠、非 safe 节点翻找窗口、每个节点 grounded 来源；成功才保存 `map.v8.gz`。`accepted-fixed-candidate` 只表示该固定布局条件性的完整部署通过，不代表 fresh 请求、精确 replay、G5 或推广通过。

拒绝、异常与 source 变化均留独立新目录的失败记录；不覆盖先前证据。
