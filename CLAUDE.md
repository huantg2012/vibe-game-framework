# 项目规则

## 本项目是什么

本仓库是**双层结构**：

1. **AI agent 框架**（层 A）：用于 vibe coding 独立游戏的工作框架，由 agents（ideation/director/design/code/art/qa）+ 约束文档（`guides/**`、agent 定义、本文件的框架规则）组成。Agent 定义同时存在于 `.claude/agents/*` 与 `.cursor/agents/*`，两份**正文**必须逐字一致，frontmatter 的 `model` 按运行时取值。
2. **dogfood 游戏项目**（层 B）：一个进行中的真实独立游戏，用来验证并打磨框架层 A。游戏活文档住在 `docs/**`，代码住在 `src/**`。

两层同处一仓库但边界清晰：改框架（层 A）与做游戏（层 B）是两块独立工作，互不混入。

**当前阶段：**
- 层 A（框架）：随 dogfooding 持续迭代（见"框架迭代协议"）。
- 层 B（游戏）：**Foundation 已完成**（vision / world / architecture / art-direction[APPROVED] / audio-direction[APPROVED] 均就位，美术视觉方向已通过验证循环锁定）。**Iterative Development 进行中：Slice 1「裂隙潜行核心手感」COMPLETE（2026-08-07）。Slice 2「净化点闭环」COMPLETE（2026-08-08）。Slice 3「角色成长+潮汐经济」COMPLETE（2026-08-10）。Slice 3.5「UX 打磨」COMPLETE（2026-08-11）。Slice 4「Data Pipeline + Defense Engine + Common Tier」COMPLETE（2026-08-11，CSV管线+防御引擎+被动工具+净化点UX重构）。Slice 4.5「视觉与界面翻修 + 动态力场边界」COMPLETE（2026-08-12，UI Kit+右侧抽屉面板+4向角色贴图+程序化地表+潮汐驱动力场边界+BARRIER→CORE重命名）。Slice 5「工具库深度」COMPLETE（2026-08-12，Fine/Rare 11 种全量补完 + 工具 VFX + 改造深度 + 模块三态视觉 + 失效的工具 debuff 管线修复；**实现完成但体验未验证**——人未回签试玩清单与 U1-U12，直接决定收尾转入 5.5，装配决策纠结感留到 5.5 观察）。Slice 5.5「UX 重构」PLANNING（2026-08-12 立项，打磨 Slice / 轻量路径；范围待人锁定，触碰 in-game UI 必经 art 路径 + U1-U12）**（见 `docs/progress/roadmap.md`）。

