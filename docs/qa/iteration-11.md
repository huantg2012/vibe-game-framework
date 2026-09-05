---
status: DRAFT
created-by: qa agent（迭代 11 I11-QA）
created-when: 2026-09-05
note: 净化点 UX 收口（DEC-118）机械对照。好看 / 读作游戏 / 与已锁装置同一世界不代勾。不标迭代 11 COMPLETE。不标迭代 5 COMPLETE。不要开 I5-C。不要说成 Slice 11。
---

# QA：迭代 11（净化点 UX 收口）

日期：2026-09-05  
合同：`docs/tasks/iteration-11.md` Task I11-QA（DEC-118）  
规则：`docs/specs/system-purification-impact.md` UX 节（I11-IA；`interface-changed: false`）  
Kit：`docs/design-notes/ui-art-overhaul.md` §A8（含 §A8.5 三问预答）  
HOW：`.cursor/skills/in-game-ux/SKILL.md` + `exemplars.md` + `like-a-game.md`  
闸门清单：`docs/specs/_template-ui.md` 末尾 U1–U12  
代码：HEAD `99f73e4` + 工作区 I11-B3 / B4a / B4b / B4c。本报告核工作区磁盘。

**已交对照对象：** I11-A、I11-S、I11-B3、I11-IA、I11-B4a、I11-B4b、I11-B4c。I11-K **未申请 / 未做**。  
**不许代勾：** 审美、读作游戏 UI、与场上已锁装置同一世界。证据存在 ≠ 三问过关。画面等人终审（合同波 8）。

三问已作答（证据：Kit §A8.5、IA UX 节、B4a/B4b 最短核、见第 7 节）；审美 / 读作游戏 / 风格适配**待人终审**。

---

## 闸门实测（工作区，2026-09-05）

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | **绿**（exit 0，无输出） |
| `npm test` | N/A（`package.json` 无 `test` 脚本） |
| 未跑的 `check:*` / `art:verify` / 甲闸门 | 与本包改动面（净化点 HUD / 提示条 / 墙机信息架构）无共享产物，未列入本批闸门 |

连续 2 次不过机器闸门 → **N/A**（本批闸门一次过）。qa 未改 `src/**`。

---

## 核对范围 1–8（给 Director）

| # | 项 | 结论 |
| - | -- | ---- |
| 1 | 红线：模块 HP / 加厚三档 / 潮汐公式 / `upgrades.csv` / 出击修正公式；已锁世界贴图；`form-renderers/`、`bakeGround`、`data/*.csv` | **PASS** |
| 2 | 挂载根 `#dom-ui-root`；禁止 `document.body` + `position:fixed` 另起根 | **PASS** |
| 3 | I11-K 未申请；`.game-panel` 玻璃 / 扫描线 / 字色未改；只追加 Tab / 焦点 / 空状态类 | **PASS**（观察：多了合同未点名的 `.crt-empty` 包装，见偏差 #1） |
| 4 | P5/P6：HUD 容器+分组+层级；提示条容器、两态；第二行未编造机制没有的状态 | **PASS** |
| 5 | P7：存续 4 顶 Tab；分配单一 `.crt-focus`；出击预估只译三项；无「生存」评分；空状态三件套；同族无第四套布局 | **PASS** |
| 6 | 术语：表名 / 数值 / 档位分节点 | **PASS**（两处粘词记偏差 #2 / #5，不抬成该项 FAIL） |
| 7 | 三问书面证据是否存在 | **PASS**（存在 ≠ 过关；不代勾） |
| 8 | U1–U12 可静态项 | **PASS**（能从代码勾的已勾；不能从代码勾的标「待人终审」） |

**阻断 bug：** 无阻断 bug。

---

## 1. 红线

基线：`git diff` 相对 HEAD `99f73e4`（工作区未提交的本包 + 同树其它未提交项）。公式与 CSV 以「是否出现在游戏逻辑 diff」为准。

