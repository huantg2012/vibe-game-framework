---
title: "框架 Review 发现清单"
last-review: 2026-08-13
rounds: 3
---

# Review 发现清单

> **现行状态协议更新（2026-09-20）**：下文历史评审中“CLAUDE.md 就是项目索引”“按目录存在重建已实现状态”的结论已被 game-state 取代；原记录保留用于追溯，不能再当执行规则。当前入口、证据区分与增量维护见 [12-project-state.md](12-project-state.md) 和 [变更记录 0005](changelog/0005-game-state.md)。

## 使用方式

逐条与用户核对：认同→标记待修 / 不认同→标记跳过 / 需讨论→标记待议。
全部核对完后按优先级批次修复。

---
---

# Round 1 — 2026-07-19

来源：游戏开发视角 + AI Agent工程视角 双重审计

## 游戏开发视角

### GD-01 🔴 Foundation 缺少"核心手感快速验证"

**问题**：Foundation 要求完成世界观、系统设计、技术架构、美术方向全部定义后才能进入 Slice 1。如果花 2-3 周做完后才发现核心循环不好玩，沉没成本太高。

**建议**：在 Foundation 中增加"核心手感验证"步骤（世界观+系统设计之后、美术方向之前），用灰盒（方块/圆形）跑一遍核心循环确认手感。代码保留，只是视觉占位。

**状态**：[ shelved ]

---

### GD-02 🔴 缺少 UI/UX 设计文档

**问题**：UI 设计是独立领域——信息架构、Screen flow、HUD 布局、交互模式——不属于系统设计也不属于美术方向，当前框架无归属。

**建议**：增加 `docs/ui-design.md` 或 `docs/specs/ui-*.md` 模板，覆盖 Screen flow、HUD 信息层级、核心交互模式、响应式策略。

**状态**：[✅ fixed]

**后续修订（2026-08-12，PARTIALLY SUPERSEDED by FV-01）**：模板补上了，但补的是一个 **web 应用模板**——"响应式策略（桌面/平板/手机）"这条建议直接写进了模板，`hover/active/disabled` 组件表也是。实测后果：照模板填会稳定产出后台管理系统外观的游戏界面。本条的诊断（UI 是无归属的独立领域）成立，处方错了：缺的不是"一份 UI 文档"，而是**游戏 UI 的词汇表**（载体决策 / 参考锚点 / 游戏语义状态 / 不遮挡区）。见 Round 3 FV-01。

---

### GD-03 🔴 缺少自动化测试策略

**问题**：QA agent 本质是静态分析+人工 review。持续增长的代码库没有自动化测试，回归风险快速累积。

**建议**：
- Code agent 增加规则："关键系统核心逻辑必须有单元测试"
- QA 验收增加"自动化测试覆盖"检查项
- 不要求 100% coverage，但 pure logic 层（规则引擎、数值计算、状态机）必须有

**状态**：[ shelved ]

---

### GD-04 🔴 文档维护负担可能压垮 Solo dev

**问题**：每个 Slice 更新 5+ 文件（current-slice/gdd-core/CLAUDE.md/roadmap/decisions-log），文档维护占比过高。

**建议**：
- 明确区分"AI 自主维护不需人 review"（状态字段更新）和"AI 草拟人必须 review"（spec 变更、gdd 新章节）
- Director 增加"文档健康度"自检：超过 3 个 Slice 未被引用的文档标记"可能冗余"

**状态**：[✅ fixed — 文档维护三级分级：自动/通知/审批，Director输出分级摘要]

---

### GD-05 🔴 缺少 Analytics 埋点的早期规划

**问题**：analytics 放在发布前最后一刻才做太晚。发布后发现采集颗粒度不够需要改代码重发。

**建议**：Foundation 阶段就定义"核心事件列表"（session 开始/结束、循环完成次数、关键选择分布、流失点）。architecture.md 模板增加"Analytics 方案"字段。

**状态**：[ shelved ]

---

### GD-06 🟡 Slice "3-7天"对副业节奏不现实

**问题**：副业 indie 每周可能只有 10-15 小时。加上设计/验收/文档开销，实际编码时间可能只有 5-8 小时。

**建议**：Slice 大小改以"有效工时"而非"日历天数"衡量。建议标准：10-20 有效工时/Slice。规划时加入"每周可用小时数"参数。

**状态**：[ shelved ]

---

### GD-07 🟡 缺少"Kill the Darling"机制

**问题**：框架有 Slice 验证失败的回退，但缺少"整个方向需要 pivot"的处理。

**建议**：Director 增加触发点——连续 2 个 Slice 验证负面 → 强制进入"方向审视"会话，选择：调整/重做/砍掉。

**状态**：[ shelved ]

---

### GD-08 🟡 World.md 缺少叙事语调/写作规则

**问题**：即使机制驱动，也需要 flavor text 的风格一致性管理。

**建议**：world.md 增加"叙事语调"章节：文本长度约束、语气、人称、禁忌。

**状态**：[✅ fixed — world.md模板新增"叙事语调"章节(语气/人称/长度/禁忌/命名风格/示例)，Design agent量产约束从4项扩至5项]

---

### GD-09 🟡 缺少内容解锁依赖图管理

**问题**：跨内容的前置条件链（"技能 B 需要技能 A Lv.3"）仅靠关联引用表不够。50+ 条目时依赖链完整性校验关键。

**建议**：progression.md 增加"解锁依赖图"。QA agent 增加"依赖链完整性校验"——检查不可达内容和循环依赖。

