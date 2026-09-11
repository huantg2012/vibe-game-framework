---
status: IMPLEMENTED-AGENT-VERIFIED
created-date: 2026-09-11
last-modified-date: 2026-09-11
iteration: 21
decision: DEC-147
gameplay-verdict: AGENT-VERIFIED
supply-validation: NOT-STARTED
---

# 构筑与遭遇对照场

独立开发入口：`http://127.0.0.1:3000/build-lab.html`。仅由开发服务器启用，不进入正式构建或主菜单。[世界方向画廊](../../world-study.html)与此处互通；本页只验证现有装备、空间与遭遇的关系，不是新世界样板。

本页使用**隔离的内存训练库存**。刷新清空这一页的库存与记录；正式浏览器存档不加载、不保存、不删除。结束后下载JSON留存。训练赠予、单次携回和这里的工程检查不能替代[总计划](../progress/content-expansion-plan.md)阶段四A的连续供给验证。

代表实玩已由Agent验收，见[迭代21 QA](../qa/iteration-21.md)：22次实际尝试及连续录像保留成功和失败，三种遭遇均有白板携回，另有周期、轻装、近战及静默路线对照。该结论仅覆盖对照场功能与这些样本，不代表总体平衡、用户世界选择或持续供给通过。

## 使用方法

先选择遭遇、装配、种子，周期通道还可选择气团、雾团或尘絮群。点击“开始 / 中止当前并重开”。默认打开页面自动开始；加`autostart=0`则等待按钮。

运行中编辑配置会暂停旧试验，修改只在重开后应用。中止保留一条`aborted`记录，不伪装成撤离或死亡。每次重开重新建立地图、AI、物品实例与全部单例状态，不在上一趟上直接换装备。种子相同、遭遇相同、周期实体相同，就有相同几何、部署、外观种子和掉落输入；配置不参与它们的签名。

- WASD移动/转向；静止时保留最后移动方向；空格挥击。
- Q、F使用主动技能；被动沿正式触发条件工作。
- 按住E翻找和撤离。Tab只显示本趟拾获，世界继续。
- Esc暂停/继续本试验，暂停状态显示在外侧开发控件。本页不打开含新纪录/载入功能的正式Esc菜单。
- 真实撤离或死亡后展示正式结算面板。按R或点击正式返回按钮，先完成库存结算和`RIFT_EXITED`，再回到本页配置；不会启动净化点。

地址示例：

```text
/build-lab.html?scene=watched&build=quiet&seed=7
/build-lab.html?scene=watched&build=light&seed=7
/build-lab.html?scene=contested&build=melee&seed=7
/build-lab.html?scene=periodic&build=cycle-none&seed=7&volume=gas_mass
/build-lab.html?scene=periodic&build=cycle-delay&seed=7&volume=mist_bank
/build-lab.html?scene=periodic&build=cycle-suppress&seed=7&volume=dust_swarm
```

## 遭遇与配置

三张图均为固定旧图书馆测试局部，37×25格，每格32px，玩家使用正式裂隙碰撞体、速度、镜头与迷雾。出生点与撤离点同在西侧`(176,400)`；玩家可以及时退出，不被强迫打光敌人。

`watched`“被观察的捷径”：中央直通走廊由视锥巡逻体观察，南北外圈提供更长的可通行路径。西侧主墙厚一格，两侧有合法落点，可测试带缺口的石头；东南的听觉体用于验证噪声诱导和消声的旧布。

`periodic`“周期危险通道”：中部6×6格的真实体积Host覆盖直接路线，南侧有较长绕路，西侧可先观察释放周期。东南听觉体保留正式每图一个听觉来源的合同。切换体积实体只换合法基底，三个基底各自使用正式的释放、漂移、危险和恢复逻辑。

`contested`“有退路的争夺点”：中央掩体分开接近路径与追击视线，争夺目标有南北出口，深处收益可放弃。两名敌人使用正式视锥/听觉和近战职责，可检查束缚、减速与撤退的实际窗口。

四套代表配置均为普通品质：白板无技能；静默绕行（回声空壳、带缺口的石头、消声的旧布）；短窗近战（打结的细线、沉重的石块、附着的空壳）；轻装静默（只从静默组去掉带缺口的石头）。静默与轻装分别重9.0、7.0，重量以正式库存为准，速度由正式负重规则投影，未加实验室速度补偿。

周期专项另有空槽、不落的砂砾、冷却的余烬三套白板单主动配置。空槽自身较轻；另外两套重量相同。比较时保留这项真实成本，不补发无用物件来制造假等重。周期技能只对正式目标资格有效，不直接修改Host时钟。

遭遇是否真正让构筑产生不同收益仍以[本迭代QA](../qa/iteration-21.md)的实际输入记录为准。地图连通不等于普通配置有合理体验；无差别或失败样本应保留并用于修改编排。

## 数据与接线

内容来源为三份CSV，代码由`node tools/csv-codegen/generate.mjs`单向生成：

