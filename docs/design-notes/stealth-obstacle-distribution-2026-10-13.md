---
status: IMPLEMENTED-PARTIAL — r11共享能力已接入；有限技术验证与未实现诊断分列
created-by: design agent
created-date: 2026-10-13
last-modified-by: code agent（实际接口与诊断边界核对）
last-modified-date: 2026-10-13
scope: COH-F011 / COH-F013 / COH-F007；关联 F006 / F012 / F014 / F015 / F019 / F044 / F052
supersedes: 99998703中“逐图手放、首批只solid、原孔保持”的后续方法；历史证据不撤销
---

# 实体与空间空洞的联合增补策略

**当前目标是共享生成能力。** 用户明确纠正：先建立空间衡量标准，再由策略比较实体、空间空洞和组合候选，不能把全库问题缩成三图手工加实体。矩形拼合与自由断缘仍是空间基础，开放、漂泊的世界碎片仍是体验目标。`99998703`仅保留末节的历史接入与有限验证；其“本轮不改孔”不约束本方案。r11共享能力已接入全部108个注册世界的新局；这不保证每图实际增补或达到策略目标。新v4模板策略的有限正式生成与保存重放已通过，精确范围/计数统一见[专项QA](../qa/spatial-augmentation-2026-10-13.md)；未实现诊断与体验判断在本文分列，不由接入代签。

