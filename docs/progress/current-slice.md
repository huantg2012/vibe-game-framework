---
status: COMPLETE
created-by: director agent
created-when: 2026-08-12
last-modified: 2026-08-16
note: Slice 5.5「UX 重构」COMPLETE（2026-08-16，DEC-054）。打磨 Slice，轻量路径收尾四项已登记。下一手 Slice 6 程序化地图+撤离点（DEC-053）。
---

# Slice 5.5: UX 重构【COMPLETE 2026-08-16】

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

- 第二敌人（当时写 Slice 6；DEC-053 后为 Slice 8）
- 任何新玩法系统 / 新内容条目
- 程序化地图（DEC-053 后为 Slice 6）、净化点扩张
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

**2026-08-16 已完成（人指令收尾，DEC-054）。**

1. **架构登记**：检视层 `inspect-dock.ts`、裂隙 HUD `rift-hud.ts`、名称源 `contaminant-names.ts`、副作用文案 `side-effect-labels.ts`、PanelStyles toast/`#dom-ui-root`/`.crt-stack`、小地图挂 `#dom-ui-root`、SaveManager peek —— 已在 `architecture.md` 模块表。本轮无新 `src/` 文件未登记。未补 DEC-ARCH（无新系统边界）。
2. **spec 判断**：有规则的就地扩写——`system-growth-tide.md`（名称权威 / 摘要列 / 检视五层 / 排序 / 被动须反馈 / 槽位与 QFG）；`system-purification-impact.md`（结算必须披露 + 一次归来一条阻断）；`system-chaos-scavenge-extract.md`（裂隙 HUD P1、完整度、生效中、结算拾取条目）。反馈通道参数写入 Kit §A4（归属 a，不进 CLAUDE 宪法）。纯配色不新建 spec。敌人 detection 接口留给 Slice 8，本轮不改 `system-enemy-ai.md`。
3. **交付范围记录**：本文件 R0–R12 即逐轮记录。C0–C6 + 墙机磷光屏 + 完整度文案 + 四处缺口 + 主菜单三组 + 底栏按键。
4. **UI 清单**：见文末「收尾 U1–U12」。HOW 已走 in-game-ux skill（各 UI 批次）。审美 / 读作游戏：人指令完成 = 终审信号；agent 不写好看/PASS。

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
| D8 | **是否本 Slice 纳入「被发现指示」** | **推迟**——不改数值但改潜行手感（猜→看）；与第二敌人同轴。编号：当时 Slice 6，**DEC-053 后 Slice 8** |
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

## 人验收清单（代码面；2026-08-16 人要求收尾）

### 按表面（S1–S15）

| # | 表面 | 看什么 |
| - | ---- | ------ |
| S1 | 主菜单 | 是否还有英文/`Prototype`；有存档时「进入净化点」是否先确认再清档；↑↓/Enter |
| S2 | 净化点 HUD | 无稳定度进度条；不套 `.game-panel`；**贴顶横排三槽**（薪柴 数字；潮汐 第 N 潮 相位；下次归来 核心/储藏 档位名；消声第四槽「再下一轮」）。无菱形/波形/pip。人未回签 |
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

### 已知问题（收尾时仍成立，不挡 COMPLETE）

1. R1 结构性：机制上装防御不是放弃工具。UX 只讲清事实。若要真实犹豫，回 design 重审收益结构（DEC-054）。
2. 「被发现指示」刻意未做（D8 → Slice 8，DEC-053）。
3. 未清完的展示债：部分档位色 `#1a6b5c` 对比度；「污染物」vs「污染体」；`architecture.md` 过期目录树（已在 backlog）。

L2 摘要 / toast 队列 / 工具剩余秒 / 小地图异形 / 主菜单纪录摘要 / 术语表四档 / 底栏按键：R9–R12 已落地。Kit §A0/A1 已回写。

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

---

### R4 — S2 右上常驻读数写明（2026-08-13）· 人拍板后派 design → art → code

**人原话**：右上整块「完全不需要这么隐晦，直接写明就行」。起因：预告行只有 `◈/▣` + 四格 `▮`，人读不出核心还是储藏。

