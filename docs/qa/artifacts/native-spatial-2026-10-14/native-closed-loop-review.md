# QA Report: COH-F011 原生 r12 空圆与路线失败反馈闭环

日期：2026-10-14。Feature IDs：COH-F011；直接相关 COH-F013 / COH-F006 / COH-F007 / COH-F044。

Spec：`docs/specs/system-map-generation.md` 原生 G1 精评、未准入 plan 路线反馈；实施细节以同目录 `native-route-design-review.md` §3 的 Root 批准合同为准。

代码版本：基于 `4cbfaf48693043bcfdde00c4c332637a462e12d8` 的并行未提交工作树。报告只核查本轮 `native-spatial-{measure,g1-field,layout,joint-refinement,route-layout,route-feedback,routes,generation,geometry,types}.ts`、`r100-production-map.ts` 的指定变化，不将 HEAD 当作当前源码版本。最终冻结工作树指纹见文末。

环境与方法：本地只读源码和既有 JSON 回执；运行了 game-state `impact --feature COH-F011` 读取依赖。没有编译新几何、fresh、full、构建、游戏试玩或复跑已有逻辑测试。构建及正式 fresh 由 Root 统一负责。未修改生产代码、Spec、状态文件或公共 QA 汇总。

## 当前结论

指定静态范围内无剩余阻断项。G1 max-only 与填充占用接线未发现具体偏差；预算偏差 NCL-QA-01 与后续确认的 safe 零额外路程误拒 NCL-QA-02 已由 Code 修复，并完成独立静态复核与实现方回执核对。c17 固定快照已通过完整内容部署，但正式 G4 仍拒绝；本报告不是整体准入通过。

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | 合同依据 |
| --- | --- | --- | --- | --- | --- |
| NCL-QA-01 | 偏差，已修复 | Medium | 初版新实际几何进入 route archive 时重新建立 `refinements: 0`，`exhausted` 对每个几何分别计算 48。首 G4 失败后的同一固定 probe 可以在后继几何重新得到 48 候选机会，未形成闭环总额。72 work 和 60 秒仍限制全程，因此不是无界循环，但不满足批准的单次 route 闭环 48 上限。 | 初版 `native-spatial-generation.ts:86,138,170,194`；修复见当前 `:211–254,304–314` | 实施合同 §3「一次有界关系候选域」「最多原48个tuple」；Root 本轮明确同一次首 G4 失败的 probe epoch 共用 48，只有旧循环结束、fresh 的新首 full 失败才建立新额度。 |

修复核对：probe epoch 现有共享消费账本；每个 base 的 raw ordinal 只负责确定性域索引。helper 按剩余额度惰性检查，非法提案及单阻挡者释放都消费额度，已检查 tuple 跨调用去重。后继几何身份不能刷新总额；`layout:448,489` 在选中后立即保存 route trace，并给后续评分、commit、编译等异常附同一记录；`generation:247–252` 在布局异常离开 work 回调前即时记账，早于 work 包装器 finally 的截止检查；即使 finally 用新的无 trace 截止异常替换原错误，也不会丢消费。正常返回在 `:254` 记账，外层 `:313–314` 保留幂等补记后再抛。48 与 72 几何工作 / 2 full / 60 秒共同生效。控制器回执明确覆盖 48→18→0、新 fresh 无旧 probe、post-selection/deadline 消费保留；因此关闭此项。

## G1 已核查范围

- `native-spatial-measure.ts:119–132,164–174`：仅 supported 身体中心参与正式最大值；采用 `min(geometry.solidDistance, geometry.voidDistance) + 4√2`。`nativeVoidPrimitives` 枚举最终真实地面相邻 VOID，并把 frame 外侧作为 VOID。
- 原合格 H/S 距离继续决定 `internalMaxEmptyUpperPx`、内部最坏点、deep 标记与诊断 distances；deep 连通 / bbox、数量、身份、G2/G3 门未在该变化中放宽。
- `native-spatial-g1-field.ts:14–28,131–155`：外海/B mask 与可移动 H 分区；frame 明确限圆。实际 H 使用局部 `contains` 与边界，原位置移走后不会继续占用；新位置孔内 max 距离为 0。
- `native-spatial-layout.ts:159–169,223–267`：完整 tuple 与单物件精评使用同一 fine 场；其他物件缓存和移动物件都使用填充距离。位移后重算 `site`，deep 与均值使用独立内部阻行距离。
- `NativeSpatialG1Field` 保留 8px 精评、实际 assessmentPoints、每 1024 点截止检查与严格等价上界剪枝；fine 点未进入独立可放域、deep 连通或 wide 面积分母。

