# QA Review：DEV 直接构造参考图

日期：2026-10-14。Feature：COH-F011。依据：`docs/specs/system-map-generation.md:153–157` 及 Root 本轮任务合同。范围为 `native-spatial-construction-reference.ts`、`native-spatial-construction-shore.ts`、`check-construction-reference.mjs`，只读追踪其调用的现有门与恢复身份检查。QA 未修改生产源码/CSV，未运行生成、编译、地图测试或新检查工具。

## 结论

最新冻结实现没有绕过 G1–G4 或普通恢复入口；两个计数问题及贴 frame 输入边界问题均已修复。本次窄审未发现新的重要代码阻断，但最终 `reference-final` 仍被 G1/G3 拒绝，不能称为完整参考图准入通过。round1–21 加 final 共 22 次构造验证，21 rejected、1 作者输入 failed，全部未进入完整候选。以下章节保留各次审查事实，最终边界复核见文末。

## 具体问题

**NCR-QA-01 / Medium / 已修复（初审记录）：切口的额外 8px 连接段可能越过 frame。** 初审 `native-spatial-construction-shore.ts:88` 仅限制切入深度，`:102` 随后向原岸外再延伸 8px。构造器允许地床贴 frame；例如原左岸 `x=0`，一个合法 inward cut 的最终矩形会从 `x=-8` 开始，随后被 `fragment-shape/validation.ts:19` 的矩形边界检查拒绝。右/上/下边界同理。round4 CSV 有充分边距，未触发；不是该图失败原因。最终版本已将连接矩形 clamp 到 frame，关闭依据见文末。

本轮初审发现的两项已关闭：

- **完整候选异常漏记已关闭。** 工具 `:106` 的 finally 从真实 attempt 同步 `fullCandidates`，完整候选已扣槽后抛出 deadline 也不再在汇总中记为 0。`:98` 在 stage 返回前保存 complete 结果，final checkpoint 抛错也保留该状态。
- **编译口径已澄清。** `:26,83,106` 分列 fragment authoring compile、initial geometry build、Master build attempt。后者按成功结果或真实 master/deployment/routes 拒绝阶段推导；不再把完整部署内部再次调用 `compileNativeTerrain` 隐藏在“所有物理只编一次”中。岸线源足迹提取也调用 `buildNativeVolume`，不应将这套计数解读为所有底层 mesh 函数的调用总数。认可目标是一次完整布局/断缘、一次初始几何、至多一次正式 Master；没有重试或搜索。

## 通过的静态核对

- 构造器一次收集完整母体及 attached relief、从属实体、H、L；保持 profile 尺寸/旋转、母体完整性、允许数量对和 B0 检查。岸线只遍历原 L union 的外部岸线，排除内部封闭空腔，不递归处理新台阶。H、原 join、protect、出生与每个源三角形投影包围盒限制 inward cut；最终仍由真实身份/支撑/连通门判定，保护预测不代替实际通过。
- `reference:128–132` 把所有岸线 additions/cuts 与原 L/H 一起交给认可断缘编译器，单一调用点有计数回调；两份 CSV hash 的组合进入 fragment sourceHash，原 seed/seedSalt 保持。代码没有导入或执行布局搜索控制器。
- 工具 `:86–98` 使用真实 geometry/structure/visibility 结果构造 trace，保留全部拒因；只有 G1/G2/G3 同时通过才执行一次 `completeNativeSpatialCandidate`。既有完整候选继续检查撤离、实际 Master 几何一致、完整内容、G4 与 deadline；失败不会改 seed、补洞、降低门或再试候选。
- 新输出目录禁止覆盖；CSV、布局、失败实际 geometry、SVG/PNG 和 report 分别保存。正常几何拒绝、完整候选拒绝及异常均保持非 passed 状态，进程返回失败。round1–round4 的失败记录独立存在，没有用后续结果覆盖历史失败。
- 构造器仅由此离线工具调用，没有接入普通出发/恢复。保存的普通 r12 `recipe.json` 只是材料/规则输入，不能编码此参考布局；CSV/组合 hash/实际 fragment 另存。普通恢复仍沿 `executeRiftGeneration` 重建并经 `assertMatchingRiftIdentity`，同步恢复也核对实际 signature。此次没有新增把参考图伪装成普通 r12 可恢复存档的入口；未做成功恢复实测。