**范围（锁死）**：只改 `#purif-hud` 右上四行（薪柴 / 潮汐 / 冲击预告 / 消声淡预告）。不做 S3–S8；不改机制（DEC-034 仍是目标+档位，不报方向）；稳定度不加回常驻 HUD；底栏 `#purif-prompt` 不是本批主交付（已有「◈ 核心 / ▣ 储藏」）。

**产品判断（人锁定）**：不要让玩家学符号；表名/数值/档位分开展示；落地 IA §S2 已有目标文案（潮汐 `第 N 潮 · 涨潮`、预告 `下次归来 · 核心 · 中`）；档位中文；薪柴加表名「薪柴」；仍不套 `.game-panel`；仍挂 `#dom-ui-root`。

**派发**：design 收口四行最终文案结构（对照 tide/impact 现有术语；冲突则停、不改机制）→ art 最短合规核（先 Read `.cursor/skills/in-game-ux/SKILL.md`）→ code 只改 `purification-hud.ts`（及确有必要的 i18n）。本 Slice **不标 COMPLETE**。

**design 已锁（DEC-047）**：四行独立节点——`薪柴`+数字；`潮汐`+`第 N 潮`+涨潮/潮峰/退潮；`下次归来`+核心/储藏+`SEVERITY_LABEL`；消声行时机必须是`再下一轮`。档位中文沿用已上屏轻微/中等/剧烈/极端（人口授「轻/中/重」视为口语）。无硬停。

**art 已核（最短合规）**：载体仍 A，不套 `.game-panel`。Kit §A5-3 已换四行死约束。消声行 opacity 下限 **0.85**（现 0.55 对比度不够）。

**code 已落地**：只改 `src/ui/dom/purification-hud.ts`。底栏未动。`typecheck` / `build` 通过。人验收 / U1–U12 **未勾 PASS**。本 Slice **不标 COMPLETE**。

**design 已锁（2026-08-13）**：四行可见结构见 IA §S2 合同表。档位中文选定 `SEVERITY_LABEL`（轻微/中等/剧烈/极端）。无硬停冲突。请 art 只核视觉，勿另起结构。

### R5 — S2 布局锁定 Alt B 贴顶横槽（2026-08-14）· 人点名 BBBBBBB

**人原话**：四套互斥方案后锁定 B。竖表否决（丑、主次不分、散）。

**落地**：`#purif-hud` 改为 `flex-direction:row; gap:32px` 三槽（消声可选第四槽在左）。文案节点仍是 DEC-047。无菱形/波形/pip/`·`。Kit §A5-3 / IA §S2 / DEC-048 已回写。底栏未动。本 Slice **不标 COMPLETE**。审美 / U1–U12 仍等人终审。

---

### R6 — 方案 1 CRT 整页 · 六块交互面板重构示例（2026-08-14）· 等人看完再裁

**人原话**：倾向方案 1 CRT 整页，但从上一版图里觉得信息缺失。授权 design/art 出所有交互 panel 重构示例，人看完再判断。不写 `src/**`，不标 COMPLETE。

**上一版（`menu-alt-1-crt-page.html`）丢掉的 P1（点名）**：机会成本三簇；S4 槽上减伤%/转化去向/副作用；S5 槽摘要、主动/被动、出击残留；S4/S5/S6 固定检视区；S7 整屏；S8 基础→实际、「挡下 N」两行、残留。半屏对照本身也不是「同一台监视器铺满」。

**本轮交付（只 `docs/art/demos/`，未改 `src/**`，未把 Kit 标成已通过）**：

| 文件 | 表面 | 机械层 P1 |
| ---- | ---- | --------- |
| `menu-crt-_shell.html` | 共用机身 | 面框/扫描线/标题行/底键行/分区线 |
| `menu-crt-_layout.md` | 分区合同 | design：无「需人裁定」；P1 只改落点不删 |
| `menu-crt-s3-alloc.html` | S3 分配 | 全 |
| `menu-crt-s4-defense.html` | S4 供奉 | 全（含检视 L1–L5） |
| `menu-crt-s5-loadout.html` | S5 踏入 | 全（既有残留现实现未上屏，示例已画） |
| `menu-crt-s6-status.html` | S6 存续 | 全（稳定度陈述、无条） |
| `menu-crt-s7-growth.html` | S7 蜕变 | 全（还差 9 / 已至上限） |
| `menu-crt-s8-impact.html` | S8 冲击 | 全（挡下 12、挡下 9 两行） |

