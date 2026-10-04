# R100 I03–I06 技术验收记录

更新：2026-10-04。对应 COH-F005／F007／F008／F011／F012／F013／F052。

本记录覆盖已启用的 20 个原生世界、每世界低／中／重 3 档的生成、内容准入、恢复及表现准备。**技术通过不等于美术、自然供给或四迭代全部通过。** 正式资格仍由现有 R100 台账登记；本文不另建状态账。

## 最终版本与逐世界绑定

- 新出发：`r100-native` v3，`algorithmRevision: 2`。世界、污染曲线、内容预算、材料依赖、请求种子在出发前冻结。
- 旧 v3 修订 1：使用 `r100-expedition-v1.ts`；V1／V2 沿原执行器。失败重试不改世界或档位。
- 20 世界 × 3 档的准确映射及每世界 SHA-256 依赖摘要：[`packages/index.json`](artifacts/r100-i03-i06/packages/index.json)。其中每个 `dependencyManifest` 指向该世界三档的精确数据、实际原子材料及 281 项运行依赖。**不要用 8 位 recipe 完整性字段替代该 64 位 SHA-256。**
- 每世界三档技术证据由本正文、主矩阵和保留种子矩阵共同组成。主矩阵 `rows` 可按 `world`／`grade` 筛选，每格各 40 例；保留种子每格另 8 例。此绑定只授予下述技术范围。

最终生成执行器 SHA-256：
`9242daae4f7958a24fbc22fe1174db0c4735be78f09e1e4138bc5e62859673cb`。

生成源码快照：[72 个实际打包输入的 SHA-256](artifacts/r100-i05-qualification-rev2/source-snapshot.json)。最后失败清理补丁后，逐文件复核仍全部一致。执行器和种子原文保留在同目录。

## 生成、真实 Host 与 CPU 冷恢复

主矩阵：[完整报告](artifacts/r100-i05-qualification-rev2/report.json)、[逐例原始记录](artifacts/r100-i05-qualification-rev2/cases.jsonl)。

- 20 世界 × 3 档 ×（32 普通种子＋8 边界种子）＝ **2400／2400 通过，0 失败**。
- 全部真实 transferable 发送端缓冲脱离、接收端重建并核对身份；不是 JSON 浅复制。
- 真实 Host 的占漆／占空编号、支撑、接触区、阶段时钟及多次冷恢复继续均逐例执行。
- 校验 20px 身体、8px 支撑／路线、32px Host 合同；搜取成本遍历 48px 内合法且有视线的实际站位，含去程与返程增量。
- 内容预算、入口单堆基础收益 1、不重叠占漆、无需强穿活动 Host 的身体可达退路、完整敌人巡路均检查。
- 生成候选次数：2345 例一次、46 例两次、5 例三次、4 例四次；没有用尽 8 次预算。

独立保留种子：[完整报告](artifacts/r100-i05-holdout-rev2/report.json)。QA 在获知最终执行器前独立选种并先提交 SHA-256，随后才揭示；使用**同一执行器**。

- 20 × 3 × 8 ＝ **480／480 通过，0 失败**，全部完成 transfer 冷重构。
- 463 例一次、15 例两次、2 例三次成功。
- [种子承诺原文](artifacts/r100-i05-qualification-rev2/holdout-commitment.json) SHA-256：`c7b1af6c5e77dac98e377fa647775fcefbb16c9f0d83e15cc47e2760b98600f2`。

报告内 `workerDurationMs` 包含生成、断言和冷重构，且执行时有并发验证负载；**不能当作玩家实际入场耗时**。`guaranteedSafeReturn` 指存在无需强穿活动 Host 的身体可达退路，不是追逐中必然逃脱。

## 初始失败、修复与兼容性

### 敌人静默退为原地守点

[修复前实际 45 秒观察](artifacts/r100-i03/loot-windows/report.json)发现灰层重档种子 20261004 的一处深污染物、20261005 的一处深薪柴，在所有合法站位上均没有可用观察窗口。根因是选不到巡逻终点时采用 `patrolTargets[0] ?? seat`，把完整巡路降成永久守点。

修订 2 在选出生位置时就要求存在完整往返巡路，不保留 static 降级；以生产移动／停顿／转向参数筛选每个非安全搜取点的干燥全身体站位，要求**未警觉巡路模型中至少 2.4 秒空档**。

[修复后真实观察](artifacts/r100-i03/loot-windows-rev2/report.json)中上述两个反例分别出现最多约 9.8／9.3 秒空档，三个指定重档案例共 24 个非安全节点均找到窗口。此观察版本早于最后的初始朝向六位小数量化，但三个指定案例的路线／部署未改变。最终矩阵另外检查全库模型窗口。

**边界：**该模型不模拟接近暴露、96px 翻找噪声、警觉、追逐、工具、战斗或撤回。它既不保证按下搜取后继续安全，也不保证无伤或高收益。三条实际反例搜撤和自然连续出行由独立实机证据负责；不因 CPU 窗口通过而删除真实噪声代价。

### 旧记录和跨引擎身份

