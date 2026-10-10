# QA Report: r7 空间推广独立代码审查

日期：2026-10-10；首次记录时间 2026-10-10T15:55:51Z。

Spec：`docs/tasks/rift-spatial-rollout.md`、`docs/specs/system-map-generation.md` 的修订7/撤离/部署合同、DEC-196/197。Feature IDs：COH-F011/F012/F013/F014/F044/F052。

代码版本：`4459d7c3900a7f64c7f172c1aecab8782bb796e0` 上未提交工作树。本文是推广执行中的独立审查，不是最终验收；后续修复须追加复核记录。关键工作树指纹见文末。

环境与方法：macOS、本地 Node/tsx；只读生产代码与 CSV，轻量配方结构检查、单图独立身体连通性核对。没有修改生产代码、玩家状态、时钟或任何结果。全库324次生成、浏览器、构建及性能由 root 分工执行，本文不将他方尚未完成的运行记作通过。

## 发现的问题

| ID | 类型/严重度 | 描述与复现 | 位置与依据 | 状态 |
| --- | --- | --- | --- | --- |
| SR-CR-01 | 结构偏差 / High | `monolith-sill` 中档源定义只有1个 `monolith-buttress` solid；请求种子20261010 的 `createR100SpatialDefinition` 将它循环复制为20个主体。材料/形体枚举未变不代表“单柱旷地”的结构身份被保留。并行美术已先发现，本审查独立核对了源数据及派生列表。 | `r100-spatial-world.ts:99–120` 的按角色源数组取模复制；`data/rift-native-worlds.csv` 的 `monolith-sill` 行；任务“保留逐世界形体，不将一张代表图换色复制108次”。 | root 已安排特殊结构修正；本报告首版未复验。 |
| SR-CR-02 | 验证缺口 / Medium | 初版 `check-production` 只验证到撤离中心的 `metadata.extractionRoutePx >= 920`，不能证明48px触发圈内最早可达席位满足最短路门。真实生成器使用的是 `interactionPathDistancePx`。 | `tools/spatial-rollout/check-production.mjs:52–56`；撤离合同明确以触发圈席位为准。 | root 已补触发圈最小值及选中点等于最终出口的断言；已在跑的旧脚本需离线补检完整报告。复核还应包含 `max(920, maxPath×0.28)`，不是仅920。 |
| SR-CR-03 | 验证缺口 / Medium | 准入报告的可达比例分子来自生产器 metadata，窗口只检查条数。`findR100PatrolWindows` 对窗口席位检查完整身体、操作视线、永久Host占据，但未检查席位属于出生连通分量；新图允许少量孤立合法地面，因此不能仅从“窗口数=非safe节点数”独立推出每个窗口实际可到达。 | `tools/spatial-rollout/check-production.mjs:49,58`；`r100-patrol-windows.ts:62–70`；任务要求真实操作站位。 | 未复现不可达窗口，不能报告成已证实坏图。单独抽查 `crystal-fibre/low` 的4个窗口全部可达。建议补生产准入/验证的窗口出生可达断言。 |

`woven-quarters` 的材料关系问题由并行美术负责：本文确认源布局为4个膜材角部及2个短纤solid，通用布置将其改为重复交替的主体。本文不代签其画面关系是否恢复。

## 已验证事实

- **版本隔离静态检查**：r6 配方校验、地图执行、表面烘焙分别路由到 `legacy-r100-v6/executor-recovery.js`；该文件无外部导入，manifest 指向精确源提交 `4459d7c3`。r1–5分派仍在；未知显式表面revision与缺appearance被拒绝。冻结内容等价运行由独立 revision QA 产物证明，本文没有重复执行。
- **r7冻结合同静态检查**：完整空间策略及部署策略进入配方，参与依赖指纹；validator校验冻结对象，不逐值比较当前空间 CSV；实例源仍随配方冻结。工厂返回结构化克隆，不把材料/坐标数组直接共享给存档。地图失败仅推进同一冻结身份的8个候选，不换等级、不减奖励或敌人。
- **撤离算法静态检查**：20px完整身体、8px八向图，每条边进行完整身体线段扫掠；从精确出生点连接到合法图席位；触发圈考虑所有可达格，包括隔墙但符合现行半径触发的格。按距离层、空间区、候选依次抽样，没有相对出生反向、对角或最远点选择。选中后重新生成部署，并断言最终出口未被吸附改位。
- **角色/地形边界检查**：普通solid仍是身体障碍，VOID仍是视线遮蔽；没有把solid自动改为遮光。出生吸附仍有64px拒绝阈值。扩大岸线预算同时保留原小图2048三角限制、4,194,304像素总上限；性能是否满足需以 root 的真实浏览器预算结果为准。
- **324份派生定义的轻量核对**：对108世界×3档，比较 `(role, family, shapeProfile, constructionVersion)` 集合，没有发现材料/形体种类被遗漏。这个集合检查不验证实例数量、相对布局、材料牵接或美术身份，不能用它覆盖 SR-CR-01。
- **单图独立 BFS**：`crystal-fibre/low`，请求种子20261010，实际生效种子2326301828。独立八向完整身体 BFS 得到28,844个可达格，与metadata一致；4个返回的巡逻窗口席位均有完整身体支撑、可由出生到达，距对应节点为48/40/48/48px。这只是该图的连通性检查，没有真实操作翻找。
- **运行中报告抽查**：抽查 `all-worlds-first.json` 当时46个成功案例，选中出口与最终出口一致，触发圈距离满足 `max(920,maxPath×0.28)`；最小交互距离1026.94px。文件仍在生成，46个案例抽查不是最终324覆盖结论。
- `node tools/world-study/codegen-r100-spatial.mjs --check` 通过（当时108世界/3组织）；`node tools/world-study/generate-spatial-deployment.mjs --check` 通过；`git diff --check` 通过。