审美 / U1–U12 **未勾 PASS**。等人看完点头或点名哪块还缺/还丑。本 Slice **不标 COMPLETE**。

### R6 — CRT 整页分区（2026-08-14）· design 只出落点

方案 1「CRT 整页」已锁。design 产出 `docs/art/demos/menu-crt-_layout.md`：S3–S8 ASCII 分区 + P1 核对表，不删 P1、不改机制、不进 `src/**`。无「需人裁定」。待 art 按该文件复制六张。本 Slice **不标 COMPLETE**。

### R7 — CRT 磷光屏写入 `src/**`（2026-08-14）· DEC-049

**人原话**：风格不错；全屏太大；几乎纯黑白不符配色；灰色金属框不符；取消 1px 外框。随后「搞吧」——样张进实现。

**落地**：`.game-panel` 默认 680×468 磷光屏（无金属/无外框）。S3 分配 / S4 供奉 / S5 踏入 / S6 存续 / S7 蜕变 / S8 冲击 切到 `createCrtPanel` + P1 分节点。Esc 记录菜单与裂隙结算保持居中小读出。Kit §A5-5 / `art-direction.md` §6.4 / `architecture.md` PanelStyles / DEC-049 已回写。

审美 / U1–U12 **未勾 PASS**。本 Slice **不标 COMPLETE**。

### R8 — 全表面 UX 审查（2026-08-15）· 只审不改码

人授权三路审查（轴1 布局/结构/审美机械层 + 轴2 世界/场景适配）。**未标 COMPLETE。审美 / U1–U12 待人终审。** 不派 code。

**产出：**

| 角色 | 文件 |
| ---- | ---- |
| art | `docs/art/ux-review-slice-55.md` |
| design | `docs/design-notes/ux-review-ia-slice-55.md` |
| qa | `docs/qa/report-slice-5.5-ux.md`（QA 子代理两轮未落盘，Director 按授权用 Read/Grep 补闸门证据，口径仍是 qa：不修码、不代勾好看） |

**补列表面（S1–S15 立项清单不完整）：** Esc 记录菜单 `pause-menu.ts`；裂隙结算 `rift-result-panel.ts`；boot 加载条；窗口失焦层 `main.ts`；混乱阈值旁白；场景过渡蒙层（部分挂 `document.body`）。

**最高优先级发现（3–8）：**

1. **成体系**：至少三台机器并立——元界面 Phaser 空场 / 净化点 680×468 CRT / 裂隙扁平条 HUD；Esc 与裂隙结算还是第四种居中小窗。
2. **确定偏差**：裂隙结算拾取用 `getToolName`，刚捡残渣显示工具名（身份链在「带了什么」的起点断）。
3. **确定偏差**：CRT **壳**在 src，**内部分区合同未进 src**（P1 与库存同卷滚动；demo ≠ 上线）。
4. **确定偏差**：挂载根不统一——小地图 / 场景过渡 / 窗口失焦不挂 `#dom-ui-root`（小地图为架构已知债）。
5. **已知仍成立**：L2 摘要截断；工具持续时间未进 HUD；toast 并发叠；小地图同形靠色。
6. **术语**：`HP` / 存档软件词 /「污染物」vs「污染体」；D4 同一效果三种写法未收。
7. **对比度**：S5 / 裂隙结算 common `#1a6b5c` ≈3:1（S4/S6 已改未传播）。
8. **Kit 过期**：§A0/A1 仍写 `hud.ts` 与 Phaser 换算；裂隙 HUD 已迁 DOM。本轮不改 Kit。

**与已锁决策：** DEC-049「Esc / 裂隙结算保持居中小读出」实现遵守——不要为对齐 S8 大屏而改决策。art 记的「不同源」是适配观察，不是决策违约。

