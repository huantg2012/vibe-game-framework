---
status: FUNCTIONAL-AND-BROWSER-WORKER-PASS-PERFORMANCE-AND-CROSS-RUNTIME-OPEN
date: 2026-10-03
feature: COH-F052 / COH-F049
iteration: R100-I02-engineering-prerequisite
---

# Rift 异步准备与正式入口 QA

本批的**取消、失败保留、冷续局与身份一致性通过所列自动检查和五项隔离浏览器检查**。纯地图生成已在 Worker 执行，所测两次成功生成窗口持续绘帧且没有主线程长任务。**完整入场性能仍未通过验收**：窗口之外仍有首次加载388ms、新Rift建场302ms、冷续局建场242ms长任务，未重新测量自然出击总体p95。不能将“使用Worker”写成R100性能门全部关闭。

**生产Worker补验完成，范围必须分清。** 同一Chromium运行时中，历史同步执行器、DEV Worker与生产bundle Worker的五个固定世界（3份v2、2份无generation）完整生成结果一致，10次全新Worker按浏览器原身份冷重建通过；4份v1金样也通过生产Worker。独立烟测另发现既有的**跨Node/Chromium浮点差异 R100-P05**，三个v2的全量金样并不跨运行时相同，其中一份身份签名不同。本批没有修改冻结算法、签名或金样来消除差异，跨运行时兼容仍未通过。

