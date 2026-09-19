# 全游戏补审 · 知情技术与设计数据核对

日期：2026-09-18。状态：技术核对收口；根代理生命成长与中途刷新已实机交叉，其余证据边界逐项标注。角色为已参与 I26 实现的 QA；不是首玩或独立体验评价。只写本目录，未修改 src/data/框架，未用 Git；初轮为非浏览器核对，末尾 B24 限定复核另运行一次隔离正式出发，边界见附记。

## 结论

当前数据确实提供 10 款同家族武器、13 族×4 品质异物、6 项永久成长、三模块修复与加厚、潮汐和有限装备循环。12 项当前生产模块回归通过，但独立跨系统探针发现 **薪柴亲和、生命强化两项付费成长没有进入正式搜寻／战斗收益**，以及成长／加厚保存失败未回滚且无待保存锁。根代理追加实机确认：正常出行刷新后，正式UI无法继续或明确放弃该局，只能保留不可载入的旧bytes或新建纪录；此项是当前多局体验的高影响阻断。它们与“数据有定义／领域测试通过”并不矛盾：缺口在消费方和场景事务。

稳定度与首次豁免另存在规则文本、常量、场景调用三者不一致；本文将其列为合同核对项，避免在没有创作意图确认时替项目决定应改数据还是代码。

## 证据与方法

- 当前源码与 CSV 共 483 文件：`source-start.json` → `source-end.json`，本轮结束时 0 项变化。结束清单另记录现有测试脚本和本轮独立脚本哈希。
- `test-results.json`：12 项当前非浏览器脚本全部 exit 0；每项完整 stdout/stderr 单列 `.log`。没有拿旧 QA 的 PASS 充作本次通过。
- `probe-cross-system.ts` / `.log` / `cross-system.json`：直接调用 GrowthSystem、LootSearchSystem 真实结算、CombatSystem、GameState、SaveManager、TideSystem。仅替代绘制／音效，Phaser 使用仓库现有 Node stub。LootSearchSystem 直接调用生产完成方法，**不是按键行走证据**；CombatSystem 读取正式默认最大生命，结合整个场景调用确认没有升级注入。
- `probe-cycle-contracts.ts` / `.log` / `cycle-contracts.json`：正式离开／归来同一公共方法顺序的最小域验证；没有构造第二套冲击规则。稳定度结论另依赖整个 src 的调用检索。
- `catalog.json` 是生产生成表直接导出。`csv-check.json` 核对 6 项升级的档数／效果／费用、10 武器的重量／抗性／伤害／耐久、13 活族及 52 次数组合与 CSV；5 个退休族不进入当前抽取。
- `economy-bounds.json` 是注明假设的算术上界／概率模型，不是实玩、用户成功率、体验评分或四A通过。

## 当前内容与等价类覆盖

### 武器

- 10 定义：普通白板 1；优良／精良／卓越各标准、轻型、抗污 3。全部 `profileId=crowbar`，单一 40px/120°挥击，120/60/220ms，500ms间隔，共同最多 2 目标。不是 10 种打法。
- 品质伤害 22–28 / 29–35 / 36–44 / 46–56；耐久 60/75/90/110。后三档横向重量 3.0/2.7/3.3，抗性 +2/0/+4；普通 3.0、无抗性。
- 本轮等价类：全 10 定义、各品质伤害边界、身体／环境核共预算、遮挡与无效目标、8/16/33/100ms、空挥与命中、末次多目标、保存失败。现有 `crowbar-combat`、`equipment-lifecycle`、`survival-weapons` 当前通过。
- 生产依据：`data/weapons.csv:2`、`data/weapon-qualities.csv:2`、`data/weapon-attack-profiles.csv:2`；消费 `src/systems/inventory-store.ts:330`。

### 13族异物