| # | 规格/合同引用 | 证据 | 结论 |
| - | ------------- | ---- | ---- |
| 1.1 | 模块 HP 初值 / 基准上限 | `MODULE_INITIAL_HP: 70`、`MODULE_BASE_MAX_HP: 100`（`constants.ts:303–307`）。`git diff HEAD -- src/config/constants.ts` 为空 | **PASS** |
| 1.2 | 加厚三档与费用 | `MODULE_MAX_HP_PER_TIER: 15`、`MODULE_MAX_HP_TIERS: 3`、`MODULE_MAX_HP_COST: [12, 20, 32]`（`constants.ts:309–313`）。constants diff 空 | **PASS** |
| 1.3 | 修复量 / 效果封顶 / 起始混乱硬顶 | `REPAIR_PER_KINDLING: 4`、`MAX_CORE_REDUCTION: 0.30`、`MAX_STORAGE_BONUS: 0.50`、`CHAOS_HARD_START: 50`（`constants.ts:317–329`）。diff 空 | **PASS** |
| 1.4 | `upgrades.csv` / `data/*.csv` | `git diff --stat HEAD -- data/` 空 | **PASS** |
| 1.5 | 出击修正公式 | `game-state.ts` / `impact-system.ts` / `tide-system.ts` 相对 HEAD **diff 为空**。`getSortieModifiers()` 仍只返回 `chaosRateModifier` / `kindlingValueModifier` / `startingChaos`（`game-state.ts:310–316`）。分配预览走 `computeStartingChaos` + 与 `getModuleEffect` 同构的本地函数，不改存档 hp（`allocation-panel.ts:183–230`） | **PASS** |
| 1.6 | `src/entities/form-renderers/` | `git diff --stat HEAD -- src/entities/form-renderers/` 空 | **PASS** |
| 1.7 | 裂隙 `bakeGround` | `git diff --stat HEAD -- src/generation/preview-paint.ts` 空。本包 DOM 文件不 import `bakeGround` | **PASS** |
| 1.8 | 已锁世界贴图（核心 v6-B / 净化器 B1 / 储藏 C1 / 入口卡 5 / 供奉台卡 I / 培养藏卡 A） | 已跟踪的 `public/assets/sprites/modules/*` 相对 HEAD **diff 为空**。本包 QA **不核**世界贴图像素 | **PASS**（工作区另有未跟踪的培养藏抽卡图，见观察项） |

`src/scenes/purification-scene.ts` 有 diff（培养藏卡 A 接线、加厚世界桩拆除、以及本包需要的 `lastOverlapType` → 存续报告）。按合同只核 HUD/面板接线，不把世界外形判进本包红线。接线见第 2、4 节。

---

## 2. 挂载根

权威：`docs/architecture.md` overlay 根 = `#dom-ui-root`。禁止 HUD / 面板自己 `document.body` + `position:fixed` 另起根。`getDomUiRoot()` 把根建在 `body` 上并 `position:fixed`（`panel-styles.ts:958–977`）是**已声明的那一个根**，不是另起。

| # | 表面 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 2.1 | `#purif-hud` / `#purif-prompt` | `className = 'device-plate'`；`position:absolute`；`getDomUiRoot().appendChild`（`purification-hud.ts:168–215`） | **PASS** |
| 2.2 | 存续 / 分配 / 蜕变 / 供奉 / 出击装配 / 冲击结算 | 一律 `createCrtPanel` → `game-panel crt-stack`；backdrop + 面板 `appendChild` 到 `getDomUiRoot()`。backdrop CSS 是根内 `position:absolute; inset:0`（`panel-styles.ts:526–531`），不是第二套 fixed 根 | **PASS** |
| 2.3 | 本包面板 / HUD 无 `document.body.appendChild` 当 overlay | grep 上述文件：只有 `getDomUiRoot()`；HUD 关键帧 style 挂 `document.head`（`purification-hud.ts:308–313`），不是 overlay 根 | **PASS** |

---

## 3. I11-K / `panel-styles.ts`

合同：I11-S **不申请** I11-K。禁止改 `.game-panel` 玻璃 / `::before` 暗角 / `::after` 扫描线 / `.game-panel` 字色。允许追加 `.crt-tabs` / `.crt-tab` / `.crt-focus` / `.crt-empty-*`。

