---
name: in-game-ux
description: >-
  Teaches HOW to make in-game UI look like a game (not an admin panel) and HOW
  to hit the aesthetic bar defined by the project's art-direction. Use when
  creating or editing HUD, DOM panels, CSS, overlays, menus, inspect UI, toasts,
  or when the user mentions 审美, UX, 不像游戏, 游戏界面, in-game UI, or admin panel.
---

# In-game UX：怎样像游戏、怎样审美过关

口号「要过关」不够。本 skill 是 **HOW**：教 agent 根据**本游戏**的 vision / world / art-direction 发明符合该世界的界面，而不是套用别的项目的皮。

触碰任何 in-game UI（HUD / 面板 / 蒙层 / CSS / 菜单 / 检视 / toast）必须走完开工闸门再画；画完必须答自检。过反模式清单 ≠ 好看 ≠ 像游戏。审美与「读作游戏」由**人终审**——agent 不许自称过关。世界内像素实体、图集、程序像素走 `.cursor/skills/pixel-models/SKILL.md`，不要用本文件发明描边和色板。

自定义 agent **不会**自动加载 skill。被派到 UI 任务时必须显式 Read 本文件；Director 的 Task Brief 必须写明这一步。

对照：[like-a-game.md](like-a-game.md)（像游戏的判断动作）· [aesthetics.md](aesthetics.md)（审美操作定义）。项目填充物（色板、参考表、组件类、已确认丑法）**不在本 skill 里**，按下方「加载项目上下文」去读。

## 先验（为什么你会画成后台）

训练数据里「UI」的最大簇是 SaaS 后台。不先钉**载体 + 具名游戏参考**，产出必然是圆角卡片、hover、居中弹窗、`hover/active/disabled`。这是分布错误，不是单纯审美失手。dogfood 证据见 `guides/99-review.md` FV-01。

## 加载项目上下文（先读，再画）

按序检查。不存在则走文末 **Bootstrap**，禁止拿其他游戏或本 skill 里的例子当默认皮。

1. `docs/vision.md` — 体验调性
2. `docs/world.md` — 术语表、材质/禁忌、UI 是否 diegetic
3. `docs/art-direction.md` — UI 美术方向（章节因项目而异）
4. `docs/architecture.md` — 屏幕空间 overlay vs 世界坐标的挂载约定
5. 参考研究（若有）：`docs/design-notes/ux-references.md` 或 art-direction 声明的等价文件
6. UI Kit 活文档（若有）：`docs/design-notes/ui-kit.md` 或 art-direction / architecture 声明的等价文件
7. 该表面的 `docs/specs/ui-*.md`
8. 锁定色板（若有）：`docs/art/palette.json`

权威链：**该表面 ui spec > 项目 UI Kit（活文档）> art-direction 的 UI 节 > world 术语表**。Kit 与实现冲突时，以已验证的当前实现为准并回写 Kit。

## 开工闸门（缺一步不许写样式）

### 1. 定载体（U1）

写出 A 世界内装置 / B 世界内终端 / C 元界面 + 一句话理由。

- 只有 **C** 允许软件界面感。A = 世界里能看见的装置读数（通常更轻、无「软件窗口」外壳）。B = 站在世界里某块屏/仪表前操作。
- **载体 ≠ 实现层。** 屏幕空间读数挂 **architecture.md 声明的 overlay 根**；钉世界坐标的才走引擎世界层。禁止把角锚 HUD 绑在会因 camera zoom / letterbox 漂移的实现上。不要另起一套未声明的 overlay 根。

停工：没写出 A/B/C；A/B 做成软件窗口。

### 2. 钉 2–3 个具名参考（U12）

从项目参考研究里选，没有则按 Bootstrap 产出候选再请人点头。表：

| 游戏名 | 锚的维度（学什么**动作**） | 明确不学什么 |
| ------ | ------------------------- | ------------ |

再写一行「本屏不像」：Dashboard / 设置页 / 电商列表 / 确认对话框链（按本屏风险改）。

抄错参考比不抄更贵：只写游戏名不写维度 = 停工。配色/滤镜/玩法结构默认不抄。如何选参考见 [like-a-game.md](like-a-game.md)。

### 3. 填 P0 / P1 / P2

先写「玩家在这一屏必须回答的问题」，再填信息。

- P0 始终可见、零操作，**≤ 6 项**（项目 IA 可改此上限），半秒读出数值；贴屏幕边缘。
- P1 一键或走近；不依赖 hover。
- P2 主动进入某界面才读。
- 决策必需信息不得进 P2。表名 / 数值 / 档位**分开展示**，禁止粘成会被读成复合名词的一句。

