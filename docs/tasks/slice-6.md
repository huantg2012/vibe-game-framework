---
status: COMPLETE
slice: 6
created-by: director agent
created-when: 2026-08-16
last-modified: 2026-08-19
---

# Tasks: Slice 6 — 程序化地图

Slice 类型：系统
验证问题：连续两次踏入裂隙，布局和撤离位置都不同；可走区外轮廓不规则；障碍有情景；氛围能分清是另一块碎片。不验证多出口选择。

权威范围与三条约束：`docs/progress/current-slice.md`。

**现状（2026-08-19，COMPLETE）：** C1–C6 已交。DEC-064 收工三件已交。QA PASS（`docs/qa/report-slice-6-closeout.md`）。下文历史 Brief 不要当未做任务再执行。

**检查点后（DEC-063）：** 裂隙小地图改为跟随玩家的圆形局部窗口。任务 D3 / A2 / C6 / Q2 已交。

---

## Task: D1 | assignee: design

Title: 新建地图生成规格（三条约束各给多条路） | Priority: P0 | Dispatch: 🔴

### 目标

写出 `docs/specs/system-map-generation.md` 第一轮。人能靠它拍板，code 还不能把它当「算法已锁死」来实现。

### 上下文

系统 Slice 第一步。人要求自行准备知识/审美/参考；每个问题多解，禁止一棵树吊死。相交矩形并集只是外轮廓的参考之一。

### 具体要求

- [ ] 先读 `CLAUDE.md`、`docs/vision.md`、`docs/world.md`、`docs/art-direction.md` §2 / §4.2、`docs/architecture.md` DEC-ARCH-003、DEC-005、`docs/progress/current-slice.md`、`src/scenes/rift-map-data.ts` 头注释、`src/systems/procedural-surface.ts` 头注释
- [ ] 调研至少 3 个具名参考（外轮廓 / 可读废墟 / 碎片氛围各至少能点名），写清学什么、不学什么
- [ ] 约束 1 / 2 / 3 各给 **至少 3 条**可实现路径 + 后果 + 和世界观/已有地表管线的冲突
- [ ] 标「已锁定」（只抄 current-slice 里人已拍的）和「待确认」（算法方向、本 Slice 几种氛围、「按 R」）
- [ ] 输出数据契约草案：tile 网格 + 可走掩膜 + 出生/撤离/薪柴/巡逻/地标；矩形缓冲 + 不规则可走区如何表达
- [ ] 消费现有布局约束：主干 40–60 秒、从出生能走到撤离、一个撤离点且不钉死旧格子
- [ ] 碎片类型若有策划字段：声明走 `data/*.csv`，禁止代码手写主题表
- [ ] 本批 **不**写撤离多样性。旧撤离规格本批不改，除非你判断「位置从哪来」不写进旧文件就会改坏——若要改，停下来列进 D2，本文件只点名
- [ ] 本批不写 `src/**`

### 约束

- 你是引导者不是决定者：禁止「推荐 A + 当作已定的完整方案」
- 不退回 BSP 方正房间
- 不引入未论证新色
- 对人少用黑话；规格正文用规则句

### 验收标准

- 文件存在，frontmatter 合规，首行 TL;DR
- 三条约束都有多条路，没有「唯一算法已定」
- 待确认列表短、能直接问人

### 相关文件

- `docs/specs/_template-system.md`
- `docs/progress/current-slice.md`
- `docs/architecture.md`（MapGenerator 行）

---

## Task: D2 | assignee: design

Title: 撤离规格最少补句（仅必要时） | Priority: P1 | Dispatch: 🔴

Depends: D1 + 人过 D1

### 目标

若 D1 证明「撤离点坐标改由生成器提供」必须写进 `system-chaos-scavenge-extract.md`，就地加最少句子。不做多样性。

### 具体要求

- [ ] 先判断要不要改。不要 = 本任务关闭并写一句理由
- [ ] 要 = 只改「位置来源 + 仍是一个点、走近按 E」；`interface-changed` 仅在接口真变时为 true
- [ ] 不写多出口、条件口、捷径