## 已读回执及适用边界

这些是已有记录，不是本 QA 重跑的结果：

- `g1-open-planning-round1.json`：七项纯有限域 / 生产评分检查，含 B/frame 不混入旧 H、H 移动恢复旧地、单物件与 tuple max 等价、deep/mean 不变。首次核对时其 3 个 native source 指纹吻合。
- `g1-open-field-regression.json`、`g1-open-footprints-regression.json`、`g1-open-pruning-regression.json`：分别记录 4 / 4 / 7 项通过。field 回执的宽来源列表中 routes / joint-refinement 已被本轮并行修改，不能把该旧回执提升为新增路线闭环通过；footprints 与 pruning 的指定 native 来源在首次核对时吻合。
- `open-radius-production-round1/report.json`：保存的七份原始几何测量接线，5 项检查、86,831 个 supported 中心、0 新几何 / fresh / full；相关 5 个 native 来源在首次核对时吻合。c25 新 max 161.429px 仍失败，c27 158.334px 仅说明该 max 项，旧坏 c3 的 deep 失败保留。
- 原短岸角 / 有结构长带夹具的无效 S 资格缺口没有被消除；上述回执不等于全部原四夹具合同或完整地图准入。
- `route-layout-logic-round2.json`：实现方执行的 9 项有限事件 / 足迹 / 惰性额度检查通过；3 个相关源码指纹与最终复核工作树吻合。round1 保留为修复前历史。`route-joint-regression.json` 的 8 项原 joint 逻辑回归仍是原执行事实，layout 在其后增加异常账本包装，不把该旧回执当作最终 layout 全文件回归。
- `route-feedback-logic-round1/report.json`：实现方在保存的 c27 实际几何/内容上复算官方 G4 与固定 probe，6 项通过，原 5 项拒因保持，20 条路线 / 8 节点 / 12 条合格路线；验证了真实事件到完整 H/S 身份、两处可归属闭合窄段、资格/区域/站位丢失、节点中心与操作站位的区别、actual vector 优先于 mean。0 新几何 / fresh / full；该工具记录的 4 个非 generation 生产来源与最终复核工作树吻合；generation 随后只补异常即时记账，另由第二轮控制器回执覆盖，原真实 G4/probe 结果未被本 QA 重跑。
- `route-feedback-controller-round1/report.json`：3 项真实 generator 控制流检查通过；几何/部署阶段是明确标记的 stub，只证明反馈、共享额度和异常记账控制流，不能算地图准入。该回执为最后一次异常修复前的来源；本 QA 读取了检查脚本，确认上述范围边界。

- `route-feedback-controller-round2/report.json`：最终 3 项控制流检查通过，generation 来源为 `2e596e7fa7afc1ce28c02bf3cf4f36c3517c83f0304cc37272fbeb6df6b78e60`。第三项显式让 work 的 finally 抛出新的 `deadline-final-checkpoint`（没有 routeRefinement），仍保留已消费 2 次，证明修复没有依赖被覆盖的外层错误。新回执源码指纹与最终快照吻合。`tsc.log` 为空，Code 报告类型检查退出 0；本 QA 未重新运行类型检查或构建。

## 路线闭环静态复核已确认项