**状态**：[ shelved ]

---

### GD-10 🟡 Agent 切换认知负担 + 框架学习曲线

**问题**：6 个 agent 切换步骤多，<1h 短 session 效率低。框架本身 15 guides + 6 agents + 多模板，学习曲线陡。

**最终方案**（用户决策：不做极简模式，框架复杂度是必要的）：
- 不简化框架，而是强化导航能力
- 创建 `START-HERE.html`（可视化人类入口）：Agent 路由表、Slice 生命周期图、文件结构速查
- 核心交互路径：任何时候找 Director → 它判断状态并路由
- "我想做 X" 路由表覆盖所有常见任务场景

**状态**：[✅ fixed — START-HERE.html 创建，含可视化阶段流/agent卡片/任务路由表/Slice生命周期]

---

### GD-11 🟡 缺少发布相关考量

**问题**：法律合规（隐私政策、AI 资产版权、年龄分级）、版本管理（版本号方案、存档兼容性）、社区建设策略均缺失。

**建议**：launch 清单增加合规子章节 + architecture.md 增加版本策略字段 + guides 增加社区策略参考。

**状态**：[ shelved ]

---

### GD-12 🟢 缺少"已知局限"文档

**问题**：有意识接受的不完美（技术债、设计妥协）无集中记录，QA 每次重新发现同一问题。

**建议**：progress/ 下增加 `known-limitations.md`。

**状态**：[ shelved ]

---

### GD-13 🟢 缺少多语言/本地化预留

**问题**：Content Spec 中文本字段硬编码。如有国际化需求需大改。

**建议**：至少在 architecture.md 模板中标注"本地化策略"作为显式决策点。

**状态**：[ shelved ]

---

## AI Agent 工程视角

### AE-01 🔴 Director 重建验证混淆"存在性"和"正确性"

**问题**：重建验证说"以实际文件为准修正 CLAUDE.md"。但如果代码实现有错（正是需要 QA 发现的），Director 会将错误合法化。

**建议**：明确重建验证只做"文件/目录级存在性检查"，不判断实现对错。表述改为："检查系统列表和内容汇总的存在性信息，不验证实现正确性（那是 QA 的事）。"

**状态**：[✅ fixed — 重建验证限定为存在性检查，发现矛盾时报告人而非自行修正，明确"正确性验证是QA的事"]

---

### AE-02 🔴 内容文件扁平结构无法支撑 100+ 条目

**问题**：所有条目写在单个 `content/[type].md` 中。50-100 条目时单文件过大，LLM 加载效率低，人审核困难。

**建议**：预设分页策略——超 30 条目按分组拆分（如 `enemies-tier1.md`）。或引入索引文件：`[type]-index.md` 只列 ID+名称，详细数据在子文件中。

**状态**：[✅ fixed — Design agent含拆分规则，content模板含扩展说明，QA通过索引定位]

---

### AE-03 🔴 Code agent "不做设计决策"定义过宽

**问题**：变量命名、数据结构选择、算法选择本身就是技术决策。"不做设计决策"实操中不可执行。

**建议**：区分"产品设计决策"（影响用户可感知行为 → escalate）和"技术实现决策"（数据结构/算法/性能优化 → 自主判断）。只有前者需要标 blocker。

**状态**：[✅ fixed — Code agent新增"决策边界"段落：技术实现自主判断、影响玩家感知的escalate，判断标准="玩家会有不同感受吗"]

---

### AE-04 🟡 Director 一致性检查 context 溢出风险

**问题**：中后期项目 10+ spec、20+ content 文件，全量扫描不经济。

**建议**：渐进式策略——先读 CLAUDE.md 系统列表 + 用 Glob 验证文件存在性，只对发现不一致的项深入读取。加入规则："一致性检查使用文件列表+元数据级对比，只在不一致时读具体内容。"

**结论**：indie 规模（5-15 系统、<100 条目/类型）不需要知识库/向量索引。CLAUDE.md 本身就是索引，渐进式策略足够。

**状态**：[✅ fixed — Director增加效率规则：CLAUDE.md=索引、Glob验证存在性、只对异常深入读取]

---

### AE-05 🟡 跨 session 信息传递缺少变更标记

**问题**：Design agent 修改了 spec 接口，Code agent 在另一个 session 不知道 spec 变了，可能基于过时版本工作。

**建议**：
- Spec 文件头增加 `last-modified-by` + `last-modified-date`
- 修改接口时在 current-slice.md 标注 `[INTERFACE CHANGE: system-X]`
- Code agent 启动时对比 spec 修改时间和 Task Brief 创建时间

**状态**：[✅ fixed — spec模板增加last-modified+interface-changed字段；Design修改接口时置true；Code启动时检查并提醒；Director Slice结束重置]

---

### AE-06 🟡 Design/Code 边界的 interface 性质未明确

**问题**：Spec 中 Design agent 写的 TypeScript interface，Code agent 是"必须照搬"还是"只要外部行为匹配可以调整内部"？未定义。

**建议**：在 Design agent 定义中明确：spec 中的 interface 是"接口契约"（外部行为必须匹配）还是"参考结构"（Code 可调整内部实现）。

**状态**：[ shelved ]

---

### AE-07 🟡 decisions-log 无引用和状态管理

**问题**：决策越来越多，后续被推翻的也混在一起。其他文档不引用具体决策 ID。

**建议**：
- 增加 `status` 字段（Active / Superseded）
- 被推翻时标注 `Superseded by DEC-YYY`
- 其他文件可引用 `DEC-XXX` ID

