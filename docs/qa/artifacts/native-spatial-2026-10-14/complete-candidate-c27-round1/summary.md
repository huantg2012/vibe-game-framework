# 固定 c27 → c28 的唯一完整链验证

结果：**G1/G2/G3 通过，完整内容部署完成，G4 拒绝。没有准入新地图。**

来源为 `g1-incumbent-c27-round1/proposal.json` 的 c28，实际 geometry hash `9faebdbd40a92649`；完整冻结 recipe 逐字段取自历史 `production-gel-core-shoulder-round1.json`，六类 intent 及非几何字段一致，没有换当前默认规则。gel-rafts / medium / requested seed 20261012，layoutSeed 3736298009。

只执行一次，耗时 1,719.93ms；sourcesStable=true。共消费 1/72 geometry work、1/2 full 候选；没有补 seed、fresh、第二份 full 或重试。

- G1/G3：11H / 5S，最大空白 158.334px、deep span 336px、宽域 55.0749%、最大宽域连通占比 99.0352%，全部达到冻结门。
- G2：11 个 H 均有实际 q/v/t 见证。18,631 个身体中心全部覆盖，最坏到合格 q 的路线 280.57px，超限 0、不可达 0。
- extraction → master → expedition 使用生产同一函数，端点与物理栅格不变断言通过。记录为 3 个敌人、5 个薪柴节点、3 个污染物节点、6 个非 safe 节点的 2400ms 翻找窗口、8 条 grounded 来源。
- G4：20 条实际直接撤离/节点往返/区域探索路线，其中 12 条满足遭遇配比评价前提。五条路线的 H 遭遇占比越过 0.60–0.75 区间，另两条出现过长窄段（其中一条同时窄段占比过高），因此完整候选拒绝。

G4 的五条配比失败：contaminant-contested-1 为 6/6；contaminant-deep-1 为 4/7；kindling-contested-1 为 4/7；kindling-contested-2 为 3/6；explore:3 为 5/6。窄段失败：contaminant-deep-1 最长连续窄/不确定段 328px；explore:11 最长 312px，窄段比例 25.591%。冻结限值仍为 224px 和 20%，未放宽。

完整机器证据在 `report.json`，可读数值摘要在 `summary.json`。报告包含完整 G2 和 G4 数据，读取时应投影需要的字段，避免直接打印全体见证/路线数组。

**验证限度：** 独立的逐 tier 数量/价值、实际 Host pins/forms 和巡逻扫掠精查目前位于工具的最终 success 分支。此次 G4 提前拒绝，这些独立后验检查未执行，不能用 master 请求的 Host 数量代替实测通过。上述内容数量、窗口及 grounded 来源是正式 deployment 的阶段诊断；没有完整 map、真实整图 replay 或玩家体验通过。