**Slice 编号顺移（2026-08-12 人拍板）**：第二敌人独立为 Slice 6，原 Slice 6「净化点扩张」→ 7，原 Slice 7「程序化地图」→ 8。同日另拍板：撤离点多样性并入 Slice 8；音乐/音效建立 Slice 9；NPC 建立 Slice 10（该 Slice 启动时再具体设计）；Slice 5 收尾后插入打磨 Slice 5.5「UX 重构」，**Slice 6-10 编号不变**。

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
.claude/agents/*.md 与 .cursor/agents/*.md = AI 的执行标准（最高权威；两份正文逐字一致，
                                            frontmatter 仅 model 允许按运行时差异）
START-HERE.md                            = 人的操作入口
guides/*.md                              = 人的参考资料（设计原理记录）
```

当 Agent 定义与框架文档冲突时，以 Agent 定义为准，并修改框架文档以对齐。

---

## 当前框架结构

```
.claude/agents/ 与 .cursor/agents/ → ideation, director, design, code, art, qa（两份正文一致）
guides/                → 人的参考手册（00-overview ~ 14-docs-structure, 99-review）
docs/                  → 游戏项目活文档（AI读写、人审核）
tools/art-pipeline/    → 构建期美术资源后处理与机器验收工具（自包含）
tools/agent-parity/    → 两份 agent 定义的一致性校验（无依赖，node 直接跑）
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
- **打磨/表现类 Slice 走轻量路径**：免完整 Task Brief，但收尾必须登记四项（架构登记 / spec 判断 / 交付范围记录 / UI 清单），四项未完成不得标 COMPLETE。详见 director agent 定义 Step 3。

## 游戏内 UI 的硬约束（所有 Agent 遵守）

**in-game UI ≠ admin panel。** 本项目实测中这是最容易翻车的地方（一次表现层翻修花了七轮人工返工才收敛，根因是框架用 web 应用词汇描述游戏界面，见 `guides/99-review.md` FV-01）。

- 任何 UI 工作开工前先做**载体决策**：世界内装置（Phaser 层）/ 世界内终端（DOM，但视觉上是那台设备的屏幕）/ 元界面（主菜单等）。**只有元界面允许有"软件界面感"。**
- 必须锚定 **2-3 个具名游戏参考**并写进 spec。实测中这是唯一能稳定拉住风格的输入。
- 验收走 `docs/specs/_template-ui.md` 末尾的「游戏内 UI 验收清单」U1-U12——那是全项目唯一权威清单（design 自查结构层、art 自查视觉层、qa 逐条验收）。
- 视觉真相的优先级：ui spec > `docs/design-notes/ui-art-overhaul.md`（人已逐轮确认的基线）> `docs/art-direction.md` §6 > `docs/world.md` 术语表。
- 不写响应式断点：固定逻辑分辨率，手机端 out-of-scope。

## 策划数据源规则（强制）

**所有策划取向的数据（物品定义、敌人属性、技能参数、进度曲线等）的初始来源必须是 CSV 表格。**

- Source of truth = `data/*.csv`（策划拥有、人可编辑）
- 代码中的 registry/constant 对象通过构建期脚本或运行时 loader 从 CSV 生成
- 方向固定为 **CSV → code**，不允许在代码中手写数据再反向导出
- 不适用于系统常量（TILE_SIZE、物理参数等程序员拥有的值）——这些留在 `constants.ts`

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

## 模型路由与 token 经济性（强制）

### 核心原则：按"错误能否被机器抓住"分配模型，而不是按"任务重不重要"

强模型的代价**每次调用都要付**；弱模型犯错的代价**只在错误逃逸时才付**。所以真正的决策变量是逃逸概率——下游有没有自动闸门。

- **有机器闸门**（`tsc` / lint / 测试 / `art:verify` / 运行时冒烟）：错误会被抓回来重试，而"便宜模型跑两次"仍远比"强模型跑一次"便宜 → **放心降档**
- **无机器闸门，且产出会被其他 agent 当作事实来源**（spec / 决策 / 范围）：错误不会报错，只会静默传播——先烙进代码，再烙进更多代码，拆的时候成本远超省下的 token → **保持强模型**

### 档位与角色映射

| 档位 | Cursor ID | Claude Code | 角色 | 依据 |
| ---- | --------- | ----------- | ---- | ---- |
| T1 顶配 | `claude-opus-5-thinking-high` | `opus` | ideation / director / design | 产出不可机器验证，且是下游一切的事实来源 |
| T2 中档 | `claude-sonnet-5-thinking-high` | `sonnet` | code / art | code 有四道机器闸门兜底（token 消耗最大的角色）；art 有 `art:verify` 部分兜底 |
| T3 廉价 | `composer-2.5` | `sonnet` | qa | 本质是 spec↔实现的机械比对，有 spec 作基准 |

**运行时差异**：两个运行时的模型 ID 词汇表不重叠（Cursor 认全名如 `claude-opus-5`，Claude Code 认别名如 `opus`），且 Claude Code 侧没有对应 T3 的廉价编码档，故 T2/T3 在该运行时合并到 `sonnet`。这就是 agent 定义 frontmatter 允许 per-runtime 差异的原因。写错 ID 的后果是**静默回退**——配置看起来生效，实际没有。

### 逃逸兜底（强制）

降档的前提是失败有上界。**同一任务连续 2 次过不了机器闸门 → 停止重试，升档到 T1 重做**，并在报告中标注。这把"便宜模型失败"变成有界成本，而不是无限重试的坑。

### 探索循环的成本闸门（强制）

多轮探索（调参数 → 跑脚本 → 看结果 → 再调）里，绝大多数轮次是机械劳动，只有最后"这个方向对不对"是判断。

- **循环体跑 T2/T3**，只有**收敛判断**那一次上 T1
- 循环次数必须有硬上限；到顶未收敛 → 升级给人，不许无声续跑

### 不用 Cursor Auto 做框架内路由

Auto（Cursor Router）用分类器**猜**任务复杂度。而本框架的每份工作到达时都已被结构化分类（具名 agent + Task Brief + 已知闸门），信息量严格多于分类器，没有理由把决定权交出去。更要紧的是 Auto 不可观测、不可复现，会污染 dogfooding 的框架验证信号——**验证框架时，模型必须是被固定住的变量**。

Auto 适用的位置是框架外的自由对话窗口（任务类型确实不可预测时）。

### 一致性校验

`node tools/agent-parity/check.mjs` — 校验两份 agent 定义正文逐字一致，且 frontmatter 只在 `model` 上有差异。改动任何 agent 定义后必须跑，退出码非 0 即为不合格。

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