| # | 项 | 证据 | 结论 |
| - | -- | ---- | ---- |
| 3.1 | I11-K 未做 | 合同波 1b「本波跳过」。无单独压对比批次改 CRT 基元 | **PASS** |
| 3.2 | 玻璃 / 扫描线 / 字色 | `git diff HEAD -- src/ui/dom/panel-styles.ts` = **+69 行、只追加**。`.game-panel` `background-color` / `::before` / `::after` / `color: #8a8f96` 规则体无 hunk | **PASS** |
| 3.3 | 追加类与 Kit / 最短核一致 | `.crt-tabs` / `.crt-tab` / `.crt-tab.is-selected` / `.crt-focus` / `.crt-empty-mark` / `.crt-empty-why` / `.crt-empty-next` / `.empty-key`（`panel-styles.ts:816–883`）。色与尺抄 B4a 最短核 | **PASS** |
| 3.4 | `.scroll-area` 全局规则 | 未改（合同禁止叠双线时改全局 `.scroll-area`） | **PASS** |
| 3.5 | 暂停菜单 / 裂隙 HUD | `pause-menu.ts` / `rift-hud.ts` 相对 HEAD diff 空 | **PASS** |

额外 `.crt-empty` 包装类（`panel-styles.ts:853–858`）不在合同点名四组里，见偏差 #1。不是改玻璃，不抬成 3 FAIL。

---

## 4. P5 HUD / P6 提示条

实现：`src/ui/dom/purification-hud.ts`。场景：`purificationHud.create/refresh/updatePrompt/setPromptVisible`（`purification-scene.ts:528–627`）。

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 4.1 | 容器；不套 `.game-panel` | `#purif-hud` class `device-plate`（`173`）。直角边 `1px #2a2d32`，垫 `8px 12px`，背景 `rgba(15,17,20,0.82)`，`top:10px; right:12px`（`174–186`） | **PASS** |
| 4.2 | 资源组 / 状态组 + 层级 | 上行只薪柴 16px `#c4873a`；1px `#2a2d32` 分隔；下行潮汐 + 下次归来（+ 可选再下一轮）（`124–132, 259–304`） | **PASS** |
| 4.3 | 「下次归来」默认弱，靠近入口满显 | 非 `type === 'rift'`：整槽 12px `#8a8f96`、无脉动；靠近裂隙才目标色 / 档位色 / 极端 `hud-critical-pulse`（`267–291`） | **PASS** |
| 4.4 | 不画条、不画 ◇◈▣、不加回稳定度 | 文件无条、无那些符号、无「稳定度」槽 | **PASS** |
| 4.5 | 提示条容器 + 两态 | `#purif-prompt` class `device-plate`；无目标 opacity `0.5` 一行 Tab/Esc；靠近 `1.0`；`transition:opacity 150ms ease-out`（`191–216, 159–166, 322–347`） | **PASS** |
| 4.6 | 第一行 `[E]` + 动作名；删几何符 | `ACTION_LABEL`：`核心/储藏/净化器/踏入裂隙/供奉/蜕变`（`56–63, 329–332`） | **PASS** |
| 4.7 | 第二行预览不编造；槽空不画**预览节点**；禁止「生存」 | `buildPromptPreview`：模块走 `moduleData` hp/`maxHp`（+ 核心/储藏的 `effectPct`）；裂隙走 `getCycle()` + 潮汐 `currentIntensity`；无 `moduleData` 返回 `null`（只省略左侧预览，不拆第二行）；注释与实现无「生存」（`345–384`） | **PASS** |
| 4.8 / H8 | 靠近一律两行；Tab/Esc 在第二行最右 | `buildNearPrompt`（`328–342`）：`row1` + `row2` 无早退。`preview ?? ''` 左侧可空（`338`）；右侧恒 `buildChromeHints()`（`339`）。D1 热修后闭合 | **PASS**（已热修） |

`effectPct` 来自既有 `PurificationModule.getEffectPct()`（核心减免 / 储藏加成的百分数），不是新评分。储藏提示条写成 `+N%`、墙机出击预估写成 `x1.xx`，译法不统一，见偏差 #3。

---

## 5. P7 面板信息架构

权威：IA UX 节同族表 + B4a/B4b 最短核。

