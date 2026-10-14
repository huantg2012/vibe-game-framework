# 正式 G1 物理空圆测量接线

Root 批准的 max-only 变化已写入 `src/generation/world-study/native-spatial-measure.ts`：同一 supported 中心的 `min(solidDistance, voidDistance) + 4√2` 决定 `maxEmptyUpperPx` 和 `worstEmptyPoint`；真实岸沿、外海、内部空洞和实体足迹均参与。旧有效内部 H/S 最大距离及位置保留为 `internalMaxEmptyUpperPx`、`internalWorstEmptyPoint`。deep 仍完全使用旧内部距离，阈值、对象资格/数量、G2/G3/G4 和路由未改。

`check-open-radius-production.mjs` 复用 §14 的七份原始几何快照，没有构造几何或生成新布局，full 0。正式 measure 与事前离线投影逐项一致；86,831 个 supported 中心满足 open ≤ internal。所有非 max 指标、非 max 拒因，以及完整内部距离、deep、deepBody、wide 与 deep components 数组都与旧快照完全相同。5 组接线验证通过，374.814 ms，测量依赖及输入指纹稳定；这是接线回归，不是原四夹具合同全部通过或完整地图准入。

c25 仍以 161.429px 超过 160px 拒绝；c27 保持 158.334px；原坏 c3 的 deep 696px 拒因保留。1024 级大开场仍以 513.657px 拒绝；空长带虽物理空圆 136.255px，仍以内部 deep 1376px 拒绝。原短岸角/带结构长带中的无效 S 面积拒因保留；夹具证明缺口见 `../open-radius-calibration-round1/summary.md`，不调形重跑。

指纹仅覆盖本工具、measure/geometry/identity/final-support/bay 模块与输入快照，允许 Main 同时编辑尚未参与本测量的规划模块。后续全源统一 `tsc --noEmit` exit 0（`../route-feedback-controller-round2/tsc.log`）；Vite 启动及根页／源码转换 HTTP 200（`../route-feedback-logic-round1/dev-smoke.json`）。没有顶层 lint 或统一 test 脚本，未冒称执行。此回执未作 fresh、完整链、回放、图审或玩法通过声明。