停工：决策用的身份（工具名、资源名、压力条）做成无名圆点或无标签裸条。

### 4. 「这是哪台机器打出来的字」

一句话：字体/边框/闪烁来自哪台**本世界里的**设备或物件。每一处强调对应世界里什么物理原因，答「好看」就删。状态只用游戏语义：静默 / 可交互 / 已选中 / 缺 X（写出缺什么）/ 临界。禁止 `hover/active/disabled` 当设计语言。

具体允许的材质、色、字号以 art-direction / Kit 为准——本步骤要的是**设备隐喻**，不是一份通用皮。

### 5. 复用项目基元，禁止自造

打开项目 UI Kit 与共享样式入口（路径见 Kit / architecture）。同类载体用同类语言。禁止面板内联第二套设计系统。

禁止（除非 art-direction **明文**把某条写成世界材质）：未映射的新色、Kit 以外的字号档、圆角卡片堆、投影/外发光、按钮渐变、通用图标字体、`title` tooltip、浏览器默认滚动条、通用软件词（提交/确认/OK/Continue/Prototype Build）。

每个新色必须能答项目色彩架构或「已有系统色」。答不出 = 不准引入。

### 6. 打开方式与打断

一句话说清「玩家做了什么导致这层面板出现」。进行中避免居中弹窗挡战场。阻断类确认同时只留 **1 条**（项目 IA 可放宽，须写进 spec）。

## 画完自检（必须书面回答；答不出 = 不合格）

1. 载体 A/B/C？屏幕空间是否挂在 architecture 声明的根上，而不是另起的 body / 会随 zoom 漂移的角锚？
2. 2–3 个具名游戏，各锚什么、各不学什么？本屏明确不像哪三类？
3. 全部 P0（≤6）。不操作截图能否读出每项身份 + 数值？
4. 「哪台机器」一句话。每处投影/发光/圆角/脉动的物理原因？答「好看」的列出并删。
5. 每个不可用项是否写出缺口（`资源不足 · 还差 N`），而不是只变灰？
6. 转灰度后危险/可用是否仍能靠形状/位置/符号/计数读出？表名数值档位是否分开？
7. 面板如何被打开？阻断确认是否超过 1 个？
8. 可见词是否来自 world 术语表 / 策划数据源？键盘能否做完全部操作？提示键 = 绑定键？

机械层（圆角、投影、原生 tooltip、仅 hover 可得、软件词）可以自称已扫。**不许**写：好看、审美过关、像游戏、PASS。交付给人时写「机械层已扫；审美待人终审」，并准备逻辑分辨率截图（能的话加灰度版）。

人否决丑或不像游戏 = UI 不合格，即使 U1–U12 全勾。

## 角色分工

| 角色 | 本 skill 里必须做的 |
| ---- | ------------------- |
| design | 步骤 1–3、6（结构）；自检 1–3、5、7–8 |
| art | 步骤 2、4–5；自检 2、4、6；最短热修仍核载体+参考+相关 U |
| code | 未走闸门 / art 未核新视觉语言 → 不写样式。挂载与共享样式跟 architecture / Kit |
| qa | 用自检 1–8 要证据；机械通过 ≠ 审美通过；不得代人勾「好看」 |
| director | 派 UI 任务时要求执行本 skill；人否决审美/不像游戏 → art，不改 constants 糊 |

## Bootstrap：项目还没有 Kit / 参考研究

触发：无 art-direction UI 节，或无 UI Kit，或无参考研究，或当前 ui spec 缺载体+参考。

1. 从 vision + world 提炼体验调性、术语、材质禁忌。
2. 按**机制同构 + 气质同构**列 3–5 个具名游戏候选（资源分配 / 词条密度 / 设备检视 / 预告可信……），写入 `docs/design-notes/ux-references.md` 骨架：每款「为什么可能合适 / 学什么动作 / 不学什么」。**请人点头后再锁定。**
3. 产出 UI Kit v0（`docs/design-notes/ui-kit.md` 或扩展 art-direction）：载体分工、从主色板派生的 UI 色（宜少）、2–3 档字号、3–5 个基元名、5 条反模式。标 `status: DRAFT`、`bootstrap: true`。
4. 选最简单的一屏走完整 template，实现后**回写 Kit**。
5. Bootstrap 完成前，code 不许写除占位以外的样式。禁止用其他项目的默认皮填空。
