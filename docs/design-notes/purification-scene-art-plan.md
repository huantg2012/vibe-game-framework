---
status: R11-LAST-LIGHT-SPATIAL-CORRECTION / IMPLEMENTED / LIMITED-VERIFIED / HUMAN-REVIEW-PENDING / PRODUCTION-NOT-INTEGRATED
created-date: 2026-09-23
last-modified-date: 2026-09-26
owner: director
baseline: 35f17ba（用户明确赞许的完整像素场景）
features: COH-F042 / COH-F026 / COH-F006 / COH-F039
---

# 净化点美术重构计划

## 当前决定

用户要求修正`007554c`的两处布局问题：炉挡住楼梯去供奉/净化器的工作路，核心前仍有无效大空地，记 **HUMAN-CHANGES-REQUESTED**。技术连通不等于舒适通行，前轮内部复核不能替代此次反馈。`35f17ba`、核心内质`347d55a`及休息点`e243381`的认可保留各自范围，不自动覆盖新布局。

设计与恢复原则统一在[美术设计集中正文](../art-direction.md#resume-art-rebuild)。本文件只记执行状态、入口与证据。旧 A/C 构图不再约束本轮；`8ef1366`、`6127218` 仍是历史人审否决。获认可基线保存在 `assets/baseline-35f17ba.png`，查看页可直接切换对照。

## 当前执行状态

**A 已选，裂隙修订待审（2026-09-26）。** 用户“很喜欢 A”，要求裂隙位置/外观重做；[比较页](../art/demos/purification-forecourt-options/index.html)现聚焦新旧 A，冻结 `a-before-rift.png/json`，默认显示左前断沿的新裂隙。A 原断口、宽回廊与无关对象保留；位置/画法见集中正文。严格TS、光源/对象不漂移、路线支撑及浏览器验证通过，独立去掉裂隙光源的同几何渲染证明实际周边受光；不等于正式碰撞或玩家体验验收。当前动态样景与生产仍未替换。

**当前工作：炉席新位置已实现，完整导出、路线及限定浏览器验证通过，人审待定。** 将原休息组整体移到中央偏前，释放西侧楼梯—供奉—净化器工作路，用休息用途组织原空地，并保留核心短接近通道。坐标与构造只维护在[集中正文](../art-direction.md#世界观形体与构造)。

单西坡、六站、箱罐缆线、书架与外景保持；坐姿/肩灯随新锚点，坐下/起身功能、源光参数和材料不变。新预览仅作布局比较，不能沿用`007554c`的导出或浏览器结果作为新版本验证。

入口：[微光中的据点](../art/demos/purification-last-light/index.html)，本地 `http://127.0.0.1:3027/docs/art/demos/purification-last-light/index.html`。默认动态播放，支持暂停、基线/原画、模型查看及坐下；当前素材已完整更新，限定验证见QA。

## 制作与修正

`model.ts`/`environment.ts`/`devices.ts`/`rest.ts`/`actor.ts` 提供可编辑构造；`render.ts` 在像素网格计算可见性、材质、光源遮挡、接触遮蔽和透明叠层；`export.mjs` 导出完整素材、源贡献和掩码。`motion.ts` 只在这些受光关系上演变；`viewer.ts` 负责同场展示、坐下/起身、轻推镜头及生命周期。

## 验证与产物

运行：

```sh
node --import tsx docs/art/demos/purification-last-light/export.mjs
node --import tsx docs/art/demos/purification-last-light/check.mjs --write
```

[统一QA](../qa/iteration-30-last-light-living.md)按版本记录路线、导出与浏览器结果，[证据目录](../qa/artifacts/purification-hearth-circulation-2026-09-26/)保留原始记录。`007554c`技术检查只证明当时的有限连通与交互，用户要求修正其两处布局问题；新位置已完成完整导出、路线与限定浏览器验证，人审待定，不宣称全点可达或正式碰撞通过。技术数字不在活正文重复。

产物：`assets/rest/` 保存坐姿整景、体积底图及三类光场/核心光/动效/深度/对象掩码；`haven.png` / `haven-clean.png` / `haven-2x.png`；六装置与人物的 `model-*.png`；`rift-actor.png`；`light-{pollution,furnace,shoulder}.png`；`motion-map.png` / `depth-layers.png` / `object-ids.png`；`manifest.json` / `checksums.json`。基线PNG为原提交字节副本。

## 当前边界

完成的是动态美术样景及查看器内的坐下体验。站立与坐姿分别烘焙几何和肩灯光场，实时变化是实际受光贡献、污染/空气及独立深处存在；不冒充任意人物移动的实时阴影。休息轻推镜头不补全被遮挡内容，也不是人物驱动视差。没有接正式 `src`、碰撞、六站游戏交互、经济、存档或动作系统；残骸不计为第七功能站，不增加任何恢复或时间机制。原Rift低精度人物和R10生产保持，I28长期采样/平衡继续挂起。

不因内部复核提升新版为人审PASS。按持续授权检查后本地提交，不推送，独立 `CLAUDE.md` 修改排除。