**状态**：[ shelved ]

---

### AE-08 🟡 Code agent(sonnet) 做架构设计能力受限

**问题**：模式 A（架构设计）需要深度分析和方案对比，opus 表现优于 sonnet。

**建议**：提示用户在架构设计阶段用 opus 模型启动 Code agent。或考虑架构设计拆为独立 agent。

**状态**：[✅ fixed — Code agent model 改为 opus（架构设计和功能实现统一使用高能力模型，确保代码质量）]

**后续修订（2026-08-03，SUPERSEDED）**：该结论已被「模型路由与 token 经济性」推翻。当时只权衡了能力，没有计入 code agent 是全框架 token 消耗最大的角色、且拥有最完备的机器闸门（tsc/lint/测试/运行时冒烟）。现改为中档模型 + 逃逸兜底（连续 2 次不过闸门则升档重做）。架构设计（模式 A）确实需要更强能力，但它在整个项目里只发生一两次，不该由此把高频的模式 B 也钉在顶配上——需要时人可显式指定。见 `CLAUDE.md` 与 `guides/changelog/0004-model-routing.md`。

---

### AE-09 🟡 关键文档修改后无 sanity check

**问题**：LLM 输出截断是真实风险。Director 整合 gdd-core.md 时如果被截断，内容丢失。

**建议**：关键文档（gdd-core.md, CLAUDE.md）每次修改后做 basic sanity check（markdown 格式完整、表格行数不减少）。

**状态**：[ shelved ]

---

### AE-10 🟡 Task Brief 文件会爆炸

**问题**：每 Slice 5 个任务 × 10 Slices = 50 个文件。目录杂乱。

**建议**：按 Slice 组织 `docs/tasks/slice-01/` 或完成后归档到 `_archive/`。

**状态**：[✅ fixed — 改为per-Slice文件(slice-01.md)，一个Slice全部brief在一个文件中]

---

### AE-11 🟡 Director 变更传播依赖 Director 在场

**问题**：Design agent 修改 spec 接口时 Director 不在场，变更不会被传播到引用该接口的其他 spec。

**建议**：Design agent 修改接口时在 spec 头部标注 `[INTERFACE CHANGE]`，Director 下次一致性检查时扫描该标记。

**扩展排查**：不只是 Design 改 spec——Code 改 architecture、Art 改 art/audio-direction 也有同样隐患。

**状态**：[✅ fixed — 泛化为所有约束类文档的通用变更标记机制：spec用interface-changed、architecture/art-direction/audio-direction用changed-this-slice；Director一致性检查扫描全部标记；Slice结束统一重置]

---

### AE-12 🟡 LLM 批量生成内容的 Schema 合规性不可靠

**问题**：Design agent 批量生成 10-20 条目时容易出现 ID 格式不一致、字段遗漏、引用不存在的 ID。

**建议**：批量超 10 条目时分批输出（每批 5 个）。QA 验收增加自动化 schema 校验（TypeScript 类型检查或验证脚本）。

**状态**：[✅ fixed — Design agent已有分批规则(每批5个)；QA agent内容验收改为结构化checklist(ID格式/必填字段/类型/叙事语调)，超10条分段检查，建议tsc类型检查]

---

## Round 1 共识（确认为设计优势）

- ✅ Slice 模型对 Solo indie 合适
- ✅ "第一行代码即生产质量" 正确
- ✅ "人在环路" 是核心设计
- ✅ 文档所有权矩阵有效
- ✅ 基于文件存在性的阶段判断可靠
- ✅ "宁可标红让人做" 的自动化边界正确
- ✅ Foundation 顺序合理

---
---

# Round 2 — 2026-07-20

来源：Indie 游戏制作人视角 + AI Agent 工程专家视角 + 内部一致性硬检查 + Round 1 修复验证

## Round 1 修复验证结果

**13/13 项标记 "✅ fixed" 均已完全落地，无遗漏，无引入新问题。**

验证覆盖：GD-02, GD-04, GD-08, GD-10, AE-01, AE-02, AE-03, AE-04, AE-05, AE-08, AE-10, AE-11, AE-12。

---

## Indie 游戏制作人视角

### R2-I1 🔴 框架未经实战验证

**原始问题**：40+ 文件（6 agents + 16 guides + 20 模板）对一个零代码项目过重。从"打开编辑器"到"看到东西动"需要至少 17 步。

**讨论结论**：框架重量本身合理——项目目标是探索"AI vibe coding game"的方法论，框架即核心产出。真正的风险不是"太重"，而是**所有规则都是未经实战验证的假设**。一个没被用过的框架和没被编译过的代码一样——你认为它能跑，但你不知道。

**最终方案**：
1. **Dogfooding**：立刻启动真实游戏项目作为框架的集成测试。每完成一个 Slice 同时产出两类反馈——对游戏的验证 + 对框架的验证（追加到 `guides/98-field-notes.md`）
2. **Bootstrap 协议**：Foundation 阶段允许 vision.md 最小形态（elevator pitch + 核心循环 + MVP 范围即可），其余段落在 Slice 1 结束后补充。不绕过框架，而是把文档完整度从前置条件变成渐进目标
3. **框架迭代节奏**：Director 每 Slice 整合后收集框架摩擦反馈（追加到 `guides/98-field-notes.md`），每 3 个 Slice 触发 retrospective（归纳模式→建议→用户决策→变更传播）。已写入 `director.md` Step 8
4. **清理过时 guides**：✅ 已执行 — 删除 04-prototype/05-production；00-overview 标 SUPERSEDED；03-design 标 PARTIALLY OUTDATED