## 已读证据及限制

`shore-input-round1/report.json`：纯输入检查通过，sourcesStable=true，fragment/geometry/Master/full 计数均 0。包含无 shore 时原矩形与 seed 不变、单层确定性岸线、合成 protected/support bounds、frame、封闭 union 空腔排除。该回执没有运行实际 shore 几何，不作为 G1–G4 或真实支撑通过证据。

Root 的 `reference-round4/report.json`：sourcesStable=true，耗时约 2.259 秒；1 reference、1 fragment compile、1 initial geometry、1 visibility，0 Master / 0 full。实际为 12H / 6S；可达 28,010 / 支撑 28,173 个身体站位，实际面积 1,803,072px²（目标 1,575,616），最大空白半径上界约 200.716px、深空白跨度 896px、宽域占比约 0.544706。拒因完整保留：身体域不连通、面积超意图、G1 最大空白/深空白、G3 宽域面积，以及 G2 `body-route-to-cover-exceeds-limit`。本次 14 段原岸、41 个台阶段、12 additions / 3 cuts 没有令失败被忽略；未到内容部署/G4，不能声称这些后续门已经实测通过。`geometry.v8.gz`、`layout.json`、两份 CSV、配方与剪影均已保存。

本 QA 仅阅读这些回执及代码；构建由 Root 统一执行，视觉与游戏体验不在本次判定内。

## 冻结指纹

以下完整路径→SHA-256 按键排序紧凑 JSON 聚合为 `5c83adc73c5820d4241bdbac194962fcc35d9a89c41dfc778229a58f43d0a499`，与 shore 输入检查及 round4 来源一致。

```text
src/generation/world-study/native-spatial-construction-reference.ts 408afd0d6412f437106c5770e52da0b17442270cd5820ff2e6421d2a71184199
src/generation/world-study/native-spatial-construction-shore.ts     23fb68090050b43ce6ec8e10fdc5aa791df15b51296f405e950b5e1530095134
tools/native-spatial/check-construction-reference.mjs              9329f732bbf8ab701f42f5adbdc567e33028c9aba124e6cb02cd697850d5024a
```

当前参考 CSV hash：`afa9acb4d787fb5c0a88c2bcea0385fa62997ff3c4d4ed49bdef78553112a019`；岸线 CSV hash：`4913ad48af7cd21d8a4ee9538285f456e260288b0e65908ed06f732b4bb0b9de`；组合身份：`18974690ac49b67903e76d156e62633641812f842c09de525c81ecc9fd1d3d47`。

## 最终窄审：岸线筛选与 round15

2026-10-14。仅复核本轮冻结的 shore/reference/checker、普通/DEV 工厂差异和已保存回执，没有运行地图或任何测试。**未发现新的重要代码阻断；生成目标仍未完成。**

