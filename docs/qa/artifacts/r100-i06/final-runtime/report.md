# 最终运行版本：证据与依赖影响

本目录固定在 `3074` 的[源码快照](frozen/source-snapshot.json)，绑定 [20 份不可变世界收据](packages/index.json)，每份含 **284 个实际运行依赖**。这些文件记录所验版本，不自动授予美术、经济或整体验收。

## 原证据如何继续适用

[逐世界依赖映射](dependency-impact.json)以原 279 项[归档](../../r100-i03-i06/packages-279-frozen/reconstruction-proof.json)为起点，逐个记录新增／变化文件及 SHA。20 份世界的定义、三档预算／污染曲线、材质原图和残骸定义与原收据相等；变化集中于实际玩家身体、准备缓存、入场调度及恢复校验。

原 2400＋480 资格执行器的 72 个输入中，71 个源码 SHA 未变；`physical-grid.ts` 仅增加两个会被 TypeScript 擦除的接口。按原参数重新编译后，**948325 字节全部与原执行器一致**，SHA-256 仍为 `9242daae4f7958a24fbc22fe1174db0c4735be78f09e1e4138bc5e62859673cb`。因此原生成、Host、模型窗口、transfer／CPU 恢复案例继承有实际字节依据，不把它们改写为“在最终运行版重跑”。

原 90、30、12 趟旅程保留各自冻结版本；收益、损伤、成长规则没有变，但这些旅程不能验证新精细身体和入场围栏。原 120 个画面中的材料和几何未变；玩家足缘接触另由 [native-body-fix](../../r100-i03/native-body-fix/) 实机证据负责。新[失效检查](dependency-invalidation.json)在隔离文件副本中改变材质、共享几何和污染规则，过期收据确实拒绝，恢复原字节后精确通过；没有写回旧收据。

## 旧档兼容：真实失败条件、限定修复

冻结旧版 `3065` 的真实 UI 装备、按 Q 和 Esc 产生了[实际旧保存](../../r100-i03/native-body-fix/legacy-dash-save/actual-old-save.json)：付费中的 catalog dash 尚未结束，Phaser `Body.reset` 令身体中心相对人物位置为 `(-6,-6)`。这是旧代码省略碰撞体 offset 的真实保存形态，不能因新的身体检查而拒绝它，也不能普遍容忍任意错位。

当前保存增加 `world.bodyGeometryVersion=1`。只对没有此标记、通过完整库存／技能／时钟校验的旧记录执行窄兼容：活跃且已付费的 dash、精确旧偏移、零速度／输入、锁输入状态、起终点和剩余时间的插值必须一致，校正后的完整 20px 身体必须有真实地面且不穿实体。只复制修正 `player.bodyPosition`；身份、时钟、物品、次数和其他运行字段保持原值。新标记或其他错位严格拒绝。**不声称覆盖结束帧 dash 或旧 expand 的偏移。**

[正式 Continue 实机](legacy-dash-continue/report.json)通过：标题读取和恢复构造期间原保存字节不变；第一张真实零时钟画面完整保存时，只有 `player.bodyPosition` 与版本标记变化，整个其他 state、identity 与 inventory 逐字段相等。随后真实恢复输入让 dash 完成，没有再扣一次使用次数。17 个 CPU 正反例同时通过，艺术 Agent 独立只读审查通过。

## 直接销毁与初始化边界

独立审查发现 Phaser `SceneManager.remove` 会直接发 DESTROY，不一定经过 SHUTDOWN。现在两事件共享幂等清理，并解绑另一事件。 [真实移除检查](direct-destroy/report.json)分别在构造完成与首张完整画面完成后、实际 POST_RENDER 前调用公开 `SceneManager.remove`：围栏监听、事务、GPU、运行包装器均释放，原保存字节不变，没有控制台错误。重复 shutdown/destroy CPU 检查通过。

生命周期测试适配保留两个未算生产缺陷的失败：测试复用 Scene 时绕过 createRun，未重置新的幂等状态；随后测试编辑误把 `enter()` 吞进同一行注释。修正测试调用后 **8 项实际 Scene 生命周期检查通过**。没有为测试放宽生产行为。

## 当前依赖的全库正式入口与冷续

在同一 `3074` 冻结源重新执行 [20 世界 × 3 档正式矩阵](formal-entry/summary.json)：**60 次正式入口＋60 次冷续全部通过，0 失败、0 替补抽取**。两个隔离浏览器各执行 10 个世界；使用正常菜单、档位、出发、保存及 Continue，覆盖种子在游玩前选定以命中各世界；没有替换地图、健康、物品、位置或时钟。备行通过正常场景入口方法打开，因此这不是从净化点行走开始的完整体验测试。

每格均核对正式启用池选择的世界／档位、v3 recipe、native renderer、完整 checkpoint、`bodyGeometryVersion=1`、身体中心、冷续身份与身体位置。全部实际模块／材质 URL 的摘要在两组间一致，并绑定最终 284 项依赖与源码快照。原始报告和图片保留在 [part-a](formal-entry/part-a/report.json)／[part-b](formal-entry/part-b/report.json)，台账可用的逐世界 `runtime / production-integration / production-entry + recovery` 字段在 [evidence-bindings.json](formal-entry/evidence-bindings.json)。这次是当前版本的实际重跑，不继承旧 60 格来充数。

并行浏览器采到的 longtask 原样保留，但不用于独占机器条件下的 P01 性能裁决。完整旅程、自然经济、美术认可和技能全组合不由这 60 格代替。

## 最终机器检查

- [完整 Rift 恢复检查](regressions/recovery.log)：27 组通过，包含新增围栏、完整身体、旧 active dash 的检查；旧 v1/v2 身份和恢复规则仍通过。
- [表面预烤等价](regressions/prewarm.log)：36 张原 RGBA 逐字相等、54 个真实 Host 烤制相等，取消、超时、身份错误及失败清理通过。
- [表现生命周期](regressions/presentation.log)：23 项通过；另 7200 音景帧及定期恢复通过。
- [类型检查](regressions/typecheck.log)、[build](regressions/build.log)、`git diff --check` 通过。既有大 chunk 提醒仍在。项目没有 lint script，不将其写作“lint 通过”。
- [npm run dev 冒烟](regressions/dev-smoke.log)与 `3074` 正式恢复实机通过。

性能沿用[帧围栏测量](../entry-frame-fence/report.md)的明确范围：同一重档案例首次 51ms、冻结复测 61ms，冷续没有 ≥50ms 任务。准备／生成不再在建场重烤，但此证据不足以证明全世界、全硬件满足 50ms；P01 不在这里关闭。技术通过也不代表自然经济稳定或独立游戏总体完成。
