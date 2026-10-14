# G4 短路线离散比例校准

2026-10-14，Director在DEC-209实施范围内批准逻辑校准；无新用户PASS。此处只验证计数规则，不运行地图、G1/G2/G3、内容部署或G4几何路线，不以当前候选能否通过为判据。随后Complete Code已[限定接入并验证](../route-share-production-round1/summary.md)：保存runtime的20条官方路线只减少两条4H/7比例拒绝，其他5项失败保留，无新几何；下文保留Design独立数学证据和接入合同。

复跑：`node tools/native-spatial/check-route-share-calibration.mjs`。

## 结果与独立反例

[结果JSON](report.json)全部通过：N=6–32的540个整数H取值、理想H/H/S周期的81个起始相位；新旧差集只有N=7/H=4，没有删除旧的合法计数。脚本读取并断言当前CSV的目标2:1、最少6件、比例.60–.75及六窗至少3H均未改变；未导入任何生产代码，geometryRuns=0。

依据不是当前图：周期从S起取7件为`SHHSHHS`，4H/3S；它与从H起取样仅首尾相位不同，且所有六窗都是4H/2S。旧连续比值门却只接受7件5H/2S，这是离散截断造成的拒绝。数值校准采用**原连续比例域与理想2:1周期相位整数域取并**，不是替换为精确周期，更不是所有计数任意±1。

- 显著负例`HHHHHH`、`HHHHHS`、`HHHSSS`、全S与长1:1序列仍拒绝。
- `SSSSHHHHHHHH`有8H/4S，计数合格，但第一个六窗仅2H，仍由六窗拒绝；同计数的`HHSHHSHHSHHS`通过。计数容差不能吞掉序列门。
- `HHHSHHHSHHHS`有9H/3S，原连续比例.75合法，虽不属于理想周期计数，仍合法；不能意外收紧旧带宽。
- 出返重复6次但仅有3个唯一身份仍不足6件；不以重复相遇凑资格。该项只是计数入口的合成诊断，不代替生产身份/LOS测试。

对任意N≥6，新增只会发生在N=7/H=4，也可直接证明：令N=3k+r。r=0时相位计数恰为2k；r=1的较小相位2k低于.60N仅当k<3，而N≥6只留下k=2；r=2的较小相位2k+1在合格N范围内始终≥.60N。各较大相位在N≥6时都≤.75N。因此N>32没有另一类隐含放宽；枚举与这一独立算术结论相互核对。

## 给 Complete Code 的纯函数合同

建议函数名`classifyNativeRouteHoleShare(holes, total, minShare, maxShare)`；实现位置由Code决定。它只接受**已按完整出行首次身份去重**的H数量与H+S总数，B不入分母；holes/total必须为合法整数计数，total>0，0≤holes≤total，比例参数必须有限且0≤minShare≤maxShare≤1。非法输入应暴露调用错误，不截断、四舍五入或返回准入。调用方先按既有长度、最少6件规则判资格；不合格样本继续仅诊断，不能靠本函数转成通过。

返回至少包含`accepted`、`continuousAccepted`、`phaseAccepted`以及`basis: 'continuous-band' | 'periodic-phase' | 'outside'`。判定：

1. `share=holes/total`，`continuousAccepted=(share>=minShare && share<=maxShare)`，沿用冻结CSV的.60/.75，含端点。
2. `phaseAccepted=(holes>=floor(2*total/3) && holes<=ceil(2*total/3))`。2:1是本次已锁目标，不是新自由调参；不要写`total===7`特例或取整share。整数计数安全运算即可，不能引入任意浮点epsilon。
3. `accepted=continuousAccepted || phaseAccepted`。basis优先记continuous-band，其次periodic-phase，否则outside。

只替换原G4每条合格完整路线的比例布尔判定。现`holeShare`报告仍如实记录4/7，不能钳成.60；可另报判定来源以表明短相位校准。原六窗检查必须继续独立执行，不能在本函数接受后提前return跳过；有效身份合组、112px/LOS遇见、路线选择/平局、短样本资格、全局H:S和区域摘要都不变。窄路合同与G1/G2/G3均不变。旧失败收据不重写；该逻辑验证不证明任何一张地图已准入，也不改CSV。

Code接入后至少重用本报告的显著负例、相位正例、同计数六窗反例及原.75非周期正例，对生产函数做同源单元验证；几何或完整请求必须另有登记。本次仅交付工具、数学证据及文档合同。