- `shore:131–133` 对额外连接段的完整矩形执行 frame clamp，原 NCR-QA-01 关闭。外伸另受 32px inset；该 inset 是构造筛选，没有取代身体支撑/连通门。
- `shore:107–113` 从原边 begin 扫到 end，按 cut/add 交替，去除强制 retain 和无条件两端 8px 留缝。每段只试一次，受保护/覆盖失败仍保留原岸，没有缩小深度重试或新增候选搜索。删除固定留缝不等于所有形态细针均已被实测消除。
- `reference:127–128` 的外伸覆盖只使用填充 H 矩形和实际 S 三角投影，relief 只受支撑保护、不充覆盖。`shore:68–74` 使用 8px 格中心距离加半对角误差。外伸 cap 现为冻结 `maxEmptyRadiusPx`（本图 160），属于 Root 明确批准的构造选择变化；`measure:129,164–165` 仍分别执行原 deep threshold、最大空白和深区跨度硬门。该预筛没有直接写 gate.accepted，也没有把估计作为实际几何结论。
- `checker:94–114` 保留原 G1/G2/G3 → 单次完整候选 → 原 G4 流程，最终 status 仍取实际结果，拒绝/异常与来源变动均不能成为通过；full/Master 汇总计数仍在 finally 保留。`--check-only` 的 passed 仅表示输入逻辑检查，其全部地图计数为 0，不能用作完整地图通过。
- 普通 `create/selectR100ProductionRecipe` 仍走 r11，DEV gym 只有显式 `nativeSpatial=1` 才用 r12；两文件 hash 与隔离审查一致。独立构造器仍没有普通玩家调用方，CSV 组合身份仍保存在 fragment/参考产物；普通 r12 配方不编码该布局。旧保存配方的 validator/执行分派和实际 signature 比对仍保留，未新增普通配方恢复参考图的入口，也未声称做过此恢复实测。

已读 `shore-input-round2/report.json`：13 项 shore 纯检查与无 shore 原样检查通过、0 地图编译，包含贴 frame cut clamp、32px inset、无覆盖不外伸、格误差与三角距离。其 shore/reference 指纹早于 Root 后来的 cap、交替及 begin/end 改动，不能把该回执称为最终来源的全部纯回归通过；本 QA 只静审这些后续差异，未要求或新增测试任务。

已读最新 `reference-round15/report.json`，五个审查文件与其 sourceHashes 均一致，sourcesStable=true：状态 **rejected**，耗时约 1.847 秒，1 reference / 1 fragment compile / 1 initial geometry / 1 visibility，0 Master / 0 full。实际 12H / 6S，26,798 个身体站位全部可达，面积 1,715,072px²；最大空白半径上界约 172.030px，深区跨度 592px，宽域占比约 0.548101，最大宽域连通占比约 0.987473。仍拒绝 G1 最大空白、G1 深区跨度、G3 宽域面积及 G2 `body-route-to-cover-exceeds-limit`。14 段原岸产生 42 个台阶段、0 additions / 9 cuts；没有以全可达或数量正确覆盖上述失败。此前 14 轮未准入的记录保留，round15 也没有进入内容部署/G4，不能称完成或成功参考地图。最长边后续只可作为诊断，未进入本次 PASS 判定。

最终五文件完整路径→SHA-256 按键排序紧凑 JSON 聚合：`27c79cd97c018892c74389c1351a592d441b78dca6d12b21f962e49d336b2e8d`。

```text
src/generation/world-study/native-spatial-construction-reference.ts 1249266838de15279727fbd455f0a16b664eeafc290616310394cbf4c954d77a
src/generation/world-study/native-spatial-construction-shore.ts     a0cf2755e4bff0ab31230bde04559b60cc447d18d69d1ee6db1b1de909742d02
tools/native-spatial/check-construction-reference.mjs              3c9f56ef719120454c7fbeb46466d3504659129777848e280fd0efffe59820f5
src/generation/world-study/r100-package.ts                         e750042834c0b6e5ddfb6a92e07862d0f4d1a073e99b3b8993f4c1a4d34aa09d
src/dev/r100-gym.ts                                               ac356f0ef8edfc0ec0d68e8f4f13855850a4cd3778f60f08c015ba453db7e433
```

round15 参考 CSV hash：`cbe3f8734779bbb03ba9f31a64d3938e327d9ca4ca46cac730be99bb7a97b64c`；岸线 CSV hash：`de9b7082ff54b2e75ed99d6daf3a4fa052286f546d2a1ec2ff8c5ec6e23548f4`；组合身份：`7acfc752cb9a2258883ec0eaf90d2ba1a167e55494afcd19e8ca957cb0418fb4`；实际 geometry hash：`bc2e13e6f2a7edca`。这些是失败参考图身份，不是普通 r12 的可恢复配方身份。

## 最终边界增量复核