### 5.1 存续报告（`status-panel.ts`）

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 5.1.1 | 标题「存续报告」；4 顶 Tab `装置/残渣/潮汐/蜕变`；每次打开默认装置 | `TABS`（`33–34`）；`open()` 里 `activeTab = 0`（`72`）；`tabsHtml`（`220–226`） | **PASS** |
| 5.1.2 | 无第五项、无左侧栏、无审查图项名 | grep 无「全局状态 / 成长升级 / 工具清单」 | **PASS** |
| 5.1.3 | 切页 `[` `]`；`Tab`/`Esc` 合上 | `onKeyDown`（`123–142`）；键印（`209–213`） | **PASS** |
| 5.1.4 | 身份带钉顶；走近亮 / 只是看三格都暗 | `identityBandHtml({ activeId: approachedModule, selectedId, clickable: true })`（`202–206`）。`open(..., nearestOverlap)`；场景传入 `this.lastOverlapType`（`purification-scene.ts:308, 624, 917`） | **PASS** |
| 5.1.5 | `装置` 详情只讲选中一台；出击预估只读三项 | `deviceDetailHtml` 用当前 `getSortieModifiers()`；三节点 `混乱增速` / `薪柴价值` / `起始混乱`（`235–284`） | **PASS** |
| 5.1.6 | 残渣分组 `残渣/工具/破碎`；空 = 三件套 | `residueDetailHtml`（`308–353`）；空文案 `残渣 0` / `工具 0` / `[E] 踏入裂隙`（`320`） | **PASS** |
| 5.1.7 | 潮汐三节点 + 稳定度；无进度条；无「满潮」 | `tideDetailHtml`（`376–392`）；相位 `涨潮/潮峰/退潮` | **PASS** |
| 5.1.8 | 蜕变：加厚行 + 已刻入；六卡未刻入走空状态 | `growthDetailHtml`（`395–429`）；空 `刻入 0` / `全部上限` + maxHp / `[E] 蜕变` | **PASS** |
| 5.1.9 | 无格不挂 `inspect-dock` | 残渣/蜕变仅 `inspectable.length > 0` / `inscribed.length > 0` 时挂（`350–352, 426–428`） | **PASS** |
| 5.1.10 | 无 `hoverIndex` 双通道 | 鼠标进入可检视格写入同一 `cursorIndex` 再 `render`（`479–491`） | **PASS** |
| 5.1.11 | 本墙机不给身份带/Tab 套 `.crt-focus` | 文件无 `.crt-focus` | **PASS** |

### 5.2 分配（`allocation-panel.ts`）

| # | 规则 | 证据 | 结论 |
| - | ---- | ---- | ---- |
| 5.2.1 | 标题「分配」；无顶 Tab；无空状态三件套 | 标题（`345`）；无 `.crt-tabs` / `.crt-empty` | **PASS** |
| 5.2.2 | 身份带只读；点另两台不得换 `moduleId` | `identityBandHtml({ activeId: type })` 默认 `clickable` 假；无 `data-module-id`、无 `cursor:pointer` | **PASS** |
| 5.2.3 | 唯一 `.crt-focus` = 投入行 | 全 `src/ui/dom` 仅此处一处 class `crt-focus`（`367–372`）。行内「投入」+ 16px `#c4873a` 整数 + `←` `→` | **PASS** |
| 5.2.4 | 出击预估三项；预览注入后；0 = 当前值 | `previewSortieModifiers`：`selectedAmount === 0` → `getSortieModifiers()`；否则只替换打开台 hp（`207–230`）。槽 `sortiePreviewHtml`（`299–314`） | **PASS** |
| 5.2.5 | 禁止「生存」徽章 / 第四项 | grep 分配文件无「生存」。机会成本在框外（`260–296, 384`） | **PASS** |
| 5.2.6 | 完整度表名带限定；`→` 是分隔符 | `核心完整度` / `储藏完整度` / `净化器完整度`（`40–44, 351`）；效果行当前 → 注入后（`361–365`） | **PASS** |
| 5.2.7 | 键：`←→` / Shift / Home / End / Enter 注入 / Esc | `onKeyDown`（`120–162`）；数量 0 不关（`165–176`） | **PASS** |

### 5.3 同族收口（B4c）

IA 竖切表：蜕变 / 供奉 / 出击装配必须身份带、禁止顶 Tab；冲击结算禁止身份带 / Tab / `.crt-focus` / 空状态 / 出击预估。

| 墙机 | 身份带 | 顶 Tab | `.crt-focus` | 出击预估 | 空状态 | 底键印 | 结论 |
| ---- | ------ | ------ | ------------ | -------- | ------ | ------ | ---- |
| 蜕变 `growth-panel.ts` | `activeId: null`（`218`） | 无 | 无 | 无 | 卡栅不走三件套 | 有 | **PASS** |
| 供奉 `defense-panel.ts` | `activeId: null`（`218`） | 无 | 无 | 无 | 库存空走三件套（`280–293`） | 有 | **PASS** |
| 出击装配 `loadout-panel.ts` | `activeId: null`（`230`） | 无 | 无 | 只读三项 + 玩家「完整度」（`490–510`）；表名「薪柴价值」 | 库存空走三件套（`335–344`） | 有 | **PASS** |
| 冲击结算 `impact-result-panel.ts` | 无 | 无 | 无 | 无 | 无 | Enter/Esc 合上 | **PASS** |

