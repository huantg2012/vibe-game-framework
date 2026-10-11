# 已认可开放碎片机制：余烬脊正式首代表

2026-10-12，DEC-206。绑定 COH-F007/F011/F012/F013/F014/F044/F052，关联F005/F006/F049。代码基线 `b2d73790`，本批在其上实现r8；实际验证由各报告及最终浏览器快照逐文件指纹绑定。证据目录沿开工日期命名为 `r100-fragment-rollout-2026-10-11`。

## 实现与范围

正式新出发使用r100-native v3修订8。首批只有余烬脊使用已认可的矩形拼合和自由断缘；三份新CSV单向生成作者数据，共享 `rectilinear-fragment-v1` 编译实际外岸和内部空洞。原始请求seed决定断缘，部署重试不重抽地形，三档污染共享同种子的地形。完整layout、算法版本、seed策略和最终轮廓冻结在出击身份中。

最终轮廓同源进入8px地面支撑、20px身体/导航、VOID视线、材质断沿及Worker协议。普通实体继续只挡身体和近战。实体沿用22件solid与4块relief，重新部署到新地床；出生和未知唯一撤离仍从合法分区/距离层抽取，资源、敌人和Host按原配额重新准入。母版在20261011有80点外岸和10孔；点数和孔数不成为全库定额。

另外107世界保持原几何输入，未记作完成构型推广。r7完整执行器、校验和表面预烤从固定 `b2d73790` 封存；旧在途身份走归档，不能读取新CSV追改旧图。未改规则、身体大小、视距、内容配额或已认可共享v1来使测试通过。

## 最终证据

- [r8准入及同源结果](artifacts/r100-fragment-rollout-2026-10-11/revision8-admission-final.json)：324新配方验证；余烬脊三个认可seed×三档共9个完整图，真实8px孔、身体支持、实体透明LOS、最终材质逐像素合同通过。20261011最小身体连通比例99.9787%，有4个孤立边缘支持席位，沿既有至少97%合同验收，未声称所有支撑格完全连通。
- [保留种子4918219](artifacts/r100-fragment-rollout-2026-10-11/production-holdout-4918219.json)：三档完整生产图及独立传输/恢复均首候选通过，身体连通比例100%。仅有限保留样本，不是全seed资格。
- [r8保存身份](artifacts/r100-fragment-rollout-2026-10-11/revision8-snapshots-final.json)：新旧作者数据隔离、破坏身份拒绝、原请求seed/重试、全库未迁移输入等价。额外[独立代码复核](rift-fragment-rollout-code-review.md)覆盖26+10个拒绝、9份边界seed配方往返、63个重试定义和321份非余烬输入。
- [r7冻结](artifacts/r100-fragment-rollout-2026-10-11/revision7-freeze.json)及[公开恢复路由](artifacts/r100-fragment-rollout-2026-10-11/revision7-live.json)：324旧配方和4个完整地图/四层RGBA，完整、裁剪、恢复闭包以及公开r7路由一致；不等于枚举所有历史保存异常。
- [最终三档实景](artifacts/r100-fragment-rollout-2026-10-11/final-browser-medium/cinder-ridge-medium-full.png)：低/中/重各一份正式Worker准入后的原生Renderer去雾全图和正常入场图，位于 `final-browser-{low,medium,severe}`。只在独立渲染副本揭雾；原场景出口未知、未可见、未提前记入小地图。独立[美术复核](rift-fragment-rollout-art.md)支持首代表构型继承，保留小堆重复的低优先观察，不代替用户终审。
- [VOID离线检查](artifacts/r100-fragment-rollout-2026-10-11/final-void-sight.json)与[最终真实按键绕孔](artifacts/r100-fragment-rollout-2026-10-11/final-sight-input/report.json)：三处近距见证；一个实际WASD往返的目标可见性为0→1→0。目标在有效视距内，移除该孔的反事实可见，排除仅由距离导致的黑暗。截图及录像同目录；没有写玩家位置、健康、时间或视野。
- 三档有限[低](artifacts/r100-fragment-rollout-2026-10-11/final-journey-low/report.json)／[中](artifacts/r100-fragment-rollout-2026-10-11/final-journey-medium/report.json)／[重](artifacts/r100-fragment-rollout-2026-10-11/final-journey-severe/report.json)搜撤：正常键盘进入真实移动/翻找/发现出口/撤离终局，各搜取1份safe薪柴、100HP存活，游戏计时25.666/23.749/23.916秒。诊断导航预读静态全图；证明流程接通，不是陌生玩家盲搜、深区取舍或自然经济验收。
- [三档正式入口及冷恢复](artifacts/r100-fragment-rollout-2026-10-11/final-entry/report.json)：隔离浏览器从标题新建，经真实两环节备行、Shift+Enter、暂停检查点、刷新和继续，保持完整r8身份、身体位置、未知出口和一次visit。自然选中root-cistern、torn-reservoir、shell-patchwork；并非余烬脊浏览器存档样本。备行打开调用正常场景方法，未模拟实走净化点。入场5.06–6.02秒，恢复4.38–5.25秒；这些时长只记录样本，不当作全库入场性能通过。

