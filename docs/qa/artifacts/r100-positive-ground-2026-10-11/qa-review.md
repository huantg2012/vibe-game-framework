# QA：正向地床与冻结合同

日期：2026-10-11。Feature：COH-F007 / F011 / F012 / F013 / F014。

基准为 `docs/specs/system-map-generation.md` 的 DEC-201 与 `docs/architecture.md` 对应约束；代码为 `3e0821a7` 之后本轮工作树。审查文件的 SHA-256 见 [qa-review-sources.json](qa-review-sources.json)，独立执行时的文件哈希和时间见 [qa-small-checks-final.json](qa-small-checks-final.json)。

## 结论

在本次静态合同审查和小夹具覆盖范围内，**没有发现必须修复的生产 Bug**。这不是完整地图验收，也不代表宏观轮廓、障碍密度或探索体验已获通过。三档生产生成、去雾实图、普通视野实走、构建和性能由 Root / Code / Art 分别负责，本报告不代签。

## 独立验证

执行 `TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json QA_REPORT=docs/qa/artifacts/r100-positive-ground-2026-10-11/qa-small-checks-final.json node --import tsx tools/spatial-rollout/check-positive-ground-qa.mjs`。四项小检查完成，运行前后被测源码未变。

- 简单凹外环与严格内含孔在正、反绕序下均合法。
- 构造孔的所有顶点都在地床内，但两条孔边横穿外环凹口：被拒绝。仅检查孔顶点会漏掉的反例已有独立覆盖。
- 内孔与凹口岸线共边接触：被拒绝。
- 320×320 的裸地夹具以独立 winding-number 算法定义 8px 支撑；按正常 `NativeVolumeLighting → bakeMasterSurface` 调用逐像素检查最终 albedo alpha。67,392 个有地像素和 35,008 个缺地像素全部一致。3,584 个有地像素位于粗格中心无地的部分 32px 格内，仍被保留。外岸与内孔分别产生边沿字段；无地像素的字段为零，远离外岸的内孔字段与移除外环的控制组一致。

裸地夹具不包含生产障碍、光照、照片材质与实际部署；它证明最终烘焙遵守传入的 8px 支撑，不能独立证明生产生成器产生的支撑正确。真实 `createMasterWorld` 的支撑 / sight / tileMap / ground-edge 几何由下述 Code 测试补充，二者结论不可混写。

## 静态核查

- **冻结来源唯一。** `r100-package.ts:99` 拒绝原尺寸 `recipe.nativeDefinition` 拥有 `terrainOutline`，合法环也不能成为第二来源；`r100-spatial-world.ts:121` 在展开接口再次拒绝。新增字段只从冻结 spatialPolicy 进入展开后的 MasterDefinition。此限制针对新增字段，不把现有 nativeDefinition 改成严格全字段白名单。
- **准入与身份。** spatialPolicy 的严格键检查只额外容许 `terrainOutline`；存在但为 null / undefined 会进入验证并失败。含外环只允许 authored-sectors。依赖收据包含完整 spatialPolicy；恢复读取冻结值，没有拿当前 CSV 环或 sourceHash 替换旧环。保存身份还包含 generation、物理地图与 geometryFingerprint。Worker 序列化保留 definition；hydrate 从传输的物理 TileMap 恢复 support / sight。
- **非法几何。** 外环复用简单多边形验证：3–32 个互异、有限、有界顶点，只含 x/y 字段，面积至少 64px²；拒绝退化、邻边反折与非邻边相交。内孔先由 spatialPolicy 验证，再要求全顶点内含且全部孔边与外岸不相交、不接触。凹口跨越与接触的独立反例见上。
- **物理与显示。** `r100-master-world.ts:106–134` 先从 8px 格中心判断外环内且孔外，再派生 32px sample.land。matterAt 是身体、VOID TileMap 与 sight 的共同来源。外环和内部孔同时送入 ground-edge 几何；surface-fields 以同样 8px 缺地单元作为外岸 / 孔缘源，最终 `surface-bake.ts:53` 先按 matterAt 裁剪。不存在另一张渲染遮黑蒙版来伪装外轮廓。
- **旧无字段路径。** 字段 absent 时保持旧矩形 land 与侵蚀分支，createPolicy / 展开对象均不新增默认键；修订 1–6 仍路由旧执行器。连续性结论限新增字段分支和 Code 的小世界精确对照，不等于已遍历全部旧存档。
- **作者输入。** 离线流程对正向板片严格并集，要求单 Polygon、无内环且有界；内部 cut 严格内含，运行时只读取编译后的外环。框体只作存储范围，内部 erosion 不用来代替地床外边界。编译器与运行时的职责有分层，最终准入仍执行完整几何验证。

## Code 提供的补充证据

[contract.json](contract.json) 由 Code 运行，并由本次 QA 阅读工具与结果，未由 QA 重跑。它覆盖 3,072 个 8px 格、8 孔、46 个部分 32px 格、真实外岸 material 像素及边色、JSON / structured-clone 传输、非法 outline / 冻结删除反例，并以 `3e0821a7` 的实际旧实现对两个小世界种子比较完整可序列化输出和 surfaceFields。