## 验证口径与尚未覆盖

1. **路程是8px格点图度量**。可验证可走路径和明确格点下限；不是任意连续走法的精确最短路。本轮spec已明确此限度。
2. **巡逻扫掠检查有价值但不是实玩**。脚本检查压缩航点之间完整线段的20px身体支撑，不是只查端点；窗口按100ms时间步进、未警觉巡逻模型计算。接近时被发现、噪声打断、追逐、脱追、移动到窗口时机均不在此证明内。
3. **集合/占比不是世界身份或动线的充分证据**。solid占比17–27%为初始筛查窗；不得为了比例统一复制独特主体。特殊世界应记录其身份约束，并给出实体/VOID造成的真实分路与身体连通证据，再由设计锁定等效标准。仅降低百分比不足以证明用户提出的“动线不能无所顾忌”已满足。
4. **未进行整局实玩、声音、跨浏览器、GPU占用/释放测试**。没有使用旧r6资格代替r7；没有将截图、DEV入口或静态图误写为完整正常局体验。
5. `npm run build` 与全仓类型检查归 root 最终验证；此审查进程未重复运行。没有总体验 PASS 声明。

## 建议的收口顺序

先修复 SR-CR-01 及并行美术结构问题，再固定新的策略与特殊世界合同；最终生成报告补上 SR-CR-02/03 对实际出口/可达窗口的核对。旧报告保留失败与适用范围，新结构重新验证。代码审查没有发现另一项可证实的r6保存损坏或固定远端选点缺陷，但不能据此跳过完整生成、真实发现撤离、搜撤与性能验证。

## 首版工作树指纹

```text
r100-spatial-world.ts        1a345cda12c6950d3cfec8c8a5c2a9cc2a75762a0ad6093f2f53469182e22cd3
r100-spatial-types.ts        201a4836e4c515ac466edabc54e5f6106af969e32b0da7930b638275a10b5f48
spatial-extraction-selection.ts afccec7d982b52e5cbf1c2dd87d67e83d0eaffe4b87ce03b271645294a003308
r100-pollution.ts            328804c3dd7423627fc31a4c119cff81cbe8078c0575094cc5c2c5d4eb1538dc
r100-expedition.ts           2a26a8b883d7da5c022ff34accda45dbf5e40c1c424dc8d558fb9f5fb93cb774
r100-package.ts              ba994fc3bc8f1dc6a65f98b3c41d72b56a60ccd0aa3d2376bcb495c3f2406fe9
r100-production-map.ts       ea8a7e0c5502559232615179c03270d5211ea175cb35b4674495619c6eff287c
surface-bake.ts              098aeebda01231a522ffa63afeb0b4d91f56acc0cd38dd7cafb8092251a852c7
legacy-r100-v6/executor-recovery.js f4b1b49689381e990825db75f9f64cd4061e31c030669d66002413f3bc0087fe
check-production.mjs         d2fe44f724ac8428b5d78a08be7825ac7ded71714374e75d68b382b12c70f474
```

证据登记由 root 合并到 game-state；本子任务不修改共享 evidence/feature 状态。

## SR-CR-03 修复复核

root 随后给 `findR100PatrolWindows` 增加可选 `canReach`，仅修订7的空间部署传入生产身体距离场；没有策略的旧母版不传，r6仍走冻结闭包。该变更没有将所有窗口一律当作可达，也没有修改旧闭包。

专项工具：`tools/spatial-rollout/check-patrol-window-reachability.mjs`。

执行：`TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-rollout/check-patrol-window-reachability.mjs`，通过。

证据：`docs/qa/artifacts/r100-spatial-rollout-2026-10-10/patrol-window-reachability.json`（包含当前源文件 SHA-256）。

最小反例由三个互不连通的地面岛组成：出生岛上的节点与另一个有20px完整身体支撑、但无法抵达的孤岛节点；远处有真实往返巡逻配置。独立八向身体 BFS 提供可达集合。验证结果：

- 不传过滤器时，原模型对两个节点都返回2400ms窗口，证明“合法站位+窗口”本身不足以证明可达。
- 传入独立 BFS 后只保留出生岛节点，孤岛节点不再取得窗口；保留窗口的站位、开始时间、持续时间与原模型逐字段一致。
- 所有席位均不可达时返回空列表；全true适配器与原行为逐字段相同。
- r6冻结执行器 SHA-256 仍为首版记录值，并与冻结manifest一致。这个字节核对不代替完整旧局恢复实玩。

SR-CR-03 的**窗口筛选生产缺口已通过这个隔离反例验证修复**。最终全库准入脚本的独立 BFS 及逐窗口核验由 root 正在补齐，不能提前记录324通过。

## 真实绕行替代门：方法与15例结果

2026-10-11 继续验证。Director 针对初始 solid 占比误判锁定新门：同图至少2组实际 solid 或 VOID 造成的阻挡，每组对侧探针不能直穿，全图最短身体绕行路程/直距≥1.25，额外路程≥120px，而且障碍两侧都存在完整身体可走的路线。这个门替代单一实心面积下限；不取消97%连通、完整配额、搜取窗口和撤离距离。历史密度失败保留原事实。

实现拆分：

