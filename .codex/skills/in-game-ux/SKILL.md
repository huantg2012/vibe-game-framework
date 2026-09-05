---
name: in-game-ux
description: >-
  Teaches HOW to make this game's HUD, DOM panels, overlays, and menus pass three
  result tests: look good, read as game UI, and sit in the same world as locked
  devices. Use when creating or editing HUD, DOM panels, CSS, overlays, menus,
  inspect UI, toasts, or when the user mentions 审美, UX, 不像游戏, 游戏界面,
  in-game UI, or admin panel.
---

# In-game UX：三问结果

人只看三件事。勾 `U1–U12`、写「机械层已扫」、CRT 扫描线开着——都不算交付。

世界内像素实体、图集、程序像素走 `.cursor/skills/pixel-models/SKILL.md`。本文件只管 HUD / DOM / 蒙层 / 菜单 / 提示条。

自定义 agent **不会**自动加载 skill。被派到 UI 任务时必须显式 Read 本文件与 [exemplars.md](exemplars.md)；Director 的 Task Brief 必须写明这一步。

对照：[like-a-game.md](like-a-game.md)（游戏菜单 vs 网页）· [aesthetics.md](aesthetics.md)（显示器感 vs AI 味）· [exemplars.md](exemplars.md)（本游戏已发生的失败）。

## 三问（交付必须书面作答；答「机械过了」不算）

1. **好不好看。** 对得起 `docs/art-direction.md` §6，并且并排对照审查成品图后不掉档。人说丑就是不合格。
2. **读不读作游戏 UI。** 主-从、单一焦点、键鼠同一通道。不是后台、不是 debug overlay、不是网页把查询结果平铺。
3. **跟场上已锁装置并排是否同一世界。** 打开面板时，四周漏出的核心 / 净化器 / 培养藏 / 供奉台 / 入口与这块屏必须像同一套设备，不能像另一套软件盖上去。

审美、读作游戏、风格适配都由**人终审**。agent 不许自称过关、像游戏、PASS。

## 为什么旧 HOW 失败

旧 skill 把 HOW 写成载体 A·B·C + P0–P2 + U1–U12 闸门。agent 勾完仍交出 **CRT 管理后台**：磷光屏、扫描线、键印都在，信息组织是网页，HUD 是散列 debug 字。

dogfood 证据：

- `guides/99-review.md` FV-01：框架把游戏界面当 web 应用描述。
- `docs/art/review-2026-08-28/report-purification.html` §5–§6（合入 `f3d2f93`）：**载体风格选对了**（磷光屏 / 扫描线 / 四周漏景 / 键印）。问题在信息组织，以及纯白字 + 近黑底 + 高饱和强调的「AI 生成界面」味。

本 skill 的 HOW = 三问怎么验 + 审查收成的构造法。U1–U12 仍是闸门，在三问之后跑，不是开工仪式。

## 本游戏已锁事实（不要再猜）

| 表面 | 载体 | 不是 |
| ---- | ---- | ---- |
| 净化点 / 裂隙角锚读数、底栏提示 | **A 世界内装置** | 调试字、OS 通知 |
| 存续报告 / 分配 / 蜕变 / 供奉 / 出击装配 | **B 世界内终端**（那台磷光屏） | 浏览器页、后台 Dashboard、左侧分类导航 |
| 主菜单 / 暂停 / 设置 | **C 元界面** | 仍守同一色板与术语；只有这里允许「我知道这是软件」 |

屏幕空间一律挂 `architecture.md` 声明的 overlay 根（现为 `#dom-ui-root`）。禁止 `document.body` + `position:fixed`，禁止 Phaser `scrollFactor(0)` 角锚。固定逻辑分辨率 960×640，不写响应式断点。

Kit 活文档：`docs/design-notes/ui-art-overhaul.md`。权威链：该表面 ui spec（或系统 spec 的 UX 节）> Kit > `art-direction.md` §6 > `world.md` 术语表。

## 画之前（缺一步不许写样式）

1. **读项目上下文**：`vision.md` → `world.md` 术语 → `art-direction.md` §6 → `architecture.md` overlay → Kit → 该表面 spec 的 UX 节。没有 Kit / 参考则走文末 Bootstrap，禁止套别的游戏的皮。
2. **看场上已锁装置**（改净化点 UI 时强制）：核心 v6-B、净化器 B1、储藏 C1、入口卡 5、供奉台卡 I、培养藏卡 A。新 overlay 必须能跟它们同框。
3. **看审查成品图**（改净化点 HUD / 提示条 / 面板时强制，1:1 对照，不是抄像素当教条）：
   - `docs/art/review-2026-08-28/cards/ui-hud.png`
   - `docs/art/review-2026-08-28/cards/ui-hint.png`
   - `docs/art/review-2026-08-28/cards/ui-status.png`
   - `docs/art/review-2026-08-28/cards/ui-alloc.png`
   - `docs/art/review-2026-08-28/cards/ui-empty.png`
   - 论述：同目录 `report-purification.html` §5 HUD、§6 面板
4. **写清玩家这一屏必须回答的问题**，再填信息。决策用的身份不得做成无名圆点。表名 / 数值 / 档位分开展示。
5. **复用项目基元。** 同类载体用同类语言。禁止面板内联第二套设计系统。动 `src/ui/dom/panel-styles.ts` 的 CRT 基元 = 全局事件，必须单独立批并全面板回归（含裂隙 HUD / 暂停 / 出击装配）。