- `generation` 的 `fresh` 分支对 `nextBase.routeFeedback` 优先；未遍历完初始 count/B 域不会抢走首 G4 反馈。route 工作前沿耗尽后清除 probe archive 再 fresh，不把旧目标带入新整份 plan。
- `route-feedback` 复制并冻结实际 spawn / exit、节点 ID / kind / tier / position、原合格 route IDs 与原非空探索区 IDs。所有新候选调用原 `evaluateNativeSpatialRoutes` 重新求路，不冻结旧折线。
- 原合格路线掉出长度/事件资格、节点失去合法操作站位、原非空探索区消失均标为不可比；新增区域仍通过正式 evaluator 参与。QA 指出的「节点中心被额外要求 20px 身体支持」已由实现方移除，仅固定 spawn / exit 检查身体支持，节点依据原 48px LOS 合法站位。
- `route-layout` 的类型交换来自实际失败首遇事件，六窗取失败窗；缺失类型搭档优先反向偏科路线。窄道从最长窄/不确定 run 的已闭合最窄截面恢复同源 ±32px 轴，不为无归属或不确定转折猜边界。
- 候选只移动 1–2 个完整对象；共同核对新的足迹、原 L−B 支撑、间隔和附着 relief。外海/B 不移动，物件类型、局部形体、数量、孔 profile、母体关系与断缘 seed 保留。单阻挡者释放最多两件，不连锁第三件。
- layout 不因 G1 预测或内部 mean 变差撤销候选。实际控制器仍先重新测 G1/G3 与 G2，再测 probe；只有所有正式 gate 无拒因且 probe 可比才 yield 给 full。探针不构造 Master/Host，不部署内容或烘焙。
- 完整候选仍在 extraction 前消费 full，成功前重新部署完整内容、正式全 G4；既有 2 full 计数不由 route probe 重置。成功诊断继续剥离 CPU `elapsedMs` / initializer timings，route probe 函数与运行账本未写入 recipe。

## 未完成与下一步

Root 的全源构建与唯一正式 fresh 另记，本报告不冒称运行结果。资源初次部署早筛经 Root 明确本批暂不改 `r100-expedition`，为可选后续工作，不记本批缺陷。固定 c27 实际移位后的路线改善、正常 fresh 成功率、最终准入、性能、用户视觉与玩法终验均未由本 QA 验证。

## 路线闭环阶段源码快照（身份预检追加前）

以下 11 文件属于 `src/generation/world-study/`。对完整相对路径→完整 SHA-256 的映射按键排序并以紧凑 JSON 序列化，所得聚合 SHA-256 为 `fa18c1df661ad45cd0969dcd531c1b19c31cf88d58dade476ff1218a580615d7`。这是静态核对的版本标识，不是运行通过标识。

```text
native-spatial-g1-field.ts          726bec5fe2acf57f1e7c0130ef82b386ee69a96699e2412773c18b2462ef69d5
native-spatial-generation.ts        2e596e7fa7afc1ce28c02bf3cf4f36c3517c83f0304cc37272fbeb6df6b78e60
native-spatial-geometry.ts          84e51bc71654cc5cf5058bfdbbb75b43a0dc50d29cff64a5aa66173e9f1a8b0e
native-spatial-joint-refinement.ts  3287d9cc3080ab3d5aa464e8fcfef52f6dc22fd7d13b6f4b560d9c429cbbb7da
native-spatial-layout.ts            aa1eece52bb670fd8a060b61a0187106ffb14f1e00fc66a703b93b4405a469af
native-spatial-measure.ts           5080cdfdba87b28dba95441d6517371e922bd2687e218b2bf496a093125daaae
native-spatial-route-feedback.ts    f06aa7a84cad383f92bd133e62e3c1400e52657e152de3d25ca74273c26b23f5
native-spatial-route-layout.ts      2cc219cb2a37137fb84df37dd814daab243a3564dcbd477cc093432a3fd8559e
native-spatial-routes.ts            1c8004c0713a6f8665cb67f53096e1658f7ee66f8a422bc2126a11e7e29dabde
native-spatial-types.ts             cb9e46b82934c30d88763617bad92ba2ffe13d26cd82c0108cceb73448aca808
r100-production-map.ts             1f1055cea9e20881e0312b36260d7d3ae2dd10029963c25299c595d8ab1602aa
```

## 追加审查：H 移位身份预检与可细化前沿隔离

日期：2026-10-14。同一 COH-F011 工作树；本节是上述路线闭环阶段之后的窄范围复核，前节指纹保留为历史版本。本轮基准为 Root 的增量 Task Brief：原 12 评分槽内只对优于实际有效原位的 H 站位做最终身份资格，全部失败保留原位；预检计原 72 work，预算耗尽不得被 single catch 吞掉；失格 proposal 仅退出可细化前沿，不删除测量和失败历史。本 QA 未运行新几何、地图、构建或全源测试。

**结论：这两个指定变化未发现新的静态阻断项；NCL-QA-01 保持关闭。** 下列实现方有限回归均有对应回执及源码指纹，不证明下一次生成请求成功。

### 已核对的实现