---

## Task: A1 | assignee: art

Title: 本 Slice 氛围种类的视觉规格 | Priority: P0 | Dispatch: 🔴

Depends: 人锁「做哪几种碎片氛围」

### 目标

每种锁定的碎片：地表 / 墙 / 虚空 / 污染渗法，沿用 art-direction L1+L2，不发明新皮。

### 具体要求

- [x] 先 Read `.cursor/skills/in-game-ux/SKILL.md` 仅当触及 HUD/标记；世界层地表以 art-direction 为准（本批未写 overlay，未走该 skill）
- [x] 对照已锁 L1 五套记忆色，只为**人点名要做的几种**写参数（噪声、材质残影、墙的可读物）
- [x] 写进 Kit 或 `docs/art/` 短规格，并回写 art-direction 若实现会偏（`docs/art/rift-fragment-surfaces.md`；§4.2 / §14.3 各一句）
- [x] 不改 `src/**`

---

## Task: C1–C5 | assignee: code

Title: 实现批次（规格通过后才开） | Priority: P0 | Dispatch: 🔴

Depends: D1 人过 +（若需要）A1

**C1** 可走掩膜：不规则外轮廓 + 矩形缓冲里的虚空。能看图、能丢掉坏图。不布内容。
- [x] `src/generation/outline-mask.ts`：生长+腐蚀+最大连通块
- [x] 坏图丢弃（填满缓冲 / 啃边矩形 / 贴框）
- [x] `TileType.VOID`；`TileGrid` 虚空不可走、不挡视线
- [x] 预览 `docs/art/demos/slice-6-outline/c1-*.png`；闸门 `npm run check:outline`
- [x] **不**布墙、出生、撤离；**不**改 RiftScene 读固定图

**C2** 情景障碍：按锁定策略生成可读特征，不是胡椒粒。
- [x] `data/rift-fragments.csv` → `src/generated/rift-fragment-data.ts`
- [x] `src/generation/ruins.ts` + `masses.ts`：多坨小体量切开空地；身份走 CSV 维度；围死的地会挖开
- [x] 墙只落在陆地上；剩下的地仍连通；胡椒粒墙丢掉
- [x] 预览 `docs/art/demos/slice-6-outline/c2-*.png`；闸门 `npm run check:ruins`
- [x] 十锚配方栈（`structure-grammars` + `cover` + 氛围场 + 桩）；画廊 `spatial-drafts/index.html`
- [x] DEC-058 反迷宫落地：方向 1 厚短残块 + 正交 B；形状闸门替换 `sight≤14`
- [x] 密度中等空地：五案对照已出（`spatial-drafts/probes/`）；人授权结合后写入预览栈（DEC-060）；**密度人锁（DEC-061）**
- [x] **不**布出生/撤离；**不**改 RiftScene；**不**改地表着色

**C5** 氛围参数进 `procedural-surface`（及墙/虚空），读策划数据，不手写第二套色表。
- [x] 虚空格填 `void-black` / `deep-black`，禁止把 L1 地板铺出岛外
- [x] 旋钮读 `RIFT_FRAGMENT_DATA`（含未启用行）；每次出击 `textures.remove` 后重烤
- [x] 渍色走 `stainKey` 已锁名；划痕角度 `free` / `orthogonal` / `longitudinal`
- [x] 裂隙每次抽锚 + 新种子 + 邻域抖动再生成并烤图（画廊是样例，不是搬进去的十张图）
- [x] 同一份氛围场只改 phase：雾烤死，天空胶囊在裂隙里循环
- [ ] 污染年龄 / 残破度组合轴
- [ ] 尘点沿风位移

每批独立可看、独立过 `typecheck`。禁止 ALL 打成一批。

---

## Task: C3+C4 | assignee: code