### R9 — 文案合同（2026-08-15）· design 只锁字符串

人授权修「写错的东西」+ 主菜单内容。不写 `src/**`。不标 COMPLETE。不自称审美过关。

**产出：** `docs/design-notes/ux-copy-lock-slice-55.md`（DEC-050）。`docs/world.md` 术语表补完整度 / 残渣 / 稳定度 / 混乱四档 / 刻入 / 纪录 等已上屏词。

**已锁：** 玩家量=完整度；主菜单「进入净化点 / 沿旧路返回 / 新的纪录」+ 分节点摘要；暂停第三项「合上」；残渣名与计数；刻入；按任意键；载入；薪柴表名；混乱增速一种写法。

**下一手：** code 按合同替换表改可见字符串 + 新增 peek；art 核字宽（完整度三字）与视觉，回写 Kit 过期 HP。审美 / U1–U12 待人终审。

### R9 — 文案合同 + 视觉通行证落地（2026-08-15）· code

人授权修写错的东西 + 主菜单内容 + 按 art/design 合同改可见层。本批落地了文案合同（DEC-050）+ 视觉通行证第 5 节 12 条。未标 COMPLETE。审美待人看三帧（墙机、裂隙左上+右下、主菜单）。

**文案：** 裂隙 HUD 表名完整度；stitch 均摊+数字；主菜单无纪录只「进入净化点」、有纪录默认「沿旧路返回」+ 潮汐/出击/稳定度分节点摘要；暂停三项「新的纪录 / 沿旧路返回 / 合上」；残渣名与计数；存续空态「尚无残渣」；蜕变底栏「刻入」；失焦「按任意键」；开机「载入」；混乱增速一种写法；common 稀有度色与 S4 对齐。`save-manager` 新增无副作用 peek。

**视觉：** `.game-panel` 凹槽暗边 + 发暗；暂停/结算 5px 凹槽、仍 320/360 居中；`.device-plate` 左上状态 + 右下小地图；小地图挂 `#dom-ui-root`，十字/竖缝/方/菱形；底色 `#0a0b0d`；过渡与失焦挂 `#dom-ui-root`。未做 CRT 内部分区 / L2 摘要 / toast 队列 / 工具持续时间进 HUD / 被发现指示。

机械层已扫。审美 / U1–U12 **未勾 PASS**。本 Slice **不标 COMPLETE**。

### R10 — 四处缺口合同（2026-08-15）· design 只锁结构/文案

人选择「先补四处小缺口再走第二种敌人」。不写 `src/**`。不标 COMPLETE。不改玩法公式。

**产出：** `docs/design-notes/ux-gap-lock-slice-55.md`（DEC-051）。`data/contaminants.csv` 新增 `summary_defense` / `summary_tool`（18×2；四条标杆原样）。

**已锁：**

1. CRT 上/中固定，只有库存可滚（蜕变六卡尽量不滚）；检视高度固定。
2. L2 真摘要列，不再截断长文。
3. 通道 B 同时最多 2 条可见、排队、2s；拾取闪不入队。
4. 裂隙生效中：限时工具名 + 剩余整数秒（分节点）；duration 0 不上。

**下一手：** code 按合同改 DOM 分区、codegen 接新列、toast 队列、tool-system 只读暴露进行中效果。审美 / U1–U12 待人终审。

### R10 — 四处缺口落地（2026-08-15）· code

人选择先补四处小缺口。按 `ux-gap-lock-slice-55.md` + `ux-gap-visual-slice-55.md` 第 4 节落地。未标 COMPLETE。审美待人终审。

**落地：**

1. codegen 写入 `summaryDefense` / `summaryTool`；检视 L2 与 L5、踏入槽摘要读 CSV，不再截长描述。
2. 六块墙机 `createCrtPanel` 加 `.crt-stack`。S3/S8 无 `.scroll-area`；S4/S5/S6 只有库存在滚动区，检视 min-height 110px；S7 储备+六卡固定，底栏「刻入」。
3. `showToastInline` 默认 2s，通道 B 同时最多 2 条，后来排队。拾取 `+N` / 被动短闪 `skipQueue`、800ms。稳定度里程碑改入队列，不再居中。防御开局拆成多条入队。
4. `tool-system.getActiveTimedEffects()` 只读；裂隙 HUD 生效行名+整数秒分节点，不冲掉防御残留行。