**原则澄清**："第一行代码即生产质量" ≠ 提前设计所有东西。生产质量 = 写代码时工程标准达标（类型安全、模块清晰、可测试）。不要求写之前所有设计文档都就绪。

**状态**：[✅ 结论确定 — 框架重量合理，风险是验证缺失，解法是 dogfood + bootstrap 协议]

---

### R2-I2 🔴 创意流无快速实验通道

**问题**：框架中不存在 spike/experiment/jam 模式。Slice 模型要求"有 Spec → 有 Brief → Code Agent 实现 → QA 验证"的完整纪律。"第一行代码即生产质量"使得试验一个"敌人爆碎片是否爽"的 10 分钟想法，需要走完整 Slice 流程。这完全不匹配创意探索节奏。

**建议**：
1. 增加 Spike 模式：≤2h、不走完整 Slice 流程、产出标记为实验性、结束时 keep/kill 决策、keep 则纳入下一 Slice 正式实现
2. 将原则修正为"第一行**纳入主干**的代码即生产质量"——实验代码可在分支/实验目录中存在
3. Ideation agent 允许跳步（已有清晰概念时可跳过 Step 1-3）

**状态**：[ pass ]

---

### R2-I3 🟡 前期 Slice 协调开销不匹配项目规模

**问题**：一个 Slice 的 7 步生命周期中，非编码步骤（一致性检查/设计/规划/验收/整合）估计占 30-40% 时间。每周 10h 中 3-4h 花在文档流转。前 3-5 个 Slice（游戏还很小时）这些维护的价值和开销不成比例。

**原始建议**：定义 "Light Slice" 模式、减少 Agent 切换、"1-hour session"指引。

**讨论结论**：与 R2-I1 的 dogfooding 结论矛盾——如果框架是待验证产物，前几个 Slice 恰恰最需要完整跑流程。预设简化 = 绕过框架而非测试框架。30-40% 开销是理论估算（AI 自动处理可能降低实际值），需实战数据验证。正确做法：跑完整流程 → 摩擦自然出现在 `98-field-notes.md` → Slice 3 retro 时基于真实数据决定简化什么。

**状态**：[ shelved — 等 dogfood 数据验证，Slice 3 retro 时重新评估 ]

---

### R2-I4 🟡 出货路径缺实战技术细节

**问题**：Polish/Launch 的指引方向正确，但缺少可操作的技术配置：
- 无 Build/Deploy 管线（从 commit 到线上的自动化步骤空白）
- 无存档/持久化方案（Web 游戏的 localStorage/IndexedDB 策略）
- 音频集成工作流不明确（Art agent 覆盖方向但缺集成步骤）
- 无 branching model / release tagging / hotfix 流程

**建议**：
1. Architecture 模板增加 "Deployment" 章节（Vite build → Vercel 部署 → URL）
2. Foundation 阶段就跑通部署（空白页面也部署到线上）——"持续可运行"的自然延伸
3. 补充音频技术集成步骤（在 code agent 中处理）

**状态**：[ shelved — 音频集成已在 art.md/code.md 标注待完善，其余待 Foundation 阶段落地 ]

---

### R2-I5 🟡 Pivot 路径只有一句话指引

**问题**：Director 定义了"方向性错误 → 暂停 → 回到 vision.md 层面讨论 → 人决定新方向"。但之后呢？没有定义：如何处理已有 architecture.md/world.md、是当前 repo pivot 还是开新 repo、已有代码标记保留还是清除。文档积累增加沉没成本心理锚。

**建议**：
1. 定义 Pivot Protocol：将 docs/ 移入 `archive/attempt-N/`，保留技术栈相关部分，从加速版 Ideation 重启
2. Slice 1 验证后设强 Go/No-Go 门禁：核心循环不 work 则立刻 pivot
3. 显式标注"文档是过程工具不是目标产物，推翻是学习的证据"
4. 增加 "Spike before Slice 1" 选项：Foundation 结束后允许 2-4h 无纪律快速验证

**状态**：[ shelved ]

---

## AI Agent 工程视角

### R2-A1 🟡 Design/QA agent 中后期 context 过载风险

**问题**：
- Design agent 启动时读取清单：vision.md + world.md + CLAUDE.md + gdd-core.md + 相关 specs。10+ Slice 后 gdd-core.md 可能达数万字。
- QA 回归检查要求"对每个已有系统做基本健全检查"——10+ 系统时逐个读代码文件占用大量 context。
- Code agent 的 Task Brief 是一个 Slice 所有任务在一个文件中，8-10 个任务时需 LLM 自行定位相关段落。

**上游方案：分层文档协议（Layered Doc Protocol）**

核心洞察：文档结构 = context 管理。AI 是文档主要消费者，文档应从 Day 1 就针对 LLM 消费模式设计。

1. **Spec 接口层规范**：每个 spec frontmatter 必填 `interfaces-with`（声明依赖哪些系统）+ 正文首段固定为 1-2 句 TL;DR。Agent 可只读接口层判断相关性，无需读完整文件。
2. **分级加载协议**：Agent "工作开始时"统一为 L0（CLAUDE.md 索引）→ L1（相关文档 frontmatter + 首段）→ L2（确认相关后读完整内容）。
3. **gdd-core.md 角色重定位**：从"完整设计记录"改为"设计索引"——每系统仅 1-2 句摘要 + 指针，详情只住在各自 spec 中。Director 整合时只追加索引级信息。
4. **Task Brief 结构化标记**：每个任务段落以 `## Task: [ID] | assignee: [agent]` 开头，便于精确定位。
5. **QA 回归改为增量式**：只检查本 Slice 修改的系统 + frontmatter `interfaces-with` 中声明关联的系统。

