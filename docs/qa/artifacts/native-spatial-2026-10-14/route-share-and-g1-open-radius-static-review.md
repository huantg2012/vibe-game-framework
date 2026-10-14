# 短比例接入与 G1 §14 可实施性静审

范围：只读源码、§12/§14 和既有回执；本轮没有运行测试、恢复几何、采样或修改生产源码/CSV。关联 COH-F011/F052。没有发现短比例接入阻断项；§14 可直接利用现有实际几何查询做离线双测。下述规划接线只是后续方案，生产 G1 本轮不变。

## 1. 短比例实现

`native-spatial-routes.ts:21` 的纯 classifier 消费冻结 policy 的 `holeToSolidRatio`，没有硬编码2。接受域为原连续带与 `floor(ratio*N/(ratio+1))..ceil(...)` 整数相位域的并；返回来源，不覆盖原始 `holeShare`。连续合法的非周期比例仍保留。

计数要求安全整数、`N>0`、`0≤H≤N`；带宽要求有限且`0≤min≤max≤1`；ratio 要求正安全整数，`ratio+1` 与 `ratio*N` 也要求安全整数。故 NaN、Infinity、小数计数、反向区间、溢出乘积与不支持的分数周期会显式拒绝。最大安全乘积保护让 floor/ceil 的整数边界不依赖超出整数精度的乘法；当前实际数量远低于此界限。

调用位置 `routes.ts:112–117` 仍先按原完整路径长度和首次遇见数计算 eligibility；不合资格时 admission=null，不提升资格。原每身份只记第一次、完整平滑路径、六遇见窗口、窄段、区域去重逻辑均保留。新增字段只是比例判定来源。已读 `route-share-production-round1/report.json` 的540计数/81相位、非法输入与20条保存路线差异证据；未重复运行。其“只移除两条4H/7比例拒因，其他字段与拒因保持”的边界与代码相符。

## 2. 实际空圆：现有查询已足够

`native-spatial-geometry.ts:95–107` 的 `nativeVoidPrimitives` 遍历最终 tileMap 上的地面—VOID相邻格边，包括内部孔、岸湾、外海以及地面接frame外的边。`native-terrain.ts:97` 的VOID判定直接来自同一最终matter；`geometry.sight` 同源，但只提供VOID占用，不提供连续距离，也不包含实体阻行。

`geometry.solidDistance` 使用最终实体三角投影，排除relief；`geometry.voidDistance` 使用上述所有实际VOID格边。对现有 `geometry.supported[cell]` 的同一中心p，直接算：

`openRadius = min(geometry.solidDistance(p), geometry.voidDistance(p))`

这是实际地面上的无实体空圆半径；不需要新栅格、射线角采样、raw作者矩形或第二遍身体侵蚀。两个闭集合距离均为1-Lipschitz，取min仍为1-Lipschitz，因此沿用原8px格中心的`+4√2`，得到所代表单元内的保守上界。须准确称同一8px采样域的连续保守上界，不将其宣称任意导航离散化的独立完整性证明。

**域约束不可省略。** `voidDistance` 是到边界的无符号距离：若将外海点直接送进去，它可能返回很大的正数。实际门须继续只遍历原supported中心；对额外诊断点先确认最终matter/solid资格。frame外也必须视为VOID，不能因为没有存入mask就当作开阔地面。

新量应逐点满足 `openRadius≤d_internal`：它的实际阻行/VOID集合包含计数中合格H/S的边界。若出现反向差异，先检查几何/缓存来源，不调门。被拒无效H/S仍不能因新max低而消失，其数量、身份与支撑拒因独立保留。

## 3. 测量端最小位置

`native-spatial-measure.ts:121–127` 当前在同一个supported循环里计算内部结构距离、max、deep和G3。候选双测仅新增一个max累加器与自己的worst；可复用这一轮已有的solid/void查询结果。原 `distances[cell]` 继续写 `d_internal`；原 `deep[cell]` 继续用 `d_internal+4√2>112`。后面的deepBody侵蚀、links8组件、跨度、原worstDeep都不动。