Title: 布点 + 接到裂隙场景 | Priority: P0 | Dispatch: 🔴（人已发起 /director，本会话执行）

Depends: C2 密度人锁（DEC-061）

**本批范围：只做 C3 + C4。不做 C5。不标 Slice COMPLETE。不 commit / push。**

### 目标

`generateRiftLayout(seed)` 交出完整 `GeneratedRiftLayout`；`RiftScene` 吃它。手写图留对照夹具。同一次出击不重跑；下一次踏入新种子。阵亡/撤离按 R 都回净化点。

### 先读（按序）

1. `CLAUDE.md`
2. `docs/design-notes/slice-6-layered-generation.md`（活策略；扩空间读「Agent 入口」）
3. `docs/specs/system-map-generation.md` 的 P / G / C 节（规则 1–8、17–23）+ 数据契约 `GeneratedRiftLayout`
4. `docs/progress/current-slice.md`、本 Brief、DEC-056 / DEC-058 / DEC-060 / DEC-061
5. `.cursor/rules/map-generation-connectivity.mdc`
6. `src/scenes/rift-scene.ts`、`src/scenes/rift-map-data.ts`、`src/systems/run-controller.ts`
7. `src/systems/tool-system.ts` 里 `RIFT_MAP`（约 import + `applyAbyss`）
8. `src/types/map-types.ts`、`src/generation/draft-pipeline.ts`、`src/generation/recipes.ts`、`src/generation/types.ts`、`src/generation/connectivity.ts`
9. 若动到撤离提示文案或小地图**样式/标记形状**：先 Read `.cursor/skills/in-game-ux/SKILL.md` 再改。只换坐标、不改皮 → 不必走 skill。

### C3 — `generateRiftLayout(seed)`

- 岛 = 现成 `generateRecipeDraft`：用种子抽十锚之一（`PREVIEW_RECIPES`），再 `generateRecipeDraft(seed, recipe)`。活路径是配方栈。**禁止**把 `masses.ts` 围院语言接进生产布局。
- 同一种子必须得到同一张图（配方选择 + 布点都确定性）。
- 布点：
  - 出生与撤离分列陆地两端（规格 17）。撤离是继续前进抵达，不是原路折返。
  - 恰好一个撤离。走近按 E，触发半径沿用现常量。**禁止**钉手写图那个 `X`（现图约第 3 行居中；世界坐标即 `RIFT_MAP.layout.extractionPoint.position`）。滚到该点则丢弃重抽。
  - 薪柴 safe 3 / contested 3 / deep 2。分档原则读 `system-chaos-scavenge-extract` 规则 20（离撤离路程 × 巡逻覆盖）。坐标由生成器给。
  - 污染物数量沿用现图：**3**。可走，从出生可达。
  - 巡逻 **3–4**。路点可走、从出生可达。撤离格不在任何巡逻的常驻视野内（`AI.SIGHT_RANGE` 180px）。通往撤离的最后一段由 **1** 个巡逻覆盖。
  - 出生格四连通 flood-fill 必须到撤离格。薪柴 / 污染物 / 每个巡逻路点必须可走且从出生可达。
- **规格 21 双路径是软目标**：本批先保证空间能撑、可达、两端分列。机器闸门不要把「两条不相交主干」做成 FATAL。做得到就做；做不到在交回里写缺口，不要为双路径加细墙/改形状闸门。
- 地标可空或少量地板贴花；不是墙。装饰不得拆连通。
- 重试：先就地挪点 / 挖通，再换种子重试。**留在配方栈**。禁止失败换另一套生成算法。重试有上限；到顶开发期**抛错**（大声失败），不要静默交出坏图，不要静默回退手写图。
- 在 `src/generation/` 落地（建议 `rift-layout.ts` + `types.ts` 补 `GeneratedRiftLayout`）。从 `src/generation/index.ts` 导出 `generateRiftLayout`。

### C4 — 接到裂隙