- `tools/spatial-rollout/route-obstruction.mjs`：导出 `measureRouteObstructions(map, recipe)` 与 `ROUTE_OBSTRUCTION_POLICY`；直接检查传入的完整生产图，不重生成、不读环境、不改地形。返回每组的探针、实际命中物理格、全局最短路、两侧路线、完整身体扫掠结果及失败原因。未找到2组时返回 `status: failed`，调用方不得忽略。
- `tools/spatial-rollout/check-route-obstruction.mjs`：读环境、通过正式工厂生成一次地图、调用上述核心、分案例保存JSON并在任一失败时非零退出。原报告禁止覆盖。

核心先从真实8px TileGrid独立建立20px身体支撑与八向连续扫掠边，再从出生点独立遍历连通分量。障碍来自真实 WALL/内部VOID连通组；外接世界边界的VOID不作为回绕组，未能归属到solid实例的碎片不计。源solid ID相同的多个足/碎块不重复计数，选中组中心还须相隔至少300px。

每组先自动枚举水平/垂直穿越线上的对侧合法站位，验证线段确实命中该组并且完整身体不能直穿。用A*与可采纳的八向网格启发式求**整张生产图的最短路**；符合绕行比和增量后，再分别将搜索域限定在穿越线的两个闭半平面，要求两边都找到路线。限制作用于整幅图，不是删掉一个像素后另找几乎重合的路。折点压缩仅合并同方向连续边，不做削角平滑；每一压缩线段重新进行20px身体扫掠，长度必须与原格点最短路一致。

证据：

- `artifacts/r100-spatial-rollout-2026-10-10/route-obstruction-first.json`：初次单例开发验证，保留。
- `artifacts/r100-spatial-rollout-2026-10-10/route-obstruction-low-solid.json`：`shell-chain`、`splayed-fibres`、`gel-fibre` × 低/中/重，9/9通过。最小最短绕行比1.255684，最小额外路程243.078px；每例两侧路线都通过逐段扫掠。
- `artifacts/r100-spatial-rollout-2026-10-10/route-obstruction-special.json`：定稿后的 `monolith-sill`、`woven-quarters` × 低/中/重，6/6通过，使用拆出的核心执行。

| 世界 | 实际证明的障碍组 | 三档代表结果（约数；精确点/路线见JSON） |
| --- | --- | --- |
| shell-chain | 两组不同来源的实体开壳 | 较弱一组2.60×、+243px；另一组4.75–4.99×、+690–702px。实心占比约13.7–13.8%，仍有真实双侧回绕。 |
| splayed-fibres | 一组内部缺地 + 一组实体交叠束 | VOID为1.47×、+262px；low实体组1.255684×、+243px，中/重实体组更长。 |
| gel-fibre | 两组不同来源的实体混合构造 | 两组最短绕行均明显超过门槛，较弱一组4.71–4.92×、+772–783px。 |
| monolith-sill | 唯一实体主体 + 西侧独立VOID裂缝 | 三档分别为2.49×、+452px及4.16×、+404px；没有把同一柱的不同足算两组。 |
| woven-quarters | 两组不同来源的实体 | 三档分别为1.47×、+325px及1.70×、+237px。 |

所有案例均为请求种子20261010；完整生产生成器可能在同一冻结身份内使用后续候选，实际 `effectiveSeed` 和候选次数均写入报告。低solid 9例是在首版完整查法下运行；只作提取核心的重构后没有重复这些地图生成。两个special的6例用提取后核心通过。后续324准入由 root 在同一完整查法上执行，本文不提前代签。

**适用限制**：这是限定种子下两个真实双侧绕行组的存在性证据，不证明所有位置都密集，也不判断其动态压力或好玩程度。两侧路线在探针连接端可共用穿越线上的进出段，报告显式记录共享边；非穿越线部分分别留在相反半平面，不能称为从出生到撤离完全边不相交的两条全局路线。测得绕行增量包含该组与周围实际地形共同作用，不是在删除其他地形后计算单个物体的孤立贡献。自动探针有限（每组5个横/竖切面、两档外扩，最多审查32组），找不到合格探针会失败，不能反过来断言世界绝无合格路线。

## SR-CR-01 数量身份修复复核

新增 `single-buttress` / `joined-quarters` 使用 `source-once`。独立轻量复核两世界三档：`monolith-sill` 每档恰好1 solid、0 relief；`woven-quarters` 每档3 solid、3 relief。按角色来源顺序，对全部实例逐一比较 family、shapeProfile、constructionVersion、height、thickness、fold、opening，与冻结源完全一致。再结合上面的6份实际完整生产图，两世界均通过两组真实回绕门。

因此首版的“单柱变20柱”代码/数量偏差已修复；压纤四角的视觉搭接及正常视野可读性仍由独立美术检查，不以这份数量/路程报告代签。

## 作者组阶段的配方、冻结与旧版本复核（历史岸线）

**范围更新：本节对应后来被美术否决的浅岸线阶段，39点岸线及48点尺寸特例均已撤回。它保留当时的执行事实，不描述当前版本；最终32点合同和bays证据见下一节。**

日期：2026-10-11。此轮针对最终 **86 个 authored-group + 2 个独立 special** 的几何合同；另外20个世界保留repeat组织。依据仍为 `docs/tasks/rift-spatial-rollout.md`，此次不更改生产生成器、不更改源地形、不改共享进度或CLAUDE.md。

旧批次的密度失败、首版复制身份问题、15例绕行报告均保留原事实与源码适用范围；它们不能代替这次作者组重写后的完整地图准入。root 另跑最终324完整生产图。本节没有提前声明那批通过，也没有把配方检查称为实玩资格。

### 来源收据登记

