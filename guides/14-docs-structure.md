---
title: "文档目录结构设计 — 给人看的 vs 给AI看的"
version: 0.1
date: 2026-07-17
---

# 文档目录结构设计

## 问题

`docs/` 目录下混合了两类性质不同的文档：
- 纯给人看的参考资料（framework/）
- AI Agent 的工作文件（specs/、content/、progress/ 等）

这导致语义不清：用户浏览 `docs/` 时，不确定哪些是"我应该读的指南"，哪些是"AI 的工作产物"。

## 分析

### 三类文档的本质区别

| 类别 | 性质 | 谁写 | 谁读 | 变化频率 |
| ---- | ---- | ---- | ---- | -------- |
| **人的指南** | 方法论、策略、参考 | 框架设计时写 | 人 | 极少变 |
| **项目真相** | 设计约束、规范、规则 | Agent 写、人批准 | AI + 人 | 按 Slice 变 |
| **流转文件** | 任务、报告、进度 | Agent 写 | AI + 人 | 高频变 |

### 方案评估

**方案 A：按读者分目录**
```
docs/
├── guide/           ← 人的指南（原 framework/）
├── design/          ← 项目设计真相（vision/world/gdd/architecture/art/audio/specs/content）
└── ops/             ← 流转文件（progress/tasks/qa）
```
优点：语义清晰
缺点：Agent 定义中大量路径要改、目录层级加深、过度细分

**方案 B：保持 docs/ 平铺，用 framework/ 隔离人的指南**
```
docs/
├── framework/       ← 人的指南（明确隔离）
└── [其他所有文件]   ← AI 的工作文件（默认就是给 AI 用的）
```
优点：最小改动、目前已经是这个结构、Agent 路径不用改
缺点：`docs/` 根下既有 vision.md 又有 specs/ 又有 progress/，层级不统一

**方案 C：把人的指南移出 docs/**
```
docs/               ← 全部是项目文件（AI + 人共用）
├── vision.md
├── world.md
├── specs/
├── content/
├── game-state/      ← 当前能力/证据文本源与派生全貌视图
├── progress/
├── tasks/
├── qa/
└── art/
guides/             ← 人的指南（原 framework/）
```
优点：docs/ 含义纯净（项目文档）、guides/ 含义纯净（人的参考）
缺点：需要改 CLAUDE.md 和相关引用

## 推荐：方案 C

理由：

1. **语义最清晰**：`docs/` = 项目的活文档（AI 读写、人审核），`guides/` = 人的参考手册（AI 不读、不写）
2. **消除歧义**：当人打开 `docs/` 时，看到的全是"游戏项目的当前状态和设计"；想看指南时去 `guides/`
3. **对 Agent 有利**：Agent 被告知"读 docs/ 下的文件"时，不会误读到 framework 参考文档（那些是旧模型时写的、有些标注了 OUTDATED）
4. **未来扩展性**：如果需要加教程、onboarding 内容，自然放 `guides/`

## 迁移状态：✅ 已完成

已执行：
- `docs/framework/*.md` → `guides/*.md`
- CLAUDE.md 目录结构已更新
- START-HERE.md 文档分工已更新（三列对比表）
- Director agent 情境提醒路径已更新

## 当前状态索引的补充约定

`docs/game-state/` 属于具体游戏的活文档，放能力/入口/依赖/证据，不替代 specs、content、progress；`INDEX.md` 和按需生成的 `atlas.html` 都由同一文本源生成。可移植工具与协议属于框架的 `.agents/skills/game-state/`，不随某款游戏内容回流 master。维护与独立使用见 [12-project-state.md](12-project-state.md)。
