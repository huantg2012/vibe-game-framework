## QA Report: native r12 生产链独立静态审查

日期：2026-10-14\
Spec：`docs/specs/system-map-generation.md`（原生联合生成及同源支撑条款）；`docs/design-notes/world-fragment-native-generation-2026-10-13.md` §5、§6、§9\
代码版本：HEAD `4cbfaf48` 上未提交工作树；精确被测文件 SHA-256 见 `static-final-support-counterexample.json`。\
Feature IDs：COH-F011、COH-F013、COH-F052（关联 F012）。\
环境与入口：Node + tsx，真实 native 构造器、fragment v1 编译、terrain 编译与结构资格；只运行一个固定的最小几何反例，未运行完整生产求解或浏览器。\
证据类型：静态调用链核查 + 单个真实几何反例。公共 game-state 证据由 Director 汇总，避免覆盖并行编辑。

### 发现的问题

**NS-STATIC-01 · Bug / P2：最终断缘后的主体足迹没有支撑拒绝门。**

- `src/generation/world-study/native-spatial-layout.ts:127` 只在原始矩形土地上检查 `pointCloud` 顶点的 24px 留量；`src/generation/world-study/native-spatial-layout.ts:238` 随后才执行自由断缘。该留量不是最终轮廓的支撑证明。
- `src/generation/world-study/native-spatial-measure.ts:100`–`:124` 的有效实体资格使用完整投影三角，检查跨度、面积和可接近性，却不检查投影是否落在最终真实地面。附属 relief 也没有最终足迹支撑检查。
- `src/generation/world-study/native-spatial-generation.ts:142`–`:147` 的候选准入调用 `identifyNativeSpatialStructures`、`evaluateNativeSpatialGeometry` 和 `evaluateNativeSpatialVisibility`，只有结构/G1/G3 和 G2；`src/generation/world-study/r100-production-map.ts:59`–`:68` 的最终阶段只核端点与 tileMap 不变，然后部署内容、跑路线。`compileNativeTerrain` 的轮廓/ground-edge 所有权检查不校验主体支撑；tileMap 相同也不能证明 mesh 未越界。
- 结果：局部主体可被最终海岸或孔切掉，同时该主体仍被计为有效 S，并参与空白距离测量。其他候选指标合格时没有此专用拒绝条件。这违反“真实主体足迹与最终岸/孔一致、附属低面保持合法支撑”的合同。它不是 ordinary solid 不遮 LOS 的问题；后者是批准机制。

**固定反例及范围：** 使用本轮 `native-gel-peeled-front` 的最小合法尺寸和真实 torn-sheet 构造器；原始矩形土地中，所有主体顶点最小岸距恰为 24px；固定 `seed=20261012`，经实际 v1 自由断缘后有 **186 个主体顶点位于真实 VOID**，其中一点为 `(71.17487335205078, 68.4800033569336)`。轻量 terrain/geometry 编译没有拒绝；结构资格仍给出一个有效实体 `S-counterexample-source`，`areaLowerPx2=2872`、`rejectedObjects=[]`。

反例是故意很小的单实体地形，**它会被数量、比例及空白门另外拒绝**，不能据此声称已经有完整生产地图错误放行、也不代表出现频率。它明确证明：最终支撑这一必要资格没有被这些阶段执行。现有两张 gel `geometry-land-tree-round2` 保存提案的三角形重心抽查没有发现越界，这不是该缺门可忽略的证明。