发现并补齐来源收据缺口：新增的 `rift-spatial-organizations.csv`、`rift-spatial-authored-groups.csv`、`rift-spatial-authored-erosion.csv` 原本尚未列入当前 package receipt；同时登记空间codegen、离线shore union与deployment codegen三个生产数据工具。修改仅在获授权的 `tools/world-study/codegen-r100-packages.mjs`，随后生成 `src/generated/r100-package-manifest.ts`。

- `node tools/world-study/codegen-r100-packages.mjs --check`：通过，**70份精确source/assets**。
- `node tools/world-study/codegen-r100-spatial.mjs --check`：通过，108 worlds / 6 arrangements。
- 最终空间源摘要：`03f10feec90b37fce202027a32696fd3c47ab8b1fe6e9b5091735661697ae35b`。
- 最终manifest文件SHA-256：`3a8f80f28a72744849f27871c381b2ed41db4a95861cf5cafc1f68f66c8bfdeb`。

没有运行旧qualification更新器，没有把历史资格替换成新证据。收据生成后本QA只改测试工具和报告，未再修改生产输入。

### 新测试与结果

四份报告均使用新文件名、写入时拒绝覆盖；位置为 `docs/qa/artifacts/r100-spatial-rollout-2026-10-10/`。运行命令统一前缀为 `TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx`，后接对应脚本和 `--report` 新路径。

1. **`revision7-recipes-authored-final.json`**，脚本 `tools/recovery/check-native-r100-revision7-recipes.mjs`：324/324配方通过。每份先JSON往返再校验。登记6,474次字段变更拒绝，包括组织规则、作者组的5个变换字段、实例来源/位置、编译岸线点和整块缺失、出生与出口策略，以及新字段缺失；另检缺policy和异世界身份。最大10,795 / 60,000字符（shell-grit/severe）。
2. 同一脚本对全部324份配方做轻量definition构造；264份source-once定义逐来源比对属性与groundEdge所有权，258份authored-group进一步验证所有实例ID/旋转保持、中心及长宽服从同一个冻结仿射。此处没有栅格化完整地图。伪造重复sourceIndex被结构校验拒绝；quiet-spur中偏移一个实例0.01px虽仍满足结构边界，但定义构造明确拒绝其违反组变换，未默默重排。
3. **顶点边界**：源1024×768接受32点、拒绝33点；精确2304×1792接受48点、拒绝49点；2305×1792及2304×1791均仍拒绝33点。实际quiet-spur编译岸线含39点并完整保存在有效配方中。48点例外仅适用于批准的扩展尺寸；原nativeDefinition仍受原尺寸约束，r6执行仍来自闭包。
4. **`revision7-freezing-authored-final.json`**，脚本 `tools/recovery/check-native-r100-revision7-freezing.mjs`：cinder-ridge、monolith-sill、woven-quarters、rib-vault、quiet-spur中档5/5通过。将已保存配方与构造结果留作基准后，只在隔离Node进程中改动7类live catalog，包括组织规则、作者组变换/计数/布局/编译岸线。旧配方字节完全不变、仍有效、重新构造definition与基准逐字段相同。新factory确实因live组织被改动而拒绝，排除未生效的空测试。结构有效但非当前sourceHash仍被接受，恢复没有硬绑当日CSV摘要。
5. **`surface-revisions-authored-final.json`**，脚本 `tools/recovery/check-native-r100-surface-revisions.mjs`：旧r6与quiet-spur新r7均拒绝9种非法显式版本值，package/map/surface边界一致；缺失版本和6↔7换标签均拒绝；显式5/6/7缺appearance与r7缺spatialPolicy均拒绝。此为分派边界验证，在分配地形/表面前结束，不等于成功生成四张表面的等价验证。
6. **`revision6-live-authored-final.json`**，原脚本 `tools/recovery/check-native-r100-revision6-live.mjs`：cinder-ridge/medium、marrow-break/severe两份真实旧r6配方，通过当前公开恢复入口所得完整payload、layout、native全部自身字段与typed-array原始字节，与原冻结executor逐项SHA-256一致。没有仅比少量统计数，也没有把跨bundle构造器对象身份误报成数据变化。

### 结论与范围

这轮没有再发现确定的配方冻结、作者组身份、旧尺寸顶点上限或r6公开恢复破坏。收据缺口已补齐，三个QA工具已经适配新数据结构并且有可复跑证据。结构validator负责有限值/形状/索引边界，整组仿射一致性由definition构造补验；记录这一分层，不能把单独结构通过误读成完整几何通过。

未重复root的324完整生产图，也未在此重复build、浏览器/GPU、迷雾发现或整局搜撤。原生浏览器视觉、完整表面像素、动态巡逻与实际可玩性仍以各自最终证据为准；这份合同审查不替代它们。

## 最终切角湾岸源码复核（当前）

日期：2026-10-11。只读检查最终源码、登记的源摘要与已有bays证据；本轮只修改本报告，没有修改生产输入、生成收据或历史报告，也没有重跑完整地图批次。

### 当前合同与历史范围

`src/generation/world-study/native-volume-erosion.ts:33` 与 `r100-spatial-world.ts:100` 均明确限制每polygon **3–32点，所有尺寸一致**；精确2304×1792的48点特例已经删除。原海口与四个不对称大切角在离线作者工具中合并，当前空间配方不依赖放宽顶点上限。