**状态**：[✅ 方案确定 — 已更新 spec 模板/gdd-core 模板/Director 整合规则/Design+Code+QA agent 加载协议]

---

### R2-A2 🔴→🟢 interface-changed 状态传递链无校验

**问题**：
- `interface-changed: true` 写入完全依赖 Design agent 行为合规性（LLM 可能改了内容但忘更新 frontmatter）
- Code agent 检查此标记仅在"spec 存在"条件分支下，人直接口头分配任务时整条链被绕过
- 用户绕过 Director 直接操作 agent 时，标记可能无限期停留或永不被消费
- Director 整合涉及多文件同步更新，中断会导致部分更新状态

**核心修复**（已在 R2-A1 中完成）：Code agent L0 步骤增加强制 Grep 所有 spec 的 `interface-changed: true`，消费端不再可能静默跳过。

**Shelved**：git pre-commit hook（无代码阶段过早）、Director 批量写入（理论风险极低）、Director 中途扫描（已隐含于"工作开始时"逻辑）。

**状态**：[✅ 核心修复已在 R2-A1 实施中完成，剩余 shelved 等 dogfood 验证]

---

### R2-A3 🟡 少数指令模糊 + Code agent 缺集中负面约束

**问题**：
- Code agent 的约束散落在"工作原则"、"文档权限"等多处，缺少集中的"你不做的事"段落
- Design agent "与已有系统兼容"缺具体验证步骤
- Director 引用 CLAUDE.md 段落名可能不匹配

**已修复**：Code agent 新增"你不做的事"段落（6 条集中负面约束）。Design 兼容性验证已被 L1/L2 协议 + spec 自审覆盖。

**Shelved**：Director 段落名引用（等正式 CLAUDE.md 创建时自然确定）。

**状态**：[✅ fixed — Code agent 负面约束集中化；Design 兼容性由分级加载+自审覆盖]

---

### R2-A4 🟡 用户绕过 Director 时无即时检测

**问题**：用户绕过 Director 直接操作 agent 时，一致性保障缺失。

**讨论结论**：Solo 模式下绕过 Director 是合法的自主选择，不是系统故障。R2-A1 的分级加载协议已让每个 agent 在 L0 自带轻量一致性感知（读 CLAUDE.md + Grep interface-changed）。Spec 模板已定义精确 frontmatter 字段格式。

**Shelved**：前置步骤完成状态检查（增加写入开销，等 dogfood 出现实际问题再加）。

**状态**：[✅ 已被 R2-A1 分级加载协议充分缓解，剩余 shelved]

---

### R2-A5 🟢 Prompt 工程质量整体优秀

**问题**（优化级）：
- Director "情境提醒"段落（13行）对核心编排任务意义不大，占 context
- Art agent "工具推荐"表格仅在生成 prompt 时有用，UI 设计任务时无关
- Code agent "体验打磨清单"（19行）仅 Polish 相关但每次 session 都存在
- 部分占位符暗示不准确：`[一段话：...]` 让 LLM 只写一句

**建议**：
1. 阶段特定内容从 agent 定义移出到 docs/ 参考文件，agent 中只写"打磨时读取 docs/ref/polish-checklist.md"
2. Director 情境提醒压缩为一条规则 + 简短映射表
3. 占位符统一使用"类型+长度提示"：`[1-3 句：概述系统做什么]`

**状态**：[ shelved — 优化级，context 代价可接受，等 dogfood 反馈 ]

---

### R2-A6 🟡 QA 只能静态审查 + spec 无自审机制

**问题**：
- QA agent 验收主要是静态代码审查，不做动态测试
- 如果 Code agent 正确实现了一个错误的 spec → QA 不会发现
- 无 spec 内部一致性自审
- 无"项目休眠/恢复"协议

**已修复**：
1. QA agent "工作开始时"新增构建验证步骤（`npm run build` + `npm test`）
2. Design agent 触发规则新增 spec 自审（规则矛盾检查 + 数值自洽 + interfaces-with/exposes 匹配验证）

**Shelved**：项目恢复协议（等 dogfood 中出现实际中断场景再定义）。

**状态**：[✅ fixed — QA 增加构建验证、Design 增加 spec 自审；恢复协议 shelved]

---

## 内部一致性硬检查

### R2-X1 🔴 失效路径引用

| 位置 | 问题 | 状态 |
|------|------|------|
| `START-HERE.md` 行 59 | 引用 `docs/framework/06-*`、`07-*` | ✅ 修正为 `guides/06-*`、`07-*` |
| `guides/01-agent-system.md` 行 88/217 | 任务文件命名 `TASK-*.md` | shelved（01 整体滞后，见 R2-X4） |

**状态**：[✅ START-HERE 已修正；01 待整体处理]

---

### R2-X2 🔴 旧模型残留（无废弃标注）

