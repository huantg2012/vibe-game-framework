# c11 固定初始位序 A/B：B 无完整合法布局

结论：保持生产作者顺序。A 完整复现原 c11；B 的 S→H 顺序在第 10 个 H 无合法站位，未得到完整几何。此固定样本否决直接采用该顺序，不能宣称全局构型无解，也不追加另一种顺序或候选。

## 同源约束

- 请求 seed20261012，geometrySeed 沿原正式请求，c11 `layoutSeed=4254622511`；11H/5S/B2。
- 只恢复原 c11 的作者阶段，在落位前截取；局部形体、profile/instance 身份、完整支持对象、L/B、land joins、edge seed 与已保留同祖先 c25 全部严格一致。
- 每件原 185 个候选坐标在作者顺序下预采；两臂使用同一冻结池，逐件 SHA 在 `report.json`。共用原共享 Stream，池末游标 26800；没有按新位序重新消费随机数。
- 作者对象与 H 身份顺序保持不变，只有未完成初态的访问顺序变化。完整评分、raw 支撑、12 槽、H 资格、72-work/60s 均未改。global initializer 不参与。

## A：严格原样复现

几何指纹 `2eae1ed8d00cc188`，完整 gate 与原收据深相等。实际11H/5S；G1 最大半径 232.848403px、deep span488；wide49.270034%、largest-wide89.288850%；身体面积1,183,616px²。原有 G1最大半径、G1深空白长段、G3宽域面积三项失败保留。

同一 raw L−B 基础场6,001点到 S 阻行投影的最大距离714.728709px，均方距离70,200.000703px²；relief 不计入S覆盖。这是对照基线，不是新增接受门。

## B：有限域耗尽

顺序为 `0,1,10,12,15,2,3,4,5,6,7,8,9,11,13,14`。作者索引13，即 `hole-9`（第10个H）失败：原185候选合法0，原有field兜底检查5,957个去重站位后仍合法0，完整评分0、H资格0。最后的 `hole-10` 未尝试。

B 未执行最终 fragment/geometry，因此没有 B 的 G1/G3、身体面积、S分布对照或母体最终位点验证。报告保存失败对象、候选计数、原始顺序与共用池；本次原异常只携带失败对象的 `placementSearch`，**此前成功落位的B前缀坐标没有被持久化**。不为补该材料重新运行B，也不据此推断是哪件已放对象封死剩余域。

## 工作量与验证

总2.719137s，`sourcesStable=true`。共3个计账 work：A最终pipeline1、A孔资格1、B最终pipeline预留1；失败不退还。真正完整几何/测量仅A一次，B的预留标记 `finalMeasurementStarted=false`。0 refinement、0 full、无重试。

本批生产改动仅限 `native-spatial-layout.ts`：抽出原坐标生成，fresh按作者序预缓存，落位索引与身份索引分离，具名冻结fixture诊断入口。生产默认仍作者序。新5组纯候选/身份/路径检查与既有7组初始域/资格/预算检查全过，`tsc --noEmit` 通过；共享源码最终由另一代理完成dev冒烟。A严格复现只证明该固定源的行为等价，不外推所有seed验收。

- 完整收据：`report.json`，SHA-256 `7526fb189389aef8ece652430827ded506d910d127de2f992fd57f458493fac1`
- 冻结输入与逐件候选池：`fixture.json`
- 原样失败基线：`candidate-A.json`
- 工具：`tools/native-spatial/capture-initial-order-ab.mjs`
- 逻辑证据：`../initial-order-logic-round1.json`、`../initial-order-default-regression-round1.json`
- 类型日志：`/tmp/coh-initial-order-tsc-round1.log`

源码已冻结；未翻生产，未追加fresh或任何几何。
