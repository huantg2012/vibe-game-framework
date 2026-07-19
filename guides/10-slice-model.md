---
title: "Slice 模型 — 取代线性阶段的渐进式开发框架"
version: 0.1
date: 2026-07-17
---

# Slice 模型

## 为什么需要重新设计

原框架的线性模型：

```
Ideation → Design(全部) → Prototype(法外) → Production(全部) → Polish → Launch
```

问题：
1. 你无法提前设计好所有系统——很多设计决策依赖于"先做出来看看"
2. Prototype 阶段为了"快速验证"放弃了框架纪律，导致产出物（脏代码）要么重写、要么带着技术债继续
3. 从"自由原型"到"严格生产"的跳跃很不自然
4. 真实的游戏是渐进生长的——先有核心循环，再加系统A，再加系统B，再加内容……

## 新模型：Slice-Based Iterative Development

### 核心思想

> 游戏不是一次设计好再建造的建筑，而是一层一层生长的有机体。
> 每一层（Slice）都经过 设计→实现→验证 的完整纪律，且每一层结束后游戏都是可运行的。

```
Ideation → Foundation → Slice 1 → Slice 2 → Slice 3 → ... → Polish → Launch
                         ↑                                      ↑
                     (最小核心循环)                         (Feature Complete)
```

### 什么是一个 Slice

一个 Slice 是**一次垂直切片**——从设计到实现到验证的完整循环，添加一个有意义的增量到游戏中。

| 属性 | 说明 |
| ---- | ---- |
| 范围 | 一个系统、一组功能、一段内容（够小到一个 Sprint 能完成） |
| 纪律 | 完整遵守框架：有 Spec → 有 Brief → Code Agent 实现 → QA 验证 |
| 产出 | 一个比上一个版本多了一层的**可运行游戏** |
| 验证 | 每个 Slice 结束时回答一个问题（"这个系统有趣吗" / "这组内容够吗"） |

### Slice 1 = 原来的"原型"，但遵守框架

以前叫 Prototype 的东西，现在是 Slice 1：

| | 旧 Prototype | 新 Slice 1 |
|-| ------------ | ---------- |
| 范围 | 核心循环最小验证 | 核心循环最小验证（相同） |
| 代码质量 | 允许脏代码 | 遵守 architecture.md（代码留下来） |
| 文档维护 | 不做 | 做（和其他 Slice 一样） |
| 用什么 Agent | prototype agent（法外） | code agent + 正常框架 |
| 验证问题 | "好不好玩" | "好不好玩"（相同） |
| 如果失败 | 回退或重写 | 回退或调整 Spec（代码不需要重写，因为本身就是生产质量） |

关键变化：**第一行代码就是生产代码。** 没有"先乱写再重构"的阶段。这稍微慢一点，但消除了"重写还是保留"的痛苦决策。

---

## 阶段重新定义

### Phase 1: Ideation（不变）
产出：`docs/vision.md`

### Phase 2: Foundation（替代原 Design 阶段的"一次性全做完"）

Foundation 只做三件事：
1. 定义第一个 Slice 需要的系统设计（不是所有系统）
2. 确定技术架构（这个确实要尽早定）
3. 确定美术方向（这个也要尽早定）

**不做的事**：不设计 Slice 2、Slice 3 的系统。那些在需要的时候再设计。

产出：
- `docs/architecture.md` — 技术骨架（但只包含已确定的部分，允许留 TBD）
- `docs/art-direction.md` — 视觉风格
- `docs/specs/system-[first].md` — 仅第一个 Slice 涉及的系统
- `CLAUDE.md` — 项目入口
- `docs/progress/roadmap.md` — 粗略路线（只有 Slice 1-2 是明确的，后面是粗略的 backlog）

### Phase 3: Iterative Development（替代 Prototype + Production）

一个 Slice 接一个 Slice 地推进。每个 Slice 是一个完整的 Sprint：

```
┌─────────────────────────────────────────────────────────┐
│ Slice N                                                  │
│                                                          │
│  1. Design   → 设计本 Slice 新增/修改的系统 (design agent) │
│  2. Plan     → Director 拆解为 Tasks                     │
│  3. Implement→ Code/Art agent 执行                       │
│  4. Verify   → QA 对照 spec 验收                         │
│  5. Validate → 人试玩，回答本 Slice 的验证问题            │
│  6. Integrate→ 更新 gdd-core / architecture / CLAUDE.md  │
│                                                          │
│  → 游戏现在多了一层，所有文档与代码同步                    │
└─────────────────────────────────────────────────────────┘
```