| 文件 | 问题 | 状态 |
|------|------|------|
| `guides/00-overview.md` | 整篇旧模型 | ✅ 已标 SUPERSEDED |
| `guides/03-design-workflow.md` | "原型阶段"表述 | ✅ 已标 PARTIALLY OUTDATED |
| `guides/02-ideation-workflow.md` 行 321 | "原型阶段验证" | shelved（深埋，不阻塞） |
| `.claude/agents/ideation.md` 行 101 | "Design 阶段"→"Foundation" | ✅ 已修正 |
| `.claude/agents/ideation.md` 行 160 | "Design 阶段"→"Foundation" | ✅ 已修正 |

注：`guides/04-prototype-workflow.md`、`05-production-workflow.md` 已删除。`09-document-lifecycle.md` 已标注 PARTIALLY OUTDATED。

**状态**：[✅ 核心项已修复/标注，残余 shelved]

---

### R2-X3 🟡 术语不统一

| 问题 | 涉及 |
|------|------|
| Agent 名称大小写混乱 | 所有 agent 定义文件 |
| "Sprint" 与 "Slice" 交替使用 | guides/10-slice-model.md |
| 5 种 Slice 类型 vs agent 只引用 3 种 | CLAUDE.md vs agents/ |

**状态**：[ shelved — 纯美观/低影响，等 dogfood 后统一清理 ]

---

### R2-X4 🟡 guides/01-agent-system.md 严重滞后

| 问题 | 详情 |
|------|------|
| 文档结构树不完整 | 缺 world.md、audio-direction.md、content/、art/、specs/ui-*.md |
| 权限矩阵缺条目 | 缺多个文件 |
| vision.md 权限标错 | Ideation agent 是实际创建者 |

**状态**：[ shelved — guides/ 是人的参考，agent 定义是权威。Agent 不读 guides/01，不影响执行 ]

---

### R2-X5 🟡 文档所有权歧义

| 位置 | 问题 |
|------|------|
| `design.md` | `docs/world.md` 同时出现在"你更新的"和"你只读的" |

**状态**：[ shelved — 语义正确：建世界观时更新，做系统设计时只读。双重身份是有意设计 ]

---

## Round 2 修复优先级建议

### 第一批（立刻 / 低成本高收益）

1. `ideation.md` 修正 "Design 阶段" → "Foundation"（2 处）
2. `START-HERE.md` 修正 `docs/framework/` → `guides/`
3. ~~`guides/00-overview.md` 加 frontmatter `status: SUPERSEDED`~~ ✅ done
4. ~~`guides/03-design-workflow.md` 加 `status: PARTIALLY OUTDATED`~~ ✅ done
5. `guides/02-ideation-workflow.md` 行 321 修正或标注

### 第二批（需设计决策）

6. 是否增加 Spike 模式（R2-I2）
7. 是否定义 Light Slice（R2-I3）
8. Code agent 增加 `interface-changed` 强制扫描（R2-A2）
9. Code agent 增加集中"你不做的事"段落（R2-A3）
10. 每个 agent 启动增加轻量一致性 check（R2-A4）

### 第三批（可 shelve 至项目实际运转后）

11. 统一 Agent 名称大小写（R2-X3）
12. `guides/01-agent-system.md` 权限矩阵全面更新（R2-X4）
13. gdd-core 分段策略（R2-A1）
14. Pivot Protocol 定义（R2-I5）
15. Architecture 模板增加 Deployment 章节（R2-I4）
16. QA agent 动态验证能力（R2-A6）
17. Design agent spec 自审清单（R2-A6）
18. Prompt 优化：阶段特定内容外置（R2-A5）

---
---

# Round 3 — Field-validated（dogfooding 产出）

来源：真实游戏项目的实战摩擦（`guides/98-field-notes.md`），不是审计推演。每条都有具体的返工代价作为证据。

## FV-01 🔴 框架在 in-game UI/UX 上产出质量差 —— 词汇表错了

**证据**：Slice 4.5（表现层翻修）花了**七轮**人工返工才收敛。人对起点产出的描述是"调试信息 + 后台管理系统 + 原型几何体"；人的原话是"framework 在 in-game ux 方面的表现非常差，难以输出游戏风格的设计"。

**根因**：不是模型审美不行，是**框架把游戏界面当 web 应用来描述**。三处物证：

| 物证 | 问题 |
| ---- | ---- |
| `docs/specs/_template-ui.md`（原版） | 含"响应式策略：桌面/平板/手机"+ `default/hover/active/disabled` 组件表。照着填必然填出后台表单——而本项目固定逻辑分辨率、手机端 out-of-scope、面板是键盘驱动的 |
| art agent「UI 设计输出格式」（原版） | "布局描述 + CSS 实现代码 + 响应式断点"。把产出框定为"一张样式表"，而不是"世界里的一台设备" |
| Director 试玩反馈路由表（原版） | "UX/表现问题 → design agent → code agent"，**整条链路没有 art agent**。而"像不像游戏"恰恰是视觉规格层的产出 |

**另一个发现**：七轮里真正让方向收敛的唯一输入是人给出的**具名游戏参考**（Rimworld / DF / Hades / Darkest Dungeon / FTL / Signalis / Darkwood）。框架此前没有任何地方要求写参考锚点——而没有锚点时，LLM 的默认先验就是通用 web 界面。

**已落地的对策（2026-08-12）**：

