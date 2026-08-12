---
status: ACTIVE
created-by: director agent
created-when: 2026-08-12
last-modified: 2026-08-12
note: Slice 5.5「UX 重构」ACTIVE。范围由人亲口锁定为 ALL（所有菜单/交互面板/HUD/物品信息展示）。打磨 Slice，走 FV-02 轻量路径（免完整 Task Brief，收尾四项登记不免）。人的核心痛点：不像游戏、不成体系。
---

# Slice 5.5: UX 重构【ACTIVE】

类型：**打磨 Slice**（不新增玩法系统；验证方式是"改一版 → 人当场看 → 指名下一版问题"）
日期：2026-08-12 立项 / 2026-08-12 转 ACTIVE（人锁定范围）
路径：**轻量路径**（`director` agent Step 3 / `guides/99-review.md` FV-02）——免完整 Task Brief，但**收尾四项登记义务不免**，见文末。

> 上一 Slice 收尾：**Slice 5「工具库深度」COMPLETE（2026-08-12）**，验证结论为「实现完成、体验未验证」。
> 收尾记录见 commit `d0bd785` 版本的本文件 + `roadmap.md` 的「Slice 5 完成总结」。决策见 `decisions-log.md` DEC-043。

---

## 人的诊断（原话，本 Slice 的第一性依据）

核心痛点：**「不像游戏、不成体系」**。

四条要求：

1. **不要闭门造车**——梳理合理参考游戏内的 UX 设计，总结方法论与审美
2. 做**完整的、体系化的、符合游戏世界观与场景风格**的 UX 设计
3. **裂隙场景内现在只有调试面板（那东西不是给玩家看的），缺少 HUD**
4. 无论如何风格化，**务必保证文字信息玩家能看清**

范围：人亲口说 **ALL——所有菜单、所有交互面板、所有 HUD、所有物品信息展示**。**不允许缩减。**

---

## 为什么现在做这个 Slice

Slice 5 把界面要承载的信息量推到了新量级：

| 维度 | Slice 4 结束时 | Slice 5 结束时 |
| ---- | -------------- | -------------- |
| 主动工具 | 8 | **15** |
| 被动工具 | 2 | **3** |
| 污染物类型（全档接线） | 7 型有专用防御逻辑 | **18 型全部接线** |
| 出击工具槽 | 3 | **4**（改造解锁） |
| 防御槽 | 3 | **4**（改造解锁） |
| 永久改造项 | 3 | **6** |

Slice 5 的验证问题是「出击前'带什么'的决策是否变得纠结」。但这个纠结感**只能通过界面被感知**——玩家分不清 15 件工具各自做什么，机制再对也感受不到。所以人的判断是：先做一轮 in-game UX 收敛，再回头验证装配决策，而不是先补一次注定不可归因的试玩（DEC-043）。

---

## 验证问题（已确认）

**主问题（对齐人的痛点）**：
> **整套界面是否读作游戏内体验（成体系），而不是调试面板 / 后台管理系统？**

**子问题——玩家不看任何文档，能否说清这三句话：**
1. 我这次带了什么，每件东西做什么？
2. 刚才那下发生了什么（工具生效了吗 / 防御副作用来自哪 / 改造起作用了吗）？
3. 这次分配的后果是什么（谁会被打、多重、我修的这下值不值）？

**顺带回答 Slice 5 的遗留验证问题**：拿到一件 Fine/Rare 污染物时，玩家是否真的在"当防御吃着"和"攒成工具用"之间犹豫？
→ 若做完 UX 收敛仍然不纠结，说明是**结构性问题**（工具/防御的收益结构本身不成立），回退路径是回 design agent 重审收益结构，**不得靠改 constants 掩盖**。

---

## 范围：ALL（已锁定，按表面逐一列清）

下面 15 项是本 Slice 的**完整交付表面**，按人说的 ALL 逐一列出以避免遗漏。每项后括注 Director 已核实的现状病灶。

### 元界面

| # | 表面 | 文件 | 已核实病灶 |
| - | ---- | ---- | ---------- |
| S1 | 主菜单 | `src/scenes/main-menu-scene.ts` | 彻底原型状态：标题 `COH`、副标题 `Prototype Build`、按钮 `[ New Expedition ]` / `[ Continue ]`。英文 + 通用软件词 + 色值 `#888888/#555555/#aaaaaa/#ffffff` 全不在锁定色板。**玩家看到的第一个画面** |