### Phase 4: Polish（不变）
### Phase 5: Launch（不变）

---

## 渐进式设计：如何确保设计不偏离

### 问题：设计是分散在各 Slice 中逐步完成的，怎么保证一致性？

### 答案：三层保障机制

**第一层：Vision 锚定**

`docs/vision.md` 是不可漂移的北极星：
- 核心体验陈述
- 体验支柱
- 核心循环

每个 Slice 的设计必须回答："这如何服务于核心体验？"
如果回答不了 → 这个 Slice 不应该做（或者核心体验需要修改——重大决策，需人批准）。

**第二层：GDD 作为累积设计记录**

`docs/gdd-core.md` 不是一开始写好的蓝图，而是**随项目生长的活文档**：

```
Foundation 结束后：
  gdd-core.md 包含 = 核心循环 + Slice 1 的系统概要

Slice 1 结束后：
  gdd-core.md 包含 = 上述 + Slice 1 验证结论 + Slice 2 的系统概要

Slice 5 结束后：
  gdd-core.md 包含 = 完整的游戏设计（逐步积累而成）
```

每个 Slice 的 Integrate 步骤中，Director 将本轮新增的设计同步回 gdd-core.md。

**第三层：Slice 间的一致性检查**

每个 Slice 开始前，Director 执行：
1. 读取当前的 gdd-core.md + 所有 specs
2. 检查新 Slice 的设计是否与已有系统矛盾
3. 如果有矛盾 → 在规划中标注，让人决定如何解决

---

## 渐进式开发：如何确保实现不偏离设计

### 问题：代码在 Slice 间不断累积，怎么保证实现始终匹配设计？

### 答案：每 Slice 强制验证闭环

```
Spec (设计) ──定义→ 应该怎样
     │
     ▼
Code (实现) ──实际→ 现在怎样
     │
     ▼
QA   (验证) ──对比→ 一样吗？ ──→ 不一样 → 修复
     │
     ▼
Human(体验) ──判断→ 有趣吗？ ──→ 没趣 → 改设计或实现
```

这个循环在每个 Slice 都执行一次。不存在"累积了 5 个 Slice 的代码才第一次检查"的情况。

### 额外机制：Architecture Guard

当 Slice 增加新系统时，可能需要扩展架构。规则：
- 新模块必须在 `architecture.md` 中注册
- 模块间通信方式必须与已定义的一致
- 如果需要改变通信方式 → 这是架构变更 → 需要评估对已有 Slice 的影响

---

## Roadmap 在 Slice 模型中的含义

不再是"所有功能的排期表"，而是：

```markdown
# Roadmap

## 已完成的 Slices
- [x] Slice 1: 核心循环 (日期)
- [x] Slice 2: 系统A (日期)

## 当前 Slice
- [ ] Slice 3: 系统B

## 计划中的 Slices（粗略，可能调整）
- Slice 4: 内容扩充第一批
- Slice 5: 系统C
- Slice 6: 内容扩充第二批

## Backlog（未排序，随时增减）
- 成就系统
- 排行榜
- 多人模式
- ...
```

关键：**只有当前 Slice 和下一个 Slice 需要详细设计。** 其余的是粗略方向，随时可调。

每个 Slice 完成后的 Review 时刻：
- 回看：我们学到了什么？
- 重排：下一个 Slice 还是之前计划的那个吗？还是有更重要的？
- 更新：roadmap 相应调整

---

## Slice 规划的判断标准

### "下一个 Slice 应该做什么？"

优先级判断维度：

| 维度 | 问题 | 优先级影响 |
| ---- | ---- | ---------- |
| 依赖 | 其他未来 Slice 依赖它吗？ | 被依赖多的先做 |
| 风险 | 这个不确定性高吗？有可能做了发现不 work？ | 不确定的先做（早验证早调整） |
| 体验 | 它对核心体验的贡献大吗？ | 贡献大的先做 |
| 独立性 | 它能独立验证吗？还是必须和其他东西一起才有意义？ | 能独立验证的先做 |

### Slice 范围的判断标准

一个好的 Slice：
- ✅ 做完后游戏依然可运行
- ✅ 能在 3-7 天（一个 Sprint）内完成
- ✅ 完成后能回答一个验证问题
- ✅ 有明确的 Spec 可以写
- ❌ 太大（"做完战斗系统+经济系统+UI"）→ 拆开
- ❌ 太小（"改个按钮颜色"）→ 合并到其他 Slice
- ❌ 无法独立验证（"做一半的任务系统"）→ 缩小范围到可验证的子集

