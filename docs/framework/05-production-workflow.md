---
title: "阶段4: Production（生产）— Human+AI 工作流"
version: 0.1
date: 2026-07-17
status: PARTIALLY OUTDATED
note: 本文档写于线性阶段模型时期。现已采用 Slice 模型，"Production"被"Iterative Development"取代，"Sprint"被"Slice"取代。权威参考见 agent 定义和 10-slice-model.md。
---

# 阶段4: Production（生产）

## 目标

将验证通过的原型扩展为完整游戏。这是工作量最大、时间跨度最长、最需要多 Agent 协同的阶段。

**输入**：已验证的原型 + 更新后的 GDD
**输出**：功能完整的游戏（Feature Complete，但未打磨）

---

## 本阶段的核心挑战

| 挑战 | 为什么难 | 应对策略 |
| ---- | -------- | -------- |
| 范围大 | 多个系统要做 | Sprint 拆解，一次只做一个系统 |
| 时间长 | 跨数周甚至数月 | 进度文档 + 定期 Review |
| 上下文丢失 | 新会话不知道之前做了什么 | Knowledge Backbone 持续更新 |
| 一致性 | 不同会话做的代码风格/设计不统一 | CLAUDE.md 规范 + QA 检查 |
| 动力衰减 | 中期容易失去方向感 | 每周可见进度 + 里程碑庆祝 |

---

## 工作节奏：Sprint 制

```
一个 Sprint = 3-7 天（取决于你的投入时间）

Sprint 结构：
  Day 0: Planning（Director会话 — 定本轮任务）
  Day 1-N: Execution（Code/Art/Design 会话 — 逐个任务执行）
  Day N+1: Review（QA会话 — 验收 + 你试玩）
```

---

## Sprint Planning（由 Director Agent 执行）

### 你做什么

- 确定本 Sprint 的优先级（做什么系统/功能）
- 审核 Director 的任务拆解是否合理
- 做最终排期决策

### Director Agent 做什么

- 读取 roadmap + 上一 Sprint 的完成情况
- 将当前里程碑目标拆解为具体 Task Briefs
- 评估任务间依赖关系和顺序
- 输出本 Sprint 的任务清单

### Prompt 策略（Director 会话开头）

```
你是这个游戏项目的 Director/PM。

项目状态：[粘贴 CLAUDE.md 的"当前状态"段落]
本里程碑目标：[从 roadmap.md 粘贴]
上个 Sprint 完成情况：[从 current-sprint.md 粘贴]

请规划下一个 Sprint（3天为期）：
1. 从里程碑目标中选出本轮应完成的功能
2. 拆解为独立的 Task Brief（每个任务 1-3 小时工作量）
3. 标注依赖顺序
4. 用 Task Brief 模板输出每个任务
```

### 产出

更新 `docs/progress/current-sprint.md`：

```markdown
# Sprint N: [主题]
日期：[起止]
目标：[本轮核心目标，一句话]

## 任务清单

| ID | 任务 | 负责Agent | 状态 | 依赖 |
| -- | ---- | --------- | ---- | ---- |
| T1 | [任务描述] | Code | Todo | - |
| T2 | [任务描述] | Code | Todo | T1 |
| T3 | [任务描述] | Art | Todo | - |
| T4 | [任务描述] | Design | Todo | - |

## Task Briefs
[各任务的详细 Brief，或链接到单独文件]
```

---

## Task Execution（各专职 Agent 执行）

### 单个任务的执行流程

```
1. 开新 Claude Code 会话
2. AI 读取：CLAUDE.md → Task Brief → 相关源文件
3. AI 确认理解："我的任务是X，约束是Y，开始？"
4. 你确认
5. AI 实现
6. 你验证（跑起来看效果）
7. 满意 → commit + 标记任务完成
8. 不满意 → 反馈 → AI修改 → 再验证
```

### Code Agent 的会话模板

```
你是这个 Web 游戏项目的 Code Agent。

[粘贴 CLAUDE.md]

本次任务：
[粘贴 Task Brief]

需要阅读的文件：
[列出 Task Brief 中指定的相关文件]

开始前请确认：
1. 你理解任务目标
2. 你了解技术约束
3. 你知道这个任务在整体中的位置
```

### 多任务并行

当任务没有依赖关系时，可以**开多个 Claude Code 窗口并行**：

```
窗口1: Task T1 — 实现战斗伤害计算
窗口2: Task T3 — 生成UI资产
窗口3: Task T4 — 设计关卡数据结构

（T2 依赖 T1，所以 T1 完成后再做 T2）
```