### 净化点场景

| # | 表面 | 文件 | 已核实病灶 |
| - | ---- | ---- | ---------- |
| S2 | 净化点常驻 HUD | `src/ui/dom/purification-hud.ts` | 未套 `.game-panel`，自成一套无边框符号网格（Slice 5 遗留待裁定项，backlog 已记）→ art 裁定 |
| S3 | 分配面板 | `src/ui/dom/allocation-panel.ts` | 待审 |
| S4 | 供奉（防御装配） | `src/ui/dom/defense-panel.ts` | 4 槽 × 18 型污染物，信息与工具库重复 |
| S5 | 踏入裂隙（出击装配） | `src/ui/dom/loadout-panel.ts` | 4 槽 × 15 主动 + 3 被动，**本 Slice 的主战场**（装配决策纠结感在此被感知或不被感知） |
| S6 | 存续报告 | `src/ui/dom/status-panel.ts` | 待审 |
| S7 | 蜕变（永久改造） | `src/ui/dom/growth-panel.ts` | 6 项改造 |
| S8 | 冲击结算 | `src/ui/dom/impact-result-panel.ts` | 待审 |
| S9 | 共享样式层（基元库） | `src/ui/dom/panel-styles.ts` | `.game-panel` 带 `box-shadow: 0 0 12px`（U2「无投影/发光」，需裁定）；`.hint` 用 `#5a5f66` on `#0f1114`，**对比度极低——人点名"文字看不清"的重灾区** |

### 裂隙场景

| # | 表面 | 文件 | 已核实病灶 |
| - | ---- | ---- | ---------- |
| S10 | **裂隙玩家 HUD** | `src/ui/hud.ts` | **人点名项。** HUD 存在但近乎不可读：生命/混乱是**无标签 4px 裸条**；工具槽只显示 `[Q] ···`（圆点表余量）——**没有工具名字**，15 种工具全靠玩家记；结算面板仍是 Phaser Text（v1 基线 A4 已要求改 DOM，未落地） |
| S11 | 裂隙 dev 调试面板 | `src/scenes/rift-scene.ts`（`createDebugOverlay`） | `debugVisible = true` 默认开启（DEV），视觉上比真 HUD 还显眼——**这就是人说"只有调试面板"的直接来源**。本 Slice 必须降级为显式开发开关，**不得默认显示、不得冒充游戏 UI** |
| S12 | 小地图 | `src/ui/minimap.ts` | 待审 |

### 跨场景层

| # | 表面 | 文件 | 已核实病灶 |
| - | ---- | ---- | ---------- |
| S13 | 物品/工具/污染物信息展示 | `item-tile` 的 HTML `title` 属性 + `src/config/contaminant-descriptions.ts` | 全项目走**浏览器原生 tooltip**：系统字体、延迟弹出、样式不可控、**只能鼠标悬停**（直接违反 U7「不依赖 hover」）。描述源仅 17 行。**回答"我带了什么、每件东西做什么"的主战场** |
| S14 | 瞬时反馈层（toast / 阈值提示 / 场景过渡） | `rift-scene.ts` / `purification-scene.ts` / `tool-system.ts` / `defense-engine.ts` / `growth-panel.ts` | 分散在五处，无统一基元；被动工具触发无感知渠道（无按键、无冷却条） |
| S15 | 术语层 | `data/*.csv` 文案 ↔ 面板文案 ↔ `docs/world.md` 术语表 | 三处是否说同一件事（U5）。已知：主菜单用 `Prototype Build`/`Continue`；`abyss`/`stitch` 文案假设 3 模块而实现 2 模块（数据层欠账，本 Slice 只登记不修） |

### 技术性根因（"不成体系"的结构来源，必须在体系里处理）

两套 UI 技术栈并存：**Phaser Text/Graphics**（S1/S10/S12）与 **DOM overlay**（S2-S9）。DOM 面板字号是 CSS px、**不随 canvas 的 `Phaser.Scale.FIT` 缩放**；Phaser Text 字号是游戏单位、**会被缩放**。两者的"视觉字号"当前不对齐——这既是可读性问题也是一致性问题（U11）。

### 明确不做