- 4 被动：重影碎片／记忆碎片／消声的旧布／附着的空壳。9 主动：凝滞的石块／带缺口的石头／留影玻璃／回声空壳／冷却的余烬／不落的砂砾／打结的细线／沉重的石块／映出别处的珠子。
- 行为等价类：地面敌人控制与解除；视觉／听觉诱导和被动事件计次；墙／空洞／身体净空；环境危险压制或延后；真实跨线；移动减速但保留感知攻击；可达地面位置快照；正伤害后抗性；无合法目标免费；独立来源叠加；末次持续完成。
- `first-eight-tools`、`next-five-tools`、`muffle-live-perception`、`offering-families`、`impact-forecast` 当前通过上述各自覆盖，**没有穷举13族的所有组合、战术收益或可读性**。
- 52品质组合均可由正式节点抽到；本轮 `contaminant-economy` 用三个风险档各4096种子检查分布可达及稳定重抽规则。品质主要增加次数，不改变目标／动作／供奉阈值／重量。
- 生产依据：`data/contaminants.csv`、`data/contaminant-qualities.csv`、`src/systems/contaminant-quality.ts:95`。风险档不是玩家当前混乱值。

### 成熟、装配、负重和损失

- 同一 instanceId 在未供奉→供奉→成熟→带出→消费／损坏各阶段保持唯一归属；3供奉槽，35薪柴扩为4；1武器＋2主动＋1被动，40薪柴增第3主动。两类物品共同占供奉槽，武器不提供技能防御效果。
- 正常3计数成熟，高潮一次3计数；同次先做防御再转化，末轮仍有效。回声空壳的自身计数倍率单独依 CSV，不把所有族一概写为恰好3趟。
- 基地无负重，出行总容量16.0包含装备；异物2.0。超过8.0开始线性减速，满载倍率0.84。新拾获不能当场装备；超重整批留地、交换原子执行。
- 死亡／主动放弃丢随身全部；基地收存和供奉保留。无可用武器时基地提供新白板，旧实例不会复活。此保障证明可继续出行，不能证明技能构筑可持续。
- 本轮 `inventory`、`equipment-lifecycle`、`field-loot`、`save-migration` 当前通过所有权、幂等结算、失败回滚、一次供奉、原子拾取等各自边界。
- 生产依据：`src/systems/inventory-store.ts:33,200,359,397`；`src/systems/contaminant-system.ts:90`；`src/systems/survival-attributes.ts:10`。

### 成长与基地

- 6项升级总价334薪柴：抗性98，亲和38，生命63，主动槽40，防御槽35，预告60。加厚另花12+20+32=64，三模块上限100→145，当前HP不自动增加。
- 已核实消费方：抗性参与 Rift 初始混乱增速倍率；两扩槽由 ContaminantSystem 读取；预告清晰度降低普通预告强度模糊20%→5%，不把目标命中率80%改为95%。亲和／生命见下述问题。
- 模块HP0/40/70/100对应 CORE混乱倍率1/.88/.79/.70；STORAGE薪柴倍率1/1.2/1.35/1.5；PURIFIER起始混乱50/30/15/0。
- 加厚不即时治疗：净化器100/100→100/115会将起始混乱0→7，需后续修复才兑现更厚缓冲。这符合当前完整度定义；**不是本报告认定的Bug**，应在体验链观察预期是否清楚。
- 生产依据：`data/upgrades.csv:2`、`src/managers/game-state.ts:132,224,276,308`、`src/scenes/rift-scene.ts:374`、`src/systems/impact-system.ts:388`。

## 确认问题（域复现＋场景静态接线；等根实机）

### TECH-01 · 高影响／高把握：薪柴亲和付费无实际收益

- 预期：CSV与成长面板均承诺每级每次拾取额外+1。实际 RiftScene 只把储藏 `kindlingValueModifier` 传入 search，LootSearchCreateConfig 没有亲和字段，结算只做 `floor(node.value * modifier)`。
- 最小复现：真实 purchase 亲和0/1/3级，初始储藏70。调用实际 LootSearchSystem 完成value1/2/4节点，三个等级全部取得 `[1,2,5]`，尽管 modifiers.kindlingAffinity 为0/1/3。见 `cross-system.json:growthRows`。
- 范围：当前正式2D全部薪柴节点；最高38薪柴投资不能取得声明的回报。影响资源→成长→下趟收益链。并非伤害／概率波动导致。
- 定位：`src/scenes/rift-scene.ts:375–377,413`；`src/systems/loot-search-system.ts:605`；`src/config/growth-upgrade-display.ts:56`；`data/upgrades.csv:3`。
- 反证：实际相同节点tier／储藏状态在升级后产生增量；目前全src引用检索未找到其他亲和加算路径。可用实际按键同状态副本验证。