- `RiftScene.create` 吃本次 `GeneratedRiftLayout`（tileMap + TileGrid + spawn/extract/kindling/contaminants/patrols/landmarks）。禁止再 `const { tileMap, grid, layout } = RIFT_MAP` 当运行时真相。
- 手写图 `rift-map-data.ts` **留着**当对照夹具 / `validateRiftMap()`。正式踏入走生成器。
- 种子：每一次从净化点踏入（含 dev `#rift` 直进）抽新种子；同一次出击（场景未销毁）不重跑。不要把种子写进 URL 当产品功能。
- 解开 `tool-system.ts` 对 `RIFT_MAP.layout.kindlingNodes` 的直读。从 `create()` options 注入本次薪柴坐标。
- `RunController.restart()`：阵亡与撤离成功都回净化点（DEC-056）。删掉阵亡分支的原地 `resetAll()` 再打这一次。
- 开发期生成失败要大声失败（throw / DEV `console.error` + 不要用固定图顶上）。
- 不新开 HUD。提示仍是「[E] 撤离」。小地图继续标一个撤离点，标记形状不新造。
- 不接净化点替换。不发明新色。本批不改 `procedural-surface.ts` 写死 `frag-outdoor`（C5）。
- 接线后回填 `docs/architecture.md` MapGenerator 行：RiftScene 改吃 `generateRiftLayout`；手写图是夹具。frontmatter `changed-this-slice: true`。规格 frontmatter：`generateRiftLayout(seed)` 已实现；`GeneratedRiftLayout` 交齐。

### 机器闸门

必须全部跑过再交：

1. `npm run typecheck`
2. 扩展 `npm run check:recipes` **或** 新 `npm run check:layout`：若干种子上 `generateRiftLayout` —— 墙后地板四连通分量恰好 1；出生 flood-fill 到撤离；恰好 1 个撤离且不是手写图那个点；薪柴 3/3/2；污染物 3；巡逻 3–4；所有点可走且从出生可达。形状/掩护闸门继续打在配方岛上（现有 `check:recipes` 不要拆掉）。
3. 现有 `check:outline` / `check:ruins` / `check:recipes` 仍绿。
4. 可玩：`npm run dev` 能进裂隙（净化点踏入或 `#rift`），出生在生成格，能走向撤离提示。

连续 **2 次**过不了机器闸门 → **停**，升档报告 Director，附两次失败输出。不要第三次硬扛。

循环预算：布点重试有上限；到顶开发期抛错。到顶未收敛不要无声换算法。

### 禁止

- `sight≤14` / 空矩形 48 当生产循环或 FATAL
- 封闭房间 + 门廊（DEC-005）
- 失败换另一套生成算法碰连通
- 新 HUD / 新撤离标记形状 / 发明新色
- 接净化点替换
- 把 `masses.ts` 围院接进 RiftScene
- 本批做完整 C5（地表参数化）
- commit / push

### 验收标准

- [x] `generateRiftLayout(seed)` 存在且确定性
- [x] 出生能走到唯一撤离；点数符合上表
- [x] RiftScene 运行时不读手写图当真相
- [x] `tool-system` 无 `import { RIFT_MAP }`
- [x] 阵亡按 R 回净化点，不是原地重开
- [x] `typecheck` + layout 闸门绿
- [x] 交回写明：双路径是否做了；C5 未做

### 相关文件

- `src/generation/*`、`src/scenes/rift-scene.ts`、`src/systems/run-controller.ts`、`src/systems/tool-system.ts`
- `docs/architecture.md`、`docs/specs/system-map-generation.md`（frontmatter / 规则 3 实现句）
- `docs/progress/current-slice.md`（勾 C3/C4；不标 COMPLETE）

---

## Task: Q1 | assignee: qa

Title: 对照规格验收 | Priority: P0 | Dispatch: 🟢

Depends: C1–C5

对照 `system-map-generation.md`：连通、一个撤离、外轮廓不规则、障碍最小尺度/情景、两次生成氛围可分、提示仍是按 E。不代勾好看。

