# G1 实际空洞缓存固定 c27 对照

**未改善，仍未准入。** 唯一一次同输入 single 扫描得到 `e0a90ba2045acf62`，与较早 wide-area 对照的失败输出相同；未追加尝试、未 fresh。

- 实际 G1 最大距离162.11771197435593px>160，仅此一门失败；deep336px、wide55.074875%、largest99.035182%通过。
- 输入原位18,632个合法身体中心：缓存 H 与正式 H 格边界距离逐点误差 **0**。
- 新最坏点仍为(948,524)。预测H0=156.46085772486356px，最终H-8739同值；raw H0=155.463822px，raw S upper-clamp=156.806317px、最终 S=156.806296px。实际最近结构是H。本次该点的预测准确，不能再归因于H形状漏判。
- 规划 before 最大违规.017135720、合计.019211128；after最大/合计均.029347748，`constraintsImproved=false`。原有single仍返回这一完整候选并由正式门/档案处理，本次未改其选择规则。

## 实现与限定验证

`nativeVoidCellBoundary`成为正式measure与G1缓存唯一的cells→格边界转换，保持旧边序。每次refinement从previous的全部实际H重新构造局部边界，只按当前对象站位平移；G1 fine树消费独立g1Blocking，raw support/rough/deep/mean与G3缓存沿原逻辑。fresh没有actualVoid时明确标记raw-authoring。本次记录来源previous-actual-void-translation、feedbackCandidate27，移动预测不冒充新断缘的精确编译。

[四项有限逻辑回归](../g1-actual-logic-round1.json)通过：共享边序、原位距离、预测通过而手工最终形状被真实G1拒绝、身份/重复格/外海/越界/非网格站位拒绝。typecheck首轮发现旧import未删，修正后[第二轮通过](../g1-actual-typecheck-round2.log)；未更改其他行为。

真实操作4.389秒，仅为单次Node耗时。24,245个fine点，188次最大距离评估（186个原single精评+before/after，每对象≤12），4,558,060次候选距离查询与387,920次其它结构缓存查询。841项来源指纹前后一致。真实before与after各重编一次；没有G2/full/G4、新seed或新fresh。

源码冻结。精确性能剪枝与global初始化退出默认均未混入本轴，等待下一项独立授权。