- Slice 6 第二敌人（潜行轴，独立 Slice）
- 任何新玩法系统 / 新内容条目
- 程序化地图、净化点扩张
- 数值平衡——**除可读性所必需外不动**（若发现是结构性收益问题，走 design 而不是在本 Slice 调参）
- `abyss`/`stitch` 的 3 模块文案（Slice 7 加第三模块后自动成立，本 Slice 只登记）

---

## 工作包与派发（轻量路径：无完整 Task Brief，但拆解可执行）

### 第一波：参考驱动的体系设计【进行中，2026-08-12 已派发】

人的第一条要求是"不要闭门造车"，因此**体系设计先于任何代码改动**。两个 agent 并行，文件不重叠：

| 包 | 执行 | 产出 | 说明 |
| - | ---- | ---- | ---- |
| W1 | **art** | 新建 `docs/design-notes/ux-references.md` | 3-5 个**具名游戏参考**（须论证选取 + 明确"学什么/不学什么"）+ 方法论拆解 + 可执行审美原则。声明为研究材料，非规范 |
| W2 | **art** | **就地升级** `docs/design-notes/ui-art-overhaul.md` → **UX Design Kit v2** | §A0 载体决策表（S1-S15 逐项）/ §A1 **可读性硬规则**（DOM 与 Phaser 两套字号 + 换算规则 + 最小对比度 + 第二重编码 + 现存违规逐条处置）/ §A2-A4 色彩·排版·组件基元库 / §A5 逐表面视觉规格（S10 裂隙 HUD 与 S1 主菜单给足细节）/ §A6 动效 / §A7 U1-U12 自查映射。**B 节角色美术不动** |
| W3 | **design** | 新建 `docs/design-notes/ux-information-architecture.md` | 15 表面逐项：玩家要回答什么问题 → 必须显示什么 → P1/P2/P3 优先级 → 状态语义（游戏语义，禁 hover/active/disabled）→ 交互模式（键盘第一公民）。重点四处：裂隙 HUD 必须信息集 / 键盘可达的物品检视信息层 / 反馈感知 / 术语偏差清单。文末给结构性风险清单 + 应就地扩写的 spec 清单 |

**不新建 v2 视觉基线文件**——视觉真相优先级链是 `ui spec > ui-art-overhaul.md > art-direction.md §6 > world.md 术语表`，多一份基线就会打架，故 W2 走就地升级。

**循环预算**：W1-W3 各为「产出 + 最多 2 次修订」。两轮未收敛 → 停下升级给人，不无声续跑。

### 第二波：人过目方向（短停）

人已明确 ALL + 痛点，**方向确认可精简**——只看两件事：具名参考选得对不对、可读性硬规则的数字能不能接受。人点头后立即进第三波。

### 第三波：code 分批落地（待第一波产出后排期）

按表面分批，每批独立可看、独立验收。**建议顺序**（依赖驱动，非重要性排序）：

| 批 | 表面 | 为什么这个顺序 |
| - | ---- | -------------- |
| C0 | S9 共享样式层 + 可读性硬规则 | 基元库是后面所有批次的地基；先落地才不会各面板各造一套 |
| C1 | S1 主菜单 | 玩家第一印象；元界面唯一允许软件感的表面，风险最低，可作为体系的首个验证样本 |
| C2 | **S10 裂隙 HUD + S11 调试面板降级** | 人点名项，优先级最高的实质缺口 |
| C3 | S13 物品信息层（替换原生 tooltip） | 回答"带了什么"的主战场；S5/S4 依赖它 |
| C4 | S5 踏入裂隙 + S4 供奉 | 装配决策的两个面板，共用 S13 的检视层 |
| C5 | S2 净化点 HUD + S3/S6/S7/S8 其余面板 | 收敛剩余面板到统一体系 |
| C6 | S14 瞬时反馈层 + S12 小地图 + S15 术语收口 | 收口层 |

每批收尾：过**可读性硬门槛** + 相关 U1-U12 条目 → 人当场看 → 指名下一版问题。
**逃逸兜底**：同一批连续 2 次未过机器闸门（`tsc`/lint/构建/运行时冒烟）→ 停止重试，升 T1 重做并记入 `guides/98-field-notes.md`。

---

## 强制约束

### in-game UI 硬约束（CLAUDE.md + FV-01）

本 Slice 全程触碰 in-game UI，因此：