**请人看：** 供奉库存很多时槽+检视仍在；裂隙两条提示上下 4px；左上工具名+秒。机械层已扫。审美 / U1–U12 **未勾 PASS**。本 Slice **不标 COMPLETE**。

### R11 — 主菜单截图两件事（2026-08-15）· 字裁切 + 三组结构

人带回主菜单截图。两件事分开路由，**不标 COMPLETE**。审美 / U1–U12 **未勾 PASS**。

| # | 人的原话 | 路由 | 结论 |
| - | -------- | ---- | ---- |
| 1 | 每行文字最上沿像被吃掉 | Bug：art 最短核「不是故障审美」→ code 只加 Text padding | **是 bug，不是设计** |
| 2 | 元素关系、主次不清楚 | UX：design 锁三组 → art 给 px → code 改布局/游标 | 三组身份 / 纪录读数 / 动作 |

**问题 1：** 空场大字没有扫描/玻璃；Phaser Text 无 padding + 全局 `pixelArt` 把 CJK 上沿裁掉。禁止关全局 `pixelArt`。padding：28px top 6；16/13/12px top 4。含 boot「载入」。

**问题 2（DEC-052）：** 身份 = `存续` + 副题；纪录读数 = 潮汐/出击/稳定度（确认态改警告）；动作 = 可点项。摘要贴动作正上方。游标只属动作行：未选中无 `>`，已选中 `▸`。读数一律 12 暗灰；动作 16。组间空 32–40，组内 4–8。不加框/线。文案词仍 DEC-050。

**请人看：** 字形最上沿是否完整；有纪录 / 覆盖 / 无纪录三帧是否读成三块（读数不是按钮，屏上只有一枚 `▸`）。

机械层已扫。本 Slice **不标 COMPLETE**。

### R12 — 交互面板底栏快捷键（2026-08-16）· U7 提示=绑定

人要求审查每个交互 panel 底栏快捷键：提示与内容不符、提示了但不生效。词跟已锁：注入 / 刻入 / 合上 / 踏入 / 离开。禁止购买 / 确认 / OK / Continue。

**规则（Director 按人给的默认锁，未另拆键、未等人）：** Enter 在不同焦点区含义不同 → 底栏随焦点改写动词。踏入面板鼠标仍要能点「踏入」：Enter 当前不是踏入时，底栏留无键丝印的可点「踏入」。空槽 / 不能装填不印 Enter。两键同一动作写成一行 `Enter / Esc 合上`（或离开），不重复两行。

**落地：** code 改底栏 HTML + 随焦点重画。绑定本身大多已对；修的是谎报与走近装置时丢掉的 Tab/Esc 提示。未改 CRT / 玩法 / 新皮。未新 DEC（U7 已有合同）。`npm run typecheck` 退出码 0。

| 表面 | 改前 | 改后 | 键 |
| ---- | ---- | ---- | -- |
| 分配 | 已对齐 | 未动 | ←→ / Shift+←→ / Home End / Enter 注入 / Esc 离开 均生效 |
| 供奉 | 永远 Enter 装填/取下；空槽与离开区谎报 | 随区：取下 / 装填 / `Enter / Esc 离开`；空槽不印 Enter | Tab / 箭头 / Enter / Esc 生效 |
| 踏入 | 两个 Enter（装/卸/确认 + 踏入）；确认是禁词 | 随区改写 Enter；非踏入焦点时无键「踏入」仍可点 | Tab / 箭头 / Enter / Esc / 踏入 click 生效 |
| 存续 | 已对齐 | 未动 | 箭头浏览；Tab/Esc 合上 生效 |
| 蜕变 | 底栏已是刻入 | 只改注释购买→刻入 | ↑↓ / Enter 刻入 / Esc 离开 生效 |
| 冲击结算 | Enter 与 Esc 两行都写合上 | 一行 `Enter / Esc 合上` | 两键 + click 均 dismiss |
| 暂停 | Enter 无动词；覆盖态也写 Esc 合上 | 根：Enter=当前项，选中合上则 `Enter / Esc 合上`；覆盖：Esc 只印键、不合上 | ↑↓ / Enter / Esc 生效 |
| 裂隙结算 | `按 R …` 用 `.hint` | `.key-hint-bar`：`R` 返回净化点 / 重新出击 | scene `keydown-R` → `restart()` |
| 净化点底栏 | 走近装置丢掉 Tab/Esc | `[E]` 仍在，后面补 `Tab:存续报告 │ Esc:记录` | E / Tab / Esc 生效 |
| 主菜单 | 无底栏 | 未加条 | ↑↓ Enter Space Esc 已绑 |
| 裂隙 HUD | `按 E 撤离` | `[E] 撤离`；工具槽 `[Q]/[F]/[G]` 未动 | E 撤离、工具键与常量一致 |