1. **重写 `docs/specs/_template-ui.md`**：新增「载体决策」（世界内装置 / 世界内终端 / 元界面，只有元界面允许软件感）、「参考锚点」（强制 2-3 个具名游戏）、「画面占用与不遮挡区」（替代响应式断点）；组件状态改为游戏语义（静默 / 可交互 / 已选中 / 不可用 / 临界）
2. **新增「游戏内 UI 验收清单」U1-U12**，作为全项目唯一权威清单，住在该模板末尾；design / art / qa 三方共同引用
3. **art agent** 新增「硬约束：in-game UI ≠ admin panel」（含 10 条反模式清单 + 强制载体决策与参考锚点），「UI 设计输出格式」整段重写去 CSS/响应式
4. **design agent** UI 协作模式新增载体决策前置 + 三条结构层硬约束（不照搬 web 表单 / 画面占用是设计问题 / 术语来自 world.md）
5. **qa agent** 新增 Slice 验收第 3 项「游戏内 UI 验收」——逐条过 U1-U12，可静态核查的先给结论，肉眼判断项给证据。**这是给 in-game UI 补上的闸门**：按 `CLAUDE.md` 模型路由的逻辑，"只能靠强模型兜住的任务，缺的是闸门"，而此前它连清单闸门都没有
6. **Director** 试玩反馈路由表新增「游戏内 UI 风格问题 → art agent（必经）」，并明确禁止跳过 art agent 直接派 code 写样式

**状态**：[✅ fixed — 六处已落地，agent parity 校验通过]

**待观察**：清单是否会退化成"勾选仪式"。下一个触碰 UI 的 Slice 结束时检查——如果 QA 报告里 U1/U2/U12（需判断的三条）永远是"通过"且无证据，说明清单没起作用，要改成"必须给出证据句"。

**5.5 注记（2026-08-13）**：第一轮试玩错误类型已从「后台管理系统」变成 HUD 看不见 / 滚动条 / 条读不懂 / Esc 甩标题——FV-01 诊断成立。U1–U12 会不会变成无证据勾选，仍待人回签 Slice 5.5 后观察（5.5 尚未 COMPLETE）。同日人纠正：北星是 **审美** 与 **UX 读作游戏** 两件并列；不得把载体错误说成「不是审美问题」从而把审美降级。过反模式清单不能替代人终审。

**5.5 收尾补记（2026-08-16）**：人指令完成当前 Slice。U1–U12 按机械层登记，审美列写「人收尾、不代勾」，没有无证据打 PASS。5.5 已 COMPLETE。

---

## FV-02 🟡 打磨/表现类 Slice 在"完整流程"与"完全裸奔"之间二选一

**证据**：Slice 4.5 全程没走 Step 1-3（无一致性检查、无立项、无 Task Brief），完全由对话驱动。代价：七个 commit 新增了两个系统（BoundaryShape / BoundaryBreath）却无 spec 承接，architecture.md 也没登记，事后才补回。

**但另一面也是真的**：表现层工作的验证方式天然是"改一版→人当场看→指名下一版问题"，问题清单在看到东西之后才生成，预先写 Task Brief 的收益确实远低于系统 Slice。所以正确答案不是"以后必须走完整流程"。

**已落地的对策（2026-08-12）**：Director 定义新增「打磨 / 表现类 Slice 的轻量路径」——**免**完整 Task Brief，但**强制收尾登记四项**（架构登记 / spec 判断 / 交付范围记录 / UI 清单），且"四项未完成不得标 COMPLETE"。这把 R2-I3 shelved 的 "Light Slice" 问题在有实战数据后落了地，且只对一类 Slice 生效。

**状态**：[✅ fixed — 已写入 director.md Step 3]

**5.5 注记（2026-08-13）**：轻量路径能开干（参考 + Kit + IA 先于代码）。但 ALL 表面把单个 code agent 在 C0 中途耗尽，C1/C2 拆开重派才完成。缺批次/上下文预算 → 见 FV-04。

---

## FV-03 🔴 Slice 5.5：词对了仍回退 —— 组合展示 / HUD 技术 / 活 Kit / 热修跳过 art / 假选择

**证据**：Slice 5.5「UX 重构」（ALL UI：参考 + Kit v2 + IA + C0–C6）。这是 FV-01 对策的第一次实战，不要和 Slice 4.5 / 3.5 混。代码面已齐、人第一轮试玩已发生，Slice **未**标 COMPLETE。

**5.5 收尾补记（2026-08-16）**：已 COMPLETE。上一句是 08-13 当日。

物证：

| 物证 | 问题 |
| ---- | ---- |
| 裂隙 HUD 文案 `23 混乱 · 稳定` | 术语收口了，仍被读成复合名词。表名 / 数值 / 档位必须分开展示 |
| C2 用 Phaser `scrollFactor(0)` 画角锚 HUD | `camera.setZoom(1.5)` 下四角读数全部落在视口外。载体模板把 A 类写成「Phaser 层」是错的技术默认值。净化点 HUD 早已是 DOM；裂隙 HUD 后迁 `#dom-ui-root` |
| Kit v2 §A1「Phaser 字号 ×1.5」 | HUD 迁 DOM 后同一 Slice 内失效。打磨规格当死文档就会继续当验收基准 |
| 混乱条 / 溢出蒙层 | 人点名视觉处方后直接派 code，跳过 art。FV-01「风格问题 art 必经」被热修路径绕开 |
| DEC-045 D9 | 机制上防御/工具不是二选一。若用面板把不存在的权衡讲成可纠结的选择，就是用 UX 假装有机制 |

**已落地的对策（2026-08-13，框架层 A）**：