- **必经 art 路径**。不允许直接派 code agent 写样式——实测会稳定产出后台管理系统外观（`guides/99-review.md` FV-01，Slice 4.5 花了七轮返工）。art 需先做**载体决策**（世界内装置 / 世界内终端 / 元界面）并锚定**具名游戏参考**写进规格。
- **收尾逐条过 U1-U12**（`docs/specs/_template-ui.md` 末尾的「游戏内 UI 验收清单」，全项目唯一权威清单）。**Slice 5 未回签的 U1-U12 并入本 Slice 一次过完**（DEC-043）。
- 视觉真相优先级：ui spec > `docs/design-notes/ui-art-overhaul.md`（v2）> `docs/art-direction.md` §6 > `docs/world.md` 术语表。
- 不写响应式断点，固定逻辑分辨率（canvas 960x640，`Phaser.Scale.FIT`），手机端 out-of-scope。

### 可读性硬门槛（人点名，优先级高于装饰）

**字号或对比度不够 = 不合格，不接受"风格需要"作为理由。** 硬规则的具体数字由 art 在 W2 §A1 给出并经人确认；确认后该节即为本 Slice 的验收基准，等同 U9 的项目内实例化。

### 收尾四项登记（轻量路径免 Task Brief，不免这个）

**四项未完成，本 Slice 不得标 COMPLETE。**

1. **架构登记**：本 Slice 新增/删除的 `src/` 模块登记进 `architecture.md` 模块注册表（必要时补 DEC-ARCH）。预期新增：物品检视信息层、瞬时反馈层基元——落地后核实
2. **spec 判断**：判据是"这块代码里有没有数值 / 条件 / 状态转移，是别人必须知道才能不改坏的？"有 → **就地扩写归属系统的 spec，不新建文件**；纯配色描边类视觉 → 不需要。design 的 W3 文末会给候选清单
3. **交付范围记录**：本文件写清逐轮迭代与实际交付范围
4. **UI 清单**：U1-U12 逐条过（含 Slice 5 未回签的那次）

---

## 逐轮迭代记录

### R0 — 立项与范围锁定（2026-08-12）

- 人指名痛点「不像游戏、不成体系」+ 四条要求，范围锁定为 ALL
- Director 扫描 `src/` 全部 UI 表面，产出上方 S1-S15 清单及已核实病灶；确认人所说"裂隙只有调试面板"成立——HUD 存在但无标签/无工具名，dev 调试面板 DEV 下默认显示且更显眼
- 派发第一波 W1/W2/W3（art × 2 + design × 1，并行）
- 状态 PLANNING → ACTIVE

### R0.1 — art W1/W2 交付（2026-08-12）

- ✅ W1 `docs/design-notes/ux-references.md` 已新建（研究材料）
- ✅ W2 `docs/design-notes/ui-art-overhaul.md` 已就地升级为 **UX Design Kit v2**（A 节整体重写，B 节不动）
- ⏳ W3 design 信息架构仍在进行

**人过目短停材料（等 W3 齐后一并确认亦可，下面数字已可先看）：**

| 项 | art 结论 |
| -- | -------- |
| 具名参考（5） | Signalis / FTL / Darkest Dungeon / Into the Breach / Barotrauma（各有"学什么/不学什么"，见 `ux-references.md`） |
| 最小字号 | DOM ≥12px；Phaser HUD ≥8（等效 12px）；换算：`Phaser fontSize × 1.5 = 等效 DOM px`，且 DOM 根节点须跟随 `Scale.FIT` 同步缩放 |
| 最小对比度 | ≥4.5:1 |
| 现存违规 | 9 处（V1–V9）+ 15 处未登记色值（全部映射回锁定色板，**新增色值 = 0**） |
| `purification-hud` | **裁定：不收进 `.game-panel`**——它是 A 类世界内装置（P0 常驻读数），与裂隙 HUD 对称；修的是内容完整度，不是载体 |
| 落地翻车点 | ① DOM/Phaser 缩放同步若不做，窗口一变对齐又碎；② 五面板同一污染物中文名不一致（数据层，非视觉）；③ 检视层依赖键盘导航，现有面板若无则组件立不住 |

### R0.2 — design W3 交付（2026-08-12）· 第一波齐

- ✅ W3 `docs/design-notes/ux-information-architecture.md` 已新建（S1–S15 与 DEC-044 对齐）
- **第一波规格齐备。进入人过目短停——见下方「方向确认清单」。在人点头前不派 code。**