正式规则在[地图spec](../specs/system-map-generation.md#medium-scale-obstacle-authoring)，任务在[推广任务](../tasks/rift-spatial-rollout.md)。本方案不改变ordinary solid的LOS、不调整感官/速度/收益，也不另做全局AI潜行模拟。

## 1. 世界语义与接口边界

- `matter`表示真实地面，包括普通实体下仍存在的地面；`solid`的真实三角足迹阻身体/近战，不阻玩家或敌人LOS；`relief`可走。VOID缺地、阻行、阻视线、不能被照亮。
- 身体结构不足与遮视机会不足是两个独立量。实体可解决前者，不能以件数、阴影或前景遮人抵扣后者；VOID可同时改变走法与信息，但不能凭挖掉难点获得假改善。
- 增补作用于共享基底几何：连续宽地和原世界材料秩序先成立，再增补能改变局部接近/观察关系的结构。不是先画路线再包成走廊，也不是给108图分别填坐标。
- 独有原主体仍按其既有source-once消费。新增solid来自材料族的**独立从属profile**，不缩复制独有肋架、四壳或单柱；无合法同族profile时拒绝solid候选，VOID仍可参与比较。profile的形体范围归Art，算法不自行发明替代造型。

## 2. 实际生成插点

当前入口是 `createR100SpatialWorldCandidates`：在 `createR100SpatialDefinition` 之后、`inspectSpatialTerrain`/出撤/Host部署之前调用：

```typescript
augmentSpatialTerrain({ definition, fragmentShape, policy, seed, candidateSeed })
  -> readonly SpatialAugmentedTerrain[] // 最多两个plan
```

每个plan包含实际 `definition`、更新后的 `fragmentShape`、`addedSolidIds`、`addedVoidCount`、可选关系组记录及 `trace`；首项是最佳合法结果，存在前一合法态时再返回其作为后备。`seed`是mesh构造/评价的有效几何seed；正式入口必传独立派生的 `candidateSeed`，纯fixture省略时默认取 `seed`。

`native-terrain.ts` 已从 `createMasterWorld` 抽出共享轻量地形；`spatial-augmentation-measure.ts` 在其上提供真实solid面、8px matter/VOID、完整20px身体查询、连通域及LOS。候选轮只消费这一层，**不反复做1px全图材质烘焙、Host和完整内容部署**。`createR100SpatialWorldCandidates` 对plan逐项选择撤离并调用 `createMasterWorld`，再由生产控制器调用 `deployR100Expedition`，不会先烘两个完整世界。实际轮廓写入最终definition；最终fragment快照保存在 `native.diagnostics.spatialAugmentationFragmentShape`，不会让支持/LOS/材质继续消费旧孔。

候选、最终生产、DEV诊断和恢复必须消费同一几何规则。诊断工具不能成为运行时的另一套近似世界。

## 3. 测量域与防止“挖掉坏点”

基底记作0，每个候选记作c：

1. `G0/Gc`：8px地面支持格；`S0/Sc`：真实solid XY三角足迹；`B0/Bc`：完整20px身体能站且能由基底合法出生候选进入的中心集合。连通还要检查相邻中心的连续扫掠，不能只看端点。
2. 几何统计保留8px口径；收益评分使用从`B0`确定的32px固定样本`P0`。固定样本、评分区域和原有效LOS端点对在一次补全过程内不重抽。样本位移只能是算法版本声明的确定性采样，不能随候选挑好看位置。
3. `dSolid(p)`为到真实solid足迹的距离，`dVoid(p)`为到最终VOID边界的距离，`clear(p)=min(dSolid,dVoid)`。现有生产trace报告固定样本的两轴平均负担，不直接输出这些距离的最大值、P50/P90或距solid超过224px比例。距离分布仍是可由几何查询补充的诊断意图，不能说本轮生产trace已提供，更不是潜行覆盖率。
4. 候选使某个原样本不再可站/可达时，该点保留原缺口成本，**不算缺口消失**。LOS端点被挖掉、挡住身体或断联同样不能记作新增遮视收益。共同存活/可达子集的前后差异摘要尚未实现，仍保留为后续诊断，以分辨几何改善和分母变化。
5. 独立硬计`|G0−Gc|/|G0|`、新增solid足迹在G0上的并集比例及`|B0−Bc|/|B0|`；不以逐件长×宽相加，也不将身体站位损失叫作实体面积。8px栅格占地是保守口径时须明确标注，不冒称连续精确面积。

## 4. 两类缺口与候选区域

所有产品尺度来自策略CSV；以下为首版初值，需以实现后的有限样本校准，不是每图统一密度。

**身体结构缺口。** `f(p)=clamp((clear(p)−physical_radius_px)/reference_sight_px,0,1)`。初值112px净空核只用于找候选区域：连成的核达到一视距平方面积（224²px²）或两视距跨度（448px）时，列为可比较热点；不是“超过112px就是坏图”。按负担最高、局部净空峰值及离已有候选组的距离选择热点。`dSolid`用作材料结构诊断，不强制每个视口都有实体。

**遮视机会缺口。** 对`P0`每点，取固定8个方向、半径112/208px的探针，使用基底中有效且同身体连通分量的端点建立固定配对；至少4对有效时才进入本量。用真实VOID LOS求有效配对中的遮断比例`b(p)`，定义`o(p)=clamp((target_blocked_pair_ratio−b(p))/target_blocked_pair_ratio,0,1)`，首版比例0.25。不能因候选删除端点而缩小分母或将它算作blocked；被删除端点按其原配对成本保留。地形上没有足够可站目标的外围样本记为不适用，不伪记良好遮视。

`o`只是静态信息分隔的筛选量。凡因遮视收益入选的候选，当前实现要求至少一处真实见证：初始观察点必须位于该候选热点影响半径内，两端身体可达、在208px内由本次新增VOID断视，沿完整身体路径换位80–720px后，目标进入224px参考视距且VOID射线畅通；目标是地面观察点，不冒充敌人。实际敌人的朝向、听觉和追击另验。

热点以224px影响半径评候选，但不切成铺满全图的正交单元；最多取本轮3个热点槽；同轴热点中心至少相隔一个影响半径，不能将其称作影响圆完全不重叠。身体热点、光学热点可重合，也可分离。基底宽地的相对保留门优先于压低热点分数，允许有意保留的大开放核继续存在。

## 5. 同预算比较三类候选

每轮最多3热点，每热点各给solid、VOID、组合两种确定性变体，合计最多18个轻量候选。两轴都未达标时，优先轴至多2热点，另一轴至少1热点（存在合法热点时）；不能因优先轴无可行候选就提前结束整轮。三类都进入枚举或明确记录不合法原因，不能先硬选某一类再编理由。

- **solid**：当前每个候选从本地可用材料族从属profile取一个实例。围绕缺口峰值/原材料方向放置，方向和长短有有限变体；用真实足迹检查原主体关系、间距、地面与通路。
- **VOID**：从基底fragment完整layout追加一个局部缺地矩形候选，长112–224px、宽64–128px，使用同一`rectilinear-fragment-v1`、完整snapshot和edgeSeed编译。不得画黑贴片、将solid改黑洞或补虚假桥。可以改变真实孔布局，旧“孔逐点保持”不再是新任务门。
- **组合**：同一热点的VOID与同材从属solid错位组成关系；`combo_offset_px`提供中心偏置下限，实际偏移由mesh/矩形投影范围、宽核半径与8px裕量共同推导，再以真实边界净距、通路和宽核门校验。记录新增实体/孔及整体两轴变化，未实现逐部件消融贡献；不能将组合总收益称作已经分别证明两者收益。

完整fragment重编可能因轮廓顺序、局部净空与RNG改变旧断缘；这不是稳定局部补丁。必须评估**真实编译后的整图**，冻结最终结果，并用相对基底地面损失/开放核/原主体支撑门限制副作用。保持矩形拼合与自由断缘机制，不在v1名下修改共享算法。原solid及非地皮relief的真实XY足迹不得被新孔无意截断；承托全图并负责groundEdge的大地皮由原地面损失、宽核和连通守卫约束，不把整张承托面设为永久禁孔区。候选改变外岸/合孔等拓扑也须按共享编译器合法性明确接受或拒绝，不能悄悄填回。

## 6. 先过硬门，再谈收益

候选必须同时满足：

- 原20px身体/8px支持、至少97%合法支撑席位可达，以及真实连续扫掠；合法出生候选不得被全部移除。不能缩身体、减内容、换世界或换污染档。
- 基底独有主体不被削断或失去支撑；新增solid不与原主体/其他新增组叠放来刷数量。整体实例预算仍为最多32 solid、48总实例；本策略追加上限8 solid/4 VOID只是计算与容量上限，不是生成目标。
- 原地面变VOID不超过8%，新增solid足迹占G0不超过8%，原身体中心损失不超过15%。三项分别计，不相互抵扣。当前不足以满足的新候选拒绝，不能以“可达率100%”掩盖地已挖掉。
- **宽地关系守卫**：用基底`clear≥48px`的宽核，按原连通分量和固定4×3空间区选分散锚点；候选后锚点都存活，原本同宽核的锚仍在候选宽核内连通。保留宽核总面积至少80%，以及`clear≥112px`最大开放核分量面积至少基底的65%。基底不存在相应核时该比例记不适用，不能用零分母通过。48/112是中心净空尺度，不是“门宽=两倍半径”的实测宣称。
- 上述关系门阻止把原宽面连接降成只容身体的窄桥。当前没有输出新增细颈数量、窄区行程比例或宽核分裂计数；新增细颈/窄区行程统计仍为后续诊断项，已实现的宽核锚点关系门不能冒充这些统计。原基底已有的细颈不算本轮修复，也不能借它允许新的串联地洞。
- 新VOID与既有/新VOID实际边界净距至少96px；新增solid不同关系组实际足迹净距至少32px，并以完整身体/宽核复验。组合也服从这项门，不拿中心距代替。不得围岸/围孔成连续墙。
- **重复守卫**：规范化候选几何签名去重；新旧足迹重叠不能算新结构；同一局不重复同类、同相对长宽档与相近朝向的关系组。候选中心不得与已有两个新增组构成连续等距、近共线的排布（间距差≤15%，转角≤15°）；方向偏置须来自材料组织轴和seed，不用网格坐标轮流填空。最后仍需正常镜头判断是否读成栅格/地下城，机器门不代替此判断。

以上比例/距离是首版策略护栏，写CSV并冻结在配方；出现正常世界被广泛拒绝时回到统一策略调节与版本验证，不增加按worldId的隐形例外。

## 7. 选优、确定性与有限停止

当前trace分别记录固定原样本上的平均负担 `F=mean(f)` 与原有效光学样本上的 `O=mean(o)`；各自分母在候选间固定。首版相对基底目标是各下降25%，初始为0的轴要求仍为0。物理进步不能抵扣光学退步，反之亦然。

1. 优先处理“尚未达到自身目标、相对基底剩余负担最高”的轴；轴优先级平局按固定轴顺序；候选按冻结seed派生及稳定枚举。两轴共同参与每轮有限热点预算；若优先轴全部候选失败，仍考察另一轴的合法改进，只有全部候选无改进才停止。
2. 候选须使目标热点在固定样本上的对应缺口至少下降10%，另一轴不增加；同时具备正的全图对应收益。硬门失败先淘汰，不能用高收益买通路/地面。
3. 当前排序先看轴目标优先级，再比较目标轴残余、另一轴残余、原地面损失、身体站位损失、已有再见见证的路线长度（无见证为Infinity）、实例数加新增孔数，完全平局保留先枚举项。它没有测量完整内容路径的新增绕行成本；该项仍属后续评价。不设允许两轴相抵的加权总分。
4. 每轮最多接受一个候选，立即重测；最多4轮、18候选/轮。每次改变只进入下一轮当前几何，基底样本和损失预算始终不重置。选择数可为0，不能为了用满预算加对象。
5. `deriveSpatialAugmentationSeed`产生独立候选随机支流，由world identity、requested run seed、冻结policy算法/版本/hash与当前effective geometry seed派生；候选ID、枚举顺序与平局次序由算法版本固定。不得消费材料/奖励/敌人随机流。同一几何attempt内的两个finalist及内容失败不重抽增补；进入既有下一确定性geometry attempt时，按其实际几何重新衡量与增补。不是跨8个不同基底强求同一增补，也不增加外层重试。mesh构造、测量和最终生成必须使用相同effective seed；取消/恢复遵循原身份事务。

与Code当前类型对齐，`trace.status`为`disabled`、`policy-targets-met`、`no-feasible-improvement`或`budget-exhausted`，分别携带F/O残余、选中候选和拒绝原因。基底双轴本就为0时，在 `trace.limitations` 中加入字符串 `no-deficit`；启用时trace可为 `policy-targets-met`，但新增改善为0，没有外层 `reason=no-deficit` 字段。准备失败写入 `native.diagnostics.spatialAugmentationPreparationRejected`。成功结果的内容部署诊断是 `native.diagnostics.spatialAugmentationDeployment.{selectedCandidate,rejectedCandidates}`，拒绝项为 `{candidate,reason}`；跨attempt失败另进 `metadata.rejected` 的 `{seed,reason}`，全部耗尽直接抛错。当前没有 `outcome=deployment-rejected` 字段或枚举。禁用不叫达标；达成本策略25%目标也不叫全图潜行通过。无进一步合法改进或预算耗尽时，可保留硬门有效的最佳几何/基底，但明确残余与状态；不能把跳过补全伪记成功。几何合法仍不代表最终内容合法。

## 8. CSV合同与恢复

与Code已对齐两表，不按worldId填洞/摆物：

- `data/rift-spatial-augmentation-policy.csv`：一个全局策略行，含算法版本、开关、尺度、预算、损失/开放门、最低收益及两个独立目标。字段统一snake_case。初值如下；后续更改由CSV→code单向生成并冻结，不在运行时散写平衡数值。

```text
algorithm=spatial-completion-v1; version=1; enabled=true
reference_sight_px=224; physical_radius_px=112; occlusion_radius_px=208
probe_step_px=32; hotspot_radius_px=224
max_rounds=4; max_candidates_per_round=18; max_added_solids=8; max_added_voids=4
max_removed_base_ratio=0.08; max_solid_added_ratio=0.08; max_body_center_loss_ratio=0.15
min_reachable_ratio=0.97; wide_core_radius_px=48
min_wide_core_retained_ratio=0.80; min_largest_open_core_retained_ratio=0.65
min_void_separation_px=96; min_solid_separation_px=32
minimum_improvement=0.10; target_physical_reduction=0.25; target_occlusion_reduction=0.25
target_blocked_pair_ratio=0.25; min_valid_occlusion_pairs=4
physical_component_min_span_px=448; physical_component_min_area_px2=50176
reveal_route_min_px=80; reveal_route_max_px=720
void_length_min_px=112; void_length_max_px=224
void_width_min_px=64; void_width_max_px=128; combo_offset_px=160
repeat_spacing_tolerance_ratio=0.15; repeat_angle_tolerance_deg=15
```

- `data/rift-spatial-augmentation-profiles.csv`：`id,family,construction_version,shape_profile,min_length_px,max_length_px,min_width_px,max_width_px,min_height_px,max_height_px,thickness_px,fold,branches,opening,distortion,rotation_offset_rad`。当前12行全部为 construction 4，并使用真实v4 profile，以兼容所有正式 authored fragment 地形。codegen与冻结policy校验提前拒绝v3，尺寸两端同时检查原生mesh和地形ownership能力；单体形体校验不能替代正式组合兼容。每行是同族从属形体的完整合法参数域，Art给出形体依据；不是按每世界复制当前主profile。未提供该材料族profile时对应solid分支明确拒绝，不能退回任意石头或独有主体缩小版；字段或构造能力非法则整个policy拒绝，不能当作普通空间无解。

共享新算法已使用**r11，r10完整执行器已从99998703冻结**，不能沿用上一轮纯CSV改动可保持r10的结论。新配方冻结完整policy、profiles、原fragment snapshot和来源hash，签名覆盖最终增补结果/trace。恢复按固定r11算法重算并核对，不读今日CSV；r10及更早按原闭包恢复，未知版本/缺字段/签名不合明确拒绝。

`native.diagnostics.spatialAugmentation` 保存确定性trace：`geometrySeed/candidateSeed`、基底/剩余两轴负担、轮次、候选数、入选ID、新增实体ID/孔数、各候选类型/热点/拒绝原因，以及已完成评价候选的收益/损失/宽核值和可选再见见证。早拒绝候选不伪补缺失测量。完整几何参数在最终 `native.definition`，实际fragment在同级 `spatialAugmentationFragmentShape`，几何指纹在同级 `geometryFingerprint`；不是都塞进trace。最终signature覆盖recipe、几何、内容、trace及选中的finalist索引；恢复由冻结输入确定性重建，不在出发后回写已冻结recipe。细节日志不向玩家界面泄露未知出撤/奖励。

## 9. 已实现的内容重部署与尚未实现的第二次评价

基底阶段先确定该attempt的出生候选，几何增补后复核实际落点并选择未知撤离，再部署原Host、敌人、资源与翻找来源。仍满足原配额、风险档、真实48px操作站位、非safe至少2.4秒巡逻窗口、撤离分区/距离与完整身体归途；不能把初始几何合格解释为内容自动合格。

以下两项保留为后续验证，当前尚未实现：①对实际出生→合法翻找站位→撤离的完整内容路径，重算空跑段、穿行/绕行和VOID机会；②用有限真实敌人巡逻相位记录LOS/朝向与可能暴露段。已有完整内容准入、局部20px身体再见见证和受控后备事务不能冒充这两项产物。路径中心净空也不能当准确穿口宽度；未来探针不做完整潜行模拟，不由它保证听觉安全、脱追或玩家体验。

每个确定性seed attempt最多对两个完整几何finalist做最终内容部署（最佳增补、上一合法态或基底）；外层仍最多8个attempt，因此上限是16次完整内容部署，不是8次。60秒Worker总截止不延长；候选数量与时间上限分别约束。首个失败保留原因并完整回滚其几何/部署；后备也失败则走原明确拒绝，不能部分保留不合法Host或删资源。运行时不得因机器快慢选择不同地图：操作次数决定候选，时间截止只负责取消/失败。

## 10. 当前交付、独立负控与后续验证

共享生产策略已接入，当前新v4模板策略按最多5世界一批完成有限正式生成及保存重放；精确范围与计数以[专项QA](../qa/spatial-augmentation-2026-10-13.md)为准，不在本设计文档复制。后续覆盖仍应包括大宽地、窄连接反例、已有密集实体、稀少同族从属能力和大主体/混材。不要求每图各加N件，但整组有限样例必须实际出现算法选择solid与VOID（含组合），另包含不需要增补、只有一类合法以及预算/内容失败的例子。不能用候选被枚举过冒充真正被选中。

必须保留的反例：只加solid不能冒称遮视轴完成；挖掉原坏点不能改善得分；制造新窄桥不能凭97%可达通过；大开放核被全填不能过相对保留门；重复实例/新ID不能灌分；物理合法但Host/操作站位失败须回滚；零改进/预算耗尽与两轴目标满足分开；旧r10在新CSV下精确恢复。

当前已有技术证据和仍待完成的体验项目分开登记于专项QA。后续验证意图保留同seed前后真实地形与两轴诊断、候选决策/拒绝记录、最终三档完整内容准入、旧局恢复、正常肩灯经过实体与VOID两类新增关系，以及运行预算；列为目标不表示全部已取证。真实敌人接近、等待、绕端、撤回另作具名运行证据；自然未知搜撤、审美和开放感由用户复看，不由统计代签。设计根审最多两轮，发现实施约束回报主线程，不无声加复杂度。

## 11. 历史99998703：仅保留证据，不再作为方法约束

上一轮三图手工追加5/6/6个solid并做一次形体校正，原物/岸/孔及105图保持；18/18限定生产、9/9旧地图hash、三中档两态四RGBA、8/8组与13/17单件双侧见证及正常WASD局部移动均保留原证据。四单件未证、真实敌人潜行/完整搜撤/FPS预算未验也保留。旧3–6点面积建议、纯CSV可保持r10及“本批不加孔”仅属于当次任务，不是本策略的全局门。

历史入口：[专项QA](../qa/stealth-obstacles-2026-10-13.md)与[三图实图](../qa/artifacts/stealth-obstacles-2026-10-13/root-owned/index.html)。本次r11共享能力已接入并完成限定技术验证，当前范围见[本轮专项QA](../qa/spatial-augmentation-2026-10-13.md)；全库空旷整改、未实现补充诊断、I14/P49仍开放。