- 最终作者组258份定义（86世界×三档）的单polygon最大值为**14点**；完整108世界×三档配方的最大值为**20点**，来自repeat组织。不可把“作者组最大14”写成“全库最大14”。quiet-spur三档当前均为11点。
- 本轮独立执行16个轻量边界反例：1024×768、2304×1792、2305×1792、2304×1791四种尺寸均接受32点、拒绝33/39/48点；没有生成地图。
- `revision7-recipes-authored-final.json` 及同阶段39/48结论仅适用于当时浅岸线版本。该中间r7没有成为本轮最终交付合同；不能拿它证明当前32点版本接受39点旧实验配方，也不能把修改上限导致的拒绝隐去。
- r6继续使用已冻结闭包；当前shared erosion源码已经回到原32点规则。本轮未重做r6重型数据/表面回归，保留既有r6报告的真实范围。

### 最终证据与来源一致性

执行 `node tools/world-study/codegen-r100-packages.mjs --check`：**70项通过**。执行 `node tools/world-study/codegen-r100-spatial.mjs --check`：108 worlds / 6 arrangements通过。没有运行qualification refresh。

- 最终空间源摘要：`87b6793ca1ecc2de34edc6c6f2668527a02b99154c8b2c633cf6c1e626b4b487`。
- 最终manifest文件SHA-256：`b88fb0c21dfb4b9deda20e450c20473df7bdb62da995c380354951ef1779eb18`。
- 最终shared erosion文件SHA-256：`899683e6a750b1a951b576b87a3f82f385cd03273beca99585858882be10d992`。

`revision7-recipes-bays.json`（324/324、最大10,795字符）与 `revision7-freezing-bays.json`（5/5）登记的**全部源文件SHA均与当前工作树匹配**。前者确实测试expanded32接受/expanded33拒绝，后者确实覆盖作者组变换/编译岸线的live数据变更隔离；没有沿用旧48点测试结果冒充新合同。

`authored-group-identity-bays.json` 为258/258，通过身份、整体变换、groundEdge唯一归属、8px席位上的原VOID包含、原海口连向世界边缘检查。其所有生产源码及CSV摘要均匹配当前。唯一源摘要差异是QA脚本 `tools/spatial-rollout/check-authored-groups.mjs` 自身：当前脚本另有39点拒绝检查，不能声称已有报告由这份现脚本原样执行。这个测试快照差异已通知root；其生产数据结论仍对应当前源码，新的32/33合同另有摘要匹配的recipes-bays与本轮16个直接反例支持。本轮没有为消除工具摘要差异而重复258定义批次。

`authored-shore-union-bays.json` 记录86世界、578个不相交结果polygon，全部 `lostSourceArea = 0`。离线工具仅删共线顶点，另对thin-delta及quiet-spur去除被外围VOID包住的小孤地；这两例合计3个小口袋都在仿射后的原作者画布之外，报告逐块 `sourceCanvasIntersectionArea = 0`，代码也断言这一条件。不能将这一步说成“只合并原切口、完全没有额外挖地”；它是明确的外围岸线制作。编译后的CSV由最终receipt登记，源VOID的8px验证则由上述identity报告覆盖。

### 近景QA控制器只通过输入驱动

审查 `tools/spatial-rollout/check-journey.mjs:22–73`，当前文件SHA-256为 `519f7db5222cb6bdb9323de67dd192bcaa3f6c47fb2770d13d4b5e3c37220c8e`。

- 浏览器辅助对象仅保存scene/grid引用和独立的支撑席位数组。状态读取调用getPosition/getHealth/getValue/exportRuntimeState等，没有对player、physics、health、clock、loot或fog字段赋值，也没有调用坐标、血量、可见性或时间setter。
- 默认控制支路调用Playwright keyboard.down/up；`QA_FRAME_INPUT=1`支路在requestAnimationFrame间读取位置、派发DOM keydown/keyup给正常Phaser输入。结束/异常在finally释放按键，没有直接调用update推进游戏，没有改timer/timeScale或暂停世界来拍近景。
- near目标以已知整图支撑席位作四向BFS选择，之后仍由普通WASD和正常碰撞驱动；近景终点附近的朝向调整同样用短按方向键。这个规划器只作诊断引导，没有独立扫掠每条边，不能替代生产准入的八向连续身体路线门；实际碰撞或敌人导致无法抵达时应失败，而不是修地形/瞬移补成功。

现有 `near-woven-frame/source-snapshot.json` 的**所有src/data文件**与当前工作树逐SHA相同。其 `report.json` 为passed：记录36次帧输入按键变化，控制路段约20.324s；角色从(300,700)正常走到近景，运行计时约0.417s→22.083s、混乱15.105→22.294，撤离仍未知，未搜取物品，没有page error。此前 `near-woven/report.json` 的failed仍保留，未覆盖为成功。

近景证据可用于“当前生产世界在正常肩灯、正常运行状态下可到达该观察点”，不可称为自然迷雾探索、搜撤完成、经济验证或全面性能合格。该控制器读取了完整静态地图，这个信息优势必须与自然实玩区分。

### 当前结论

未发现新的确定生产缺陷或近景QA直接改游戏状态的问题。最终岸线仍须按独立美术与完整地图/实玩证据验收；本审查没有提前签署正在由root收口的324地图结果。历史39/48、浅岸线通过项及最终32点bays证据已明确分开。

## 最终材质域修复差异核对

2026-10-11，仅复核geometry / raster / organization-sampling / surface-bake四份生产文件及来源桥接，不修改生产或状态。**未发现新的确定缺陷。** `groundEdgeStart` 在追加岸面之前记录顶点/三角起点，原局部UV、面次序与geometry数组保持；后续smooth只替换normals并保留其余字段，不会丢标记或重排起点。局部组织源窗只统计起点前的UV，岸像素跳过该局部窗，沿原有世界域/原生密度取样，因而不会再用整幅岸线压缩一个低床的材质。raster在最高Z/同高ID裁决通过之后才写岸域位，普通上层面明确清位，低层/败选面不会污染结果。本轮独立小反例执行7种重叠/先后顺序（含同高ID、无岸面和第31位）全部通过；一个局部0–8、岸域1000–2000的源窗样本由错误混域scale0.031恢复局部scale1。使用正式serialize/transferables/hydrate链加structuredClone真实转移，20个buffer中岸域buffer只出现一次，发送端确实detach、接收端Uint32位图/共享引用/mesh标记均保留。生产wire通过对象展开和递归typed-array收集传递新字段，没有白名单丢字段路径。