---

## 检查点后热修：裂隙小地图圆形局部窗口（DEC-063）

**不是新 Slice。** 人已锁需求。顺序：D3 → A2 → C6 → Q2。对人用完整短语，禁止自造缩写。

---

## Task: D3 | assignee: design

Title: 就地扩写裂隙小地图规则（圆形局部窗口 + 真实视野） | Priority: P0 | Dispatch: 🔴（人已发起，本会话执行）

Depends: 无（检查点 DEC-062 之后）

### 目标

就地扩写已有规格，让 code 能按规则实现、qa 能机械比对。**禁止**新开一份小地图规格文件。

### 必须先读

- `CLAUDE.md`
- `docs/progress/current-slice.md` 中「检查点后：裂隙小地图圆形局部窗口」
- `docs/progress/decisions-log.md` DEC-063（人已锁，禁止再开选项）
- `docs/specs/system-chaos-scavenge-extract.md` 规则 30 与 HUD 节
- `docs/specs/system-movement-vision.md` 视野规则 11–23 与 `VisibilitySystemAPI`
- `docs/design-notes/ux-information-architecture.md` S12
- `.cursor/skills/in-game-ux/SKILL.md` 步骤 1–3、6（结构层：载体 / 参考 / 信息优先级）。自定义 agent 不会自动加载 skill。

### 人已锁（写成规则句，不要 A/B/C）

1. 小地图应是圆形，其覆盖范围不能等于或显示完整 64×42 区域。
2. 覆盖范围内同时显示：玩家已探索部分，以及未探索迷雾。
3. 圆的边界渲染必须与当前游戏视觉语言一致（裂隙随身罩 `.device-plate`、色板、禁止通用雷达细框 / 灰金属线；人否过 1 像素 `#2a2d32` 框）。像素级画法留给 art。
4. 玩家不能以任何方式从小地图读出 64×42 这个矩形边界（不要硬切边、不要靠缩放到刚好塞进整张缓冲、走到岛边时虚空与雾不能暴露矩形缓冲的直角）。
5. （人未写第 5 条。）
6. 小地图要跟踪玩家真实视野（与 `VisibilitySystem` 的看见过 / 当前看见一致，不是现在的灯半径近似圆），并且玩家标记带朝向。

解释约束（必须写进规格）：

- 圆是跟随玩家的局部窗口，不是「把整张 64×42 压进一个圆」。
- 直径（以格子计）必须小于缓冲，使得即使站在岛中央也看不全整张缓冲。具体像素直径留给 art。
- 真实视野：与裂隙主画面同一套遮挡 / 视锥真相；已探索集合应来自实际见过的格子，不是「脚边 2.5 格圆」。
- 深渊之眼揭示：保留现有工具语义（时限、衰减、闪、敌方、节点形状），接到新圆形窗口上，不要另起一层界面。
- 仍只标一个撤离点；标记形状不新造第二种撤离符号（竖缝可保留）。
- 屏幕空间仍挂 `#dom-ui-root`。禁止 `document.body` + `position:fixed`。禁止 Phaser `scrollFactor(0)` 角锚。
- 净化点仍然没有小地图。不改生成器缓冲尺寸。

### 具体要求