- `native-spatial-layout.ts:176–199`：原位先占 12 槽之一，坐标去重后最多 12 次合法完整评分。只有完整分数严格优于该有效原位的已评站位才交身份资格，按原完整评分顺序首个通过即止；身份失败不补槽，不另开站位域，全部拒绝返回原位。等分或更差不触发资格编译。
- `native-spatial-layout.ts:481–485`：仅 H 调用资格；每个待试站位与当前其余完整 objects 合成一份全 H 输入，复用 `qualifyNativeSpatialHoles`，不是只核被移动的单孔。L/B、局部形体、数量、profile、母体/relief 与断缘 seed 未在此变化中改写。S 不增加身份预检。
- `native-spatial-types.ts:7–15` 与 `generation:55–74`：新增 `refinement-hole-identity` work kind，仍使用同一个预扣账本。outer final、initial-H、refinement-H 共用原上限；无余额时执行前抛 `NativeSpatialGeometryWorkBudgetError`，已拒绝或抛错的资格不退款。outer final 预留的一份额度仍包含其后正式最终几何。
- `layout:485` 直接重抛该具名预算异常；其他异常仍调用原截止 checkpoint，因此已到截止不能当成普通站位拒绝继续循环。最终控制器保留 `geometry-work-budget` / `deadline` 的停止路径。每次资格的 candidate、objectIndex、site、reasons、invalidHoleIds 和异常留在 `geometryWork`，没有因保留原位而擦除失败。
- `generation:89–97` 根据实际 H profile / 有效结构、actual VOID 可用性、完整 source 支撑与固定 B 结果判定可细化资格，不拿 G1/G3 失败本身当排除条件。`offer:156–162` 先保存真实几何身份、诊断排名与排除理由，再阻止失格结果进入工作前沿；失格结果不会参与前沿支配比较，不能驱逐既有有效 base。
- `generation:287,299,307,328` 三个生产 offer 均显式传入该资格。原始 gates/reasons、候选 trace、实际 hash 和最佳诊断保留；无效后继仍对其实际来源 base 记录一次失败/停滞，不能以更小 max 重新成为下次细化起点。未传 admission 的通用 archive 原语保持原行为，不影响生产的显式接线。

### 已读有限验证与边界

- `refinement-hole-qualification-round1.json`：8 项通过，涵盖按分数首个合格、全拒原位、等分/更差零编译、12 槽不补位、非法原位不伪回退、共享预算、deadline 与 H-only 接线；纯回调/静态断言，没有编译 fragment 或新图。
- `refinement-hole-budget-regression.json`：原 5 项预算回归通过；`refinement-hole-incumbent-regression.json`：原 7 项原位/剪枝回归通过。对应生产来源在本 QA 最终读取时均与回执吻合。
- `refinement-admission-round1/report.json`：4 项保存测量调度回放通过。20261012 原 46 份实际测量中 29 份退出工作前沿，原坏基线 24/27/36/39 全隔离；seed 0 的 52 份中 5 份退出。两份的最佳诊断仍与原 archive 一致；实际 c9→c15–18 四个坏后继仍记录 4 次失败/停滞，未成为新 base。缺反馈与单项无效结构是已标记负控，其余 H/B/source 失败取自真实旧回执。此回放没有生成新几何。
- `refinement-admission-round1/controller/report.json`：既有 3 项控制流回归通过，保留共享 route epoch 与 finally 覆盖异常仍计费的证据；最终 generation 指纹吻合。`implementation.md` 报告联合 `tsc --noEmit` 退出 0，`tsc.log` 无输出；`dev-smoke.json` 记录 Vite 根页及 3 模块 HTTP 200。这些由 Code 执行，本 QA 只读，没有代称自行运行。
- 原 `production-gel-route-feedback-round1.json` 与 `production-gel-route-feedback-seed0-round1.json` 两次失败没有修改。已读前者成本摘要：60.206 秒截止、0 full，28 个 H 身份失效的 refinement 工作包占 38.076 秒；这些工作包包含规划/编译/测量，不能称为纯编译耗时，重复和坏基线链的时间也不能再次叠加成节省额。

### 本次冻结源码

本次 4 个直接审查来源的路径→SHA-256 映射按键排序后紧凑 JSON 的聚合 SHA-256 为 `72bced1c885575116c198ebb970a42e19bfaf46679da8197df65aa05a7dd7aae`。完整路径前缀均为 `src/generation/world-study/`。