**design 关键发现（已并入确认清单）：**

| 项 | 结论 |
| -- | ---- |
| 最严重表面 | S13 物品信息层（区分字段从未上屏）／S10 裂隙 HUD（工具无名字）／S8 冲击结算（防御十项结果一项不显示） |
| 裂隙 HUD P1 | 生命 · 混乱 · 薪柴 · 工具槽（键位+名+余量）· 生效中状态 · **被发现程度（需人拍板）** |
| 检视层 | 选中即检视、五层（身份/摘要/数值/与我的关系/转化去向）；L2 需 CSV 加摘要列 |
| 术语 | 约 88 条偏差归并 6 类；污染物命名 **5 套并行无权威源**——同一工具两面板两个名字 |
| 结构性 | **R1：防御↔工具机制上不是二选一**（装防御=先吃减伤再照样拿工具），UX 讲得清造不出纠结；另有 R3 同图同敌下 15 工具无区分必要等 |

---

## 方向确认清单（✅ 人已批准 2026-08-12 —— 「开搞吧」，全部按建议默认落定，记 DEC-045）

| # | 项 | 裁决 |
| - | -- | ---- |
| D1 | 参考五选：Signalis / FTL / Darkest Dungeon / Into the Breach / Barotrauma | **过**（气质匹配，学/不学边界已写清） |
| D2 | 可读性：DOM≥12px、Phaser≥8、对比度≥4.5:1、DOM 根节点跟随 Scale.FIT 缩放 | **过**（你点名的硬门槛实例化） |
| D3 | `purification-hud` 不套 `.game-panel`，与裂隙 HUD 同走「无边框装置读数」语言 | **过**（art 论证成立；修内容不改载体） |
| D4 | 污染物命名：CSV 为唯一权威，清掉面板本地名表；同一效果四种写法收成一种 | **过**（不改玩法，改文案一致性） |
| D5 | 冲击结算必须披露防御十项结果；一次归来只保留一个需按键消解的通知（潮汐/里程碑并入结算） | **过**（直接打「不像游戏」的确认链病灶） |
| D6 | 检视层「选中即检视」+ L5 转化去向同屏；L2 摘要列进 CSV（标杆语感确认后再批量补） | **过**（回答「带了什么」的主战场） |
| D7 | **稳定度是否从净化点 HUD 降到存续报告** | **建议过（降）**——即时决策用不上，且 100% 无终局内容（R6）；与 art 现状规格冲突处，以本确认为准改 v2 |
| D8 | **是否本 Slice 纳入「被发现指示」** | **建议推迟到 Slice 6**——不改数值但改潜行手感（猜→看）；5.5 守「看得懂」，潜行轴留给第二敌人一起做 |
| D9 | 结构性 R1：接受「当前机制下本来就没有防御/工具纠结」，UX 只负责讲清事实；若要真实犹豫，另开 design 重审收益结构（不在 5.5 改机制） | **过**——与 DEC-043 回退路径一致，不在本 Slice 用界面糊机制 |

### R1 — 进入实现：C0 已落盘，C1/C2 重派（2026-08-12）

方向确认短停结束，人批准「开搞」。D1–D9 九项全部按建议默认落定（DEC-045）。

**C0 交付**（前一轮 code agent 资源耗尽中断于 C0 半成品；Director 收尾补齐并过闸门后落盘）：
- `#dom-ui-root` + `bindDomUiRootToGame`（DOM↔Phaser Scale.FIT 对齐）
- V1–V9 属基元层的违规修正（去投影、hint 对比度、`#5a5f66` 禁作文字）
- 未登记色值映射回锁定色板；检视层/toast 基元容器就位
- 各 DOM 面板（含 impact-result、purification-hud）改挂根节点
- commit：见 git log `refactor(slice-5.5): C0 ...`
- 逃逸：本批 typecheck/build 一次通过

**C1 / C2 因资源耗尽未完成 → 拆开重派（单批单 agent，降低上下文负载）。**

