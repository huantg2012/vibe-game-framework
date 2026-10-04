# 正式入场长任务：最终冻结版 CPU 归因

2026-10-04。目标是区分 R100 新增生成／表面预烤与既有 Phaser 场景启动，**不是把所有超过 50ms 的启动统一判成同一类问题**。本次仅新增观察工具和证据，未改生产代码、几何、收益或运行中的自然旅程。

## 结论

大块地表、体积法线、静态受光预烤已经离开主线程；没有发现正式入口退回同步原生表面烘焙。现在 143–157ms 的新入场长任务仍有一项应修的可避免成本：**首帧保存准入重新计算 Host manifest，重复完整烘焙了已有后台结果的占漆污染体，约 39ms 烘焙／42ms 整段准入清单计算。** 这不是 Phaser 初始化，不能统称基础启动成本。

其余主要来自场景创建和首帧组合：角色／Host 贴图挂载、来源匹配的搜取物绘制、真实视野、第一帧活体污染绘画以及角色遮蔽。单个新增地表／光照大循环不再占据百毫秒。即使先去掉重复烤，也不能许诺整个入场立即低于 50ms；两者是不同门槛。

建议先消除这份重复准入烘焙，保持当前真正的身份和存档校验。暂不拆分整个 Phaser 生命周期，也不降低贴图分辨率、关闭首帧验证或减少污染体。

## 样本与方法

使用根任务最终冻结服务器 `http://127.0.0.1:3065/`，独立新存档。通过原菜单进入净化点，正常打开准备界面、选择重污染、实际确认出发、暂停、冷刷新和继续。为了覆盖指定世界，只在出发前指定一次随机种子；不修改运行态、资源、血量、角色位置或模拟时钟，不算自然经济旅程。

- [原始集成报告](report.json)：纤维沉积与灰层两个重档，实际入场长任务分别 149／143ms，恢复场景长任务 63／60ms。均正常保存、冷恢复，身份和位置不变，无页面错误。报告保留所有实际响应源／材质 SHA-256。
- [纤维沉积 CPU](fibre-silt-severe-entry.cpuprofile)、[灰层 CPU](ash-strata-severe-entry.cpuprofile)：场景 createRun 采样各约 56.8／56.6ms；Host manifest 各约 41.5／42.1ms，其中 bakePaintGenome 各约 38.9／39.4ms。
- 为避免将第一帧之外的累计 CPU 错算进入场，再重复一个纤维沉积重档，新增 [时钟对齐报告](aligned/report.json)、[入场 CPU](aligned/entry.cpuprofile)、[冷恢复 CPU](aligned/restore.cpuprofile)。CDP 单调 Timestamp 与页面 performance.now 使用前后读取夹定，误差上界分别 0.5／0.3ms；将采样区间裁到浏览器真正上报的长任务。
- [对齐后的逐项结果](aligned/attribution.json)：采样本身仍有约 1–2ms 误差和性能测量开销；以下不是精确到小数的生产 SLA。互斥行可相加；文件里的 inclusive 调用树不能相加。

对齐样本入场长任务 **157ms**：

| 互斥归因 | 采样 ms | 含义 |
| --- | ---: | --- |
| 首帧 checkpoint → Host manifest | 42.3 | 其中完整重复 bakePaintGenome 39.1 |
| createRun：实体贴图挂载 | 16.5 | 敌人绘制、占漆／占空表现注册，已不含 Host 全烤 |
| createRun：搜取物来源像素 | 9.5 | 实际来源模型和纹理上传 |
| createRun：来源区域 BFS | 6.6 | 污染物掉落来源区域，非原生地表光照 |
| createRun：原生表现 setup | 6.3 | 小型 sourceCells 遍历、纹理／遮蔽注册 |
| createRun：其余场景 setup | 20.8 | 玩家、系统、HUD、保存对象等组合 |
| 首帧敌人／Host 活体绘制 | 13.6 | 动态绘画，不是静态地表重烤 |
| 首帧视野与小地图 | 8.3 | 原有真实光照／视野逻辑 |
| 首帧原生角色遮蔽 | 7.0 | 角色像素与实体高程的遮蔽 |
| 其余 checkpoint 工作 | 7.1 | 排除上述 manifest 后的保存步骤 |
| 其他场景更新／Phaser／浏览器／GC | 19.0 | 剩余互斥样本 |