### TECH-02 · 高影响／高把握：生命强化只影响准备显示，战斗仍100HP

- 预期：每级+15，最多+60。实际 CombatSystem 的 maxHealth 为 readonly 常量100，create/reset都回满这个值，RiftScene未传生命成长。
- 最小复现：购买0/1/3级后，growth给出0/15/45，准备显示计算100/115/145；new CombatSystem().getMaxHealth()始终100。create没有其他可配置最大生命入口。见 `cross-system.json:growthRows`。
- 范围：当前正式2D所有战斗；最高63薪柴成长收益未进入生存，报告／备行预览与实际HUD可能矛盾。
- 定位：`src/systems/combat-system.ts:362,431,699`；`src/scenes/rift-scene.ts:353,377`；`src/ui/dom/loadout-panel.ts:488`；`src/ui/dom/status-panel.ts:225`；`data/upgrades.csv:4`。
- 反证：升级后的真实出击最大生命为115/160。根代理补实际场景确认。未来修复还须注意 runtime validator在`combat-system.ts:300`仍用100上限，不能只改HUD。

### TECH-03 · 中影响／高把握：成长和加厚写失败留下运行态，未进入重试锁

- 实际操作调用顺序是 purchase→稳定度增加→save；加厚同样先变更GameState再save。`save()`异常不会回滚成长／薪柴／模块，调用者无try/catch，没有设置pendingWorldSave。
- 最小复现：隔离memoryStorage预存50薪柴，setItem改为抛quota。真实方法按两个按钮顺序运行后：成长live42薪柴、生命1级、稳定度1；加厚live38薪柴、上限115。旧存储bytes保持原样，异常抛出，pendingSave=false。见 `cross-system.json:failedGrowth`。
- 范围：存储满／禁写时的两种购买。刷新会回到购买前；后续普通保存可能才落盘。与库存/修复的事务性处理不一致。未用DOM触发，不冒称已看到按钮错误或浏览器崩溃。
- 定位：`src/ui/dom/growth-panel.ts:232–251`；`src/systems/growth-system.ts:95`；`src/managers/save-manager.ts:255`。对照已回滚的修复入口`save-manager.ts:179`。
- 反证：外层真实事件处理存在捕获、回滚和重试锁；静态调用链未找到。根可一次性故障存储实机验证，不需要重复整趟。

## 合同不一致／需要决策

### TECH-04 · 中影响／高把握事实，意图待澄清：稳定度只有两条实际加分接线

- spec写成功撤离+2／成长+3／完整潮峰+5／换潮+8／模块归零−1；当前常量为1/1/3/5/−1。常量注释称做过节奏校准，故数值不同先记文档漂移，不擅自判应改回旧值。
- 更实质的缺口：全src只有净化点收益分支和成长面板调用addProgress；潮峰、换潮、模块归零常量无消费者。实际模块事件／tide advance探针保持稳定度30。成功撤离还要求kindlingGained>0，空薪柴但携异物撤离不加分。
- 证据：`cycle-contracts.json`；`src/config/constants.ts:529`、`src/scenes/purification-scene.ts:405–411`、`src/ui/dom/growth-panel.ts:236`、`docs/specs/system-growth-tide.md:228`。已用全src检索确认调用范围。
- 范围：长期进度／结果解释；无终局内容，不能据此推算玩家流失。需决定当前稳定度合同，根实机空薪柴返回作一条反例即可。

### TECH-05 · 中影响／高把握事实，意图待澄清：首次教学局豁免实际不可达

- spec明确第一次出击教学局，cycle0免冲击；当前出发先incrementCycle为1，归来ImpactSystem只豁免cycle0。因此第一次正常归来即承受基础30总伤害。
- 生产域复现：reset→incrementCycle→run：`skipped=false`，三模块总HP210→180；直接cycle0 run才skipped。见`cycle-contracts.json:first`。
- 定位：`src/scenes/purification-scene.ts:1194`；`src/systems/impact-system.ts:248–253`；`docs/specs/system-purification-impact.md:213`；`docs/specs/system-growth-tide.md:160`。
- 这可能是场景时序改动后的合同遗留；要由明确意图决定修代码还是撤回教学豁免承诺，不能由QA默认改节奏。根首趟归来可直接对账。