该证据的 `sources` 初稿漏列 `r100-package.ts`，QA 已告知 Code；本报告静态源快照补列该文件。不能把这个静态快照冒充其执行时取样。与实际当前全尺寸轮廓、敌人 / Host 配额及所有旧世界无关的结论仍不扩大。

## 夹具失败记录与限制

[qa-small-checks.json](qa-small-checks.json) 首次失败在夹具错误调用普通 profile 注册表查找 R100 的 cinder-ridge。修正为已生成 R100 profile 后，[qa-small-checks-v2.json](qa-small-checks-v2.json) 失败在将 `ground.rgba` 的黑底预览 alpha 当最终输出。该预览缺地本来为不透明黑；最终 renderer 消费 `bakeMasterSurface.albedo`。

两次失败均已保留并上报 Root。获得一次明确修正授权后，先读正常 bake 签名与调用，再使用真实 NativeVolumeLighting 和 bakeMasterSurface 完成最后验证，没有改生产代码或放宽断言。这两次是 QA 夹具错误，不能记作游戏修复。

本轮没有独立运行浏览器、全库生成、完整生产地图、性能、全套 build/test，也没有审美代签。尤其四项通过不能证明外轮廓不再近矩形或洞穴化；这些必须结合最终实际地图与用户复看。

## 追加：普通视野旅程执行器起点错误

Root 的首次真实键盘旅程记录在 [sight-browser/report.json](sight-browser/report.json)：同一目标已从 hidden=0 到 revealed=0.6，角色 HP=100，但准备返回 observer 时工具报 `No swept-body path to witness`。原失败不改写，也不能把前两段成功写成完整往返通过。

QA 经授权仅重建 `browser-initial/capture.json` 中冻结 recipe 的已准入有效种子 114481409，固定已记录撤离位置，没有再次执行种子选择或全套生产；重建 geometryFingerprint 为 `3af97183`，与原截图和旅程相同。只读取 TileMap、meshes 和实际 NativeBodyCollision 来核查坐标，证据见 [navigation-start-probe.json](navigation-start-probe.json)。

确定问题在取证工具，而非当前已证明的身体或地图错误：实际位置 `(1339.2581253916337, 544.9338281899163)` 对 nativeBody 合法，对保守 8px grid 不合法。原工具用该位置所在格的中心 `(1340,548)` 作为 BFS 根，它同样不满足保守 grid；旧 BFS 仅访问 1 个格即停止。真实 20px 身体能完整扫掠到合法中心 `(1332,548)`，距离 7.879px、fraction=1；保守 grid 从同一实际位置做扫掠却返回 0。因此单纯改为“从实际点调用旧 grid sweep”仍然不够。

修复限定 `tools/spatial-rollout/capture-sight-journey.mjs`：读取场景已有 nativeBody，对实际点到附近 32px 内合法导航格心逐一做真实 20px 身体扫掠；BFS 只从通过的格心开始，后续保留原保守网格和完整 body sweep。实际起点无真实支撑、没有安全接入或目标格不合法时均明确失败；不瞬移、不改角色坐标、不改身体、不增删地图。每段证据新增实际点、旧格心、两类支撑差异及所选接入的距离和 sweepFraction。修复时 `node --check` 已通过；实际新一轮键盘往返由 Root 单独执行记录，本段不预报运行结果。

## 追加：修复后的真实旅程复核

Root 执行的 [sight-browser-fixed/report.json](sight-browser-fixed/report.json) 已完成，QA 仅只读核对报告及源快照，没有再次启动生成或浏览器。新旧两次 source-snapshot 的文件哈希集合完全相同，世界 cinder-ridge / medium、请求种子 20261010、geometryFingerprint `3af97183` 与 witness 均一致。

该次实际键盘旅程的 hidden → revealed → returned 当前可见度为 **0 → 1 → 0**；三个采样站的 unoccludedVisibility 都是 1，HP 都是 100，run 未结束，页面错误为空。返回段确实覆盖此前失败类型：实际点 `(1343.4161,550.6061)` 与旧格心都不满足保守 grid，但 nativeBody 合法；工具经完整 native sweep=1 接入 `(1324,532)`，接入距离 26.8919px，随后通过保守网格走回观测区域。该结果支持执行器起点修复有效。

**位置限制需要明确。** 第三段 walk 结束在 `(1452.3931,369.6626)`，接近原 observer `(1452,372)`；随后用于转向的真实按键又带来约 103.82px 位移，returned 采样点为 `(1466.3026,472.5471)`。它也不等于首次 hidden 的实际点 `(1452.8513,406.2526)`。因此本例证明“绕过空洞后目标显露，回到遮挡侧后目标再次不可见”，不证明在完全相同的观察坐标完成同点复测。工具报告的 passed 不能覆盖这一坐标差异。

最终限定结论：本次中污染、一个请求种子、**一个内部 VOID 见证**的完整正常输入旅程完成，范围和朝向对照有效，修复分支在真实执行中被触发；原失败完整保留。它不等于 8 孔均有真实旅程，不等于其他污染档、其他种子或初见探索体验通过，也不代替地图轮廓、空洞组织与密度的人审。性能是 Root 另行执行的证据，本次只读复核未重新测量或代签。