```text
native-spatial-generation.ts         4b4bdddaaa29c69c94111efb6f96cbd1185d9d3d49f9ce50efbbf8a4b2e045b3
native-spatial-hole-qualification.ts 224fa9f0e98651065d6fd76d8cc7ac5e13dc4269d32e472cf758225ce51b20c0
native-spatial-layout.ts             03625ba91b37ec39697b20e37f80206137642a39ba74d2d4a90f2af5f2c2b837
native-spatial-types.ts              2c92af663d7af4c306efc1674d2e959d50dc3b6d7eebfdad748ca3f11639dabd
```

本节只确认预检与调度合同。实际身份失败是否减少、72 work 的消耗变化、完整生成是否准入及实际耗时，由 Root 后续统一实测；不从保存回执回放推导新的成功率或性能收益。

## 追加审查：safe 额外路程的零值数值边界

日期：2026-10-14。范围为 COH-F011 / COH-F013 的当前 r12 内容部署。基准是 `system-map-generation.md:274–281`、`rift-expedition-grades.csv` 与 `rift-spatial-deployment.csv`：safe 两类节点各 1、实际合法翻找站位接近路程不超过 480px、相对直接撤离额外路程不超过 180px、节点间距至少 96px；失败不能削减配额或放宽标签。Root 本轮仅批准将理论非负额外路程的负浮点残差归零，没有批准改变 safeRoute 或加入二席回溯。

### 已确认问题与修复范围

**NCL-QA-02：safe 零额外路程被负浮点残差误拒。** 保存的 c17 部署失败中，96 个候选除 `extra-travel` / `node-spacing` 外满足其余 safe 条件，但实际计算值为 −9.094947017729282e−13 至 −2.2737367544323206e−13。原 `distance >= 0` 排除了它们，只留下 3 个候选；这 3 点的最大互距为 22.627416997969522px，小于 96px。旧候选域内不存在合法两点，因此证据否定「首个薪柴选择贪心堵死本来合法的配对」，没有实施回溯。这个计数与距离范围由本 QA 从保存的 JSON 读取计算，没有重新运行导航或几何。

- `r100-expedition.ts:41–46,138–142`：当前 `r100ExtraTravelPx` 只在 outbound、homebound、directReturn 均有限时返回 `Math.max(0, outbound + homebound - directReturn)`，非有限输入仍为 Infinity。生产调用仍在两向路线有限、48px 操作圈和 LOS 检查之后；没有合法操作站位的候选仍保留初值 Infinity。相同非负边权最短路图中，经站位绕行不能短于直接撤离，归零修正该量的数学下界，不是额外放宽 180/480 阈值。
- 候选 16px 格、20px 身体与 8px 导航、污染距离、safeRoute 距离、96px 间距、tier/kind/slot 顺序、评分和排序、全部内容配额及非 safe 巡逻窗口均未改变。有限正值沿原表达式计算；只有负值归零。此修复可能改变受残差影响的 r12 选点，不宣称所有历史 r12 输出相同。
- 六项筛选拆成具名 `filters` 的次序和布尔条件与原表达式等价；`nodeDecisions` 仅保存决策。失败时附筛选漏斗、已选节点、候选拒因；正常返回 diagnostics 没有加入这些记录。`SearchSitePlanner.score` 只建立按坐标确定的 generation 内缓存，不分配内容或改变世界。原失败仍抛出同名部署错误，controller 继续登记 stage/reason，没有将失败转为成功。
- `r100-production-map.ts:27–36,107,131–136`：revision 1–11 在当前部署前分派到各自冻结执行器，当前完整候选明确要求 revision 12；部署后仍重新执行正式全部 G4。r11 recovery executor 的 SHA-256 与其 manifest 相符，manifest 的 `imports` 为空，内部自带旧部署实现。这里确认静态隔离，没有复跑旧版恢复。

### 已读真实失败证据

`safe-node-c17-capture-round1/report.json` / `node-placement-failure.json` 为实现方保存的原 c9→c16→c17 固定历史链，3 个实际几何 hash 及实际 gates 与原正式失败回执逐项一致；c17 的 geometry 与 visibility 均 accepted，完整部署仍失败于 `contaminant/safe/0`。记录为 21 work / 1 full / 6.057 秒、sourcesStable=true，并持久化 `geometry-c17.v8.gz` 与 `pre-deployment-c17.v8.gz`。它不是新的 fresh 搜索，也不是修复后准入证据。原漏斗为 4575→1537→584→567→3→3→0；对应额外路程、接近、污染间隔、safeRoute、deep 条件与节点间距。