---

## 项目状态感知：如何确保人和 AI 始终对齐

### 问题：项目渐进生长，状态越来越复杂。人和 AI 怎么保持同步？

### 答案：三个真相源

| 真相源 | 回答什么问题 | 谁维护 |
| ------ | ------------ | ------ |
| `CLAUDE.md` | "项目现在是什么状态" | Director（每 Slice 结束时更新） |
| `docs/gdd-core.md` | "游戏被设计成什么样" | Director + Design Agent（每 Slice 增量更新） |
| 代码本身 | "实际上现在是什么" | Code Agent（持续维护） |

如果这三者不一致 → 有问题需要解决：
- CLAUDE.md 说"战斗系统已完成"但代码里没有 → CLAUDE.md 过时了
- gdd-core.md 的规则和代码实现不同 → 要么改代码、要么改设计
- Director 在每个 Slice 开始时做一致性检查，发现偏差就上报

### CLAUDE.md 的 Slice 模型格式

```markdown
# [游戏名]

## 一句话描述
[...]

## 当前状态
- 阶段：Iterative Development
- 当前 Slice：Slice 4 - 经济系统
- Slice 状态：Implementation（Design 已完成，正在编码）

## 已完成的 Slices
- Slice 1: 核心移动+攻击循环 ✓
- Slice 2: 敌人AI+战斗完整循环 ✓
- Slice 3: 关卡结构+进度保存 ✓

## 已实现的系统
- 移动系统 (spec: docs/specs/system-movement.md)
- 战斗系统 (spec: docs/specs/system-combat.md)
- 关卡系统 (spec: docs/specs/system-levels.md)
- 存档系统 (spec: docs/specs/system-save.md)

## 技术栈
[...]

## 关键约束
[...]

## 工作规范
[...]
```

每个新会话的 Agent 读到这个文件，就知道：
- 游戏现在有哪些系统在运行
- 当前在做什么
- 哪些 spec 是相关的

---

## 关于"起点"的问题

### "从一个合适的起点开始"意味着什么？

一个合适的起点（Slice 1）应该满足：
1. 是核心循环的最小可交互版本
2. 能验证"核心体验是否成立"
3. 足够小（一周以内能完成）
4. 不依赖其他未实现的系统

### Foundation 阶段怎么确定 Slice 1 的范围？

Director 在 Foundation 末尾：
1. 看 vision.md 的核心循环描述
2. 问："最少需要什么才能让一个人体验到这个循环一次？"
3. 把答案作为 Slice 1 的范围
4. 把所有其他东西放进 backlog

示例：

```
核心循环：探索地牢 → 遭遇怪物 → 战斗 → 获得战利品 → 变强 → 更深的地牢

Slice 1 的最小范围：
- 一个固定房间（不需要地牢生成）
- 一个敌人（不需要多种）
- 基础攻击（不需要技能系统）
- 杀死敌人后显示"你赢了"（不需要战利品系统）

验证问题："战斗的基本手感对吗？继续打下去有吸引力吗？"
```

---

## 变更传播原则

### 为什么需要这个

在多文档、多 Agent 系统中，任何结构性变更（新增/删除系统、修改接口、重命名概念）的影响范围，往往超出变更者的即时注意力。被遗漏的文件会成为"过时的谎言"——下次某个 Agent 读到过时内容，就会产出与实际不一致的工作。

**这和代码重构后要搜索所有调用方是同一个道理：改了接口，就要更新所有调用者。**

### 适用范围

这个原则同时适用于：
- **游戏项目内部**：一个系统的 spec 变了 → 调用该系统的其他 spec 可能需要更新
- **框架自身**：开发模型/Agent 定义变了 → 引用旧模型的文档需要更新

### 执行方式

由 Director agent 在以下时机执行变更传播检查：
1. 系统 spec 的接口字段被修改后
2. Agent 定义发生结构性变化后
3. 核心概念（阶段名、文件名、术语）被重命名后

具体步骤：识别变更关键词 → Grep 全项目 → 列出受影响文件 → 逐一处理或标记。

---

## 本文档的定位

本文档（`10-slice-model.md`）是 Slice 开发模型的**设计原理文档**（给人看的参考）。

实际的执行标准在：
- `.claude/agents/director.md` — Slice 管理流程、一致性检查、变更传播协议
- `.claude/agents/code.md` — 始终生产质量、模式切换
- `.claude/agents/design.md` — 增量设计、接口定义
- `.claude/agents/qa.md` — Slice 验收 + 回归

冲突时以 Agent 定义为准。