| 批 | 内容 | 状态 |
| - | ---- | ---- |
| C0 | 共享基元层 | ✅ `3e87dd5` |
| C1 | 主菜单 | ✅ `29b2085`（去原型英文；覆盖确认态为正确性修复；危险色因对比度不够未用红，改陈述文案） |
| C2 | 裂隙真 HUD + 调试面板默认关闭 | ✅ `d7b40b7`（P1：生命/混乱含档位/薪柴/工具中文名+余量/生效中状态；调试默认关仅 F1；中文名入口 `contaminant-names.ts`） |
| C3 | 物品检视层（先补键盘游标导航） | ✅ `1e04ffb`（三区键盘游标；选中即检视 L1–L5，L2 摘要降级待 CSV 扩列；title tooltip 已清；DEC-046） |
| C4 | 分配/蜕变收敛 + 本地名表清零 | ✅ `4d954a1`（全项目 TYPE_NAMES/TOOL_NAMES 代码零残留；分配/蜕变键盘可达） |
| C5 | 冲击披露 D5 + 稳定度降级 D7 + 阻断链合并 + 净化点 HUD | ✅ `0b491de`（十项归因全披露；归来单次确认；稳定度改存续报告陈述；spec 已标 interface-changed） |
| C6 | 反馈层统一 + 小地图 + 术语/文案收口 | ✅ `3bf22fb` |

### R2 — C6 交付（2026-08-13）· 代码面收口

详见下方「人验收清单」。commit `3bf22fb`。

---

## 人验收清单（代码面已齐，**未标 COMPLETE**——等人试玩回签）

### 按表面（S1–S15）

| # | 表面 | 看什么 |
| - | ---- | ------ |
| S1 | 主菜单 | 是否还有英文/`Prototype`；有存档时「进入净化点」是否先确认再清档；↑↓/Enter |
| S2 | 净化点 HUD | 无稳定度进度条；薪柴/潮汐/预告可区分；不套 `.game-panel` |
| S3 | 分配 | 键盘 ±1/±5；机会成本行；注入禁用态可读 |
| S4 | 供奉 | 键盘游标三区；选中即检视五层；空状态可读；键位提示 |
| S5 | 踏入裂隙 | 同上；工具中文名与 CSV 一致 |
| S6 | 存续报告 | 稳定度是状态陈述不是进度条；检视只读；对比度 |
| S7 | 蜕变 | 键盘选卡购买；「已至上限」；当前→下一级文案 |
| S8 | 冲击结算 | **防御十项是否归因到具体残渣**；潮汐/里程碑是否同屏一段；一次确认即可 |
| S9 | 共享基元 | 窗口缩放后面板是否仍对齐 canvas；无投影；hint 可读 |
| S10 | 裂隙 HUD | 工具槽中文名+余量；生命/混乱有标签与数值；无 `x1.2` 常驻；生效中状态 |
| S11 | 调试面板 | 默认不可见；仅 F1；不压四角 |
| S12 | 小地图 | 玩家点暖橙、撤离点近白青，是否比双白更好分 |
| S13 | 检视层 | 无原生 tooltip；L5 转化去向同屏；键盘可达 |
| S14 | 反馈层 | toast 是否仍可读；多条重叠是否可接受（已知缺口） |
| S15 | 术语 | 各面板同一工具是否同名；有无软件词 |

### U1–U12（试玩时过一遍）

对照 `docs/specs/_template-ui.md` 末尾清单。重点盯：**U2** 无后台味、**U5** 术语、**U7** 不靠 hover、**U9** 可读性、**U11** 像同一台设备、**U12** 五个参考锚点。

### 试玩路径建议

主菜单 → 净化点（开各面板、键盘走一圈）→ 装防御+工具 → 进裂隙看 HUD → 用工具/挨打 → 撤离看结算披露 → 再看存续报告稳定度陈述。

建议参考 Playtest 方法：`guides/02-ideation-workflow.md` Step 4。

### 已知问题（不挡试玩，但要知情）

1. L2 摘要仍是长描述截断——等 CSV `summaryDefense`/`summaryTool` 语感确认后扩列
2. 工具持续时间未进 HUD「生效中状态」
3. Toast 并发排队未做（多条会叠）
4. 小地图玩家/撤离仍同形，仅靠色分
5. 术语表未收录：混乱档「稳定/渗透/侵蚀/临界」、强度档「轻微/中等/剧烈/极端」
6. 主菜单无存档摘要行；危险红对比度不够故未用红
7. R1 结构性：机制上仍无真实防御/工具纠结——UX 只讲清事实
8. 「被发现指示」刻意未做（D8 → Slice 6）

_等你回签试玩结论后，Director 再走收尾四项登记并决定是否标 COMPLETE。_

