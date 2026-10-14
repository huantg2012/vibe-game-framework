# G1 足迹来源只读审计

结论：**G1 仍用 raw H 矩形足迹规划，最终门使用实际 8px VOID 边界；但 c27→28 的这次超限不能仅归因于足迹差异。实际最坏点确实漏出规划采样域，而该点到 raw H 的距离本身已经超过规划限值。** 这是独立于后续全局初始化实验的历史固定样本分析。

## 已有证据

- [收据](wide-area-c27-round1/report.json)：来源稳定，before hash `1100442b556caf23`，after hash `e0a90ba2045acf62`。after 规划 `maximum=0 / sum=0`（mean=22.546315811578907，并非整个 tuple 每项为零）；实际只拒绝 `G1-largest-empty-radius`。
- 实际最坏点 p=(948,524)，`maxEmptyUpperPx=162.11771197435593`。减去正式 `4√2` 后，实际最近结构距离为 **156.46085772486356**。deep=336、wide=0.5507487520798668 均过相应门。
- 保存的 [proposal](wide-area-c27-round1/proposal.json) 中，H0 是 `plan.objects[2]`、`holes[0]`、`definition.erosion[1]`；实际结构 ID 为 `H-8739`，最终包围盒 [776,240]–[984,368]。

## 来源与采样口径

[`native-spatial-layout.ts`](../../../../src/generation/world-study/native-spatial-layout.ts:70) 的 `planningObject` 将 H 原始矩形分成三角形；S 使用模型实际投影。`siteFor` 与 `completePlanningScore` 的 G1 距离都查询这些 `blocking`。`actualVoid` 仅交给 `NativeSpatialWideDomain`，返回的 `wideCount/largestWideRatio` 用于 G3，未进入 G1 距离。

规划在每个 16px 格抽一个 8px 身体中心相位，并要求 raw L−B 的 `ground.margin>=12`，另加历史 assessmentPoints；最大距离限值为 `160−8=152`。最终门则遍历全部实际 supported 8px 身体中心，对合格 H 的实际 VOID 格边界与 S 投影求最近距，再加 `4√2`。外海/B 都不计作 G1 结构。

## 此最坏点可确认的分解

1. **漏采确定。** p 所在格 [944,960)×[512,528) 的固定相位选中 (948,516)，p 不在额外 assessmentPoints。raw 土地在此处内部，距其外岸至少300px，故不是 `margin>=12` 将该格滤掉；是该格仅抽一个相位。规划相位到 raw H0 为 **147.48898263938224**，p 到 raw H0 为 **155.46382215808282**，最近点 (936,369)。
2. **H0 是实际最近结构之一。** 只对保存轮廓做六个局部点归属算术：中心 (932,364) 在 H0 内，而 (940,364)、(932,372) 在外，故其实际 8px 格边界包含 (936,368)。该点到 p 距离恰为 **156.46085772486356**，与收据中全结构最小距离完全相等。因此 H0 至少并列最近，不能把此点归给海岸；不能据此断言没有 S 并列。
3. **断缘/离散化确有约0.997036px贡献。** 原始 H0 的距离比实际最近距离少 **0.99703556678074**。但 raw H0 距离加正式误差已是 **161.1206764075752>160**，且155.463822>规划152。即使取消这约1px差异，该点的 H 覆盖仍不足；不能把“只让 G1 换成实际 H 边界”称为已证充分修复。

第2项没有编译地图或新建全图栅格，仅查保存轮廓在六个既有坐标的包含关系；上述距离是保存数据的解析计算。

## 证据边界与最小可证伪动作（未执行）

收据未保存逐点 raw 全结构距离、规划最大值位置、S 三角形或实际最近结构 ID。上述155.463822是 **raw H 最小值，不冒充 raw H+S 最小值**。S 的两条源码路径使用相同形体参数、seed、builder；区别为局部 Float32 后平移与绝对位置 Float32，未见米级形变入口。但本次未补建 S 网格，故不宣称已有数值证明 raw S 不会改变该点的最小值。

最小后续判别：在下一次**另行批准的同一保存 proposal 真实测量**里，仅对 p 与已有规划相位输出 raw-H / raw-S / final-H / final-S 距离及最近 ID。若 raw-S(p)≤152，“raw 全结构也漏掉超限”的推断被否证；若 raw-S(p)>155.463822，则确认此处采样遗漏本就足以造成规划误判，H 边界差异只是额外约1px。无需新种子、移动物件、加 margin 或扩候选；本审计没有执行该动作。

## 可追溯性

- report SHA256 `74ecf314e0c1744d10d98d3352efff3ede95c251461f8ada70fa2aeeafead041`
- proposal SHA256 `ae7e916b4390cd47832ef74560d745c69684227179f4c3ab9632a83699f3dc7c`
- 收据记录839个来源指纹且前后一致。本次核对 geometry / native-terrain / native-volume-geometry / seed-fork 的现文件 SHA 仍与收据一致；layout/measure 后续有已登记功能修改，本文按当前 G1 查询链核对，不将整文件称为历史字节相同。
- 本次只读源码与保存 JSON，写本报告；**0 新 geometry、0 新采样、0 源码修改**。