### 并行时的冲突管理

| 风险 | 预防 |
| ---- | ---- |
| 两个会话改同一文件 | Task Brief 明确标注"涉及文件"，不分配重叠文件 |
| 接口不一致 | 先做接口定义（types/interfaces），再并行实现 |
| Git 冲突 | 每个任务在自己的 branch 上做，完成后 merge |

---

## 内容生产流水线

Production 阶段需要大量内容（关卡、敌人、物品、对话等），适合流水线化：

### 模式：模板 + 批量生成

```
Step A: 手工打磨一个"标杆样本"（如：一个完美的关卡）
Step B: 从标杆提取规则/模板
Step C: AI 根据模板批量生成变体
Step D: 你审核筛选（保留好的，标注需修改的）
Step E: AI 修改标注项
```

### 内容类型与生产方式

| 内容类型 | 生成方式 | 审核重点 |
| -------- | -------- | -------- |
| 关卡/地图 | AI按规则生成 + 人审核可玩性 | 难度曲线、趣味性 |
| 敌人/NPC数据 | AI按模板批量生成 | 数值平衡 |
| 对话/文本 | AI生成 + 人审核tone | 角色一致性、语言质量 |
| 美术资产 | AI绘图(SD/MJ) + 后处理 | 风格一致性 |
| 音效 | AI生成/素材库 | 是否匹配氛围 |
| UI界面 | AI生成代码 + 人验收交互 | 可用性 |

---

## 进度追踪与知识维护

### 每日（每个工作 session 结束时）

- [ ] 更新 current-sprint.md 中对应任务状态
- [ ] 如果有设计决策变更，记录到 decisions-log.md
- [ ] Commit 代码 + 有意义的 commit message

### 每个 Sprint 结束时

- [ ] Director 会话：Review 完成情况，更新 roadmap
- [ ] 你试玩当前版本，记录感受
- [ ] 更新 CLAUDE.md 的"当前状态"段落
- [ ] 如有必要，更新 GDD（设计变更）

### 知识文档更新规则

```
代码变了 → 如果影响架构 → 更新 architecture.md
设计变了 → 如果影响核心规则 → 更新 gdd-core.md 或 spec
进度变了 → 更新 current-sprint.md + CLAUDE.md
做了重要决策 → 追加 decisions-log.md
```

---

## 本阶段的 Agent 使用频率

| Agent | 使用频率 | 典型时长 |
| ----- | -------- | -------- |
| Director | 每 Sprint 开始/结束 | 20-30分钟 |
| Code Agent | 每天（主力） | 1-3小时/session |
| Design Agent | 需要新系统设计时 | 30-60分钟 |
| Art Agent | 需要新资产时 | 30-60分钟 |
| QA Agent | 每 Sprint 结束 | 30-60分钟 |

---

## 里程碑检查点

每个里程碑完成时进行一次全面 Review：

```markdown
## 里程碑 Review: [名称]

### 完成情况
- 计划功能：[N] 个
- 实际完成：[M] 个
- 推迟到下阶段：[K] 个（列出原因）

### 当前版本状态
- 可玩吗？ [是/否]
- 核心体验是否保持？ [是/偏移了，怎么偏的]
- 技术债务水平？ [低/中/高]

### 下一里程碑调整
[基于当前情况调整下一阶段计划]
```

---

## 常见陷阱

| 陷阱 | 症状 | 解药 |
| ---- | ---- | ---- |
| 忘记更新文档 | 新会话的AI做出矛盾行为 | 每次 commit 时检查：有没有文档需要同步 |
| Sprint 太大 | 一周过去了完成不到一半 | 砍半，做不完的推到下一轮 |
| 只做新功能不修旧bug | bug 累积到影响开发 | 每 Sprint 预留 20% 时间修 bug |
| 完美主义 | 一个功能打磨到完美才做下一个 | "能工作"就 move on，打磨是下一阶段的事 |
| 孤立开发 | 两个月没让人试过 | 每里程碑发一次链接给人看 |

---

## 质量门禁：Production → Polish

- [ ] 所有 MVP 计划的功能已实现且可用
- [ ] 无阻断性 Bug（能从头玩到尾）
- [ ] 核心体验仍然存在且有趣
- [ ] 代码库在可维护范围内（不是一团浆糊）
- [ ] 所有内容已填充（即使粗糙）
