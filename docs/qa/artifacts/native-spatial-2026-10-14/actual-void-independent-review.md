# QA Report: 实际 VOID 反馈与约束优先排序

日期：2026-10-14。Feature：COH-F011 / COH-F013 / COH-F007。

基准：`docs/specs/system-map-generation.md` 的原生联合生成/B 岸湾合同，以及批准设计 `docs/design-notes/world-fragment-native-generation-2026-10-13.md` 的 G1–G3、冻结输入和有限候选准入规则。代码为本次未提交工作树，835 个源文件的执行前后 SHA-256 记录在同目录 `actual-void-independent-review.json`，全部稳定。该 JSON 是本报告的精确版本凭据。

**本次限定检查 8/8 组通过；没有完整地图通过结论。** 未改 src/data。只对已保存的 gel-rafts / medium / 20261012 / c19 和一个合成网格验证，没有换 seed、搜索随机候选或续跑链。正式生产生成、构建及其他验收由 Director 协调。

## 发现并关闭的问题

独立静态审查发现 `NativeSpatialWideDomain.evaluate/commit` 先移除原 occupancy，再验证新 site；非 8px 相位或非有限位置抛错时，旧 occupancy 已损坏，调用方 catch 后仍会消费错误缓存。已通知 Layout Code，由其将 index/site 验证移到任何 mutation 之前。本次独立执行覆盖 evaluate 与 commit 的无效 index、非有限位置、非网格相位共 12 案：全部拒绝且原 wide mask 逐格不变。此问题已在本次快照范围关闭。

## 通过的检查

- 完整 VOID 分区：两个内部 H 和连通外海的非对称 B，最终 mask 无丢格、无重复、无将地面记作 VOID；B 保持在 exterior，H cells 为独立副本。
- 身份拒绝：重复 holeId、两作者孔映射同一 final label、一个作者区域覆盖两个 final label、作者孔冒认 B、机械合并的多分量 H、缺少合格 H、未分配封闭 VOID、H 冒认 exterior，共 8 案均禁用缓存并给出明确原因。
- 移动语义：移动 H 后旧洞填回、新洞阻挡，exterior/B 保留；与独立重建 VOID 查询逐格一致。evaluate 自动恢复、commit 后恢复原位、两个 mask 重叠后解除、返回数组被外部改写均不损坏缓存。
- 排序：先比较最大归一化约束违规，再比较总违规，再比较 mean；`1e-12` 的硬约束违规不能用任意低的 mean 买过，包含双向和相等比较共 9 次断言。
- 真实固定反例：c19 的缓存 wide mask 与实际 8px 几何全部 64,512 格一致，宽核 10,196 格、最大宽连通分量比率 `0.6551588858375834`。第 2 个 joint object（H）北移 16px 后，预测宽核 10,257 格、比率 `1`；重新编译同一移动后的真实地形，比率也为 `1`。
- 预测与准入分离：上例重编后仍因 `G1-largest-empty-radius` 和 `G3-wide-domain-area` 拒绝；最大空白仍 `209.65685424949237px`。连通改善没有跳过实际准入。
- 静态接线：fresh 无实际缓存时 `largestWideRatioProxy` 为 `null`；完整提案仍重编实际几何、实测 ground gate，再判断 visibility 和 yield。此项是静态检查，不称作新生产执行。
- 冻结边界：r12 factory recipe 默认不含 actualVoid/exteriorMask；向 nativeSpatial 冻结输入夹入缓存字段会被 schema 拒绝；未注册 cinder-ridge 的 factory 仍产出有效 r11 配方。

## 成本与限制

固定反例同两个位置交替调用 evaluate：12 次约 3.26ms，192 次约 54.75ms。仅说明此网格的局部查询成本；不包含完整生成、编译、部署、Worker 传输或渲染，不推导 60fps 或 60 秒整图预算通过。

移动缓存是候选引导。自由断缘在重新编译时可能变化，本轮不宣称所有平移后的缓存与实际新地形逐格相同。始终以真实几何重新准入。宽面积仍使用已有反馈校正的 raw16 估计；本次没有修改 G1 规划预留、deep16 图、前 12 个合法候选策略或任何实际硬门。

未覆盖：完整 r12 地图、G2/G4/全配额内容部署、真实 AI 潜行、浏览器/正常相机、玩家审美、全库和 holdout。r11 只核 factory/schema 隔离，未重跑旧局还原。未在本独立有限任务运行全构建；仓库无 `npm test` 脚本，构建由 Director 在收口时统一执行。上述未覆盖不能由 8 组通过外推。

复现命令：

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/native-spatial/check-actual-void-feedback.mjs NEW_REPORT.json
```

工具拒绝覆盖旧报告。正式实现完成前保留本次及此前失败证据。
