---
title: "项目状态感知 — 人和AI如何始终了解游戏的全貌"
version: 0.1
date: 2026-07-17
---

# 项目状态感知

## 设计原则

传统游戏开发中，项目状态散布在人脑、文档、代码、PM工具中，靠人的整合能力弥合缺口。AI 没有这种能力，需要**显式、结构化、始终更新**的状态表达。

核心设计：

> CLAUDE.md = 项目状态的**索引层**，回答"是什么+在哪看细节"。
> 它不试图包含所有信息，而是**指向**所有信息。
> 它的更新不依赖人记得去维护，而是被框架流程强制触发。

---

## 分层状态模型

```
┌─ CLAUDE.md ─────────────────────────────────────────────┐
│  Level 0: 一句话描述 + 当前阶段                          │
│  Level 1: 系统清单（状态标注）+ 内容汇总                 │
│  Level 2: 各文档指针（"详情见 xxx"）                     │
└─────────────────────────────────────────────────────────┘
         │ 指向 ↓
┌────────┼────────────────────────────────────────────────┐
│  docs/specs/system-*.md     → 每个系统的完整规则         │
│  docs/content/*.md          → 每种内容的所有条目         │
│  docs/world.md              → 世界观全貌                 │
│  docs/progress/roadmap.md   → 路线图                    │
│  docs/progress/current-slice.md → 当前工作              │
│  src/                       → 实际代码                   │
└─────────────────────────────────────────────────────────┘
```

任何 Agent 或人想了解项目，第一步永远是读 CLAUDE.md。它用一页纸的篇幅提供全景，并告诉你去哪里找细节。

---

## CLAUDE.md 的完整格式（增强版）

```markdown
# [游戏名]

## 一句话描述
[这是一个什么游戏]

## 当前状态
- 阶段：[Ideation / Foundation / Iterative Development / Polish / Launch]
- 当前 Slice：[Slice N - 名称]
- Slice 状态：[Design / Implementation / QA / Validation]

---

## 系统全景

| 系统 | 状态 | Spec | 说明 |
| ---- | ---- | ---- | ---- |
| [系统A] | ✅ 已实现 | docs/specs/system-a.md | [一句话] |
| [系统B] | ✅ 已实现 | docs/specs/system-b.md | [一句话] |
| [系统C] | 📐 已设计未实现 | docs/specs/system-c.md | 计划在 Slice N |
| [系统D] | 💭 计划中 | — | 在 backlog |

## 内容汇总

| 内容类型 | 已设计数 | 已实现数 | 详情 |
| -------- | -------- | -------- | ---- |
| 敌人 | 12 | 8 | docs/content/enemies.md |
| 物品 | 25 | 20 | docs/content/items.md |
| 技能 | 8 | 8 | docs/content/skills.md |
| 关卡 | 5 | 3 | docs/content/levels.md |

## 世界观
[2-3句话概括] → 详见 docs/world.md

## 技术栈
[框架/语言/关键依赖]

## 关键约束
[不可违反的规则]

## 已完成的 Slices
- Slice 1: [名称] ✓ (日期)
- Slice 2: [名称] ✓ (日期)
- ...

## 工作规范
[代码规范/命名规则/提交要求]

---

## 文档导航

| 想知道什么 | 去看 |
| ---------- | ---- |
| 游戏整体设计 | docs/gdd-core.md |
| 某个系统的规则 | docs/specs/system-[name].md |
| 某类内容的所有条目 | docs/content/[type].md |
| 世界观设定 | docs/world.md |
| 美术风格 | docs/art-direction.md |
| 技术架构 | docs/architecture.md |
| 项目路线图 | docs/progress/roadmap.md |
| 当前在做什么 | docs/progress/current-slice.md |
| 历史决策 | docs/progress/decisions-log.md |
```

---

## 更新机制：如何确保不过时

### 核心原则：CLAUDE.md 的更新是框架流程的强制产出，不是可选的额外工作。

### 何时更新

| 触发事件 | 更新什么 | 由谁 |
| -------- | -------- | ---- |
| Slice 结束 | 系统全景表 + 内容汇总 + 已完成 Slices | Director |
| 新系统设计完成 | 系统全景表加一行（📐 已设计未实现） | Director |
| 新系统实现完成 | 对应行状态改为 ✅ | Director |
| 内容批量新增 | 内容汇总的数字更新 | Director |
| 阶段推进 | 当前状态段落 | Director |

### 防过时的额外机制：重建式更新

Director 在每个 Slice 开始的一致性检查中，不是"增量更新"CLAUDE.md，而是**重建验证**：

```
1. 扫描 docs/specs/ 目录 → 得到实际的系统 spec 列表
2. 扫描 docs/content/ 目录 → 得到实际的内容文件
3. 扫描 src/ 结构 → 得到实际实现的模块
4. 将扫描结果与 CLAUDE.md 中的表格对比
5. 如果不一致 → 以实际文件为准更新 CLAUDE.md
```

这确保即使有人忘记更新，下一个 Slice 开始时也会被自动修正。

---

## 不同角色的查询路径

### AI Agent 想知道"游戏现在是什么"

```
读 CLAUDE.md
  → 了解全景（系统清单 + 内容汇总 + 阶段）
  → 根据当前任务，follow 指针去读详细文件
```

### 人想快速了解进度

```
看 CLAUDE.md 的"系统全景"表格和"内容汇总"
  → 一目了然：什么做了、什么没做、什么在进行中
```

### 人想深入某个系统

```
CLAUDE.md → 找到对应系统行 → 点 Spec 链接 → 完整规则
                                           → 对应 content 文件 → 所有条目
```

### 新会话的 Agent 想快速上手

```
CLAUDE.md（30秒了解全貌）
  + 当前 Slice 的 Task Brief（了解具体任务）
  + 相关的 Spec（了解约束）
  = 足够开始工作
```

---

## 这和传统游戏开发的对比

| 方面 | 传统做法 | 本框架做法 |
| ---- | -------- | ---------- |
| "游戏现在什么样" | 问主策/跑游戏看 | 读 CLAUDE.md |
| 文档更新 | 靠人自觉（常常失败） | 框架流程强制（Slice 结束必更新） |
| 发现文档过时 | 撞上问题才发现 | Director 每 Slice 做重建验证 |
| 进度追踪 | Jira看任务状态 | roadmap + 系统全景表（任务和产物两层） |
| 跨领域一致性 | 靠 standup 和 review 会议 | Director 一致性检查 + QA 验收 |

关键区别：传统团队的"状态同步"依赖人的主动行为（开会、更新wiki）。本框架的状态同步是**流程的副产物**——你按流程做事，状态就自动更新了。