本 QA 已读捕获脚本，确认其保存数据后再断言 hash/gates/失败原因；快照明确列出省略的运行时函数，不能单凭文件存在宣称完整 runtime 已恢复。

### 修复后固定快照验证与最终结论

`extra-travel-c17-round1/report.json` 记录 `deployment-passed-g4-rejected`、sourcesStable=true；本 QA 已读 `tools/native-spatial/check-extra-travel-c17.mjs` 但未执行。工具使用保存的同一 Master/geometry/污染/撤离点，按生产定义恢复 matter/sight/role、距离函数与碰撞对象；没有再编译几何。实际几何 hash 仍是 `a2d4a4c15a186ba9`。记录沿用原 21 work，固定诊断链累计 2 个 full 槽，部署/G4 续段约 1.192 秒；这不是新的正式 fresh 或生产端到端耗时。

3 组有限检查均通过：负残差/精确零/正深度/不可达语义；全部 4575 候选的坐标与其他原始字段逐项一致，只有额外路程变为 `max(0, oldDistance)`；全部内容数量、薪柴值、节点间距、移动巡逻、非 safe 空档与搜点来源资格保留。实际恢复为 99 个 safe 静态候选，部署结果为 5 薪柴 / 3 污染物 / 3 敌人、6 个至少 2400ms 非 safe 搜索窗口。原 safe 薪柴仍选 cell 28974，safe 污染物选 cell 24348，其额外路程为 0、接近路程约 262.392px。

正式 G4 重新评估 20 条路线，保留 13 项拒因（H 占比、六遇窗及横向窄口），没有以部署成功跳过路线门。冻结 probe 可比、14 个 witness；`deployed-runtime.v8.gz` 与 `complete-runtime.v8.gz` 保留该失败全貌。该结果只证明数值修复解决了此 c17 的 safe 配额误拒，不证明后续路线候选可改善、正常 fresh 成功率或整体地图准入。

实现方最终 `implementation.md` 报告 `tsc --noEmit` exit 0，`tsc.log` 无输出；`dev-smoke.json` 记录 Vite 93ms 启动、根入口与 expedition 模块 HTTP 200，范围明确为启动/模块转换且不含生成。最终 expedition 文件 hash 仍与固定快照回执吻合。本 QA 只读上述记录，并仅对所辖 Markdown 做 diff 空白检查。

**NCL-QA-02 在本窄范围关闭；没有新增静态阻断项。** NCL-QA-01 保持关闭。没有由本 QA 生成新几何、运行 full/fresh、构建或新增检查工具；生产最终验证仍由 Root 统一负责。

### 本次源码与数据指纹

以下完整相对路径→SHA-256 映射按键排序后紧凑 JSON 的聚合 SHA-256 为 `69df1f4f556ebdb99715333447cc0b2920a5a531a61a6877ead5dfe7e80aa633`。8 项均与修复后固定快照回执吻合；原 capture 的 expedition hash 为 `e8ad02836879f0454a67a4c9cee933f79f822445fa0725208cb5841fa8cf57c9`，明确属于归零修复前版本。

```text
src/generation/world-study/r100-expedition.ts               b78e29b86a2364eb78d479195c915c1f8d9d465957fb25b5d386e8e188d769e2
src/generation/world-study/r100-production-map.ts           1f1055cea9e20881e0312b36260d7d3ae2dd10029963c25299c595d8ab1602aa
src/generation/world-study/search-site-placement.ts         caf5a52113cfbc1778fdfe4019913b9ad314bb1f262ab5d93dae0c2b0dc8cc13
src/generation/world-study/native-spatial-routes.ts         1c8004c0713a6f8665cb67f53096e1658f7ee66f8a422bc2126a11e7e29dabde
src/generation/world-study/native-spatial-route-feedback.ts f06aa7a84cad383f92bd133e62e3c1400e52657e152de3d25ca74273c26b23f5
src/generation/legacy-r100-v11/executor-recovery.js          12641ac9720eb6eb46d5cf3dc9238e9845d7dd368c30021f495fed636e26ceca
data/rift-expedition-grades.csv                             e218b81edb14f2206e0f2d35c1f01955cadace5ece2ee262f6dccfb53fded78c
data/rift-spatial-deployment.csv                            c33f6ff96da39e5b5778c379f695867ae0d54253d5557d5e4dbf03b02b79a1c3
```

