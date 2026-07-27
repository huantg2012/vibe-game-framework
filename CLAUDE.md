# 项目规则

## 本项目是什么

本仓库的 `master` 分支是一套**用于 vibe coding 独立游戏的 AI agent 框架**，由以下部分组成：

- **Agent 定义**：`.claude/agents/*` 与 `.cursor/agents/*`（ideation / director / design / code / art / qa；两份内容必须一致）
- **约束与参考文档**：`guides/**`、本文件（`CLAUDE.md`）中的框架规则
- **文档模板**：`docs/**/_template-*.md`（agent 据此生成具体游戏的活文档）
- **可复用工具**：`tools/art-pipeline/`（构建期美术资源后处理与机器验收，自包含、可独立运行）
- **用户入口**：`START-HERE.md`

它定义了整个 vibe coding game 的流程与开发者交互方式。

> **分支约定（重要）**：`master` 只维护框架本身，**不含任何具体游戏的活文档或代码**。用本框架开发的具体游戏（含 dogfood 验证项目）活在独立分支（如 `coh`）上——`docs/` 活文档实例、`src/` 游戏代码、游戏构建配置（`package.json`/`vite.config.ts`/`index.html` 等）都只存在于游戏分支，不回流 `master`。

## 变更传播规则（强制）

对本项目进行任何结构性变更时，必须执行以下步骤：

### 什么是"结构性变更"

- 新增、删除或重命名 Agent 定义文件
- 修改开发模型/流程（如阶段划分、工作单元定义）
- 重命名核心概念或术语
- 改变文档目录结构或文件命名约定
- 修改 Agent 之间的协作协议

### 必须执行的步骤

1. **识别**：列出本次变更涉及的关键词/旧概念名
2. **搜索**：Grep 以下范围查找所有引用：
   - `.claude/agents/*.md`
   - `.cursor/agents/*.md`
   - `docs/**/*.md`
   - `guides/**`
   - `START-HERE.md`
   - `CLAUDE.md`
3. **处理**：逐个更新受影响的文件，或明确标记为待更新
4. **报告**：向用户列出所有已更新/待更新的文件

### 为什么

多文档系统中，局部变更的影响范围总是超出即时注意力。未被传播的变更会让其他文件变成"过时的谎言"，导致后续工作基于错误前提。

---

## 文档层级与权威性

```
.claude/agents/*.md 与 .cursor/agents/*.md = AI 的执行标准（最高权威；两份定义必须内容一致）
START-HERE.md                            = 人的操作入口
guides/*.md                              = 人的参考资料（设计原理记录）
```

当 Agent 定义与框架文档冲突时，以 Agent 定义为准，并修改框架文档以对齐。

---

## 当前框架结构

```
.claude/agents/ 与 .cursor/agents/ → ideation, director, design, code, art, qa（两份一致）
guides/                → 人的参考手册（00-overview ~ 14-docs-structure, 99-review）
docs/**/_template-*.md → 游戏活文档的模板（实例在游戏分支开发时生成）
tools/art-pipeline/    → 构建期美术资源后处理与机器验收工具（自包含）
START-HERE.md          → 用户入口
```

## 游戏项目的文档体系（开发时产生）

```
docs/
├── vision.md              ← 核心体验（Ideation 产出）
├── world.md               ← 世界观设定（Foundation 产出）
├── gdd-core.md            ← 综合设计文档（随 Slice 增长）
├── architecture.md        ← 技术架构
├── art-direction.md       ← 美术方向
├── audio-direction.md     ← 音频方向
├── specs/system-*.md      ← 系统规则 + schema
├── content/*.md           ← 内容条目（物品/敌人/技能/关卡/进度曲线）
├── progress/              ← 进度管理（roadmap/current-slice/decisions-log）
├── tasks/                 ← Task Briefs（per-Slice 文件：slice-01.md, slice-02.md...）
├── qa/                    ← 验收报告
└── art/                   ← 资产规格 + 生成 prompt 记录
```

## 开发模型