主线程 profile 没有 `bakeMasterWorldSurface`、`bakeMasterSurface`、`MasterGroundSurface`、`NativeVolumeLighting` 或正式 world 生成函数样本；Worker 中仍正常执行这些工作。材质读取总约 62.5ms 分散在四张原子图的独立任务中；该准备阶段未上报超过 50ms 的任务。GPU 预上传约 7.5ms。不能把整份 2.8–3 秒 profile 的累计 live update 当作一次阻塞。

对齐样本冷恢复的 **67ms** 长任务：createRun 约 51.1ms，其中实体挂载 13.6ms、搜取物 6.9ms；随后第一帧活体绘制约 7.7ms。Host manifest 的 37.6ms 出现在更早的准备完成／恢复准入任务，未与场景创建拼到这一个长任务中。这解释了恢复通常显著低于首次出发，并不证明恢复不再重复算 Host。

首次页面加载的 120–124ms 长任务未由本组 profile 覆盖（采样开始于已有菜单后的出发／继续），不将它冒称为 R100 开销，也不据此宣称已证明是 Phaser。根任务的完整 60 格时间数据仍是总体范围依据；本组负责函数归因。

## 最小修复方向，尚未实施

1. 将 Host 准入清单计算抽成共享纯函数：输入真实 layout、Host floor map 和同身份准备的占漆 field，输出原顺序 targets／nucleusCounts。用第二 Worker 已有完整 bake 结果计算清单，或者在第一 Worker 完成生成后计算并随协议返回；不能从待恢复存档的自报 targets 建立“权威”清单。
2. 身份验证通过后，将清单绑定到当前唯一 layout 的 WeakMap；首帧及后续 validator 使用这一不可被存档影响的缓存。旧 v1／v2 和同步离线检查保留原精确 fallback，异步正式 v3 缺准备时仍失败关闭，禁止隐性同步重烤。
3. 对 targets 的顺序、占漆 nucleusCounts、独立递增 ding ID 做原函数逐字／逐项等价；覆盖取消、迟到、旧同键准备、热加载和冷恢复，保证清单不跨 seed／world 误用。新性能样本必须检查首帧 `bakePaintGenome` 消失，而不是仅观察平均时间降低。
4. 若需继续收紧，再考虑把来源区域 BFS 和污染发光 sourceCells 放入同身份准备缓存；它们当前分别约 6.6／数毫秒，优先级低于重复全烤。角色遮蔽与实时 Host 绘画属于每帧工作，不能靠“准备后永久冻结”消除。

不要为了实现通用“每个场景 create <50ms”而将事务提交与半初始化场景拆开；这会引入新的可见中间态和恢复风险。先消除新增路径重复计算，再由根任务按正确预算重新判定剩余启动与实时性能。

## 重现

- 两世界原样本：`GAME_URL=http://127.0.0.1:3065/ QA_WORLDS=fibre-silt,ash-strata QA_GRADES=severe QA_CPU_PROFILE=1 QA_OUTPUT_DIR=docs/qa/artifacts/r100-i06/entry-profile-final node tools/qa/check-r100-production-browser.mjs`
- 对齐样本：`GAME_URL=http://127.0.0.1:3065/ node tools/qa/profile-r100-entry-final.mjs`
- 无浏览器的纯归因重算：`node tools/qa/analyze-r100-entry-profile.mjs`

三个关键被采源文件的 SHA 与原两世界报告一致；未发生分析中热更。
