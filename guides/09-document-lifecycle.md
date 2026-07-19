---
title: "进度文档生命周期 — 谁创建、何时创建、存在哪里"
version: 0.1
date: 2026-07-17
status: PARTIALLY OUTDATED
note: 本文档写于 Sprint 模型时期。现已采用 Slice 模型。核心概念仍有效，但"Sprint"应理解为"Slice"，"Prototype/Production 阶段"应理解为"Foundation/Iterative Development"。权威参考见 agent 定义和 10-slice-model.md。
---

# 进度文档生命周期

## 全部文档一览

```
docs/
├── vision.md               ← 游戏愿景（极少变）
├── gdd-core.md             ← 核心设计文档
├── architecture.md         ← 技术架构
├── art-direction.md        ← 美术方向
├── progress/
│   ├── roadmap.md          ← 里程碑路线图
│   ├── current-sprint.md   ← 当前Sprint任务
│   └── decisions-log.md    ← 决策记录
├── specs/
│   └── system-*.md         ← 各系统详细设计
└── tasks/
    └── TASK-*.md           ← 单个任务的Brief
```

---

## 每份文档的完整生命周期

### roadmap.md

| 项 | 说明 |
| -- | ---- |
| **是什么** | 里程碑级别的项目路线图，定义"先做什么后做什么" |
| **何时首次创建** | Design 阶段末尾（Step 4 范围界定完成后） |
| **由谁创建** | Director Agent 草拟初版 → 你审核确认 |
| **创建触发** | MVP 范围 + 系统列表 + 时间估算 都确定后 |
| **存放位置** | `docs/progress/roadmap.md` |
| **更新频率** | 每个里程碑完成时 Review 一次 |
| **由谁更新** | Director Agent 提议调整 → 你批准 |

**内容结构**：

```markdown
# Roadmap

## Milestone 1: [名称]（目标日期：YYYY-MM-DD）
目标：[一句话]
包含系统：[列表]
状态：[未开始 / 进行中 / 完成]

### 子目标
- [x] 已完成项
- [ ] 未完成项

## Milestone 2: [名称]（目标日期：YYYY-MM-DD）
...
```

**首次创建的 Prompt**：

```
我的游戏 MVP 范围是：[从 Concept Doc 粘贴]
系统列表和依赖：[从 Design 阶段 Step 1 粘贴]
每周可投入：[X 小时]

请帮我制定里程碑路线图：
1. 将 MVP 范围拆分为 2-4 个里程碑
2. 每个里程碑有明确的交付物
3. 里程碑之间有清晰的依赖逻辑（先做什么才能做什么）
4. 给出粗略的时间估算

原则：第一个里程碑尽量小（1-2周能完成），让我尽快有可玩的东西。
```

---

### current-sprint.md

| 项 | 说明 |
| -- | ---- |
| **是什么** | 当前工作周期内的具体任务列表 |
| **何时首次创建** | 进入 Production 阶段的第一天 |
| **由谁创建** | Director Agent 生成 → 你确认 |
| **创建触发** | 每个 Sprint 开始时（上一个结束或项目刚进入 Production） |
| **存放位置** | `docs/progress/current-sprint.md` |
| **更新频率** | 每天（每完成一个任务就更新状态） |
| **由谁更新** | 完成任务的 Agent 标记状态 / Director 在 Sprint 结束时总结 |

**内容结构**：

```markdown
# Sprint N: [主题]
日期：[起止]
里程碑：[属于哪个 Milestone]
目标：[本轮要达成什么]

## 任务

| ID | 任务 | Agent | 状态 | 备注 |
| -- | ---- | ----- | ---- | ---- |
| T1 | xxx | Code | Done | - |
| T2 | xxx | Code | In Progress | 遇到阻塞，见TASK-002 |
| T3 | xxx | Art | Todo | - |

## Sprint 回顾（Sprint结束时填写）
- 完成：[N/M]
- 推迟原因：[如有]
- 下轮调整：[如有]
```

**首次创建的 Prompt（对 Director）**：

```
项目已进入 Production 阶段。

当前里程碑：[从 roadmap.md 粘贴当前 Milestone]
已有代码状态：[简述原型阶段完成的内容]

请规划第一个 Sprint（3-5天）：
1. 从里程碑目标中挑选本轮要完成的功能
2. 拆解为具体任务（每个任务 1-3 小时）
3. 标注哪个 Agent 负责
4. 标注任务间依赖
```

---

### decisions-log.md

