# R100 I03–I06 技术验收记录

更新：2026-10-04。对应 COH-F005／F007／F008／F011／F012／F013／F052。

本记录覆盖已启用的 20 个原生世界、每世界低／中／重 3 档的生成、内容准入、恢复及表现准备。**技术通过不等于美术、自然供给或四迭代全部通过。** 正式资格仍由现有 R100 台账登记；本文不另建状态账。

## 追加整改的验证范围（2026-10-04，进行中）

用户要求继续处理四轮未完成／未通过项并推进完成。本轮已以显式生成修订 3 处理重度奖励分布和压实脊廊入口，修订 1／2 的在途记录保留独立执行器；以下修订 2 的最终记录均是历史基线，不改标签冒充新一轮复跑。成长入口、分段建场、历史浮点执行和声部管理的结果随各专项实测归档。

P02 本次补两种独立 GPU 证据：Chrome GPU 进程真实 allocator dump，以及真实 WebGL 定时查询。前者不是 JavaScript heap，后者不是 CPU 提交耗时。仍不把 allocator 后备字节称为独占物理显存，也不以软件后端冒充第二台物理设备。I01 冻结合同明确另一档较弱硬件属于 I14 发布前置，四轮内部完成不能把它改成已验证。

采集工具：`tools/qa/check-r100-gpu-allocations.mjs`、`tools/qa/check-r100-gpu-timing.mjs`。修订3的最终实测归本节末；以下诊断保留采集方法的纠错过程：

- [第一次 r2 allocator 诊断](artifacts/r100-i03-i06-completion/gpu-probe-r2/report.json)保留失败。原断言错误地把整个浏览器 GPU 进程都算作游戏同世界保留量；混合重建后增长约 23 MiB，不能直接判成游戏泄漏。
- [分类后的 r2 诊断](artifacts/r100-i03-i06-completion/gpu-classified-r2/report.json)和逐样本原始 dump 显示，这次增长来自仅供显示扫描／光栅的 compositor tile cache，以及对应 ANGLE 后备；原生 WebGL／Canvas 共享图像子集回到相同 **29.752 MiB**。此子集不包含全部私有 ANGLE 分配，因此不能把它写成整游戏显存。分类按实际 mailbox usage，未相加重复记录的 allocator 分支。
- 短 GPU 探针先暴露 Phaser 使用 WebGL1、材料使用 WebGL2 的区别，已改成分别使用对应查询扩展。旧失败保留；[修正后真实 436 帧](artifacts/r100-i03-i06-completion/gpu-timing-probe-v2-r2/report.json)中材料 GPU p95 约 0.421ms，Phaser 约 0.314ms。两上下文分开报告，不相加成屏幕帧耗时。这个约 7 秒片段不是 60 秒完整负载验收。

统计含义参照 [Chromium GPU memory-infra](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/memory-infra/probe-gpu.md) 与 [CDP Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/)。原始 trace 压缩保存，保留进程身份、allocator 属性和共享图像用途，避免只留手填结论。


### 修订3本机GPU实测

[最终资源报告](artifacts/r100-i03-i06-completion/gpu-allocations-final/report.json)来自3086冻结源、M4 Pro的真实Metal后端。六族预热后10次同世界重建、12次混合再返回，两次实际GC：JS heap加backing增加 **1.275 MiB**，WebGL/Canvas共享图像子项 **27.420→27.395 MiB**。GPU进程总分配 **477.433→499.192 MiB**；其中ANGLE、共享图像、Dawn和transfer均有变化，不能把21.759 MiB笼统说成纯光栅缓存，也不能凭共享子项宣称所有私有GPU内存绝无泄漏。原始allocator dump保留；为核实该增量是否继续累积，另重复同一混合序列测后续返回点，结果单列。