无第四套机身：六块仍 `createCrtPanel` 680×468。冲击结算保持结果屏骨架（标题 + 基础/实际 + 逐槽 + 潮汐/稳定度并入），未改成总览墙机。

供奉空：`残渣 0` + `供奉 filled / total`；全空才 `[E] 踏入裂隙`（`280–293`）。出击装配空：`工具 0` + `残渣` 件数 + `[Enter] 踏入`（`335–344`）。与 IA 表一致。Enter 在空库时是否立刻踏入，见偏差 #4。

---

## 6. 术语分开（U5 / U9）

| # | 项 | 结论 |
| - | -- | ---- |
| 6.1 | 可见软件词「提交 / 确认 / 物品栏 / OK」 | grep 本包面板无这些可见词。分配动作为「注入」。残渣分组是「破碎」不是「已碎/物品栏」 | **PASS** |
| 6.2 | 模块完整度带限定；玩家「完整度」另起 | 存续 / 分配用 `核心完整度` 等；玩家槽表名「完整度」（`status-panel.ts:253–256`；`loadout-panel.ts:494–496`） | **PASS** |
| 6.3 | 出击预估三节点分开展示 | 存续 / 分配 / 出击装配均表名 span + 数值 span | **PASS** |
| 6.4 | 空状态两行 = 表名节点 + 数值节点 | `emptyStateHtml` 两个 `.crt-empty-why` 各两个 span（`status-panel.ts:443–448`） | **PASS** |
| 6.5 | 粘词 | 分配注记 `1薪柴=N完整度` 为 B4b 最短核明文允许的 12px 注记。冲击结算相位句 `第N潮汐`、分配「已全部购满」见偏差 | 见 #2 / #5 |

---

## 7. 三问书面证据（存在 ≠ 过关）

| 来源 | 问 1 好看 | 问 2 读作游戏 UI | 问 3 同一世界 |
| ---- | --------- | ---------------- | ------------- |
| skill `SKILL.md` | HOW 操作定义 | HOW + `like-a-game.md` | HOW |
| Kit §A8.5 | 有预答 + 证据帧 ①–⑦ | 有 | 有 |
| IA UX 节「三问书面预答」 | 指向 §A8.5，不代勾 | 有结构预答 | 指向 §A8.5 |
| 合同附录 B4a §5 / B4b §6 | 有 | 有 | 有 |
| I11-B3 文件头 + Kit | HUD/提示条对照帧写在 §A8.5 | 两态/预览写在 skill 构造法 | 板 vs 墙机写在 §A8.5 |

**结论：证据存在 = PASS。三问是否过关 = 待人终审。qa 不代勾好看 / 像游戏 / 与装置同一世界。**

---

## 游戏内 UI 验收清单（U1–U12）

表面：净化点 HUD、底栏提示条、存续报告、分配、蜕变、供奉、出击装配、冲击结算。权威清单 `docs/specs/_template-ui.md`。  
**可静态项从代码勾；载体感 / 后台气味的最终判断 / 400ms 可辨 / 参考贴合度标待人终审。不许代勾好看 / 像游戏。**