证据 `woven-material-domain.json` 对实际woven中档生产图保留所有被列举的既有mesh/raster数组与layout字节，normal/response/emission完全不变，272,905个变色像素全部属于原地沿owner；其局部skinScale由0.109221恢复0.494563。实际岸线回归脚本为 `tools/world-study/check-native-ground-edge.ts`，输出 `native-ground-edge-domain-regression.json`：9种岸形/宽度fixture及15世界×3档地沿通过，范围是岸几何、接缝、身体采样，不是新实玩资格。r6在map与surface入口均先分派冻结executor，不调用新增域逻辑；`woven-material-r6-routing.json` 实建旧r6并经公开表面入口，确认无新域元数据且四张RGBA与原闭包一致。`visual-delta-bridge.json` 的4个code+manifest共5项after SHA逐项匹配当前；其754来源差异审计、3个真实Worker生产输入/几何指纹复建（cleft-tableland、shell-chain、woven）和woven完整字节对照支持**限定继承修复前324份物理/部署证据**，不称为修复后重跑324，也不由几何等价代签美术或运行预算。轻量目录复核确认15世界具有岸owner，只有woven同时启用组织源窗；新增位图每个2304×1792图为516,096 bytes（0.4921875MiB），资源预算仍须使用最终独立运行结果。最终manifest/build由root执行通过，本子审查未重复重型批次。

## 新大图运行超门的因果诊断

2026-10-11，COH-F011/F012/F013/F014。首轮 `runtime-release/report.json` 的预算测量由root掌控：五例已测，其中ash-strata/pallid-membrane达标，crystal-fibre/ivory-basin/cinder-ridge超门；第五例结束时浏览器context关闭挂起，silt-gel/woven未执行，不能写成七例完成。所有既有失败保留。本节是读取源码、独立QA工具与离线V8分析，不新增游戏功能、不构成预算通过。

诊断工具 `tools/spatial-rollout/profile-runtime.mjs` 单独冻结失败报告当前副本、3046服务器source-snapshot、源码逐文件SHA和工具hash；与旧I14授权/冻结根分开。root串行运行 `runtime-profile-crystal`，世界crystal-fibre、重度、种子20261004，正常十二段5100ms键序；没有改身体、敌人、伤害、资源、雾或时钟。原工具执行时`scene.update`已被Phaser缓存到`scene.sys.sceneUpdate`，因此新增sceneUpdate阶段为0样本，明确无效。其他十八阶段均有1843个有限样本，V8完整保留。挂点已修正到sys槽并另冻 `runtime-profile-crystal-v2`，**v2未运行**；不为补这一阶段重跑。原运行实际工具副本 `runtime-profile-crystal/tool-at-freeze.mjs` 的SHA与v1策略完全一致，当前工具改变不追改原freeze。

### 已证实的热点与不成立的归因

- 原生材质输出确实每帧全图：surface-renderer构造2304×1792 canvas，固定完整viewport，每帧quad；presentation调用texture.source.update，经Phaser TextureSource→updateCanvasTexture→canvasToTexture→WebGLTextureWrapper.texImage2D提交完整canvas。相机裁剪在其后，不能省略前面的工作；像素量为旧1024×768的5.25倍，每次RGBA逻辑数据15.75MiB。**但本次CPU证据不支持把上传当主因**：materialGLSubmit和phaserTextureUpdate的p95均约0.1ms。真实GPU耗时/跨上下文异步成本仍未直接计时。
- afterUpdate材料总时长2458.7ms，actorMasks占2306.7ms（93.8%），p95为5.8ms；静态ActorOcclusionField已预建，仍对五个角色的局部掩码矩形逐整数像素扫描。V8里maskActor inclusive约2155.7ms，isVisibleAtPixel self约1109.4ms；不能再把“已有缓存”当作这个热路径已充分优化。
- **更大的CPU热点是身体碰撞**。V8两条Phaser物理子步栈合计resolveMotion inclusive14553.3ms，占Phaser step约24435.8ms的59.6%；supports self7361.4ms、trace self5714.8ms。源码supports/trace每次线性遍历全部solid三角形，进入overlap/sweepPolygon后才做每三角AABB早退；大图增加实体后该查询量直接扩大。既有WeakMap只缓存整个collision实例，不是查询的空间候选。
- 次级热点actorPoses p95为4.5ms，V8 syncSchemeDPoses inclusive1990.1ms，主要落在paint-genome活层update；paintPaintGenomeLive约725.8ms、applyDangerSurface476.1ms、paintSurfaceMaterial186.7ms。这些是包含时间，不能跨层相加。visibility p95约1ms、minimap探索1.5ms/绘图0.7ms，AI/Host各约0.1ms，现有证据不支持先改AI数量或跳过游戏状态更新。

### 最小等价优化建议与验证条件

