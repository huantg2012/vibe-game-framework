# 全库地图与翻找残骸推广：独立复评

日期：2026-10-13。审查对象：`d8cd69b7`，相对 `17476a4e`。绑定 COH-F007/F011/F012/F013/F014/F019/F044/F052，验证工具关联 COH-F050。

## 结论

发现一项 **P2 验证工具缺陷**；本次未发现可复现的新增游戏代码错误。现有全库 108 世界、三档 324 格证据完整，最终来源与被审提交一致。地图构型与残骸融合在所抽样的实际产物中成立，但不据此代签全库审美或自然探索体验。

另保留一项 P3 美术润色建议：壳类残骸翻后主块过于完整。这是原六图已存在的共享画法，本次推广扩大了使用范围，不计为本次新增回归。

本轮只审查、记录与打开图册；未修改游戏、作者数据或验证工具。

## WU-01 · P2：未结束的批次可被图册计为已验证

位置：`tools/world-upgrades-rollout/build-gallery.mjs:13–15,38–40`。

`collectEvidence` 读入批次的 `status`，但将每条存在图片的 case 计为 verified 时未要求批次已经结束。`check-batch.mjs:191` 每跑完一例就把状态仍为 `running` 的报告落盘，跨污染档位的地形/支持面一致性检查在第 192 行才执行，第 193 行才写终态。如果进程在最后一例落盘后、中间跨档检查前被中断，聚合器会将未完成验证的三档显示为通过。

已复现：以 Monolith 单世界三档构造上述中断状态，将中档 `shapeHash` 改成不同值。结果仍为 `verifiedGradeCells=3`、`complete=true`、`issues=[]`。这是验证工具的可复现漏检，不是实际地图故障证据。

建议修复：汇总时明确区分未完成批次与已完成批次；未完成记录可以展示，但不得计入已验证覆盖或充当失败替换的有效凭据。保留已结束批次中的逐例结果和历史失败语义，增加中断、未知状态及失败替换反例。

**当前交付影响：** 已独立扫描本次真实 receipt，没有未结束的 `running` 批次，324 格结果没有因这个漏洞被否定。该问题影响后续中断/重跑场景的可信度，整改尚未实施。

反例与分审：[验证分审](../qa/artifacts/world-upgrades-review-2026-10-13/evidence/report.md)；[反例结果](../qa/artifacts/world-upgrades-review-2026-10-13/evidence/gallery-unfinished-counterexample.json)。

## WU-02 · P3：壳类翻后状态可再加强（既有画法）

Ivory Basin 与 Porcelain Maw 的正常视口截图中，翻后仍保留较完整的浅色主体，前后状态的剪影差异比纤维/晶体残骸弱。`src/systems/r100-world/search-site-shapes.ts:190–196` 保留前后的主 skin 片，仅压低、错开部分弧片；该文件本次未修改，原 Shell Chain 也采用相同表现。新增覆盖行见 `data/rift-search-sites.csv:18,40`。

可考虑让翻后主体断开、塌低或露出更明显的空腔，同时保持同材料受光。此项是静帧可读性的专家建议，未观察到真实玩家重复误搜，也不表示翻找功能或状态恢复失败。需要在后续正常移动镜头下确认改善，不能直接以缩略图决定数值。

实图：[Ivory 翻前](../qa/artifacts/world-upgrades-rollout-2026-10-12/runtime/six-families/ivory-basin-low-gym/before.png) / [翻后](../qa/artifacts/world-upgrades-rollout-2026-10-12/runtime/six-families/ivory-basin-low-gym/after.png)；[Porcelain 翻前](../qa/artifacts/world-upgrades-rollout-2026-10-12/runtime/six-families/porcelain-maw-medium-gym/before.png) / [翻后](../qa/artifacts/world-upgrades-rollout-2026-10-12/runtime/six-families/porcelain-maw-medium-gym/after.png)。

## 已核对的结果

- 注册与入口：108 个原生世界均启用且具有正选择权重；矩形构型与环境翻找策略均覆盖 108 项，正式出发链消费修订 10。
- 证据：重新聚合真实记录为 324/324，无未决失败、资产缺失或重复；最终源指纹与当前实现一致。早期 48 例未保存完整 recipe，只能使用已披露的固定来源与几何等核对；其余 276 例包含逐字段 recipe 对照，不将两者说成等强验证。本轮另重跑 Monolith 三档现源核对及 Cinder r9 / Monolith r8 完整回放，均通过。
- 代码：修订 9 封存闭包重建、恢复投影、修订 10 来源归属反例、三项 CSV codegen 和类型检查通过。另实际重跑 Porcelain Maw、Pleated Hide 重档 seed 0；Pale Sail r9、Woven Quarters r8 完整地图及两态四通道回放通过。[代码分审](../qa/artifacts/world-upgrades-review-2026-10-13/code/report.json)
- 美术：独立审看六组共 27 张中档全图，跨六材料族；八图正常镜头前/近/背向/后面板，并复看八张完整翻前画面及两张壳类翻后画面。样本内未发现整体回退为近矩形盘或房间—走廊构型。正常镜头能看到材料、接触与翻后痕迹的延续，不等于盲搜可发现性测试。[美术分审](../qa/artifacts/world-upgrades-review-2026-10-13/art/REVIEW.md)
- 构建：本轮 `npm run build` 通过；保留 Vite 大包体警告。
- 既有运行证据：三张重档各约 61 秒的预算、代表 VOID 实际遮挡、Wax 正式入口与冷续证据已核对来源。生命周期“全部 GL 数量严格相等”的原始检查仍为失败；减少的一张被定位为 Phaser 启动临时纹理，游戏拥有资源量未增长。未将诊断说明改写成原门槛通过。

## 证据边界与后续

三路均为知情专家审查，不是新玩家盲测。本轮没有重跑全部 324 张地图，没有新做自然搜撤、性能或长期经营；历史有限 seed、参考机和真实输入证据保留原范围。27 张图的独立美术抽查不能扩为 108 图终审。

WU-01 登记待修；WU-02 登记后续润色。I14 仍 13/14、P49 开放，弱设备豁免保持。原索引顶端残留“102 暂停”的过时摘要在本次审查归档时同步为已推广事实，不改变游戏状态。

[打开全库图册](../qa/artifacts/world-upgrades-rollout-2026-10-12/index.html) · [原推广任务](../tasks/rift-spatial-rollout.md) · [原专项 QA](../qa/world-upgrades-rollout-2026-10-12.md) · [待办](../progress/backlog-issues.md)
