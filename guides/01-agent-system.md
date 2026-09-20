---
title: AI Agent 协作系统架构
version: 0.2
date: 2026-07-17
note: 已更新为 Slice 模型（取代原线性阶段模型）
---

# AI Agent 协作系统架构

## 核心问题

一个跨数月、跨领域的游戏项目，单个 AI 会话面临三个根本性限制：

1. **上下文遗忘** — 会话结束后 AI 失去所有工作记忆
2. **上下文溢出** — 项目膨胀后，单次会话装不下全貌
3. **角色模糊** — 同一个会话既做设计又写代码又做 QA，容易顾此失彼

## 设计哲学

```
不是造一个"超级AI"来理解一切，
而是造一个"知识系统"让每个AI会话都能快速获得正确上下文。
```

核心思路：**持久化的知识层 + 专职的 Agent 角色 + 明确的协作协议**

---

## 系统分层架构

```
┌─────────────────────────────────────────────────┐
│                   HUMAN (你)                     │
│       创意方向 / 最终决策 / 体验验证             │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│              DIRECTOR AGENT                      │
│  全流程编排 / Slice规划 / 一致性检查 / 文档整合  │
└──┬──────────┬──────────┬────────────────────┬───┘
   │          │          │                    │
┌──▼───┐ ┌───▼───┐ ┌───▼───┐          ┌─────▼───┐
│Design│ │ Code  │ │  Art  │          │   QA    │
│Agent │ │ Agent │ │ Agent │          │  Agent  │
└──────┘ └───────┘ └───────┘          └─────────┘
                         │
┌────────────────────────▼────────────────────────┐
│           KNOWLEDGE BACKBONE (知识骨架)           │
│  全貌索引 + 规则/实现/证据 = Agent 的共享记忆     │
└─────────────────────────────────────────────────┘
```

---

## Layer 1: Knowledge Backbone（知识骨架）

解决的问题：**任何新开的 AI 会话，都能在 30 秒内理解"我该做什么"和"什么是对的"。**

### 规则、实现与验证的共享索引

`CLAUDE.md` 是约束和路由入口；`docs/game-state/INDEX.md` 展示游戏能力全貌，feature 文本引用规则、实现入口与有范围的验证证据。设计规则仍在 spec/CSV，当前工作仍在 progress，完整方法见 [游戏现状索引](12-project-state.md)。

Director 在每个 Slice 首尾检查相关能力及依赖。文件存在只说明有产物；实际接入、工作安排和验证结果分别记录，不能用一个“完成”代替。

### 文档结构

```
project-root/
├── CLAUDE.md                    ← AI 会话入口点（自动加载）
├── START-HERE.md                ← 人的入口（判断阶段+操作指引）
├── .claude/agents/              ← Agent 定义（AI 的执行标准）
├── docs/
│   ├── game-state/             ← 当前能力索引、证据及按需浏览图
│   ├── vision.md                ← 愿景文档（极少更新）
│   ├── gdd-core.md              ← 核心设计（随 Slice 增量生长）
│   ├── architecture.md          ← 技术架构（新模块时更新）
│   ├── art-direction.md         ← 美术风格指南
│   ├── progress/
│   │   ├── roadmap.md           ← Slice 路线图
│   │   ├── current-slice.md     ← 当前 Slice 任务清单
│   │   └── decisions-log.md     ← 决策记录
│   ├── specs/
│   │   └── system-*.md          ← 各系统设计 Spec
│   ├── tasks/
│   │   └── TASK-*.md            ← Task Briefs
│   └── qa/
│       └── report-*.md          ← QA 验收报告
└── src/                         ← 游戏代码
```

### 会话入口保持简短

`CLAUDE.md` 只包含执行约束、技术/文档路由和游戏全貌入口，不重复系统清单或累计 Slice 状态。全貌文本源及两种生成视图的唯一协议在 `.agents/skills/game-state/references/protocol.md`，不在本指南复制另一份模板。

---

## Layer 2: Agent 角色