[三轮相同混合序列复核](artifacts/r100-i03-i06-completion/gpu-repeated-mixed-final/report.json)保留独立新浏览器：六族预热、10同世界、连续三轮各12混合并返原世界。三次GPU总量依次497.874／513.129／495.915 MiB，没有逐轮单调累积；ANGLE 314.516／315.734／314.594 MiB，transfer 43.797／56.609／41.672 MiB；WebGL/Canvas子项三次均29.739 MiB。样本支持该有界重建过程没有持续增长，不能推出任意私有驱动分配或无限长会话绝无泄漏。该补测与其他行为测试并行，故只作隔离浏览器资源分配证据，不使用其帧耗时。


[最终实际GPU计时](artifacts/r100-i03-i06-completion/gpu-timing-final/report.json)逐族重污染在入口附近做真实短距离WASD往返，六段各约65.6秒，HP/压力/敌人/危险/像素尺寸都正常；不是深处战斗负载。每段约3935–3937个活跃帧，暂停/结果帧不入样本。帧间隔p95 **18.2–18.4ms**、p99 **18.6–18.7ms**，没有>50ms帧；仪器自身开销存在，不冒充无插桩的全玩法帧基准。

真实时间查询分别包住材料WebGL2 draw与Phaser WebGL1 render：材料GPU p95 **0.894–1.791ms**，PhaserGPU p95 **1.050–3.556ms**，无disjoint或跳采；两上下文不可相加当屏幕耗时。`cpu`是引擎prestep到poststep区间，p95 **5.4–7.4ms**，不声称含所有绘制的整帧CPU。旧材料提交CPU记录只按未变绘制代码继承，当前GPU耗时不会被充当那个指标。此结果支持本轮参考机材料/入口范围；另一档物理设备及I14整体长尾仍须真实验证。

## 前批修订 2：最终版本与逐世界绑定

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

## 前批修订 2 运行版本与不可变绑定

最终源码固定于 `3074`，详情见[运行版本收口报告](artifacts/r100-i06/final-runtime/report.md)；台账可绑定 [20 世界／三档的 284 项依赖收据](artifacts/r100-i06/final-runtime/packages/index.json)，逐世界旧→新 SHA 与证据继承范围见[依赖影响](artifacts/r100-i06/final-runtime/dependency-impact.json)。原 279 项收据另有逐字重建归档，不再指向可变编译输出。

精细身体修复新增真实 20px 支持与技能落脚检查。针对实测旧 catalog dash `(-6,-6)` 保存，采用缺版本标记、已付费且仍活跃、锁输入、精确插值及合法完整身体的窄迁移，只复制修正身体位置；旧保存字节到首个完整 checkpoint 前不改。实际旧档正式 Continue、同帧新 dash 保存、两阶段直接 DESTROY、27 组恢复、36 RGBA／54 Host 等价及 23 项生命周期均有独立证据。未声称已覆盖旧技能结束帧或 expand 错位。

72 个旧生成输入中一处只有类型接口新增；完整资格执行器重新编译后 948325 字节与原 `9242daae…cb` 全等。因此 2400＋480 有可复核的生成执行等价证据，绝非把旧运行记录重标为最终代码重跑。最终运行中玩家贴边行为已有变化，原自然旅程与美术样本的局限仍按收口报告保留。

最终收据绑定后又在同一 `3074` 冻结源完成[全库正式入口／冷续重跑](artifacts/r100-i06/final-runtime/formal-entry/summary.json)：20 世界×三档，60 次入口＋60 次冷续全部通过，0 失败、0 替补抽取；当前身体版本、身体位置和身份严格保持。[逐世界正式接入证据字段](artifacts/r100-i06/final-runtime/formal-entry/evidence-bindings.json)明确绑定最终 284 依赖 SHA，而非将旧运行证据改绑。并发环境性能读数不替代 P01 单独测量。

## 修订 3 补验：P01 分段建场与 P05 旧算术（2026-10-04）

本节只登记新补验，不改前批记录的修订或通过范围。最终生产源为 [3086 冻结清单](artifacts/r100-i03-i06-completion/final-source/source-snapshot.json)，包含重度内容定义 v2、成长入口、压实脊廊新入口、最终音频以及以下技术修复。原 r1/r2 的完整生成器从提交 a089bf7 独立封存为 50 依赖、零可变 import 的闭包；原执行器 SHA-256 为 `bc5117ae07ff61565a1076b466ed1addf14b67691573a6acefe9fb47af1af06f`，60 条实际 r2 身份和完整世界对照继续通过。

