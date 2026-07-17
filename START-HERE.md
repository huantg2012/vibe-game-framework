# 开始使用

## 判断你现在在哪

看一下项目中有什么文件，找到你当前的阶段：

| 你有什么 | 你在哪个阶段 | 下一步 |
| -------- | ------------ | ------ |
| 什么都没有（空项目/只有框架文档） | → **Ideation** | 用 `ideation` agent 开始对话 |
| 有 `docs/vision.md` 但缺架构/美术 | → **Foundation** | 见下方 Foundation 路由 |
| 有 vision + architecture + CLAUDE.md | → **Iterative Development** | 用 `director` agent 规划下一个 Slice |
| CLAUDE.md 标记 "Polish" | → **Polish** | 用 `qa` agent 做全面验收 |
| 准备发布 | → **Launch** | 用 `code` agent 配置部署 |

---

## 各阶段的具体操作

### Ideation（我有一个模糊的想法）

1. 用 `ideation` agent 开始对话
2. 说出你的想法，它会引导你走完 5 步
3. 结束时得到 `docs/vision.md`

### Foundation（我有 vision.md，要打基础）

依次完成以下工作，问 `director` agent "下一步做什么"即可：

| Step | 做什么 | 用哪个 Agent | 产出 |
| ---- | ------ | ------------ | ---- |
| 1 | 世界观设定 | `design` | `docs/world.md` |
| 2 | 第一个 Slice 的系统设计 | `design` | `docs/specs/system-*.md` |
| 3 | 技术架构选型 + 项目脚手架 | `code` | `docs/architecture.md` + 初始代码 |
| 4 | 美术方向 | `art` | `docs/art-direction.md` |
| 5 | 整合 + 创建 roadmap | `director` | `docs/gdd-core.md` + `CLAUDE.md` + `roadmap.md` |

### Iterative Development（基础打好，一层层构建游戏）

这是最长的阶段。游戏一个 Slice 一个 Slice 地生长：

```
每个 Slice：
  1. Director 做一致性检查 + 规划任务
  2. Design agent 为新系统写 spec（如需要）
  3. Code/Art agent 实现
  4. QA agent 验收
  5. 你试玩验证
  6. Director 更新文档
  → 游戏多了一层
```

**日常操作**：
- 开 `director` agent → 它告诉你当前 Slice 进度和待做任务
- 开对应 agent 窗口执行任务
- 做完标记 Done

### Polish / Launch

按 `docs/framework/06-*`、`07-*` 的指引走。

---

## 任何时候不确定该做什么

开一个 `director` agent 会话，问："看一下项目当前状态，告诉我下一步该做什么。"

---

## 快速参考：所有 Agent

| Agent | 一句话用途 | 何时用 |
| ----- | ---------- | ------ |
| `ideation` | 从想法到愿景文档 | 最开始 |
| `director` | 规划/协调/整合/路由 | 任何时候不确定下一步 + 每个 Slice 首尾 |
| `design` | 为当前 Slice 设计系统 | 新系统需要 spec 时 |
| `code` | 架构设计 + 写代码 | Foundation + 每个 Slice 的实现 |
| `art` | 美术方向 + 资产生成 | Foundation + Slice 中需要资产时 |
| `qa` | 验收 + 回归检查 | 每个 Slice 实现完成后 |

---

## 日常工作流

### "今天有 2 小时，怎么推进？"

```
1. 开 director agent，问"当前状态和待做任务"
2. 它告诉你当前 Slice 有哪些任务未完成
3. 挑一个开对应 agent 窗口做
4. 做完 → 标记 Done → 还有时间就做下一个
5. 如果本 Slice 任务全部完成 → director 触发 QA 验收 → 你试玩验证
```

**不要每次开工都重新规划。** Slice 规划是每周一次的事。日常就是：看任务清单 → 做 → 标完成。

---

## 项目中两类文档的分工

```
docs/framework/       ← 给你（人）看的参考手册
.claude/agents/       ← 给 AI 看的执行指令
```

| | 框架文档 | Agent 定义 |
|-| -------- | ---------- |
| 读者 | 你（人） | AI |
| 用途 | 理解 WHY、看全貌 | 知道 WHAT：该做什么、边界在哪 |
| 权威性 | 参考 | **执行标准** |

冲突时以 Agent 定义为准。