---

### R3 — 人第一轮试玩反馈（2026-08-13）· 三项必须修，已派 code

| # | 人的原话 | Director 已确认的根因 | 处置 |
| - | -------- | -------------------- | ---- |
| F1 | **裂隙场景还是看不到 HUD** | **真 bug，C2 交付有洞。** `rift-scene.ts:128` `camera.setZoom(1.5)`；`hud.ts` 全部元素是 Phaser + `setScrollFactor(0)`，锚在 `(8,8)` 一类左上角坐标。**scrollFactor(0) 不免除 camera zoom**——缩放绕相机中点做，渲染位置 ≈ `cx + (x-cx)*zoom`，代入得 `(-228, -148)`，**画到了视口外**。zoom=1.5 下 scrollFactor-0 的可见区间只有 x∈[160,800]、y∈[107,533]，四角读数全部在区间外。本项目已踩过同一个坑并写进 `rift-scene.ts:856-858` 注释（dev 面板因此走 DOM），Slice 3「净化点 HUD 不可见」也是同病同解 | **裁决：迁 DOM，挂 C0 的 `#dom-ui-root`**。不违反 art 载体决策——v2 §A0 的「A 类世界内装置」是视觉语言分类，`purification-hud` 同为 A 类且本就是 DOM；迁移后两场景常驻读数层反而更一致（U11），且免疫整类 zoom bug、字号统一 DOM 一套 |
| F2 | **部分交互面板有很出戏的滚动条** | `panel-styles.ts` 只给 `.game-panel` 根写了 `::-webkit-scrollbar`，真正滚动的是各面板内层 `flex:1;overflow-y:auto` 的**内联 div**（7 个文件），完全没样式 → 走浏览器默认；且 Firefox 不认 webkit 伪元素 | 收敛为共享滚动容器基元；隐藏原生外观（webkit + Firefox 双写）保留滚动；滚动提示用现有终端语言。**附带正确性要求**：原生条隐藏后，C3 的键盘游标移动必须自动把焦点项滚进可视区 |
| F3 | **底部按钮（算了、那些）不等宽** | `.action-bar` flex + `.action-btn` 纯 padding 撑宽 → 宽度跟文字长度走 | 等宽（等分或统一 min-width），保持居中/直角/1px 边框/四态不变，走共享样式层 |

**验证要求**：F1 必须给运行时证据（人点名"不要只改一处猜"）。

**待办（本轮结果回来后 Director 处理）**：若 HUD 迁 DOM，v2 §A1 的「Phaser HUD 字号 / 双单位换算」对裂隙 HUD 失效 → 需回头让 art 更新规格。

### R3.1 — code 修复交付（2026-08-13）

三项均按 Director 的根因分析施工，未重新猜测。commit `fix(slice-5.5): 裂隙 HUD 可见性 + 滚动条 + 按钮等宽`。

| # | 处置 | 结果 |
| - | ---- | ---- |
| F1 | **裂隙 HUD 从 Phaser scrollFactor(0) 全量迁移为 DOM**（新文件 `src/ui/dom/rift-hud.ts`，替代并删除 `src/ui/hud.ts`；类名 `HUD`→`RiftHud`）。挂载到 C0 的 `#dom-ui-root`，内容 1:1 保留（生命标签+条+数值、混乱条+刻度+数值+档位词、薪柴、工具槽键位+中文名+余量、生效中状态行、撤离提示、拾取/被动闪现改用共享 `showToastInline`）。低血量/混乱溢出脉动改为 CSS `@keyframes`，不再需要 Phaser 场景引用 | typecheck/build 通过；无浏览器自动化工具可用，运行时验证改用架构性证明——见下方「F1 验证依据」 |
| F2 | `panel-styles.ts` 新增共享基元 `.scroll-area`（`flex:1;overflow-y:auto` + 双写隐藏原生滚动条 `scrollbar-width:none` / `::-webkit-scrollbar{display:none}` + 复用 `.separator` 语言的顶/底 1px 边框，不发明新装饰）。收敛 allocation/defense/growth/loadout/status/impact-result 六处内联 `flex:1;overflow-y:auto` div；同时移除这六个面板外层 `.game-panel` 根节点上多余的 `overflow-y:auto`（它从未真正触发滚动，是"两层都能滚"的隐患源头，一并清除）。新增 `scrollFocusedIntoView(panel)` helper（读 `.slot-selected`/`.tile-selected`/`.card-selected`，`scrollIntoView({block:'nearest'})`），已接入全部 6 个面板的 `render()`/`show()` | typecheck/build 通过 |
| F3 | `.action-bar > .action-btn { flex:1 1 0 }` + `:only-child { flex:0 1 auto }`：多按钮的 action-bar（loadout 的"踏入"/"…还是算了"、allocation 的"注入"/"…算了"）等宽；单按钮的 action-bar（defense/growth/status/impact-result 的"离开"/"…不了"/"合上"/"知道了"）保持原有紧凑居中，不被拉伸变形 | typecheck/build 通过 |

