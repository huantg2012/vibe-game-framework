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
| 2 | 裂隙内部环境 | 待生成 | `docs/art/demos/rift/` | 下一个要做 |
| 3 | 污染体：渗透体 | 待生成 | `docs/art/demos/entity-infiltrator/` | — |
| 4 | 污染体：改写体 | 待生成 | `docs/art/demos/entity-rewriter/` | — |
| 5 | 污染体：覆盖体 | 待生成 | `docs/art/demos/entity-overwriter/` | — |
| 6 | 空间裂口 | 待生成 | `docs/art/demos/fracture/` | — |
| 7 | 边界外的黑暗 | 待生成 | `docs/art/demos/boundary-darkness/` | — |

## 已确认的全局经验（传播到所有后续 prompt）

记录于 `docs/art/prompts/concept-prompts.md` 的 "Validated Style Baseline" 章节：
- 高细节像素渲染 > 传统硬边像素画
- 整体极暗，光源面积 < 30%
- 拒绝标准：偏暖偏亮、硬边墙壁、retro-cute 风格
- 建议追加后缀已写入文档

## 门禁条件

**全部 7 张通过后**：
1. 提取统一色板 → 锁定 `docs/art-direction.md` 调色板章节
2. 确认像素分辨率/细节级别 → 锁定 tile 规格
3. art-direction.md 状态从 DRAFT → APPROVED
4. Foundation Step 3 正式完成

## 恢复指引（新会话用）

如果在新会话中继续本流程：
1. 读取本文件了解进度
2. 读取 `docs/art/prompts/concept-prompts.md` 获取 prompt + 全局经验
3. 读取各 `demos/*/VERDICT.md` 了解已通过概念的结论
4. 从"待生成"的第一项继续引导用户
