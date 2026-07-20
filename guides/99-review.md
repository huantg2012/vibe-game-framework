---
title: "框架 Review 发现清单 — 待逐条核对"
date: 2026-07-19
source: 游戏开发视角 + AI Agent工程视角 双重审计
---

# Review 发现清单

## 使用方式

逐条与用户核对：认同→标记待修 / 不认同→标记跳过 / 需讨论→标记待议。
全部核对完后按优先级批次修复。

---

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

**状态**：[✅ fixed — 重建验证限定为存在性检查，发现矛盾时报告人而非自行修正，明确"正确性验证是QA的事"] 🔴 内容文件扁平结构无法支撑 100+ 条目

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

---

### AE-09 🟡 关键文档修改后无 sanity check

**问题**：LLM 输出截断是真实风险。Director 整合 gdd-core.md 时如果被截断，内容丢失。

**建议**：关键文档（gdd-core.md, CLAUDE.md）每次修改后做 basic sanity check（markdown 格式完整、表格行数不减少）。

**状态**：[ AE-08 ]

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

## 两个视角的共识（确认为设计优势）

- ✅ Slice 模型对 Solo indie 合适
- ✅ "第一行代码即生产质量" 正确
- ✅ "人在环路" 是核心设计
- ✅ 文档所有权矩阵有效
- ✅ 基于文件存在性的阶段判断可靠
- ✅ "宁可标红让人做" 的自动化边界正确
- ✅ Foundation 顺序合理
