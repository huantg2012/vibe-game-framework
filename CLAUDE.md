# 项目规则

## 本项目是什么

本仓库是**双层结构**：

1. **AI agent 框架**（层 A）：用于 vibe coding 独立游戏的工作框架，由 agents（ideation/director/design/code/art/qa）+ 约束文档（`guides/**`、agent 定义、本文件的框架规则）组成。Agent 定义同时存在于 `.claude/agents/*` 与 `.cursor/agents/*`，两份**正文**必须逐字一致，frontmatter 的 `model` 按运行时取值。
2. **dogfood 游戏项目**（层 B）：一个进行中的真实独立游戏，用来验证并打磨框架层 A。游戏活文档住在 `docs/**`，代码住在 `src/**`。

项目 skill 的可移植正文位于 `.agents/skills/`，`.codex/skills/`、`.cursor/skills/` 为同内容镜像；`game-state` 可独立复制使用。

两层同处一仓库但边界清晰：改框架（层 A）与做游戏（层 B）是两块独立工作，互不混入。**框架改动先上 `master`，再合并到本分支。**

## 游戏状态入口

- 全貌与证据：`docs/game-state/INDEX.md` → `atlas.json`、`features/*.json`、`evidence.json`；按需生成 `atlas.html` 给人浏览。
- 当前工作：`docs/progress/current-iteration.md`；路线与范围：`docs/progress/roadmap.md`。进度不再复制到框架入口。
- 本游戏自 DEC-072 起按需游戏迭代，不规划 Slice 11；通用框架继续支持 Slice 生命周期。
- 历史完成、人审、暂过、挂起状态继续由原任务和 QA 证据承载；本索引迁移不提升验收，不重新开启被暂停的工作。

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
   - `.agents/skills/**`、`.codex/skills/**`、`.cursor/skills/**`
   - `docs/**/*.md`
   - `guides/**`
   - `START-HERE.md`
   - `CLAUDE.md`
   - `AGENTS.md`
3. **处理**：逐个更新受影响的文件，或明确标记为待更新
4. **报告**：向用户列出所有已更新/待更新的文件

### 为什么

多文档系统中，局部变更的影响范围总是超出即时注意力。未被传播的变更会让其他文件变成"过时的谎言"，导致后续工作基于错误前提。

---

## 文档层级与权威性

```
.claude/agents/*.md 与 .cursor/agents/*.md = AI 的执行标准（最高权威；两份正文逐字一致，
                                            frontmatter 仅 model 允许按运行时差异）
.cursor/skills/in-game-ux/               = in-game UI 的 HOW（三问结果：审美 / 读作游戏 UI / 与已锁装置同一世界；自定义 agent 必须显式 Read）
.cursor/skills/pixel-models/             = 世界内像素模型的 HOW（自定义 agent 必须显式 Read）
.agents/skills/game-state/              = 游戏现状索引、证据与离线浏览器（可独立使用）
CLAUDE.md                                = 项目执行标准正文（阶段、硬约束、路由）
AGENTS.md                                = Cursor 侧钩子（指向 CLAUDE.md + 硬约束摘要，不复制全文）
START-HERE.md                            = 人的操作入口
guides/*.md                              = 人的参考资料（设计原理记录）
```

当 Agent 定义与框架文档冲突时，以 Agent 定义为准，并修改框架文档以对齐。

---

## 当前框架结构