- `data/build-lab-scenes.csv`：场景维度、地板/墙矩形、出生、撤离与实验说明。矩形格式`左列:上行:宽:高`，多块用`|`分隔；点格式`列:行`。
- `data/build-lab-placements.csv`：翻找物、敌人、巡逻点、基底、覆盖档、合法行为词和体积座位。体积框格式`最小列:最小行:最大列:最大行`。
- `data/build-lab-loadouts.csv`：武器、两个主动、一个被动、配对组与说明。引用正式物品定义，没有复制伤害、次数或敌人属性。

`src/generated/build-lab-data.ts`为生成产物。`build-lab-fixtures.ts`将这些表转换为`GeneratedRiftLayout`，同时检查合法地形、全点可达、行为能力、体积完整支撑面、单听觉轴，并同步`enemySpawns`和`contaminationDraw`；每次调用重建数组和Mask，不能重复使用上次被运行时修改的图。

`build-lab-session.ts`调用正式工厂、品质次数查询、装配接口及`beginRun`建立训练出击；重置GameState、成长、潮汐、稳定度、供奉运行时与预测、物件和残留状态。训练物件明确初始化为供奉完成。初始白板来自正式保底工厂，不手写武器耐久。

`SaveManager.setStorage()`注入内存后端。加载、窥视、保存、删除、迁移、自动保存、库存提交、`commitWorldTransaction()`及其重挂的持久化回调都解析同一后端。正式默认仍为`localStorage`。待保存结算期间不允许切换后端。

`RiftScene.create()`的可选`devFixture`只在DEV消费；正式路径照常使用`generateRiftLayout()`。下游完整复用Player、AI、CombatSystem、ToolSystem、Host、迷雾、地表、翻找、拾获UI和RunController。`onReturn`是成功库存结算后的可选目的地回调，未重写死亡或携回规则。

## 记录格式与解释边界

`build-lab-recorder.ts`只读正式系统，默认每100ms采样一次；逐次库存提交和关键事件另外保留。下载包含本页所有已结束记录和当前未结束记录。

- 初始条件：运行ID、种子、布局签名、场景/配置、体积基底、创建时间、装备实例、模块/成长/潮汐、初始负重和抗性、训练库存标记。
- 连续样本：模拟时钟、位置、HP、混乱、攻击阶段、敌人警戒/检测/交战/是否在视野内、Host自然阶段及延迟/压制剩余、翻找进度与薪柴。
- 事件和事务：玩家/敌人伤害、死亡、警戒、真实技能消费、真实揭晓/拾获以及每次提交后的库存账本。无效按键不会被记录为命中或消费。
- 汇总：轨迹采样距离、静止时间、AI警戒时间、AI交战时间、峰值混乱、逐实例消费、丢弃、结局及实际返回物件ID。

静止时间包含观察、读条与犹豫，不能自动解读为“等待危险”。警戒/交战时长是AI状态，不代表所有时刻敌人都看见玩家。轨迹距离为相邻位置样本距离，穿薄墙位移也计入；它不是纯步行里程。事件时间精度约一个采样周期，动作手感需要连续录像配合。

耐久/次数根据已提交实例差值统计。最后一次损坏须有`destroyedIds`证据；死亡丢失未消耗的物品，不记成全部用光。武器耐久消费与攻击目标伤害事件分别保留，不能把一挥命中两敌算作两次耐久。

超过36000个位置样本后保留限额标记并继续累计汇总；需要更长测试应分趟导出。刷新不会恢复训练库存或记录。这里没有实现正式存档中断政策，也没有模拟基地供奉结算。携回仅指正式裂隙库存结算的返回记录；连续周转、供奉吞吐与失败恢复仍属于总计划阶段四A。

供QA的只读接口：`window.__buildLab.getState()`与`getRecords()`。另暴露`game`方便查看生产Scene；自然操作证据不得用它传送、补物、改AI、推进时钟或代按技能接口。

## 已完成的工程验证

```sh
node --import tsx tools/build-lab/check.ts
npm run typecheck
npm run build
node --import tsx tools/inventory/check-save-migration.ts
node --import tsx tools/inventory/check-inventory.ts
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/inventory/check-tool-consumption.ts
```

新增9组检查覆盖三场景×三种子×三体积基底、地形与退路、薄墙落点、布局无共享修改、七配置合法槽位、内存后端所有路径、写入失败/待保存重试隔离、消费与死亡区别、不可变记录及RunController结算顺序。失败消费必须不扣次数、不发布库存；待保存结算重试后不重放世界变更，后续消费仍写入内存。既有SaveManager迁移9项、库存9项、工具消费18项通过。项目没有独立lint脚本；TypeScript启用严格、无未使用变量与无隐式落空检查。

浏览器命令：`node tools/build-lab/smoke.mjs`，支持`GAME_URL`、`PLAYWRIGHT_MODULE`、`CHROME_PATH`、`ARTIFACT_DIR`。2026-09-11通过真实移动、Tab不暂停、换装安全重开、三Host接线、出生点E撤离/R返回及刷新。整个浏览器上下文用正式Save键哨兵确认未改写。默认证据写入`/tmp/build-lab-smoke`；这是可重跑的工程冒烟，不充当远行搜刮、自然死亡或构筑优劣的验收。

生产构建完成，新增试验入口与CSV生成产物不进入生产依赖。构建仍报告现有共享游戏Bundle超过推荐分块大小，未在本批扩大资源重构范围。
