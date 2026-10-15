# 三图中尺度扩展 · 独立 QA

2026-10-15；COH-F011 / F012。依据 `system-map-generation.md` 的 DEC-214 与本批任务：固定三图、medium、20261012，共享扩展、原物件形体保留且仅整体平移、原空间判据保留。结论：**宏观扩展已实现并可复看，三图均未完整准入。**

[最终前后图册](browser/index.html)以立即上一轮 macro 图为基准。Chrome 155.0.8059.40，真实 DEV 材质和剪影各三张；六张静帧均已查看，母体及新增实体在两种模式中存在。12 张新旧原图按共同 2496×2144 画框、相同世界像素比例展示，旧图仅 CSS 平移；原 PNG 未编辑。[界面检查](browser/gallery-validation.json)确认全图加载、比例一致、0 pageerror。可点原尺寸、展开材质、跳到对应 DEV。

首轮在 gel 材质栅格超过默认 4M 时失败，split 已导出、ash 未开始，完整保留于 [browser-attempt1](browser-attempt1/capture.json)。最小修复保留默认 4,194,304，仅 DEV 显式申请 5,242,880，硬上限 8,388,608、pixelSize=1；修后获准重采三图。最终 [capture.json](browser/capture.json) 的 SHA256 为 `3b94c0e4db054a57bf1ced79d151d3cfd939b60f1f45be29a6b13396234b92ce`，绑定本批源码/CSV 指纹；来源前后稳定，0 pageerror。最终轮每图 construction、fragment、geometry、visual terrain、raster 各 1 次，full=0；三图/两模式、原尺寸/适配与缓存回访均通过。两轮浏览器共启动 5 次样本构造，不能把最终轮计数当作整批总数。

静审确认扩展候选上限 24、最多 3 块、原并集净增不超过 30%，每接受一块追加完整 2H/1S；候选预筛不调用地图几何搜索。原 input 未改，数量/面积派生仅进入显式 DEV assessment。旧岸匹配保留原索引 key，新岸使用扣除整体平移的坐标 key。普通入口与旧恢复未新增调用扩展；本批不重验其完整运行。

实际接受 split/gel/ash 为 **1/2/1 块**，候选计数 15/14/15，最终均 H14:S7。孔身份及完整源支撑违规均 0，身体可达/支持座位分别 23653/23653、24661/24661、21044/21044。相对上一轮，外环面积增长 **10.4%/24.4%/12.5%**，实际可走面积增长 **11.1%/22.1%/11.1%**，没有用缩小原主体换大形。实际画框为 2304×1792、2304×1984、2304×1824，平移为 (0,32)、(192,0)、(0,352)。[精简前后数值](browser/comparison.json)保留完整来源及失败理由。

最终失败不沿用离线 round2 数字：

- **双脊渡口**：岸线 286.96≤384；仍有 `walk-area-outside-intent`、`G1-largest-empty-radius`、`G1-long-deep-empty-region`、`G3-wide-domain-area`、`G3-wide-domain-connectivity`；G2 `body-route-to-cover-exceeds-limit`。
- **断脂浅片**：新增长直岸 **441.58>384**；G1 最大空白/长深空白仍失败，新增 `G3-wide-domain-area`，wideRatio **0.534082**（原 0.550208）；G2 通过。
- **无彩层原**：新增长直岸 **463.56>384**，共 2 段；新增 `walk-area-outside-intent`（实测 1,346,816 / 目标 1,505,604），G1 最大空白与 G3 宽域面积仍失败；G2 通过。

最终回执未保留 G2 coverage 嵌套标量，只能确认门结果及原因；工具已补保存该字段，本轮不为补数重构，离线 round2 最远路程不能冒充最终值。

静帧显示 split 向上、gel 向左及下、ash 向上增加宽地块；宽臂与母体仍读作同一套实体/材质，没有变成细廊迷宫。残余：新增均为宽臂，短肩本批未接受；端部成对孔与中部实体重复，仍有模板感和长直岸。宏观诊断 square/bar 均 false 不等于品质通过。不扩参数循环；未验证完整内容部署、实际潜行体验或人审美术认可。