| 项 | 说明 |
| -- | ---- |
| **是什么** | 重要决策的历史记录（为什么这么做，不那么做） |
| **何时首次创建** | Design 阶段做第一个技术/设计决策时 |
| **由谁创建** | 做出决策的那个会话（任何 Agent 都可以追加） |
| **创建触发** | 做了影响全局的决策 |
| **存放位置** | `docs/progress/decisions-log.md` |
| **更新频率** | 有决策就追加（append-only，不删改历史条目） |
| **由谁更新** | 任何 Agent 在做了关键决策后 |

**内容结构**：

```markdown
# Decisions Log

## DEC-001: [决策标题]
日期：2026-XX-XX
阶段：[Design/Prototype/Production]
决策：[选了什么]
备选：[还考虑了什么]
原因：[为什么选这个]
影响：[这个决策影响哪些后续工作]

## DEC-002: [决策标题]
...
```

**何时该追加一条记录**：
- 选定技术方案（框架、库、架构模式）
- 改变设计方向（核心机制调整）
- 砍功能或加功能（Scope 变更）
- 解决方案二选一（且以后可能会问"当初为什么这么做"）

---

### TASK-*.md（Task Briefs）

| 项 | 说明 |
| -- | ---- |
| **是什么** | 给执行 Agent 的单个任务指令 |
| **何时创建** | Sprint Planning 时，由 Director 生成 |
| **由谁创建** | Director Agent |
| **存放位置** | `docs/tasks/TASK-XXX.md` |
| **更新频率** | 通常不更新（执行完就归档） |
| **生命周期** | 创建 → 执行 → 完成后可归档到 `docs/tasks/done/` |

---

## 时间线视角：文档何时出现

```
Ideation 阶段结束
  └── 产出：vision.md (概念文档作为vision初版)

Design 阶段
  ├── Step 1-2 → specs/system-*.md (核心系统设计)
  ├── Step 3   → architecture.md
  ├── Step 4   → art-direction.md
  ├── Step 5   → gdd-core.md + CLAUDE.md (初版)
  └── 同时     → roadmap.md (Director 基于范围和系统生成)
  └── 同时     → decisions-log.md (首条：技术选型决策)

Prototype 阶段
  └── 可能更新：gdd-core.md, decisions-log.md
  └── 原型验证后更新：roadmap.md (确认时间估算)

Production 阶段开始
  ├── Sprint 1 开始 → current-sprint.md (首版)
  ├── Sprint 1 开始 → docs/tasks/TASK-001.md, TASK-002.md, ...
  └── 持续更新：所有文档按需更新

每个 Sprint 循环
  ├── Sprint 开始 → 更新 current-sprint.md
  ├── Sprint 中   → 更新任务状态 + 追加 decisions-log
  └── Sprint 结束 → 更新 roadmap 状态 + CLAUDE.md
```

---

## 谁有权更新什么（权限矩阵）

| 文档 | Human | Director | Code | Design | Art | QA |
| ---- | ----- | -------- | ---- | ------ | --- | -- |
| vision.md | 写 | 读 | 读 | 读 | 读 | 读 |
| gdd-core.md | 批准 | 草拟更新 | 读 | 草拟更新 | 读 | 读 |
| architecture.md | 批准 | 读 | 提议更新 | 读 | 读 | 读 |
| art-direction.md | 批准 | 读 | 读 | 读 | 提议更新 | 读 |
| roadmap.md | 批准 | 读写 | 读 | 读 | 读 | 读 |
| current-sprint.md | 批准 | 读写 | 更新状态 | 更新状态 | 更新状态 | 读 |
| decisions-log.md | 追加 | 追加 | 追加 | 追加 | 追加 | 追加 |
| TASK-*.md | 审核 | 创建 | 读 | 读 | 读 | 读 |
| CLAUDE.md | 写 | 更新状态段 | 读 | 读 | 读 | 读 |

关键区分：
- **读** = 只能参考
- **写** = 可以直接修改
- **批准** = Agent 草拟，你确认后才生效
- **追加** = 只能加新条目，不能改历史
- **更新状态** = 只能改任务状态字段（Todo→Done），不能改内容

---

## 总结：你的"启动清单"

当你真正开始做游戏时，不需要一开始就创建所有文档。它们按阶段自然出现：

1. **Ideation 结束后你手上有**：一份 Concept Doc（即 vision.md 初版）
2. **Design 阶段你会得到**：gdd-core.md + architecture.md + art-direction.md + roadmap.md + CLAUDE.md
3. **Production 开始时会出现**：current-sprint.md + TASK-*.md

每份文档都是前一步工作的自然产出，不是你需要预先规划创建的。