1. **`_template-ui.md`**：载体 A 改为「屏幕空间 → `#dom-ui-root` / 世界坐标 → Phaser」；写明载体 ≠ 实现层；信息层级加组合规则；U1 加 HUD 挂载、U9 加禁止复合名词
2. **CLAUDE.md / AGENTS.md**：游戏内 UI 硬约束补上五条可执行反模式（DOM 根、组合展示、活 Kit、热修须 art、禁止假选择）
3. **art agent**：载体不再默认 Phaser；Kit 是活文档；试玩热修走最短合规核对（人已点名方案时只核载体+参考+U 项）
4. **design agent**：结构层硬约束补组合展示 + 禁止用面板假装有选择
5. **code agent**：屏幕空间读数挂 `#dom-ui-root`；不发明视觉语言；不拼复合名词
6. **qa agent**：U1/U9 按新口径静态可查（Grep `scrollFactor(0)`、朗读可见字符串）；Kit 与实现冲突记规格过期，不把实现判回 Phaser
7. **Director 试玩路由**：新增「视觉热修仍须 art」与「假选择 → design 重审收益结构」

**状态**：[✅ fixed — 已写入执行标准；agent parity 校验通过]

**待观察**：小地图仍挂 `document.body`（层 B 已知债，下次触碰再迁，本次不修游戏）。`architecture.md` 选型表仍写「HUD = Phaser Text/Graphics」、Kit §A1 仍有失效换算列——层 B 欠账，由后续 art/architecture 触碰时改，本次不越层。

---

## FV-04 🟡 打磨缺批次预算；系统 Slice 验证依赖可读性时必须规划

**证据**：

1. Slice 5.5 走 FV-02 轻量路径能开干，但 ALL 表面把单个 code agent 在 **C0 中途耗尽**，C1/C2 拆开重派才完成。轻量路径免的是预先 Brief，不是「一次塞进一个 agent」。
2. Slice 5（DEC-043）实现全绿、人未回签试玩与 U1-U12，验证问题（装配决策是否纠结）依赖界面可读——先试玩等于测噪声。收尾只能记「实现完成、体验未验证」。当时这是框架里没有的词。

**已落地的对策（2026-08-13）**：

1. **Director 轻量路径**：强制单批上下文预算——每一批 = 一次 agent 会话可独立完成、独立可看、独立过闸门；ALL 表面必须拆批；到顶未完成 → 拆批重派，不许无声续跑
2. **Director Step 2 / CLAUDE.md 开发模型**：系统 Slice 的验证若依赖界面可读，规划时必须写明二选一：(a) 把足以产生有效试玩信号的 UX 收进同一 Slice；(b) 把验证明确转下游，并写「转到哪 / 若不成立回退到哪」
3. **「实现完成、体验未验证」是合法收尾态**。禁止为走完形式记无证据 PASS

**状态**：[✅ fixed — 已写入 director.md + CLAUDE.md]

**不写入 UX 防回退**：Cursor 侧 Grok 模型试验（与 5.5 UX 回退无关，保持可回退试验）。

---

## FV-05 🔴 「要过关」写进 agent 仍不够 —— HOW 没被当成程序加载

**证据**：人明确：不是记上「要审美过关 / 要像游戏 UX」就够了，要让 agent 知道**如何**过关。此前 FV-01/FV-03 已把清单、载体、DOM 根、组合规则写进执行标准，但这些是闸门与反模式，不是动手顺序。HOW 其实已存在（`ux-references.md` §2–3 八条判断、Kit A1–A4、`art-direction.md` §6、本项目 V1–V9 / 5.5 试玩反例），问题是 **agent 开工时不会把它当程序跑**——自定义 agent 尤其不会自动加载 Cursor skill。

**根因**：
1. 训练先验是 SaaS 后台；不先钉载体 + 具名参考（学什么维度 / 不学什么），产出必然漂。
2. 清单（U1–U12）能否决已知坑，不能教「先打开哪几个文件、复用哪个 class、写完必须答哪 8 句」。
3. 审美无法机器过关；若不禁止 agent 自称 PASS，清单会变成无证据勾选。

**已落地的对策（2026-08-13，同日拆层）**：

1. **Framework skill** `.cursor/skills/in-game-ux/`：`SKILL.md` = 通用开工闸门 + 写完自检 + Bootstrap（无 Kit 时从 vision/world 发明第一版）；`like-a-game.md` / `aesthetics.md` = 判断动作与可否决句。**不内嵌**某款游戏的色板、组件类、参考名单、引擎 API。世界内像素模型的 HOW 是后来另立的 `.cursor/skills/pixel-models/`（不是本条 UI skill 的扩写）。
2. **游戏填充物**留在项目文档：参考研究、UI Kit、palette、architecture 的 overlay 挂载根。skill 按路径加载，找不到则 Bootstrap，禁止套用别的游戏的皮。
3. **强制接线**：art / design / code / director / qa 写明触碰 in-game UI 必须显式 Read 该 SKILL.md。Director 派 UI 任务时 Task Brief 必须写这一步——自定义 agent 不会自动加载 skill。
4. **CLAUDE.md / AGENTS.md / `_template-ui.md`**：清单是闸门；HOW 在 skill。只写「要过关」而不走 HOW = 不合格。agent 不许自称好看/像游戏。

**状态**：[✅ fixed — skill 方法论化 + agent 接线；dogfood 填充物下沉到游戏 docs]

**待观察**：下一个触碰 UI 的任务，产出方是否真的书面回答了自检 1–8，且参考/色板来自**本游戏**文档而非 skill 内嵌默认值。若 Task Brief 又只写「过 U1–U12」，说明接线没生效。