```
.claude/agents/ 与 .cursor/agents/ → ideation, director, design, code, art, qa（两份正文一致）
.cursor/skills/in-game-ux/ → in-game UI 的 HOW（自定义 agent 不会自动加载，必须显式 Read）
.cursor/skills/pixel-models/ → 世界内像素模型的 HOW（自定义 agent 不会自动加载，必须显式 Read）
guides/                → 人的参考手册（00-overview ~ 14-docs-structure, 99-review）
docs/                  → 游戏项目活文档（AI读写、人审核）
.agents/skills/game-state/              = 游戏现状索引、证据与离线浏览器（可独立使用）
tools/art-pipeline/    → 构建期美术资源后处理与机器验收工具（自包含）
tools/agent-parity/    → 两份 agent 定义的一致性校验（无依赖，node 直接跑）
START-HERE.md          → 用户入口
AGENTS.md              → Cursor 侧 Agent 入口（钩子，正文仍是 CLAUDE.md）
.cursor/rules/coh.mdc  → Cursor alwaysApply 规则（强制加载上述钩子）
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
├── game-state/            ← 当前全貌：文本源、证据、派生 INDEX.md；atlas.html 按需生成
├── progress/              ← 进度管理（roadmap/current-slice 或 current-iteration/decisions-log）
├── tasks/                 ← Task Briefs（per-Slice 文件：slice-01.md, slice-02.md...）
├── qa/                    ← 验收报告
├── art/                   ← 资产规格 + 角色程序像素 HOW（`actor-pixels.md`）+ 生成 prompt 记录
└── dev/                   ← 开发练习场（gym）入口；当前 `gym.md`
```

## 开发练习场

开发入口、有效 lesson 与运行命令见 `docs/dev/gym.md`，接入范围见现状索引。练习场应复用正式玩法/生成/绘制能力，不能用独立演示实现冒充正式接入。正常玩家入口与 DEV 入口分开登记；具体内容进度不在框架入口重复维护。

## 开发模型

Slice-based iterative development：
- Ideation → Foundation → Slice 1 → Slice 2 → ... → Polish → Launch
- 每个 Slice = Design → Implement → Verify → Validate 完整循环
- Slice 分类：系统 Slice / 内容 Slice / 功能 Slice / 集成 Slice / 打磨 Slice
- 无 "prototype" 阶段，第一行代码即生产质量
- **打磨/表现类 Slice 走轻量路径**：免完整 Task Brief，但收尾必须登记四项（架构登记 / spec 判断 / 交付范围记录 / UI 清单），四项未完成不得标 COMPLETE。仍须**单批上下文预算**（每一批 = 一次 agent 会话可独立完成并过闸门；ALL 表面不得打成一批）。系统 Slice 的验证若依赖界面可读，规划时要么把 UX 收进同一 Slice，要么把验证转下游并写回退路径。「实现完成、体验未验证」是合法收尾态，禁止无证据记 PASS。详见 director agent 定义 Step 2–3 与 `guides/99-review.md` FV-02 / FV-04。

## 游戏内 UI 的硬约束（所有 Agent 遵守）

人最在意三件事，**缺一即不合格**（人终审，清单不能替代）：

1. **审美过关** — 对得起 `art-direction.md` 与具名游戏参考。人说丑就是不合格。过 U2 反模式清单 ≠ 好看。
2. **读作游戏 UI** — 不是后台管理系统、不是调试面板、不是网页把查询结果平铺。主-从、单一焦点、键鼠同一通道。
3. **与游戏整体风格同一世界** — overlay 与场上已锁装置并排必须像同一套设备，不能像另一套软件盖上去。

**in-game UI ≠ admin panel。** 这是本框架实测中最容易翻车的地方（见 `guides/99-review.md` FV-01）。下面各条是保住上述三件北星的手段，不是北星本身。项目色板、参考游戏、组件类、overlay 挂载根住在 art-direction / UI Kit / architecture，不写进本段。

