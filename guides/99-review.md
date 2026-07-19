---
title: "框架自审 — 以实际用户视角 Review"
version: 0.1
date: 2026-07-17
---

# 框架自审

## 审查视角

模拟场景：我是一个程序员，有一个粗略的游戏 idea，想用 Claude Code vibe coding 把它做出来。我读了这套框架，准备开始。

---

## 🔴 严重问题（会导致用户卡住或放弃）

### 1. 没有入口文件 — 用户不知道第一步做什么

用户拿到 7 个 agent 定义 + 9 个 framework 文档。然后呢？

- 没有一个"从这里开始"的引导
- 没有一个"你现在应该做什么"的决策树
- 用户必须先读完所有文档才能开始工作

**缺少**：一个 `START-HERE.md` 或项目根目录的 `README.md`，告诉用户："你现在处于 [阶段]，下一步是 [动作]，使用 [agent]"

---

### 2. 早期阶段（Ideation → Design）没有编排者

Production 阶段有 Director 编排一切。但 Ideation → Design 这段路：

- 谁告诉用户"Ideation 结束了，该进 Design 了"？
- Design 内部 Step 1→2→3→4→5 的切换，谁提醒用户？
- 用户必须自己记住："现在该用 design agent 做 step 1-2，然后切 code agent 做 step 3..."

Director 的定义中没有覆盖早期阶段的编排职责。它只从 "Design Step 5" 才开始出现。

**结果**：Ideation 到 Prototype 这段最关键的探索期，用户反而没有 AI 帮忙协调，全靠自己翻文档记流程。

---

### 3. Agent 引用了尚不存在的文档

- `code` agent 开头就要读 `CLAUDE.md`、`architecture.md`、Task Brief
- 但在 Prototype 阶段刚启动时，这些文件可能都不存在
- agent 的"工作开始时"协议没有处理"文件不存在"的情况

**结果**：用户按流程开一个 code agent 会话，agent 尝试读文件 → 文件不存在 → 行为不可预测。

---

### 4. 框架文档和 Agent 定义之间是割裂的

- `02-ideation-workflow.md` 详细描述了 ideation 的 5 个 step 和 prompt 策略
- `.claude/agents/ideation.md` 也描述了 5 个 step 的行为
- 但 agent 定义**不引用**框架文档，框架文档也**不引用** agent 定义
- 用户不确定：执行时是看框架文档还是让 agent 自己按定义走？

**结果**：两套信息源可能不同步，用户困惑该以哪个为准。

---

## 🟡 中等问题（增加摩擦但不致命）

### 5. 没有日常工作流描述

框架描述了宏观阶段，但没有回答最实际的问题：

> "我今天有 2 小时空闲，想推进游戏。我打开电脑，第一步做什么？"

缺少一个"日常开发节奏"的描述：
- 怎么快速恢复上下文（上次做到哪了）
- 一个典型的 2-3 小时工作 session 长什么样
- 什么时候该做 Director 规划 vs 直接开干

---

### 6. 阶段回退路径未定义

框架假设线性推进：Ideation → Design → Prototype → Production → Polish → Launch

但现实中：
- Prototype 验证失败 → 要回到 Design 甚至 Ideation
- Production 中发现设计不 work → 要回到 Design 修改 spec
- 这些"回退"时，文档状态怎么处理？之前的 Sprint/roadmap 作废吗？

Agent 定义中完全没有回退相关的指令。

---

### 7. Director 自动派发的子 Agent 能力有限

Director 用 Agent 工具派遣子 Agent 时：
- 子 Agent 是单轮的，上下文非常有限
- 它只能读 Director 传给它的 prompt + 少量文件
- 对于"生成 10 个敌人数据"这种任务，子 Agent 可能需要读现有代码才知道数据格式

实际上，大部分标记为 🟢自动 的任务可能也需要比"单轮子 Agent"更多的上下文。

**需要明确**：子 Agent 能力的边界在哪、什么时候自动派发其实效果不好。

---

### 8. Prototype → Production 的代码衔接问题

- prototype agent 允许脏代码
- 进入 Production 后 code agent 要求"遵守 architecture.md"
- 但 prototype 阶段写的代码没有遵循任何架构

**缺少**：Prototype → Production 之间的"代码 review/重构"步骤。是保留还是重写？框架文档提到了（04-prototype-workflow.md Step 5），但 agent 定义中没有体现。谁来执行这个重构判断？

---

### 9. vision.md vs Concept Doc 命名不一致

- `02-ideation-workflow.md` 中叫"Concept Doc"
- `ideation.md` agent 把它输出为 `docs/vision.md`
- `00-overview.md` 中也叫"概念文档"

同一个东西三个名字，容易混淆。

---

### 10. Agent 的双模式设计需要额外的模式切换信号

- code agent 有模式 A（架构设计）和模式 B（实现）
- director 有模式 A（整合）和模式 B（Sprint管理）
- 谁告诉 agent "你现在是模式 A"？用户必须在启动时显式说明
- 如果用户忘了说，agent 默认进哪个模式？

---

## 🟢 可优化点（不影响使用但可以更好）

### 11. 缺少 prompt 模板的实际使用说明

框架文档中有大量 Prompt 策略示例，但：
- 这些 prompt 是给用户看的（告诉用户怎么跟 AI 说话）
- 还是给 agent 看的（agent 内部遵循的模式）？
- 既然有了 agent 定义，很多 prompt 策略已经被内化到 agent 的指令中了
- 框架文档中的 prompt 部分是否冗余？

---

### 12. Quality Gates 在 agent 中没有强制执行点

每阶段的质量门禁写在框架文档中（如"核心体验能用一句话说清楚"），但：
- 没有 agent 被定义为"检查门禁是否通过"
- 用户可能直接跳过门禁进入下一阶段
- 需要一个机制让某个 agent（Director？）在阶段转换时检查门禁

---

## 总结：优先修复建议

| 优先级 | 问题 | 建议修复 |
| ------ | ---- | -------- |
| P0 | 没有入口/启动引导 | 创建 START-HERE.md + 阶段路由逻辑 |
| P0 | 早期阶段无编排 | 扩展 Director 覆盖全流程，或创建一个轻量的"flow controller" |
| P0 | Agent 引用不存在的文档 | 每个 agent 的启动协议加入"文件不存在时的降级行为" |
| P1 | 框架文档与 agent 定义割裂 | 明确分工：agent 定义 = 执行标准，框架文档 = 人的参考手册 |
| P1 | 没有日常工作流 | 补充 "daily routine" 指南 |
| P1 | 回退路径未定义 | 在 Director 中加入阶段回退处理逻辑 |
| P1 | 子Agent能力边界模糊 | 重新定义 🟢自动 的范围，更保守 |
| P2 | 命名不一致 | 统一为一个名字 |
| P2 | 模式切换信号 | agent 加入默认模式 + 自动检测逻辑 |
| P2 | Quality Gates 无执行点 | Director 在阶段转换时自动检查 |