## 三条跨系统链的可计算风险

1. **获得→成熟→再使用**：正式生成每图3异物节点，13族等概率，无定向来源池。理想全取全带回时，每趟得到至少一件指定族概率约21.35%，首次约4.68趟；连续5趟仍没有该族概率约30.1%。这是“任何品质皆可、无死亡／遗漏”的假设模型，实际代价只会因取舍增加；不能将其写成人群成功率。之后还要等待供奉成熟。需实玩检验普通代表构筑是否能依靠替代打法等待，不能仅证明52种可抽到。
2. **资源→基地→下趟**：正式8薪柴节点为3安全/3争夺/2深处，当前无亲和加算。全清时储藏HP0/70/100分别最多17/19/24薪柴；没有考虑死亡、留路及搜寻危险。基础冲击随潮汐30→90，若无防御且希望修回同HP，连续算术成本7.5→22.5薪柴，还可能按模块取整上浮。晚潮全清收入接近裸防修复额，说明防御、积累和成长的实际联动必须测，不能单从均值判平衡失败。
3. **损失→替代→恢复**：常规武器掉落期望约1.38件/全清趟（8/18/30%作用于3/3/2堆，首发现赠品另算），但物件需成熟、武器占供奉槽且不减伤；技能普通3–5次，自动被动可能每趟多次耗用。死亡还将携入套装和新所得全丢。基地白板让出行继续，不解决指定技能供给。四A必须记录成功带回、未成熟库存、槽占用、普通替代装备、真实消耗与失败序列。

## 本轮不支持的结论

- 不评价武器连续手感、诱离战术是否有用、成长是否让人愿意再玩、净化点审美或声音。
- 不宣布完整经济、四A、多局构筑恢复、所有工具组合、正式随机池中断恢复通过。
- 没有跑I26地图性质／性能复测。根代理冻结build和浏览器操作证据另列；其后若复核只按上述具体反例，最多两轮。

## 交接优先级

根代理优先比较同seed同储藏状态的亲和0/1和生命0/1；其次一次购买存储失败和首趟归来对账。完成这些后不需要扩大样本来证明相同静态断线。体验组继续以自然循环观察价值；本报告不向其首玩阶段提前披露项目细节。


## 根代理交叉与限定追加（本轮一次追加）

### TECH-02 实机场景确认

根代理在正式production隔离档中仅追加100薪柴作为诊断起点，正常UI购买生命2级／亲和2级，实际扣费40；报告显示自身完整度130，正常出发后HUD仍100/100。证据由根代理提供：`../coordinator/014-actual-upgrade-report.png`、`../coordinator/017-upgraded-rift-health.png`、`../coordinator/two-upgrades-purchased.storage.json`。本代理未冒称亲自按键或观看录像。此交叉确认TECH-02实际场景表现，亲和的实际节点收益仍以根后续证据为准。

### TECH-06 · 低影响／高把握：起始混乱短时显示0，但底层15生效

- 根代理发现报告起始15、入场HUD0。生产域探针确认ChaosSystem的内部初始值为15，`lastEmitted=15`，不发送初始事件；HUD在其后create，独立初始化0。无受击／发现时等增量≥1才更新，CORE70的倍率.79下，用100ms步长首次事件出现在2600ms、value≈16.027。
- 定位：`src/systems/chaos-system.ts:376–388,420`；`src/scenes/rift-scene.ts:386,533`；`src/ui/dom/rift-hud.ts:237,255`。恢复局才调用`restoreReadouts`，正常入场没有初值同步。
- 证据：`probe-chaos-opening.ts`／`.log`／`chaos-opening.json`；根入场截图为实际现象交叉。
- 范围：正常入场到首个变化事件，暂停时可能保持错显更久。竞争解释已区分：净化器起始混乱并未丢失，不应把这个短时显示错误误判为第三项成长／资源效果失效。

### TECH-07 · 高影响／高把握：正式2D active纪录刷新后无正常UI恢复通路