### P01 实施及生命周期

先前已把几何、材料及 Host 表面移至 Worker，但同步建场、首帧 AI/Host/保存仍可能落在同一主线程任务。现在以 `RiftStagedEntry` 保持同一构造器的依赖顺序，在明确阶段之间交还浏览器真实绘制机会，再推进下一任务；没有调整像素尺寸、输入速度或模拟时钟。构造期间 Scene Time/Arcade 暂停，camera 不显示半成品，普通更新和保存不运行；最后一段结束后才重新标定首帧围栏，下一完整零时间画面持久化并经过 POST_RENDER 后交控。

- [真实首帧及冷续](artifacts/r100-p01/final-frame-fence/report.json)：最早构造阶段 pagehide、提前 Esc、持续按键、冷档速度/输入/攻击/AI/物理余量，首个完整检查点与保存状态精确相符。
- [直接销毁](artifacts/r100-p01/final-direct-destroy/report.json)：第一段构造和完整首画面尚未交控两处，使用真实 SceneManager.remove；未消费 GPU、准备对象、listener 和待执行段清理，原存档不被部分状态覆盖。
- [实际旧 dash 冷续](artifacts/r100-p01/staged-legacy-dash/report.json)：实际旧字节保留到完整保存，只有已批准的身体坐标/标记迁移，没有重复扣次数。
- Gym 原先把 CREATE 当成场景就绪，分段后会在 chaos 构造前读取 getValue。该真实兼容问题已修成等待完整画面并交控后再启用操作；最终候选入口与现有生命周期共用正式实现。
- 最初阶段测量发现“最后一段与首画面同帧”，[失败原记录](artifacts/r100-p01/staged-diagnostic/lifecycle/report.json)保留；finishConstruction 修正后最后建场帧与首画面帧分开。不得仅以异步函数存在宣称性能通过。

最终 20×3 串行主线程预算仍以本次正式入口报告为准；早期单例无长任务只是诊断，不自动替代完整矩阵。

### P05 严格的历史数学执行

旧 Node 22.14/V8 12.4 ARM64 与当前 Chrome 154 对 `atan2(-1,7)` 的最后一位不同；方向值进入旧 v2 世界签名后，完整恢复会被正确的严格校验拒绝。没有把比较改为浮点容差。

恢复先执行原封存算法；若完整身份不匹配，仅 v2 可再尝试两个显式历史 V8 fdlibm 算术配置：普通 binary64 运算和 ARM64 FMA。每次均重跑完整封存世界，只有原 world/layout/seed/recipe/signature/generation 全部精确相符才接受。适配器只替换封存文件中 14 个 atan2 调用点的词法函数参数，原文件 SHA 不变，没有全局 Math 修改。有限精度 FMA 用误差区间确定结果，不确定时转精确整数运算并按 ties-to-even 舍入；没有枚举附近角度来猜签名。

- [历史机器及实际 FMADD 汇编](artifacts/r100-p05/arithmetic-source/)：保留实际 Node/V8/ARM64 身份与原 atan 指令；Sun 与 V8 BSD 许可随代码保存。
- CPU：100000 组快速/精确 FMA 对照，±0、±Infinity、NaN、次正规数，66049 个实际旧 Node ARM64 atan2 格点。另对原生数学函数失败的完整生成兜底、原输入/全局函数不变和五种身份/配方篡改逐项拒绝。
- [最终 Chrome Worker](artifacts/r100-p05/final-browser/report.json)：三条真正旧 Node v2 生成身份，原 layout/敌人朝向/tile/Host/metadata 与历史金样完全一致，篡改签名拒绝。V1 与无 generation 旧档保持原分支；现有跨进程旧完整世界金样继续通过。
- [受控完整 v2 存档继续](artifacts/r100-p05/controlled-continue-final/report.json)：用真正旧 Node 生成身份进行一次正式原子出发，真实运行生成存档，再将原字节装入新浏览器上下文点击 Continue；恢复瞬间的全部 runtime 状态、时钟、身份及库存逐字段相等。**该 runtime 是本轮受控生成，不冒称历史玩家在途存档。**