[`browser-equivalence.json`](artifacts/r100-i05-qualification-rev2/browser-equivalence.json)：实际 Node 与 Chromium 中 **60 个新身份逐字段相等**；另 **18 个原 Chromium 修订 1 身份在当前 Chromium 精确复算**，合计 78／78 通过。

旧修订的 Node 对照另取此前封存的原执行器，而非用新代码自制期望值；18 例各自匹配。测试入口：`tools/world-study/check-r100-patrol-revision.ts`；原记录：`tools/recovery/fixtures/r100-revision1-gold.json`。

保留一个历史局限：旧釉原重档 20261004 原本就有 Node `9f8ebef0`／Chromium `dfbe7c02` 差异。两端旧实现各自精确保留，**未放宽恢复签名，也未改写存档**。新修订量化初始朝向后本次 60 例跨端一致；不宣称所有未来运行时完全等价。

### 真实行程中音景状态使保存拒绝

[实际被拒状态](artifacts/r100-i03/checkpoint-phase-4200/low/1-rejected-state.json)来自固定原失败世界、自然等待 4200ms 后的真实输入。静音阶段的微小压力大于 `peakPressure`，违反严格恢复合同，导致帧提交暂停。

修复静音／无声音源分支的峰值维护，没有放宽 validator。独立 [audio-regression](artifacts/r100-i03/audio-regression/) 复跑原输入及真实搜撤归返；技术回归另逐帧检查 **7200 音景帧**、每 500ms 冷恢复，静音和缺源场景均覆盖。主矩阵每例也检查真实压力周期恢复。

## 表现准备、所有权和事务

初始 [entry-profile](artifacts/r100-i03/entry-profile/) 暴露实际入场约 564ms、冷恢复约 435ms 的长任务；地表、材质字段、像素烤制和占漆 Host 在建场同步计算。

改动将地表／字段／四张 RGBA 及实际占漆 Host 烤制移到可取消的第二 Worker，等待阶段完成 GPU 接收器准备，场景消费一次。不降低分辨率或跳层；正式缺准备时抛错，不同步补烤。实际浏览器最终入场／冷恢复耗时由根任务最后冻结测量，不能以 Worker 迁移直接宣称达标。

[预烤日志](artifacts/r100-i05-qualification-rev2/regressions/prewarm.log)：9 世界／36 张原始 RGBA 与冻结旧构造器**逐字一致**；54 个真实 Host 完整烤制结果逐字段／数组相等；传输、取消、超时、错误身份和 Worker 失败清理通过。

[表现生命周期日志](artifacts/r100-i05-qualification-rev2/regressions/presentation.log)：**19 项通过**，覆盖 decode 取消／迟到、共享订阅独立性、重试、GL 分配失败、两份 GPU 上限、暂停、恢复、一次消费、重复销毁，以及下述最终修复。

最终只读审查发现：`RiftScene.createRun` 已拿到包装器、尚未 `createRuntime` 时若抛错，准备好的 GPU 接收器仍留在缓存，直到重试／LRU 替换。最终增加 `disposeUnconsumed` 并在 shutdown 调用。它捕获具体 entry；旧包装器不能删除或消费同 key 的新准备，已消费资源仍由 runtime 销毁。新增构造前打断、重复清理、旧包装器遇同 key 新准备、消费后清理四个分支；原 `MasterPresentation` 构造失败测试保留。艺术 Agent 已独立只读复核。

这个补丁只改变失败清理与旧 owner 的权限；没有改生成、地图、AI、奖励、污染或正常帧。**2400＋480 的 72 个执行器输入未变，连续真实行程的玩法证据仍适用；最后浏览器故障清理由根任务另验。**

此前失败清理阶段源码摘要（后续派生准备补丁已变更这些源，不能把本组当作当前最终 SHA）：

- `src/systems/r100-world-presentation.ts`：`04f11badb6b245aa11ebece3a9c82e0bedc8af239064012585f20d43c03f2463`。
- `src/scenes/rift-scene.ts`：`558e3c9ab6e909600d0efe61ec7ad7d07ab0e30a425cfe3f4576392e6fd11f19`。

[事务日志](artifacts/r100-i05-qualification-rev2/regressions/async-entry.log)：**16 项实际 persistence／session 路径通过**，渲染适配、投递受控。覆盖保存失败保留同候选与准备、重试、不提前消费库存、保存被替换、场景启动抛错、分配 GPU 后失焦等；不使用跳过 prepare 的替身。

## 依赖变化与回归

[`dependency-invalidation.json`](artifacts/r100-i05-qualification-rev2/dependency-invalidation.json) 对真实文件做隔离变更：单材料资产、共享几何、污染规则。过期收据均拒绝，原字节恢复后精确复核；该报告基线属于窄清理阶段；后续准备补丁已另生成当前收据和失效实验。它检测证据失效，不自动批准重新生成后的内容。

最后一次回归：