## 追加审查：路线类型配对域的覆盖与共享计费

日期：2026-10-14。范围仍为 COH-F011 的原 route probe 闭环。Root 本轮批准去除类型交换的前三伙伴偏置，保持同一 probe epoch 的 48 次完整 tuple 合法性总额、72 work / 2 full / 60 秒及所有实际 gates。此次只改候选域与排序，不把规划合法性当实际改善。

**结论：指定变化无新增静态阻断项，NCL-QA-01 保持关闭。** 原 `production-gel-extra-travel-round1.json` 的首 epoch 从 c17 正常触发，原域 20 项，另有 2 次单阻挡释放，共消费 22、0 合法、0 probe，随后以 `domain-exhausted` 结束。原失败没有覆盖或改写；此前前三伙伴裁切限制了候选覆盖，不是原共享预算漏计。

### 静态核对

- `native-spatial-route-layout.ts:84–102`：primary 取真实失败路线中的过量类型事件（window 仅取该失败窗）；partner 取现有完整对象的全部缺失类型，不再各裁前三。交换只把两个完整对象的 `site` 对调，不替换形体、不改数量/身份/B。反向偏科路线仅提供排名证据，不把缺少反向证据的伙伴排除。
- `:47–57,90–102` 的排序量只读取已有事件及 support primitive 的局部包围尺寸，包含随 solid 搬动的 relief；占比/窗口修正是冻结事件的估算，距离为坐标运算。这里没有调用 ground margin、完整 support、collision 或实际 gate，未发现未计费合法性扫描。每条 witness 与排序迭代保留 deadline checkpoint。
- `:126–150` 先按对象索引及目标坐标组成完整 tuple key，跨 route/方向去重，合并真实来源。两个对象的使用次数优先平衡，再比较事件修正、反向证据、尺寸差和距离；窄口候选与类型交换交替加入同一个最多 48 项的域。不同 primary、partner 与 narrow 能获得机会，不承诺每个可能 pair 都能进入有限域。
- `:152–168` 仍先检查剩余额度与 seen，加入 `evaluation-incomplete` trial 后才调用唯一的 `nativeSpatialPlacementRejections`。非法、异常和单阻挡释放均收费，首个合法即返回；释放只在单物件且唯一固定阻挡者时尝试两物件，不连锁第三件。`joint-refinement.ts:87–113` 的完整支撑、附着 relief、L−B 与其他最终对象冲突检查未改。
- `generation:199,237–262` 仍保存每个不可变 base 的 ordinal/seen 前缀，用 epoch 的 `48 - consumedTuples` 给后续 helper。正常与异常的即时记账、后继几何共享总额均未改变；新排序没有创建新 epoch 或补发额度。源码版本在一次请求中固定，同一 base 重建域的顺序确定；历史原域不会在生产运行途中被热换后重放。
- `layout:455–465` 仅提交完整对象新站位；`generation` 后续实际几何、visibility、固定 probe 以及第二 full 的完整重新部署/G4 仍决定是否改善和准入。`swapRank` 是候选选择依据，不能代替这些测量。

### 已读回执与适用边界

- `route-domain-logic-round2.json`：11 组有限逻辑检查通过，sourcesStable=true。包含跨 route 同 pair 合并且只扣一次、全部过量事件来源、完整形体/relief、岸侧与双侧窄口、唯一阻挡释放、48 上限、ordinal/seen 续接和异常仍计费。新增 mixed >48 夹具中 16 个对象均出现、type/narrow 同时出现、第四及之后 primary/partner 获机会；remaining=0 时 margin/supportsFootprint 的抛错哨兵均未触发，确认域排序不偷做合法性扫描。本 QA 已读脚本及回执，没有运行它们。
- `route-domain-c17-round1/report.json`：从保存的首 c17 probe 状态替代旧域作离线对照，恢复原完整对象局部足迹；并非给已经消费 22 次的旧生产 attempt 再追加 48。新域 48 项、合计消费 48 次（44 类型交换、2 窄口单移、2 单阻挡释放），3 个规划合法 tuple；首次合法为 `subordinate-13 ↔ hole-8`。四次返回保留 seen 长度 25→35→47→48、raw cursor 23→33→45→46，说明释放计费与 raw ordinal 不混为一项。16 个实际对象均获得评价机会，原 objects 保持不变。
- 该 c17 对照明确记录 0 geometry compile / 0 gate / 0 route search / 0 fresh，状态为 `legal-tuples-found-not-admitted`。约 0.974 秒仅为此有限域检查耗时；不代表实际生成耗时或新增路线改善。原 G4 的 13 项拒因仍作为输入保留。
- Code 报告最终 `tsc --noEmit` exit 0，`route-domain-c17-round1/tsc.log` 无输出；`dev-smoke.json` 记录 Vite 根入口与 route-layout 模块 HTTP 200。生产/测试来源与回执指纹均吻合。QA 未运行新几何、fresh、build 或新增工具；后续真实候选测量由 Root 统一负责。