**F1 验证依据（无浏览器自动化工具，采用确定性架构证明排除"又画到视口外"）**：

1. `getDomUiRoot()`（`panel-styles.ts`）创建的 `#dom-ui-root` 是固定 960×640px 的 div，`bindDomUiRootToGame()` 只对它做一次 `transform: translate(canvasRect.left, canvasRect.top) scale(canvasRect.width/960)`（`transform-origin:0 0`），随 `game.scale.on('resize')` 与 `window.resize` 同步——这个 transform 只是把整块 960×640 逻辑画布**原样搬到并等比缩放到** canvas 在屏幕上的实际位置，不做任何围绕中心点的二次缩放（这正是老 bug 的病灶：Phaser `camera.setZoom` 是绕视口中心缩放，`cx+(x-cx)*zoom`，会把边缘坐标推成负数；`#dom-ui-root` 的 transform 锚点在左上角，是线性搬移，不产生这种偏移）。
2. `RiftHud` 的全部元素坐标都是在 0-960 / 0-640 范围内的静态声明值（`left:12px`/`top:12px`/`right:12px`/`bottom:12px`/`bottom:36px;left:50%` 等），从未引用 `camera.zoom` 或任何 Phaser 相机属性——Phaser 相机的缩放只影响 WebGL/Canvas 内的游戏世界渲染，与这棵挂在 `#dom-ui-root` 下的 DOM 子树完全正交，二者没有耦合路径。
3. 代入验证：设窗口 960×640（无缩放），`canvasRect={left:0,top:0,width:960}`，`scale=1`，HP 行落在屏幕 (12,12)，撤离提示落在 (480,604)——均在 [0,960]×[0,640] 视口内。设窗口 1600×900（`Scale.FIT` 以高度定标，`scale=900/640≈1.406`，画布因 `#game-container` flex 居中而 `left≈125`），撤离提示的屏幕坐标 = `(125+480×1.406, 0+604×1.406) ≈ (800, 850)`——仍在窗口内。因为 transform 对整块 960×640 框做的是**恒等比例的线性映射**，任何声明在 [0,960]×[0,640] 内的坐标，映射后必然落在 canvas 实际显示框内——这对任意 `Scale.FIT` 产生的窗口尺寸都成立，不是"这次凑巧对了"。
4. `npm run build`（`tsc && vite build`）与 `npm run dev` 均无报错；额外用 `curl`（`Invoke-WebRequest`）确认 dev server 对 `/` 与 `/src/ui/dom/rift-hud.ts` 均返回 200，确认该模块能被 Vite 正确转换、无语法错误阻断加载。
5. **净化点侧核对**：`purification-scene.ts` 同样 `camera.setZoom(1.5)`，但其 P0 常驻层（`purification-hud.ts`）本来就是 DOM 实现，且全项目搜索 `scrollFactor` 只在 `rift-hud.ts` 的说明性注释里出现——确认没有同类漏网的 Phaser `scrollFactor(0)` 屏幕空间元素。

**结论——v2 §A1 的失效范围**：v2 §A1「Phaser HUD 字号 / 双单位换算」规则（`hud.ts` 坐标系数值 ×1.5 换算 DOM px）**对裂隙 HUD 已经失效**——裂隙 HUD 现在是纯 DOM，直接用 §A1 的 DOM px 规则（≥12px）即可，不再需要换算列。建议 art 在下一次修订时把 §A1 表格的"Phaser HUD（hud.ts 坐标系数值）"列标注为"仅剩 dev 调试面板等非游戏内 UI 场景可能用到"或直接删除该列，避免下一个 agent 误以为裂隙 HUD 还要按两套单位维护。