- [类型检查](artifacts/r100-i05-qualification-rev2/regressions/typecheck.log)、[build](artifacts/r100-i05-qualification-rev2/regressions/build.log)、`git diff --check` 通过。build 保留既有大 chunk 提醒。
- [完整既有 Rift recovery suite](artifacts/r100-i05-qualification-rev2/regressions/recovery.log) 通过；最后窄清理后又跑上述 16 项事务与 19 项表现回归。
- [隔离 dev 启动与实际模块服务](artifacts/r100-i05-qualification-rev2/regressions/dev-smoke.log)通过，所属测试服务已停；不冒充全游戏实玩。
- 项目没有 lint script；没有声称执行了不存在的 lint。

## 后续 P01 精确归因与最小修复

[原冻结版时钟对齐归因](artifacts/r100-i06/entry-profile-final/report.md)确认入场 157ms 中约 42ms 是首帧准入重复完整烤 Host，不是 Phaser 基线。新的[派生准备补丁报告](artifacts/r100-i06/entry-profile-prepared-gameplay/report.md)将清单、发光源选择和搜取来源区域纳入第二 Worker 的同身份准备，未改算法或绘画。正式异步缺准备拒绝，旧版与同步离线计算保留；同一 layout 的弱缓存有取消、替换和消费所有权。

同种子重档对齐复测首次出发 **157→88ms**，冷恢复 **67→66ms**；另两世界正式集成样本为 **87／79ms**。主线程不再完整烤占漆、不在 createRun 扫来源 BFS；仍有场景创建／首帧组合长任务，**P01 不在本文关闭**。不能把全部剩余耗时都叫 Phaser。

本补丁再跑原 36 RGBA／54 Host 等价，新增 9 份清单／来源等价，**23 项生命周期＋16 项真实事务**以及完整恢复 suite、类型检查和 build 均通过。原 [72 生成输入复核](artifacts/r100-i06/entry-profile-prepared-gameplay/generation-impact.json)仍全部相同；2880 例原生成证据未受影响。281 项运行依赖的此阶段收据已[独立归档](artifacts/r100-i06/entry-profile-prepared-gameplay/packages/archival-index.json)，以免后续实体边界修复覆盖证据来源；当前资格仍只由正式台账管理。

## 尚不能从本文推出的结论

本文不批准 20 世界美术、不判定 90 趟自然经济、不保证熟练／新玩家收益、不替代敌人警觉后的实际脱追验证，也不宣称所有硬件 60 FPS。最初的 36 受控配装与 90 连续自然行程、实景质量、最终浏览器入口性能／异常分支分别记录；最终台账由根任务综合这些证据裁决。


## 最后初始化调度回归

[真实帧围栏报告](artifacts/r100-i06/entry-frame-fence/report.md)记录后续最窄调度修复：建场、完整零时长画面/首次存档、POST_RENDER后交控分开。冷续真实运动与挥击状态逐字段保持；提前页面离开、早暂停、按住键、创建中途故障和原记录续局通过。它不改变生成、像素算法、敌人或收益。

同一重档案例的入场长任务由88ms降到51ms，冻结复测61ms；两次冷续没有≥50ms任务。首玩法帧不再叠在建场中，但剩余创建工作尚未证明全库符合50ms，P01继续保留范围限制。最终源还含精细身体边界修复，最终资格收据及旧证据适用范围见后续不可变依赖映射；此处不将新的收据冒充重跑2400/480或自然行程。

## 当前最终运行版本与不可变绑定

最终源码固定于 `3074`，详情见[运行版本收口报告](artifacts/r100-i06/final-runtime/report.md)；台账可绑定 [20 世界／三档的 284 项依赖收据](artifacts/r100-i06/final-runtime/packages/index.json)，逐世界旧→新 SHA 与证据继承范围见[依赖影响](artifacts/r100-i06/final-runtime/dependency-impact.json)。原 279 项收据另有逐字重建归档，不再指向可变编译输出。

精细身体修复新增真实 20px 支持与技能落脚检查。针对实测旧 catalog dash `(-6,-6)` 保存，采用缺版本标记、已付费且仍活跃、锁输入、精确插值及合法完整身体的窄迁移，只复制修正身体位置；旧保存字节到首个完整 checkpoint 前不改。实际旧档正式 Continue、同帧新 dash 保存、两阶段直接 DESTROY、27 组恢复、36 RGBA／54 Host 等价及 23 项生命周期均有独立证据。未声称已覆盖旧技能结束帧或 expand 错位。

72 个旧生成输入中一处只有类型接口新增；完整资格执行器重新编译后 948325 字节与原 `9242daae…cb` 全等。因此 2400＋480 有可复核的生成执行等价证据，绝非把旧运行记录重标为最终代码重跑。最终运行中玩家贴边行为已有变化，原自然旅程与美术样本的局限仍按收口报告保留。

最终收据绑定后又在同一 `3074` 冻结源完成[全库正式入口／冷续重跑](artifacts/r100-i06/final-runtime/formal-entry/summary.json)：20 世界×三档，60 次入口＋60 次冷续全部通过，0 失败、0 替补抽取；当前身体版本、身体位置和身份严格保持。[逐世界正式接入证据字段](artifacts/r100-i06/final-runtime/formal-entry/evidence-bindings.json)明确绑定最终 284 依赖 SHA，而非将旧运行证据改绑。并发环境性能读数不替代 P01 单独测量。