规格依据：[地图生成的可取消正式入口合同](../specs/system-map-generation.md#r100-工程前置可取消生成与正式入场2026-10-03)、[统一库存的死亡/撤离/恢复合同](../specs/system-field-inventory.md#7-死亡撤离与中断恢复)、[I01生命周期及生成预算](../tasks/rift-r100-i01.md)。实现提交 `ae5ae3ef1d600040ab4a7d4f8da0c09ff535fd28`；浏览器采集于该提交前的同一源码集，记录中的baseRevision为`da653887`，以[最终源码指纹](artifacts/rift-r100-i02-validation/implementation-hashes.json)绑定，不能仅凭旧HEAD号推断运行源码。

## 工程验证

[完整恢复日志](artifacts/rift-r100-i02-validation/recovery.log)所对应的`npm run check:rift-recovery`共24个检查脚本退出0；[完整构建日志](artifacts/rift-r100-i02-validation/build.log)对应`npm run build`成功。构建仍有既存bundle大于500kB警告（主共享包约4.53MB，gzip约1.26MB），本批没有解决加载体积。

本轮相关的实际检查包括：

- Worker预先取消、运行中取消、过期/晚回消息、超时、worker/message/clone/post错误，以及成功后的监听、计时器与线程回收；4份v1与5份完整世界gold身份通过真实独立worker重建，12/12 worker结束后释放，生成执行器无Phaser或存档依赖。
- 新出击只冻结一次种子/配方；重复确认不增开worker。取消发生在`beginRun`之前，保存失败后重试保持同一事务及身份，不重新抽选。
- 冷续局取消、重复确认、失焦、SHUTDOWN、直接DESTROY保持记录和live状态；旧线程返回不能触发建场。直接销毁后的异步收尾不恢复已失效的ScenePlugin，等待DOM和生命周期监听移除。
- 保存内容在等待期间改变时，最终同步快照复核拒绝准入；准备完成不能绕过该复核。失败保留记录并解锁重试，坏身份只保留显式救援选项，不能自动放弃出击或用新世界覆盖旧世界。
- prepared-only作用域拒绝未准备/外来身份，不回落主线程生成。旧v1、v2、无generation身份与完整恢复/结算回归保持原合同。

日志中的`Injected generation failure`等堆栈属于测试主动注入的负向样本，对应检查明确PASS；不是被隐去的运行错误。这些脚本验证确定的状态事务及生命周期，不代替自然导航、实际整局搜撤或多浏览器试玩。

## 隔离浏览器的真实入口

[浏览器总记录](artifacts/rift-r100-i02-validation/async-entry-verified/report.json)来自独立空存档浏览器、3044端口，运行生产调用链的DEV构建。保留真实标题页、等待界面、取消、暂停与继续操作；进入备行时调用已有场景的裂隙交互方法，**未验证从净化点自然走到裂隙的导航和补给体验**。记录变化负向样本只修改隔离浏览器的存档；用户存档未参与。浏览器及控制台错误均0。

五项检查通过：

1. 出击准备期间取消，净化点和精确存档字节保持不变。见[可取消出击](artifacts/rift-r100-i02-validation/async-entry-verified/01-cancellable-departure.jpg)。
2. 后台准备完成后进入真实已保存Rift，可正常暂停。见[入场与暂停](artifacts/rift-r100-i02-validation/async-entry-verified/02-rift-paused.jpg)。
3. 重新加载页面后，在冷恢复准备期间取消，仍保持冷首页点击载入前的精确检查点字节。见[可取消续局](artifacts/rift-r100-i02-validation/async-entry-verified/03-cancellable-continue.jpg)。
4. 等待期间记录被替换，系统拒绝进入Rift，也不回写旧字节。见[记录变化提示](artifacts/rift-r100-i02-validation/async-entry-verified/04-record-changed.jpg)。
5. 再从原记录成功继续，run、世界签名、角色位置与生命值一致。见[恢复实景](artifacts/rift-r100-i02-validation/async-entry-verified/05-recovered.jpg)。

实际图中的等待提示沿用净化点暗场、既有菜单字级和F标题图，未增加一套独立面板皮肤；取消提示与所测实际键盘操作一致。该观察确认本次等待状态没有脱离原场景，不能扩写为全部UI屏幕、人类审美认可或所有U1–U12条目的新验收。

## 生产产物与运行时等价复核

[独立浏览器等价记录](artifacts/rift-r100-i02-validation/async-review/browser-worker-equivalence-report.json)绑定实际生产Worker的SHA256，在Chromium154.0.8037.93比较旧同步冻结执行器、DEV模块Worker与Vite生产Worker：v2 requestedSeed 0、5、70421及无版本432889249、17的layout、tileMap、Host、sample、metadata与identity严格一致（无对应字段的旧版本按其原结构）。共享layout引用保持；每份世界分别由全新DEV/生产Worker按浏览器身份恢复，共10次冷重建，线程均回收，页面及控制台错误0。受保护的冻结执行器、算法及fixture文件未变。此前[生产烟测](artifacts/rift-r100-i02-validation/async-review/production-worker-report.json)中四份v1也已分别通过生产Worker。

该结果关闭本轮“从浏览器同步生成迁移到浏览器Worker/打包Worker是否改变世界”的疑问，不授予全部运行时互换资格，也不是整个生产网站端到端自然试玩。

**R100-P05保留：** 原生产烟测将Node产出的v2金样带入Chromium时，旧身份`23e24a0c`被拒绝。逐字段[诊断](artifacts/rift-r100-i02-validation/async-review/production-worker-diagnosis.json)发现敌人朝向与形成角的`Math.atan2`结果在末位浮点上不同，进而导致浏览器身份`9ef02d95`。相同Chromium的DEV与生产结果完全一致，进一步同步执行器对照也一致，因此不是本次Worker迁移或minify引入的差异。另两份v2的sample全量hash也与Node不同，虽身份签名相同，仍不能称全量金样跨运行时一致。原失败记录保留，按既有兼容缺陷登记；没有放宽身份校验或重写旧金样取得通过。需要独立的版本兼容策略及复验。

等价脚本中的各阶段计时只用来描述此次执行，不是固定负载性能基准，不能与上节单请求或I01自然p95混合取优。

## 时间与长任务必须分开解读

成功的新出击：Worker生成 **225.8ms**；请求总历时 **246.2ms**，主线程hydrate **0.3ms**、身份verify **0.5ms**。该worker生命周期窗口内主线程长任务 **0**，实际绘帧 **15**。此前取消的worker窗口也有10帧、0长任务。

成功的冷续局：Worker生成 **234.6ms**；请求总历时 **254.2ms**，hydrate **0.3ms**、verify **0.2ms**。该worker生命周期窗口内主线程长任务 **0**，实际绘帧 **15**。此前取消的worker窗口有8帧、0长任务。

两次成功请求缓存登记计时均为0ms（计时分辨率内），不能推导成本为零。以上是单设备、两次成功请求的功能复测，不是自然worldpkg样本总体分布；测试期间并行发生构建/恢复检查，不能用于算法间性能排名或作自然p95基线。

**保留问题：** 记录中worker完成之外的新Rift建场长任务为302ms、冷续局建场为242ms，初始加载另有388ms。已观测到入场阶段仍会阻塞；仅凭LongTask条目不能把全部耗时归因到某个具体函数。须对状态准入、Host构造、表面预烤及首次建场继续分段测量。I01的新增主线程连续任务≤50ms与自然p95≤5秒目标尚无完整通过证据，既有8.31/8.33秒自然p95结果继续有效，不用本批225.8/234.6ms替换。

## 尝试记录与证据边界

早先的[async-entry-frozen失败记录](artifacts/rift-r100-i02-validation/async-entry-frozen/report.json)保留。其冷取消断言错误地拿`pagehide`保存之前的旧sequence作为基准，导致把正常页面离开产生的检查点更新归到“载入取消”。有效复测改为**冷首页开始载入之前**读取精确存档字节，再验证取消后不变；不是删除失败记录或改变生产合同来取得通过。其他先行尝试也留在各自目录，不混入成功样本。

I02材料的[受控GC限定通过与真实音画证据](rift-r100-i02.md#本次补证内存与实际音画2026-10-03)是另一条验收链。GC记录绑定其实际加载的304个模块和源指纹（其中RiftScene早于本批最终异步接线），不能冒充`ae5ae3ef`所有模块一致或正式出击/冷恢复全链无泄漏。三份音画仍待实际审听。本批不新增合格世界数，不签三级玩法，不替代I02用户美术终审。

后续优先定位并拆分入场长任务，再在固定环境重跑自然出击/冷续局分布；完整异步路径的长时进退与受控GC需要独立补验。取消与精确记录保护合同继续作为不可退化回归门。