已知范围：旧存档身份未包含材料 sample 的所有角度。两个金样在原生 Chrome 的未入签名材料 sample SHA 与旧 Node 不同；已定位样本 v2-5 只有 `sample.formations.3.angle` 差 `1.1102230246251565e-16`，其余字段相等。[原始比较](artifacts/r100-p05/browser-full-world/unhashed-sample-differences.json)与先行全 sample 断言失败保留。本修复关闭已证实的严格身份恢复阻断，不宣称所有未持久化材料浮点字节跨数学引擎一致，也不支持任意未知的未来算术。

测试工具失败另有三类，均已保留原报告：误读 layout.enemies（应为 enemySpawns）；把 legacy 暂停安排在 Scene 仍 CREATING 的阶段；试图用 pagehide 前字节当成 pagehide 最终 flush 后的字节。最终工具在实际恢复瞬间只读捕获，再在真实 POST_RENDER 发起正常暂停，受控 fixture 原字节在独立上下文载入。没有通过改业务存档或跳过校验去迎合断言。

### 修订 3 重新生成资格

[固定主矩阵](artifacts/r100-i03-i06-completion/revision3/qualification/report.json)：20 世界×3 档×40 种子，**2400／2400 通过、0 失败**；2377 一次、22 两次、1 三次，没有第四次或更多候选。全部完成真实 Host、完整身体、搜取窗口、transfer 脱离与冷重构检查。该版本包括重度两堆各 6 的新预算以及压实脊廊入口几何，未继承旧 r2 生成结果。

[新独立保留种子](artifacts/r100-i03-i06-completion/revision3/holdout/report.json)：另 **480／480 通过、0 失败**；465 一次、13 两次、2 三次。QA 先提交 [SHA 承诺](artifacts/r100-i03-i06-completion/revision3/holdout/commitment.json)，执行器冻结后才揭示八个 uint32；本批还排除了过去已揭示的两批种子。两矩阵实际执行器同为 `6e9bbe6622e6393b837d8f6d8044e2ab3ff860271938ed8ae69fe9a62f20cd81`，原始字节和每例记录均保留。并发 CPU 检查的时长不用于正式入场性能结论。

[最终跨引擎复测](artifacts/r100-i03-i06-completion/revision3/browser-equivalence.json)：在该冻结源实际重新执行 **78／78 通过**；60 个当前修订 3 的 Node 身份在 Chrome 154 逐字段相同，另 18 个原 Chromium 修订 1 身份精确复算。原修订 1 的已知 Node 差异仍按历史范围保留，没有套用新量化规则或宽松比较。此轮不是旧修订 2 报告改名。

### P01 最终串行实测与本机结论

[测量汇总](artifacts/r100-i03-i06-completion/entry-performance-summary.json)绑定上述 3086 源快照，SHA-256 为 `5ab4935e92e4f8ce702c17e2706200fff541846bfe54d8ad17eebf48f52853ec`。测量前停止其他任务的测试浏览器和重 CPU 作业，使用一个真实 Chrome 浏览器逐格执行；源文件复核放在测量之后，普通截图与 CPU profiler 不在测量区间内运行。没有冻结生命、敌人或游戏时间，也没有降低分辨率。

[全库实际入口／冷续](artifacts/r100-i03-i06-completion/serial-entry/report.json)：**60 次正式新出发＋60 次实际冷 Continue 全通过**，没有替补种子。所有当前身体版本、恢复坐标和世界身份严格保持。120 次测量均未出现 **≥50ms 的 Long Task 事件**；这表示阈值内无事件，不表示 CPU 耗时为零。60 次新出发从命令开始至完整就绪的等待包含正常过渡、准备和轮询，p50 **1816ms**、p95 **1965ms**、最大 **1990ms**，低于 5 秒等待预算。

