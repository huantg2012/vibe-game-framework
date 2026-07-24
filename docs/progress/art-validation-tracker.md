---
status: ACTIVE
created-date: 2026-07-22
last-modified: 2026-07-22
purpose: 追踪美术概念验证循环的进度。支持跨会话恢复。
---

# 美术概念验证进度

## 当前阶段：Foundation Step 3 — 视觉方向锁定

## 验证清单

| # | 概念 | 状态 | VERDICT 位置 | 备注 |
|---|------|------|-------------|------|
| 1 | 净化点全景 | **通过** | `docs/art/demos/home/VERDICT.md` | 风格A确认，分层固定布局方案确认 |
| 2 | 裂隙内部环境 | **通过** | `docs/art/demos/rift/VERDICT.md` | 192829确认；图底比例75:20:5；污染色谱+暖光锚点规则已回写art-direction.md |
| 3 | 污染体：渗透体 | **通过** | `docs/art/demos/entity-infiltrator/VERDICT.md` | 渲染崩坏签名确认；前倾猎食姿态；基底+动态分层设计 |
| 4 | 污染体：改写体 | **通过** | `docs/art/demos/entity-rewriter/VERDICT.md` | 两种崩坏变体确认（爆发型/溶解型）；个体差异合法 |
| 5 | 污染体：覆盖体 | **通过** | `docs/art/demos/entity-overwriter/VERDICT.md` | 多重偏移叠加几何体；三级递进完整验证；gameplay光照联动确认 |
| 6 | 空间裂口 | **通过** | `docs/art/demos/fracture/VERDICT.md` | 纵向撕裂+应力辐射；碎片色温差可辨；远距离地标确认 |
| 7 | 边界外的黑暗 | **通过** | `docs/art/demos/boundary-darkness/VERDICT.md` | 渐变过渡确认；占据感由代码BoundaryAtmosphere承载；过渡弧验证 |

## 已确认的全局经验（传播到所有后续 prompt）

记录于 `docs/art/prompts/concept-prompts.md` 的 "Validated Style Baseline" 章节：
- 高细节像素渲染 > 传统硬边像素画
- 整体极暗，光源面积 < 30%
- 拒绝标准：偏暖偏亮、硬边墙壁、retro-cute 风格
- 建议追加后缀已写入文档

## 补充验证：色彩架构（L1 + L2 + 环境污染表现）

| 验证项 | 结果 | 关键发现 |
|--------|------|----------|
| L1 碎片记忆色 | **通过** | 色温+材质纹理组合有效；三种碎片（暖棕/冷蓝/橄榄灰）可区分 |
| L2 污染色谱 | **通过** | 蓝/正teal/暖绿三色相可区分；contam-ancient 实际使用需后处理压饱和 |
| 环境污染视觉语言 | **通过** | "tilemap 渲染崩坏"替代"有机脉络蔓延"；矩形色块+缝隙透光+数据错误 |
| 浓度递进连续性 | **通过** | "degree not kind" — 同语言调参数，P1→P3 连续递进有效 |

参考图位于 `docs/art/demos/color-validation/`。

## 门禁条件

**全部 7 张通过 + 色彩补充验证通过**：
1. ~~提取统一色板~~ → 已在迭代过程中同步完成（四层色彩架构）
2. ~~确认像素分辨率/细节级别~~ → 已确认（32x32 + 高细节像素渲染）
3. art-direction.md 状态从 DRAFT → APPROVED ← **待执行**
4. Foundation Step 3 正式完成 ← **待执行**

## 恢复指引（新会话用）

如果在新会话中继续本流程：
1. 读取本文件了解进度
2. 读取 `docs/art/prompts/concept-prompts.md` 获取 prompt + 全局经验
3. 读取各 `demos/*/VERDICT.md` 了解已通过概念的结论
4. 从"待生成"的第一项继续引导用户
