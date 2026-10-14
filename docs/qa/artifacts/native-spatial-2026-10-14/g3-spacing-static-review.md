# G3 精评与间距校准入口：独立静态复核

日期：2026-10-14。范围：COH-F011 原生空间生成；仅复核本轮 G3 精评、测量观察口与三间距采集脚本。依据 `docs/specs/system-map-generation.md`、`docs/design-notes/world-fragment-native-generation-2026-10-13.md` 及 Director 本轮有界诊断合同。Main 与 Layout 均已通知源码/工具冻结。

## 结论

本轮限定静态检查未发现阻碍。可以执行已授权的唯一三值校准；此结论不代表校准完成、地图准入或 G4/完整部署通过。

## 已核对

- `native-spatial-layout.ts:118–187`：一次完整试位评分只取得一次宽域 measurement，面积与最大连通分量共用结果；粗排仍用原代理。基线/结尾汇总另作 measurement，不把它们误记为额外试位。固定旧 `supportedBodySeats` 明示为预测分母，未接入正式实际门；无 actual VOID cache 时不伪造连通通过。
- `wide-area-c27-round1/report.json`：只读核对 Main 的固定历史 c27 收据。预测为 `10254/18632 = 0.5503434951`，重编实际为 `10261/18631 = 0.5507487521`，二者没有混用。实际 G3 通过后，G1 最大空白 `162.1177 > 160` 仍拒绝。收据记录 source stable，本 QA 未重跑该算子。
- `native-spatial-generation.ts:186–250`：可选 observer 收到 `structuredClone` 的 layout/gate/hash 快照，返回值不参与 archive 或选择；正式调用未传 observer。观察点在真实 G1/G3 测量后，之后仍走正式 G2 与 checkpoint。快照的 `gate.accepted` 只表示当次 G1/G3；只有 generator yield 表示 G1/G2/G3 全过。
- `capture-spacing-calibration.mjs`：默认按 `288 → 320 → 352`，仅接受 CSV 已登记值。每个 clone 仅覆盖 spacing，并调用正式 `validNativeSpatialRuntimeInput`；六 CSV 的 sourceHash 保留来源意义，另存 configuration/override SHA-256 和 `csv-registered-diagnostic-selection`，没有冒充新生产 recipe。
- 每 spacing 仅一次独立 attempt；真实初始资格预检及终审仍计入原 `72` work。`60s` checkpoint 包含 observer 克隆和同步写盘耗时；只取首次 yield，不续搜、不部署，`fullCandidates` 保持零。没有通过另设诊断预算规避生产预算。原有同步工作粒度可能使退出略越过 60s，未引入额外重试或无限循环。
- 保存全部真实 measured proposal；`domainCoverage` 枚举所有合法 H/S 数对 × B 选项，包括未有 trace、未测量的域。观察写盘失败会在后续 checkpoint 中止；工具拒绝覆盖旧目录，并检查源码、输入和 recipe 前后未变。

## 覆盖边界

这是一次代码/已有收据的静态复核。本 QA 未执行校准、fresh、构建或测试，未复验整个生成器、G4、部署、游戏体验或性能。实现者已有类型检查/脚本语法检查的报告不替代本 QA 的运行证据。校准结果及各输入域实际覆盖须以后续独立采集报告为准；`report.status = complete` 仅表示采集结束。