上述无长任务区间是**备行出发与点击 Continue 后的 Rift 恢复**。页面 reload 到标题菜单的基础启动仍有长任务，原 `cases[].coldReloadLongTasks` 完整保留 120 条、最长 **117ms**；`cases[].restoreLongTasks` 才是 Continue 操作后的恢复区间。没有将整个网页启动宣称为零长任务，也没有在未做专门归因时将这些基础启动事件都归给某个库。此成本保留为本报告已知限制，不扩大成本轮整页加载重构。

原全库工具未记录冷续总等待，因此没有事后推算全 60 格的冷续 p95。按已批准的补验范围，[六材料族重档抽样](artifacts/r100-i03-i06-completion/entry-phase-samples/report.json)各执行一次新出发及冷续，直接只读计时真实 `generator.next`、零时间 POST_UPDATE 和实际 POST_RENDER 交控：新出发等待最大 **1868ms**，冷续等待中位数 **927.9ms**、最大 **1021.9ms**；108 个阶段的 CPU 时间 p95 **22ms**、最大 **26.7ms**。两方向都没有长任务。

据此 P01 在**本轮参考机器／浏览器与上述样本范围内通过**：原建场长任务有真实代码修复与全库阈值复测，等待也有全库新出发及六族冷续诊断。它不代替 GPU 帧时间、长时间内存、I14 弱硬件测试，也不将六个冷续等待样本扩大成全库或所有未来设备的保证。

### 当前不可变依赖与正式接入绑定

[最终修订 3 的 20 包收据](artifacts/r100-i03-i06-completion/final-packages/index.json)独立生成，每世界均含三档与 **288 项实际运行依赖**，`algorithm.revision=3`。本次原地代码与冻结源逐文件 SHA 复核一致；旧 279／281／284 依赖的历史文件未覆盖、未把旧运行结果重标成修订 3。收据只是版本身份，审批仍由既有 R100 台账维护。

本次可绑定的正式接入证据是上述 60 格实际新出发和冷续，不是只用 Worker／CPU 资格推断玩家入口。生成、视觉、自然经济、音频、GPU 与跨引擎各按自己的实际执行版本和范围登记。

[逐世界正式证据字段](artifacts/r100-i03-i06-completion/evidence-bindings.json)已校验 20 个收据 SHA、每世界三格成功与真实冷续，再提供 `runtime / production-integration / production-entry + recovery` 绑定；该文件不自行修改台账或批准美术、经济。

### 独立收口审查

[只读审查记录](artifacts/r100-i03-i06-completion/independent-review.json)复核 GPU 工具及 P13 机制／真实行程政策，未发现新的生产阻断。GPU 为实际异步时间查询，两个 context 的分位数不相加；`cpu` 字段截止 Phaser POST_STEP，不能冒充包含 Phaser render 提交的全部 CPU 帧。GPU 总量、共享 WebGL 后备及 JS 内存是不同范围；混合重建后的总增量还含 ANGLE／传输分配，不能统称为 compositor 缓存。最终资源结论由后续有限重复 dump 另证。

P13 逐堆整数结算和未购项价格与 CSV 一致，原身份仍隔离。自然准备使用公开物件信息和真实支付；宏观全图路线、两新档加一成熟分叉、不同政策阶段必须继续披露，不能当作三个独立新玩家或保证收益。

另只读审查余烬脊中污染 117.7 秒死亡样本：出发武器仅 2／60 耐久、两个同类停敌工具，仓库声诱未换入；455 次观察／97 次规划／501 段移动中没有真正按 E 搜取。42.9 秒远区接近放弃后仍继续寻找目标，最终回程死亡。它证明这份准备和行动失败，未证明地图存在永久守点、不可通行或运行时缺陷；**保留失败且不能记为搜撤通过**。下一份有边界的既定验证等待实际挣得的可用武器与公开准备，不因这个样本修改生产地图。