2026-10-14，仅阅读新增代码及冻结回执，未执行地图、测试或边界重算。**没有新增重要代码阻断；空间准入仍失败。**

`shore:126–132` 将小于 segmentMinPx 的剩余尾段并入当前段，完整合并后的段继续接受原保护、覆盖和 frame 检查，不另外尝试新形态。完整原边本身短于下限仍保留；此改动不代表所有细针或全部轮廓美感已通过。

`measureNativeConstructionBoundary`（`shore:48–57`）读取实际编译后的 terrainOutline，先移除连续重复点，再用环形前后邻居去掉同向共线点；首尾处也参与同一判定。点积非正的折返点保留，不把返回同线的不同段合并。最终相邻转角的欧氏距离包含闭环最后一段，因此把一条直边拆成多个顶点不会降低最长直段。输入经原 fragment 编译器验证；这里没有重新取作者矩形边或只量栅格子段。

CSV 新字段 `max_clean_run_px=384` 被严格解析并进入岸线 sourceHash/组合身份。`checker:94,108` 先测实际 outline，随后在原 geometry/visibility 拒因之外追加 `shore-long-clean-run`；边界合格不能消除原门失败。与上一节“只作诊断”的旧阶段相比，本次 Root 明确授权了独立边界回归门；这不是降低原空间标准，也不等于人工审美验收。

已读 `shore-input-final/report.json`：13 项既有 shore 检查、无 shore 原样检查和 3 项新增边界检查通过；共线拆点跨环首尾的 400px 边在 384px 限制下拒绝，在精确 400px 限制下接受。全部地图计数为 0。该纯回执和 `reference-final/report.json` 的五个审查文件均与当前源码一致，sourcesStable=true。

最终真实回执 `reference-final` 为 **rejected**，约 1.731 秒：1 reference、1 fragment compile、1 initial geometry、1 visibility，0 Master / 0 full。最长实际共线直段 272px ≤384，边界门通过；G2 通过，12H/6S，26,244 个身体站位全部可达。但最大空白半径上界约 167.743px、深区跨度 584px、宽域占比约 0.548735，仍分别触发 G1/G1/G3 三项拒因。因此只能确认本次边界门及 G2 通过，不能称完整参考图、内容部署或 G4 已通过。Root 提供的旧 round2 最长边 932px 属对比诊断，本 QA 未重新测量旧图。

失败总数已按保存 report 逐份核对：`reference-round1` 至 `reference-round21` 加 `reference-final` 共 **22 次构造验证**，其中 **21 次几何/可见性阶段 rejected，1 次 round19 作者 rotation 输入非法 failed**。round19 在 `construct-and-break-edges` 内、实际断缘前终止；其余覆盖断缘、初始 geometry、结构身份、G1/G3 与 G2。全部 `fullCandidates=0`，没有任何一次进入正式 Master、内容部署或 G4；不能把这些记为“22 次完整候选失败”。既有失败均独立保留。

最终五文件（仍为上节所列路径）聚合 SHA-256：`fccb4dffcf4e7f7725b8800c44d8d72214e1f7aff284a4939536dc7cd5d85e1d`。其中 shore 更新为 `abbcf877ceb30ffcfa0af6059b7147192bff5d97f78510ed398f3f5631d8c103`，checker 更新为 `82d0dcc5263fe1200df3d913f99156265a7e69d91467d96ebc1c686998528e60`；reference/package/gym 与上一节相同，普通/DEV隔离及恢复边界未改变。

最终参考 CSV hash：`193b8c6d9c266f66f4a55df0ec17df7b34205650a731f360f8d18ac80ed34d42`；岸线 CSV hash：`e85563655454dea2a4fe0f141c3c15dab61600461a79a4f023a3791b2b97d75c`；组合身份：`fcd79fd9974d8c5f3ae845c67935e8f22cfec5e5e0db098607678955c341291c`；geometry hash：`b6ae0b8f409bb3f7`。本 QA 仅更新本报告，未改源码、CSV、CLAUDE 或索引状态。