1. 优先给NativeBodyCollision建立静态三角形空间桶。supports查身体AABB、trace查整个连续扫掠AABB，再运行完全相同SAT；VOID格、EPSILON、SEPARATION、四轮滑动和能力exemption不变。跨桶候选去重，并按原三角索引排序以保留同一fraction时原先先命中的法线。不得只查终点或改身体尺寸。独立oracle应逐查询比较旧实现的supports、displacementFraction、resolveMotion全部字段，覆盖贴边/角点/零位移/长dash/跨桶/分离epsilon/滑动和exemption。
2. 对材料门，再考虑ActorOcclusionField每行固定小块的最大solid高度索引；块最大值严格低于heightLimit时整块可见，其余才逐像素扫描，合并相邻可见跨度。保留Float32原高度、原ground阈值、NaN fallback、世界外像素和销毁语义，沿已有P48像素/跨度oracle对照。不要以少更新一帧、跳过不可见敌人状态或弱化遮挡换性能。
3. 暂缓实现材质视口裁剪，作为另有GPU/帧证据时的方案；先解决有明确CPU采样支持的热点，再用新不可变源和相同输入执行独立无额外包装的预算验证。旧超门保留，诊断结果不替代资格门。

该诊断模拟计时61.431s、存活，帧间隔p50/p95为33.3/33.9ms，CPU提交p95为22.3ms，材料p95为5.8ms。采样前后均为电池20%、lowPowerModeEnabled=true、thermalState=0；33ms节奏与该环境同时出现，只是记录，**未证明节能设置导致30FPS，也不豁免失败**。预算CPU沿旧工具口径为PRE_STEP→POST_STEP，在最终Phaser主渲染前结束；不能称GPU耗时或完整渲染CPU。共享机器、额外包装和V8采样均限制性能外推；本子代理未运行第二浏览器或更改电源/用户应用。

## 两项热点优化的独立末审

2026-10-11。仅审查生产差异、独立旧实现与已完成证据，不改生产、不重复重型地图或运行预算。**没有发现新的确定 P1/P2 缺陷，可进入最终冻结来源的浏览器预算。** 这不是性能通过结论，也不把 Node 微基准倍数当作游戏帧率提升。

### 身体碰撞空间索引

`native-body-collision.ts` 的64px CSR桶只缩减候选，保留原SAT、EPSILON、SEPARATION、四轮滑动和VOID先行顺序。插入与查询都对完整AABB取floor、端点包含并clamp到边桶；完全出界三角也没有丢弃。对于两个相交AABB，同一单调clamp映射仍必有公共桶，边界只增加假候选。supports用完整身体AABB，trace用起点至终点的完整扫掠AABB，不能跳过中途薄墙。

复用Uint32位图去重，每word升序、最低有效bit先行；第31位的JS有符号位运算仍由`Math.clz32`正确得到索引31，保持原solid顺序及相同碰撞时刻的法线裁决。每次查询先fill(0)，提前返回不会污染下一次；exemption仍逐原三角、逐原裁剪片处理，没有重排。WeakMap继续以layout作弱键并检查native身份；新数组只由该collision拥有，没有新增全局强引用缓存。运行时碰撞与旧r6恢复也调用该共享类，因此特意检查了旧r6行为，而不是仅确认生成器分派不变。

- `native-body-broad-phase.json`：10,544组与旧实现精确相等，包括10,316次trace和1,274次exemption；对2,040,449个相交AABB证明候选覆盖。包含空索引、越界/贴桶/同刻法线/退化/非法输入、word31/32/63/64/末尾，以及7个r7中档实际生产图和3个r6恢复图，种子20261010。比较supports、displacementFraction、resolveMotion全部字段和trace法线，不只比较最终位置。
- oracle文件仅比优化前冻结源码多两行溯源注释和一处type-only import位置；工具移除这两项后断言SHA为`c011a3298bbcd6609166615ddd15430259f4017d4ea4a709ed6d30ce37ce8e4e`。不能把完整fixture文件SHA说成与旧文件原字节相同。
- `native-body-broad-phase-edges.json`：起终点都合法的400px扫掠仍被中途薄墙拦住；完整exemption确实放行至1，部分exemption仍拦截，豁免实体后的更远VOID仍拦截。100轮“实体内提前失败→远处空地成功”没有候选残留。
- 当前生产SHA为`1ed10631c73ed5f4acfcb0204aa232a37e18e94fcf706c7db50b172c258d5228`，两份报告的生产、oracle与工具SHA均匹配当前。真实样本新增索引最多338,348 bytes；crystal的65,519个三角在所测局部查询中平均只留68.08个候选。这些是样本与内存数据，不是全库上界或帧预算。

### 角色遮挡行块索引

`ActorOcclusionField` 每行16px保存Float32最大值，只有块最大值**严格小于**原阈值才整块可见；相交块逐像素走原比较。NaN高度令该块最大值Infinity，防止包括Infinity阈值在内的错误快路；NaN阈值继续按world.roleAt原回退。真实presentation仍使用原整数bounds、ground阈值、key缓存和retire规则，只将内层扫描替换成drawVisibleRow；连通可见段合并后的fillRect顺序、坐标、宽度与原代码相同。原扫描start=-1带来的负x不发段行为也保留，没有借优化更改裁剪语义。