- [ ] 扩写 `docs/specs/system-chaos-scavenge-extract.md` 规则 30（小地图行 + 必要的规则句）。写清：圆形局部窗口、覆盖范围内已探索 / 迷雾、禁止暴露矩形缓冲、揭示 = 真实视野、玩家标记带朝向、深渊之眼接到同一窗口、一个撤离竖缝。
- [ ] 揭示绑定视野：在 `docs/specs/system-movement-vision.md` **最少补句**（已见格子的查询契约）。已有 `getVisibilityAt` / `isPointVisible`。若必须新增「已见格子」只读接口，写入 `VisibilitySystemAPI` 与 frontmatter `exposes`，并设 `interface-changed: true`。若场景层每帧用现有查询累积即可、不扩接口，则 `interface-changed` 保持 false，仍要写一句「小地图已探索集合的真相来源」。
- [ ] 系统互不直接 import：小地图不 import `VisibilitySystem`；场景层翻译。写进接口段。
- [ ] 更新两份规格的 `last-modified-date`（2026-08-19）。`interface-changed` 仅在对外接口真变时为 true。
- [ ] 规则 18「没有记忆标记」针对的是薪柴节点不在视野外留 HUD 标记，不要写成「小地图也不得记住已探索格子」。小地图战争迷雾是另一条规则。
- [ ] 视觉规格部分标注由 art 补充。结构层不要发明新色、新符号、新挂载根。
- [ ] 不写 `src/**`。不改地图生成规格。不写撤离多样性。不写第二种敌人。

### 验收标准

- 规则句能让 qa 逐条打勾：圆、局部窗口、迷雾、真实视野、朝向、矩形缓冲不可读、深渊之眼、一个撤离、挂载根。
- 无人锁需求被改成可选项。

---

## Task: A2 | assignee: art

Title: 圆形随身罩小地图最短合规核对 | Priority: P0 | Dispatch: 🔴（人已发起，本会话在 D3 之后执行）

Depends: D3

### 目标

人已点名「圆形 + 跟现行裂隙随身罩风格一致」。你不重新发明方案。最短合规核对后，把可施工像素规格写进活文档。

### 必须先做（缺一不合格）

1. **先 Read** `/Users/yilungao/coh/.cursor/skills/in-game-ux/SKILL.md`（开工闸门 + 写完自检）。自定义 agent 不会自动加载 skill。只写「审美过关 / 像游戏」而不走该 HOW = 不合格。
2. 按**本游戏** `docs/art-direction.md`、`docs/design-notes/ui-art-overhaul.md`（Kit）、`docs/architecture.md` 填写，禁止套用别的游戏的皮。
3. 色只准 `docs/art/palette.json`。

### 最短合规核三件事

- **载体 A 仍成立：** 裂隙随身装置第二块屏，`#rift-minimap.device-plate` 挂 `#dom-ui-root`。
- **2–3 个具名参考：** 写清学什么动作 / 明确不学什么。必须包含：不学通用雷达细框。人否过 1 像素 `#2a2d32` 框。
- **相关 U 项：** U1 载体、U2 无后台 / 无雷达窗、U6 不挡战场中心、U9 形状可读（十字带朝向、竖缝、方、菱）、U11 与左上 `.device-plate` 同族。

### 产出（就地更新，不要另起一套皮）

优先就地更新 `docs/art/ux-visual-pass-slice-55.md` **第 4 节**；Kit 对应节（`ui-art-overhaul.md` A5-14）若仍写「整张矩形画布」则改一句对齐。必须写清：

- 圆直径（格子数 + 画布像素）。直径必须小于 64×42 缓冲较短边，站在岛中央也看不全整张缓冲。
- 圆边界怎么画才像这块随身罩而不是雷达（凹槽 / 玻璃 / 暗扫描 / 禁止细金属线圈）。
- 雾 / 地 / 墙 / 虚空色（沿用色板已锁值，除非与圆窗口冲突必须改——改则说明理由）。
- 玩家标记如何带朝向（在现有暖橙十字上加方向，不要改成圆点）。
- 岛边：圆内超出陆地的区域怎么填，才不会读出矩形缓冲直角。
- 深渊之眼标记仍在同一块圆 canvas 上。

### 禁止

- 重新发明方案、新色相、新撤离符号、净化点小地图、灰金属线、圆角卡片、投影、teal 扫描。
- 不写 `src/**`。

### 写完自检

按 skill 逐条书面作答。不许写「好看 / 像游戏 / PASS」。

---

## Task: C6 | assignee: code

Title: 按核对后规格改裂隙圆形小地图 | Priority: P0 | Dispatch: 🔴（人已发起，本会话在 A2 之后执行）

