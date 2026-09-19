# 迭代27 · 成长兑现与归来结算

状态：领域实现与回归通过；完整入口/恢复组合由迭代27总验收汇总。未提交。

## 改动

- 生命强化经 CombatSystem.create 的真实最大生命进入开局、恢复校验及血量事件；0/1/2/4级分别100/115/130/160。恢复pure validator接收该上限，旧调用缺省100。
- 薪柴亲和明确先加每堆基数、再乘储藏倍率并取整；LootSearch配置与快照保存该值，旧快照缺省0。成长详情说明了倍率先后。
- `growth-purchases`为成长/加厚的持久购买边界。薪柴、成长/上限和稳定度共同保存，拒写全还原；成功事件在写入后发出。既有面板复用错误反馈，未引入新样式。读取过in-game-ux skill，保留培养藏场景与当前布局。
- 首出发先把cycle递增到1，故首归免冲击判定改为cycle≤1；第二趟起正常承压，跳过不供奉充能、仍推进潮汐。
- 稳定度维持已校准1/1/3/5/-1。场景在同一个账本归来事务调用recordReturn，撤离不要求薪柴大于0；正HP→0只扣一次；crestIntact保存整段峰值失败事实，Final无限峰不重复给奖励。
- Combat恢复解除悬海两敌/一靶限制，允许正式生成roster和Host核，保存已击中Host避免恢复后同挥重复伤害；按照实际身体配置校验敌人前摇/冷却。

## 检查

- `npm run typecheck`：成长主干通过；最终并行整合版本由root重跑。
- `tools/growth/check-growth-loop.ts`：根代理补齐测试引擎的textures.remove后全部通过。包含保存拒写/重试/事件、0/1/2/max真实生命与旧100上限、27个亲和×储藏×节点组合、首次/随后归来、模块归零、空袋撤离、完整峰/换潮、存档失败峰历史、重复返营/加载幂等。
- `check-impact-forecast.ts` 9项通过；`check-offering-families.ts` 10项通过。测试的冲击fixture明确设为第2趟，避免把已修复的教学豁免当退化。
- `npm run dev -- --host 127.0.0.1 --port 3017 --strictPort`：Vite启动成功（102ms）；浏览器实机整链由总验收负责。
- 仓库无独立lint脚本/配置；tsconfig strict/noUnused/noFallthrough是现有静态门，不冒称跑过不存在的lint。

## 兜底记录

新领域脚本连续两次测试桩失败（先i18n import前无localStorage、再真实Combat.destroy缺textures.remove），按规则停止自循环并升级root。root补桩后全过。没有降低或删除产品断言。

## 边界

旧档未保存过的峰值历史无法追溯；缺crestIntact时从当前归来模块情况建立事实。组件旧签名/保留的旧DEV调用仍缺省100/0；正式procedural出击必须带完整世界包，其maxHealth/kindlingAffinity须与保存的成长一致。旧active缺完整世界包不能续局，走明确放弃本趟、救回基地；不借缺省值伪造可恢复性。未将本域测试当整体美术/经济平衡验收。


## 追加：正式十三族工具与战斗恢复

根代理追加委派后，补齐`ToolRuntimeState.extended`及`tool-runtime-extended.ts`JSON边界；十三族均支持最后一次耗尽后独立效果恢复，包括Host延缓/抑制、镜像、旧姿态失视记忆、相变硬直、重影遭遇、眩晕、情报快照。旧五族无扩展字段继续可读。当前冷却余烬是combust，本实现未把它误归为退役。

- `check-current-tools.ts`：13族逐一真实消费最后一次、JSON序列化/恢复、源与时钟一致；恢复不重复扣次/位移/反向/广播/Host施放。伤害已破冻结不会重生；相变仍锁输入直到正确到期；旧五族兼容。Node只替代引擎图形，不当实玩证据。
- 旧`check-effects.ts` 14项通过；原solidify“不支持”断言更新为当前族支持、退役残留仍拒绝，未移除坏数据拒绝断言。
- `check-actors.ts`通过；`check-first-eight-tools.ts`与`check-next-five-tools.ts`通过。
- 真实Chrome `check-tool-body-echo-browser.mjs`通过既有显式atlas裁切/trim、透明support、原点比例、0次update重烤、清理，以及正常Q镜像/冻结、伤害解冻、失视记忆。新增JSON恢复同原像素断言已在真实Chrome通过：捕获后把源atlas改白，序列化恢复的三层pixelDigest仍等于原像素；不是恢复时重新截取当前角色。
- 追加后`npm run typecheck`通过，独立lint仍缺失，未写新视觉语言。新工具回归首次因测试桩调用不存在的EnemyControlState.exportRuntimeState失败，已改为读实际投影/源与真实beginRuntimeRestore/restoreInterruptRevision后通过。

