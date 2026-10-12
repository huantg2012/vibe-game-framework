# 矩形碎片跨材料推广 B01 · 2026-10-12

B01五图已正式接入并完成限定内部验证；全库推广仍在进行。绑定 F007/F011/F012/F013/F014/F044/F052，关联 F005/F006/F049；延续 DEC-206。本批新增无彩层原、纤维扇流、壳缘阶串、苍帆夹道、凝胶裹纤维五图，既有余烬脊作者源及共享 fragment-v1 保持；其他102世界未重做。单柱与压纤四角仅有临时作者草案，不计生产完成。

实际入口是正式新出发的 r8 世界池及复用正式 Worker/RiftScene 的隔离内存练习场。没有为测试缩身体、缩视野、删敌人/资源配额或暴露未知撤离；body20px、support8px、forward224px及原收益/混乱规则保持。

## 实现与审查

五图各有独立 CSV 地床/缺地矩形，并同步重排实例与出生候选。Ash/Splayed保留成群材料的repeat来源；Pale保双幕、Shell保四壳关系、Gel保池面跨束及次束的source-once关系。孔数与实体数是各自布局结果，不设全库统一定额。作者说明见[批次记录](../design-notes/rift-fragment-rollout-batches.md)，系统合同只在[地图规格](../specs/system-map-generation.md#rectangle-fragment-authoring)。

构建工具读取fragment注册表作为来源，只对明确注册图绕过已被新轮廓替代的旧erosion数量前置；其余世界旧门保留。新增注册、旧r8重放、分批未改图输入复用检查都运行在临时目录或只读数据上。没有修改生产运行时语义或另起算法修订。

独立[初稿美术记录](rift-fragment-expansion-art-2026-10-12.md)、[最终14图限定复核](rift-fragment-expansion-final-art-2026-10-12.md)与[代码审查](rift-fragment-expansion-independent-review-2026-10-12.md)分别签自己的范围；机器准入不代用户审美或自然探索终验。

## 原始失败与纠正

- Ash旋转足迹预检先暴露7件跨孔/跨岸，再剩一个受材料比例影响的实体角；由root明确授权最后单点位置/尺寸修正，没有移动孔或改共享算法迁就。
- Pale初稿虽完整生成通过，填孔后仍近矩形厚盘，被art退回。布局级撤床与双幕局部调整后重新取证；`pale-sail-medium-attempt1.json`仅为初稿技术记录。
- 首次五图全材质实图再次退回Splayed/Gel的近矩形大盘，前30例技术通过不计它们的构型通过。`browser-medium`保留这版实图；只对二图重排大地床，其他三图不变。
- 固定Git旧r8首捕获使用工作区TSX配置，有依赖alias隔离疑点。工具改为固定Git入口、同提交tsconfig与Phaser stub闭包后重取八图至`previous-r8-confirmed`，完整map/recipe/四RGBA与首批逐项相同。首批保留为隔离不足历史，最终以confirmed为准。大 `.v8.gz` 地图本地保留并具名忽略；recipe、完整结果hash、RGBAhash及固定Git重现合同进入版本库。
- 注册负例初稿改到了整表而非单行，先触发重复ID；修正隔离夹具后重新验证。最终共13例，2正例与11拒绝例，不冒称13个负例。
- Pale/Shell普通按键视野测试初次在转向时走过露出孔角的位置。将转向tap缩短又使Pale来不及完成实际朝向转动。工具随后改用完整身体可达的32px后方准备点→见证点的普通行走；仍失败后，独立DDA比较确认最早显露点的切角光线对不足3px位移敏感。保留原最早显露≥80px证据，浏览器只在其32px内选±4px九点均有LOS的稳定座位，记录原点/座位与实际0→1→0，不修改玩家、迷雾、时钟或健康。三次失败和修正后的结果分别保留。

- Shell中档safe搜取后，旧journey工具4.5px提前转弯容差让实际路线切进障碍。独立重放证明中心→中心路径及真实起步均合法，但十个8px阶梯角允许提前4.4px转向时不合法；如(892,1168.4)→(884,1164)完整身体sweep仅0.2499875。修正工具的真实起步/edge sweep、到点容差及失败坐标记录，同seed重新验证，不换地图躲过失败。

## 最终技术与普通输入证据

证据根为 [r100-fragment-expansion-2026-10-12](artifacts/r100-fragment-expansion-2026-10-12)。最后不可热更新浏览器源为 `LsV6cH` / 3053，780项src/data与工作区精确一致；此前 `UpucJE` / 3052的三张未改图通过18份完整配方及执行源码相等绑定，仅排除三个全库来源回执字段，不排除任何地形/实体/内容输入。

- **五图两seed三档同源。** `five-worlds-two-seeds-three-grades.json`保留初稿30例；最终Ash/Shell/Pale的18例由`unchanged-three-worlds-final-binding.json`精确绑定，Splayed/Gel由`two-worlds-final-three-grades.json`的12例替换。合计30个最终有效组合，seed为20261012、4918219；完整支撑、VOID透传、material粗格与4,128,768逐像素透明同源检查均过，同world+seed三档外岸/孔不重抽。原候选拒绝原因保留。
- **最终15例独立生产与恢复。** `five-production-final.json`为5图×低/中/重、seed20261012，recovery=true。完整内容、20px身体、巡逻窗口、至少两组双侧绕行及wire恢复独立检查通过；最小身体可达99.884%，撤离路径1039.3–1788.7px，候选至少6区域/3距离层，最多3候选，最大配方14,438字节。原配额未放宽。
- **旧r8。** `previous-r8-confirmed/expanded-replay-final.json`在最终代码重放固定c0b71d93的八份旧recipe，完整map/四RGBA精确相同，包括旧空间策略v1的新注册世界与旧cinder策略v2；不借新CSV补旧记录。102未推广世界的306份输入、全部非本批1101作者行（含cinder）保持，注册13例为2正11负。
- **五图实景。** `browser-final-medium`含五份实际Renderer全图和五份正常入口，均未知撤离且无pageerror；复制去雾图仅用于诊断，游戏入口保留有限视野。最后两图的宏形重排实图与旧失败图分开保存。
- **VOID的真实作用。** 未改三图的`void-sight.json`及新两图的`void-sight-final-two.json`各有3个独立176px内见证；同距离移除该VOID的反事实可见，最早显露需实际移动至少80px。普通输入证据为`sight-input-ash`、`sight-input-pale-sail-margin`、`sight-input-shell-chain-margin`、`sight-input-final-two`：每图一例真实FOV 0→1→0，无玩家位置/朝向/健康/时钟/迷雾写入。最早座位与浏览器稳定座位分账，九点±4px探针不宣称连续面积的数学保证。
- **三档代表搜撤。** `journey-ash-low`、`journey-shell-medium-swept`、`journey-pale-severe`均由普通输入取得1薪柴、实际发现未知出口并E撤离，HP100；模拟耗时28.382、37.232、25.132秒。导航预读全图，只证明搜取/发现/撤离链与身体路径，不是盲搜或全经济平衡。
- **构建与复核。** 双CSV生成--check、类型、注册反例、动态作者身份、认可v1只读回归、工具语法及最终build通过。`final-independent-build.log`为最后源构建；[独立QA](rift-fragment-expansion-independent-review-2026-10-12.md)确认无新增生产P1/P2/P3，QA-J01同seed修复并关闭。

**参考机运行预算通过。** `runtime-final/report.json`为最后冻结源，重档seed20261004的Ash与Splayed各61.281、61.264秒真实持续输入，全程存活。帧p95分别17.4/18.1ms，p99为18.3/18.5ms；CPU p95为3.5/3.7ms，material p95均0.3ms，均无>50ms帧。未排除用户机器其他活动；本代理先结束其他重负载，Chrome节能只对新建临时QA profile关闭。没有改用户浏览器或系统设置，既有预算未放宽；不外推全世界、全设备或资源长循环。

本批内部通过不等于全108图完成、所有seed、全孔/灯向、自然未知搜撤、深区决策、长期经济或正式美术人审。I14仍13/14、P49开放，弱设备补测豁免且未测。旧版本与旧失败证据不作废。


## 最终美术与交付范围

独立Art直接复看最终两图全图/入口及五图正常肩灯，共14张，未见阻止本批推广的具体视觉回归；前三宏形承接此前独立审阅。最终Splayed请求seed20261012、内容部署实际seed3956234173（第3候选），其外岸/空洞仍由原请求seed固定；不将合法重试写成首候选。Shell全壳、Splayed束体、Gel胶头的全周近照未覆盖，不能据近岸帧签实体全周质量。

本批新增五图，正式fragment覆盖由1增至6，剩余102尚待逐世界编排。最终代码/数据未改变既有共享v1、cinder认可源或正式UX；无本轮UI视觉清单新增项。唯一地图spec、架构、作者队列、推广任务、现状文本及索引已同步。用户的正式美术与自然探索终验保持开放。

现状索引收口：原game-state校验器及renderIndex执行，0结构错误、0未登记来源；2条既有提醒、989条历史来源漂移保留。只刷新本任务已复核的登记路径及fragment库存，未重置全局历史基线或把旧证据重新签为当前通过；详见`partial-baseline-review.json`与`game-state-check.json`。