| 项 | 机械结论 | 证据 |
| -- | -------- | ---- |
| U1 载体 / 挂载根 | 机械通过。HUD/提示条 = 载体 A（`.device-plate`，不套墙机类名）；打开的墙机 = 载体 B（`createCrtPanel` 680×468）。一律 `#dom-ui-root`。角锚 `position:absolute` 跟 overlay 根，不绑 `scrollFactor(0)`。载体**看起来**像装置还是软件窗 → **待人终审** | 第 2 节；`architecture.md` overlay 段 |
| U2 后台管理气味 | 机械未踩圆角卡堆 / 投影 / 渐变按钮 / 左侧分类导航 / 青色块填 Tab。`.crt-tab` 静默无底，已选中下沿 1px `#5a5f66`。过本条 ≠ 像游戏 → **待人终审** | `panel-styles.ts:817–845`；存续无左栏 |
| U3 色彩 | 机械通过。本包 hex 落在 Kit 已锁档（`#8a8f96` / `#c8cdd4` / `#c4873a` / `#1aad96` / `#2a2d32` / `#5a5f66` / `#3a3d44` / `#cc3333`）。未新造 `#bfc6ce` / `#ffffff` 正文 | HUD `COL`；身份带 `NAME_ACTIVE` / `NUM_ACTIVE` |
| U4 排版 | 机械通过。字号 12 / 13 / 16；Courier New。薪柴与投入整数 16px | HUD `16`；分配投入 `16px`；Kit §A8 |
| U5 术语 | 机械大体通过。「存续报告 / 注入 / 加厚 / 残渣 / 破碎 / 完整度 / 起始混乱」在 `world.md` 术语表。可见层无提交/确认/物品栏。偏差：「已全部购满」 | 第 6 节；偏差 #2 |
| U6 不遮挡 | 机械通过。HUD 贴顶靠右；提示条底中 `max-width:420px`；墙机 `top:52px; left:140px` 680×468，不占画面中心 ±120×80 | `.game-panel` CSS；HUD/prompt 内联 |
| U7 输入 | 机械通过。提示键 = 绑定：E 走近、Tab 开合存续、`[` `]` 切页、分配 `←→`/Enter/Esc。检视不依赖「只有 hover 才有层」——方向键同一游标。出击装配空状态文案与默认焦点，见偏差 #4 | `status-panel.ts:123–161`；`allocation-panel.ts:120–162` |
| U8 状态语义 | 机械通过。蜕变卡不可用写 `还差 N` / `已至上限`（`growth-panel.ts:195–201`）。三态词独立节点。提示条无目标是半透明，不是把字改成不可读灰 | IA U8；HUD opacity 两态 |
| U9 表名/档位/第二通道 | 机械大体通过。分节点是主路径。余光：薪柴靠 16px 暖色位置，不靠色盲单通道。粘词见偏差 #5 | 第 6 节 |
| U10 反馈不静默 | 机械：提示条 150ms；投入改数立刻 `rerender`；切 Tab 立刻 `render`。400ms 内是否「可辨」→ **待人终审** | HUD `transition`；分配 `rerender` |
| U11 一致性 | 机械通过。墙机共用 `createCrtPanel` / `.crt-stack` / `.key-hint-bar` / 身份带模块。HUD 与裂隙随身罩同 `.device-plate`。追加类进 `panel-styles.ts`，不是第二套设计系统。包装类 `.crt-empty` 见偏差 #1 | `module-identity-strip.ts`；第 3 节 |
| U12 参考锚点 | 机械：IA / Kit 写明 FTL（一槽表名+数）/ Signalis（设备打字）/ Barotrauma（走近才满显）。并排是否违和 → **待人终审** | spec UX「参考锚点」；Kit §A8.0 |

---

## 回归（范围内）

`interfaces-with`：本批 `interface-changed: false`。范围内 = 本包改动的 DOM 表面 + 场景 HUD 接线。

| 系统 | 状态 | 备注 |
| ---- | ---- | ---- |
| GameState / 出击修正 | 正常 | `getSortieModifiers()` 未改；分配只本地预览 |
| 潮汐 / 冲击 / 加厚 | 正常 | constants / tide / impact diff 空；加厚仍在蜕变第七张 |
| 裂隙 HUD / 暂停菜单 | 正常 | 未改文件；未改 CRT 基元 |
| 裂隙生成 / 连通 / 外形基因谱 | 正常 | `form-renderers/`、`bakeGround`、CSV 未碰 |
| PurificationScene HUD 接线 | 正常 | `updatePrompt` / `lastOverlapType` / 面板开时藏提示条 |

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| 1 | 偏差 | Low | `panel-styles.ts` 在合同点名的 `.crt-empty-*` 之外追加了 `.crt-empty` 横排包装。未改玻璃/扫描线/字色 | `panel-styles.ts:853–858` | 合同 I11-B4：「只允许追加 `.crt-tabs` / `.crt-tab` / `.crt-focus` / `.crt-empty-*`」 |
| 2 | 偏差 | Low | 分配机会成本在六卡均满时写「已全部购满」。可见语义更接近商店，不像已锁的 `已至上限` | `allocation-panel.ts:281` | UX U8 / `world.md` 加厚禁「购买」；状态词锁 `还差 N` / `已至上限` |
| 3 | 偏差 | Low | 提示条储藏效果用 `+N%`（`getEffectPct`），墙机「薪柴价值」用 `x1.xx`。同源机制、两套译法 | `purification-hud.ts:378–381` vs `allocation-panel.ts:235` | IA 映射表：薪柴价值 = `x` + `toFixed(2)`。A8.2 允许 `effectPct` 作预览来源，故不抬成编造状态 |
| 4 | 偏差 | Low | 出击装配库存空时三件套写 `[Enter] 踏入`，但 `open()` 默认焦点在槽区；空库时 Enter 不会立刻踏入，需 `Tab` 切到动作区 | `loadout-panel.ts:55–62, 190–206, 335–344` | IA 空状态：「键印下一步是本墙机已绑定键」；`[Enter] 踏入` |
| 5 | 偏差 | Low | 冲击结算并入的潮汐句仍有 `第${n}潮汐` 粘词（表名已是「潮汐」） | `impact-result-panel.ts:344–352, 256` | U9 表名/数值/档位分开展示 |