Slice-based iterative development：
- Ideation → Foundation → Slice 1 → Slice 2 → ... → Polish → Launch
- 每个 Slice = Design → Implement → Verify → Validate 完整循环
- Slice 分类：系统 Slice / 内容 Slice / 功能 Slice / 集成 Slice / 打磨 Slice
- 无 "prototype" 阶段，第一行代码即生产质量

## Spec 维护协议（所有 Agent 遵守）

### 核心原则
- **一个逻辑系统 = 一个 spec 文件，原地更新**
- Spec 定义的是"这个系统现在怎么工作"，不是"这个系统的设计历史"
- Git 负责历史追溯，spec 只反映当前真相
- 不允许同一系统存在多个"版本"spec 同时有效

### 划分粒度
- 一个 spec 对应一个能独立设计、独立验证、独立被引用的系统边界
- 判断标准：两块功能能否被不同 agent 在不同 Slice 独立修改？能 → 拆开；否 → 合一

### 变更类型与操作

| 场景 | 操作 |
| ---- | ---- |
| 系统演进（加规则/调数值/扩状态） | 原地更新 spec + 更新 frontmatter `last-modified-date` |
| 对外接口变更（新增/修改 event/data） | 同上 + 设 `interface-changed: true` + 更新 `exposes` |
| 系统拆分（一个变两个） | 创建新 spec + 更新原 spec（移除拆出部分）+ 双方 `interfaces-with` 互引 |
| 系统废弃重做 | 旧 spec 标 `status: SUPERSEDED by [新文件]` + 创建新 spec + 更新所有引用方 |

### 分级加载协议（L0/L1/L2）
- 每个 spec 的 frontmatter 必含 `interfaces-with`（声明依赖）和 `exposes`（声明对外输出）
- 正文首行必须是 TL;DR（1-2 句系统摘要）
- Agent 加载顺序：L0 读 CLAUDE.md → L1 Grep frontmatter 判断相关性 → L2 读完整 spec

---

## 框架迭代协议（开发过程中如何完善框架）

本项目的框架本身是待验证的产物，通过 dogfooding（用框架做真实游戏）来持续完善。

### 两种模式，严格区分

**模式 1: Hot Fix（当场改，≤5 分钟）**

触发条件：框架规则正在阻塞当前工作，且修复显而易见。
- Agent 指令引用不存在的文件路径 → 改路径
- 模板缺必要字段 → 加字段
- 规则禁止的操作是当前任务唯一合理方案 → 改规则

操作：直接改 → 一行记录到 `guides/98-field-notes.md` → 继续工作。

**模式 2: Record & Continue（记下来，不停）**

触发条件：感到摩擦但能绕过继续工作。
- 流程步骤感觉多余但还是走了
- Agent 输出格式不太好用但手动调整了
- 职责划分觉得可以更好

操作：一句话写入 `guides/98-field-notes.md`（`- Slice N: [摩擦描述]`）→ 立刻回到游戏工作。

**禁止**：做游戏做到一半停下来花超过 5 分钟重构框架。需要深入思考的问题 = retro 议题，不是当前任务。

### Retro 节奏（Director Step 8，每 3 Slice）

这是唯一合法的集中框架开发时间：
1. 读 `guides/98-field-notes.md` 最近 3 Slice 的积累
2. 分类：重复出现 → 优先修；偶发 → 再观察一轮
3. 修改框架（agent 定义/模板/CLAUDE.md）+ 执行变更传播
4. 追加 `guides/99-review.md`
5. 时间预算：不超过最近 3 Slice 总工时的 10%

### 判断"框架问题"vs"正常困难"

| 信号 | 框架问题 | 不是框架问题 |
| ---- | -------- | ------------ |
| 重复出现同一摩擦 | ✅ | |
| 两个 Agent 规则互相矛盾 | ✅ | |
| 某个步骤产出无人消费 | ✅ | |
| 框架未覆盖当前情况 | ✅ | |
| 设计/实现本身有难度 | | ✅ |
| 不确定该用哪个 agent | | ✅（问 Director） |
| 任务比预期耗时 | | ✅ |