- 收尾反例已补：镜像恰在到期帧接触进入消散时，允许已归零或负余时的真实快照；恢复旧快照覆盖当前相变时释放原有输入锁。两个反例通过。测试桩连续两次失败（缺Phaser.Math.Clamp、离散消散需要两帧而非单帧大delta）已上报root，由root补桩和100ms×2帧断言后check-current-tools全部通过，未降低生产行为断言。


## I27-G/K · 代表策略实机

范围：本节是正式 main / RiftScene 的条件验证，**不算自然供给、不算首玩导航、不算三流派平衡已通过**。本轮没有修改冻结的技能规则或数值。使用隔离 Chrome context、0级成长和原版普通撬棍；工具是通过真实物件工厂、供奉成熟、装配接口建立的预备存档。局内只通过键盘移动、Q、Space、按住E、撤离、R返营；没有瞬移、补血、补次数、强制敌人状态或篡改时钟。

路线读取了完整地形；最后一轮还按初始敌人位置规划绕行。它用于分离其他追兵干扰，不能冒充玩家从迷雾中自己发现路线。每步按键、位置、生命、资源、结算和画面保存在[策略证据目录](artifacts/iteration-27/strategies/)。随机样本与固定样本均保留，未删除失败来挑漂亮结果。

### 已证实的收益

1. **近战克制使用，成功。** `bare`，真实种子2042562272（shear-clinic）。先正常翻一堆得1薪柴，再接近、转向、挥击一次、后撤；ENM_INF_03生命75→49、撬棍60→59，玩家100。27.15秒撤离，带回1薪柴，生命100、峰值混乱87、0击杀。说明一次命中与后撤能服务于资源撤离，而不是强迫清场。参见`bare/observations.json`、`06-melee-retreat.png`、`07-return-attempt.png`和完整journey。
2. **冷烬压制后穿越与搜取，成功。** `combust`，真实种子231848363（hunks-metro）。Q次数3→2，ENM_BING_01获得真实5000ms抑制；4.51秒时玩家走过它的中心(656,528)，生命100，该穿越段混乱17.80→18.36，与背景增长相符。8.09秒完成附近按E翻找，得1薪柴、生命100。搜条尾端已经超过抑制窗口，不能称整个搜取一直受到保护。后续长途撤离受其他敌人攻击，最终31.96秒、生命55、1薪柴、峰值混乱101撤离，并带回优良撬棍。压制没有让整个世界安全。参见`combust/03-before.json`、`04-cast.json`、`05-cross-search.json`、`07-extract.png`与账本。

### 诱饵：行为证实，稳定安全搜取收益未通过

- `kindle-preemptive`（2691042921）：第三次投掷使巡逻甲从patrol进入suspicious，`isTargetingLure=true`，真实位置从(1001.22,621.74)移动至(1015.24,622.69)。技能确实能引导目标。随后操作沿投点与目标视线穿过去，目标重新确认玩家；搜取得2薪柴，但生命70→55，不能称安全获益。最后带2薪柴、生命10撤离。
- `kindle-side`（实际1038043786）：横向投掷后，争夺堆正常搜到2薪柴且生命100；但证据只捕获休眠改写体的`pendingNoiseIsLure`，它醒后受玩家移动影响转为chase，未证明无伤是诱离造成。此项明确不计诱饵收益通过。
- 最后一轮`kindle-fixed`使用2691042921的**真实原生departure fixture**：真实generateRiftLayout、identity、beginRun、cycle和单一保存事务，没有注入actor/AI。沿东、北外缘绕行后仍生命100、其他三敌patrol，再从目标上方操作。第一枚壳落在空洞边缘，直线约77px但声音过墙衰减，目标未响应；移动补投进入视线，第二投时它已chase。接近争夺堆按E被命中打断，生命100→85、薪柴仍0。它证实了操作失败边界，没有证实稳定收益。最后46.86秒生命70、0薪柴撤离并真实返营；持久账本status=settled、baseSettled=true、outcome=extract，稳定度从0增至1，另验证空袋撤离仍计奖。此后不再换新样本。

