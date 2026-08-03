---
title: "Agent 使用指南 — 如何在开发中调用各 Agent"
version: 0.2
date: 2026-07-17
note: 已更新为 Slice 模型
---

# Agent 使用指南

## Agent 定义在哪

```
.claude/agents/
├── ideation.md   ← 创意搭档：从想法到愿景文档
├── director.md   ← 项目总监：全流程编排+Slice管理
├── design.md     ← 游戏设计师：增量系统设计
├── code.md       ← 程序员+架构师：架构设计+功能实现
├── art.md        ← 美术指导：视觉风格+资产+UI
└── qa.md         ← 质量保障：验收+回归检查
```

每个文件包含：
- Frontmatter：名称、模型、可用工具（Claude Code 与 Cursor 均原生识别）
  - `model` 的取值按运行时不同：Cursor 用全名（`claude-opus-5-thinking-high`），Claude Code 用别名（`opus`）。档位与角色的对应关系见 `CLAUDE.md`「模型路由与 token 经济性」，这也是两份定义唯一允许不一致的字段
- 正文：角色指令、工作规范、文档职责、触发规则

---

## 两种使用方式

### 方式 A：在主会话中派遣子 Agent

在一个 Claude Code 会话中，用 Agent 工具委派任务给特定角色：

```
"请用 qa agent 对照 spec 检查战斗系统的实现"
"请用 director agent 看看项目当前状态和下一步"
```

适合：单轮明确任务（QA 验收报告、状态查询、文档更新）

### 方式 B：开独立窗口以某 Agent 身份运行

开新 Claude Code 窗口，整个会话以特定角色工作。

适合：需要多轮交互的复杂任务（写代码、设计系统、Sprint 规划）

---

## 各阶段用什么 Agent

### Ideation

| 操作 | Agent | 方式 |
| ---- | ----- | ---- |
| 整个构思过程 | `ideation` | B（独立窗口，多轮对话） |

### Foundation

| 操作 | Agent | 方式 |
| ---- | ----- | ---- |
| 问"下一步做什么" | `director` | A 或 B |
| 设计第一个系统 | `design` | B |
| 设计技术架构+搭脚手架 | `code` | B |
| 确定美术方向 | `art` | B |
| 整合 GDD + CLAUDE.md | `director` | B |

### Iterative Development（每个 Slice）

| 操作 | Agent | 方式 |
| ---- | ----- | ---- |
| 规划 Slice / 看进度 / 问下一步 | `director` | B |
| 为新系统写 Spec | `design` | B |
| 实现功能 | `code` | B（🔴手动） |
| 生成美术 prompt | `art` | A（🟢自动由 Director 派发）或 B |
| Slice 验收 | `qa` | A（🟢自动由 Director 派发） |
| 更新文档/进度 | `director` | A 或 B |

### Polish

| 操作 | Agent | 方式 |
| ---- | ----- | ---- |
| 全面 Issue 收集 | `qa` | B |
| 修复问题 | `code` | B |
| 体验打磨（juice/动画） | `code` | B |

---

## 实际工作场景

### 场景 1：开始新 Slice

```
你：开 director 窗口
Director：
  - 检查三个真相源一致性
  - 确定下一个 Slice 的范围和验证问题
  - 输出任务清单 + Task Briefs
  - 标注 🟢/🔴

你：看任务清单，开始执行 🔴 任务
```

### 场景 2：日常编码 session

```
你：看 current-slice.md，挑一个 Todo 任务
你：开 code agent 窗口
你：告诉它 "执行 TASK-XXX" 或粘贴 Brief
Code Agent：实现功能
你：验证可运行 → 标记 Done
```

### 场景 3：Slice 完成，准备验收

```
你：开 director 窗口
你："本 Slice 任务都完成了，触发验收"
Director：派遣 QA agent 做验收
QA：输出报告
你：看报告，如有问题 → 开 code agent 修
你：试玩，回答验证问题
Director：整合更新文档，Slice 完成
```

### 场景 4：需要新系统设计

```
你：开 design agent 窗口
你："我要为 Slice 5 设计一个经济系统"
Design Agent：
  - 读取已有系统 specs
  - 设计新系统，标注接口
  - 输出 docs/specs/system-economy.md
你：审核确认
```

---

## Agent 之间如何"沟通"

Agent 之间不直接通信。通过文件系统：

```
Director → Task Brief 文件 → Code Agent 读取执行
Design  → Spec 文件       → Code Agent 按 Spec 实现
Code    → 源代码文件      → QA Agent 读取验收
QA      → Report 文件     → Code Agent 修复问题
Director→ 更新 CLAUDE.md  → 下一个会话的任何 Agent 读取
```

---

## 什么时候不需要正式用 Agent

不是所有事都要正式"派遣 Agent"：

- 改一行代码修个小 bug → 直接改
- 快速问个技术问题 → 当前会话直接问
- 改个配置文件 → 直接改

判断标准：
- 任务需要 >30 分钟 → 正式指派（开窗口 + 指向 Brief）
- 任务影响多个文件/系统 → 正式指派
- 5 分钟搞定的事 → 直接做