### 本次冻结源码

以下四项完整路径→SHA-256 映射按键排序后紧凑 JSON 的聚合 SHA-256 为 `aaed0c10221a18ef47402aa39807f7c2db07c9159960ded2870678442b0b8e6a`。只有 route-layout 相对上节覆盖阶段发生本次生产变化；其余为约束/接线的核对版本。

```text
src/generation/world-study/native-spatial-route-layout.ts     002a92c51c9d63f8bc98c60f2317b2c83739e57b24c8cbf8da82a5f26884c089
src/generation/world-study/native-spatial-layout.ts           03625ba91b37ec39697b20e37f80206137642a39ba74d2d4a90f2af5f2c2b837
src/generation/world-study/native-spatial-joint-refinement.ts 3287d9cc3080ab3d5aa464e8fcfef52f6dc22fd7d13b6f4b560d9c429cbbb7da
src/generation/world-study/native-spatial-generation.ts       4b4bdddaaa29c69c94111efb6f96cbd1185d9d3d49f9ce50efbbf8a4b2e045b3
```

## 最后窄审：G4 整体统计与局部品质诊断

2026-10-14，依据现行 `system-map-generation.md:173–177`。此前逐路线硬门及 probe 结论仅属历史口径。

结论：未发现阻断。`routes:97,107–108,123,139–146` 保留端点/节点可达、至少一条合格路线、224px 连续窄段及整体 .60–.75 硬门；整体直接汇总全部首遇，未筛短路线或跨路线去重。原测量、失败位置及品质诊断保留。`production-map:108–139` 保留几何、完整内容与预算硬门，失败不启动旧 probe。

只读回执：7 个物理夹具通过；保存 c17 的 20 条路线测量不变，整体 82H/38S、13 条合格路线、最长连续窄段 168px，新 G4 通过但保留 13 条 qualityDiagnostics。这是新口径下保存测量复核，不是正常 fresh/replay 成功。QA 未运行生成、编译或新工具。

本次只读三文件为 `native-spatial-routes.ts`、`native-spatial-types.ts`、`r100-production-map.ts`，完整路径仍在 `src/generation/world-study/`；路径→SHA-256 排序紧凑 JSON 聚合为 `360593d0b04a7ea2211a0d69314c288d26a70d140e3cff809223156184d0b189`。routes 指纹与两份 G4 回执一致，后两文件不在其回执指纹范围，仅作本次静态复核。

## 最后窄审：共同初始化

2026-10-14，基准为 Root 本轮共同初始化增量合同。结论：未发现实现阻断。`layout:421–442` 先取得完整匹配基底，再一次全 others 扫描；185 池、每对象 12 槽含原位、共享 work 与最终 H/几何硬门保留。`initial-placement:136` 禁止生产进入局部 Lloyd。`geometry:24–42` 与 `measure:85–91` 共享 S 阻行三角面积下界，没有替换作者身份、最终有效结构归并或实际面积统计。

只读 `complete-initialization-round1` 的 28 项既有纯回归，全部记录通过，四个审查来源与回执吻合；未复跑或生成地图。`layout` / `initial-placement` / `geometry` / `measure` 四文件完整路径→SHA-256 排序紧凑 JSON 聚合为 `c4b8f831e91de7c165dfaa7d2fe05d02b69fd074a4811c746cbe882344904ea7`。读取时 spec:165/169 仍为旧默认入口描述，已提醒 Root 收尾同步；不以旧文字否定本轮明确授权。五图 fresh 结论另记。