所有最终浏览器取证从不可热更新的 `coh-spatial-browser-Ikg7q8` 源副本运行；src/data快照保存于各目录。无修改正式用户存档。源快照后只增加npm检查别名和文档，不改变运行源。

[持续运行预算](artifacts/r100-fragment-rollout-2026-10-11/runtime-final/report.json)通过：参考机实际Chrome，余烬脊重污染、另一个固定seed20261004，12段正常按键运行61.264秒且存活。帧间隔p95为17.5ms、p99为17.7ms、超过50ms比例0；主循环CPU p95为3.4ms，材料提交阶段p95为0.3ms，沿原门限验收。只在临时QA浏览器profile关闭浏览器节能，未改系统/用户设置；未宣称机器独占。仅这一世界/种子，未新增GPU显存、循环资源回收或弱设备测量。

## 修正记录与检查口径

第一组浏览器快照 `coh-spatial-browser-XoJdGy` 和无final后缀报告保留。收尾codegen检查发现作者最后一次relief id3调整未编入generated：y410→390、width200→150及sourceHash变化，其他放置/外岸/空洞不变。按最终CSV重新生成，重跑9个完整图、保存合同、三档实图、VOID与按键证据；不删除旧结果或把旧截图冒充最终源。

旧positive-ground回归误把修订号读在recipe根层，经独立发现后修到package层并实际通过；旧8孔只作为通用夹具或r7归档断言，当前孔数来自fragment编译结果。[报告](artifacts/r100-fragment-rollout-2026-10-11/positive-ground.json)。r7封存第一次检查的错误消息精确断言失败只属检查器过严，原失败保留在 `revision7-freeze-attempt1.json`。

`npm run build`、两套CSV codegen `--check`、认可母版 `check:fragment-shape`、独立类型检查通过。build保留现有大chunk提示。r7归档使下载包增长，这批不将构建通过当作下载体积或全库性能验收。

游戏现状已登记E231/E232及对应功能、架构、入口与作者源。机械检查为0结构错误、0未登记文件；只为本批已核对的变更来源更新指纹，保留993项无关历史来源漂移及2条既有警告，不为变绿重设全仓库基线。[源与构建收据](artifacts/r100-fragment-rollout-2026-10-11/final-checks.json)确认最终src/data共780文件与浏览器源快照完全一致；[索引检查](artifacts/r100-fragment-rollout-2026-10-11/game-state-check.json)及[局部基线范围](artifacts/r100-fragment-rollout-2026-10-11/partial-baseline-review.json)可复查。

## 交付边界与后续

此批完成共享机制的首个正式落点；其余107世界需要按材料与空间组织另写layout、重部署并逐批复看。参考样例不是通用模板，随机边seed不替代布局多样性。自然未知探索、连续视听/疲劳、全部孔与照射方向、全seed及全库用户审美仍未验；I14仍13/14、P49保持开放，弱设备补测继续按用户豁免且未测记录。