- **HOW 住在 skill，不靠口号。** 触碰 in-game UI 必须执行 `.cursor/skills/in-game-ux/SKILL.md`（三问结果；按项目文档填写，禁止套用别的游戏的皮）。自定义 agent 不会自动加载 skill，必须显式 Read。Director 派 UI 任务时 Task Brief 必须写明这一步。只写「过 U1–U12 / 审美过关」而不走该 HOW = 不合格（见 FV-05）。禁止用「机械层已扫」当交付标题。
- 任何 UI 工作开工前先做**载体决策**：世界内装置 / 世界内终端 / 元界面。**只有元界面允许有"软件界面感"。** 载体是视觉语言，不是实现层：屏幕空间读数挂 `architecture.md` 声明的 overlay 根；钉世界坐标的才走引擎世界层。禁止把角锚 HUD 绑在会因 camera zoom / letterbox 漂移的实现上。
- 必须锚定 **2-3 个具名游戏参考**并写进 spec（学什么动作 / 明确不学什么）。没有参考研究时走 skill 的 Bootstrap，请人锁定后再画。
- 验收走 `docs/specs/_template-ui.md` 末尾的「游戏内 UI 验收清单」U1-U12——那是全项目唯一权威清单（design 自查结构层、art 自查视觉层、qa 逐条验收）。清单是闸门，不是 HOW。
- 视觉真相的优先级：ui spec > 项目 UI Kit 活文档 > `art-direction.md` 的 UI 节 > `world.md` 术语表。Kit 是活文档：实现一偏就改 Kit，禁止拿过期换算当验收基准。
- 不写响应式断点：固定逻辑分辨率（项目配置）；手机端默认 out-of-scope。
- **术语收口 ≠ 句子能读。** 表名 / 数值 / 档位必须分开展示；禁止拼成会被读成复合名词的一句。
- **试玩热修仍须 art。** 即使人已点名样式 / 蒙层 / HUD 布局方案，仍须 art 做最短合规核对（载体 + 参考 + 相关 U 项）；禁止 code 独自发明新视觉语言。
- **UX 不能制造机制里没有的犹豫。** 界面只讲清机制里已有的事实；纠结不成立则回 design 重审收益结构，禁止用面板假装有选择。

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
- Agent 加载顺序：L0 读 CLAUDE.md 路由 + `docs/game-state/INDEX.md` 全貌 + 当前工作指针 → L1 按 feature ID / 依赖定位，再读 spec frontmatter → L2 读相关正文与实现/验证证据

## 游戏现状与长期记忆（所有 Agent 遵守）

- **入口只管路由与约束**：本文件不再维护游戏系统全景、内容数量或累计进度。当前工作读 `docs/progress/current-iteration.md`（采用迭代制时）或 `current-slice.md`，路线读 `roadmap.md`。游戏分支若残留旧“当前阶段”长段，只作历史，不能覆盖这些活入口。
- **先读全貌，再读局部**：`docs/game-state/INDEX.md` 是文本源生成的快捷索引；权威流程与字段约定在 `.agents/skills/game-state/SKILL.md` → `references/protocol.md`。涉及游戏状态的建立、查询、变更与收口时显式 Read；运行时可使用同内容镜像。索引不复制 spec、策划表或 QA 报告。
- **三个事实分开**：设计意图、实现接入（`unknown/design/dev/production/retired`）、验证证据分别记录；工作状态（`active/paused/settled`）另列。文件存在、构建通过、指纹一致均不证明玩家可用，`production` 也不表示体验获人认可。
- **任务绑定能力**：开工声明受影响的 feature ID，读取其依赖/有效约束；收尾更新所辖文本源、实际入口、证据与未知项，由 Director 汇总校验。共享系统变动检查下游证据是否仍适用；不静默删除挂起项或提升验证等级。
- **渐进接入**：旧项目没有索引时，先按 skill 建覆盖全游戏的分类骨架，未核实项显式记为未知；当前任务只核实相关分支。紧急修复可先记录 feature ID / 待补项，再随该修复收口，不要求先全游戏考古。
- **人读视图按需生成**：文本源日常增量维护，`INDEX.md` 随源刷新；`atlas.html` 由同一工具按需生成，不手改派生视图。快照/`baseline` 只记录文件指纹，不刷新验证结果或把旧证据变新。

独立使用、迁移及刷新方式见 `guides/12-project-state.md`。框架角色负责分工；离开本框架，一个 Agent 可依次承担相同步骤。

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

**Cursor 试验（2026-08-13，人拍板，可回退）**：`.cursor/agents/*` 六个 agent 的 `model` **全部临时固定为** `cursor-grok-4.6-xhigh-fast`（Grok 4.6 Extra High Fast），暂停上表 Cursor 列的分档。Claude Code 侧档位表不变。试完效果后恢复分档或改写本表。

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