Depends: D3 + A2

### 目标

只按 **D3 规格 + A2 像素规格** 改实现。不要自己发明皮。

### 改哪些文件

- `src/ui/minimap.ts`（主）
- `src/scenes/rift-scene.ts`（create / 每帧 update / destroy 接线）
- 若 D3 要求「已见格子」只读接口：`src/systems/visibility-system.ts` 提供查询；**场景层翻译**给小地图。小地图 **禁止** import `VisibilitySystem`（架构：系统互不直接 import；场景是编排层）。
- 若架构 Minimap 行过时：就地改 `docs/architecture.md` 模块表那一行。
- `tsc` 必须过。连续 2 次过不了机器闸门 → 停止，升档报告，不要第三次盲改。

### 必须成立

- 圆形局部窗口跟随玩家，不是把 64×42 压进圆。
- 圆内同时有已探索与未探索迷雾。
- 已探索集合来自真实视野（`getVisibilityAt` > 0 的格子累积），不是 `RADIUS_AMBIENT` 近似圆。
- 玩家标记带朝向（用 `Player.getFacingAngle()`，经场景传入）。
- 走到岛边：虚空 / 雾填满圆，不露出缓冲直角。
- 深渊之眼语义不变，画在圆窗口内。
- 一个撤离竖缝；格子被揭示后才出现。
- 挂 `#dom-ui-root`。禁止 `document.body` + `position:fixed`。禁止 Phaser `scrollFactor(0)` 角锚。

### 禁止

- 改净化点、撤离多样性、生成器 `BUFFER_COLS` / `BUFFER_ROWS`、第二种敌人、音乐、全界面翻修。
- 用缩小缓冲来「藏」边界。

### 验收

- `npx tsc --noEmit` 退出码 0。
- 交回：改了哪些文件、真实视野怎么接到已探索集合、闸门输出。

---

## Task: Q2 | assignee: qa

Title: 对照更新后规格验收圆形小地图 | Priority: P0 | Dispatch: 🟢

Depends: C6

对照更新后的 `system-chaos-scavenge-extract.md` 规则 30 与 `system-movement-vision.md` 补句，机械比对实现：

- 圆形（覆盖 ≠ 完整 64×42）
- 圆内已探索 + 未探索迷雾
- 揭示 = 真实视野，不是灯半径圆
- 玩家标记带朝向
- 矩形缓冲不可读（代码路径上没有「整张缓冲硬切进圆」或「缩放到刚好塞进缓冲」）
- 深渊之眼仍在同一窗口
- 一个撤离竖缝
- 挂载 `#dom-ui-root`

写 `docs/qa/report-rift-minimap-circular.md`。不代勾审美。不修代码。

---

## Task: D4 | assignee: design | status: 已交

Title: 规格 21 换路改为可机器判定的硬保证 | Priority: P0

- [x] `system-map-generation.md` 规则 21：主路最短、封死后第二路 ≥1.15×、较短者更暴露
- [x] `system-chaos-scavenge-extract.md` 最少补归属句
- [x] 规则 24a：每次踏入抽 contaminationAge × ruinSeverity

## Task: A3 | assignee: art | status: 已交

Title: 核年龄轴无新色、尘点是漆 | Priority: P0

- [x] 两轴都抽；组合表数值不改
- [x] 尘点五条死约束；无新 HUD

## Task: C7 | assignee: code | status: 已交

Title: 三件接线 | Priority: P0

- [x] `evaluateDualPath` 共用；`check:layout` 无换路 FATAL
- [x] 尘点跟天空同一份场扫 phase
- [x] `rollFragmentAxes` → 地表着色；矩形错误块按年龄
- [x] `npx tsc --noEmit` / `npm run check:layout` / `npm run check:recipes`

## Task: Q3 | assignee: qa | status: 已交

Title: 收工三件对照 spec | Priority: P0

- [x] `docs/qa/report-slice-6-closeout.md` PASS
- [x] 本收工无新 HUD