- 根代理实际步骤：正式出行→正常Esc暂停→reload→沿旧路返回；出现“上次出击尚未结束。物品记录已保留，暂不能载入。”并留在主菜单。证据`../coordinator/021-active-refresh-click.png`、`upgraded-active-run.storage.json`、`active-refresh-click.storage.json`（后两同在coordinator）。
- 静态交叉：`src/managers/session.ts:55`在load成功但ledger active时无条件拒绝进入；主菜单`main-menu-scene.ts:244,268`与暂停菜单`pause-menu.ts:89`均复用该路径。全src中`InventoryStore.recoverInterruptedRun`仅有定义没有调用；`RunController.abandon`唯一调用在仍存活的`RiftScene:1925`，刷新后的菜单没有该场景可调用。新的纪录走`session.ts:36`，会deleteSave并清全部运行态。
- 精确影响：原存储bytes仍保留，**不是数据已被自动删除**；但用户无法用正常UI继续原局、明确弃局后回基地或保留该档继续游玩。新建会替换累计进度。覆盖任何当前正式2D在途纪录的刷新／浏览器重开。
- 竞争解释：悬海历史恢复路径确实存在，但没有接正式入口，不能解除此阻断。等待场景初始化不能改变明确active拒绝分支。没有建议绕过账本或把关闭页面默认算死亡；恢复政策及可见弃局路线需要另行实施。

## B阶段高级预置交付（不作为自然成长证据）

根代理明确要求后新增`create-advanced-fixtures.ts`，以`../coordinator/fresh-base.storage.json`为基线、隔离memoryStorage，调用生产factory／InventoryStore／SaveManager生成：

- `advanced-24.storage.json`：薪柴24；CORE40/STORAGE70/PURIFIER20，maxHP100。保留原白板装备；普通留影玻璃、普通消声旧布、优良标准撬棍成熟留库，供可见UI备行。未成熟凝滞石与精良标准撬棍各1/3供奉进度留库；供奉槽空、run=null。
- `advanced-0.storage.json`：只比前者减少24薪柴，其他全部相同，用于修复／成长缺钱边界。
- 两份对应`.save.json`供读取。`advanced-fixtures.manifest.json`保存基线SHA、输出SHA、稳定QA实例ID、每项预置变化及用途；`advanced-fixtures.log`保存执行日志。两份都通过真实SaveManager.load。
- 熟化使用真实slotOffering＋三次finishOfferingImpact，不手写次数／武器属性；这只是预置生命周期，没有伪装成三趟自然出行／真实归来冲击。没有改用户存档。

## 最终技术结论

本轮支持：当前规则／数据覆盖清单、12项现行领域回归、成长断线／写失败／循环恢复阻断的具体可证伪事实、明确假设下的经济风险。现阶段优先补齐正式入口的成长兑现和在途纪录出口，再判断成长取舍与周转体验；否则“成长没有感觉”或“无法持续玩”的部分反馈可能直接由接线和生命周期阻断造成。全局好不好玩、完整平衡和下一笔美术投入仍由根代理结合两名体验组证据裁决。


## 正式地表限定追加

见 [ground-origin-report.md](ground-origin-report.md)。青绿整格来自生产vegetation角色＋量化，已由真实bake复现；不是FRACTURE/缺素材回退。源码路径无普通Rift production/DEV地表差异。保留与现行地表合同的偏差，不作审美裁决。


## B24 出发停帧限定复核

原高级预置与 B24 现场存档通过真实加载／出发约束。一次相同准备状态的正常按键出发进入 Rift，pageerror 与 console error 均空；没有重演此前修复／供奉／成长的面板历史，故首轮停帧仍保留未定，不定因于装备。完整方法、错误编排留痕与实际截图见 `b24-transition-review.md`。刷新后的 active 载入阻断仍独立成立（TECH-07）。

根代理最新实机交叉（来源 `../coordinator/diag-first-natural-return-base.png`、`diag-first-return.storage.json`）：新档正常搜得1薪柴与优良凝滞石、E撤离、R返回，三模块70→65/65/50，总损伤30，支持 TECH-05 当前首次出发没有豁免的调用链；该趟只读诊断地图寻路，没有位置、物品、HP注入。
