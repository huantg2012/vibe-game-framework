# QA Report: 六图翻找地表集成与状态边界

日期：2026-10-12。Feature IDs：COH-F019、COH-F012、COH-F013，关联 F044／F007。

规范基准：[D0 方案](../../../design-notes/pickup-grounding-plan.md)、[Art 合同](../../../art/pickup-grounding.md)、[来源部署](../../../specs/system-map-generation.md#grounded-search-sites)、[翻找与残迹](../../../specs/system-chaos-scavenge-extract.md#grounded-search-sites)。规则已存在，本轮不是无 spec 的通用扫描。

代码基线：`7c744d3dabdee45cafbafe375878f81bae328c1c` 加本轮未提交工作树；不能将该 HEAD 本身解释为已经包含新实现。验证时间点的关键源指纹见文末，整体快照与最终构建由主代理归档。

环境：macOS，Node.js v22.14.0，项目 `tsx`／Phaser CPU stub；正式函数执行，浏览器、GL、DOM 和未绑定声音端口有明确适配。没有亲自操作浏览器，没有用 fake GL 评价图像、真实 FOV、性能或美感。

## 结论与问题

当前限定 CPU／静态检查未发现未修复的阻断或高严重度问题。新实现的状态权威仍来自原 `collected`，没有增加第二份“搜过”状态。既有 r8 路径没有取得新 patch；真正的图像与人审必须由本轮实景证据补足。

| ID | 类型 | 严重度 | 事实与处理 | 位置／依据 |
| --- | --- | --- | --- | --- |
| PG-QA-01 | 兼容风险，已修复并回归 | Low | 初稿 `afterUpdate` 无条件读 `frame.piles`，既有旧 presentation 测试的最小 frame 不提供该字段。主代理已改为仅有 `world.searchSites` 的新路径读取；新增测试用抛错 getter 证明旧路径不读取。不是已复现的正式游戏崩溃。 | `presentation.ts:104`；旧 r8 隔离合同 |
| PG-QA-02 | 验证限制 | — | 本报告不能确认正常尺寸可发现性、六材质感、实体边缘实景遮盖、FOV 边界、实际灯向与距离响应，也不能确认真实 GPU 帧率；这些须引用浏览器及 Art 独立证据。 | Art 实景验收／D0 P1–P3 |

## 自动检查

工具：[check-runtime.ts](../../../../tools/pickup-grounding/check-runtime.ts)。运行：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/pickup-grounding/check-runtime.ts --production
```

默认局部检查 7 组已经通过；`--production` 加一组实际 r9 preparation／接收校验。实际生成样本为 `pale-sail`、请求 seed `20261012`、medium，不将一个样本外推为六图全档资格。传输测试使用合成已解码色块，目的在于数据／内存合同，绝不作为材料画面证据。

- 接收拒绝：新世界缺 patch、数量不符、重复 node、外来 node、非整数／越界尺寸、核心不在 patch 内、二维矩形覆盖重叠。intact／searched 的每一种通道缺失、长度错误、错误数组类型均拒绝；VOID 任一非零通道值拒绝。
- CPU 组合逐字节核对：只更改局部矩形，矩形外四通道保持；源前后态未被写坏。
- GL 所有权和更新：一次状态变化恰好上传四个局部通道；重复 120 帧同 collected 值不上传，不重传整张表面。切回 intact 仍能恢复正确值。销毁清空 patch CPU 引用并释放已分配 GPU 句柄，重复销毁及销毁后状态同步不重复释放／上传。
- 首帧恢复：真实 `MasterPresentation` 先接收已 collected frame，再在首 draw 前完成四通道更新；没有先绘制 intact 的中间帧。恢复时不触发 reveal 粒子或材料事件；后续相同帧无再次上传。
- 旧路径：没有 searchSites 的 presentation 不读取 piles，也不取得 patch 内存。
- 新 visual：仅分配原有 chip／reveal 池，不创建 pile shell／世界 sprite／反光纹理；120 秒 idle 不产生 tween，真实 rummage 和 reveal 才有原反馈。显隐与销毁能够清理池对象。
- 原 `LootSearchSystem`：实际按 E 中断保持未翻；1200ms 完成才变 collected。真实库存拒写保留未翻及同一已抽结果；重试成功且容量不足时，物件留在原坐标地面，残迹不再参与未翻 E 目标。冷恢复不重发声音、不重播奖励、不复制地面物件；纯薪柴也不再入账。
- 实际 r9 Worker 输出：来源 visualSeed 变化会改变准备身份；外来身份、缺全部 patches、任何前／后态缺重数组均被拒绝。derived buffers 可 detached transfer 后正常接收，调用者 native 数据及原材料像素没有被 detach。

新增测试开发过程中曾因测试重置库存时漏建出击武器、把初始武器计入“新奖励”而失败；已修正 fixture，未改产品代码。失败属于测试搭建，不计游戏缺陷。

## 静态核对与实际限度

1. `SearchSitePlanner` 的环境分只加入既有合法候选排序；原配额、间距、48px 站位、risk 路程条件仍先筛选。评分确实会改变部分节点位置，不能将本次描述为“纯贴图替换、所有路线不变”；完整风险矩阵由生成专项承担，本报告不代签。
2. 来源与形态接口无 kind／value／tier／rarity／dropPlan，视觉 seed 来自世界 seed 与坐标，baker 不解析 node ID；同世界材料的形制由 source family／关系决定。库存奖励只在原完成事务后参与 reveal。
3. baker 写像素前检查实际 matter、solid、原 albedo 存在与承托高度，只写自己的局部 surface 副本；不修改 tileMap、raster 物理域或身体／视线查询。表现接原地表 renderer 及原迷雾，下层 patch 没有独立显隐或新光源。这个静态结论不代替逐像素真实 FOV 实测。
4. `surface-preparation` 在 Worker 预烘并校验，再组合 intact；renderer 只在已保存状态变化时替换局部四通道。场景继续通过同一个 search state 生成 presentation frame。恢复流程先 `search.restoreRuntimeState`、再同步 presentation，最后才绘制；没有新奖励调用入口。
5. 新 recipe 的六图选择来自 CSV 注册，修订9和来源策略参与身份；其他102图新局与旧 r8 走冻结执行器。场景以 `native.searchSites` 分流到 surface-only visual，旧路径继续原 sprite。旧版全图/四通道逐字节恢复结果须引用生成与纯 bake 专项，本 CPU 套件不作该数量声明。
6. 未改 HUD、面板、文字或布局；U1–U12 本轮没有新增 UI 验收对象。原交互反馈沿用，不因世界地表实现而重开整个 UI 审美流程。

构建：本仓库没有 `npm test` 脚本。本次使用以上专项；主代理报告当前 `npm run build` 通过，耗时15.34秒，记录为[build.log](build.log)，有既有大 chunk 警告。QA 没有重复执行或将该结果外推到后续修改；最终版本仍由主代理统一归档。

截至本报告收尾，Art 已退回 Splayed／Pale 的首样翻后形体，B 正在修改纯形体，runtime 接口未变。故本报告的状态／数据通过不表示 P1 视觉闭环通过，不得据此跳过新实景复查。

仍需由主代理／Art 汇总：六图正常镜头，三强反例近远／转灯，VOID 与前景边，翻后实景与冷续，实际容量不足物件可见可拾，完整新旧生成／材质恢复和浏览器运行预算。用户审美终验保持未通过状态，102图推广仍暂停。

## 验证版本指纹

以下 SHA-256 对应当前检查的 C 侧关键代码；若这些文件后续变化，需重验相关检查。

```text
search-site-patches.ts  7b79e4244f9f2a2aa5abc55e477dba78502d298ba889101ef4df3c92bbe36b9b
surface-preparation.ts 7cb347a745e38ac4fb797fd9d1ae56af1fd954f5a216b752242ada51d75148ad
surface-renderer.ts    ca876e5b810526f32c57a306d7dcfeb9b6dd0226fb2affa080ae071e20cbdde0
presentation.ts        7bc220d9af91643e261ab1610be1efd1cebfdf085f144178274664330d9acea6
loot-search-presentation.ts ce55b7832bba8a4b18b56290d289b8bf8595bfe6aab48d024d8f9c733d0fb759
```

证据登记 ID 由主代理统一分配，本报告不并行修改共享 game-state 文件。

## 最终接线复核补记

上述 Art 退回与待验段落是首轮时点记录。后续第二版 `search-site-shapes.ts` 调整了 Splayed 交叠核心/断开残丝、Pale 分离残片和 Gel 破整外沿；C 侧状态/数据接口未变。复核没有发现修形引入奖励读取、新碰撞、额外 FOV 或恢复事务入口。最终浏览器快照 `coh-spatial-browser-FPZyCi`（2026-10-12T08:18:28.237Z）的源码清单与复核时当前文件一致。

六图中档最终前后实景及 Pale 低档正式冷续已经由主代理采集，QA 读取报告与前后存档确认：真实 E 完成 collected 变化，状态上传仅一次；冷续 search 完整状态保持、carried=1、revealVisible=false。Pale 正式世界请求 seed 为20261119，脚本 fixture seed 为20261019，报告已增加两者的显式字段，避免把参数当成实际地图身份。

QA 另外发现纯 bake 邻堆正例的原位置差(70,65)不造成80×64窗重叠；B 已改为(79,55)，在满足96px节点间距的情况下先证单独窗确实重叠，再证联合烘焙裁开并保留两核。属于已关闭的测试覆盖缺口，不是被测试证明存在的产品 bug。

主代理的最终专项与类型检查通过，构建最终30.66秒通过；生命周期2次同图+6次混材重建通过，active GL及GPU对象数返回相同基线，最大heap增量958,280字节、backing增量6字节。相关清晰范围与剩余 P3 证据见[最终 QA 汇总](../../pickup-grounding-2026-10-12.md)。本补记不将 CPU、技术接线或专家形体复验当作用户审美通过。

最终另读取 `runtime/sweep/` 四组留出请求seed20261019的完整报告，覆盖积留、表层剥离、母体脱落三关系，近远/转向及真实E均已采样。首批转身在近身全向可视范围内，visibility全部为1；QA未签为FOV裁切。经指出后，`runtime/sweep-far/` 三强反例远距 before/farTurnedAway/farReturned 均为1→0→1，转向不触发状态上传，真实E仍仅一次，错误列表为空。快照795文件全部存在且哈希一致。该补验支持实际目标进出FOV，仍不把中心数值当成任意前景接合逐像素正确的证据。

最终结论：已执行范围没有未修复阻断性产品问题，可交付六图有界对照；完整P3、连续照明美术品质、复杂实体边、容量不足物件实景和用户审美仍保持明确边界。未授权扩大到其余102世界。