**确定结论：** 没有发现诱饵“不执行控制”的程序缺陷；普通巡逻甲的注意力转移已有真实证据。此前多数失败来自已经确认追逐、落点被空间空洞遮挡、或搜取路线穿过目标视线/带入其他追兵。与此同时，准确落点和过墙听域对玩家不够可判断，当前不能用这批测试宣称诱离搜取已形成与近战/压制同等稳健的策略。有限样本不能证明该策略根本不可用，也不能代替后续可用性验证。

### 由实测落地的修复与最小后续建议

- **已改共享说明**：`data/contaminants.csv`的kindle长/短说明明确适合尚未锁定玩家的敌人、不能使已确认追逐者忘记玩家；声音是最远96像素，听力与遮挡会缩短可听范围，不能理解为圈内一律听见；执行CSV→code生成，所有物件详情消费同一份说明。机制、范围、时长、次数均未改变。`npm run codegen`、`npm run typecheck`、`check-first-eight-tools.ts`通过。
- **后续最小体验建议**：在已有世界内反馈语言下，让玩家更容易判断实际落点及已知障碍的阻隔关系，并理解已经可见的追逐状态；不提示未见目标是否听到、不泄露迷雾。先做可读性核验，再决定是否需扩大范围或降低敌人听觉优先级；本轮不偷偷把诱饵改成清除追逐的技能。

### 失败样本与证据限制

- `kindle`（55979955）：已确认追逐后投壳，不转移目标，符合现行规则。走位仍搜到2薪柴。其后诊断脚本在go(no-path)后过快连按Esc，第二次落在按键保护期而未暂停，等待期间被连击100→25；这是记录器操作失误，不是平衡证据。之后生命10成功撤离。改进后的录制器显式检查paused。
- `kindle-safe`（1487022385）：靠近时已确认追逐，未消费工具；撤退脱战仍生命100。该尝试在暂停状态保存后结束，没有伪称完成撤离。
- `kindle-side`中一次前方没有合法落点，UI提示明确且次数没有扣除；后在暂停状态保存结束。`riftSeed`页面参数不会覆盖正式基地出发已经保存的identity，因此记录实际种子，不把它写成历史地图重演。
- 页面异常`pageerror`均已监听。后几轮同时监听`console.error`，早期录制器未监听console，因此不能说早期console错误必为空。失败的只读probe字段名和inactive场景菜单探针属于测试端异常，保留在操作输出，不当游戏崩溃。

### 可复用工具

- `tools/qa/i27-strategy-browser.mjs`：隔离context、JSON行交互命令、截图/账本、pageerror+console.error，以及核实暂停状态；`node --check`通过，实际隔离Chrome加载固定fixture并正常退出的冒烟也通过。证据中的`browser-session.mjs`是实际使用的较早录制版本，也保留。
- `tools/qa/prepare-rift-departures.ts`：将预备基地存档变为指定种子的原生departure；本轮输入`strategies/kindle.storage.json`、seed2691042921，输出`kindle-fixed.storage.json`。正式标题继续进入同一RiftScene。
- `tools/qa/i27-journey-driver.mjs`：只读地图BFS，真实按键移动；逐步记录不是自主玩家路线发现。
- 工具恢复与成长各领域的代码/机器门在前文；本节实机没有重写模型、HUD布局或技能视觉，没有用某个case专供逻辑制造成功。

实机客户端资源标识保存在`kindle-fixed/09-client.json`；不同早期样本可能来自协作期间不同冻结产物，未用这些样本宣称数值A/B比较。最后固定局`09-returned-base.png`、`10-durable-base.storage.json`确认当前正式基地已进入且账本只结算一次。原始截图/日志共约37MB，均为隔离QA存档，未包含用户原存档。