### R13 — 关闭（2026-08-16）· 人指令完成当前 Slice

人两条指令：**(1) Slice 6/8 对调；(2) 完成当前 Slice。**

- **DEC-053**：Slice 6 = 程序化地图 + 撤离点多样性；Slice 8 = 第二敌人（含被发现指示）。7 / 9 / 10 不变。
- **DEC-054**：Slice 5.5 标 COMPLETE。验证方式是打磨 Slice 的「改一版 → 人看 → 再改」；以人要求收尾为终审信号。agent 不代写好看 / 像游戏 / PASS。
- 装配纠结：机制上不是二选一；5.5 只讲清事实。
- 被发现指示仍不做，留给 Slice 8。
- 收尾四项见文首「收尾四项登记」。下一手 Slice 6 **未开工**。

`npm run typecheck` 退出码 0（2026-08-16 收尾时重跑）。

### 收尾 U1–U12（机械层登记；审美不代勾）

HOW：各 UI 批次已走 `.cursor/skills/in-game-ux/SKILL.md`。清单是闸门，不是好看证明。人 2026-08-16 要求完成 = 终审信号。

| # | 机械层（R12 之后的 src） | 审美 / 读作游戏 |
| - | ------------------------ | --------------- |
| U1 | 玩家 HUD / 面板 / toast / 小地图 / 场景过渡 / 失焦挂 `#dom-ui-root`。debug 仍挂 `#game-container`（非玩家 UI）。主菜单 Phaser Text（载体 C）。 | 人收尾；不代勾 |
| U2 | 无圆角卡片堆；墙机无 `box-shadow`。共享层仍有 `:hover`（检视主路径是选中即填）。 | 人收尾；不代勾 |
| U3 | 主文字锁色板。loadout / 裂隙结算档位色 `#1a6b5c` 对比度债未全清（backlog）。 | 人收尾；不代勾 |
| U4 | DOM 玩家层静态 ≥12px。标题可用 ≥16。 | 人收尾；不代勾 |
| U5 | 名称走 CSV。玩家表名「完整度」非 HP。部分「污染物 / 污染体」与软件词债未全清。 | 人收尾；不代勾 |
| U6 | 进行中角锚；墙机 680×468 时游戏暂停；Esc / 裂隙结算居中小读出符合 DEC-049。 | 人收尾；不代勾 |
| U7 | R12 底栏提示 = 绑定。玩家面板无原生 `title` tooltip。 | 人收尾；不代勾 |
| U8 | 分配「还差」/ 蜕变上限 / 空库存有字。耗尽槽靠余量点 + 暗字。 | 人收尾；不代勾 |
| U9 | S2 表名/值/档位分节点；裂隙完整度 = 标签+条+数字；小地图标记异形。 | 人收尾；不代勾 |
| U10 | Channel B toast 队列最多 2 条、默认 2s；生效中行名+剩余秒。 | 人收尾；不代勾 |
| U11 | 六块墙机 `createCrtPanel`；裂隙 `.device-plate`；Esc / 结算小读出是 DEC-049，不是漏套工厂。 | 人收尾；不代勾 |
| U12 | 规格层参考已锁（见 Kit / `ux-references.md`）。与参考并排是否违和只能人看。 | 人收尾；不代勾 |