停工：没写出三问将如何被这一屏满足；A/B 做成软件窗口；只写游戏名不写「学什么动作」。

## HOW — 三问怎么验

### 问 1 · 好不好看

操作定义见 [aesthetics.md](aesthetics.md)。最低动作：

- 截一张逻辑分辨率画面（能的话再出灰度版）。
- 与审查成品图并排：容器、分组、字号层级、空白是否被内容填住。成品图是方向，不是把 2026-08-28 的像素描进已经换过世界模型的关卡。
- 列出每一处非平直表现的物理原因（磷光、扫描线、键印磨损）。答「好看」的删掉。
- **压对比反 AI 味**：正文不要纯白；最亮值按 Kit 的 `ui-text-bright`（约 `#c8cdd4` / 审查处方约 179），不要把对比拉满当「清晰」。克制 CRT 后处理，扫描线是材质不是滤镜秀。

人点名看不清时，「风格需要」不能当理由。

### 问 2 · 读作游戏 UI

操作定义见 [like-a-game.md](like-a-game.md)。最低动作：

- **主-从**：选中项始终明确；详情只讲当前项。禁止所有卡片同等权重平铺。
- **渐进披露**：决策必需的在第一眼；说明、氛围句、次要数值进第二层。
- **焦点驱动**：每一屏同时只有一个操作焦点。分配屏的焦点是「投入」，不是「浏览三台机器的说明书」。
- **状态优先**：先完整度 / 能否做 / 还差多少，后氛围文案。氛围句下面必须跟具体数值。
- **键鼠同一通道**：不依赖 hover 才能知道身份。提示键 = 绑定键。不可用必须写出缺口（`还差 N`），不能只变灰。
- **游戏惯例用顶 Tab**，不要左侧分类导航（那是网页后台）。

心理模型：玩家在**操作一台设备**，不是在阅读文档。

### 问 3 · 与游戏整体风格同一世界

- 把 overlay 截图贴进 `#purif` 同框：四周漏景里的世界装置仍在。边框策略、字体族、冷色板、暖色只给薪柴——必须像那台设备打出来的字。
- 把本游戏两个以上 UI 表面拼成一张。有一张像后台或 debug → 把新的收进现有基元。
- 问：把这块 UI 挪到另一款暗色科幻游戏里是否照样成立？会 = 世界观没喂进去。

## 审查收成的构造法（方向，不是代 art 写死的像素）

处方级尺寸 / hex 以 Kit 与当批 art 规格为准。下面是**不许再退回的结构**。

**HUD（角锚读数）**

- 必须有容器、分组、字号层级。无容器无分组 = debug 残留。
- 资源组 vs 状态组分开。薪柴最大。「下次归来」默认弱，靠近入口才满显。余光靠条长，不靠把读数写成一行说明书。

**提示条（世界层与 UI 层的唯一桥梁）**

- 必须有容器。无目标 opacity 约 0.5，靠近可交互点升到 1.0（过渡约 150ms）。
- 第二行给状态预览，让人在移动中决定要不要按 E。不要等打开面板才知道「这台现在怎样」。

**面板**

- 顶部固定身份（如三模块条）+ 顶 Tab + 整宽详情填满（消灭大块空白）+ 底键印。
- 分配：一次只操作一个模块；「投入」是唯一操作焦点；底部**出击预估**只许把已有出击修正（混乱增速 / 薪柴价值 / 起始混乱）译成下次出击后果。禁止发明机制里没有的生存评分。
- 空状态三件套：是什么 / 为什么空 / 现在该做什么。禁止纯黑空白。

具体翻车与对照见 [exemplars.md](exemplars.md)。

## 闸门（三问之后，不是 HOW）

`docs/specs/_template-ui.md` 末尾 U1–U12 仍是全项目权威清单。过 U2 只证明没踩已知 web 套路。人否决三问任一 = UI 不合格，即使十二格全勾。

## 交付

书面回答三问，各附一帧证据（或写明哪张截图）。准备逻辑分辨率截图。

**不许**写：好看、审美过关、像游戏、PASS、成体系。

**不许**把交付标题写成「机械层已扫；审美待人终审」——那句是旧 skill 的交差句，会让三问再次落空。改写：「三问已作答（证据：…）；审美 / 读作游戏 / 风格适配待人终审」。

## 角色分工

| 角色 | 必须做的 |
| ---- | -------- |
| design | 问 2 的结构（主-从、焦点、打开方式、出击预估只译已有修正）；术语分开 |
| art | 三问的视觉规格；与已锁装置并排；压对比；最短热修仍核三问 |
| code | 未走本 skill / art 未核新视觉语言 → 不写样式。挂载与共享样式跟 architecture / Kit |
| qa | 向产出方要三问书面答案 + U1–U12 机械证据。不得代人勾三问 |
| director | 派 UI 必须写明 Read 本 skill；只写「过 U1–U12」= 派发不合格；人否决三问 → art，不改 constants 糊 |

## Bootstrap：项目还没有 Kit / 参考研究

本仓库已有 Kit 与参考（`docs/design-notes/ux-references.md`）。仅当新项目或新表面完全无文档时：

1. 从 vision + world 提炼调性与术语禁忌。
2. 按机制同构 + 气质同构列 3–5 个具名游戏，请人点头后锁定。
3. 产出 UI Kit v0，标 `DRAFT`。完成前 code 不许写除占位以外的样式。
