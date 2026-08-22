# 开始使用

本仓库同时包含两层内容：用于开发独立游戏的 AI agent 框架，以及一个用该框架持续验证和打磨流程的进行中游戏项目。框架规则与参考资料主要位于 `CLAUDE.md`、`guides/` 和 agent 定义中；游戏的活文档位于 `docs/`，运行时代码位于 `src/`。开始工作前先确认你要推进的是框架层还是游戏层。

## 判断你现在在哪

以下路由用于开始一个新的游戏项目，或判断本仓库中进行中游戏项目所处的阶段：

| 你有什么 | 你在哪个阶段 | 下一步 |
| -------- | ------------ | ------ |
| 什么都没有（空项目/只有框架文档） | → **Ideation** | 用 `ideation` agent 开始对话 |
| 有 `docs/vision.md` 但缺架构/美术 | → **Foundation** | 见下方 Foundation 路由 |
| 有 vision + architecture + CLAUDE.md | → **Iterative Development** | 用 `director` agent 看进度。**本仓库层 B** 自 DEC-072 起按需游戏迭代（不规划 Slice 11）；通用框架仍可用 Slice 生命周期 |
| CLAUDE.md 标记 "Polish" | → **Polish** | 用 `qa` agent 做全面验收 |
| 准备发布 | → **Launch** | 用 `code` agent 配置部署 |

**本仓库层 B（进行中的游戏）**：Slice 1–9 已完，Slice 10 不做。自 DEC-072 起按需「游戏迭代」，不规划 Slice 11，不标 Polish / Launch。活状态见 `docs/progress/current-iteration.md`（当前：迭代 4 污染句法陈列馆，DEC-085；迭代 3 方案 D 接入出击三层已落地、等人试玩裂隙，DEC-084；迭代 2 练习场探索 COMPLETE；迭代 1 敌人系统句法逻辑仍为**实现完成，体验未验证**，DEC-073 / DEC-076 / DEC-077；遭遇识别旁白并入同一套体系，DEC-075）。体系入口：`docs/design-notes/contamination-lexicon.md`。

开发练习场（看敌人怎么走、比玩家外形、看生成地图、测基本功能、浏览污染句法外形馆藏，不进主菜单）：`docs/dev/gym.md`。`npm run gym` 或 `npm run dev` 后，用 Cursor Simple Browser 打开 `http://localhost:3000/gym.html`（敌人）、`http://localhost:3000/gym.html?lesson=player`（玩家外形）、`http://localhost:3000/gym.html?lesson=map`（地图生成）、`http://localhost:3000/gym.html?lesson=lexicon`（污染句法）或 `http://localhost:3000/gym.html?lesson=lexicon-gallery`（污染句法陈列馆）。角色外形对照：`docs/art/actor-pixels.md`。玩家加厚像素已接出击。

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

> **Bootstrap 协议**：vision.md 允许最小形态（elevator pitch + 核心循环 + MVP 范围）就进入 Foundation。文档完整度是渐进目标，不是前置条件。

### Iterative Development（基础打好，一层层构建游戏）

这是最长的阶段。游戏一个 Slice 一个 Slice 地生长：

```
每个 Slice：
  1. Director 做一致性检查 + 规划任务
  2. Design agent 为新系统写 spec（如需要）
  3. Code/Art agent 实现
  4. QA agent 验收（含构建验证）
  5. 你试玩验证
  6. Director 整合更新文档
  7. Director 收集框架反馈（"流程有摩擦吗？"）
  → 游戏多了一层 + 框架持续进化
```

> 每 3 个 Slice，Director 触发框架 Retrospective（分析积累的摩擦 → 提出修改建议）。

**日常操作（本仓库层 B）**：
- 开 `director` agent → 它先看 `docs/progress/current-iteration.md`：有没有进行中的游戏迭代；无则等人点名模块
- 点名模块后 Director 开迭代（`迭代 1` 起算），再开对应 agent 窗口执行
- 做完登记已交

通用 Slice 生命周期仍写在上方，给新项目或本游戏若再开 Slice 时用；**当前本游戏不用它开新 Slice**。

### Polish / Launch

按 `guides/06-polish-workflow.md`、`guides/07-launch-workflow.md` 的指引走。

---

## 任何时候不确定该做什么

开一个 `director` agent 会话，问："看一下项目当前状态，告诉我下一步该做什么。"

---

## 快速参考：所有 Agent

| Agent | 一句话用途 | 何时用 |
| ----- | ---------- | ------ |
| `ideation` | 从想法到愿景文档 | 最开始 |
| `director` | 规划/协调/整合/路由 | 任何时候不确定下一步；本仓库层 B 看游戏迭代；通用框架仍含每个 Slice 首尾 |
| `design` | 为当前 Slice 设计系统 | 新系统需要 spec 时 |
| `code` | 架构设计 + 写代码 | Foundation + 每个 Slice 的实现 |
| `art` | 美术方向 + 资产生成 | Foundation + Slice 中需要资产时 |
| `qa` | 验收 + 回归检查 | 每个 Slice 实现完成后 |

---

## 日常工作流

### "今天有 2 小时，怎么推进？"

**本仓库层 B（DEC-072）**：先看 `docs/progress/current-iteration.md`。当前为迭代 4（污染句法陈列馆，DEC-085；合同 `docs/tasks/iteration-4.md`）。迭代 3（方案 D 接入出击，DEC-084）三层已落地，等人试玩裂隙，不要标 COMPLETE。迭代 2 练习场探索已结。迭代 1（敌人系统）句法已接到出击，状态为实现完成、体验未验证。不要自己开 Slice。

通用 Slice 日常（给仍走 Slice 的项目）：

```
1. 开 director agent，问"当前状态和待做任务"
2. 它告诉你当前 Slice 有哪些任务未完成
3. 挑一个开对应 agent 窗口做
4. 做完 → 标记 Done → 还有时间就做下一个
5. 如果本 Slice 任务全部完成 → director 触发 QA 验收 → 你试玩验证
```

**不要每次开工都重新规划。** 本游戏按需点名一次登记一次迭代。仍走 Slice 的项目：Slice 规划是每周一次的事。日常就是：看任务清单 → 做 → 标完成。

---

## 框架迭代

框架在使用中持续进化。规则很简单：

- **能 5 分钟修的** → 当场改，一行记录到 `guides/98-field-notes.md`
- **需要深入思考的** → 记一句话到 `98-field-notes.md`，立刻回到游戏工作
- **每 3 个 Slice** → Director 触发框架 Retro（读积累 → 归纳 → 批量修改）
- **禁止**：做游戏做到一半花超过 5 分钟重构框架

详见 `CLAUDE.md` 的"框架迭代协议"。

---

## 项目中两类文档的分工

```
guides/              ← 给你（人）看的参考手册（方法论、Prompt策略、陷阱警告）
.claude/agents/      ← 给 AI 看的执行指令
docs/                ← 用于验证框架的游戏项目活文档（AI读写 + 你审核）
```

| | guides/ | .claude/agents/ | docs/ |
|-| ------- | --------------- | ----- |
| 读者 | 你（人） | AI | AI + 你 |
| 用途 | 理解 WHY、学方法 | 知道 WHAT：该做什么 | 项目真相：设计/状态/内容 |
| 权威性 | 参考 | **执行标准** | 工作产物 |
| AI 会读吗 | 不主动读（Director 在情境提醒时引用路径） | 启动时自动加载 | 按需读取 |

冲突时：Agent 定义 > docs/ 中的内容 > guides/ 中的描述。