| Agent | 职责 | 工作时机 |
| ----- | ---- | -------- |
| `ideation` | 从想法到愿景文档 | Ideation 阶段 |
| `director` | 全流程编排、Slice 规划、一致性检查、文档整合 | 任何时候 |
| `design` | 为当前 Slice 增量设计系统 Spec | Foundation + 每个 Slice 开头 |
| `code` | 架构设计 + 功能实现（始终生产质量） | Foundation + 每个 Slice |
| `art` | 美术方向 + 资产 prompt + UI 样式 | Foundation + Slice 中需要资产时 |
| `qa` | 对照 Spec 验收 + 回归检查 | 每个 Slice 实现完成后 |

详细定义见 `.claude/agents/` 目录。

---

## Layer 3: 协作协议

### Agent 间不直接通信，通过文件系统

```
Director 写 Task Brief → 文件 → Code Agent 读取并执行
Design Agent 写 Spec  → 文件 → Code Agent 按 Spec 实现
Code Agent 写代码     → 文件 → QA Agent 对照 Spec 验收
QA Agent 写报告       → 文件 → Code Agent 修复问题
Director 整合更新     → 文件 → 下一个 Slice 的 Agent 读取最新状态
```

### 会话启动协议

每个 Agent 启动时：
1. 读取 `CLAUDE.md` 约束/路由 + game-state `INDEX.md` 全貌 + 当前工作指针
2. 读取本角色相关的文件（Spec / Brief / 代码）
3. 如果文件不存在 → 执行降级行为（已定义在各 agent 的启动协议中）
4. 确认任务后开始执行

### 任务派发

Director 判断每个任务的派发方式：
- 🟢 自动：QA 报告、美术 prompt、文档状态更新（Director 用 Agent 工具直接执行）
- 🔴 手动：所有代码变更、设计产出、创意性工作（人自己开窗口做）

---

## Layer 4: Slice 驱动的项目推进

### 开发模型

```
Foundation → Slice 1 → Slice 2 → Slice 3 → ... → Polish → Launch
```

每个 Slice 是一次完整的 Design→Implement→Verify→Validate 循环。

### 每个 Slice 的内部流程

```
1. Director: 全貌与增量一致性检查（规则、接入、证据是否对齐？）
2. Design:   为新系统写 Spec（增量设计）
3. Director: 拆解为 Task Briefs
4. Code/Art: 执行实现
5. QA:       对照 Spec 验收 + 回归检查
6. Human:    试玩，回答验证问题
7. Director: 汇总 game-state、刷新文本索引，更新 gdd-core / 活进度
```

### 渐进式保障

| 机制 | 解决什么问题 |
| ---- | ------------ |
| Vision 锚定 | 每个 Slice 设计都回答"这如何服务核心体验" |
| GDD 累积生长 | 设计不是一次写好的蓝图，而是随 Slice 增量追加 |
| Slice 间一致性检查 | Director 每 Slice 核查相关 feature 与依赖、证据适用范围 |
| 每 Slice 强制 QA | 不存在"积累5个功能才检查"的情况 |
| 人验证 | 每 Slice 结束人试玩，确认体验方向正确 |

---

## Layer 5: 权限矩阵

| 文档 | Human | Director | Code | Design | Art | QA |
| ---- | ----- | -------- | ---- | ------ | --- | -- |
| vision.md | 写 | 读 | 读 | 读 | 读 | 读 |
| gdd-core.md | 批准 | 整合更新 | 读 | 读 | 读 | 读 |
| architecture.md | 批准 | 读 | 创建+更新 | 读 | 读 | 读 |
| art-direction.md | 批准 | 读 | 读 | 读 | 创建+扩展 | 读 |
| specs/system-*.md | 批准 | 读 | 读 | 创建+更新 | 读 | 读 |
| roadmap.md | 批准 | 读写 | 读 | 读 | 读 | 读 |
| current-slice.md | 审核 | 创建+管理 | 更新状态 | 更新状态 | 更新状态 | 更新状态 |
| decisions-log.md | 追加 | 追加 | 追加 | 追加 | 追加 | - |
| CLAUDE.md | 写 | 维护约束/路由 | 读 | 读 | 读 | 读 |
| game-state 文本源 | 审核 | 汇总、校验、生成视图 | 更新所辖接入/证据 | 更新所辖规则指针/依赖 | 更新所辖视听指针/证据 | 登记所验证范围的证据 |
| TASK-*.md | 审核 | 创建 | 读 | 读 | 读 | 读 |
| qa/report-*.md | 读 | 读 | 读 | 读 | 读 | 创建 |