保留旧内部max/worst作为诊断，同时独立记录候选open max/worst及边界来源。不要用observer的Float32 `distances` 回算精确max；原gate在舍入前的double距离上累加。离线合同尚未批准生产切换，当前实际拒因字段仍沿旧口径。

## 4. 未来规划端最小接线

当前 `layout.ts:161–168` 的 complete score 与 `:224,261` 的 single精评仅将 actual H 边界和S投影用于fineMaximum；外岸/B目前只参与支撑与G3。若未来生产切换open-max，这两处必须共同接入同一只读“地面边界限制”，不能只改最终gate。

建议一个运行期G1预测上下文，提供 `exteriorRadius(p)` 与每对象的“填充足迹距离”：

- 有actualVoid时：固定的 `exteriorMask` 包含B与外海；从其原始格边建立边界，并显式加入frame四边。full-frame无外海格的夹具仍需frame边界。复用共享 `nativeVoidCellBoundary`，不要再写一套不同顺序/尺寸的格边算法。
- H继续使用已验证双射的actual cells与局部边界，按当前站位平移。除边界距离外，点落在该H的实际cell内部时必须返回0；只有线段边界时，孔内部点也会得到正距离。移动H后旧孔位置应填回，新孔位置占空；同一精评的其他H保持对应当前站位。
- 固定exterior mask只能包含外海/B，**不能将整张旧VOID occupancy固定用于置0**：那会让搬走H后的旧坑位置永久被当成VOID。内部H占用必须与该对象当前site/试位一起平移，与其actual-H边界同源；每个当前或移动H的内部才返回0。
- S沿同源完整实体投影，内部距离已为0；relief不进入覆盖/空圆。外海或frame外点贡献0/排除，不能将其无符号岸距当半径。
- `NativeSpatialWideDomain` 的occupancy/coast已经膨胀48px，只适合wide测量，不能拿它当原始VOID；可复用输入actualVoid，不能复用该膨胀mask代替地面。
- fresh没有actualVoid时，使用原raw L−B的有符号margin（外部钳0）、原raw H填充矩形与同源S，只能标为raw预测。actual H平移也仍是预测：fragment v1重新断缘非平移不变；每份最终图照常重编实测。

single可将固定外岸半径并入 `fineRemaining`：`min(exteriorRadius, unchangedObjectsDistance)`，移动对象仍单独求距。现有降序上界剪枝 `max min(remaining,moved)` 仍数学等价，12槽不增加。complete/joint的fineMaximum使用完全相同的min组合。现有field点集、规划限值和预算不借此更改；尤其实际岸外assessment点须正确贡献0，不能产生虚假开场。

fine预测的点集与最终gate的supported中心域分别处理：fine并非一张新编译图的正式身体域，不能因为它正确区分了预测VOID，就跳过下一次最终重编/资格/实测。

**不要把外岸同时混入旧内部距离数组。** `field.map(...blocking)`、deepSpan输入、原均方excess/mean、内部结构q/遇见与H/S身份维持原样。rough若以后同步open-max，也只能改其max项，不能整体截断distance数组而顺带让deep/mean缩小。joint的见证选择仍要区分open-max witness与内部deep witness，不把岸线当新增结构。

## 5. 必要的限定反例

后续实现建议覆盖：full-frame无exterior cells仍有frame界；外海深处/孔内部点半径不为正大值；H移动后旧孔填回、新孔占空且B不动；single与complete原位预测一致；descending剪枝和全扫同值；逐supported中心 `open≤internal`；短岸角与真实大开场分开；200px长沿带的内部deep仍拒；同长带增加有效结构后deep变化来自内部P；所有非max正式字段完全一致。移位缓存预测与重编不一致仍交实际gate处理，不能拿原位一致声称移位exact。

§14的7份冻结/合成校准批仍由既定执行者负责，本静审没有运行其中任何一份，也不提前宣布c25可准入或fresh成功。