| D1 | 偏差 | Medium | **已热修（2026-09-05）。** 原：走近供奉/培养藏时 `preview === null` 整段不画第二行，Tab/Esc 消失。现：靠近一律 `row1`+`row2`；预览空则左侧不放节点，右侧仍 Tab/Esc | `purification-hud.ts:328–342`（`buildNearPrompt`）；预览空约定 `345–348` | Kit §A8.2：靠近两行，Tab/Esc 第二行最右 |

无 Critical / High。D1 已热修闭合。无确定的实现 Bug（崩溃、错公式、错挂载、发明「生存」评分、改 HP/CSV）。

---

## 通过的检查

- 红线：HP / 加厚三档 / 潮汐与出击公式 / CSV / `form-renderers/` / `bakeGround` / 已跟踪的已锁贴图 diff 空
- HUD/提示条挂 `#dom-ui-root`；墙机同根；无第二套 `body`+`fixed` overlay
- I11-K 未申请；`.game-panel` 玻璃/扫描线/字色未改
- P5：容器、薪柴上行、状态下行、下次归来两态
- P6：容器、0.5/1.0 + 150ms、第二行合法来源、无「生存」
- 存续 4 顶 Tab、默认装置、`[` `]` 切页、身份带走近/只是看
- 分配无 Tab、单一投入焦点、预览三项、身份带不换台
- 空状态三件套文案锁表；蜕变/供奉/出击装配/冲击结算同族竖切
- 三问书面证据齐；qa 不代勾
- `npx tsc --noEmit` 绿

---

## 观察项（非阻断；含明确不进本包的 P3/P4/P8）

- **P3 地面 / P4 外部 / P8 暖光：** 合同不进本包。本对照**没有**发现必须重开这三项才能交人终审的实现错误。不发明新问题去重开。
- **工作区混有培养藏抽卡资源：** 未跟踪 `growth-a/b/c-sheet.png`、`src/scenes/growth-console-visual.ts`，以及 `purification-scene.ts` 里卡 A 接线。这不是 I11 UX 范围；本报告不核世界贴图，也不据此判红线 FAIL。
- **供奉 / 蜕变走近时提示条第二行：** D1 已热修。无 `moduleData` 时左侧不放预览（仍不编造），右侧仍 Tab/Esc（`328–342`）。人终审问 2（不打开能否决定要不要走过去）仍可能点「没有状态预览」——那是体验判断，不是本包机械 FAIL。
- **证据帧 ①–⑦**（Kit §A8.5）要人在 `#purif` 实地看。qa 不代看画面。
- 活指针仍在迭代 5。本包未开 I5-C。本报告不标迭代 5 / 迭代 11 COMPLETE。

---

## 总结

**机械对照范围内：1–8 均可交人终审。无阻断 FAIL。`tsc` 绿。不标迭代 11 COMPLETE。**

建议：人按合同四问看 `#purif`（右上还像不像 debug；底栏像不像能按 E；存续/分配还像不像平铺查询；漏景里的装置与这块屏是否同一世界）。PASS 后由 Director 收尾四项并改 `current-iteration.md`。偏差 #1–#5 不构成结案阻断，可随热修或不管。

优先修复：D1 已热修闭合。其余 #1–#5 不构成结案阻断。
