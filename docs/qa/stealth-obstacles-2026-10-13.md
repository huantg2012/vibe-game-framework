---
status: IMPLEMENTED / LIMITED-VERIFIED — 三代表局部实体补布；全库与潜行体验开放
date: 2026-10-13
features: COH-F011 / COH-F013 / COH-F006 / COH-F007 / COH-F012 / COH-F014 / COH-F015 / COH-F019 / COH-F044 / COH-F052
---

# 开放碎片中尺度障碍补布

用户指出全库图册仍有大块空地，缺乏潜行结构与记忆点。截图为双脊渡口。本轮先设计，制作三张代表的同材实体关系组，经一次长宽高比例校正后进入正式新局数据。**三图局部结构已改善；全库空旷问题、实际敌人潜行行程尚未结案。**

[三图前后对照](artifacts/stealth-obstacles-2026-10-13/root-owned/index.html) · [设计](../design-notes/stealth-obstacle-distribution-2026-10-13.md) · [美术与剩余留白](../art/stealth-obstacle-distribution-2026-10-13.md) · [任务](../tasks/rift-spatial-rollout.md)

## 实际改动

- 双脊渡口实体2→7：东北2件、西南3件，以长伏肋和厚短叉错位布置，原双脊主景不变。
- 断脂浅片实体2→8：北、西南、东侧三组长低/短厚凝块；原4件relief可走浅片不变。
- 剥皮露庭实体1→7：西、东北、南侧三组长薄折返/立厚断片；原2件relief不变。

共追加17件，CSV单向生成，原实例、排列、地床、外岸和空洞保留，其他105图数据逐字不变。每个新source只消费一次。现有r10执行器、完整nativeDefinition/spatialPolicy配方冻结未改变；未修改碰撞、感知规则或内容配额。

**普通solid只挡身体与近战，不挡玩家或敌人视线。** 本轮真实VOID/sight格与原图一致，不能把实体增多称作新增潜行掩体。地标与绕行收益、遮视与遭遇体验分别评价。

## 限定验证

完整生成使用三图×低/中/重×请求seed 20261012/0，最终18/18通过；首轮18例另保留，不覆盖。包括配方恢复、source-once、实际足迹、全身体可达、资源站位及巡路窗口；最低身体可达99.9899%。[最终生产收据](artifacts/stealth-obstacles-2026-10-13/root-owned/production-final/report.json)、[独立收据核对](artifacts/stealth-obstacles-2026-10-13/qa/final-receipt-audit.json)。请求seed的有界拒绝与effective seed留在各例，不把重试前失败删掉。

旧r10在改数据前捕获三图三档9份完整配方，改后9/9完整map哈希相等；三中档intact/searched两态四通道RGBA和翻找patch精确一致。[旧局回放](artifacts/stealth-obstacles-2026-10-13/code/after-final-old-replay.json)。这是冻结配方重放，不是正式保存界面的冷续操作。

新增诊断用真实三角投影与完整身体可达中心采样，排除relief/地面纹理；距实体>224px的比例分别为 **61.39→33.29%、70.45→26.74%、81.87→24.47%**。最大连续净空半径分别为 **268→204px、291→209px、316→267px**。这些是结构分布指标，不是安全率。三图指定出生→撤离路线完整20px身体扫掠通过。[前后量化](artifacts/stealth-obstacles-2026-10-13/code/comparison-final.json)。

8/8关系组有严格双侧绕行见证；其中13/17单件取得双侧受限路线，另4件（split id4/id7、gel id8/id12）有限搜索未获见证，既不宣称通过，也不推断通路断裂。13条闭环由独立QA重新执行NativeBodyCollision扫掠。路径边距不等于开口最窄宽度。[路径证据](artifacts/stealth-obstacles-2026-10-13/code/group-witnesses-final.json)、[独立复核](artifacts/stealth-obstacles-2026-10-13/qa/final-detour-recheck.json)。

独立几何检查确认原实例全部真实顶点/索引/UV/法线和材质参数一致，matter/VOID及共享玩家/敌人sight格零变化；17新件均存在身体被挡但LOS透过的见证。三图各有3处真实玩家VOID揭露见证；不是实际敌人巡逻或听觉验证。[几何与视线](artifacts/stealth-obstacles-2026-10-13/qa/final-geometry-and-player-void.json)。

诊断工具首轮曾将北侧封死、都绕南侧的路线误报双侧，也曾未把路线失败传到总状态。QA反例暴露后已修复：真实三角内点、相反半平面与闭环环绕检查；失败返回非零。原失败和修后负控保留。生产算法未因此修改。[独立QA](artifacts/stealth-obstacles-2026-10-13/qa/report-stealth-obstacles.md)。

CSV/codegen一致性、TypeScript、5组合成正反例、既有身体边缘测试、`npm run build`通过；构建保留既有大chunk提醒。[代码报告](artifacts/stealth-obstacles-2026-10-13/code/report.md)。

## 浏览器与图审

Root在3027隔离内存巡览中，使用真实WASD走到三图新增组附近：双脊西南长肋前后、断脂东侧厚块旁、剥皮西翼断膜开口。正常肩灯、迷雾、危险与消费均开启，未改正式存档；三图截图在[浏览器记录](artifacts/stealth-obstacles-2026-10-13/root-owned/browser/README.md)。运行控制台未见warn/error。可见实体与地面尺度关系成立，孔端和通路没有变为全图走廊。

这是有限局部移动和正常相机观察，**不是完整搜撤、未知导航、敌人接近→等待→绕端→撤回、FPS/预算或用户审美通过**。本轮未验证真实潜行收益；仍保留有意开放的宽床。Art已直接检查最终三张生产全图，未发现须回退的静态阻塞，残余同profile重复感记为润色候选。[美术复核](artifacts/stealth-obstacles-2026-10-13/art/REVIEW.md)。

## 未完成范围

全库其余105图的中尺度分布仍需按世界逐图处理；不能套17件或一个空地率填满全库。后续需补壳类source-once及拥挤反例、实际巡逻下可达遮视站位与暴露行程、重档运行预算。若宽面遭遇仍缺遮视机会，应针对现有孔端与通路另做局部方案，不能把本次solid当掩体。I14仍13/14，P49和既有WU-01/WU-02待办保持。