复现（必须给新的结果文件名）：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx docs/qa/artifacts/native-spatial-2026-10-14/static-final-support-counterexample.mjs /tmp/native-final-support-review.json
```

建议由 Code 在实际最终轮廓编译后，验证 solid 与附属 relief 的**完整投影三角足迹**；排除合法附加 ground-edge 的独立表现范围，主体不得借此越界。不能只把顶点检查移到最终轮廓，因为凹岸或孔仍可穿过三角内部。失败应拒绝本完整候选，不能裁主体、补地或把越界面积保留为有效计数。

### 未发现其他确定 P1/P2 的核查范围

- r12 无隐式 r11 兜底；旧 revision 显式路由保留，r12 输入拒绝混带旧 augmentation/spatial policy。
- 各 attempt 的提案、实际几何评价、完整部署次数分开记录；最多 72 提案、最多 2 次完整阶段，外层 8 次及 60 秒失败截止。时间没有进入候选评分；deadline 异常不被吞成下一候选。
- archive 保存实际测量的整图；传入 previous 时沿用正确 count pair，失败提案没有原地修改旧 incumbent 的地形/物件数组。通过 G1/G3 后清空该阶段 archive，G2/完整部署拒绝另外记录。
- 新 hole metadata 进入实际生产 `evaluateNativeSpatialGeometry`：源矩形联合、最终连续轮廓、实际 VOID 组件的面积和跨度都受 profile 上限；重复、合并、孤立无 metadata 的孔会被拒绝。最大余数分配与确定性打散未见遗漏。
- 撤离从最终身体图产生，检查最早进入真实触发半径的位置，不只检查标记中心；按距离段/区域抽选，不固定最远点或反向位置。最终入口核对出撤点未被静默吸附。
- 完整资源/敌人部署仍由原生产 `deployR100Expedition` 执行；G4 之后才序列化返回。G4 固定节点/区域路径、身体平滑及 q/v/t 消融路径未发现本轮新增的确定性错误。

### 验证边界

- 按任务要求信任并未重跑已有 r11 闭包 3/3、324 配方与 18 负控、孔 profile 7 例、archive 5 例证据。
- 未重复已登记的宏形 Art 退回、B 摘要缺项、G1 未通过；这些不是本报告新增代码问题。
- 未运行 build、全量 tests、完整生产生成、真实 Worker 或浏览器。正式 source-stable 生成与最终构建由主 Code/Director 的独立执行链负责；本报告不能代替那些结果。
- 反例源哈希前后稳定；生产树未被此 QA 修改。写报告时主 Code 已继续修改 generation archive/controller，因此本报告关于其控制流的结论绑定反例记录的源码哈希，后续控制器改动未复审。主体支撑问题的 layout/measure/terrain 位置仍按本报告核对。修复后须复测主体最终支撑反例，再决定是否需要重跑受影响正式样本。

### 独立复验追加：最终支撑与 archive 状态（2026-10-14）

**NS-STATIC-01 已在本次核查范围内修复。** 原问题及原反例保留；新的独立结果为 [`static-support-archive-followup.json`](static-support-archive-followup.json)，6/6 通过、被测源码哈希前后稳定。

- 原 `static-final-support-counterexample.json` 的 definition/seed 原样输入，没有缩小物件、移动位置或更改断缘。`evaluateNativeSpatialFinalSupport` 拒绝该实例，集成 `evaluateNativeSpatialGeometry` 同样包含 `final-source-footprint-unsupported`，不再依赖无关的数量/空白拒绝理由。
- 复核 `native-spatial-final-support.ts` 对每个实体及附属 relief 的投影三角执行真实 VOID 单元相交检查，不仅测三个顶点；严格分离轴排除只有边/角接触的零面积交叠，独立附加 ground-edge 区段不参与主体足迹。`native-spatial-measure.ts` 无条件汇入该 gate，生产 generation 只在完整 ground gate 通过后进入 G2/full deployment。
- 同一个真实主体改用完好土地的正控通过；将原断缘反例的真实实例改为 relief 仍被拒绝，说明没有漏掉附属低面。
- 实际几何 fingerprint 不随 candidate 编号改变，实体移动 8px 则身份改变。代码使用完整 canonical 字符串作 Map 身份，诊断 hash 不直接决定相等；matter、实际 mesh 位置/三角索引、连续轮廓及冻结对象身份参与其中。
- 两个不同真实几何的 archive 小测试确认：最佳基底连续四次无改善后，选择下一个未耗尽基底；两者耗尽后 `nextBase` 为空，生产循环因而转 fresh；同几何换新 candidate ID 不能重启次数。layout、gate、fingerprint 始终绑定同一条目。真实新改善只更新实际父基底的停滞记录，不改写别的基底状态；清阶段后候选释放，历史摘要保留。

**本次没有发现新的确定 P1/P2。** 结论范围是最终支撑门及 geometry identity/stagnation 的静态调用链和上述固定用例，不等于整个 solver 已能成功产图、接受率合格或全部失败路径已穷尽。没有运行整图正式生成、B gate 半成品验收、浏览器、Worker 或内存/FPS测试；构建仍由主执行链统一验证。

复现新独立检查：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx docs/qa/artifacts/native-spatial-2026-10-14/static-support-archive-followup.mjs /tmp/native-support-archive-followup.json
```

原反例脚本和原 JSON 均未改写。原脚本记录的是历史缺门的几何事实，修复闭环以新脚本中“集成 ground gate 必须包含专用拒绝原因”的断言为准。