- `actor-mask-blocks/report.json`：650,790条完整行绘制命令和152,460像素精确对照，包含宽度1/15/16/17/31/32/33/65、块边界、Float32临界、NaN/±Infinity、图外、空/实/混合行、换世界、重复destroy及销毁后查询拒绝。
- `actor-mask-worlds/report.json`：真实r7重度crystal-fibre/woven-quarters各2304×1792及真实r6重度cinder-ridge1024×768，种子20261010，合计9,063,948像素和13,074完整行（有限阈值/NaN/Infinity）与旧oracle相同；各图alpha SHA一致。此测试按实际生产map/hydrate构造，没有用源画布冒充扩展世界。
- 原P48 `actor-mask-production/report.json`：8个直接createMasterWorld源图共39,757,776断言通过，覆盖真实maskActor方法的换姿势、ground、缓存和retire流程。这8图的尺寸是896×640或1024×768，**不是8个r7部署大图**；它与上一项实际大图证据互补。该旧工具报告只列源路径、没有SHA，不能单凭该报告声称精确来源冻结；新增两份报告的生产SHA已逐项核对匹配。
- 新索引每2304×1792图增加1,032,192 bytes（0.984375MiB），field总计17,547,264 bytes。构造失败rollback与正式destroy均调用field.destroy并清空两张typed array；新世界新建独立field，已退休actor跳过查询。Node证据销毁后byteLength均为0，但真实场景/GPU释放仍由root的最终浏览器资源回收复验签署。

### 来源收据适用范围

检查发现真正影响r7生成身体可达的静态依赖是`physical-grid.ts`、`tile-grid.ts`、`game-types.ts`、`constants.ts`、`seed-fork.ts`、`random.ts`，已向root提交这六个精确缺项。`NativeBodyCollision`由RiftScene/恢复运行时调用，并不被当前r7 selector/deployment调用；不能以错误理由将它加入生成配方的身份依赖。运行时优化由最终不可变source-snapshot及上述oracle登记。root负责扩充receipt与最终check；本审查不修改旧r1–6封存，也没有运行qualification refresh。

## QA浏览器生命周期与空白页调度对照

原工具的launchServer+connect若只调用browser.close，仅断开客户端，拥有的Chrome进程仍会运行；同时launch/connect若在try之外，后续错误也可能漏清理。该确定QA缺陷已反馈并由root修复：参数先检查，launch/connect置于总try，独立15秒deadline关闭client与server，server关闭失败只杀自身process。每例测量在screenshot/context.close前立即写入；失败、清理错误和电源环境保留，不覆盖旧report。普通按键、61.2秒时长和全部预算阈值没有改变。

独立执行`runtime-lifecycle-blank.json`：Chrome155.0.8059.39、1440×1000、visible的about:blank，15.016秒451个原始rAF间隔，p50/p95为33.3/33.4ms。context关闭和client断开都成功，但serverAliveAfterDisconnect确为true；显式server.close后自身PID以code0退出，无pageerror。它同时证明生命周期修复必要，也证明这台机器当时**连无游戏的空白页都约30Hz**，不能直接把该节奏全部归因游戏。

源码依据：[Chromium BatterySaverModeManager](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/performance_manager/user_tuning/battery_saver_mode_manager.cc)在启用节能时将frame sinks限为30Hz；[pref枚举](https://raw.githubusercontent.com/chromium/chromium/main/components/performance_manager/public/user_tuning/prefs.h)定义`performance_tuning.battery_saver_mode.state`的disabled=0、below-threshold=1；[默认注册](https://raw.githubusercontent.com/chromium/chromium/main/components/performance_manager/user_tuning/prefs.cc)使用below-threshold。官方源码解释了一条可能因果路径，仍须与本机对照分开；没有使用未经确认的disable-features名称、无上限帧旗标或更改系统电源。

首个浏览器内settingsPrivate方案见`runtime-blank-battery-saver-control.json`：刚进入chrome://settings/performance，测试Chrome即SIGSEGV，未读写pref、未取得A/B/A样本，失败已保留且自身进程退出。该失败不能证明节能无关，也不能当作成功关闭节能。后续获准方案只在mkdtemp隔离QA profile预写Local State，结果另列；用户Chrome profile与pmset从未改动。

`runtime-blank-battery-pref-profiles-v2.json` 已完成有因对照：两个`fs.mkdtemp`独立QA目录顺序启动同一Chrome155，预写的唯一业务偏好分别为1和0，使用同样Playwright默认launch、不添加帧速或时间flags。pref1在15.017秒取得451个间隔，p50/p95=33.3/33.4ms；pref0在15.009秒取得901个间隔，p50/p95=16.7/16.7ms。每个profile启动后和关闭后均从实际Local State核对其值；两次context关闭后拥有的主PID均已退出。原始间隔、完整启动参数、电源前后状态均保留，所用脚本另存`runtime-blank-battery-pref-profiles-v2-tool.mjs`。此前`runtime-blank-battery-pref-profiles.json`因测试自己的PID检查将helper也计为主进程而提前退出，无帧样本；修正仅排除`--type` helper后另出v2，未覆盖失败。

这份对照结合官方30Hz实现，支持“本机当时浏览器Battery Saver使该空白页调度降到30Hz”的因果判断。关闭独立QA profile的浏览器节能可恢复普通60Hz调度；它没有更改宿主省电、CPU频率、用户浏览器或游戏时钟，也没有证明游戏达到预算。最终预算仍须在明确记录该QA偏好的隔离来源下，保持原20ms帧p95、12ms CPU p95、3ms材料p95等全部门槛；历史默认设置下的失败保持。是否采用该限定测试配置由root决定，本子审查没有修改预算生产输入或代签其运行结果。

root随后将该配置接入预算工具的显式`QA_DISABLE_BROWSER_BATTERY_SAVER=1`分支，默认仍为原launchServer路径。本QA只静态复核：临时目录由mkdtemp创建、只写pref0、PID定位排除helper、异常kill前再核同一目录、正式关闭后readback0、最后删除自身临时目录；没有采用用户profile或修改测量/按键/预算。未发现阻挡当前最终运行的新问题。root已在3047冻结来源串行启动`runtime-performance-release`七例；本报告截止此处不预写其结果，不再并行启动浏览器。
